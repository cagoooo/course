/**
 * 全域測試環境 setup — happy-dom 環境下補上 AutoSchedule 依賴的瀏覽器 API。
 *
 * - navigator.clipboard:handleCopyShareLink 需要
 * - matchMedia:部分 UI 在初始化時讀取
 * - performance.now:useScheduleETA 依賴
 */
import { afterEach, vi } from 'vitest';

// clipboard mock
if (typeof navigator !== 'undefined' && !navigator.clipboard) {
    Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn(() => Promise.resolve()) },
        writable: true,
    });
}

// matchMedia mock
if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
    }));
}

afterEach(() => {
    vi.clearAllMocks();
});
