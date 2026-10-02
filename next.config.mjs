/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.LEADFLOW_APP_BUILD_DIST_DIR || ".next",
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
