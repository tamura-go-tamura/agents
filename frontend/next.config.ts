import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for containerization
  output: 'standalone',
  
  // API rewrites for backend integration
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
    
    return [
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${apiUrl}/ws/:path*`,
      },
      {
        source: '/health',
        destination: `${apiUrl}/health`,
      },
    ];
  },
  
  // Environment variables
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  
  // Image optimization for Cloud Run
  images: {
    domains: ['localhost'],
    unoptimized: true,
  },
  
  // External packages for server components
  serverExternalPackages: ['@google-cloud/aiplatform'],
};

export default nextConfig;
