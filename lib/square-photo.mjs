export async function squarePhoto(file, { pixels, maxLength = Infinity }) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type))
    throw new Error('Choose a JPG, PNG, or WebP image.');
  if (file.size > 10 * 1024 * 1024) throw new Error('Choose a photo smaller than 10 MB.');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode().catch(() => {
      throw new Error('This image could not be opened. Choose another photo.');
    });
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = pixels;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Your browser could not prepare this photo.');
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, pixels, pixels);
    ctx.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      pixels,
      pixels,
    );
    for (const quality of [0.84, 0.66, 0.48]) {
      const jpeg = canvas.toDataURL('image/jpeg', quality).split(',')[1];
      if (jpeg && jpeg.length <= maxLength) return jpeg;
    }
    throw new Error('This photo could not be resized. Choose another image.');
  } finally {
    URL.revokeObjectURL(url);
  }
}
