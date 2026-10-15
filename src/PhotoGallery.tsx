import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Image as ImageIcon, Plus, X } from 'lucide-react';
import {listGalleryAlbums} from './galleryApi';
import GalleryUploadDialog from './GalleryUploadDialog';
import type { PhotoAlbum, PhotoCategory } from './galleryData';

const categories = ['전체', '공연', '행사', '일상'] as const;
type Filter = '전체' | PhotoCategory;
type PhotoKind = 'cover' | 'large' | 'thumb';

function PhotoSlot({ src, label, kind }: { src: string | null; label: string; kind: PhotoKind }) {
  if (src) {
    return <img className={'gallery-slot-image gallery-slot-' + kind} src={src} alt={label} loading={kind === 'large' ? 'eager' : 'lazy'} fetchPriority={kind === 'large' ? 'high' : 'low'} decoding="async" />;
  }
  return <div className={'gallery-slot-empty gallery-slot-' + kind} role="img" aria-label={label + ' (사진 미등록)'}>
    <ImageIcon size={kind === 'thumb' ? 16 : kind === 'large' ? 35 : 25} strokeWidth={1.35} aria-hidden="true" />
    {kind !== 'thumb' && <span>{kind === 'cover' ? '대표사진 준비 중' : label + ' 자리'}</span>}
  </div>;
}

