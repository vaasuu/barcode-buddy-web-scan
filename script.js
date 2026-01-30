const video = document.getElementById('video');
const cameraDropdown = document.getElementById('camera-dropdown');
const modeDropdown = document.getElementById('mode-dropdown');
const flipButton = document.getElementById('flip-camera');
const statusDiv = document.getElementById('status');
const progressBar = document.getElementById('progress-bar');
const detailedModeCheckbox = document.getElementById('detailed-mode');
const modal = document.getElementById('modal');
const modalBarcode = document.getElementById('modal-barcode');
const priceInput = document.getElementById('price-input');
const dateInput = document.getElementById('date-input');
const cancelBtn = document.getElementById('cancel-btn');
const submitBtn = document.getElementById('submit-btn');
const modalError = document.getElementById('modal-error');

let stream;
let barcodeDetector;
let lastScanned = {};
let decoding = false;
let interval;
let cameras = [];
let facingMode = 'environment'; // Start with back camera
let pendingBarcode = null;

const SCAN_COOLDOWN = 3000;

async function init() {
    if (!('BarcodeDetector' in window)) {
        statusDiv.textContent = 'Barcode Detection API not supported in this browser.';
        return;
    }

    try {
        const formats = await BarcodeDetector.getSupportedFormats();
        console.log("Supported barcode formats:", formats)
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
    await fetchCurrentMode();
    await startCamera();
}

async function populateCameraDropdown() {
    try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        cameras = videoDevices;
        videoDevices.forEach((device, index) => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.text = device.label || `Camera ${index + 1}`;
            cameraDropdown.appendChild(option);
        });
    } catch (e) {
        console.error('Error enumerating devices:', e);
    }
}

async function fetchCurrentMode() {
    try {
        const response = await fetch('/api/state/getmode');
        if (response.ok) {
            const data = await response.json();
            if (data[0]?.data?.mode !== undefined) {
                modeDropdown.value = data[0].data.mode.toString();
            }
        }
    } catch (e) {
        console.error('Error fetching current mode:', e);
    }
}

async function startCamera() {
    try {
        const constraints = {
            video: cameraDropdown.value ? { deviceId: { exact: cameraDropdown.value } } : { facingMode: facingMode }
        };
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        // Update dropdown to reflect the current device
        const track = stream.getVideoTracks()[0];
        const settings = track.getSettings();
        const deviceId = settings.deviceId;
        const index = cameras.findIndex(cam => cam.deviceId === deviceId);
        if (index !== -1) {
            cameraDropdown.selectedIndex = index;
        }
        video.onloadeddata = startDetecting;
    } catch (e) {
        statusDiv.textContent = 'Error accessing camera: ' + e.message;
    }
}

cameraDropdown.addEventListener('change', async () => {
    stop();
    await startCamera();
});

modeDropdown.addEventListener('change', async () => {
    const mode = parseInt(modeDropdown.value, 10);
    try {
        const params = new URLSearchParams({ state: mode });
        const response = await fetch('/api/state/setmode', {
            method: 'POST',
            body: params
        });
        if (!response.ok) {
            const data = await response.json();
            statusDiv.textContent = 'Error setting mode: ' + (data.result?.result || 'Unknown error');
        }
    } catch (e) {
        statusDiv.textContent = 'Error setting mode: ' + e.message;
    }
});

flipButton.addEventListener('click', () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    stop();
    startCamera();
});

function stop() {
    clearInterval(interval);
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
}

function startDetecting() {
    clearInterval(interval);
    interval = setInterval(detect, 40);
    statusDiv.textContent = '';
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
            if (!lastScanned[code] || now - lastScanned[code] > SCAN_COOLDOWN) {
                lastScanned[code] = now;
                playBeep();
                statusDiv.textContent = `Scanned: ${code}`;
                statusDiv.style.opacity = '1';
                progressBar.style.transition = 'none';
                progressBar.style.transform = 'scaleX(1)';
                progressBar.style.opacity = '1';
                requestAnimationFrame(() => {
                    progressBar.style.transition = `transform ${SCAN_COOLDOWN / 1000}s ease-out, opacity 0.3s ease-out`;
                    progressBar.style.transform = 'scaleX(0)';
                });
                setTimeout(() => {
                    statusDiv.style.opacity = '0';
                }, SCAN_COOLDOWN);
                if (detailedModeCheckbox.checked) {
                    showModal(code);
                } else {
                    await postScan(code);
                }
            }
        }
    } catch (e) {
        console.error('Detection error:', e);
    }

    decoding = false;
}

function playBeep() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime); // Frequency in Hz
    oscillator.type = 'square';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
}

async function postScan(barcode, price = null, bestBeforeInDays = null) {
    try {
        const params = new URLSearchParams({ barcode });
        if (price !== null) {
            params.append('price', price);
        }
        if (bestBeforeInDays !== null) {
            params.append('bestBeforeInDays', bestBeforeInDays);
        }
        const response = await fetch('/api/scan', {
            method: 'POST',
            body: params
        });
        if (!response.ok) {
            throw new Error('Scan failed');
        }
    } catch (e) {
        statusDiv.textContent = 'Error posting scan: ' + e.message;
    }
}

function showModal(barcode) {
    pendingBarcode = barcode;
    modalBarcode.textContent = barcode;
    priceInput.value = '';
    dateInput.value = '';
    modalError.textContent = '';
    modal.style.display = 'flex';
    clearInterval(interval);
}

function hideModal() {
    modal.style.display = 'none';
    pendingBarcode = null;
    interval = setInterval(detect, 40);
}

function getTodayString() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateDaysFromToday(dateString) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selectedDate = new Date(dateString);
    selectedDate.setHours(0, 0, 0, 0);
    const diffTime = selectedDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
}

function validateInputs() {
    const price = priceInput.value;
    const date = dateInput.value;
    
    if (price && parseFloat(price) <= 0) {
        modalError.textContent = 'Price must be greater than 0';
        return false;
    }
    
    if (date) {
        const today = getTodayString();
        if (date < today) {
            modalError.textContent = 'Date must be today or in the future';
            return false;
        }
    }
    
    modalError.textContent = '';
    return true;
}

cancelBtn.addEventListener('click', () => {
    hideModal();
});

submitBtn.addEventListener('click', async () => {
    if (!validateInputs()) {
        return;
    }
    
    const price = priceInput.value ? parseFloat(priceInput.value) : null;
    const date = dateInput.value;
    let bestBeforeInDays = null;
    
    if (date) {
        bestBeforeInDays = calculateDaysFromToday(date);
    }
    
    await postScan(pendingBarcode, price, bestBeforeInDays);
    hideModal();
});

init();