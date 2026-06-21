import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.17",
    "192.168.0.17:3000",
  ],
};

export default nextConfig;