/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // node-cron + @node-rs/argon2 use native node APIs and don't survive
  // Webpack bundling. Keeping them external lets the server runtime load
  // them directly (Node only — instrumentation gates the import).
  serverExternalPackages: ["node-cron", "@node-rs/argon2"],
};

export default nextConfig;
