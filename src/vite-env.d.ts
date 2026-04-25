interface ImportMetaEnv {
  readonly VITE_USE_BACKEND?: string;
  readonly VITE_ALLOW_PROTOTYPE?: string;
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
