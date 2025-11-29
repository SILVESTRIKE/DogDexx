const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:5000';

const TEST_USER = {
    email: `admin_test_${Date.now()}@example.com`,
    password: 'password123',
    firstName: 'Admin',
    lastName: 'Test',
    username: `admin_test_${Date.now()}`
};

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

    // Promote to Admin
    console.log(`Promoting ${TEST_USER.email} to admin...`);
    try {
        execSync(`node tests/promote_admin.js ${TEST_USER.email}`);
    } catch (e) {
        console.error('Failed to promote user:', e.message);
    }

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
    return null;
}

async function testDogDex() {
    console.log('Testing DogDex (Public)...');
    const res = await fetch(`${BASE_URL}/api/wiki?limit=5`);
    if (res.ok) {
        const data = await res.json();
        console.log(`[PASS] DogDex fetched ${data.data.length} breeds.`);
    } else {
        console.log(`[FAIL] DogDex failed: ${res.status}`);
    }
}

async function testAdminDashboard(token) {
    console.log('Testing Admin Dashboard...');
    const res = await fetch(`${BASE_URL}/bff/admin/dashboard`, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.ok) {
        const data = await res.json();
        console.log(`[PASS] Dashboard data:`, JSON.stringify(data).substring(0, 100) + '...');
    } else {
        console.log(`[FAIL] Dashboard failed: ${res.status}`);
    }
}

async function main() {
    console.log('--- Feature Tests ---');
    await testDogDex();

    const token = await registerAndLogin();
    if (token) {
        await testAdminDashboard(token);
    } else {
        console.log('Auth failed, skipping Admin tests.');
    }
}

main();
