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
      {
        // تصاویر منتشرشده از Supabase Storage (برای Next/Image)
        protocol: "https",
        hostname: "jcycygforwzryomjeyki.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
      },
    ],
  },
  // برای Netlify با @netlify/plugin-nextjs نیازی به output: "standalone" نیست
  // (خودش build را برای Netlify Functions آماده می‌کند).
};

export default nextConfig;
