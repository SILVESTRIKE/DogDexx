const WebSocket = require('ws');
const fs = require('fs');

const WS_URL = 'ws://localhost:5000/bff/predict/stream';
const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';

const TEST_USER = {
    email: `testuser_stream_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'Stream',
    username: `testuser_stream_${Date.now()}`
};

async function register() {
    const formData = new FormData();
    formData.append('email', TEST_USER.email);
    formData.append('password', TEST_USER.password);
    formData.append('firstName', TEST_USER.firstName);
    formData.append('lastName', TEST_USER.lastName);
    formData.append('username', TEST_USER.username);
    formData.append('captchaToken', 'bypass');
    await fetch(`${BASE_URL}/bff/user/register`, { method: 'POST', body: formData });
}

async function login() {
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
    return null;
}

async function testStream() {
    console.log('Registering/Logging in for Stream Test...');
    await register();
    const token = await login();

    if (!token) {
        console.error('Auth failed for stream test.');
        return;
    }

    console.log('Connecting to WebSocket Stream with Token...');
    // Append token to URL query
    const wsUrlWithToken = `${WS_URL}?token=${token}`;

    let ws;
    try {
        ws = new WebSocket(wsUrlWithToken);
    } catch (e) {
        if (typeof global.WebSocket !== 'undefined') {
            ws = new global.WebSocket(wsUrlWithToken);
        } else {
            console.error('No WebSocket implementation found.');
            return;
        }
    }

    ws.onopen = () => {
        console.log('WebSocket Connected.');
        if (fs.existsSync(IMAGE_PATH)) {
            console.log('Sending image frame...');
            const buffer = fs.readFileSync(IMAGE_PATH);
            ws.send(buffer);
        }
    };

    ws.onmessage = (event) => {
        console.log('Received message:', event.data);
        ws.close();
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error.message || error);
    };
}

testStream();
