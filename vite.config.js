import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), !process.env.VITEST && tailwindcss()].filter(Boolean),
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    css: false,
    exclude: ['**/node_modules/**', '**/dist/**', '**/.claude/**'],
    environmentMatchGlobs: [
      ['src/lib/**', 'node'],
    ],
    // vmThreads uses worker_threads instead of forked processes — starts in
    // milliseconds regardless of DrvFs/WSL filesystem latency.
    pool: 'vmThreads',
    // Reuse one warm worker per environment instead of spawning a fresh one
    // per test file (the previous source of the 60 s startup timeouts).
    isolate: false,
  },
})
