let photoUrl = null;

function setUploadStatus(el, text, cls) {
  el.textContent = text;
  el.className = 'upload-status' + (cls ? ` ${cls}` : '');
}

function checkFormReady() {
  document.getElementById('submitBtn').disabled = !photoUrl;
}

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoUrl = null; checkFormReady();

  const track = document.getElementById('photoProgressTrack');
  const fill = document.getElementById('photoProgressFill');
  const status = document.getElementById('photoStatus');
  track.style.display = 'block';
  setUploadStatus(status, 'Uploading…');

  try {
    photoUrl = await uploadToCloudinary(file, 'image', { onProgress: (p) => fill.style.width = `${p}%` });
    setUploadStatus(status, 'Photo uploaded', 'done');
  } catch (err) {
    setUploadStatus(status, err.message, 'fail');
  }
  checkFormReady();
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('formError');
  errorEl.style.display = 'none';

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Starting payment…';

  try {
    const { authorizationUrl } = await apiPost('/register/initiate', {
      fullName: document.getElementById('fullName').value,
      stageName: document.getElementById('stageName').value,
      email: document.getElementById('email').value,
      whatsappNumber: document.getElementById('whatsappNumber').value,
      bio: document.getElementById('bio').value,
      photoUrl
    });
    window.location.href = authorizationUrl;
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue to payment — ₦5,000';
  }
});