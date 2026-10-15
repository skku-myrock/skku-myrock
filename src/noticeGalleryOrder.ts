export type GalleryItem = { id: number };

export function reorderGalleryImages<T extends GalleryItem>(images: readonly T[], movedId: number, beforeId: number): T[] {
  const from = images.findIndex(image => image.id === movedId);
  const to = images.findIndex(image => image.id === beforeId);
  if (from === -1 || to === -1 || from === to) return [...images];
  const result = [...images];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

export function shiftGalleryImage<T extends GalleryItem>(images: readonly T[], id: number, offset: number): T[] {
  const index = images.findIndex(image => image.id === id);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= images.length) return [...images];
  return reorderGalleryImages(images, id, images[target].id);
}
