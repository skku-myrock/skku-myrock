export type ImageDimensions = { width: number; height: number };
export type DimensionAxis = 'width' | 'height';
export const MAX_IMAGE_DIMENSION = 8000;

export function initialImageDimensions(naturalWidth: number, naturalHeight: number): ImageDimensions {
  if (!naturalWidth || !naturalHeight) return { width: 0, height: 0 };
  const scale = Math.min(1, 800 / naturalWidth, 900 / naturalHeight);
  return { width: Math.max(1, Math.round(naturalWidth * scale)), height: Math.max(1, Math.round(naturalHeight * scale)) };
}

export function resizeImageDimensions(size: ImageDimensions, axis: DimensionAxis, input: number, locked: boolean): ImageDimensions {
  if (!Number.isFinite(input) || input < 1) return size;
  const value = Math.min(MAX_IMAGE_DIMENSION, Math.round(input));
  if (!locked || size.width < 1 || size.height < 1) return { ...size, [axis]: value };
  const ratio = size.width / size.height;
  const companion = Math.max(1, Math.round(axis === 'width' ? value / ratio : value * ratio));
  if (companion <= MAX_IMAGE_DIMENSION) return axis === 'width' ? { width: value, height: companion } : { width: companion, height: value };
  return axis === 'width'
    ? { width: Math.max(1, Math.round(MAX_IMAGE_DIMENSION * ratio)), height: MAX_IMAGE_DIMENSION }
    : { width: MAX_IMAGE_DIMENSION, height: Math.max(1, Math.round(MAX_IMAGE_DIMENSION / ratio)) };
}


export function restoreInitialImageDimensions(image: ImageDimensions & { naturalWidth: number; naturalHeight: number }): ImageDimensions {
  return image.naturalWidth > 0 && image.naturalHeight > 0
    ? initialImageDimensions(image.naturalWidth, image.naturalHeight)
    : { width: image.width, height: image.height };
}
