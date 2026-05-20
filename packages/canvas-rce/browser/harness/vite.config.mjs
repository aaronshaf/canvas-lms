import react from '@vitejs/plugin-react'
import {defineConfig} from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4444,
  },
  // canvas-rce compiled output references process.env.NODE_ENV and ENV at runtime
  define: {
    'process.env.NODE_ENV': JSON.stringify('development'),
    ENV: JSON.stringify({}),
  },
  // canvas-rce uses CommonJS internals; help vite handle them
  optimizeDeps: {
    include: ['@instructure/canvas-rce'],
  },
})
