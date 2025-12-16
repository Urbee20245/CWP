/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK_ANALYZER?: string;
  readonly VITE_ABACUS_ENDPOINT?: string;
  readonly VITE_ABACUS_API_KEY?: string;
  readonly VITE_BRAND?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
