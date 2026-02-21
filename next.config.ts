import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";
const useStaticExport = process.env.NEXT_OUTPUT_EXPORT === "1";
const internalHost = process.env.TAURI_DEV_HOST || "localhost";

const API_SERVER_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:35821";

const nextConfig: NextConfig = {
  // Workspace root for Turbopack (silence multi-lockfile warning)
  turbopack: { root: __dirname },
  // Disable React Compiler
  reactCompiler: false,
  // Enable static export only when explicitly requested.
  output: useStaticExport ? "export" : undefined,
  // In dev, proxy /api/* to the standalone api-server EXCEPT /api/wallet (handled by Next.js route so Ledger works without api-server)
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      { source: "/api/cex/:path*", destination: `${API_SERVER_URL}/api/cex/:path*` },
      { source: "/api/binance/:path*", destination: `${API_SERVER_URL}/api/binance/:path*` },
      { source: "/api/calendar/:path*", destination: `${API_SERVER_URL}/api/calendar/:path*` },
      { source: "/api/journal/:path*", destination: `${API_SERVER_URL}/api/journal/:path*` },
      { source: "/api/screener/:path*", destination: `${API_SERVER_URL}/api/screener/:path*` },
      { source: "/api/alerts/:path*", destination: `${API_SERVER_URL}/api/alerts/:path*` },
      { source: "/api/transcribe/:path*", destination: `${API_SERVER_URL}/api/transcribe/:path*` },
      { source: "/api/indian-mf/:path*", destination: `${API_SERVER_URL}/api/indian-mf/:path*` },
    ];
  },
  images: {
    unoptimized: true,
  },
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...(config.watchOptions || {}),
        ignored: [
          "**/.git/**",
          "**/node_modules/**",
          "**/src-tauri/target/**",
          "**/release/**",
          "**/release-next/**",
          "**/out/**",
          "**/backend/node_modules/**",
        ],
      };
    }
    return config;
  },
  // Keep dev stable; these import optimizations can stall compilation in large projects.
  experimental: {},
  // Production: strip console.log for smaller bundle and less work at runtime
  ...(isProd && {
    compiler: {
      removeConsole: { exclude: ["error", "warn"] },
    },
  }),
};

export default nextConfig;
