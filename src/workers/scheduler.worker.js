import { GeneticAlgorithm } from '../algorithms/GeneticAlgorithm.js';

let ga = null;
let running = false;

self.onmessage = (e) => {
    const { type, payload } = e.data;

    if (type === 'START') {
        const { data, config } = payload;
        console.log('Worker: Starting GA v2.0...', config);

        ga = new GeneticAlgorithm(config);
        let population = ga.initPopulation(data);
        let generation = 0;
        let lastBestScore = -1;
        running = true;

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
                            bestSolution: result.bestSolution,
                            stagnation: result.stagnation,
                            mutationRate: result.mutationRate
                        }
                    });
                }

                // Auto-Stop: Notify convergence after 200 stagnant generations
                if (result.converged) {
                    self.postMessage({
                        type: 'CONVERGED',
                        payload: {
                            generation,
                            bestScore: result.bestScore,
                            bestSolution: result.bestSolution,
                            message: `🏁 演算已收斂 (連續 ${result.stagnation} 代無進步)，建議檢視結果。`
                        }
                    });
                    running = false; // Auto-stop
                    return;
                }

                setTimeout(tick, 0);
            } catch (err) {
                console.error('Worker Error during evolution:', err);
                running = false;
            }
        };

        setTimeout(tick, 0);
        console.log('Worker: GA v2.0 loop initialized.');
    }

    if (type === 'STOP') {
        running = false;
    }
};
