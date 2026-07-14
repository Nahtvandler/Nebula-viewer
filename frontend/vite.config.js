import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Прокси /api -> backend в dev-режиме. В проде проксирует nginx.
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: process.env.VITE_API_TARGET || 'http://localhost:8000',
                changeOrigin: true,
            },
        },
    },
});
