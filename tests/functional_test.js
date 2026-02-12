const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';

const TEST_USER = {
    email: `testuser_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    username: `testuser_${Date.now()}`
};

async function predictImage(token) {
    console.log('Uploading image for prediction...');
    if (!fs.existsSync(IMAGE_PATH)) {
        console.error('Image file not found:', IMAGE_PATH);
        return;
    }

    const fileBuffer = fs.readFileSync(IMAGE_PATH);
    const blob = new Blob([fileBuffer], { type: 'image/png' });

    const formData = new FormData();
    formData.append('file', blob, 'test_image.png');

    const headers = {};
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const res = await fetch(`${BASE_URL}/bff/predict/image`, {
            method: 'POST',
            headers: headers,
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            console.log('Prediction success:', JSON.stringify(data, null, 2));
        } else {
            console.log('Prediction failed:', res.status, await res.text());
        }
    } catch (e) {
        console.log('Prediction error:', e.message);
    }
}

async function register() {
    console.log('Registering user...');
    const formData = new FormData();
    formData.append('email', TEST_USER.email);
    formData.append('password', TEST_USER.password);
    formData.append('firstName', TEST_USER.firstName);
    formData.append('lastName', TEST_USER.lastName);
    formData.append('username', TEST_USER.username);
    formData.append('captchaToken', 'bypass');

    const res = await fetch(`${BASE_URL}/bff/user/register`, {
        method: 'POST',
        body: formData
    });

    if (res.status === 201 || res.status === 400) {
        console.log(`Register status: ${res.status}`);
        return true;
    }
    console.log('Register failed:', await res.text());
    return false;
}

async function login() {
    console.log('Logging in...');
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
        console.log('Login successful.');
        return data.tokens.accessToken;
    } else {
        console.log('Login failed:', await res.text());
        return null;
    }
}

async function main() {
    console.log('Running Functional Tests (User Mode)...');

    let token = await login();

    if (!token) {
        await register();
        token = await login();
    }

    if (!token) {
        console.error('Could not authenticate. Exiting.');
        return;
    }

    await predictImage(token);
}

main();
