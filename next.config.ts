import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // تعیین صریح ریشه پروژه تا Turbopack دایرکتوری home کاربر را اسکن نکند.
  turbopack: {
    root: path.resolve(__dirname, "."),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.bama.ir",
      },
      {
        protocol: "https",
        hostname: "images.bama.ir",
      },
    ],
  },
  // برای سازگاری با Netlify
  output: "standalone",
};

export default nextConfig;
