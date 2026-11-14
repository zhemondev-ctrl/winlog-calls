export const PHONE_CODE_TTL_MS = 24 * 60 * 60 * 1000;

export function canEnrollStaff(isManager: boolean, exists: boolean) {
  return exists && !isManager;
}

export function normalizePhoneCode(value: string) {
  return value.trim().replace(/[\s-]/g, "").toUpperCase();
}