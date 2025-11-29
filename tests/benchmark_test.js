const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const BASE_URL = 'http://localhost:5000';
const WS_URL = 'ws://localhost:5000/bff/predict/stream';
const IMAGE_PATH = path.join(__dirname, '../backend/public/dataset/approved/shiba-inu/14112025_4508a.png');
const VIDEO_PATH = path.join(__dirname, 'dummy_video.mp4');

// Use a fresh user for each run to avoid auth issues
const TEST_USER = {
    email: `bench_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Bench',
    lastName: 'Mark',
    username: `bench_${Date.now()}`
};

async function getAIConfig() {
    try {
        const res = await fetch(`${BASE_URL}/bff/predict/config`);
        if (res.ok) return await res.json();
    } catch (e) {
        return null;
    }
    return null;
}

async function registerAndLogin() {
    // Register
    const formData = new FormData();
    formData.append('email', TEST_USER.email);
    formData.append('password', TEST_USER.password);
    formData.append('firstName', TEST_USER.firstName);
    formData.append('lastName', TEST_USER.lastName);
    formData.append('username', TEST_USER.username);
    formData.append('captchaToken', 'bypass');
    await fetch(`${BASE_URL}/bff/user/register`, { method: 'POST', body: formData });

    // Login
    const res = await fetch(`${BASE_URL}/bff/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password,
            captchaToken: 'bypass'
        })
    });
    if (res.ok) return (await res.json()).tokens.accessToken;
    console.log('Login failed:', res.status, await res.text());
    return null;
}

async function benchmarkImage(token) {
    if (!fs.existsSync(IMAGE_PATH)) return 0;
    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'bench.png');

    const start = performance.now();
    await fetch(`${BASE_URL}/bff/predict/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    return performance.now() - start;
}

async function createDummyVideo() {
    if (!fs.existsSync(VIDEO_PATH)) {
        const buffer = Buffer.alloc(1024 * 1024); // 1MB
        fs.writeFileSync(VIDEO_PATH, buffer);
    }
}

async function benchmarkVideo(token) {
    await createDummyVideo();
    const fileBuffer = fs.readFileSync(VIDEO_PATH);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });
    const formData = new FormData();
    formData.append('file', blob, 'bench.mp4');

    const start = performance.now();
    await fetch(`${BASE_URL}/bff/predict/video`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });
    return performance.now() - start;
}

async function benchmarkStream(token) {
    return new Promise((resolve) => {
        const wsUrlWithToken = `${WS_URL}?token=${token}`;
        let ws;
        try {
            ws = new WebSocket(wsUrlWithToken);
        } catch (e) {
            if (typeof global.WebSocket !== 'undefined') {
                ws = new global.WebSocket(wsUrlWithToken);
            } else {
                resolve(0);
                return;
            }
        }

        const start = performance.now();
        ws.onopen = () => {
            if (fs.existsSync(IMAGE_PATH)) {
                const buffer = fs.readFileSync(IMAGE_PATH);
                ws.send(buffer);
            }
        };
        ws.onmessage = () => {
            const end = performance.now();
            ws.close();
            resolve(end - start);
        };
        ws.onerror = () => resolve(0);
    });
}

async function main() {
    console.log('--- Performance Benchmark ---');

    const config = await getAIConfig();
    const device = config?.device || 'Unknown';
    console.log(`Device: ${device.toUpperCase()}`);

    const token = await registerAndLogin();
    if (!token) {
        console.error('Auth failed');
        return;
    }

    console.log('Benchmarking Image...');
    const imageTime = await benchmarkImage(token);
    console.log(`Image Prediction: ${imageTime.toFixed(2)} ms`);

    console.log('Benchmarking Video...');
    const videoTime = await benchmarkVideo(token);
    console.log(`Video Prediction: ${videoTime.toFixed(2)} ms`);

    console.log('Benchmarking Stream...');
    const streamTime = await benchmarkStream(token);
    console.log(`Stream Prediction: ${streamTime.toFixed(2)} ms`);
}

main();
