import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      // schema 泛型与 CompElem<any> 等类型逃生口为刻意设计
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
