import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // דפי הטיפים נמשכים ע"י שירותי תצוגה מקדימה (ווטסאפ ווב וכו') מדפדפן -
    // בלי CORS פתוח הם לא מצליחים לקרוא את תגיות ה-OG ומציגים קישור עירום
    const cors = [{ key: "Access-Control-Allow-Origin", value: "*" }];
    return [
      { source: "/tips/:path*", headers: cors },
      { source: "/lisbon", headers: cors },
      { source: "/porto", headers: cors },
      { source: "/tips-hero-founders.jpg", headers: cors },
    ];
  },
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
