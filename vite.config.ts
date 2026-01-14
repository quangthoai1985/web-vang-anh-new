import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // Prevent IDM from intercepting .bin files
      {
        name: 'configure-response-headers',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url?.includes('.bin') || req.url?.includes('.wasm')) {
              res.setHeader('Content-Disposition', 'inline');
              res.setHeader('X-Content-Type-Options', 'nosniff');
            }
            next();
          });
        }
      }
    ],
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
      outDir: 'dist_build'
    }
  };
});
