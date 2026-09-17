/**
 * Production stand-in for DevInspector.
 *
 * vite.config.ts aliases the real component to this file when building, so the
 * inspector's markup and diagnostic labels never reach a production bundle.
 * It is never rendered: the call site is guarded by `import.meta.env.DEV`.
 */
export const DevInspector = () => null
