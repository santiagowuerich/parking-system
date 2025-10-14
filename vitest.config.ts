/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./tests/setup.ts'],
        globals: true,
        include: [
            'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
            'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
        ],
        exclude: [
            'node_modules',
            'dist',
            '.idea',
            '.git',
            '.cache',
            'tests/integration/**/*',
            'tests/e2e/**/*'
        ]
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './'),
            '@components': path.resolve(__dirname, './components'),
            '@lib': path.resolve(__dirname, './lib'),
            '@hooks': path.resolve(__dirname, './hooks'),
            '@utils': path.resolve(__dirname, './lib/utils')
        }
    }
})
