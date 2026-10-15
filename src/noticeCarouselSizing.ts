export type SlideSize = { width?: number; height?: number };
export const DEFAULT_SLIDE_SIZE = { width: 320, height: 240 };

export function slideDimensions(slide: SlideSize) {
  return { width: slide.width && slide.width > 0 ? slide.width : DEFAULT_SLIDE_SIZE.width,
    height: slide.height && slide.height > 0 ? slide.height : DEFAULT_SLIDE_SIZE.height };
}

export function galleryFrame(sizes: readonly SlideSize[]) {
  const dimensions = sizes.map(slideDimensions);
  return { width: Math.max(1, ...dimensions.map(size => size.width)),
    height: Math.max(1, ...dimensions.map(size => size.height)) };
}
