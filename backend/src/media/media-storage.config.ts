export function readMediaStorageEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  if (environment.GOOGLE_DRIVE_ENABLED?.trim().toLowerCase() === "true") return true;
  const value = environment.MEDIA_STORAGE_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("MEDIA_STORAGE_ENABLED must be true or false");
}
