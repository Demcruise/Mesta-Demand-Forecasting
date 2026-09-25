import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Section roots without a page of their own go to their first page.
  async redirects() {
    return [
      { source: "/forecasting", destination: "/forecasting/runs", permanent: false },
      { source: "/forecasting/detail", destination: "/forecasting/explorer", permanent: false },
      { source: "/demand-data", destination: "/demand-data/products", permanent: false },
      { source: "/administration", destination: "/administration/audit", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
