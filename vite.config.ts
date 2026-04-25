import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

function manualVendorChunks(id: string) {
  const normalizedId = id.replace(/\\/g, '/')
  if (!normalizedId.includes('/node_modules/')) return undefined

  const packagePath = normalizedId.split('/node_modules/')[1] ?? ''

  if (
    packagePath === 'react' ||
    packagePath.startsWith('react/') ||
    packagePath === 'react-dom' ||
    packagePath.startsWith('react-dom/') ||
    packagePath === 'react-router' ||
    packagePath.startsWith('react-router/') ||
    packagePath === 'scheduler' ||
    packagePath.startsWith('scheduler/')
  ) {
    return 'react-vendor'
  }

  if (
    packagePath.startsWith('@radix-ui/') ||
    packagePath === 'cmdk' ||
    packagePath.startsWith('cmdk/') ||
    packagePath === 'vaul' ||
    packagePath.startsWith('vaul/')
  ) {
    return 'overlay-vendor'
  }

  if (
    packagePath.startsWith('@mui/') ||
    packagePath.startsWith('@emotion/') ||
    packagePath.startsWith('@popperjs/') ||
    packagePath === 'react-popper' ||
    packagePath.startsWith('react-popper/')
  ) {
    return 'mui-vendor'
  }

  if (packagePath === 'recharts' || packagePath.startsWith('recharts/')) {
    return 'charts-vendor'
  }

  if (
    packagePath === 'react-dnd' ||
    packagePath.startsWith('react-dnd/') ||
    packagePath === 'react-dnd-html5-backend' ||
    packagePath.startsWith('react-dnd-html5-backend/')
  ) {
    return 'dnd-vendor'
  }

  if (
    packagePath === 'react-hook-form' ||
    packagePath.startsWith('react-hook-form/') ||
    packagePath === 'input-otp' ||
    packagePath.startsWith('input-otp/')
  ) {
    return 'forms-vendor'
  }

  if (
    packagePath === 'class-variance-authority' ||
    packagePath.startsWith('class-variance-authority/') ||
    packagePath === 'clsx' ||
    packagePath.startsWith('clsx/') ||
    packagePath === 'date-fns' ||
    packagePath.startsWith('date-fns/') ||
    packagePath === 'lucide-react' ||
    packagePath.startsWith('lucide-react/') ||
    packagePath === 'next-themes' ||
    packagePath.startsWith('next-themes/') ||
    packagePath === 'sonner' ||
    packagePath.startsWith('sonner/') ||
    packagePath === 'tailwind-merge' ||
    packagePath.startsWith('tailwind-merge/') ||
    packagePath === 'tw-animate-css' ||
    packagePath.startsWith('tw-animate-css/')
  ) {
    return 'ui-utils-vendor'
  }

  return 'vendor'
}

function figmaAssetResolver() {
  return {
    name: 'figma-asset-resolver',
    resolveId(id) {
      if (id.startsWith('figma:asset/')) {
        const filename = id.replace('figma:asset/', '')
        return path.resolve(__dirname, 'src/assets', filename)
      }
    },
  }
}

export default defineConfig({
  plugins: [
    figmaAssetResolver(),
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          return manualVendorChunks(id)
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
