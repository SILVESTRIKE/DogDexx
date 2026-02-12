const http = require('http');

const checkService = (name, url) => {
    return new Promise((resolve) => {
        const req = http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    console.log(`[PASS] ${name} is UP (${url}) - Status: ${res.statusCode}`);
                    resolve(true);
                } else {
                    console.log(`[FAIL] ${name} returned status ${res.statusCode} (${url})`);
                    resolve(false);
                }
            });
        });

        req.on('error', (err) => {
            console.log(`[FAIL] ${name} is DOWN (${url}) - Error: ${err.message}`);
            resolve(false);
        });
    });
};

const main = async () => {
    console.log('Starting Health Checks...');

    // Check AI Service
    const aiStatus = await checkService('AI Service', 'http://localhost:8000/');

    // Check Backend (Try 5000 first, then 3000)
    let backendStatus = await checkService('Backend (Port 5000)', 'http://localhost:5000/api-docs.json');
    if (!backendStatus) {
        console.log('Retrying Backend on Port 3000...');
        backendStatus = await checkService('Backend (Port 3000)', 'http://localhost:3000/api-docs.json');
    }

    if (aiStatus && backendStatus) {
        console.log('\nAll Critical Services are UP.');
        process.exit(0);
    } else {
        console.log('\nSome services are DOWN.');
        process.exit(1);
    }
};

main();
