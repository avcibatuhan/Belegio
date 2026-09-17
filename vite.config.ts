import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ command }) => ({
  plugins: [react()],
  server: { port: 5173 },
  resolve: {
    // The developer inspector is a debugging aid: replace it with an empty stub
    // in production builds so its code never ships to users.
    alias:
      command === 'build'
        ? [{ find: /.*\/components\/DevInspector$/, replacement: '/src/components/DevInspector.stub.ts' }]
        : [],
  },
}))
