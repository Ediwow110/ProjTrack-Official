/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_BACKEND?: string;
  readonly VITE_ALLOW_PROTOTYPE?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}