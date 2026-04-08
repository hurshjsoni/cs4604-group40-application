import { convexClient } from "@convex-dev/better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() ||
  process.env.NEXT_PUBLIC_SITE_URL?.trim();

export const authClient = createAuthClient({
  ...(appUrl ? { baseURL: appUrl } : {}),
  plugins: [convexClient()],
});
