import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from 'fs';
import path from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'tauri-e2e-mock',
      enforce: 'pre',
      async transform(code, id) {
        if (process.env.VITE_E2E_TEST === 'true' && id.includes('main.tsx')) {
          const mockCode = fs.readFileSync(path.resolve(__dirname, 'e2e/tauri-mock.ts'), 'utf-8');
          return mockCode + code;
        }
      },
    },
  ],
  define: {
    'import.meta.env.VITE_E2E_TEST': JSON.stringify(process.env.VITE_E2E_TEST === 'true'),
  },
  build: {
    target: "es2022",
  },
  css: {
    parser: "lightningcss",
  },
});
