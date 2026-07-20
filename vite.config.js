import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin.html'),
        doctor: resolve(__dirname, 'doctor.html'),
        patient: resolve(__dirname, 'patient.html'),
        receptionist: resolve(__dirname, 'receptionist.html'),
        register: resolve(__dirname, 'register.html'),
      }
    }
  }
})
