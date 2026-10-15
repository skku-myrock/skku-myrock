export type PhotoCategory = '공연' | '행사' | '일상';
export type PhotoAlbum = { id:string; category:PhotoCategory; title:string; photos:readonly string[]; createdAt:string };
