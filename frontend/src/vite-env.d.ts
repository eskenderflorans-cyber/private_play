/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WHEEL_TOKEN_ADDRESS: string;
  readonly VITE_FORTUNE_WHEEL_ADDRESS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
