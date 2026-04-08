import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  
  // Define standard plugins
  const plugins = [react(), tailwindcss()];

  // Only add viteSingleFile if we are building specifically for Google Apps Script
  if (mode === 'gscript') {
    plugins.push(viteSingleFile());
  }

  return {
    plugins: plugins,
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: "dist",
      // Clean the directory before building to avoid mixing old/new assets
      emptyOutDir: true,
      // Increase limit for inlining assets if necessary
      assetsInlineLimit: 100000000, 
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});