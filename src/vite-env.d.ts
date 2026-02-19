/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEV_ADMIN_MODE?: string;
  readonly VITE_DEV_ADMIN_EMAIL?: string;
  readonly VITE_DEV_FORCE_ROLE?: 'admin' | 'client';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
