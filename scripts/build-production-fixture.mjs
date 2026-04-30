process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'production';
process.env.VITE_USE_BACKEND = 'true';
process.env.VITE_API_BASE_URL = 'https://api.projtrack.codes';
process.env.VITE_PUBLIC_APP_URL = 'https://www.projtrack.codes';

const { build } = require('vite');
const { fileURLToPath } = require('url');
const { dirname, join } = require('path');
const { createRequire } = require('module');

const require = createRequire(import.meta.url);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  await build({
    root: join(__dirname, '../'),
    configFile: join(__dirname, '../vite.config.ts'),
    mode: 'production-fixture',
    resolve: {
      alias: {
        '@tailwindcss/vite': require.resolve('@tailwindcss/vite'),
        'vite': require.resolve('vite'),
      },
    },
  });

  console.log('Build completed for production fixture.');
}

run();
