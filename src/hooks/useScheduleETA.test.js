import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScheduleETA } from './useScheduleETA';

/**
 * useScheduleETA 單元測試
 *
 * 使用 vi.useFakeTimers + mock performance.now 來精確控制時間推進。
 */

describe('useScheduleETA', () => {
    let nowValue = 0;
    let realPerfNow;

    beforeEach(() => {
        nowValue = 0;
        realPerfNow = performance.now;
        performance.now = vi.fn(() => nowValue);
        vi.useFakeTimers();
    });

    afterEach(() => {
        performance.now = realPerfNow;
        vi.useRealTimers();
    });

    const advance = (ms) => {
        nowValue += ms;
        act(() => {
            vi.advanceTimersByTime(ms);
        });
    };

    it('returns zero metrics when idle', () => {
        const { result } = renderHook(() =>
            useScheduleETA({ status: 'idle', generation: 0, score: 0, stagnation: 0 })
        );
        expect(result.current.elapsedMs).toBe(0);
        expect(result.current.etaSeconds).toBeNull();
        expect(result.current.elapsedLabel).toBe('0 秒');
        expect(result.current.etaLabel).toBe('—');
    });

    it('formats elapsed time correctly', () => {
        const { result, rerender } = renderHook(
            (props) => useScheduleETA(props),
            { initialProps: { status: 'running', generation: 0, score: 0, stagnation: 0 } }
        );

        // 推進 5 秒
        advance(5000);
        rerender({ status: 'running', generation: 10, score: 100000, stagnation: 0 });
        advance(0);
        expect(result.current.elapsedLabel).toMatch(/秒/);
    });

    it('computes gen/sec based on samples', () => {
        const { result, rerender } = renderHook(
            (props) => useScheduleETA(props),
            { initialProps: { status: 'running', generation: 0, score: 0, stagnation: 0 } }
        );

        // gen 0 @ t=0
        advance(1000);
        rerender({ status: 'running', generation: 10, score: 100, stagnation: 0 });
        advance(1000);
        rerender({ status: 'running', generation: 20, score: 200, stagnation: 0 });
        advance(100);
        // 20 代 / 2.1 秒 ≈ 9.5 gen/sec
        expect(result.current.genPerSec).toBeGreaterThan(0);
    });

    it('provides ETA in Chinese format', () => {
        const { result, rerender } = renderHook(
            (props) => useScheduleETA(props),
            { initialProps: { status: 'running', generation: 0, score: 0, stagnation: 0 } }
        );

        advance(500);
        rerender({ status: 'running', generation: 50, score: 500000, stagnation: 10 });
        advance(500);
        rerender({ status: 'running', generation: 100, score: 800000, stagnation: 20 });
        advance(100);

        // ETA 應為 "約 X 秒" 或 "即將完成"
        expect(result.current.etaLabel).toMatch(/秒|分|即將完成|—/);
    });

    it('resets state when status returns to idle', () => {
        const { result, rerender } = renderHook(
            (props) => useScheduleETA(props),
            { initialProps: { status: 'running', generation: 0, score: 0, stagnation: 0 } }
        );

        advance(3000);
        rerender({ status: 'idle', generation: 0, score: 0, stagnation: 0 });
        advance(100);

        expect(result.current.elapsedMs).toBe(0);
        expect(result.current.genPerSec).toBe(0);
    });
});
