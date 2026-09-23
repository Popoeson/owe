let photoUrl = null;
let videoUrl = null;

function setUploadStatus(el, text, cls) {
  el.textContent = text;
  el.className = 'upload-status' + (cls ? ` ${cls}` : '');
}

function checkFormReady() {
  document.getElementById('submitBtn').disabled = !(photoUrl && videoUrl);
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
    photoUrl = await uploadToCloudinary(file, { onProgress: (p) => fill.style.width = `${p}%` });
    setUploadStatus(status, 'Photo uploaded', 'done');
  } catch (err) {
    setUploadStatus(status, err.message, 'fail');
  }
  checkFormReady();
});

document.getElementById('videoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  videoUrl = null; checkFormReady();

  const status = document.getElementById('videoStatus');

  if (file.size > MAX_VIDEO_BYTES) {
    setUploadStatus(status, 'Video is over 75MB — please choose a smaller file', 'fail');
    e.target.value = '';
    return;
  }

  const track = document.getElementById('videoProgressTrack');
  const fill = document.getElementById('videoProgressFill');
  track.style.display = 'block';
  setUploadStatus(status, 'Uploading…');

  try {
    videoUrl = await uploadToCloudinary(file, { onProgress: (p) => fill.style.width = `${p}%` });
    setUploadStatus(status, 'Video uploaded', 'done');
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
      bio: document.getElementById('bio').value,
      photoUrl,
      videoUrl
    });
    window.location.href = authorizationUrl; // off to Paystack's hosted checkout
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continue to payment — ₦5,000';
  }
});
