/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Prevent the Hedera SDK and Node built-ins from being bundled client-side
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false, net: false, tls: false, crypto: false,
        path: false, os: false, stream: false, http: false,
        https: false, zlib: false, querystring: false,
      };
      // Completely exclude the Hedera SDK from the client bundle
      config.externals = [
        ...(config.externals || []),
        "@hashgraph/sdk",
        "@hashgraph/proto",
        "@grpc/grpc-js",
      ];
    }
    return config;
  },
  // Next.js 14: Use experimental flag for external packages (server-side only)
  experimental: {
    serverComponentsExternalPackages: [
      "@hashgraph/sdk",
      "@hashgraph/proto",
      "@grpc/grpc-js",
      "crypto",
    ],
  },
};

module.exports = nextConfig;
