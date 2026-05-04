import type { NextConfig } from "next";
import { realpathSync } from "node:fs";

const projectRoot = realpathSync(process.cwd());

const nextConfig: NextConfig = {
  typedRoutes: false,
  turbopack: {
    root: projectRoot,
  },
};

export default nextConfig;
