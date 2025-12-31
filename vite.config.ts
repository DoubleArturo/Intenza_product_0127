
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Define __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // 增加 Chunk 大小警示限制到 1000kb (雖然我們已經做了拆分)
        chunkSizeWarningLimit: 1000,
        rollupOptions: {
          output: {
            // 將大型依賴拆分為獨立的 Chunk
            manualChunks: {
              'vendor-react': ['react', 'react-dom', 'react-router-dom'],
              'vendor-ui': ['lucide-react'],
              'vendor-charts': ['recharts'],
              'vendor-utils': ['xlsx'],
              'vendor-ai': ['@google/genai']
            }
          }
        }
      }
    };
});
