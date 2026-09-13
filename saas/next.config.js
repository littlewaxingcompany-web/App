/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The SaaS backend runs on its own port during development. In production
  // it is served behind the team's single public origin (port 3000).
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
};

module.exports = nextConfig;
