import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import { pluginTypeCheck } from '@rsbuild/plugin-type-check';

export default defineConfig({
  plugins: [
    pluginReact(),
    pluginTypeCheck(),
  ],
  html: {
    template: './public/index.html',
  },
  output: {
    // Set base path for GitHub Pages deployment
    assetPrefix: process.env.NODE_ENV === 'production' ? '/bms-report/' : '/',
  },
  source: {
    entry: {
      index: './src/index.tsx',
    },
  },
  server: {
    open: true,
  },
});
