const DOOR_KEY = 'okizzDoorCode';
let doorCode = sessionStorage.getItem(DOOR_KEY) || '';
let stream = null;
let scanning = false;
let busy = false;

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

function showView(name) {
  $('lockView').style.display = name === 'lock' ? 'block' : 'none';
  $('scanView').style.display = name === 'scan' ? 'block' : 'none';
  $('resultView').style.display = name === 'result' ? 'flex' : 'none';
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
  showView('lock');
});

/* ---------- Camera + QR decoding ---------- */

async function startCamera() {
  busy = false;
  if (stream) { scanning = true; requestAnimationFrame(tick); return; }

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } },
      audio: false
    });
    video.srcObject = stream;
    await video.play();
    $('cameraError').style.display = 'none';
    scanning = true;
    requestAnimationFrame(tick);
  } catch (_) {
    $('cameraError').textContent = 'Camera unavailable. Allow camera access in your browser, or type the ticket code below.';
    $('cameraError').style.display = 'block';
  }
}

function stopCamera() {
  scanning = false;
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  video.srcObject = null;
}

function tick() {
  if (!scanning) return;

  if (!busy && video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
    const scale = Math.min(1, 640 / video.videoWidth);
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;

    ctx.drawImage(video, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const found = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' });
    if (found && found.data) handleCode(found.data);
  }
  requestAnimationFrame(tick);
}

/* ---------- Checking a code ---------- */

async function handleCode(raw) {
  if (busy) return;
  busy = true;

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
  showView('scan');
  startCamera();
});

/* ---------- Manual entry (fallback if the camera won't work) ---------- */

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