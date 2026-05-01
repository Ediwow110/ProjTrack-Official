/// <reference types="vite/client" />

interface ImportMetaEnv {
  PROD: boolean;
  DEV: boolean;
  MODE: string;
  VITE_API_BASE_URL: string;
  VITE_USE_BACKEND?: string;
  VITE_PUBLIC_APP_URL?: string;
  VITE_APP_URL?: string;
}

interface ImportMeta {
  env: ImportMetaEnv;
}