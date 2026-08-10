import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { createSign } from "node:crypto";
import { readMediaStorageEnabled } from "./media-storage.config";

export type StoredMedia = { body: Buffer; contentType?: string };
export type StoredMediaReference = { provider: string; fileId: string; mimeType: string; size: number };
export type MediaStorageHealth = { provider: string; enabled: boolean; folderAccessible: boolean; reason?: string };

export interface MediaStorage {
  put(objectKey: string, body: Buffer, contentType: string): Promise<StoredMediaReference>;
  get(fileId: string): Promise<StoredMedia>;
  health?(): Promise<MediaStorageHealth>;
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
    this.client = new S3Client({ endpoint: configuration.endpoint, region: configuration.region, forcePathStyle: Boolean(configuration.endpoint), credentials: { accessKeyId: configuration.accessKeyId, secretAccessKey: configuration.secretAccessKey } });
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
}

export class GoogleDriveMediaStorage implements MediaStorage {
  private token: { value: string; expiresAt: number } | null = null;
  constructor(private readonly clientEmail: string, private readonly privateKey: string, private readonly folderId: string) {}
  private async accessToken() {
    if (this.token && this.token.expiresAt > Date.now() + 60_000) return this.token.value;
    const enc = (value: string) => Buffer.from(value).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const header = enc(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payload = enc(JSON.stringify({ iss: this.clientEmail, scope: "https://www.googleapis.com/auth/drive.file", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
    const signer = createSign("RSA-SHA256"); signer.update(`${header}.${payload}`); signer.end();
    const assertion = `${header}.${payload}.${signer.sign(this.privateKey, "base64url")}`;
    const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }) });
    if (!response.ok) throw new Error(`Google Drive authentication failed (${response.status})`);
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
    const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,mimeType,size", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": `multipart/related; boundary=${boundary}` }, body: multipart });
    if (!response.ok) throw new Error(`Google Drive upload failed (${response.status})`);
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
      if (!response.ok) return { provider: "google_drive", enabled: true, folderAccessible: false, reason: `Google Drive folder check failed (${response.status})` };
      const file = await response.json() as { id?: string; mimeType?: string };
      if (file.id !== this.folderId || file.mimeType !== "application/vnd.google-apps.folder") return { provider: "google_drive", enabled: true, folderAccessible: false, reason: "Configured Drive ID is not an accessible folder" };
      return { provider: "google_drive", enabled: true, folderAccessible: true };
    } catch (error) { return { provider: "google_drive", enabled: true, folderAccessible: false, reason: error instanceof Error ? error.message : "Google Drive health check failed" }; }
  }
}

@Injectable()
export class MediaStorageService implements MediaStorage {
  private readonly storage?: MediaStorage;
  constructor() {
    if (!readMediaStorageEnabled()) return;
    const driver = (process.env.GOOGLE_DRIVE_ENABLED?.trim().toLowerCase() === "true" ? "google-drive" : process.env.MEDIA_STORAGE_DRIVER ?? "local").trim().toLowerCase();
    if (driver === "local") {
      this.storage = new LocalMediaStorage(process.env.MEDIA_LOCAL_DIRECTORY?.trim() || resolve(process.cwd(), ".media"));
      return;
    }
    if (driver === "google-drive") {
      const required = ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GOOGLE_PRIVATE_KEY", "GOOGLE_DRIVE_FOLDER_ID"] as const;
      const missing = required.filter((key) => !process.env[key]?.trim());
      if (missing.length) throw new Error(`Missing Google Drive storage variables: ${missing.join(", ")}`);
      this.storage = new GoogleDriveMediaStorage(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"), process.env.GOOGLE_DRIVE_FOLDER_ID!);
      return;
    }
    if (driver !== "s3") throw new Error("MEDIA_STORAGE_DRIVER must be local, s3, or google-drive");
    const required = ["S3_REGION", "S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY"] as const;
    const missing = required.filter((key) => !process.env[key]?.trim());
    if (missing.length) throw new Error(`Missing S3 media storage variables: ${missing.join(", ")}`);
    this.storage = new S3MediaStorage(process.env.S3_BUCKET!, { endpoint: process.env.S3_ENDPOINT?.trim() || undefined, region: process.env.S3_REGION!, accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! });
  }
  put(objectKey: string, body: Buffer, contentType: string) { if (!this.storage) return Promise.reject(new Error("Media storage is disabled")); return this.storage.put(objectKey, body, contentType); }
  get(fileId: string) { if (!this.storage) return Promise.reject(new Error("Media storage is disabled")); return this.storage.get(fileId); }
  health() { return this.storage?.health ? this.storage.health() : Promise.resolve({ provider: "disabled", enabled: false, folderAccessible: false }); }
}
