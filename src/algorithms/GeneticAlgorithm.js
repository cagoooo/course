import { ConstraintChecker } from './ConstraintChecker.js';
import { TOTAL_PERIODS, PERIODS_PER_DAY, getDayIndex, getTimeSlotIndex, isSlotAllowed } from './types.js';

export class GeneticAlgorithm {
    constructor(config) {
        this.config = config || {};
        this.checker = new ConstraintChecker();
        this.populationSize = this.config.populationSize || 100;
        this.mutationRate = this.config.mutationRate || 0.02;
        this.baseMutationRate = this.mutationRate;
        this.elitismCount = 3; // Top 3 直接晉級

        // Adaptive Mutation tracking
        this.bestScoreEver = -Infinity;
        this.stagnationCounter = 0;
        this.converged = false;
    }

    // --- Initialization ---

    /**
     * Create initial population.
     * @param {Object} data Source data (classes, courses, requirements)
     */
    initPopulation(data) {
        this.data = data; // Store for directed mutation
        if (data.teachers) this.checker.setTeachers(data.teachers);
        if (data.courses) this.checker.setCourses(data.courses);
        if (data.classrooms) this.checker.setClassrooms(data.classrooms);

        // Build course name lookup for smart seeding
        this.courseNameMap = new Map();
        if (data.courses) {
            data.courses.forEach(c => {
                const name = typeof c.name === 'string' ? c.name : (c.name?.name || '');
                this.courseNameMap.set(c.id, name);
            });
        }

        const population = [];
        for (let i = 0; i < this.populationSize; i++) {
            // 50% Smart Seeding + 50% Random (preserve diversity)
            population.push(this.createSchedule(data, i < this.populationSize / 2));
        }
        return population;
    }

