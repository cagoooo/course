import { getDayIndex, getTimeSlotIndex, PERIODS_PER_DAY, TOTAL_PERIODS } from './types.js';

const DAY_NAMES = ['週一', '週二', '週三', '週四', '週五'];
const PERIOD_NAMES = ['第一節', '第二節', '第三節', '第四節', '第五節', '第六節', '第七節'];

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

    _getCourseName(courseId) {
        const course = this.coursesMap?.get(courseId);
        return course ? (typeof course.name === 'string' ? course.name : (course.name?.name || '')) : '';
    }

    _getTeacherName(teacherId) {
        const teacher = this.teachersMap?.get(teacherId);
        return teacher ? (typeof teacher.name === 'string' ? teacher.name : (teacher.name?.name || teacherId)) : teacherId;
    }

    _slotLabel(periodIndex) {
        return `${DAY_NAMES[getDayIndex(periodIndex)]}${PERIOD_NAMES[getTimeSlotIndex(periodIndex)]}`;
    }

    /**
     * @param {import('./types').Chromosome} chromosome 
     * @returns {number} fitness score
     */
    calculateFitness(chromosome) {
        let hardPenalties = 0;
        let softPenalties = 0;

        const periodTeacherMap = new Map();
        const periodClassroomMap = new Map();
        const classCourseSlots = new Map();

        // === Pass 1: Per-gene validation ===
        for (const gene of chromosome) {
            if (!gene.teacherId) continue;

            if (gene.teacherId !== '0' && gene.teacherId !== '1') {
                const key = `${gene.periodIndex}-${gene.teacherId}`;
                if (periodTeacherMap.has(key)) {
                    hardPenalties++;
                } else {
                    periodTeacherMap.set(key, 1);
                }

                const teacher = this.teachersMap.get(gene.teacherId);
                if (teacher) {
                    if (teacher.unavailableSlots && teacher.unavailableSlots.includes(gene.periodIndex)) {
                        hardPenalties += 5;
                    }
                    if (teacher.avoidSlots && teacher.avoidSlots.includes(gene.periodIndex)) {
                        softPenalties += 3;
                    }
                    if (teacher.classroomId) {
                        const classroomKey = `${gene.periodIndex}-${teacher.classroomId}`;
                        if (periodClassroomMap.has(classroomKey)) {
                            hardPenalties += 20;
                        } else {
                            periodClassroomMap.set(classroomKey, 1);
                        }
                    }
                }
            }

            if (!classCourseSlots.has(gene.classId)) {
                classCourseSlots.set(gene.classId, new Map());
            }
            const courseMap = classCourseSlots.get(gene.classId);
            if (!courseMap.has(gene.courseId)) {
                courseMap.set(gene.courseId, []);
            }
            courseMap.get(gene.courseId).push(gene.periodIndex);
        }

        // === Pass 2: Distribution & subject-specific rules ===
        for (const [classId, courseMap] of classCourseSlots) {
            for (const [courseId, slots] of courseMap) {
                const days = slots.map(s => getDayIndex(s));
                const uniqueDays = new Set(days);
                const courseName = this._getCourseName(courseId);
                const isBlockSubject = courseName && (courseName.includes('社') || courseName.includes('自'));
                const isArtSubject = courseName && (courseName.includes('美') || courseName.includes('藝'));
                const isPESubject = courseName && courseName.includes('體');

                if (isPESubject) {
                    slots.forEach(s => {
                        const timeSlot = s % 7;
                        if (timeSlot === 3 || timeSlot === 4) {
                            softPenalties += 5000;
                        }
                    });
                }

                if (isBlockSubject && slots.length === 3) {
                    const sortedSlots = [...slots].sort((a, b) => a - b);
                    let foundConsecutive = false;
                    for (let i = 0; i < sortedSlots.length - 1; i++) {
                        const s1 = sortedSlots[i];
                        const s2 = sortedSlots[i + 1];
                        if (getDayIndex(s1) === getDayIndex(s2) && (s2 - s1 === 1) && (s1 % 7 !== 3)) {
                            foundConsecutive = true;
                            break;
                        }
                    }
                    if (!foundConsecutive) {
                        softPenalties += 8;
                    } else if (uniqueDays.size !== 2) {
                        softPenalties += 4;
                    } else {
                        const daysArr = Array.from(uniqueDays).sort((a, b) => a - b);
                        if (daysArr[1] - daysArr[0] === 1) {
                            softPenalties += 2;
                        }
                    }
                } else if (isArtSubject && slots.length === 2) {
                    const sortedSlots = [...slots].sort((a, b) => a - b);
                    const s1 = sortedSlots[0];
                    const s2 = sortedSlots[1];
                    if (s1 % 7 < 4 || s2 % 7 < 4) {
                        softPenalties += 50;
                    }
                    if (getDayIndex(s1) !== getDayIndex(s2) || (s2 - s1 !== 1) || (s1 % 7 === 3)) {
                        softPenalties += 30;
                    }
                } else if (courseName.includes('國') || courseName.includes('語')) {
                    const dayCount = {};
                    days.forEach(d => { dayCount[d] = (dayCount[d] || 0) + 1; });
                    for (const [day, count] of Object.entries(dayCount)) {
                        if (count > 2) softPenalties += (count - 2) * 2000;
                    }
                    if (slots.length >= 5 && uniqueDays.size < 5) {
                        softPenalties += (5 - uniqueDays.size) * 200;
                    }
                    slots.forEach(s => {
                        if ((s % 7) >= 4) softPenalties += 50;
                    });
                } else if (courseName.includes('數')) {
                    // [HARD] 數學：一天只能一節 → hardPenalties
                    const dayCount = {};
                    days.forEach(d => { dayCount[d] = (dayCount[d] || 0) + 1; });
                    for (const [day, count] of Object.entries(dayCount)) {
                        if (count > 1) hardPenalties += (count - 1) * 5;
                    }
                    // [HARD] 數學：禁止排在下午（第5-7節）→ hardPenalties
                    slots.forEach(s => {
                        if ((s % 7) >= 4) hardPenalties += 5;
                    });
                } else {
                    if (uniqueDays.size < slots.length) {
                        softPenalties += (slots.length - uniqueDays.size);
                    }
                }
            }
        }

        // === Pass 3: Teacher Fatigue (Consecutive Periods) ===
        softPenalties += this._calcTeacherFatigue(chromosome, false).totalPenalty;

        return 1000000 - (hardPenalties * 10000) - (softPenalties * 10);
    }

    // =========================================================================
    //  [Phase 1.2] Teacher Fatigue Detection
    // =========================================================================

    /**
     * Calculate teacher fatigue penalties for consecutive periods.
     * @returns {{ totalPenalty: number, issues: Array }}
     */
    _calcTeacherFatigue(chromosome, detailed = false) {
        // Group genes by teacherId -> dayIndex -> [timeSlots]
        const teacherDaySlots = new Map();
        for (const gene of chromosome) {
            if (!gene.teacherId || gene.teacherId === '0' || gene.teacherId === '1') continue;
            if (!teacherDaySlots.has(gene.teacherId)) {
                teacherDaySlots.set(gene.teacherId, new Map());
            }
            const dayMap = teacherDaySlots.get(gene.teacherId);
            const day = getDayIndex(gene.periodIndex);
            if (!dayMap.has(day)) dayMap.set(day, []);
            dayMap.get(day).push(getTimeSlotIndex(gene.periodIndex));
        }

        let totalPenalty = 0;
        const issues = [];

        for (const [teacherId, dayMap] of teacherDaySlots) {
            for (const [day, timeSlots] of dayMap) {
                const sorted = [...timeSlots].sort((a, b) => a - b);
                let consecutive = 1;
                let streakStart = sorted[0];

                for (let i = 1; i <= sorted.length; i++) {
                    if (i < sorted.length && sorted[i] === sorted[i - 1] + 1) {
                        consecutive++;
                    } else {
                        // Streak ended
                        if (consecutive >= 4) {
                            totalPenalty += (consecutive - 3) * 500;
                            if (detailed) {
                                issues.push({
                                    type: 'fatigue',
                                    severity: consecutive >= 5 ? 'hard' : 'soft',
                                    penalty: (consecutive - 3) * 500,
                                    teacherId,
                                    teacherName: this._getTeacherName(teacherId),
                                    day: DAY_NAMES[day],
                                    detail: `連續上 ${consecutive} 節課 (${PERIOD_NAMES[streakStart]}-${PERIOD_NAMES[streakStart + consecutive - 1]})`,
                                    description: `⚠️ ${this._getTeacherName(teacherId)} ${DAY_NAMES[day]}連續上 ${consecutive} 節課`
                                });
                            }
                        } else if (consecutive === 3) {
                            totalPenalty += 20;
                            if (detailed) {
                                issues.push({
                                    type: 'fatigue',
                                    severity: 'warning',
                                    penalty: 20,
                                    teacherId,
                                    teacherName: this._getTeacherName(teacherId),
                                    day: DAY_NAMES[day],
                                    detail: `連續上 3 節課 (${PERIOD_NAMES[streakStart]}-${PERIOD_NAMES[streakStart + 2]})`,
                                    description: `💡 ${this._getTeacherName(teacherId)} ${DAY_NAMES[day]}連續上 3 節課`
                                });
                            }
                        }
                        if (i < sorted.length) {
                            consecutive = 1;
                            streakStart = sorted[i];
                        }
                    }
                }
            }
        }

        return { totalPenalty, issues };
    }

    // =========================================================================
    //  [Phase 1.1] Quality Analysis Report
    // =========================================================================

    /**
     * Analyze a chromosome and return detailed penalty breakdown.
     * This is NOT called during evolution (too expensive),
     * only when the user wants to see the report.
     * @param {import('./types').Chromosome} chromosome
     * @returns {{ score: number, penalties: Array, summary: Object }}
     */
    analyzePenalties(chromosome) {
        const penalties = [];

        const periodTeacherMap = new Map();
        const periodClassroomMap = new Map();
        const classCourseSlots = new Map();

        // === Pass 1: Per-gene ===
        for (const gene of chromosome) {
            if (!gene.teacherId) continue;

            if (gene.teacherId !== '0' && gene.teacherId !== '1') {
                const key = `${gene.periodIndex}-${gene.teacherId}`;
                if (periodTeacherMap.has(key)) {
                    penalties.push({
                        type: 'conflict',
                        severity: 'hard',
                        penalty: 10000,
                        description: `🔴 教師衝突：${this._getTeacherName(gene.teacherId)} 在${this._slotLabel(gene.periodIndex)}有兩節課重疊`,
                        classId: gene.classId,
                        teacherId: gene.teacherId
                    });
                } else {
                    periodTeacherMap.set(key, 1);
                }

                const teacher = this.teachersMap.get(gene.teacherId);
                if (teacher) {
                    if (teacher.unavailableSlots && teacher.unavailableSlots.includes(gene.periodIndex)) {
                        penalties.push({
                            type: 'unavailable',
                            severity: 'hard',
                            penalty: 50000,
                            description: `🔴 ${this._getTeacherName(gene.teacherId)} 在${this._slotLabel(gene.periodIndex)}無法授課（已標記為不可用）`,
                            classId: gene.classId,
                            teacherId: gene.teacherId
                        });
                    }
                    if (teacher.avoidSlots && teacher.avoidSlots.includes(gene.periodIndex)) {
                        penalties.push({
                            type: 'avoid',
                            severity: 'soft',
                            penalty: 30,
                            description: `🟡 ${this._getTeacherName(gene.teacherId)} 在${this._slotLabel(gene.periodIndex)}偏好不排課`,
                            classId: gene.classId,
                            teacherId: gene.teacherId
                        });
                    }
                    if (teacher.classroomId) {
                        const classroomKey = `${gene.periodIndex}-${teacher.classroomId}`;
                        if (periodClassroomMap.has(classroomKey)) {
                            penalties.push({
                                type: 'classroom',
                                severity: 'hard',
                                penalty: 200000,
                                description: `🔴 教室衝突：${this._slotLabel(gene.periodIndex)}有多門課使用同一間專科教室`,
                                classId: gene.classId,
                                teacherId: gene.teacherId
                            });
                        } else {
                            periodClassroomMap.set(classroomKey, 1);
                        }
                    }
                }
            }

            if (!classCourseSlots.has(gene.classId)) classCourseSlots.set(gene.classId, new Map());
            const courseMap = classCourseSlots.get(gene.classId);
            if (!courseMap.has(gene.courseId)) courseMap.set(gene.courseId, []);
            courseMap.get(gene.courseId).push(gene.periodIndex);
        }

        // === Pass 2: Subject-specific ===
        for (const [classId, courseMap] of classCourseSlots) {
            for (const [courseId, slots] of courseMap) {
                const courseName = this._getCourseName(courseId);
                const isPESubject = courseName && courseName.includes('體');
                const isChinese = courseName && (courseName.includes('國') || courseName.includes('語'));
                const isMath = courseName && courseName.includes('數');
                const isArtSubject = courseName && (courseName.includes('美') || courseName.includes('藝'));

                // PE midday
                if (isPESubject) {
                    slots.forEach(s => {
                        const ts = s % 7;
                        if (ts === 3 || ts === 4) {
                            penalties.push({
                                type: 'pe_midday',
                                severity: 'soft',
                                penalty: 50000,
                                description: `🟠 ${classId}：體育課排在${this._slotLabel(s)}（中午太熱）`,
                                classId
                            });
                        }
                    });
                }

                // Math afternoon (HARD)
                if (isMath) {
                    slots.forEach(s => {
                        if ((s % 7) >= 4) {
                            penalties.push({
                                type: 'math_afternoon',
                                severity: 'hard',
                                penalty: 50000,
                                description: `🔴 ${classId}：數學排在${this._slotLabel(s)}（數學必須排上午）`,
                                classId
                            });
                        }
                    });
                    // Math same-day duplicate
                    const days = slots.map(s => getDayIndex(s));
                    const dayCount = {};
                    days.forEach(d => { dayCount[d] = (dayCount[d] || 0) + 1; });
                    for (const [day, count] of Object.entries(dayCount)) {
                        if (count > 1) {
                            penalties.push({
                                type: 'math_duplicate',
                                severity: 'hard',
                                penalty: 50000,
                                description: `🔴 ${classId}：數學在${DAY_NAMES[day]}排了 ${count} 節（一天只能一節）`,
                                classId
                            });
                        }
                    }
                }

                // Chinese afternoon (soft)
                if (isChinese) {
                    slots.forEach(s => {
                        if ((s % 7) >= 4) {
                            penalties.push({
                                type: 'core_afternoon',
                                severity: 'soft',
                                penalty: 500,
                                description: `🟡 ${classId}：${courseName}排在${this._slotLabel(s)}（建議排上午）`,
                                classId
                            });
                        }
                    });
                }

                // Art in morning
                if (isArtSubject) {
                    slots.forEach(s => {
                        if ((s % 7) < 4) {
                            penalties.push({
                                type: 'art_morning',
                                severity: 'soft',
                                penalty: 500,
                                description: `🟡 ${classId}：${courseName}排在${this._slotLabel(s)}（建議排下午連堂）`,
                                classId
                            });
                        }
                    });
                }
            }
        }

        // === Pass 3: Teacher fatigue ===
        const fatigue = this._calcTeacherFatigue(chromosome, true);
        penalties.push(...fatigue.issues);

        // Sort by penalty desc
        penalties.sort((a, b) => b.penalty - a.penalty);

        // Summary
        const hardCount = penalties.filter(p => p.severity === 'hard').length;
        const softCount = penalties.filter(p => p.severity === 'soft').length;
        const warningCount = penalties.filter(p => p.severity === 'warning').length;
        const fatigueCount = penalties.filter(p => p.type === 'fatigue').length;

        return {
            score: this.calculateFitness(chromosome),
            penalties,
            summary: {
                total: penalties.length,
                hard: hardCount,
                soft: softCount,
                warning: warningCount,
                fatigue: fatigueCount
            }
        };
    }
}
