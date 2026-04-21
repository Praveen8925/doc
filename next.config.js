/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Next.js 14: externalize native Node addons so webpack doesn't try to bundle them.
  // This is the correct key for Next.js 14 (experimental.serverComponentsExternalPackages).
  experimental: {
    serverComponentsExternalPackages: [
      'better-sqlite3',
      'word-extractor',
      'mammoth',
      'xlsx',
    ],
  },
}

module.exports = nextConfig
