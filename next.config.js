/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Prototip: tüm sayfalarda arama motoru taraması/indekslemesi kapalı
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