    /**
     * Create a schedule with optional smart seeding.
     * @param {Object} data 
     * @param {boolean} smart Whether to use heuristic placement
     */
    createSchedule(data, smart = false) {
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

        // Second Pass: Place remaining periods
        data.requirements.forEach(req => {
            let count = req.periodsNeeded;
            if (req.fixedSlots) count -= req.fixedSlots.length;
            if (count <= 0) return;

            const grade = classGradeMap[req.classId] || 1;
            const teacher = data.teachers?.find(t => t.id === req.teacherId);
            const unavailable = teacher?.unavailableSlots || [];
            const courseName = this.courseNameMap.get(req.courseId) || '';

            // Build preferred slot list for smart seeding
            let preferredSlots = [];
            if (smart) {
                preferredSlots = this._getPreferredSlots(courseName, grade);
            }

            let attempts = 0;
            while (count > 0 && attempts < 1500) {
                attempts++;
                let pIndex;

                // Smart seeding: try preferred slots first (first 200 attempts)
                if (smart && attempts <= 200 && preferredSlots.length > 0) {
                    pIndex = preferredSlots[Math.floor(Math.random() * preferredSlots.length)];
                } else {
                    pIndex = Math.floor(Math.random() * TOTAL_PERIODS);
                }

                if (isSlotAllowed(grade, pIndex) && classSchedules[req.classId][pIndex] === null) {
                    // Avoid teacher's unavailable time in the first 100 attempts
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

    /**
     * [Smart Seeding] Get preferred slot indices for a course based on rules.
     */
    _getPreferredSlots(courseName, grade) {
        const slots = [];
        for (let i = 0; i < TOTAL_PERIODS; i++) {
            if (!isSlotAllowed(grade, i)) continue;
            const timeSlot = getTimeSlotIndex(i); // 0-6

            if (courseName.includes('國') || courseName.includes('語') || courseName.includes('數')) {
                // Chinese / Math → morning (slots 0-3)
                if (timeSlot <= 3) slots.push(i);
            } else if (courseName.includes('美') || courseName.includes('藝')) {
                // Art → afternoon consecutive (slots 4-5)
                if (timeSlot >= 4) slots.push(i);
            } else if (courseName.includes('體')) {
                // PE → avoid slots 3, 4 (midday heat)
                if (timeSlot !== 3 && timeSlot !== 4) slots.push(i);
            } else {
                // General: all allowed slots
                slots.push(i);
            }
        }
        return slots;
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

        const currentBest = scored[0].score;

        // === Adaptive Mutation ===
        if (currentBest > this.bestScoreEver) {
            this.bestScoreEver = currentBest;
            this.stagnationCounter = 0;
            this.mutationRate = this.baseMutationRate; // Reset to base
            this.converged = false;
        } else {
            this.stagnationCounter++;
        }

        // Escalate mutation when stagnating
        if (this.stagnationCounter > 30) {
            this.mutationRate = Math.min(0.10, this.baseMutationRate * 2); // 2x
        }
        if (this.stagnationCounter > 80) {
            this.mutationRate = Math.min(0.20, this.baseMutationRate * 4); // 4x aggressive
        }
        if (this.stagnationCounter > 150) {
            this.mutationRate = Math.min(0.35, this.baseMutationRate * 7); // 7x mega shake
        }
        if (this.stagnationCounter >= 250) {
            this.converged = true;
        }

        // === Enhanced Elitism: Keep Top N ===
        const newPop = [];
        for (let i = 0; i < Math.min(this.elitismCount, scored.length); i++) {
            newPop.push(scored[i].dna);
        }

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
            population: newPop,
            converged: this.converged,
            stagnation: this.stagnationCounter,
            mutationRate: this.mutationRate
        };
    }

    select(scoredPopulation) {
        // Tournament Selection (k=5 for stronger selection pressure)
        const k = 5;
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
            const source = Math.random() < 0.5 ? maps1 : maps2;
            if (source[classId]) {
                childDna.push(...source[classId]);
            }
        });

        return childDna;
    }

    /**
     * [GA v3.0] Hybrid Mutation: 30% Teacher Repair + 20% Math Repair + 25% Directed + 25% Random
     */
    mutate(chromosome) {
        /**
         * [GA v3.1] Hybrid Mutation:
         * 30% Teacher Repair (Global)
         * 15% Math Repair (Class)
         * 15% Chinese Repair (Class)
         * 20% Directed (Class)
         * 20% Random (Class)
         */
        mutate(chromosome) {
            if (Math.random() >= this.mutationRate) return;

            const roll = Math.random();

            // 1. Teacher Conflict Repair (Global) - Highest Priority
            if (roll < 0.3) {
                if (this._repairTeacherConflicts(chromosome)) return;
            }

            // Per-class mutations
            const classIds = [...new Set(chromosome.map(g => g.classId))];
            const targetClassId = classIds[Math.floor(Math.random() * classIds.length)];
            const classGenes = chromosome.filter(g => g.classId === targetClassId && !g.locked);
            if (classGenes.length < 2) return;

            // renormalized roll for remaining 70%
            const localRoll = (roll - 0.3) / 0.7; // 0.0 to 1.0

            if (localRoll < 0.25) { // ~17.5% total (Math)
                if (!this._repairMathViolations(classGenes)) this._directedMutate(classGenes);
            } else if (localRoll < 0.5) { // ~17.5% total (Chinese)
                if (!this._repairChineseViolations(classGenes)) this._directedMutate(classGenes);
            } else if (localRoll < 0.8) { // ~21% total (Directed)
                this._directedMutate(classGenes);
            } else { // ~20% total (Random)
                this._randomSwap(classGenes);
            }
        }

        /** [Teacher Repair] Fix teacher double-bookings across all classes. */
        _repairTeacherConflicts(chromosome) {
            // Build teacher → period → genes map
            const teacherSlots = {};
            chromosome.forEach(g => {
                if (!g.teacherId) return;
                const key = `${g.teacherId}_${g.periodIndex}`;
                if (!teacherSlots[key]) teacherSlots[key] = [];
                teacherSlots[key].push(g);
            });

            // Find conflicts
            for (const [, genes] of Object.entries(teacherSlots)) {
                if (genes.length <= 1) continue;

                // Found a conflict! Move one gene to a free slot in its class
                const moveGene = genes.find(g => !g.locked) || genes[0];
                if (moveGene.locked) continue;

                // Find all occupied slots in this class
                const classGenes = chromosome.filter(g => g.classId === moveGene.classId);
                const occupiedSlots = new Set(classGenes.map(g => g.periodIndex));

                // Find free morning slots first, then any free slot
                const freeSlots = [];
                for (let i = 0; i < 35; i++) {
                    if (!occupiedSlots.has(i)) freeSlots.push(i);
                }

                if (freeSlots.length > 0) {
                    // Prefer swapping with another gene rather than moving to empty
                    const swapCandidates = classGenes.filter(g => {
                        if (g === moveGene || g.locked) return false;
                        // Check if swapping would NOT create a new teacher conflict
                        const wouldConflict = chromosome.some(other =>
                            other !== moveGene && other !== g &&
                            other.teacherId === moveGene.teacherId &&
                            other.periodIndex === g.periodIndex
                        );
                        return !wouldConflict;
                    });

                    if (swapCandidates.length > 0) {
                        const swap = swapCandidates[Math.floor(Math.random() * swapCandidates.length)];
                        const temp = moveGene.periodIndex;
                        moveGene.periodIndex = swap.periodIndex;
                        swap.periodIndex = temp;
                        return true;
                    }
                }
            }
            return false;
        }

        /** [Chinese Repair] Fix Chinese > 2 per day violations. */
        _repairChineseViolations(classGenes) {
            const chineseGenes = classGenes.filter(g => {
                const n = this.courseNameMap?.get(g.courseId) || '';
                return n.includes('國') || n.includes('語');
            });
            if (chineseGenes.length === 0) return false;

            // Group by day
            const dayMap = {};
            chineseGenes.forEach(g => {
                const d = getDayIndex(g.periodIndex);
                if (!dayMap[d]) dayMap[d] = [];
                dayMap[d].push(g);
            });

            // Find days with > 2 Chinese classes
            for (const [day, genes] of Object.entries(dayMap)) {
                if (genes.length > 2) {
                    // Determine which days have < 2 Chinese classes
                    // We need to move genes[2], genes[3] etc. to other days
                    const validDestDays = [0, 1, 2, 3, 4].filter(d => {
                        const count = (dayMap[d] || []).length;
                        return d !== parseInt(day) && count < 2;
                    });

                    if (validDestDays.length > 0) {
                        const geneToMove = genes[2]; // Move the 3rd one
                        // Find a swap candidate in a valid destination day
                        // Prefer swapping with non-core subject
                        const targetDay = validDestDays[Math.floor(Math.random() * validDestDays.length)];

                        const candidates = classGenes.filter(g => {
                            if (g.locked) return false;
                            if (getDayIndex(g.periodIndex) !== targetDay) return false;
                            const n = this.courseNameMap?.get(g.courseId) || '';
                            return !n.includes('國') && !n.includes('語') && !n.includes('數'); // Don't swap with Math/Chinese
                        });

                        if (candidates.length > 0) {
                            const swap = candidates[Math.floor(Math.random() * candidates.length)];
                            const t = geneToMove.periodIndex;
                            geneToMove.periodIndex = swap.periodIndex;
                            swap.periodIndex = t;
                            return true;
                        }
                    }
                }
            }
            return false;
        }

        /** [Math Repair] Fix math afternoon or same-day violations. */
        _repairMathViolations(classGenes) {
            const mathGenes = classGenes.filter(g => {
                const n = this.courseNameMap?.get(g.courseId) || '';
                return n.includes('數');
            });
            if (mathGenes.length === 0) return false;

            // Fix 1: afternoon math → swap to morning
            const badMath = mathGenes.find(g => getTimeSlotIndex(g.periodIndex) >= 4);
            if (badMath) {
                const ok = classGenes.filter(g => {
                    if (g.locked || getTimeSlotIndex(g.periodIndex) >= 4) return false;
                    const n = this.courseNameMap?.get(g.courseId) || '';
                    if (n.includes('數')) return false;
                    if (n.includes('體') && (getTimeSlotIndex(badMath.periodIndex) === 3 || getTimeSlotIndex(badMath.periodIndex) === 4)) return false;
                    return true;
                });
                if (ok.length > 0) {
                    const s = ok[Math.floor(Math.random() * ok.length)];
                    const t = badMath.periodIndex; badMath.periodIndex = s.periodIndex; s.periodIndex = t;
                    return true;
                }
            }

            // Fix 2: same-day duplicates → move to unused day morning
            const mathDays = {};
            mathGenes.forEach(g => { const d = getDayIndex(g.periodIndex); (mathDays[d] = mathDays[d] || []).push(g); });
            for (const [day, genes] of Object.entries(mathDays)) {
                if (genes.length > 1) {
                    const usedDays = new Set(mathGenes.map(g => getDayIndex(g.periodIndex)));
                    const move = genes[1];
                    const ok = classGenes.filter(g => {
                        if (g.locked) return false;
                        const d = getDayIndex(g.periodIndex);
                        if (d === parseInt(day) || usedDays.has(d)) return false;
                        if (getTimeSlotIndex(g.periodIndex) >= 4) return false;
                        const n = this.courseNameMap?.get(g.courseId) || '';
                        return !n.includes('數');
                    });
                    if (ok.length > 0) {
                        const s = ok[Math.floor(Math.random() * ok.length)];
                        const t = move.periodIndex; move.periodIndex = s.periodIndex; s.periodIndex = t;
                        return true;
                    }
                }
            }
            return false;
        }

        /** [Directed Mutation] Fix worst penalty gene. */
        _directedMutate(classGenes) {
            let worstGene = null, worstPenalty = -1;
            for (const gene of classGenes) {
                const cn = this.courseNameMap?.get(gene.courseId) || '';
                const ts = getTimeSlotIndex(gene.periodIndex);
                let p = 0;
                if (cn.includes('數') && ts >= 4) p += 50000;
                if (cn.includes('數')) {
                    const d = getDayIndex(gene.periodIndex);
                    if (classGenes.some(g => g !== gene && getDayIndex(g.periodIndex) === d && (this.courseNameMap?.get(g.courseId) || '').includes('數'))) p += 50000;
                }
                if (cn.includes('體') && (ts === 3 || ts === 4)) p += 5000;
                // Chinese afternoon (Soft)
                if ((cn.includes('國') || cn.includes('語')) && ts >= 4) p += 50;
                // Chinese > 2 per day (HARD)
                if (cn.includes('國') || cn.includes('語')) {
                    const d = getDayIndex(gene.periodIndex);
                    const dayCount = classGenes.filter(g => getDayIndex(g.periodIndex) === d && ((this.courseNameMap?.get(g.courseId) || '').includes('國') || (this.courseNameMap?.get(g.courseId) || '').includes('語'))).length;
                    if (dayCount > 2) p += 50000;
                }
                // Art morning
                if ((cn.includes('美') || cn.includes('藝')) && ts < 4) p += 50;

                if (p > worstPenalty) { worstPenalty = p; worstGene = gene; }
            }
            if (!worstGene || worstPenalty <= 0) { this._randomSwap(classGenes); return; }

            const candidates = classGenes.filter(g => {
                if (g === worstGene || g.locked) return false;
                const cn = this.courseNameMap?.get(g.courseId) || '';
                const wts = getTimeSlotIndex(worstGene.periodIndex);
                if (cn.includes('數') && wts >= 4) return false;
                if ((cn.includes('國') || cn.includes('語')) && wts >= 4) return false;
                if (cn.includes('體') && (wts === 3 || wts === 4)) return false;
                return true;
            });
            if (candidates.length > 0) {
                const s = candidates[Math.floor(Math.random() * candidates.length)];
                const t = worstGene.periodIndex; worstGene.periodIndex = s.periodIndex; s.periodIndex = t;
            }
        }

        /** Classic random swap mutation. */
        _randomSwap(classGenes) {
            const a = Math.floor(Math.random() * classGenes.length);
            let b = Math.floor(Math.random() * classGenes.length);
            let s = 0;
            while (b === a && s < 20) { b = Math.floor(Math.random() * classGenes.length); s++; }
            if (!classGenes[a].locked && !classGenes[b].locked) {
                const t = classGenes[a].periodIndex;
                classGenes[a].periodIndex = classGenes[b].periodIndex;
                classGenes[b].periodIndex = t;
            }
        }
    }
