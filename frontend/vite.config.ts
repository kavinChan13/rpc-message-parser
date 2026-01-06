import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  // 加载环境变量
  const env = loadEnv(mode, process.cwd(), '')

  // Base Path 配置：支持反向代理部署
  // 可通过 VITE_BASE_PATH 环境变量设置，默认为 '/'
  const basePath = env.VITE_BASE_PATH || '/'

  return {
    plugins: [react()],

    // Base Path 配置 - 用于反向代理部署
    base: basePath,

    // 构建优化配置
    build: {
      // 输出目录
      outDir: 'dist',

      // 静态资源目录
      assetsDir: 'assets',

      // 使用 esbuild 压缩（更快）
      minify: 'esbuild',

      // 生产环境移除 console 和 debugger
      esbuildOptions: {
        drop: mode === 'production' ? ['console', 'debugger'] : [],
      },

      // Rollup 配置
      rollupOptions: {
        output: {
          // 代码分割 - 将依赖库单独打包
          manualChunks: {
            // React 核心库
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // UI 相关
            'vendor-ui': ['lucide-react'],
            // 工具库
            'vendor-utils': ['axios', 'zustand', 'date-fns'],
          },
          // 文件命名格式（包含 hash 用于缓存）
          chunkFileNames: 'assets/js/[name]-[hash].js',
          entryFileNames: 'assets/js/[name]-[hash].js',
          assetFileNames: 'assets/[ext]/[name]-[hash].[ext]',
        },
      },

      // 启用 source map（可选，生产环境可关闭）
      sourcemap: mode !== 'production',

      // 警告大文件阈值
      chunkSizeWarningLimit: 500,
    },

    // 开发服务器配置
    server: {
      port: 3000,
      // API 代理
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
        },
      },
    },

    // 预览服务器配置（用于本地预览生产构建）
    preview: {
      port: 4173,
    },
  }
})
