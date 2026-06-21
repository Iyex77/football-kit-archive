import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.0.14",
    "192.168.0.14:3000",
  ],
};

export default nextConfig;