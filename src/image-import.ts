/**
 * Turns a user-supplied image file into a 256×256 PNG blob for a piece set (MVP M1).
 *
 * Security: the file's bytes are sniffed (PNG / JPEG signatures only — SVG can carry
 * script and these images end up in `background-image`), then the image is decoded and
 * redrawn into a canvas, and only the canvas's own PNG encoding is kept. The uploaded
 * bytes never reach the page's CSS or the storage. Every failure is a typed, plain-Czech
 * `ImportError`; the caller leaves the current set untouched.
 */

export const PIECE_CANVAS = 256;
export const MAX_FILE_BYTES = 8 * 1024 * 1024; // decoded before the pixel check: keep the worst case small
export const MAX_PIXELS = 40_000_000;

export class ImportError extends Error {
  constructor(
    readonly code: 'type' | 'size' | 'decode' | 'pixels' | 'encode',
    message: string,
  ) {
    super(message);
  }
}

export const IMPORT_MESSAGES = {
  type: 'Tenhle soubor není PNG ani JPG.',
  size: 'Soubor je moc velký (max. 20 MB).',
  decode: 'Obrázek se nepodařilo načíst (poškozený soubor).',
  pixels: 'Obrázek je moc velký (max. 40 megapixelů).',
  encode: 'Obrázek se nepodařilo zpracovat.',
} as const;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_SIGNATURE = [0xff, 0xd8, 0xff];

/** 'png' | 'jpeg' from the first bytes, or null. Extension and `File.type` are ignored. */
export function sniffImageType(bytes: Uint8Array): 'png' | 'jpeg' | null {
  const starts = (sig: number[]): boolean => sig.every((b, i) => bytes[i] === b);
  if (starts(PNG_SIGNATURE)) return 'png';
  if (starts(JPEG_SIGNATURE)) return 'jpeg';
  return null;
}

export async function importPieceImage(file: Blob): Promise<Blob> {
  if (file.size > MAX_FILE_BYTES) throw new ImportError('size', IMPORT_MESSAGES.size);
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const type = sniffImageType(head);
  if (type === null) throw new ImportError('type', IMPORT_MESSAGES.type);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new ImportError('decode', IMPORT_MESSAGES.decode);
  }
  try {
    if (bitmap.width * bitmap.height > MAX_PIXELS) throw new ImportError('pixels', IMPORT_MESSAGES.pixels);
    if (bitmap.width === 0 || bitmap.height === 0) throw new ImportError('decode', IMPORT_MESSAGES.decode);

    const canvas = document.createElement('canvas');
    canvas.width = PIECE_CANVAS;
    canvas.height = PIECE_CANVAS;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImportError('encode', IMPORT_MESSAGES.encode);
    // Fit inside the square, centred, keeping the aspect ratio (like `background-size: contain`).
    const scale = PIECE_CANVAS / Math.max(bitmap.width, bitmap.height); // down or up, so the piece fills the square
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, Math.round((PIECE_CANVAS - w) / 2), Math.round((PIECE_CANVAS - h) / 2), w, h);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new ImportError('encode', IMPORT_MESSAGES.encode);
    return blob;
  } finally {
    bitmap.close();
  }
}
