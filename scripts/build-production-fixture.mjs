process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'production';
process.env.VITE_USE_BACKEND = 'true';
process.env.VITE_API_BASE_URL = 'https://api.projtrack.codes';
process.env.VITE_PUBLIC_APP_URL = 'https://www.projtrack.codes';

import { build } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function buildProductionFixture() {
  console.log('Building production fixture...');

  await build({
    configFile: path.resolve(__dirname, '../vite.config.ts'),
    mode: 'production',
    logLevel: 'info',
  });

  console.log('✅ Production fixture built successfully');
}

buildProductionFixture().catch((err) => {
  console.error('❌ Production fixture build failed:', err);
  process.exit(1);
});
