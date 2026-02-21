import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

function wwwRedirect(): Plugin {
  return {
    name: 'www-redirect',
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        const host = req.headers.host || '';
        if (host.startsWith('www.')) {
          const newHost = host.slice(4);
          res.writeHead(301, { Location: `https://${newHost}${req.url}` });
          res.end();
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [wwwRedirect(), react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  preview: {
    allowedHosts: ['.pokeradar.pl', '.railway.app', 'localhost'],
  },
});
