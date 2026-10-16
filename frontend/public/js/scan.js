const DOOR_KEY = 'okizzDoorCode';
let doorCode = sessionStorage.getItem(DOOR_KEY) || '';
let stream = null;
let scanning = false;
let busy = false;        // a code is being checked, or a result is showing
let decoding = false;    // a frame is being decoded (the canvas is shared, so one at a time)
let loopId = null;
let lastAttempt = 0;

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The phone's built-in QR detector, where the browser has one (Chrome on Android).
// Faster and more accurate than the JavaScript fallback.
let detector = null;
if ('BarcodeDetector' in window) {
  try { detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (_) { detector = null; }
}

function showView(name) {
  $('lockView').style.display = name === 'lock' ? 'block' : 'none';
  $('scanView').style.display = name === 'scan' ? 'block' : 'none';
  $('resultView').style.display = name === 'result' ? 'flex' : 'none';
}

function setScanMsg(text) {
  const el = $('scanMsg');
  el.textContent = text || '';
  el.style.display = text ? 'block' : 'none';
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}/tickets/door/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ doorCode, ...body })
  });
  let data = {};
  try { data = await res.json(); } catch (_) { /* no body */ }
  return { status: res.status, data };
}

/* ---------- Door code ---------- */

async function unlock(code, { silent } = {}) {
  const errorEl = $('lockError');
  errorEl.style.display = 'none';
  doorCode = code;

  try {
    const { status, data } = await post('check', {});
    if (status === 200) {
      sessionStorage.setItem(DOOR_KEY, doorCode);
      showView('scan');
      startCamera();
      return;
    }
    doorCode = '';
    sessionStorage.removeItem(DOOR_KEY);
    if (!silent) {
      errorEl.textContent = data.message || 'Could not unlock. Try again.';
      errorEl.style.display = 'block';
    }
  } catch (_) {
    if (!silent) {
      errorEl.textContent = 'Could not reach the server. Check your connection.';
      errorEl.style.display = 'block';
    }
  }
  showView('lock');
}

$('unlockBtn').addEventListener('click', () => {
  const code = $('doorCodeInput').value.trim();
  if (!code) return;
  unlock(code);
});
$('doorCodeInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('unlockBtn').click(); });

$('lockBtn').addEventListener('click', () => {
  stopCamera();
  doorCode = '';
  sessionStorage.removeItem(DOOR_KEY);
  $('doorCodeInput').value = '';
  setScanMsg('');
  showView('lock');
});

/* ---------- Camera ---------- */

async function startCamera() {
  busy = false;
  scanning = true;
  if (stream) { startLoop(); return; }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    video.srcObject = stream;
    await video.play();

    // Keep the picture sharp while the phone moves, where the device supports it
    try {
      const track = stream.getVideoTracks()[0];
      const caps = track.getCapabilities ? track.getCapabilities() : {};
      if (caps.focusMode && caps.focusMode.includes('continuous')) {
        await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
      }
    } catch (_) { /* not supported: fine */ }

    $('cameraError').style.display = 'none';
    startLoop();
  } catch (_) {
    scanning = false;
    $('cameraError').textContent = 'Camera unavailable. Allow camera access in your browser, or use "Scan from photo" or type the code below.';
    $('cameraError').style.display = 'block';
  }
}

