const video = document.getElementById('video');
const cameraDropdown = document.getElementById('camera-dropdown');
const statusDiv = document.getElementById('status');

let stream;
let barcodeDetector;
let lastScanned = {};
let decoding = false;
let interval;

async function init() {
    if (!('BarcodeDetector' in window)) {
        statusDiv.textContent = 'Barcode Detection API not supported in this browser.';
        return;
    }

    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        if (formats.length === 0) {
            statusDiv.textContent = 'No barcode formats supported.';
            return;
        }
        barcodeDetector = new BarcodeDetector();
    } catch (e) {
        statusDiv.textContent = 'Failed to initialize Barcode Detector.';
        return;
    }

    await populateCameraDropdown();
    await startCamera();
}

async function populateCameraDropdown() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        videoDevices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${cameraDropdown.length + 1}`;
            cameraDropdown.appendChild(option);
        });
    } catch (e) {
        console.error('Error enumerating devices:', e);
    }
}

async function startCamera() {
    try {
        const constraints = {
            video: {
                deviceId: cameraDropdown.value ? { exact: cameraDropdown.value } : undefined
            }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        video.onloadeddata = startDetecting;
    } catch (e) {
        statusDiv.textContent = 'Error accessing camera: ' + e.message;
    }
}

cameraDropdown.addEventListener('change', async () => {
    stop();
    await startCamera();
});

function stop() {
    clearInterval(interval);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}

function startDetecting() {
    clearInterval(interval);
    interval = setInterval(detect, 1000);
}

async function detect() {
    if (decoding || !barcodeDetector) return;
    decoding = true;

    try {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
            decoding = false;
            return; // Video not ready
        }

        const barcodes = await barcodeDetector.detect(video);
        for (const barcode of barcodes) {
            const code = barcode.rawValue;
            const now = Date.now();
            if (!lastScanned[code] || now - lastScanned[code] > 3000) {
                lastScanned[code] = now;
                await postScan(code);
                statusDiv.textContent = `Scanned: ${code}`;
            }
        }
    } catch (e) {
        console.error('Detection error:', e);
    }

    decoding = false;
}

async function postScan(barcode) {
    try {
        const response = await fetch('/api/scan', {
            method: 'POST',
            body: new URLSearchParams({ barcode })
        });
        if (!response.ok) {
            throw new Error('Scan failed');
        }
    } catch (e) {
        statusDiv.textContent = 'Error posting scan: ' + e.message;
    }
}

init();