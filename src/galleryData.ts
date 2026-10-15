export type PhotoCategory = '공연' | '행사' | '일상';

export type PhotoAlbum = {
  id: string;
  category: PhotoCategory;
  title: string;
  // Demo albums have a fixed 5–7 empty photo slots per event.
  // Replace individual null values with real URLs when storage is connected.
  photos: readonly (string | null)[];
};

const fiveEmptyPhotos: readonly null[] = [null, null, null, null, null];
const sixEmptyPhotos: readonly null[] = [null, null, null, null, null, null];
const sevenEmptyPhotos: readonly null[] = [null, null, null, null, null, null, null];

export const photoAlbums: readonly PhotoAlbum[] = [
  {
    id: '2026-01-15-white-noise',
    category: '공연',
    title: '2026. 01. 15. 모여락 x 아이코닉 연합공연 "White Noise"',
    photos: fiveEmptyPhotos,
  },
  {
    id: '2026-02-08-amang',
    category: '공연',
    title: '2026. 02. 08. 모여락 x 아망 연합공연',
    photos: sixEmptyPhotos,
  },
  {
    id: '2026-05-16-regular',
    category: '공연',
    title: '2026. 05. 16. 모여락 2026 1학기 정기공연',
    photos: sevenEmptyPhotos,
  },
  {
    id: '2026-07-18-summer',
    category: '공연',
    title: '2026. 07. 18. 2026 모여락 여름 공연',
    photos: fiveEmptyPhotos,
  },
  {
    id: '2026-08-22-youth-on-tape',
    category: '공연',
    title: '2026. 08. 22. 소리사랑 x 모여락 여름 연합공연 "Youth on Tape"',
    photos: sevenEmptyPhotos,
  },
  {
    id: '2026-08-29-joint',
    category: '공연',
    title: '2026. 08. 29. 신록 x 아망 x 모여락 연합공연',
    photos: sixEmptyPhotos,
  },
  {
    id: '2026-freshmen-orientation',
    category: '행사',
    title: '2026년도 자/생/스 새내기 새로배움터',
    photos: fiveEmptyPhotos,
  },
  {
    id: '2026-spring-mt',
    category: '행사',
    title: '2026년도 1학기 모여락 MT',
    photos: sevenEmptyPhotos,
  },
  {
    id: '2026-regular-rehearsal-feedback',
    category: '일상',
    title: '2026년도 1학기 정기공연 구성팀 합주 피드백 모습',
    photos: sixEmptyPhotos,
  },
  {
    id: '2026-10-10-guitar-class',
    category: '일상',
    title: '2026. 10. 10. 기타 클래스',
    photos: fiveEmptyPhotos,
  },
];
