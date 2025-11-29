const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const VIDEO_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\tests\\dummy_video.mp4';

const TEST_USER = {
    email: `testuser_video_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'Video',
    username: `testuser_video_${Date.now()}`
};

async function createDummyVideo() {
    if (!fs.existsSync(VIDEO_PATH)) {
        console.log('Creating dummy video file...');
        const buffer = Buffer.alloc(1024 * 1024);
        fs.writeFileSync(VIDEO_PATH, buffer);
    }
}

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

async function predictVideo(token) {
    console.log('Uploading video for prediction...');
    await createDummyVideo();

    const fileBuffer = fs.readFileSync(VIDEO_PATH);
    const blob = new Blob([fileBuffer], { type: 'video/mp4' });

    const formData = new FormData();
    formData.append('file', blob, 'test_video.mp4');

    try {
        const res = await fetch(`${BASE_URL}/bff/predict/video`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            console.log('Video Prediction success:', JSON.stringify(data, null, 2));
        } else {
            console.log('Video Prediction failed:', res.status, await res.text());
        }
    } catch (e) {
        console.log('Video Prediction error:', e.message);
    }
}

async function main() {
    console.log('Running Video Functional Test (User Mode)...');
    let token = await login();
    if (!token) {
        await register();
        token = await login();
    }
    if (token) await predictVideo(token);
    else console.log('Auth failed');
}

main();
