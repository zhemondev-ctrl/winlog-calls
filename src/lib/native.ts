import { Capacitor, registerPlugin } from "@capacitor/core";

import type { NativeSimCall, NativeWhatsAppCall } from "@/lib/calls";

export interface NativeStatus {
  callLog: boolean;
  notificationAccess: boolean;
  batteryUnrestricted: boolean;
  deviceId: string;
  deviceName: string;
  appVersion: string | null;
}

export interface BackgroundUploadStatus {
  enabled: boolean;
  userId: string | null;
  lastRunAt: number | null;
  lastSuccessAt: number | null;
  lastCount: number;
  lastError: string | null;
}

interface WinLogNativePlugin {
  getStatus(): Promise<NativeStatus>;
  requestCallLogPermission(): Promise<NativeStatus>;
  openNotificationAccessSettings(): Promise<void>;
  openBatterySettings(): Promise<void>;
  getCalls(options: { since: number; limit?: number }): Promise<{ calls: NativeSimCall[] }>;
  getWhatsAppCalls(options: { since: number }): Promise<{ calls: NativeWhatsAppCall[] }>;
  // Background uploads (added in app version with the Winstone icon; older APKs reject these calls).
  enableBackgroundUpload(options: {
    endpoint: string;
    token: string;
    userId: string;
    deviceName: string | null;
  }): Promise<BackgroundUploadStatus>;
  disableBackgroundUpload(): Promise<BackgroundUploadStatus>;
  getBackgroundUploadStatus(): Promise<BackgroundUploadStatus>;
}

// Implemented in android/app/src/main/java/com/winlog/app/WinLogNativePlugin.java
export const WinLogNative = registerPlugin<WinLogNativePlugin>("WinLogNative");

/** True only inside the installed Android app (not in a normal browser). */
export function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}
