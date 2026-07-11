import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["duckdb"],
  experimental: {
    // instrumentationHook: true,
  },
};

export default config;