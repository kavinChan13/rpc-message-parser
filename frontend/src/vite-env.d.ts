/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEBUG: string
  readonly VITE_BASE_PATH: string
  readonly BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
