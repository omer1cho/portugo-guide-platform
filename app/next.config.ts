import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // דפי הטיפים בברקוד - כתובות נקיות וקבועות (עליהן מודפסים הברקודים)
      { source: "/tips/lisbon", destination: "/tips/lisbon.html" },
      { source: "/tips/porto", destination: "/tips/porto.html" },
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
