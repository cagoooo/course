import { GeneticAlgorithm } from '../src/algorithms/GeneticAlgorithm.js';

// Mock Data
const mockData = {
    classes: [
        { id: 'C1', name: 'Class 1' },
        { id: 'C2', name: 'Class 2' }
    ],
    // Requirements: Class 1 needs Math (T1) x 5, English (T2) x 5
    requirements: [
        { classId: 'C1', courseId: 'Math', teacherId: 'T1', periodsNeeded: 5 },
        { classId: 'C1', courseId: 'Eng', teacherId: 'T2', periodsNeeded: 5 },
        { classId: 'C2', courseId: 'Math', teacherId: 'T1', periodsNeeded: 5 }, // T1 conflict potential
        { classId: 'C2', courseId: 'Eng', teacherId: 'T2', periodsNeeded: 5 }
    ],
    teachers: [
        { id: 'T1', name: 'Teacher 1', unavailableSlots: [] },
        { id: 'T2', name: 'Teacher 2', unavailableSlots: [] }
    ]
};

console.log('--- Starting GA Test ---');
const ga = new GeneticAlgorithm({
    populationSize: 20,
    mutationRate: 0.05
});

console.log('Initializing Population...');
let pop = ga.initPopulation(mockData);

console.log('Running Evolution (Generation 1-10)...');
for (let i = 1; i <= 10; i++) {
    const result = ga.evolve(pop);
    pop = result.population;

    // Simple Log
    console.log(`Gen ${i}: Best Score = ${result.bestScore}`);

    if (i === 10) {
        console.log('--- Final Result ---');
        console.log('Best Chromosome Length:', result.bestSolution.length);
        // Analyze conflicts?
        // Let's just assume score improvement is good validation for now.
    }
}
