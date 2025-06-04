/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["mysql2"],
  env: {
    // Exponer explícitamente CLAUDE_API_KEY a la aplicación
    CLAUDE_API_KEY: process.env.CLAUDE_API_KEY,
  },
  // ... otras configuraciones existentes
}

module.exports = nextConfig 