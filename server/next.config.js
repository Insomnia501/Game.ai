/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 禁用静态优化以支持服务器端数据获取
  experimental: {
    // 如需要可以启用某些实验性特性
  },
}

module.exports = nextConfig
