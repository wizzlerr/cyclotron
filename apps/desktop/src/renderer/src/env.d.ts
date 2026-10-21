/// <reference types="svelte" />
/// <reference types="vite/client" />
import type { CyclotronApi } from '../../shared/api'

declare global {
  interface Window {
    cyclotron: CyclotronApi
  }
}
