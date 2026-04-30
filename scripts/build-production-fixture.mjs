process.env.NODE_ENV = 'production';
process.env.APP_ENV = 'production';
process.env.VITE_USE_BACKEND = 'true';
process.env.VITE_API_BASE_URL = 'https://api.projtrack.codes';
process.env.VITE_PUBLIC_APP_URL = 'https://www.projtrack.codes';

const { build } = await import('vite');
await build();
