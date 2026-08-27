import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { hostname } from "node:os";
import { readMediaStorageEnabled } from "./media-storage.config";

export type StoredMedia = { body: Buffer; contentType?: string };
export type StoredMediaReference = { provider: string; fileId: string; mimeType: string; size: number };
export type MediaStorageHealth = { provider: string; enabled: boolean; folderAccessible: boolean; reason?: string };

export interface MediaStorage {
  put(objectKey: string, body: Buffer, contentType: string): Promise<StoredMediaReference>;
  get(fileId: string): Promise<StoredMedia>;
  health?(): Promise<MediaStorageHealth>;
  writeTest?(): Promise<{ status: number; reason?: string; message?: string }>;
}

function safeLocalPath(root: string, objectKey: string) {
  const rootPath = resolve(root);
  const filePath = resolve(rootPath, objectKey);
  if (!filePath.startsWith(`${rootPath}${sep}`)) throw new Error("Invalid media object key");
  return filePath;
}

export class LocalMediaStorage implements MediaStorage {
  constructor(private readonly root: string) {}
  async put(objectKey: string, body: Buffer, contentType: string) {
    const filePath = safeLocalPath(this.root, objectKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, body, { flag: "wx" }).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== "EEXIST") throw error;
    });
    return { provider: "local", fileId: objectKey, mimeType: contentType, size: body.length };
  }
  async get(objectKey: string) { return { body: await readFile(safeLocalPath(this.root, objectKey)) }; }
}

export class S3MediaStorage implements MediaStorage {
  private readonly client: S3Client;
  constructor(private readonly bucket: string, configuration: { endpoint?: string; region: string; accessKeyId: string; secretAccessKey: string }) {
    console.log("[MEDIA DEBUG] R2 S3 configuration", {
      endpoint: JSON.stringify(configuration.endpoint),
      region: JSON.stringify(configuration.region),
      bucket: JSON.stringify(bucket),
      forcePathStyle: false,
    });
    this.client = new S3Client({ endpoint: configuration.endpoint, region: configuration.region, forcePathStyle: false, credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
  }
  async put(objectKey: string, body: Buffer, contentType: string) {
    await this.client.send(new PutObjectCommand({ Bucket: this.bucket, Key: objectKey, Body: body, ContentType: contentType }));
    return { provider: "s3", fileId: objectKey, mimeType: contentType, size: body.length };
  }
  async get(objectKey: string) {
    const response = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey }));
    if (!response.Body) throw new Error("Stored media body is unavailable");
    return { body: Buffer.from(await response.Body.transformToByteArray()), contentType: response.ContentType };
  }
  async health() {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
      return { provider: "s3", enabled: true, folderAccessible: true };
    } catch (error) {
      return { provider: "s3", enabled: true, folderAccessible: false, reason: error instanceof Error ? error.message.slice(0, 240) : "S3 bucket health check failed" };
    }
  }
}

