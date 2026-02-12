const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';
const ITERATIONS = 5;

async function measurePrediction() {
    if (!fs.existsSync(IMAGE_PATH)) {
        console.error('Image file not found:', IMAGE_PATH);
        return null;
    }

    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'perf_test.png');

    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}/bff/predict/image`, {
            method: 'POST',
            body: formData
        });
        const end = performance.now();

        if (res.ok) {
            return end - start;
        } else {
            console.log('Request failed:', res.status);
            return null;
        }
    } catch (e) {
        console.log('Request error:', e.message);
        return null;
    }
}

async function main() {
    console.log('Starting Performance Test...');
    console.log('Warming up...');
    await measurePrediction(); // Warmup

    const times = [];
    for (let i = 0; i < ITERATIONS; i++) {
        console.log(`Iteration ${i + 1}/${ITERATIONS}...`);
        const time = await measurePrediction();
        if (time !== null) {
            times.push(time);
            console.log(`  Latency: ${time.toFixed(2)} ms`);
        }
    }

    if (times.length > 0) {
        const min = Math.min(...times);
        const max = Math.max(...times);
        const avg = times.reduce((a, b) => a + b, 0) / times.length;

        console.log('\n--- Results ---');
        console.log(`Min: ${min.toFixed(2)} ms`);
        console.log(`Max: ${max.toFixed(2)} ms`);
        console.log(`Avg: ${avg.toFixed(2)} ms`);
    } else {
        console.log('No successful requests.');
    }
}

main();
