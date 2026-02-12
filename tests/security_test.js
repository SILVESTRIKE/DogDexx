const BASE_URL = 'http://localhost:5000';

async function testInputValidation() {
    console.log('Testing Input Validation (Invalid File Type)...');
    const blob = new Blob(['Not an image'], { type: 'text/plain' });
    const formData = new FormData();
    formData.append('file', blob, 'test.txt');

    try {
        const res = await fetch(`${BASE_URL}/bff/predict/image`, {
            method: 'POST',
            body: formData
        });

        if (res.status === 400 || res.status === 500) {
            console.log(`[PASS] Rejected invalid file with status ${res.status}`);
        } else {
            console.log(`[FAIL] Accepted invalid file with status ${res.status}`);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

async function testNoSQLInjection() {
    console.log('Testing NoSQL Injection (Login)...');
    const payload = {
        email: { "$gt": "" },
        password: "password"
    };

    try {
        const res = await fetch(`${BASE_URL}/bff/user/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 500) {
            console.log(`[PASS] Rejected injection payload with status ${res.status}`);
        } else if (res.ok) {
            console.log(`[FAIL] Logged in with injection payload!`);
        } else {
            console.log(`[PASS] Request failed as expected with status ${res.status}`);
        }
    } catch (e) {
        console.log('Error:', e.message);
    }
}

async function main() {
    console.log('Starting Security Tests...');
    await testInputValidation();
    await testNoSQLInjection();
}

main();