export class GoogleDriveMediaStorage implements MediaStorage {
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private readonly clientId: string, private readonly clientSecret: string, private readonly refreshToken: string, private readonly folderId: string) {}
  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "refresh_token", client_id: this.clientId, client_secret: this.clientSecret, refresh_token: this.refreshToken }) });
    if (!response.ok) {
      const detail = await safeGoogleError(response);
      throw new Error(`Google Drive authentication failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    const body = await response.json() as { access_token?: string; expires_in?: number };
    if (!body.access_token) throw new Error("Google Drive authentication returned no access token");
    this.token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
    return body.access_token;
  }
  async put(objectKey: string, body: Buffer, contentType: string) {
    const token = await this.accessToken();
    const boundary = `media-${Date.now()}`;
    const metadata = JSON.stringify({ name: objectKey, parents: [this.folderId] });
    const multipart = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${contentType}\r\n\r\n`), body, Buffer.from(`\r\n--${boundary}--`)]);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,mimeType,size", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body: multipart });
    if (!response.ok) {
      const detail = await safeGoogleError(response);
      console.warn(`[MediaStorage] Google Drive upload failed (${response.status})${detail ? `: ${detail}` : ""}`);
      throw new Error(`Google Drive upload failed (${response.status})${detail ? `: ${detail}` : ""}`);
    }
    const file = await response.json() as { id?: string; mimeType?: string; size?: string };
    if (!file.id) throw new Error("Google Drive upload returned no file ID");
    return { provider: "google-drive", fileId: file.id, mimeType: file.mimeType ?? contentType, size: Number(file.size ?? body.length) };
  }
  async get(fileId: string) {
    const token = await this.accessToken();
    const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers: { authorization: `Bearer ${token}` } });
    if (!response.ok) throw new Error(`Google Drive download failed (${response.status})`);
    return { body: Buffer.from(await response.arrayBuffer()), contentType: response.headers.get("content-type") ?? undefined };
  }
  async health() {
    try {
      const token = await this.accessToken();
      const response = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(this.folderId)}?fields=id,mimeType`, { headers: { authorization: `Bearer ${token}` } });
      if (!response.ok) {
        const apiError = await safeGoogleError(response);
        const reason = `Google Drive folder check failed (${response.status})${apiError ? `: ${apiError}` : ""}`;
        console.warn(`[MediaStorage] ${reason}`);
        return { provider: "google_drive", enabled: true, folderAccessible: false, reason };
      }
      const file = await response.json() as { id?: string; mimeType?: string };
      if (file.id !== this.folderId || file.mimeType !== "application/vnd.google-apps.folder") return { provider: "google_drive", enabled: true, folderAccessible: false, reason: "Configured Drive ID is not an accessible folder" };
      return { provider: "google_drive", enabled: true, folderAccessible: true };
    } catch (error) { return { provider: "google_drive", enabled: true, folderAccessible: false, reason: error instanceof Error ? error.message : "Google Drive health check failed" }; }
  }
  async writeTest() {
    const token = await this.accessToken();
    const boundary = `storage-test-${Date.now()}`;
    const metadata = JSON.stringify({ name: "storage-test.txt", parents: [this.folderId] });
    const body = Buffer.concat([Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\nstorage test\r\n--${boundary}--`)]);
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body });
    const detail = response.ok ? undefined : await safeGoogleErrorDetails(response);
    if (response.ok) {
      const file = await response.json() as { id?: string };
      if (file.id) await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(file.id)}?supportsAllDrives=true`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } });
    }
    return { status: response.status, ...detail };
  }
}

async function safeGoogleError(response: Response) {
  const detail = await safeGoogleErrorDetails(response);
  return detail ? [detail.reason, detail.message].filter(Boolean).join(": ") : undefined;
}

async function safeGoogleErrorDetails(response: Response) {
  try {
    const body = await response.json() as { error?: { message?: string }; error_description?: string };
    const reasons = Array.isArray((body.error as { errors?: Array<{ reason?: string }> } | undefined)?.errors) ? (body.error as { errors: Array<{ reason?: string }> }).errors.map(({ reason }) => reason).filter(Boolean).join(",") : "";
    const message = (body.error?.message ?? body.error_description ?? "").slice(0, 240).replace(/[\r\n]+/g, " ");
    return { ...(reasons ? { reason: reasons } : {}), ...(message ? { message } : {}) };
  } catch { return undefined; }
}

@Injectable()
export class MediaStorageService implements MediaStorage {
  private readonly storage?: MediaStorage;
  constructor() {
    console.log("[MEDIA DEBUG] Instance identity", { hostname: hostname(), pid: process.pid });
    console.log("[MEDIA DEBUG] Runtime environment:", {
      MEDIA_STORAGE_ENABLED: process.env.MEDIA_STORAGE_ENABLED,
      MEDIA_STORAGE_DRIVER: process.env.MEDIA_STORAGE_DRIVER,
      GOOGLE_DRIVE_ENABLED: process.env.GOOGLE_DRIVE_ENABLED,
      NODE_ENV: process.env.NODE_ENV,
    });
    if (!readMediaStorageEnabled()) {
      console.log("[MEDIA DEBUG] Storage disabled because readMediaStorageEnabled returned false");
      return;
    }
    const driver = (process.env.GOOGLE_DRIVE_ENABLED?.trim().toLowerCase() === "true" ? "google-drive" : process.env.MEDIA_STORAGE_DRIVER ?? "local").trim().toLowerCase();
    if (driver === "local") {
      this.storage = new LocalMediaStorage(process.env.MEDIA_LOCAL_DIRECTORY?.trim() || resolve(process.cwd(), ".media"));
      return;
    }
    if (driver === "google-drive") {
      const required = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN", "GOOGLE_DRIVE_FOLDER_ID"] as const;
      const missing = required.filter((key) => !process.env[key]?.trim());
      if (missing.length) throw new Error(`Missing Google Drive storage variables: ${missing.join(", ")}`);
      this.storage = new GoogleDriveMediaStorage(process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, process.env.GOOGLE_REFRESH_TOKEN!, process.env.GOOGLE_DRIVE_FOLDER_ID!);
      return;
    }
    if (driver !== "s3") throw new Error("MEDIA_STORAGE_DRIVER must be local, s3, or google-drive");
    const clean = (val?: string) => val?.trim().replace(/^["']|["']$/g, "") || undefined;
    const bucket = clean(process.env.S3_BUCKET);
    const endpoint = clean(process.env.S3_ENDPOINT);
    const region = clean(process.env.S3_REGION);
    const accessKeyId = clean(process.env.S3_ACCESS_KEY_ID);
    const secretAccessKey = clean(process.env.S3_SECRET_ACCESS_KEY);

    if (!bucket || !region || !accessKeyId || !secretAccessKey) {
      throw new Error("Missing S3 media storage variables: S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY");
    }

    console.log("[MEDIA DEBUG] Initializing S3 storage", {
      bucket,
      endpoint,
      region,
    });
    this.storage = new S3MediaStorage(bucket, {
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
    });
  }
  put(objectKey: string, body: Buffer, contentType: string) { if (!this.storage) return Promise.reject(new Error("Media storage is disabled")); return this.storage.put(objectKey, body, contentType); }
  get(fileId: string) { if (!this.storage) return Promise.reject(new Error("Media storage is disabled")); return this.storage.get(fileId); }
  health() { return this.storage?.health ? this.storage.health() : Promise.resolve({ provider: "disabled", enabled: false, folderAccessible: false }); }
  writeTest() { return this.storage?.writeTest ? this.storage.writeTest() : Promise.resolve({ status: 0, message: "Media storage is disabled" }); }
  diagnostics() {
    return {
      hostname: hostname(),
      pid: process.pid,
      MEDIA_STORAGE_ENABLED: process.env.MEDIA_STORAGE_ENABLED,
      MEDIA_STORAGE_DRIVER: process.env.MEDIA_STORAGE_DRIVER,
      driverExists: Boolean(this.storage),
    };
  }
}
