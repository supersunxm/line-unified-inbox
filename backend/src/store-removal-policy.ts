export function isPermanentDeleteConfirmed(storeName: string, confirmation?: string) {
  return confirmation === `DELETE ${storeName}`;
}
