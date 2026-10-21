import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import svelte from 'eslint-plugin-svelte'
import prettier from 'eslint-config-prettier'
import globals from 'globals'

export default tseslint.config(
  { ignores: ['**/node_modules', '**/out', '**/dist', '**/coverage'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...svelte.configs['flat/recommended'],
  prettier,
  ...svelte.configs['flat/prettier'],
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    files: ['apps/desktop/src/renderer/**'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: [
      'apps/desktop/src/main/**',
      'apps/desktop/src/preload/**',
      '**/*.config.*',
      'scripts/**',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    // core is pure: no I/O, no wall-clock time (see DESIGN.md §3)
    files: ['packages/core/src/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'core is pure: pass time in.' },
        { object: 'performance', property: 'now', message: 'core is pure: pass time in.' },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'setTimeout', message: 'core is pure: no timers.' },
        { name: 'setInterval', message: 'core is pure: no timers.' },
        { name: 'fetch', message: 'core is pure: no I/O.' },
      ],
    },
  },
)
