const CLOUDINARY_CLOUD_NAME = 'contesto';
const CLOUDINARY_UPLOAD_PRESET = 'okizz_unsigned'; // create this unsigned preset in Cloudinary dashboard
const MAX_VIDEO_BYTES = 75 * 1024 * 1024; // 75MB, per BR-20

/**
 * Uploads a file directly to Cloudinary from the browser.
 * onProgress(percent) is called as the upload streams.
 * Returns the secure_url on success.
 */
function uploadToCloudinary(file, { onProgress } = {}) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText).secure_url);
      } else {
        reject(new Error('Upload failed'));
      }
    };
    xhr.onerror = () => reject(new Error('Upload failed — check your connection'));
    xhr.send(formData);
  });
}
