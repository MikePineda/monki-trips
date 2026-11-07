// @ts-check
import eslint from '@eslint/js'
import tseslint from 'typescript-eslint'
import angular from 'angular-eslint'

export default tseslint.config(
  { ignores: ['dist/', '.angular/', 'coverage/', 'public/'] },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // `app` for the application, `mk` for the ui-kit (shared/ui).
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: ['app', 'mk'], style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        [
          { type: 'element', prefix: ['app', 'mk'], style: 'kebab-case' },
          { type: 'attribute', prefix: ['app', 'mk'], style: 'kebab-case' },
        ],
      ],
      '@angular-eslint/prefer-standalone': 'error',
      '@angular-eslint/prefer-signals': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {
      // Static inline styles are banned (tokens through classes); data-driven bindings are allowed.
      '@angular-eslint/template/no-inline-styles': ['error', { allowBindToStyle: 'dynamic' }],
      '@angular-eslint/template/prefer-control-flow': 'error',
    },
  }
)