function stopCamera() {
  scanning = false;
  if (loopId !== null) { cancelAnimationFrame(loopId); loopId = null; }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

/* ---------- Decoding ---------- */

function runJsQr(source, sw, sh, { maxW, crop, inversion }) {
  let sx = 0, sy = 0, cw = sw, ch = sh;
  if (crop) { sx = sw * 0.15; sy = sh * 0.15; cw = sw * 0.7; ch = sh * 0.7; }
  const scale = Math.min(1, maxW / cw);
  const w = Math.max(1, Math.round(cw * scale));
  const h = Math.max(1, Math.round(ch * scale));
  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(source, sx, sy, cw, ch, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const hit = jsQR(img.data, w, h, { inversionAttempts: inversion });
  return hit && hit.data ? hit.data : null;
}

// Returns the QR text, or null. `thorough` tries more sizes and inverted colours (used by the buttons).
async function decodeFrom(source, sw, sh, thorough = false) {
  if (detector) {
    try {
      const found = await detector.detect(source);
      if (found.length && found[0].rawValue) return found[0].rawValue;
    } catch (_) { /* fall back to jsQR */ }
  }

  const attempts = thorough
    ? [
        { maxW: 1400, crop: false, inversion: 'attemptBoth' },
        { maxW: 1400, crop: true, inversion: 'attemptBoth' },
        { maxW: 700, crop: false, inversion: 'attemptBoth' }
      ]
    : [{ maxW: 960, crop: false, inversion: 'dontInvert' }];

  for (const a of attempts) {
    const raw = runJsQr(source, sw, sh, a);
    if (raw) return raw;
  }
  return null;
}

async function withDecodeLock(fn) {
  while (decoding) await sleep(30);
  decoding = true;
  try { return await fn(); } finally { decoding = false; }
}

function startLoop() {
  if (loopId === null) loopId = requestAnimationFrame(tick);
}

async function tick(ts) {
  loopId = null;
  if (!scanning) return;
  startLoop();

  if (busy || decoding || ts - lastAttempt < 150) return;
  if (video.readyState < 2 || !video.videoWidth) return;

  lastAttempt = ts;
  decoding = true;
  try {
    const raw = await decodeFrom(video, video.videoWidth, video.videoHeight);
    if (raw) handleCode(raw);
  } catch (_) { /* try again next frame */ }
  finally { decoding = false; }
}

/* ---------- Scan button: a thorough capture on demand ---------- */

$('scanNowBtn').addEventListener('click', async () => {
  if (busy) return;
  const btn = $('scanNowBtn');

  if (!stream || !video.videoWidth) {
    return setScanMsg('The camera is not ready yet. Wait a moment, or use "Scan from photo".');
  }

  btn.disabled = true;
  btn.textContent = 'Scanning…';
  setScanMsg('');

  let raw = null;
  try {
    // A few frames: the focus can shift between them
    raw = await withDecodeLock(async () => {
      for (let i = 0; i < 6; i++) {
        const found = await decodeFrom(video, video.videoWidth, video.videoHeight, true);
        if (found) return found;
        await sleep(150);
      }
      return null;
    });
  } catch (_) { /* handled below */ }

  btn.disabled = false;
  btn.innerHTML = '<i class="fa-solid fa-expand"></i> Scan';

  if (raw) handleCode(raw);
  else setScanMsg('No QR code found. Move closer, hold steady, avoid glare, then tap Scan again.');
});

/* ---------- Scan from photo (uses the phone's own camera app) ---------- */

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}

$('photoBtn').addEventListener('click', () => $('photoInput').click());

$('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file || busy) return;

  setScanMsg('Reading photo…');
  try {
    const img = await loadImageFromFile(file);
    const raw = await withDecodeLock(() => decodeFrom(img, img.naturalWidth, img.naturalHeight, true));
    if (raw) handleCode(raw);
    else setScanMsg('No QR code found in that photo. Retake it closer, with the QR filling the frame.');
  } catch (_) {
    setScanMsg('Could not read that photo. Try again.');
  }
});

/* ---------- Checking a code ---------- */

async function handleCode(raw) {
  if (busy) return;
  busy = true;
  setScanMsg('');

  try {
    const { status, data } = await post('scan', { code: raw });

    if (status === 401 || status === 429 || status === 503) {
      // Door code no longer accepted: send staff back to the lock screen
      stopCamera();
      doorCode = '';
      sessionStorage.removeItem(DOOR_KEY);
      $('lockError').textContent = data.message || 'Please enter the door code again.';
      $('lockError').style.display = 'block';
      showView('lock');
      return;
    }

    showResult(data.result || 'error', data);
  } catch (_) {
    showResult('error', { message: 'Could not reach the server. Check your connection and scan again.' });
  }
}

function formatTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit' });
}

function addLine(container, text, strong) {
  const p = document.createElement('p');
  if (strong) p.className = 'strong';
  p.textContent = text;
  container.appendChild(p);
}

function showResult(result, data) {
  const view = $('resultView');
  const icon = $('resultIcon');
  const label = $('resultLabel');
  const details = $('resultDetails');
  details.innerHTML = '';

  view.className = 'scan-result';
  icon.className = 'fa-solid';

  const t = data.ticket;

  if (result === 'valid') {
    view.classList.add('is-valid');
    icon.classList.add('fa-circle-check');
    label.textContent = 'VALID';
    if (t) {
      addLine(details, [t.tierName, t.category].filter(Boolean).join(' · '), true);
      addLine(details, t.buyerName);
      addLine(details, `Ticket ${t.seq}`);
    }
    if (navigator.vibrate) navigator.vibrate(80);
  } else if (result === 'used') {
    view.classList.add('is-bad');
    icon.classList.add('fa-triangle-exclamation');
    label.textContent = 'ALREADY USED';
    if (t) addLine(details, [t.tierName, t.category].filter(Boolean).join(' · '), true);
    if (data.usedAt) addLine(details, `Scanned at ${formatTime(data.usedAt)}`);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } else if (result === 'invalid') {
    view.classList.add('is-bad');
    icon.classList.add('fa-circle-xmark');
    label.textContent = 'INVALID TICKET';
    addLine(details, 'This code is not a ticket for this show.');
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  } else {
    view.classList.add('is-warn');
    icon.classList.add('fa-circle-exclamation');
    label.textContent = 'COULD NOT CHECK';
    addLine(details, data.message || 'Something went wrong. Scan again.');
  }

  showView('result');
}

$('nextBtn').addEventListener('click', () => {
  $('manualInput').value = '';
  setScanMsg('');
  showView('scan');
  startCamera();
});

/* ---------- Manual entry ---------- */

$('manualBtn').addEventListener('click', () => {
  const code = $('manualInput').value.trim();
  if (code) handleCode(code);
});
$('manualInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('manualBtn').click(); });

/* ---------- Start ---------- */

if (doorCode) {
  unlock(doorCode, { silent: true });
} else {
  showView('lock');
}