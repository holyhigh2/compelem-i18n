import dts from 'vite-plugin-dts'
import { defineConfig } from 'vitest/config'
import pkg from './package.json'

// 库模式构建：ESM-only（对齐 compelem 的发布形态），compelem/myfx 保持 external 由消费方提供
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  server: {
    port: 8818,
  },
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      external: ['compelem', 'myfx'],
    },
  },
  plugins: [
    dts({
      include: ['src'],
    }),
  ],
  test: {
    environment: 'happy-dom',
  },
})
