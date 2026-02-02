/**
 * DiffService.js
 * Calculates the visual difference between two schedule datasets.
 * Useful for comparing "Current Schedule" vs "Snapshot" or "Snapshot A" vs "Snapshot B".
 */

export const DiffService = {
    /**
     * Compare two schedule arrays.
     * @param {Array} baseSchedules - The original/base version (e.g., Current Schedule).
     * @param {Array} targetSchedules - The comparison target (e.g., Snapshot to restore).
     * @returns {Object} Diff result containing 'added', 'removed', 'modified', and a 'lookupMap'.
     */
    compare: (baseSchedules, targetSchedules) => {
        const baseMap = createScheduleMap(baseSchedules);
        const targetMap = createScheduleMap(targetSchedules);

        const diffs = {
            added: [],      // Exists in Target, not in Base
            removed: [],    // Exists in Base, not in Target
            modified: [],   // Exists in both, but content changed
            unchanged: []   // Exact match
        };

        // 1. Check content in Base
        baseMap.forEach((baseItem, key) => {
            if (!targetMap.has(key)) {
                // Key exists in Base but not Target -> REMOVED (if restoring target, this slot will be empty)
                // Wait, if we are "Previewing Restore of Target", then:
                // Base = Current, Target = Snapshot.
                // If Snapshot (Target) doesn't have it, it means restoring will REMOVE this class.
                diffs.removed.push(baseItem);
            } else {
                const targetItem = targetMap.get(key);
                if (isScheduleDifferent(baseItem, targetItem)) {
                    // content changed (e.g. diff class or course)
                    diffs.modified.push({
                        from: baseItem,
                        to: targetItem,
                        key: key
                    });
                } else {
                    diffs.unchanged.push(baseItem);
                }
            }
        });

        // 2. Check for new items in Target (that weren't in Base)
        targetMap.forEach((targetItem, key) => {
            if (!baseMap.has(key)) {
                // New item in snapshot that isn't in current
                diffs.added.push(targetItem);
            }
        });

        return diffs;
    },

    /**
     * Generates a CSS class for a slot based on diff status.
     * @param {Object} slotData - The schedule item.
     * @param {Object} diffResult - The result from compare().
     */
    getDiffClass: (slotData, diffResult) => {
        if (!diffResult) return '';
        // Helper implementation would depend on how the grid uses it.
        // Usually the grid iterates slots.
        return '';
    }
};

// Unique key for a schedule slot: Teacher + Day + Period
// Or Class + Day + Period?
// Schedule structure: { teacherId, weekday, period, classId, courseId }
// Primary Conflict Key: Teacher + Slots? No, usually we want to see "What changed for this Teacher?"
// The Grid is likely Teacher-based rows. So Key = TeacherId + Weekday + Period.
const createScheduleMap = (schedules) => {
    const map = new Map();
    schedules.forEach(s => {
        if (!s) return;
        // Key: classId_weekday_period (More intuitive for class-based editing/viewing)
        const key = `${s.classId}_${s.weekday}_${s.period}`;
        map.set(key, s);
    });
    return map;
};

const isScheduleDifferent = (a, b) => {
    return a.courseId !== b.courseId || a.teacherId !== b.teacherId;
};
