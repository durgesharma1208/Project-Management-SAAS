import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');

await build({
  entryPoints: [path.join(dir, 'entry.jsx')],
  outfile: path.join(dir, 'out.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'automatic',
  define: { 'import.meta.env.VITE_API_URL': '"/api"' },
  loader: { '.js': 'jsx', '.jsx': 'jsx', '.css': 'empty' },
  external: [
    'react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', 'react-dom/server', 'axios',
    'react-router-dom', '@tanstack/react-query', 'date-fns', 'lucide-react',
    '@hello-pangea/dnd', '@xyflow/react', 'react-hook-form', 'zod',
    '@hookform/resolvers/zod',
  ],
  plugins: [{
    name: 'mock-api',
    setup(b) {
      b.onResolve({ filter: /(^|\/)api(\.js)?$/ }, () => ({ path: path.join(dir, 'apiMock.js') }));
      b.onResolve({ filter: /\.css$/ }, () => ({ path: 'empty-css', namespace: 'empty' }));
      b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '', loader: 'js' }));
    },
  }],
  logLevel: 'warning',
});
console.log('smoke bundle built');
