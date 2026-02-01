import { isSlotAllowed } from '../algorithms/types.js';

export const SuggestionService = {
    /**
     * Find potential swap suggestions for a conflicting slot
     */
    findSwapSuggestions(classId, periodIndex, conflictType, currentSchedules, requirements, classes, teachers) {
        const suggestions = [];
        const targetClassSchedule = currentSchedules.find(s => s.classId === classId);
        if (!targetClassSchedule) return [];

        const conflictedPeriod = targetClassSchedule.periods[periodIndex];
        if (!conflictedPeriod.courseId) return [];

        // Analysis: Why is it conflicting?
        // 1. Teacher Busy elsewhere
        // 2. Classroom Busy elsewhere (handled as part of teacher/class normally)
        // 3. Daily limits (Math/Chinese)

        // Search through the same class for empty or flexible slots to swap with
        for (let i = 0; i < 35; i++) {
            if (i === periodIndex) continue;

            const otherPeriod = targetClassSchedule.periods[i];

            // Try swapping with an empty slot first
            if (!otherPeriod.courseId) {
                if (this.canMoveTo(classId, i, conflictedPeriod, currentSchedules, requirements, classes, teachers)) {
                    suggestions.push({
                        type: 'MOVE',
                        from: periodIndex,
                        to: i,
                        description: `移動至 ${this.formatIdx(i)} (該時段為空)`,
                        score: 100
                    });
                }
            } else {
                // Try swapping with another existing period
                if (this.canSwap(classId, periodIndex, i, currentSchedules, requirements, classes, teachers)) {
                    suggestions.push({
                        type: 'SWAP',
                        from: periodIndex,
                        to: i,
                        withCourseId: otherPeriod.courseId,
                        description: `與 ${this.formatIdx(i)} 的「${otherPeriod.courseName || '其他科目'}」對調`,
                        score: 80
                    });
                }
            }
        }

        return suggestions.sort((a, b) => b.score - a.score).slice(0, 3);
    },

    formatIdx(idx) {
        const days = ['一', '二', '三', '四', '五'];
        const day = Math.floor(idx / 7);
        const period = (idx % 7) + 1;
        return `週${days[day]}第 ${period} 節`;
    },

    canMoveTo(classId, toIdx, periodData, currentSchedules, requirements, classes, teachers) {
        // Simple heuristic: check if teacher is available and slot is allowed
        const teacher = teachers.find(t => t.id === periodData.teacherId);
        if (teacher && !isSlotAllowed(toIdx, teacher.unavailableSlots)) return false;

        // Check if teacher is busy in another class at toIdx
        const teacherBusy = currentSchedules.some(s =>
            s.classId !== classId &&
            s.periods[toIdx]?.teacherId === periodData.teacherId
        );
        if (teacherBusy) return false;

        return true;
    },

    canSwap(classId, idxA, idxB, currentSchedules, requirements, classes, teachers) {
        const sch = currentSchedules.find(s => s.classId === classId);
        const pA = sch.periods[idxA];
        const pB = sch.periods[idxB];

        // Check teacher A availability at idxB
        const tA = teachers.find(t => t.id === pA.teacherId);
        if (tA && (!isSlotAllowed(idxB, tA.unavailableSlots) || this.isTeacherBusyAt(pA.teacherId, idxB, classId, currentSchedules))) return false;

        // Check teacher B availability at idxA
        const tB = teachers.find(t => t.id === pB.teacherId);
        if (tB && (!isSlotAllowed(idxA, tB.unavailableSlots) || this.isTeacherBusyAt(pB.teacherId, idxA, classId, currentSchedules))) return false;

        return true;
    },

    isTeacherBusyAt(teacherId, idx, excludeClassId, schedules) {
        if (!teacherId || teacherId === 'none') return false;
        return schedules.some(s => s.classId !== excludeClassId && s.periods[idx]?.teacherId === teacherId);
    }
};
