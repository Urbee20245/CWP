import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import prerender from 'vite-plugin-prerender';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const publicRoutes = [
    '/',              // Homepage
    '/services',
    '/process',
    '/contact',
    '/jetsuite',
    '/jetviz',
    '/jet-local-optimizer',
  ];

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [
      react(),
      // Prerender only public marketing routes; app/admin/client routes are excluded
      prerender({
        routes: publicRoutes,
        staticDir: path.resolve(__dirname, 'dist'),
        renderer: '@prerenderer/renderer-puppeteer',
        postProcess(renderedRoute) {
          // Ensure canonical base remains unchanged
          if (renderedRoute.route === '/') {
            renderedRoute.route = '/';
          }
          return renderedRoute;
        },
      }),
    ],
    define: {
      'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY || env.GEMINI_API_KEY),
      'process.env.GEMINI_MODEL': JSON.stringify(env.VITE_GEMINI_MODEL || env.GEMINI_MODEL),
      // Supabase variables
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
      // Dev Admin Bypass variables
      'import.meta.env.VITE_DEV_ADMIN_MODE': JSON.stringify("true"),
      'import.meta.env.VITE_DEV_ADMIN_EMAIL': JSON.stringify("Theivsightcompany@gmail.com"),
      'import.meta.env.VITE_DEV_FORCE_ROLE': JSON.stringify("admin"),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});