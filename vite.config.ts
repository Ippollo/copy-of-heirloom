import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    define: {
      // This is necessary because the current code uses `process.env.API_KEY`.
      // In a standard Vite app, you would normally use `import.meta.env.VITE_API_KEY`.
      // We shim it here to avoid rewriting all your service files.
      'process.env': env
    },
    build: {
      outDir: 'dist',
      sourcemap: false
    }
  };
});