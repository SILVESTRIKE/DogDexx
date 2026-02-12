import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

export const options = {
    vus: 50, // 50 concurrent users
    duration: '1m', // Run for 1 minute
    thresholds: {
        http_req_failed: ['rate<0.01'], // Error rate < 1%
        http_req_duration: ['p(95)<500'], // 95% requests < 500ms
    },
};

const BASE_URL = 'http://localhost:5000';

export function setup() {
    // 1. Create a dedicated user for this test run
    const randomName = `k6user_${randomString(8)}`;
    const email = `${randomName}@example.com`;
    const password = 'Password123!';

    const payload = {
        username: randomName,
        email: email,
        password: password,
        captchaToken: 'TEST_BYPASS_TOKEN',
    };

    console.log(`[Setup] Creating user: ${email}`);

    // Use JSON for registration (easier/safer than implicit form-data if no file)
    const registerParams = {
        headers: { 'Content-Type': 'application/json' }
    };
    const registerRes = http.post(`${BASE_URL}/bff/user/register`, JSON.stringify(payload), registerParams);

    if (registerRes.status !== 201) {
        console.error(`Register failed. Status: ${registerRes.status}`);
        console.error('Body:', registerRes.body);
        throw new Error(`Register failed with status ${registerRes.status}`);
    }

    // 2. Login to get token
    const loginPayload = JSON.stringify({
        email: email,
        password: password,
        captchaToken: 'TEST_BYPASS_TOKEN'
    });

    const loginParams = {
        headers: { 'Content-Type': 'application/json' }
    };

    const loginRes = http.post(`${BASE_URL}/bff/user/login`, loginPayload, loginParams);

    if (loginRes.status !== 200) {
        throw new Error('Login failed');
    }

    const body = loginRes.json();
    const accessToken = body.tokens ? body.tokens.accessToken : body.accessToken;

    return { accessToken, password };
}

export default function (data) {
    const params = {
        headers: {
            'Authorization': `Bearer ${data.accessToken}`,
            'Content-Type': 'application/json',
        },
    };

    group('My Achievements', () => {
        const res = http.get(`${BASE_URL}/bff/collection/achievements`, params);
        check(res, {
            'achievements status 200': (r) => r.status === 200,
            'achievements cache hit': (r) => r.json('stats') !== undefined,
        });
    });

    group('Achievement Stats', () => {
        const res = http.get(`${BASE_URL}/bff/collection/achievements/stats`, params);
        check(res, {
            'stats status 200': (r) => r.status === 200,
            'stats valid': (r) => r.json('totalAchievements') !== undefined,
        });
    });

    group('Leaderboard', () => {
        // Test locking on heavy leaderboard query
        const res = http.get(`${BASE_URL}/bff/public/leaderboard?scope=global&limit=10`, params);
        check(res, {
            'leaderboard status 200': (r) => r.status === 200,
            'leaderboard is array': (r) => Array.isArray(r.json()),
        });
    });

    sleep(1);
}

export function teardown(data) {
    // Cleanup: Delete the test user
    console.log('[Teardown] Deleting test user...');

    // Note: deleteCurrentUser requires body with password in some implementations, 
    // but the current controller might just delete by ID from token. 
    // We send password just in case.
    const params = {
        headers: {
            'Authorization': `Bearer ${data.accessToken}`,
            'Content-Type': 'application/json',
        },
    };
    const payload = JSON.stringify({ password: data.password });

    const res = http.del(`${BASE_URL}/bff/user/profile`, payload, params);

    if (res.status === 200) {
        console.log('[Teardown] User deleted successfully.');
    } else {
        console.warn('[Teardown] Failed to delete user. Status:', res.status, res.body);
    }
}