/**
 * Firestore Rules 測試專用設定
 *
 * - 只跑 `src/test/rules/**` 下的測試
 * - Node 環境(不需要 DOM)
 * - 連接 Firebase Emulator(port 8080 via FIRESTORE_EMULATOR_HOST)
 * - testTimeout 拉長,避免 emulator 首次冷啟動 flake
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/test/rules/**/*.test.js'],
        testTimeout: 20_000,
        hookTimeout: 20_000,
        // 單一 worker 避免 emulator 並發衝突(Vitest 4 扁平化後的新語法)
        pool: 'forks',
        fileParallelism: false,
    },
});
