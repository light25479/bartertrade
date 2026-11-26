const MAX_SIDE = 1600;
const QUALITY = 0.8;

async function loadImage(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      // Applies the phone's rotation so photos are not sideways
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      /* fall through to the older method */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('unsupported'));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Shrinks a photo to at most 1600px on its longest side and saves it as a JPEG
export async function compressImage(file) {
  const image = await loadImage(file);
  const w = image.naturalWidth || image.width;
  const h = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs get a white background
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0, width, height);
  if (image.close) image.close();

  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Could not process the photo');

  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], name, { type: 'image/jpeg' });
}