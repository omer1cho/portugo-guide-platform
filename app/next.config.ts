import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // דפי הטיפים בברקוד - כתובות נקיות וקבועות (עליהן מודפסים הברקודים)
      { source: "/tips/lisbon", destination: "/tips/lisbon.html" },
      { source: "/tips/porto", destination: "/tips/porto.html" },
      // בדומיין הייעודי portugo-tips.vercel.app הכתובת מתקצרת ל-/lisbon ו-/porto
      {
        source: "/lisbon",
        destination: "/tips/lisbon.html",
        has: [{ type: "host", value: "portugo-tips.vercel.app" }],
      },
      {
        source: "/porto",
        destination: "/tips/porto.html",
        has: [{ type: "host", value: "portugo-tips.vercel.app" }],
      },
    ];
  },
  async redirects() {
    return [
      // כתובות הדמו הישנות מפנות לכתובות הסופיות
      { source: "/tips-mockup-lisbon.html", destination: "/tips/lisbon", permanent: false },
      { source: "/tips-mockup-porto.html", destination: "/tips/porto", permanent: false },
    ];
  },
};

export default nextConfig;
