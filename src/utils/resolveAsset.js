/**
 * resolveAsset(path)
 *
 * Returns the correct URL for a public asset depending on the runtime context:
 *
 *  • Web browser  (http/https)  → absolute path, e.g. /models/foo.glb
 *  • Electron dev (http)        → absolute path, same as web
 *  • Electron prod (file://)    → relative path with '.', e.g. ./models/foo.glb
 *
 * Usage:
 *   import { resolveAsset } from '../utils/resolveAsset.js'
 *   useGLTF(resolveAsset('/models/Grops Bikes1.glb'))
 */
export function resolveAsset(absolutePath) {
  // In Electron production the page is loaded from file:// — absolute paths
  // like /models/... don't resolve. We strip the leading slash and use './' instead.
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    // Remove leading slash and prefix with './'
    return '.' + absolutePath
  }
  // For all http/https contexts (browser dev, web deployment, Electron dev server)
  // absolute paths work fine.
  return absolutePath
}
