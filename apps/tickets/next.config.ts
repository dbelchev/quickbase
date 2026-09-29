import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ticketsServer = "http://127.0.0.1:3001";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  ),
  async rewrites() {
    return [
      { source: "/api/chat", destination: `${ticketsServer}/api/chat` },
      {
        source: "/api/decisions",
        destination: `${ticketsServer}/api/decisions`,
      },
    ];
  },
};

export default nextConfig;
