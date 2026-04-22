import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Keep these packages as native Node.js requires so the standalone
  // output tracer copies them correctly (they use dynamic requires that
  // the bundler can't statically trace).
  serverExternalPackages: ['nodemailer', 'better-sqlite3'],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
