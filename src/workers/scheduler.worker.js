import { GeneticAlgorithm } from '../algorithms/GeneticAlgorithm.js';

let ga = null;
let running = false;

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'START') {
        const { data, config } = payload;
        console.log('Worker: Starting GA...', config);

        console.log('Worker: Initializing GA engine...');
        ga = new GeneticAlgorithm(config);
        // Initialize population and generation when starting
        let population = ga.initPopulation(data); // Fix method name and add let
        let generation = 0;
        let lastBestScore = -1;
        running = true; // Set running to true when starting

        const tick = () => {
            if (!running) return;

            try {
                const result = ga.evolve(population);
                population = result.population;
                generation++;

                // Notify UI every 10 generations, or if a new best score is found
                if (generation % 10 === 0 || result.bestScore > lastBestScore) {
                    lastBestScore = result.bestScore;
                    self.postMessage({
                        type: 'PROGRESS',
                        payload: {
                            generation,
                            bestScore: result.bestScore,
                            bestSolution: result.bestSolution
                        }
                    });
                }

                setTimeout(tick, 0);
            } catch (err) {
                console.error('Worker Error during evolution:', err);
                running = false;
            }
        };

        // Start the evolution process
        setTimeout(tick, 0);
        console.log('Worker: Loop initialized.');
    }
};
