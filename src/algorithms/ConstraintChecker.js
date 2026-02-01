import { getDayIndex, TOTAL_PERIODS } from './types.js';

/**
 * Calculates fitness score for a chromosome.
 * Higher is better.
 * Score = Base - (Hard * 10000) - (Soft * 10)
 */
export class ConstraintChecker {
    constructor(config) {
        this.config = config || {};
        this.teachersMap = new Map();
        this.coursesMap = new Map();
        this.classroomsMap = new Map();
    }

    setTeachers(teachers) {
        this.teachersMap.clear();
        if (teachers && Array.isArray(teachers)) {
            teachers.forEach(t => this.teachersMap.set(t.id, t));
        }
    }

    setCourses(courses) {
        this.coursesMap.clear();
        if (courses && Array.isArray(courses)) {
            courses.forEach(c => this.coursesMap.set(c.id, c));
        }
    }

    setClassrooms(classrooms) {
        this.classroomsMap.clear();
        if (classrooms && Array.isArray(classrooms)) {
            classrooms.forEach(c => this.classroomsMap.set(c.id, c));
        }
    }

    /**
     * @param {import('./types').Chromosome} chromosome 
     * @returns {number} fitness score
     */
    calculateFitness(chromosome) {
        let hardPenalties = 0;
        let softPenalties = 0;

        // 1. Teacher Conflicts (Hard)
        const periodTeacherMap = new Map();
        const periodClassroomMap = new Map();

        // 3. Distribution & Block Periods (Soft)
        // Map: classId -> courseId -> [slotIndices]
        const classCourseSlots = new Map();

        // One pass validation
        for (const gene of chromosome) {
            if (!gene.teacherId) continue; // Empty slot

            // Check Teacher Conflict & Availability
            if (gene.teacherId !== '0' && gene.teacherId !== '1') {
                const key = `${gene.periodIndex}-${gene.teacherId}`;
                if (periodTeacherMap.has(key)) {
                    hardPenalties++;
                } else {
                    periodTeacherMap.set(key, 1);
                }

                const teacher = this.teachersMap.get(gene.teacherId);
                if (teacher) {
                    // Availability (Hard Constraint - Red)
                    if (teacher.unavailableSlots && teacher.unavailableSlots.includes(gene.periodIndex)) {
                        hardPenalties += 5;
                    }
                    // Avoid Preference (Soft Constraint - Yellow)
                    if (teacher.avoidSlots && teacher.avoidSlots.includes(gene.periodIndex)) {
                        softPenalties += 3; // Light penalty for preferring not to have class
                    }
                    // Classroom Conflict (NEW)
                    if (teacher.classroomId) {
                        const classroomKey = `${gene.periodIndex}-${teacher.classroomId}`;
                        if (periodClassroomMap.has(classroomKey)) {
                            hardPenalties += 20; // Specialized Classroom overlap
                        } else {
                            periodClassroomMap.set(classroomKey, 1);
                        }
                    }
                }
            }

            // Track for Constraints
            if (!classCourseSlots.has(gene.classId)) {
                classCourseSlots.set(gene.classId, new Map());
            }
            const courseMap = classCourseSlots.get(gene.classId);
            if (!courseMap.has(gene.courseId)) {
                courseMap.set(gene.courseId, []);
            }
            courseMap.get(gene.courseId).push(gene.periodIndex);
        }

        // Calculate Soft Penalties (Distribution & Block Periods)
        for (const [classId, courseMap] of classCourseSlots) {
            for (const [courseId, slots] of courseMap) {
                const days = slots.map(s => getDayIndex(s));
                const uniqueDays = new Set(days);

                // Identify Course Name to check for 1+2 (Social/Science)
                const course = this.coursesMap?.get(courseId);
                const courseName = course ? (typeof course.name === 'string' ? course.name : (course.name?.name || '')) : '';
                const isBlockSubject = courseName && (courseName.includes('社') || courseName.includes('自'));

                if (isBlockSubject && slots.length === 3) {
                    // Check for 1+2 pattern: Two consecutive in same day, one in different day
                    // Patterns: [DayA slot i, DayA slot i+1, DayB slot j]

                    // Sort slots to check adjacency
                    const sortedSlots = [...slots].sort((a, b) => a - b);
                    let foundConsecutive = false;

                    for (let i = 0; i < sortedSlots.length - 1; i++) {
                        const s1 = sortedSlots[i];
                        const s2 = sortedSlots[i + 1];
                        // Same day and consecutive (i, i+1)
                        if (getDayIndex(s1) === getDayIndex(s2) && (s2 - s1 === 1)) {
                            // Ensure not crossing lunch (indices 3 and 4 are consecutive but cross lunch in UI)
                            // Slot 3 is Period 4, Slot 4 is Period 5.
                            // In our 0-34 indexing, slots per day are 0,1,2,3,4,5,6
                            // Lunch happens between 3 and 4.
                            if (s1 % 7 !== 3) {
                                foundConsecutive = true;
                                break;
                            }
                        }
                    }

                    if (!foundConsecutive) {
                        softPenalties += 8; // Increased penalty for not having 1+2 block
                    } else if (uniqueDays.size !== 2) {
                        softPenalties += 4; // Penalty for having all 3 on same day or spread across 3 days
                    } else {
                        // Check if the 2 days are consecutive (bad for student memory/fatigue)
                        const daysArr = Array.from(uniqueDays).sort((a, b) => a - b);
                        if (daysArr[1] - daysArr[0] === 1) {
                            softPenalties += 2; // Slight penalty for consecutive days
                        }
                    }
                } else if (course && (course.name.includes('國') || course.name.includes('語'))) {
                    // Chinese (國語) constraint: 1-2 periods per day, spread across 5 days
                    // Count periods per day
                    const dayCount = {};
                    days.forEach(d => {
                        dayCount[d] = (dayCount[d] || 0) + 1;
                    });

                    // Check each day has 1-2 periods (not 0 and not >2)
                    for (const [day, count] of Object.entries(dayCount)) {
                        if (count > 2) {
                            softPenalties += (count - 2) * 10; // Increased penalty for more than 2 per day (was 3)
                        }
                    }

                    // Prefer spreading across more days (at least 4 out of 5)
                    if (slots.length >= 5 && uniqueDays.size < 4) {
                        softPenalties += (4 - uniqueDays.size) * 5; // Increased (was 2)
                    }
                } else if (course && course.name.includes('數')) {
                    // Math (數學) constraint: Maximum 1 period per day
                    const dayCount = {};
                    days.forEach(d => {
                        dayCount[d] = (dayCount[d] || 0) + 1;
                    });

                    // Check no day has more than 1 period
                    for (const [day, count] of Object.entries(dayCount)) {
                        if (count > 1) {
                            softPenalties += (count - 1) * 15; // Increased penalty for math on same day (was 5)
                        }
                    }
                } else {
                    // Regular Distribution: Ideal is days are unique
                    if (uniqueDays.size < slots.length) {
                        softPenalties += (slots.length - uniqueDays.size);
                    }
                }
            }
        }

        return 1000000 - (hardPenalties * 10000) - (softPenalties * 10);
    }
}
