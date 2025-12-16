/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PAGESPEED_API_KEY?: string;
  readonly VITE_BRAND?: string;
  readonly VITE_ABACUS_ENDPOINT?: string;
  readonly VITE_ABACUS_API_KEY?: string;
  readonly VITE_USE_MOCK_ANALYZER?: string;
  readonly GEMINI_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
