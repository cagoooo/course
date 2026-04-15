/**
 * Vitest 專用設定 — 與 vite.config.js 分離,避免 PWA plugin 干擾測試。
 *
 * 環境: happy-dom(比 jsdom 輕量)用於 React 元件 / hooks 測試。
 * globals: true 讓 describe/it/expect 不需 import,對齊 Jest 習慣。
 * coverage: v8 reporter,閾值保守起步(可漸進提高)。
 */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        include: ['src/**/*.{test,spec}.{js,jsx,ts,tsx}'],
        exclude: ['node_modules', 'dist', '.github', 'scripts'],
        setupFiles: ['./src/test/setup.js'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html', 'json-summary'],
            // 聚焦於已撰寫測試的核心模組,避免 Firebase 依賴模組污染分母
            include: [
                'src/algorithms/ConstraintChecker.js',
                'src/algorithms/types.js',
                'src/services/SubstituteService.js',
                'src/hooks/**/*.js',
                'src/utils/excel/ExcelImporter.js',
                'src/contexts/ToastContext.jsx',
            ],
            exclude: [
                '**/*.test.{js,jsx}',
                '**/*.spec.{js,jsx}',
                'src/test/**',
            ],
            thresholds: {
                // 起步門檻(v2.12.0 基線);後續逐步提升至 85%+
                // 注意:ConstraintChecker 覆蓋率仍在 50%,是主要拖累項;已列入下一輪補測
                statements: 75,
                branches: 60,
                functions: 75,
                lines: 75,
            },
        },
    },
});
