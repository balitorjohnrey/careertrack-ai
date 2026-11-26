import sharp from 'sharp';
import { AppError, requireValue } from '../domain.mjs';

// The browser sends a cropped thumbnail. Decode and re-encode it before storage.
export async function prepareProfilePhoto(photo) {
  if (photo === null) return null;
  requireValue(
    typeof photo === 'string' &&
      photo.length <= 44000 &&
      /^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(photo),
    'Choose a valid photo and try again.',
  );
  const bytes = Buffer.from(photo, 'base64');
  try {
    const image = sharp(bytes, { limitInputPixels: 256 * 256, failOn: 'warning' });
    const meta = await image.metadata();
    if (meta.format !== 'jpeg' || meta.width !== 256 || meta.height !== 256)
      throw new Error('Invalid thumbnail');
    const jpeg = await image.jpeg({ quality: 81 }).toBuffer();
    if (jpeg.length <= 24576) return jpeg.toString('base64');
    const compact = await image.resize(192, 192).jpeg({ quality: 68 }).toBuffer();
    if (compact.length <= 24576) return compact.toString('base64');
  } catch {
    throw new AppError(400, 'This photo could not be read. Choose another image.');
  }
  throw new AppError(400, 'This photo could not be resized. Choose another image.');
}
