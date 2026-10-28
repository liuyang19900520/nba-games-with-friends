const { defineConfig } = require('@tarojs/cli')
module.exports = defineConfig({
  projectName: 'nba-mvp',
  date: '2026-10-28',
  designWidth: 375,
  deviceRatio: { 375: 2, 640: 2.34 / 2, 750: 1, 828: 1.81 / 2 },
  sourceRoot: 'src',
  outputRoot: `dist/${process.env.TARO_ENV}`,
  framework: 'react',
  compiler: 'webpack5',
  cache: { enable: false },
  plugins: [],
  // H5 only: serve mock fixtures + own images (/mock, /img). Not copied into the mini program (2MB limit).
  copy: { patterns: process.env.TARO_ENV === 'h5' ? [{ from: 'static/', to: 'dist/h5/' }] : [], options: {} },
  // TARO_APP_* env vars are injected automatically (see .env files)
  mini: {
    postcss: { pxtransform: { enable: true, config: {} }, cssModules: { enable: false } },
    optimizeMainPackage: { enable: true }
  },
  h5: {
    publicPath: '/',
    staticDirectory: 'static',
    router: { mode: 'hash' },
    postcss: { autoprefixer: { enable: true }, cssModules: { enable: false } }
  }
})
