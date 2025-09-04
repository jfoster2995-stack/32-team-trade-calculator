import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const repo = '32-team-trade-calculator'; // <-- your exact repo name

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'production' ? `/${repo}/` : '/',  // dev = '/', prod = '/repo/'
}));
