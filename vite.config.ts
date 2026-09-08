import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['daystate.svg'],
      manifest: {
        name: '日况 Daystate',
        short_name: '日况',
        description: '每天 30 秒，记录真实状态。',
        lang: 'zh-CN',
        theme_color: '#176b5b',
        background_color: '#f7f4ed',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/daystate.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/daystate.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
