import { createClient } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import type { GenericCtx } from "@convex-dev/better-auth/utils";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import authConfig from "../auth.config";
import schema from "./schema";

function getServerEnv(
  name: string,
  value: string | undefined,
  opts?: { required?: boolean; fallback?: string },
): string {
  const normalized = value?.trim();
  if (normalized) return normalized;

  if (opts?.fallback) return opts.fallback;

  if (opts?.required) {
    throw new Error(`Missing required env var ${name}`);
  }

  return "";
}

// Better Auth Component
export const authComponent = createClient<DataModel, typeof schema>(
  components.betterAuth,
  {
    local: { schema },
    verbose: false,
  },
);

// Better Auth Options
export const createAuthOptions = (
  ctx: GenericCtx<DataModel>,
  opts?: { strictEnv?: boolean },
) => {
  const strictEnv = opts?.strictEnv ?? false;
  const baseURL = getServerEnv("SITE_URL", process.env.SITE_URL, {
    required: strictEnv,
    fallback: "http://localhost:3000",
  });
  const secret = getServerEnv("BETTER_AUTH_SECRET", process.env.BETTER_AUTH_SECRET, {
    required: strictEnv,
    fallback: "dev-only-placeholder-secret",
  });

  return {
    appName: "A&R Finder",
    baseURL,
    secret,
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    plugins: [convex({ authConfig })],
  } satisfies BetterAuthOptions;
};

// For `@better-auth/cli`
export const options = createAuthOptions({} as GenericCtx<DataModel>);

// Better Auth Instance
export const createAuth = (ctx: GenericCtx<DataModel>) => {
  return betterAuth(createAuthOptions(ctx, { strictEnv: true }));
};
