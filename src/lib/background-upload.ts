import { registerDeviceKey, revokeDeviceKey } from "@/lib/device-keys.functions";
import { isAndroidApp, WinLogNative, type BackgroundUploadStatus } from "@/lib/native";

/**
 * Makes sure this phone keeps uploading calls while WinLog is closed. Registers a per-phone upload
 * key the first time (or after a different person signs in). Returns null on browsers and on older
 * APKs that don't have background uploads yet.
 */
export async function ensureBackgroundUpload(
  userId: string,
): Promise<BackgroundUploadStatus | null> {
  if (!isAndroidApp()) return null;
  let current: BackgroundUploadStatus;
  try {
    current = await WinLogNative.getBackgroundUploadStatus();
  } catch {
    return null; // Older app version without background uploads.
  }
  if (current.enabled && current.userId === userId) return current;

  const status = await WinLogNative.getStatus();
  const { token } = await registerDeviceKey({
    data: { deviceId: status.deviceId, deviceName: status.deviceName || null },
  });
  return WinLogNative.enableBackgroundUpload({
    endpoint: `${window.location.origin}/api/public/device-upload`,
    token,
    userId,
    deviceName: status.deviceName || null,
  });
}

export async function getBackgroundUploadStatus(): Promise<BackgroundUploadStatus | null> {
  if (!isAndroidApp()) return null;
  try {
    return await WinLogNative.getBackgroundUploadStatus();
  } catch {
    return null;
  }
}

/** On sign-out: stop this phone's background uploads and forget its key. */
export async function stopBackgroundUpload(): Promise<void> {
  if (!isAndroidApp()) return;
  try {
    const status = await WinLogNative.getStatus();
    await WinLogNative.disableBackgroundUpload();
    await revokeDeviceKey({ data: { deviceId: status.deviceId } });
  } catch {
    // Older app version, or already signed out: nothing more to stop.
  }
}
