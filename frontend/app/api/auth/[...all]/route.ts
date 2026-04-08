export const dynamic = "force-dynamic";

type Handler = { GET: (r: Request) => Promise<Response>; POST: (r: Request) => Promise<Response> };
let _handler: Handler | null = null;

function requireEnv(name: string, value: string | undefined): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`Missing required env var ${name}`);
  }
  return normalized;
}

async function getHandler(): Promise<Handler> {
  if (!_handler) {
    const { convexBetterAuthNextJs } = await import("@convex-dev/better-auth/nextjs");
    const convexUrl = requireEnv("NEXT_PUBLIC_CONVEX_URL", process.env.NEXT_PUBLIC_CONVEX_URL);
    const convexSiteUrl = requireEnv(
      "CONVEX_SITE_URL (or NEXT_PUBLIC_CONVEX_SITE_URL)",
      process.env.CONVEX_SITE_URL || process.env.NEXT_PUBLIC_CONVEX_SITE_URL,
    );

    const helpers = convexBetterAuthNextJs({
      convexUrl,
      // Prefer server-side runtime var over build-time NEXT_PUBLIC value.
      convexSiteUrl,
    });
    _handler = helpers.handler as unknown as Handler;
  }
  return _handler!;
}

export async function GET(req: Request) {
  const h = await getHandler();
  return h.GET(req);
}

export async function POST(req: Request) {
  const h = await getHandler();
  return h.POST(req);
}
