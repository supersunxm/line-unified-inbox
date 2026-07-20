export function readMediaStorageEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  const value = environment.MEDIA_STORAGE_ENABLED?.trim().toLowerCase();
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  throw new Error("MEDIA_STORAGE_ENABLED must be true or false");
}
