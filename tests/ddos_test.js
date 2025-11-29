const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const CONCURRENT_REQUESTS = 100; // High volume
const TOTAL_REQUESTS = 500; // Total to send

async function sendRequest(id) {
    try {
        const start = performance.now();
        // Target a lightweight endpoint to stress the server's request handling
        const res = await fetch(`${BASE_URL}/bff/predict/config`);
        const end = performance.now();
        return { id, status: res.status, time: end - start };
    } catch (e) {
        return { id, status: 'error', time: 0 };
    }
}

async function main() {
    console.log(`Starting DDoS Simulation with ${CONCURRENT_REQUESTS} concurrent requests (Total: ${TOTAL_REQUESTS})...`);

    const results = [];
    const startTotal = performance.now();

    // Send in batches
    for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENT_REQUESTS) {
        const promises = [];
        for (let j = 0; j < CONCURRENT_REQUESTS && (i + j) < TOTAL_REQUESTS; j++) {
            promises.push(sendRequest(i + j));
        }
        const batchResults = await Promise.all(promises);
        results.push(...batchResults);
        console.log(`Batch ${i / CONCURRENT_REQUESTS + 1} completed.`);
    }

    const endTotal = performance.now();
    const totalTime = (endTotal - startTotal) / 1000; // seconds

    const success = results.filter(r => r.status === 200).length;
    const rateLimited = results.filter(r => r.status === 429).length;
    const errors = results.filter(r => r.status !== 200 && r.status !== 429).length;

    console.log('\n--- DDoS Test Results ---');
    console.log(`Total Requests: ${TOTAL_REQUESTS}`);
    console.log(`Success: ${success}`);
    console.log(`Rate Limited (429): ${rateLimited}`);
    console.log(`Errors: ${errors}`);
    console.log(`Total Time: ${totalTime.toFixed(2)} s`);
    console.log(`Throughput: ${(TOTAL_REQUESTS / totalTime).toFixed(2)} req/s`);
}

main();
