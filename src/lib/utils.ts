import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Resizes and compresses an image file to a lightweight data URL
 * to avoid exceeding localStorage quota or Firestore document size limits.
 */
export function compressImage(
  file: File,
  maxWidth = 600,
  maxHeight = 600,
  quality = 0.85
): Promise<string> {
  // Support 3-arg callers passing (file, maxDimension, quality) where maxHeight <= 1
  const resolvedMaxHeight = maxHeight > 0 && maxHeight <= 1 ? maxWidth : maxHeight;
  const resolvedQuality = maxHeight > 0 && maxHeight <= 1 ? maxHeight : quality;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > resolvedMaxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * resolvedMaxHeight) / height);
            height = resolvedMaxHeight;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = resolvedQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', q);
        // Step down quality if payload is still too large for Firestore doc limits (~750 KB data URL)
        while (dataUrl.length > 750_000 && q > 0.4) {
          q = Math.max(0.4, q - 0.12);
          dataUrl = canvas.toDataURL('image/jpeg', q);
        }
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to render image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

