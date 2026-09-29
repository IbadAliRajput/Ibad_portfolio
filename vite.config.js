import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // the raw ad masters (several GB) live beside the app — never watch them
    watch: { ignored: ['**/media-inbox/**'] },
  },
})
