import { describe, it, expect, beforeEach } from 'vitest';
import { ConstraintChecker } from './ConstraintChecker';

describe('ConstraintChecker', () => {
    let checker;
    const TOTAL_PERIODS = 35; // 5 days * 7 periods

    // Mock Data
    const teachers = [
        { id: 't1', name: 'Teacher A', unavailableSlots: [0, 1], avoidSlots: [2], classroomId: null },
        { id: 't2', name: 'Teacher B (Art)', unavailableSlots: [], classroomId: 'r1' }
    ];

    const courses = [
        { id: 'c1', name: '國語' },
        { id: 'c2', name: '數學' },
        { id: 'c3', name: '美勞' },
        { id: 'c4', name: '社會' }
    ];

    const classrooms = [
        { id: 'r1', name: 'Art Room' }
    ];

    beforeEach(() => {
        checker = new ConstraintChecker();
        checker.setTeachers(teachers);
        checker.setCourses(courses);
        checker.setClassrooms(classrooms);
    });

    it('should return base score for empty schedule', () => {
        const chromosome = [];
        const score = checker.calculateFitness(chromosome);
        expect(score).toBe(1000000);
    });

    describe('Hard Constraints', () => {
        it('should penalize teacher double booking heavily', () => {
            // Teacher t1 assigned to two classes at period 10
            const chromosome = [
                { classId: 'cls1', teacherId: 't1', periodIndex: 10, courseId: 'c1' },
                { classId: 'cls2', teacherId: 't1', periodIndex: 10, courseId: 'c1' }
            ];
            const score = checker.calculateFitness(chromosome);
            // 2nd entry causes conflict: Hard penalty = 1 * 10000
            expect(score).toBe(1000000 - 10000);
        });

        it('should penalize teacher unavailable slots', () => {
            // Teacher t1 is unavailable at slot 0
            const chromosome = [
                { classId: 'cls1', teacherId: 't1', periodIndex: 0, courseId: 'c1' }
            ];
            const score = checker.calculateFitness(chromosome);
            // Unavailable penalty = 5 * 10000
            expect(score).toBe(1000000 - 50000);
        });

        it('should penalize classroom conflict', () => {
            // Teacher t2 is bound to classroom r1
            // Two t2's classes at same time (also teacher conflict, but let's assume we want to test classroom logic specifically?)
            // Actually, if it's the SAME teacher, it triggers Teacher Conflict first.
            // But if different teachers share a classroom?
            // The logic: 
            // if (teacher.classroomId) { ... check periodClassroomMap }
            // So if Teacher A and Teacher B both use Room R1, and scheduled at same time.

            // Let's adjust mock for this test
            const t3 = { id: 't3', name: 'Teacher C', classroomId: 'r1' };
            checker.setTeachers([...teachers, t3]);

            const chromosome = [
                { classId: 'cls1', teacherId: 't2', periodIndex: 20, courseId: 'c3' },
                { classId: 'cls2', teacherId: 't3', periodIndex: 20, courseId: 'c3' }
            ];

            const score = checker.calculateFitness(chromosome);
            // Both use r1 at period 20.
            // First entry: Map set.
            // Second entry: Map conflict.
            // Score should reduce.
            expect(score).toBeLessThan(1000000);
        });
    });

    describe('Soft Constraints', () => {
        describe('Chinese (國語)', () => {
            it('should penalize > 2 periods per day', () => {
                // Schedule 3 periods of Chinese on Day 1 (slots 10, 11, 12) - Safe from unavailable
                const chromosome = [
                    { classId: 'cls1', teacherId: 't1', periodIndex: 10, courseId: 'c1' },
                    { classId: 'cls1', teacherId: 't1', periodIndex: 11, courseId: 'c1' },
                    { classId: 'cls1', teacherId: 't1', periodIndex: 12, courseId: 'c1' }
                ];
                const score = checker.calculateFitness(chromosome);
                // 3 periods on same day. Count > 2 is 1. Penalty = 1 * 2000 * 10 (soft multiplier) = 20000
                // Base - 20000
                expect(score).toBe(1000000 - 20000);
            });
        });

        describe('Math (數學)', () => {
            it('should penalize > 1 period per day', () => {
                // Schedule 2 periods of Math on Day 1
                const chromosome = [
                    { classId: 'cls1', teacherId: 't1', periodIndex: 10, courseId: 'c2' },
                    { classId: 'cls1', teacherId: 't1', periodIndex: 11, courseId: 'c2' }
                ];
                const score = checker.calculateFitness(chromosome);
                // Count > 1 is 1. Penalty = 1 * 2000 * 10 = 20000
                expect(score).toBe(1000000 - 20000);
            });
        });

        describe('Art (美勞)', () => {
            it('should NOT penalize if afternoon and consecutive', () => {
                // Slots 25, 26 (Day 3 Afternoon)
                // 3 * 7 = 21 (Day 3 Start). 21-24 Morning. 25-27 Afternoon.
                const chromosome = [
                    { classId: 'cls1', teacherId: 't2', periodIndex: 25, courseId: 'c3' },
                    { classId: 'cls1', teacherId: 't2', periodIndex: 26, courseId: 'c3' }
                ];
                const score = checker.calculateFitness(chromosome);
                expect(score).toBe(1000000);
            });

            it('should penalize if Morning', () => {
                // Slot 21, 22 (Day 3 Morning)
                // Day 3 starts at 21. periodIndex % 7 = 0, 1. (Morning)
                const chromosome = [
                    { classId: 'cls1', teacherId: 't2', periodIndex: 21, courseId: 'c3' },
                    { classId: 'cls1', teacherId: 't2', periodIndex: 22, courseId: 'c3' }
                ];
                // Morning used to penalize? 
                // Logic: if (s1 % 7 < 4 || s2 % 7 < 4) softPenalties += 50
                // 50 * 10 = 500
                const score = checker.calculateFitness(chromosome);
                expect(score).toBe(1000000 - 500);
            });

            it('should penalize if NOT consecutive', () => {
                // Slot 25, 27 (Gap)
                const chromosome = [
                    { classId: 'cls1', teacherId: 't2', periodIndex: 25, courseId: 'c3' },
                    { classId: 'cls1', teacherId: 't2', periodIndex: 27, courseId: 'c3' }
                ];
                // Penalties:
                // Afternoon? 25%7=4 (Ok), 27%7=6 (Ok).
                // Consecutive? No. s2 - s1 = 2.
                // Penalty += 30 * 10 = 300.
                const score = checker.calculateFitness(chromosome);
                expect(score).toBe(1000000 - 300);
            });
        });
    });
});
