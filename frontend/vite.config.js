import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        host: true, // Esto permite conexiones desde tu IP local
        proxy: {
            '/api': {
                target: process.env.BACKEND_URL || 'http://localhost:3000',
                changeOrigin: true
            }
        }
    }
})
