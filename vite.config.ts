import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace "your-username" and "repo-name" with your actual repo details
export default defineConfig({
  plugins: [react()],
  base: "/32-team-trade-calculator/",  
})
