import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Exclude large unused assets from dist/ ──────────────────────────
// These files exist in /public/ for Electron dev but must NOT land in the
// web build — they inflate Firebase CDN bandwidth with files never loaded.
const EXCLUDE_FROM_BUILD = [
  /models[\/\\]Grops Bikes1\.glb$/i,
  /models[\/\\]Grops_Bikes1_draco\.glb$/i,
  /models[\/\\]Bike_draco\.glb$/i,
  /models[\/\\]Bike[\/\\]/i,         // entire Bike/ duplicate folder
  /mapper\.html$/i,
]

function excludeAssetsPlugin() {
  return {
    name: 'exclude-large-assets',
    // Intercept every public-asset copy during build
    generateBundle(_options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (EXCLUDE_FROM_BUILD.some(re => re.test(name))) {
          delete bundle[name]
        }
      }
    },
  }
}

export default defineConfig(({ command }) => ({
  plugins: [react(), excludeAssetsPlugin()],
  // Use './' only for production Electron builds (assets must be relative to index.html).
  // In the dev server, always use '/' — relative base causes React to load from
  // different module URLs, creating duplicate React instances and breaking hooks.
  base: command === 'build' ? './' : '/',
  resolve: {
    dedupe: ['react', 'react-dom', 'three', 'gsap'],
    alias: {
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      'three': path.resolve(__dirname, 'node_modules/three'),
      'gsap': path.resolve(__dirname, 'node_modules/gsap'),
      '@gsap/react': path.resolve(__dirname, 'node_modules/@gsap/react'),
    },
  },
  build: {
    outDir: 'dist',
    assetsInlineLimit: 0,  // never inline models/textures
    rollupOptions: {
      output: {
        // Split vendor libs into separate cached chunks.
        // Rolldown (Vite 8) requires manualChunks as a function.
        manualChunks(id) {
          if (id.includes('node_modules/three/'))            return 'three-vendor'
          if (id.includes('@react-three/fiber') ||
              id.includes('@react-three/drei'))              return 'r3f-vendor'
          if (id.includes('node_modules/gsap') ||
              id.includes('@gsap/react'))                    return 'gsap-vendor'
          if (id.includes('node_modules/zustand/'))          return 'zustand'
          if (id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-router'))      return 'react-vendor'
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react-router-dom', '@react-three/fiber', '@react-three/drei'],
    exclude: ['three', 'gsap'] // Force these to resolve via alias/dedupe only
  },
  server: {
    port: 5173,
    strictPort: true, // Prevents port mismatch by failing if 5173 is taken
    headers: {
      // Cache GLBs and other static assets for 7 days in dev
      'Cache-Control': 'public, max-age=604800',
    },
    hmr: {
      // Explicitly bind HMR WebSocket to localhost so browser can always connect
      host: 'localhost',
      port: 5173,
    },
  },
}))