export default function PhotoGallery({ canRegister }: { canRegister: boolean }) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [albums,setAlbums]=useState<PhotoAlbum[]>([]);
  const [loading,setLoading]=useState(true);
  const [loadError,setLoadError]=useState('');
  const [message,setMessage]=useState('');
  const [filter, setFilter] = useState<Filter>('전체');
  const [activeAlbum, setActiveAlbum] = useState<PhotoAlbum | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  async function reload(){
    setLoading(true);setLoadError('');
    try{setAlbums(await listGalleryAlbums());}
    catch(error){setLoadError(error instanceof Error?error.message:'갤러리를 불러오지 못했습니다.');}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    let alive=true;
    void listGalleryAlbums().then(items=>{if(alive)setAlbums(items);})
      .catch(error=>{if(alive)setLoadError(error instanceof Error?error.message:'갤러리 조회 실패');})
      .finally(()=>{if(alive)setLoading(false);});
    return ()=>{alive=false;};
  },[]);
  const filtered = filter === '전체' ? albums : albums.filter(album => album.category === filter);
  const count = activeAlbum?.photos.length ?? 0;

  function openAlbum(album: PhotoAlbum, event: ReactMouseEvent<HTMLButtonElement>) {
    openerRef.current = event.currentTarget;
    setPhotoIndex(0);
    setActiveAlbum(album);
  }

  function closeAlbum() { setActiveAlbum(null); }

  function goTo(delta: number) {
    if (count === 0) return;
    setPhotoIndex(index => (index + delta + count) % count);
  }

  useEffect(() => {
    if (!activeAlbum) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setActiveAlbum(null);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setPhotoIndex(index => (index + 1) % activeAlbum.photos.length);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setPhotoIndex(index => (index - 1 + activeAlbum.photos.length) % activeAlbum.photos.length);
      } else if (event.key === 'Tab' && dialogRef.current) {
        const buttons = Array.from(dialogRef.current.querySelectorAll<HTMLButtonElement>('button:not([disabled])'));
        if (!buttons.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      openerRef.current?.focus();
    };
  }, [activeAlbum]);

  useEffect(() => {
    if(!activeAlbum||!activeAlbum.photos.length)return;
    const count=activeAlbum.photos.length;
    for(const offset of [-1,1]){
      const src=activeAlbum.photos[(photoIndex+offset+count)%count];
      if(src){const image=new window.Image();image.src=src;}
    }
  },[activeAlbum,photoIndex]);

  function onTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function onTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const initial = touchStartRef.current;
    touchStartRef.current = null;
    if (!initial || !event.changedTouches.length) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - initial.x;
    const dy = touch.clientY - initial.y;
    if (Math.abs(dx) >= 45 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      goTo(dx < 0 ? 1 : -1);
    }
  }

  function onModalKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    // The document listener handles Escape/arrow keys even when focus is
    // within the thumbnail rail. Prevent accidental page scroll via space.
    if (event.key === ' ' && event.target === dialogRef.current) event.preventDefault();
  }

  return <section className="container section-block gallery-section">
    <div className="toolbar toolbar-bottom gallery-toolbar">
      <div className="tabs gallery-tabs" aria-label="갤러리 분류">
        {categories.map(category => <button type="button" key={category}
          aria-pressed={filter === category}
          className={filter === category ? 'active' : ''}
          onClick={() => setFilter(category)}>{category}</button>)}
      </div>
      {canRegister && <button type="button" className="admin-only-action" onClick={() => setUploadOpen(true)}>
        <Plus size={16} aria-hidden="true" /> 사진 등록
      </button>}
    </div>

    {loadError && <p className="gallery-load-error" role="alert">{loadError} <button type="button" onClick={()=>void reload()}>다시 시도</button></p>}
    {loading && <p className="gallery-empty-state" role="status">갤러리를 불러오는 중입니다.</p>}
    {!loading&&!loadError&&filtered.length===0&&<p className="gallery-empty-state">{albums.length===0?'아직 등록된 갤러리 앨범이 없습니다.':'이 분류에 등록된 앨범이 없습니다.'}</p>}
    <div className="gallery-album-grid">
      {filtered.map(album => <button type="button" key={album.id}
        className="gallery-album-card"
        onClick={event => openAlbum(album, event)}
        aria-label={album.title + ', 사진 ' + album.photos.length + '장 전체보기'}>
        <div className="gallery-album-cover">
          <PhotoSlot src={album.photos[0]} kind="cover" label={album.title + ' 대표사진'} />
          <span className="gallery-cover-count">{album.photos.length} PHOTOS</span>
        </div>
        <div className="gallery-album-details">
          <strong title={album.title}>{album.title}</strong>
          <span className="gallery-album-action">{album.category} <span aria-hidden="true">·</span> 전체보기 <ArrowUpRight size={15} aria-hidden="true" /></span>
        </div>
      </button>)}
    </div>

    {canRegister && uploadOpen && <GalleryUploadDialog onClose={() => setUploadOpen(false)} onCreated={album=>{
      setAlbums(previous=>[album,...previous]);
      setUploadOpen(false);
      setMessage('갤러리 앨범을 등록했습니다. 이미지 업로드까지 시간이 걸릴 수 있습니다.');
    }} />}

    {message&&<div className="site-bottom-toast is-success" role="status" aria-live="polite"><span>{message}</span><button type="button" aria-label="알림 닫기" onClick={()=>setMessage('')}>닫기</button></div>}
    {activeAlbum && <div className="gallery-lightbox-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) closeAlbum();
    }}>
      <section ref={dialogRef} className="gallery-lightbox" role="dialog" aria-modal="true"
        aria-labelledby="gallery-viewer-title"
        onKeyDown={onModalKeyDown}>
        <header className="gallery-lightbox-header">
          <div className="gallery-lightbox-titles">
            <span className="gallery-lightbox-category">{activeAlbum.category} · PHOTO ARCHIVE</span>
            <h2 id="gallery-viewer-title">{activeAlbum.title}</h2>
          </div>
          <button type="button" ref={closeButtonRef} className="gallery-close-button"
            onClick={closeAlbum} aria-label="사진 전체보기 닫기"><X size={23} /></button>
        </header>

        <div className="gallery-lightbox-layout">
          <div className="gallery-lightbox-left">
            <div className="gallery-photo-stage"
              onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touchStartRef.current = null; }}>
              <PhotoSlot src={activeAlbum.photos[photoIndex]}
                kind="large" label={'사진 ' + (photoIndex + 1)} />
              <button type="button" className="gallery-arrow gallery-arrow-prev"
                aria-label="이전 사진" onClick={() => goTo(-1)}><ArrowLeft size={22}/></button>
              <button type="button" className="gallery-arrow gallery-arrow-next"
                aria-label="다음 사진" onClick={() => goTo(1)}><ArrowRight size={22}/></button>
            </div>
            <div className="gallery-photo-pagination">
              <div className="gallery-photo-dots" aria-label="사진 위치">
                {activeAlbum.photos.map((_, index) => <button key={index} type="button"
                  className={'gallery-photo-dot' + (index === photoIndex ? ' active' : '')}
                  aria-label={(index + 1) + '번째 사진 보기'}
                  aria-current={index === photoIndex ? 'true' : undefined}
                  onClick={() => setPhotoIndex(index)} />)}
              </div>
              <span className="gallery-photo-count" aria-live="polite">{String(photoIndex + 1).padStart(2, '0')} / {String(count).padStart(2, '0')}</span>
            </div>
          </div>

          <aside className="gallery-thumb-panel" aria-label="사진 썸네일 목록">
            <div className="gallery-thumb-heading">전체 사진 <span>{count}</span></div>
            <div className="gallery-thumb-list">
              {activeAlbum.photos.map((src, index) => <button key={index} type="button"
                className={'gallery-thumb-button' + (index === photoIndex ? ' selected' : '')}
                aria-pressed={index === photoIndex}
                aria-label={(index + 1) + '번째 사진으로 이동'}
                onClick={() => setPhotoIndex(index)}>
                <PhotoSlot kind="thumb" src={src} label={'사진 ' + (index + 1) + ' 썸네일'} />
                <span>{String(index + 1).padStart(2, '0')}</span>
              </button>)}
            </div>
          </aside>
        </div>

      </section>
    </div>}
  </section>;
}
