const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:5000';

async function testNoSQLInjection() {
    console.log('Testing NoSQL Injection (Login)...');
    const payload = {
        email: { "$ne": null },
        password: { "$ne": null },
        captchaToken: 'bypass'
    };

    try {
        const res = await fetch(`${BASE_URL}/bff/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 400 || res.status === 500) {
            console.log(`[PASS] Injection rejected with status ${res.status}`);
        } else if (res.ok) {
            console.log(`[FAIL] Injection SUCCEEDED! (Status ${res.status})`);
        } else {
            console.log(`[WARN] Unexpected status ${res.status}`);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

async function testMaliciousUpload() {
    console.log('Testing Malicious File Upload (.exe as .png)...');
    const buffer = Buffer.from('This is a fake exe file', 'utf-8');
    const blob = new Blob([buffer], { type: 'application/x-msdownload' });
    const formData = new FormData();
    formData.append('file', blob, 'malicious.png'); // Fake extension

    try {
        const res = await fetch(`${BASE_URL}/bff/predict/image`, {
            method: 'POST',
            body: formData
        });

        if (res.status === 400 || res.status === 500) {
            console.log(`[PASS] Malicious upload rejected with status ${res.status}`);
        } else if (res.ok) {
            console.log(`[FAIL] Malicious upload ACCEPTED! (Status ${res.status})`);
        } else {
            console.log(`[WARN] Unexpected status ${res.status}`);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

async function testAuthBypass() {
    console.log('Testing Auth Bypass (Protected Route)...');
    try {
        const res = await fetch(`${BASE_URL}/bff/user/profile`, {
            method: 'GET'
        });

        if (res.status === 401 || res.status === 403) {
            console.log(`[PASS] Protected route rejected unauthenticated request (Status ${res.status})`);
        } else if (res.ok) {
            console.log(`[FAIL] Protected route ACCESSIBLE without token!`);
        } else {
            console.log(`[WARN] Unexpected status ${res.status}`);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

async function main() {
    console.log('--- Advanced Security Tests ---');
    await testNoSQLInjection();
    await testMaliciousUpload();
    await testAuthBypass();
}

main();
