import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
    base: '/course/',
    plugins: [
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: {
                enabled: false // 開發模式不啟用 SW，避免快取干擾 HMR
            },
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
            workbox: {
                // 允許快取較大的 chunk (exceljs/firebase 拆分後仍可能 >2MB)
                maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB
                // 只快取 http/https 請求，排除 chrome-extension:// 等非標準協定
                navigateFallback: '/course/index.html',
                navigateFallbackDenylist: [/^\/api/],
                runtimeCaching: [
                    {
                        urlPattern: /^https?:\/\/.*/,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: 'smes-runtime-cache',
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 天
                            }
                        }
                    }
                ]
            },
            manifest: {
                name: 'SMES AI 智慧排課系統',
                short_name: 'SMES 排課',
                description: '石門國小 AI 智慧排課系統',
                theme_color: '#6366f1',
                background_color: '#f8fafc',
                display: 'standalone',
                orientation: 'portrait',
                icons: [
                    {
                        src: 'pwa-192x192.png',
                        sizes: '192x192',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png'
                    },
                    {
                        src: 'pwa-512x512.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ]
            }
        })
    ],
    server: {
        port: 3000,
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    // 將大型套件拆分為獨立 chunk，避免主 bundle 超過 2MB
                    exceljs: ['exceljs'],
                    firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/storage']
                }
            }
        }
    }
})
