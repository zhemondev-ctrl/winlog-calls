import { createFileRoute } from "@tanstack/react-router";

import { handleDeviceUpload } from "@/lib/device-upload.server";

// Called by the Android app in the background (app closed). Authenticated by the phone's upload key.
export const Route = createFileRoute("/api/public/device-upload")({
  server: { handlers: { POST: ({ request }) => handleDeviceUpload(request) } },
});
