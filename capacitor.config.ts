import type { CapacitorConfig } from "@capacitor/cli";

// The APK loads the live WinLog website, so web updates reach every phone without reinstalling.
// CI can point a build at another address with CAP_SERVER_URL.
const serverUrl = process.env.CAP_SERVER_URL || "https://winlog-calls.lovable.app";

const config: CapacitorConfig = {
  appId: "com.winlog.app",
  appName: "WinLog",
  webDir: "android-shell",
  server: {
    url: serverUrl,
    cleartext: false,
    errorPath: "index.html",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
