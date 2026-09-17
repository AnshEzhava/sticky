import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * Node asks for the exact file, so the extensionless relative imports that
 * Next and TypeScript both accept need resolving to a .ts source here.
 */
export async function resolve(specifier, context, next) {
  if (specifier.startsWith(".") && !/\.[cm]?[jt]sx?$/.test(specifier)) {
    const base = new URL(specifier, context.parentURL);
    for (const extension of [".ts", ".tsx", ".mts", "/index.ts"]) {
      try {
        const candidate = new URL(base.href + extension);
        if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
      } catch {
        /* keep looking */
      }
    }
  }
  return next(specifier, context);
}
