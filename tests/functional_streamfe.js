const WebSocket = require('ws'); // Using 'ws' if available, or native if Node 22
const fs = require('fs');

const WS_URL = 'ws://localhost:5000/bff/predict/stream';
const IMAGE_PATH = 'd:\\DoAnTotNghiep\\DogBreedID_v2\\backend\\public\\dataset\\approved\\shiba-inu\\14112025_4508a.png';

async function testStream() {
    console.log('Connecting to WebSocket Stream...');

    // Node 22 has native WebSocket, but let's try to use it safely
    let ws;
    try {
        ws = new WebSocket(WS_URL);
    } catch (e) {
        console.log('Native WebSocket not found or error, trying global...');
        if (typeof global.WebSocket !== 'undefined') {
            ws = new global.WebSocket(WS_URL);
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
        } else {
            console.error('Image for stream not found.');
            ws.close();
        }
    };

    ws.onmessage = (event) => {
        console.log('Received message:', event.data);
        ws.close(); // Close after first response for test
    };

    ws.onerror = (error) => {
        console.error('WebSocket Error:', error.message || error);
    };

    ws.onclose = () => {
        console.log('WebSocket Disconnected.');
    };
}

testStream();
