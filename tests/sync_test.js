const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
// Sử dụng ảnh có sẵn trong dataset để test
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';

const TEST_USER = {
    email: `sync_user_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Sync',
    lastName: 'Tester',
    username: `sync_user_${Date.now()}`
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

async function login(deviceName) {
    console.log(`[${deviceName}] Logging in...`);
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
        console.log(`[${deviceName}] Login success. Got Token.`);
        return data.tokens.accessToken;
    } else {
        console.error(`[${deviceName}] Login failed:`, await res.text());
        return null;
    }
}

async function uploadImage(token, deviceName) {
    console.log(`[${deviceName}] Uploading image to update collection...`);
    if (!fs.existsSync(IMAGE_PATH)) {
        console.error(`[${deviceName}] Image not found at ${IMAGE_PATH}`);
        return null;
    }

    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', blob, 'sync_test.png');

    const res = await fetch(`${BASE_URL}/bff/predict/image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
    });

    if (res.ok) {
        const data = await res.json();
        console.log(`[${deviceName}] Prediction success. Breed: ${data.predictions[0]?.class}`);
        return data.predictionId;
    } else {
        console.error(`[${deviceName}] Prediction failed:`, res.status);
        return null;
    }
}

async function checkCollection(token, deviceName) {
    console.log(`[${deviceName}] Checking collection...`);
    // Chờ một chút để backend xử lý async (vì logic update collection chạy ngầm)
    await new Promise(r => setTimeout(r, 2000));

    const res = await fetch(`${BASE_URL}/bff/collection`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
        const data = await res.json();
        const collectedCount = data.length || 0;
        console.log(`[${deviceName}] Collection count: ${collectedCount}`);

        if (collectedCount > 0) {
            console.log(`[${deviceName}] SUCCESS: Found ${collectedCount} breeds in collection.`);
            return true;
        } else {
            console.log(`[${deviceName}] FAIL: Collection is empty.`);
            return false;
        }
    } else {
        console.error(`[${deviceName}] Failed to fetch collection:`, res.status);
        return false;
    }
}

async function main() {
    console.log('--- STARTING SYNC TEST ---');

    // 1. Setup User
    await register();

    // 2. Simulate Device A (Mobile)
    const tokenA = await login('Device A');
    if (!tokenA) return;

    // 3. Simulate Device B (Web)
    const tokenB = await login('Device B');
    if (!tokenB) return;

    // 4. Device A uploads image
    const predictionId = await uploadImage(tokenA, 'Device A');
    if (!predictionId) return;

    // 5. Device B checks collection
    console.log('Waiting for sync...');
    let attempts = 0;
    let synced = false;

    while (attempts < 5 && !synced) {
        attempts++;
        console.log(`Attempt ${attempts}...`);
        synced = await checkCollection(tokenB, 'Device B');
        if (!synced) await new Promise(r => setTimeout(r, 1000)); // Retry delay
    }

    if (synced) {
        console.log('\n>>> TEST PASSED: Data synchronized across devices.');
    } else {
        console.log('\n>>> TEST FAILED: Data did not sync after timeout.');
    }
}

main();
