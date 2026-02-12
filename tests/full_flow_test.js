const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';

const TEST_USER = {
    email: `flow_user_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Flow',
    lastName: 'Tester',
    username: `flow_user_${Date.now()}`
};

async function register() {
    console.log('[Init] Registering test user...');
    const formData = new FormData();
    formData.append('email', TEST_USER.email);
    formData.append('password', TEST_USER.password);
    formData.append('firstName', TEST_USER.firstName);
    formData.append('lastName', TEST_USER.lastName);
    formData.append('username', TEST_USER.username);
    formData.append('captchaToken', 'bypass');

    const res = await fetch(`${BASE_URL}/bff/user/register`, { method: 'POST', body: formData });
    if (res.status === 201) console.log('[Init] Register success.');
    else console.log('[Init] Register failed or user exists:', res.status);
}

async function login() {
    console.log('[Init] Logging in...');
    const res = await fetch(`${BASE_URL}/bff/user/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            email: TEST_USER.email,
            password: TEST_USER.password,
            captchaToken: 'bypass'
        })
    });

    if (res.ok) {
        const data = await res.json();
        console.log('[Init] Login success.');
        return data.tokens.accessToken;
    } else {
        console.error('[Init] Login failed:', await res.text());
        return null;
    }
}

async function uploadImage(token) {
    console.log('[Step 1] Uploading image for prediction...');
    if (!fs.existsSync(IMAGE_PATH)) {
        console.error('Image not found:', IMAGE_PATH);
        return null;
    }

    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'flow_test.png');

    const res = await fetch(`${BASE_URL}/bff/predict/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
        const data = await res.json();
        console.log(`[Step 1] Prediction success. ID: ${data.predictionId}`);
        return data.predictionId;
    } else {
        console.error('[Step 1] Prediction failed:', res.status);
        return null;
    }
}

async function checkCollection(token) {
    console.log('[Step 2] Verifying Collection Update...');
    // Wait for async worker
    await new Promise(r => setTimeout(r, 3000));

    const res = await fetch(`${BASE_URL}/bff/collection`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
        const data = await res.json();
        if (data.length > 0) {
            console.log(`[Step 2] SUCCESS: Collection has ${data.length} breeds.`);
            return true;
        } else {
            console.error('[Step 2] FAIL: Collection is empty.');
            return false;
        }
    } else {
        console.error('[Step 2] Failed to fetch collection:', res.status);
        return false;
    }
}

async function submitFeedback(token, predictionId) {
    console.log('[Step 3] Submitting Feedback...');
    const payload = {
        isCorrect: true,
        notes: "Automated test feedback",
        user_submitted_label: "Shiba Inu" // Optional if isCorrect is true
    };

    const res = await fetch(`${BASE_URL}/bff/predict/${predictionId}/feedback`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (res.status === 201) {
        const data = await res.json();
        console.log(`[Step 3] Feedback submitted. ID: ${data.feedbackId}`);
        return true;
    } else {
        console.error('[Step 3] Feedback submission failed:', res.status, await res.text());
        return false;
    }
}

async function main() {
    console.log('--- STARTING FULL FLOW TEST ---');

    await register();
    const token = await login();
    if (!token) return;

    const predictionId = await uploadImage(token);
    if (!predictionId) return;

    const collectionUpdated = await checkCollection(token);
    if (!collectionUpdated) return;

    const feedbackSubmitted = await submitFeedback(token, predictionId);

    if (feedbackSubmitted) {
        console.log('\n>>> TEST PASSED: Full flow (Predict -> Collection -> Feedback) completed successfully.');
    } else {
        console.log('\n>>> TEST FAILED: Feedback step failed.');
    }
}

main();
