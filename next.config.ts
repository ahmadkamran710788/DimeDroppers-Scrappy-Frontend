import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Required for the `unauthorized()` API used by utils/api-request on 401 responses.
    authInterrupts: true,
  },
};

export default nextConfig;
