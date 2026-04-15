import { useEffect, useRef, useState } from 'react';

/**
 * useScheduleETA — 排課進度 ETA 計算
 *
 * 輸入:
 *   status       'idle' | 'running' | 'stopped' | ...
 *   generation   目前世代數
 *   score        目前最佳分數
 *   stagnation   連續無進步世代
 *   targetScore  (可選) 目標分數,預設 1_000_000
 *
 * 輸出:
 *   elapsedMs       已花費時間
 *   genPerSec       當前速度(世代/秒)
 *   smoothedGenPerSec 平滑速度(近 10 個觀測)
 *   etaSeconds      預估剩餘秒數(null = 無法估計)
 *   etaLabel        可顯示文字,如 "約 12 秒" / "約 1 分 35 秒" / "即將完成"
 *   elapsedLabel    "12 秒" / "1 分 30 秒"
 *
 * 策略:
 *   - 若已收斂(stagnation > 150),ETA = 幾秒(只剩 CONVERGED 訊號)
 *   - 否則依目前速度 + 距離目標分數估計(保守估計 = max(分數收斂速度估計, 基於世代的估計))
 *   - 分數未動時(stagnation 大),採用「至多 300 代收斂」假設
 */
export function useScheduleETA({ status, generation, score, stagnation, targetScore = 1_000_000 }) {
    const [elapsedMs, setElapsedMs] = useState(0);
    const [genPerSec, setGenPerSec] = useState(0);

    const startTimeRef = useRef(null);
    const samplesRef = useRef([]); // { t, generation, score }
    const rafRef = useRef(null);

    // 記錄樣本(每次 generation 變動)
    useEffect(() => {
        if (status !== 'running') return;
        const now = performance.now();
        const samples = samplesRef.current;
        samples.push({ t: now, generation, score });
        if (samples.length > 20) samples.shift();
    }, [generation, score, status]);

    // 計時器
    useEffect(() => {
        if (status !== 'running') {
            cancelAnimationFrame(rafRef.current);
            if (status === 'idle') {
                startTimeRef.current = null;
                samplesRef.current = [];
                setElapsedMs(0);
                setGenPerSec(0);
            }
            return;
        }

        if (startTimeRef.current == null) {
            startTimeRef.current = performance.now();
            samplesRef.current = [];
        }

        const tick = () => {
            const now = performance.now();
            setElapsedMs(now - startTimeRef.current);

            const samples = samplesRef.current;
            if (samples.length >= 2) {
                const first = samples[0];
                const last = samples[samples.length - 1];
                const dt = (last.t - first.t) / 1000;
                const dg = last.generation - first.generation;
                if (dt > 0 && dg > 0) {
                    setGenPerSec(dg / dt);
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [status]);

    // ETA 計算
    const computeETA = () => {
        if (status !== 'running' || genPerSec <= 0) return null;

        // 已接近收斂(stagnation 高)→ 估計僅剩到 200 代閾值
        const STAGNATION_LIMIT = 200;
        const remainingStagnation = Math.max(0, STAGNATION_LIMIT - (stagnation || 0));

        // 依分數距離目標推估,保守取 max
        const scoreGap = Math.max(0, targetScore - score);
        const scoreBasedGens = scoreGap > 0 ? Math.min(scoreGap / 500, 500) : remainingStagnation;

        const estGens = Math.min(Math.max(remainingStagnation, scoreBasedGens), 500);
        const eta = estGens / genPerSec;

        return Math.max(0, Math.round(eta));
    };

    const etaSeconds = computeETA();

    return {
        elapsedMs,
        genPerSec,
        smoothedGenPerSec: genPerSec,
        etaSeconds,
        etaLabel: formatETA(etaSeconds),
        elapsedLabel: formatElapsed(elapsedMs),
    };
}

function formatElapsed(ms) {
    if (!ms || ms < 1000) return '0 秒';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s} 秒`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return rem ? `${m} 分 ${rem} 秒` : `${m} 分`;
}

function formatETA(sec) {
    if (sec == null) return '—';
    if (sec <= 2) return '即將完成';
    if (sec < 60) return `約 ${sec} 秒`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return s ? `約 ${m} 分 ${s} 秒` : `約 ${m} 分`;
}
