import { useCallback, useEffect, useRef } from 'react';
import SchedulerWorker from '../workers/scheduler.worker.js?worker';
import { useScheduleStore } from '../store/scheduleStore';

/**
 * useSchedulerEngine — 封裝 GA Worker 生命週期
 *
 * 職責:
 *   - 建立 / 銷毀 Worker
 *   - 傳 START / STOP 訊息
 *   - 接收 PROGRESS / CONVERGED,更新 store.progress + callback
 *
 * 呼叫者只需提供:
 *   - onPopulationUpdate(bestSolution):每當有新解,更新外部 bestSolution state
 *   - onConverged(message):演算完成時的 toast / 訊息呈現
 *
 * 回傳:{ start, stop, isRunning }
 */
export function useSchedulerEngine({ onPopulationUpdate, onConverged, onWarning } = {}) {
    const workerRef = useRef(null);
    const setStatus = useScheduleStore((s) => s.setStatus);
    const setProgress = useScheduleStore((s) => s.setProgress);
    const status = useScheduleStore((s) => s.status);

    // Ref 化 callback,避免因引用變動造成 worker.onmessage 反覆重綁
    const cbRef = useRef({ onPopulationUpdate, onConverged, onWarning });
    cbRef.current = { onPopulationUpdate, onConverged, onWarning };

    const terminateWorker = useCallback(() => {
        if (workerRef.current) {
            workerRef.current.terminate();
            workerRef.current = null;
        }
    }, []);

    // 元件卸載時保證 worker 被清乾淨
    useEffect(() => () => terminateWorker(), [terminateWorker]);

    const start = useCallback(({ data, config, smartSeedGenes } = {}) => {
        if (!data?.requirements?.length) {
            cbRef.current.onWarning?.('無排課需求,請先設定配課後再開始。');
            return false;
        }

        if (!workerRef.current) {
            workerRef.current = new SchedulerWorker();
            workerRef.current.onmessage = (e) => {
                const { type, payload } = e.data || {};
                if (type === 'PROGRESS') {
                    setProgress({
                        generation: payload.generation,
                        score: payload.bestScore,
                        stagnation: payload.stagnation || 0,
                        mutationRate: payload.mutationRate || 0,
                    });
                    cbRef.current.onPopulationUpdate?.(payload.bestSolution);
                } else if (type === 'CONVERGED') {
                    setProgress({
                        generation: payload.generation,
                        score: payload.bestScore,
                        stagnation: 0,
                        mutationRate: 0,
                    });
                    cbRef.current.onPopulationUpdate?.(payload.bestSolution);
                    setStatus('stopped');
                    cbRef.current.onConverged?.(payload.message);
                }
            };
            workerRef.current.onerror = (err) => {
                console.error('[scheduler worker]', err);
                cbRef.current.onWarning?.('排課引擎發生錯誤,已停止。');
                setStatus('stopped');
                terminateWorker();
            };
        }

        setStatus('running');
        workerRef.current.postMessage({
            type: 'START',
            payload: {
                data,
                config: config || { populationSize: 100, mutationRate: 0.05 },
                smartSeedGenes: smartSeedGenes || null,
            },
        });
        return true;
    }, [setStatus, setProgress, terminateWorker]);

    const stop = useCallback(() => {
        terminateWorker();
        setStatus('stopped');
    }, [terminateWorker, setStatus]);

    return {
        start,
        stop,
        isRunning: status === 'running',
    };
}
