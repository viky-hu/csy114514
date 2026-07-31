import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["ui-components"],
  experimental: {
    proxyClientMaxBodySize: 50 * 1024 * 1024
  },
  turbopack: {
    root: path.resolve(path.join(__dirname, "..", ".."))
  }
};

export default nextConfig;
