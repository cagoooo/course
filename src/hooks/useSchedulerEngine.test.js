import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * useSchedulerEngine 測試
 *
 * 挑戰:Vite 的 `?worker` import 在測試環境無法直接解析,
 * 因此先用 vi.mock 把它替換為可控的 FakeWorker。
 */

class FakeWorker {
    constructor() {
        this.postedMessages = [];
        this.onmessage = null;
        this.onerror = null;
        this.terminated = false;
    }
    postMessage(msg) {
        this.postedMessages.push(msg);
    }
    terminate() {
        this.terminated = true;
    }
    // 測試輔助:模擬 worker 向外發 message
    emit(type, payload) {
        this.onmessage?.({ data: { type, payload } });
    }
    throwError(err) {
        this.onerror?.(err);
    }
}

const workerInstances = [];

vi.mock('../workers/scheduler.worker.js?worker', () => {
    return {
        default: class {
            constructor() {
                const w = new FakeWorker();
                workerInstances.push(w);
                return w;
            }
        },
    };
});

// 注意:import useSchedulerEngine 要在 mock 之後
import { useSchedulerEngine } from './useSchedulerEngine';
import { useScheduleStore } from '../store/scheduleStore';

describe('useSchedulerEngine', () => {
    beforeEach(() => {
        workerInstances.length = 0;
        useScheduleStore.getState().resetAll();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('start() with no requirements triggers onWarning, does NOT spawn worker', () => {
        const onWarning = vi.fn();
        const { result } = renderHook(() => useSchedulerEngine({ onWarning }));

        act(() => {
            const ok = result.current.start({ data: { requirements: [] } });
            expect(ok).toBe(false);
        });

        expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('無排課需求'));
        expect(workerInstances).toHaveLength(0);
    });

    it('start() with requirements spawns worker and posts START', () => {
        const { result } = renderHook(() => useSchedulerEngine({}));

        act(() => {
            result.current.start({
                data: { requirements: [{ classId: 'c1' }] },
                config: { populationSize: 50 },
            });
        });

        expect(workerInstances).toHaveLength(1);
        expect(workerInstances[0].postedMessages[0]).toEqual({
            type: 'START',
            payload: expect.objectContaining({
                data: { requirements: [{ classId: 'c1' }] },
                config: { populationSize: 50 },
                smartSeedGenes: null,
            }),
        });
        expect(useScheduleStore.getState().status).toBe('running');
    });

    it('PROGRESS message updates store.progress and calls onPopulationUpdate', () => {
        const onPopulationUpdate = vi.fn();
        const { result } = renderHook(() =>
            useSchedulerEngine({ onPopulationUpdate })
        );

        act(() => {
            result.current.start({ data: { requirements: [{ x: 1 }] } });
        });

        act(() => {
            workerInstances[0].emit('PROGRESS', {
                generation: 10,
                bestScore: 800000,
                bestSolution: [{ gene: 1 }],
                stagnation: 3,
                mutationRate: 0.04,
            });
        });

        expect(useScheduleStore.getState().progress.generation).toBe(10);
        expect(useScheduleStore.getState().progress.score).toBe(800000);
        expect(onPopulationUpdate).toHaveBeenCalledWith([{ gene: 1 }]);
    });

    it('CONVERGED message sets status=stopped and fires onConverged', () => {
        const onConverged = vi.fn();
        const onPopulationUpdate = vi.fn();
        const { result } = renderHook(() =>
            useSchedulerEngine({ onConverged, onPopulationUpdate })
        );

        act(() => {
            result.current.start({ data: { requirements: [{ x: 1 }] } });
        });

        act(() => {
            workerInstances[0].emit('CONVERGED', {
                generation: 300,
                bestScore: 999000,
                bestSolution: [{ gene: 99 }],
                message: '已收斂',
            });
        });

        expect(useScheduleStore.getState().status).toBe('stopped');
        expect(onConverged).toHaveBeenCalledWith('已收斂');
        expect(onPopulationUpdate).toHaveBeenLastCalledWith([{ gene: 99 }]);
    });

    it('stop() terminates worker and sets status=stopped', () => {
        const { result } = renderHook(() => useSchedulerEngine({}));

        act(() => {
            result.current.start({ data: { requirements: [{ x: 1 }] } });
        });
        expect(useScheduleStore.getState().status).toBe('running');

        act(() => {
            result.current.stop();
        });
        expect(workerInstances[0].terminated).toBe(true);
        expect(useScheduleStore.getState().status).toBe('stopped');
    });

    it('onerror triggers onWarning and cleans up', () => {
        const onWarning = vi.fn();
        const { result } = renderHook(() => useSchedulerEngine({ onWarning }));

        act(() => {
            result.current.start({ data: { requirements: [{ x: 1 }] } });
        });
        act(() => {
            workerInstances[0].throwError(new Error('boom'));
        });

        expect(onWarning).toHaveBeenCalledWith(expect.stringContaining('錯誤'));
        expect(useScheduleStore.getState().status).toBe('stopped');
    });

    it('unmount terminates active worker', () => {
        const { result, unmount } = renderHook(() => useSchedulerEngine({}));
        act(() => {
            result.current.start({ data: { requirements: [{ x: 1 }] } });
        });
        unmount();
        expect(workerInstances[0].terminated).toBe(true);
    });
});
