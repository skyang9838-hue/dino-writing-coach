import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // This worktree lives nested inside the main repo checkout, which also has
  // its own package-lock.json; pin the root so Turbopack doesn't get confused.
  turbopack: {
    root: __dirname,
  },
}

export default nextConfig
