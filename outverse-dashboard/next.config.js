/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async redirects() {
    return [
      {
        source: '/favicon.ico',
        destination: '/vercel.svg',
        permanent: false,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/media/**' },
    ],
  },
}

module.exports = nextConfig 