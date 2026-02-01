/**
 * @typedef {Object} Gene
 * Represents a single period for a single class.
 * @property {string} classId - The class ID (e.g., "G1-C1")
 * @property {number} periodIndex - 0 to 34 (Mon 1-7 ... Fri 1-7)
 * @property {string|null} courseId - The course ID (e.g., "Chinese") or null for empty
 * @property {string|null} teacherId - The teacher ID or null
 */

/**
 * @typedef {Gene[]} Chromosome
 * A flat array of Genes representing the entire school schedule.
 * Length = NumClasses * NumPeriodsPerWeek
 */

/**
 * @typedef {Object} ScheduleConfig
 * Configuration for the scheduling run.
 * @property {number} periodsPerDay - Default 7
 * @property {number} daysPerWeek - Default 5
 * @property {Object} constraints - Hard/Soft constraints settings
 */

export const PERIODS_PER_DAY = 7;
export const DAYS_PER_WEEK = 5;
export const TOTAL_PERIODS = PERIODS_PER_DAY * DAYS_PER_WEEK;

/**
 * Helper to get day index from period index
 * @param {number} periodIndex 
 * @returns {number} 0-4
 */
export const getDayIndex = (periodIndex) => Math.floor(periodIndex / PERIODS_PER_DAY);

/**
 * Helper to get time slot index from period index (0-6)
 * @param {number} periodIndex 
 * @returns {number} 0-6
 */
export const getTimeSlotIndex = (periodIndex) => periodIndex % PERIODS_PER_DAY;

/**
 * Check if a period slot is allowed for a specific grade.
 * @param {number} grade 1-6
 * @param {number} periodIndex 0-34
 * @returns {boolean}
 */
export const isSlotAllowed = (grade, periodIndex) => {
    const dayIndex = getDayIndex(periodIndex);
    const timeSlot = getTimeSlotIndex(periodIndex); // 0-6 (0=Period 1, 4=Period 5)

    // Global Rule: Wednesday Afternoon (Day 2, Slots 4-6) is OFF for EVERYONE
    if (dayIndex === 2 && timeSlot >= 4) return false;

    // Grades 1, 2:
    // Tue (Day 1) Full Day.
    // Mon, Wed, Thu, Fri (0, 2, 3, 4) Half Day (Afternoon OFF).
    if (grade === 1 || grade === 2) {
        if (dayIndex !== 1 && timeSlot >= 4) return false;
    }

    // Grades 3, 4:
    // Fri (Day 4) Half Day.
    // Wed (Day 2) Half Day (Already covered by global rule).
    // Mon, Tue, Thu Full Day.
    if (grade === 3 || grade === 4) {
        if (dayIndex === 4 && timeSlot >= 4) return false;
    }

    // Grades 5, 6:
    // Typically Wed Half Day (Covered by global).
    // Others Full Day.
    // No extra restrictions.

    return true;
};
