import { ConstraintChecker } from './ConstraintChecker.js';
import { TOTAL_PERIODS, getDayIndex, isSlotAllowed } from './types.js';

export class GeneticAlgorithm {
    constructor(config) {
        this.config = config || {};
        this.checker = new ConstraintChecker();
        this.populationSize = this.config.populationSize || 50;
        this.mutationRate = this.config.mutationRate || 0.01;
        this.elitism = true;
    }

    // --- Initialization ---

    /**
     * Create initial population.
     * @param {Object} data Source data (classes, courses, requirements)
     */
    initPopulation(data) {
        if (data.teachers) this.checker.setTeachers(data.teachers);
        if (data.courses) this.checker.setCourses(data.courses);
        if (data.classrooms) this.checker.setClassrooms(data.classrooms);

        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            population.push(this.createRandomSchedule(data));
        }
        return population;
    }

    createRandomSchedule(data) {
        const classSchedules = {};
        data.classes.forEach(c => {
            classSchedules[c.id] = new Array(TOTAL_PERIODS).fill(null);
        });

        const classGradeMap = Object.fromEntries(data.classes.map(c => [c.id, c.grade]));

        // First Pass: Place Locked/Fixed Slots
        data.requirements.forEach(req => {
            if (req.fixedSlots && req.fixedSlots.length > 0) {
                req.fixedSlots.forEach(slotIndex => {
                    if (slotIndex >= 0 && slotIndex < TOTAL_PERIODS) {
                        if (classSchedules[req.classId][slotIndex] === null) {
                            classSchedules[req.classId][slotIndex] = {
                                classId: req.classId,
                                periodIndex: slotIndex,
                                courseId: req.courseId,
                                teacherId: req.teacherId,
                                locked: true
                            };
                        }
                    }
                });
            }
        });

        // Second Pass: Randomly place remaining periods
        data.requirements.forEach(req => {
            let count = req.periodsNeeded;
            if (req.fixedSlots) count -= req.fixedSlots.length;
            if (count <= 0) return;

            const grade = classGradeMap[req.classId] || 1;
            const teacher = data.teachers?.find(t => t.id === req.teacherId);
            const unavailable = teacher?.unavailableSlots || [];

            let attempts = 0;
            while (count > 0 && attempts < 1000) {
                attempts++;
                const pIndex = Math.floor(Math.random() * TOTAL_PERIODS);

                // Basic Heuristic: Avoid teacher unavailable slots during initialization if possible
                if (isSlotAllowed(grade, pIndex) && classSchedules[req.classId][pIndex] === null) {
                    // Start with an extra check: try to avoid teacher's busy time in the first 100 attempts
                    if (attempts < 100 && unavailable.includes(pIndex)) continue;

                    classSchedules[req.classId][pIndex] = {
                        classId: req.classId,
                        periodIndex: pIndex,
                        courseId: req.courseId,
                        teacherId: req.teacherId,
                        locked: false
                    };
                    count--;
                }
            }
        });

        // Flatten
        const chromosome = [];
        Object.values(classSchedules).forEach(slots => {
            slots.forEach(s => { if (s) chromosome.push(s); });
        });
        return chromosome;
    }

    // --- Evolution ---

    evolve(population) {
        // 1. Calculate Fitness
        const scored = population.map(p => ({
            dna: p,
            score: this.checker.calculateFitness(p)
        }));

        // Sort desc
        scored.sort((a, b) => b.score - a.score);

        // Elitism: Keep top 1
        const newPop = [scored[0].dna];

        // Fill rest
        while (newPop.length < this.populationSize) {
            const p1 = this.select(scored);
            const p2 = this.select(scored);
            const child = this.crossover(p1, p2);
            this.mutate(child);
            newPop.push(child);
        }

        return {
            bestScore: scored[0].score,
            bestSolution: scored[0].dna,
            population: newPop
        };
    }

    select(scoredPopulation) {
        // Tournament Selection
        const k = 3;
        let best = null;
        for (let i = 0; i < k; i++) {
            const rand = scoredPopulation[Math.floor(Math.random() * scoredPopulation.length)];
            if (!best || rand.score > best.score) best = rand;
        }
        return best.dna;
    }

    /**
     * Class-based Crossover
     * Maintains course counts by inheriting entire class schedules.
     */
    crossover(p1, p2) {
        // Group by classId
        const groupGenes = (dna) => {
            const map = {};
            dna.forEach(g => {
                if (!map[g.classId]) map[g.classId] = [];
                map[g.classId].push({ ...g });
            });
            return map;
        };

        const maps1 = groupGenes(p1);
        const maps2 = groupGenes(p2);
        const childDna = [];

        Object.keys(maps1).forEach(classId => {
            // 50% chance to inherit from p1 or p2
            const source = Math.random() < 0.5 ? maps1 : maps2;
            if (source[classId]) {
                childDna.push(...source[classId]);
            }
        });

        return childDna;
    }

    /**
     * Smart Swap Mutation
     * Swaps two periods within the same class to maintain course counts.
     */
    mutate(chromosome) {
        if (Math.random() >= this.mutationRate) return;

        // Group by class to ensure we swap within same class
        const classIds = [...new Set(chromosome.map(g => g.classId))];
        const targetClassId = classIds[Math.floor(Math.random() * classIds.length)];

        const classGenes = chromosome.filter(g => g.classId === targetClassId);
        if (classGenes.length < 2) return;

        // Pick two genes to swap their periodIndex
        const idxA = Math.floor(Math.random() * classGenes.length);
        let idxB = Math.floor(Math.random() * classGenes.length);
        while (idxB === idxA) idxB = Math.floor(Math.random() * classGenes.length);

        const geneA = classGenes[idxA];
        const geneB = classGenes[idxB];

        if (!geneA.locked && !geneB.locked) {
            const temp = geneA.periodIndex;
            geneA.periodIndex = geneB.periodIndex;
            geneB.periodIndex = temp;
        }
    }
}
