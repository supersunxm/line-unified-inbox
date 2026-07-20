import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";

export type StoredMedia = { body: Buffer; contentType?: string };

export interface MediaStorage {
  put(objectKey: string, body: Buffer, contentType: string): Promise<void>;
  get(objectKey: string): Promise<StoredMedia>;
}

function safeLocalPath(root: string, objectKey: string) {
  const rootPath = resolve(root);
  const filePath = resolve(rootPath, objectKey);
  if (!filePath.startsWith(`${rootPath}${sep}`)) throw new Error("Invalid media object key");
  return filePath;
}

export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root: string) {}
  async put(objectKey: string, body: Buffer) {
    const filePath = safeLocalPath(this.root, objectKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
  }
  async get(objectKey: string) { return { body: await readFile(safeLocalPath(this.root, objectKey)) }; }
}

export class S3MediaStorage implements MediaStorage {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, configuration: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    this.client = new S3Client({ endpoint: configuration.endpoint, region: configuration.region, forcePathStyle: Boolean(configuration.endpoint), credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
  }
  async put(objectKey: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: contentType }));
  }
  async get(objectKey: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!response.Body) throw new Error("Stored media body is unavailable");
    return { body: Buffer.from(await response.Body.transformToByteArray()), contentType: response.ContentType };
  }
}

@Injectable()
export class MediaStorageService implements MediaStorage {
  private readonly storage: MediaStorage;
  constructor() {
    const driver = (process.env.MEDIA_STORAGE_DRIVER ?? "local").trim().toLowerCase();
    if (driver === "local") {
      this.storage = new LocalMediaStorage(process.env.MEDIA_LOCAL_DIRECTORY?.trim() || resolve(process.cwd(), ".media"));
      return;
    }
    if (driver !== "s3") throw new Error("MEDIA_STORAGE_DRIVER must be local or s3");
    const required = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) throw new Error(`Missing S3 media storage variables: ${missing.join(", ")}`);
    this.storage = new S3MediaStorage(process.env.S3_BUCKET!, { endpoint: process.env.S3_ENDPOINT?.trim() || undefined, region: process.env.S3_REGION!, accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! });
  }
  put(objectKey: string, body: Buffer, contentType: string) { return this.storage.put(objectKey, body, contentType); }
  get(objectKey: string) { return this.storage.get(objectKey); }
}
