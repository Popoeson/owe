let photoUrl = null;

function setUploadStatus(el, text, cls) {
  el.textContent = text;
  el.className = 'upload-status' + (cls ? ` ${cls}` : '');
}

function updateEntryProgress() {
  const detailsOk = !!(
    document.getElementById('fullName').value.trim() &&
    document.getElementById('stageName').value.trim() &&
    document.getElementById('email').value.trim() &&
    document.getElementById('whatsappNumber').value.trim()
  );
  const bioOk = document.getElementById('bio').value.trim().length > 0;
  const photoOk = !!photoUrl;

  document.getElementById('check-details').classList.toggle('done', detailsOk);
  document.getElementById('check-bio').classList.toggle('done', bioOk);
  document.getElementById('check-photo').classList.toggle('done', photoOk);

  const doneCount = [detailsOk, bioOk, photoOk].filter(Boolean).length;
  document.getElementById('entryReady').textContent = `${doneCount}/3 ready`;
  document.getElementById('entryProgressFill').style.width = `${(doneCount / 3) * 100}%`;
  document.getElementById('submitBtn').disabled = doneCount < 3;
}

['fullName', 'stageName', 'email', 'whatsappNumber', 'bio'].forEach((id) => {
  document.getElementById(id).addEventListener('input', updateEntryProgress);
});

document.getElementById('photoInput').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  photoUrl = null; updateEntryProgress();

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
  updateEntryProgress();
});

document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('formError');
  errorEl.style.display = 'none';

  const submitBtn = document.getElementById('submitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = 'Starting payment…';

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
    submitBtn.innerHTML = '<i class="fa-solid fa-lock"></i> Pay ₦5,000 to submit';
  }
});