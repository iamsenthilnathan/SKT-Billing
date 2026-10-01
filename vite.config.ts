import { defineConfig, type Plugin } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        try {
          delete require.cache[require.resolve('./server/apiHandler.cjs')];
          const { handleApiRequest } = require('./server/apiHandler.cjs');
          handleApiRequest(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use('/api', (req, res, next) => {
        try {
          delete require.cache[require.resolve('./server/apiHandler.cjs')];
          const { handleApiRequest } = require('./server/apiHandler.cjs');
          handleApiRequest(req, res, next);
        } catch (err) {
          next(err);
        }
      });
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load local environment files (.env, .env.local) and expose backend auth variables to process.env
  const env = loadEnv(mode, process.cwd(), '');
  for (const key of ['APP_USERNAME', 'APP_PASSWORD', 'SESSION_SECRET', 'DATA_DIR']) {
    if (env[key] && !process.env[key]) {
      process.env[key] = env[key];
    }
  }

  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    server: {
      watch: {
        ignored: ['**/data/**', '**/*.db', '**/*.db-*', '**/*.mjs', '**/test_*.mjs'],
      },
    },
    test: {
      globals: true,
      environment: 'node',
    },
  };
})
