import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    settings: {
      next: {
        rootDir: "frontend",
      },
    },
    rules: {
      // We store many user-uploaded / external URLs where Next/Image optimization is not guaranteed.
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    "frontend/.next/**",
    ".next/**",
    "out/**",
    "build/**",
    "frontend/next-env.d.ts",
    "next-env.d.ts",
    "convex/_generated/**",
    "convex/betterAuth/_generated/**",
    "convex/seed.ts",
    "convex/seedMore.ts",
  ]),
]);

export default eslintConfig;
