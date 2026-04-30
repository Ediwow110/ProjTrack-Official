process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'production';
process.env.VITE_USE_BACKEND = 'true';
process.env.VITE_API_BASE_URL = 'https://api.projtrack.codes';
process.env.VITE_PUBLIC_APP_URL = 'https://www.projtrack.codes';

import { build } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function run() {
  await build({
    root: join(__dirname, '../'),
    configFile: join(__dirname, '../vite.config.ts'),
    mode: 'production-fixture'
  });

  console.log('Build completed for production fixture.');
}

run().catch(err => {
  console.error('Build failed:', err);
  process.exit(1);
});
