import { isSlotAllowed } from '../algorithms/types.js';

export const SuggestionService = {
    /**
     * Find potential swap suggestions using a BFS approach to find the shortest resolve path.
     * Often a single swap is enough, but sometimes a chain (A->B, B->C) is needed.
     */
    findSwapSuggestions(classId, periodIndex, conflictType, currentSchedules, requirements, classes, teachers, courses) {
        const targetClassSchedule = currentSchedules.find(s => s.classId === classId);
        if (!targetClassSchedule) return [];

        const conflictedPeriod = targetClassSchedule.periods[periodIndex];
        if (!conflictedPeriod || !conflictedPeriod.courseId) return [];

        const queue = [{
            path: [], // Array of swaps: { classId, from, to, type }
            currentSchedules: JSON.parse(JSON.stringify(currentSchedules))
        }];
        const results = [];
        const visited = new Set();
        const maxDepth = 2; // Keep it simple for now: 1 swap or 2 chain-swaps.

        while (queue.length > 0) {
            const { path, currentSchedules: stateSchedules } = queue.shift();
            if (path.length > maxDepth) continue;

            const currentClassSch = stateSchedules.find(s => s.classId === classId);
            const currentPeriod = currentClassSch.periods[periodIndex];

            // If this state has no hard conflict for this specific slot, it's a candidate
            if (path.length > 0 && this.isSlotSafe(classId, periodIndex, currentPeriod, stateSchedules, teachers)) {
                results.push({
                    path,
                    description: this.formatPathToDescription(path, currentSchedules, courses),
                    score: 100 - (path.length * 20),
                    type: path.length > 1 ? 'CHAIN' : (path[0].type === 'MOVE' ? 'MOVE' : 'SWAP')
                });
                if (results.length >= 3) break;
                continue;
            }

            // Explore neighbors
            // We search for swaps within the SAME class first to minimize side effects
            for (let i = 0; i < 35; i++) {
                if (i === periodIndex) continue;

                const otherPeriod = currentClassSch.periods[i];
                const stateKey = `${classId}-${periodIndex}-${i}-${path.length}`;
                if (visited.has(stateKey)) continue;
                visited.add(stateKey);

                // Option A: Move to empty slot
                if (!otherPeriod || !otherPeriod.courseId) {
                    if (this.canMoveSafely(classId, periodIndex, i, stateSchedules, teachers)) {
                        const newSchedules = JSON.parse(JSON.stringify(stateSchedules));
                        const sch = newSchedules.find(s => s.classId === classId);
                        sch.periods[i] = { ...sch.periods[periodIndex] };
                        sch.periods[periodIndex] = { courseId: null, teacherId: null };

                        queue.push({
                            path: [...path, { classId, from: periodIndex, to: i, type: 'MOVE' }],
                            currentSchedules: newSchedules
                        });
                    }
                }
                // Option B: Swap with existing slot
                else {
                    if (this.canSwapSafely(classId, periodIndex, i, stateSchedules, teachers)) {
                        const newSchedules = JSON.parse(JSON.stringify(stateSchedules));
                        const sch = newSchedules.find(s => s.classId === classId);
                        const temp = { ...sch.periods[i] };
                        sch.periods[i] = { ...sch.periods[periodIndex] };
                        sch.periods[periodIndex] = temp;

                        queue.push({
                            path: [...path, { classId, from: periodIndex, to: i, type: 'SWAP' }],
                            currentSchedules: newSchedules
                        });
                    }
                }
            }
        }

        return results.sort((a, b) => b.score - a.score).slice(0, 3);
    },

    isSlotSafe(classId, idx, period, schedules, teachers) {
        if (!period.teacherId) return true;

        // 1. Basic Eligibility (Grade restriction)
        const grade = parseInt(classId.substring(1, 2)) || 1; // Extracts G1 -> 1
        if (!isSlotAllowed(grade, idx)) return false;

        // 2. Teacher availability
        const teacher = teachers.find(t => t.id === period.teacherId);
        if (teacher?.unavailableSlots?.includes(idx)) return false;

        // 3. Teacher conflict (is teacher elsewhere?)
        const isBusy = schedules.some(s =>
            s.classId !== classId &&
            s.periods[idx]?.teacherId === period.teacherId
        );
        return !isBusy;
    },

    canMoveSafely(classId, from, to, schedules, teachers) {
        const sch = schedules.find(s => s.classId === classId);
        const p = sch.periods[from];
        return this.isSlotSafe(classId, to, p, schedules, teachers);
    },

    canSwapSafely(classId, idxA, idxB, schedules, teachers) {
        const sch = schedules.find(s => s.classId === classId);
        const pA = sch.periods[idxA];
        const pB = sch.periods[idxB];

        // Check if Teacher A can go to B AND Teacher B can go to A
        return this.isSlotSafe(classId, idxB, pA, schedules, teachers) &&
            this.isSlotSafe(classId, idxA, pB, schedules, teachers);
    },

    formatIdx(idx) {
        const days = ['一', '二', '三', '四', '五'];
        const day = Math.floor(idx / 7);
        const period = (idx % 7) + 1;
        return `週${days[day]}第 ${period} 節`;
    },

    formatPathToDescription(path, originalSchedules, courses) {
        if (path.length === 1) {
            const op = path[0];
            const sch = originalSchedules.find(s => s.classId === op.classId);
            const target = sch.periods[op.to];
            if (op.type === 'MOVE') {
                return `移動至 ${this.formatIdx(op.to)} (空時段)`;
            } else {
                const targetCrs = courses?.find(c => c.id === target.courseId);
                const targetName = targetCrs ? (typeof targetCrs.name === 'string' ? targetCrs.name : (targetCrs.name.name || '科目')) : '其他科目';
                return `與 ${this.formatIdx(op.to)} 的「${targetName}」對調`;
            }
        }

        return path.map(op => {
            if (op.type === 'MOVE') return `移動至 ${this.formatIdx(op.to)}`;
            const sch = originalSchedules.find(s => s.classId === op.classId);
            const target = sch.periods[op.to];
            const targetCrs = courses?.find(c => c.id === target.courseId);
            const targetName = targetCrs ? (typeof targetCrs.name === 'string' ? targetCrs.name : (targetCrs.name.name || '科目')) : '科目';
            return `對調 ${this.formatIdx(op.to)} 的「${targetName}」`;
        }).join('，然後 ');
    }
}
