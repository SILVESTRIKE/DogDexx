const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';
const CONCURRENT_REQUESTS = 20;

async function sendRequest(id) {
    if (!fs.existsSync(IMAGE_PATH)) return { id, status: 'error', time: 0 };

    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'load_test.png');

    const start = performance.now();
    try {
        const res = await fetch(`${BASE_URL}/bff/predict/image`, {
            method: 'POST',
            body: formData
        });
        const end = performance.now();
        return { id, status: res.status, time: end - start };
    } catch (e) {
        return { id, status: 'error', time: 0 };
    }
}

async function main() {
    console.log(`Starting Load Test with ${CONCURRENT_REQUESTS} concurrent requests...`);

    const promises = [];
    const startTotal = performance.now();

    for (let i = 0; i < CONCURRENT_REQUESTS; i++) {
        promises.push(sendRequest(i + 1));
    }

    const results = await Promise.all(promises);
    const endTotal = performance.now();
    const totalTime = (endTotal - startTotal) / 1000; // seconds

    const success = results.filter(r => r.status === 200).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    const errors = results.filter(r => r.status !== 200 && r.status !== 429).length;

    console.log('\n--- Load Test Results ---');
    console.log(`Total Requests: ${CONCURRENT_REQUESTS}`);
    console.log(`Success: ${success}`);
    console.log(`Rate Limited (429): ${rateLimited}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total Time: ${totalTime.toFixed(2)} s`);
    console.log(`Throughput: ${(CONCURRENT_REQUESTS / totalTime).toFixed(2)} req/s`);
}

main();
