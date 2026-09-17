import type { NextConfig } from "next";

/**
 * Sticky has no server: every account, client list and sticky lives in the
 * browser as YAML. Building a static export keeps it that way and lets the
 * whole app be hosted as plain files.
 */
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
