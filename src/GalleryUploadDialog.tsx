import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, Download, GripVertical, Trash2, X } from 'lucide-react';
import type { PhotoCategory } from './galleryData';
import {validateSourceImage} from './imageCompression';
import {uploadImagesBatch} from './imageUpload';
import {publishGalleryAlbum,updateGalleryAlbum} from './galleryApi';
import type {PhotoAlbum} from './galleryData';

type SelectedPhoto = { id: number; file: File | null; url: string; name: string };
const maxPhotoCount = 50;
const categoryOptions: PhotoCategory[] = ['공연', '행사', '일상'];

export default function GalleryUploadDialog({ onClose,onCreated,initialAlbum,onUpdated }: {
  onClose:() => void;
  onCreated?:(album:PhotoAlbum)=>void;
  initialAlbum?:PhotoAlbum;
  onUpdated?:(album:PhotoAlbum,cleanupPending:boolean)=>void;
}) {
  const [category, setCategory] = useState<PhotoCategory>(initialAlbum?.category??'공연');
  const [title, setTitle] = useState(initialAlbum?.title??'');
  const [photos, setPhotos] = useState<SelectedPhoto[]>(()=>initialAlbum?.photos.map((url,i)=>({
    id:i,file:null,url,name:'기존 사진 '+(i+1),
  }))??[]);
  const [dropActive, setDropActive] = useState(false);
  const [error, setError] = useState('');
  const [busy,setBusy]=useState(false);
  const busyRef=useRef(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const nextId = useRef(initialAlbum?.photos.length??0);
  const draggedPhotoId = useRef<number | null>(null);
  const dragDepth = useRef(0);
  const urls = useRef(new Set<string>());

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      urls.current.forEach(url => URL.revokeObjectURL(url));
      urls.current.clear();
      previousFocus?.focus();
    };
  }, []);

  function addPhotos(incoming: FileList | File[]) {
    if(busyRef.current)return;
    const files = Array.from(incoming);
    if (!files.length) return;
    const isValid = (file:File) => { try { validateSourceImage(file); return true; } catch { return false; } };
    const valid = files.filter(isValid);
    const invalid = files.filter(file => !isValid(file));
    const remaining = Math.max(0, maxPhotoCount - photos.length);
    const accepted = valid.slice(0, remaining);
    if (accepted.length) {
      const added = accepted.map(file => {
        const url = URL.createObjectURL(file);
        urls.current.add(url);
        return { id: nextId.current++, file, url, name:file.name };
      });
      setPhotos(previous => [...previous, ...added]);
    }
    const notices = [];
    if (invalid.length) notices.push('JPG, PNG, WebP 형식의 원본 30MB 이하 이미지만 추가할 수 있습니다. 제외된 파일: ' + invalid.length + '개');
    if (accepted.length < valid.length) notices.push('사진은 한 앨범에 최대 ' + maxPhotoCount + '장까지 선택할 수 있습니다.');
    setError(notices.join(' '));
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addPhotos(event.target.files);
    event.target.value = '';
  }

  function onAreaDragEnter(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current += 1;
    setDropActive(true);
  }

  function onAreaDragLeave(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDropActive(false);
  }

  function onAreaDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    addPhotos(event.dataTransfer.files);
  }

  function removePhoto(id: number) {
    if(busyRef.current)return;
    setPhotos(previous => previous.filter(photo => {
      if (photo.id !== id) return true;
      URL.revokeObjectURL(photo.url);
      urls.current.delete(photo.url);
      return false;
    }));
  }

  function movePhoto(id: number, offset: number) {
    if(busyRef.current)return;
    setPhotos(previous => {
      const from = previous.findIndex(photo => photo.id === id);
      const to = from + offset;
      if (from < 0 || to < 0 || to >= previous.length) return previous;
      const ordered = [...previous];
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      return ordered;
    });
  }

  function dropPhoto(targetId: number) {
    if(busyRef.current)return;
    const sourceId = draggedPhotoId.current;
    draggedPhotoId.current = null;
    if (sourceId === null || sourceId === targetId) return;
    setPhotos(previous => {
      const from = previous.findIndex(photo => photo.id === sourceId);
      const to = previous.findIndex(photo => photo.id === targetId);
      if (from < 0 || to < 0) return previous;
      const ordered = [...previous];
      const [moved] = ordered.splice(from, 1);
      ordered.splice(to, 0, moved);
      return ordered;
    });
  }

  async function saveAlbum(){
    if(busyRef.current)return;
    if(!title.trim()){setError('앨범 제목을 입력해 주세요.');return;}
    if(!photos.length){setError('사진을 한 장 이상 선택해 주세요.');return;}
    busyRef.current=true;setBusy(true);setError('');
    try{
      const newPhotos=photos.filter(photo=>photo.file!==null);
      const uploaded=newPhotos.length?await uploadImagesBatch(newPhotos.map(photo=>photo.file!),'gallery'):[];
      if(uploaded.length!==newPhotos.length)throw Error('사진 저장 개수가 일치하지 않습니다.');
      let next=0;
      const urls=photos.map(photo=>photo.file?uploaded[next++]:photo.url);
      if(initialAlbum){
        const result=await updateGalleryAlbum(initialAlbum,category,title.trim(),urls);
        onUpdated?.(result.album,result.cleanupPending);
      }else{
        const album=await publishGalleryAlbum(category,title.trim(),urls);
        onCreated?.(album);
      }
    }catch(reason){
      setError(reason instanceof Error?reason.message:'사진 등록에 실패했습니다.');
    }finally{
      busyRef.current=false;setBusy(false);
    }
  }
  function onDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape'&&!busyRef.current) {
      event.preventDefault();
      onClose();
    } else if (event.key === 'Tab' && dialogRef.current) {
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]):not([type="file"]), select:not([disabled]), [tabindex="0"]'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  const dropZone = <div className={'gallery-upload-dropzone' + (photos.length ? ' is-compact' : '') + (dropActive ? ' is-dragging' : '')}
        role="button" tabIndex={0} aria-label="사진 파일 선택 또는 드래그하여 추가"
        onClick={() => {if(!busyRef.current)inputRef.current?.click();}}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if(!busyRef.current)inputRef.current?.click();
          }
        }}
        onDragEnter={onAreaDragEnter} onDragOver={event => event.preventDefault()}
        onDragLeave={onAreaDragLeave} onDrop={onAreaDrop}>
        <span className="gallery-upload-symbol" aria-hidden="true"><Download size={35} strokeWidth={3}/></span>
        <strong>클릭 혹은 파일을 이곳에 드롭하세요.</strong>
        <span className="gallery-upload-dropzone-detail">여러 장을 한 번에 선택할 수 있습니다.</span>
      </div>;

  return <div className="gallery-upload-backdrop" data-async-busy={busy?'true':undefined} onMouseDown={event => {
    if (event.target === event.currentTarget&&!busyRef.current) onClose();
  }}>
    <section ref={dialogRef} className="gallery-upload-dialog" role="dialog" aria-modal="true"
      aria-labelledby="gallery-upload-title" onKeyDown={onDialogKeyDown}>
      <header className="gallery-upload-header">
        <div>
          <span className="eyebrow">PHOTO ARCHIVE</span>
          <h2 id="gallery-upload-title">{initialAlbum?'사진 수정':'사진 등록'}</h2>
          <p>{initialAlbum?'기존 갤러리 앨범을 수정합니다.':'새로운 갤러리 앨범을 구성합니다.'}</p>
        </div>
        <button ref={closeRef} type="button" className="gallery-close-button" disabled={busy} onClick={onClose} aria-label="사진 등록 창 닫기"><X size={21}/></button>
      </header>
      <p className="image-compression-notice" role="note">
        이미지를 저장할 때 자동으로 압축·크기 조정할 수 있습니다.
        <strong> 업로드된 이미지는 원본을 대체하지 못하므로 원본 사진을 별도로 보관해 주세요.</strong>
      </p>

      <div className="gallery-upload-fields">
        <label>구분
          <select disabled={busy} value={category} onChange={event => setCategory(event.target.value as PhotoCategory)}>
            {categoryOptions.map(option => <option value={option} key={option}>{option}</option>)}
          </select>
        </label>
        <label>제목
          <input type="text" disabled={busy} value={title} maxLength={150} onChange={event => setTitle(event.target.value)}
            placeholder="앨범 제목을 입력해 주세요" />
        </label>
      </div>

      <div className="gallery-upload-image-heading">
        <strong>이미지</strong>
        <span>{photos.length} / {maxPhotoCount}장</span>
      </div>
      {photos.length === 0 && dropZone}
      <input ref={inputRef} type="file" multiple accept="image/jpeg,image/png,image/webp"
        className="gallery-upload-file-input" disabled={busy} onChange={onFileChange} aria-label="갤러리 이미지 파일 선택" />

      {error && <p className="gallery-upload-error" role="alert">{error}</p>}

      {photos.length > 0 && <div className="gallery-upload-selected" aria-label="선택한 사진 목록">
        <p>사진을 끌어서 순서를 변경하거나 화살표로 이동할 수 있습니다. 첫 번째 사진이 앨범 대표사진으로 사용됩니다.</p>
        <div className="gallery-upload-photo-grid">
          {photos.map((photo, index) => <div className="gallery-upload-photo-card" key={photo.id}
            draggable={!busy} onDragStart={event => {
              draggedPhotoId.current = photo.id;
              event.dataTransfer.effectAllowed = 'move';
              event.dataTransfer.setData('text/plain', String(photo.id));
            }} onDragEnd={() => { draggedPhotoId.current = null; }}
            onDragOver={event => { if (draggedPhotoId.current !== null) event.preventDefault(); }}
            onDrop={event => { event.preventDefault(); event.stopPropagation(); dropPhoto(photo.id); }}>
            <div className="gallery-upload-photo-preview">
              <img src={photo.url} alt={'선택된 사진 ' + (index + 1)} />
              <span className="gallery-upload-photo-index">{index === 0 ? '대표사진 · 01' : String(index + 1).padStart(2, '0')}</span>
            </div>
            <div className="gallery-upload-photo-meta">
              <span title={photo.name}><GripVertical size={13} aria-hidden="true"/>{photo.name}</span>
              <div className="gallery-upload-photo-actions">
                <button type="button" disabled={busy||index === 0} onClick={() => movePhoto(photo.id, -1)} aria-label={(index + 1) + '번째 사진 앞으로 이동'}><ArrowUp size={15}/></button>
                <button type="button" disabled={busy||index === photos.length - 1} onClick={() => movePhoto(photo.id, 1)} aria-label={(index + 1) + '번째 사진 뒤로 이동'}><ArrowDown size={15}/></button>
                <button type="button" className="gallery-upload-photo-remove" disabled={busy} onClick={() => removePhoto(photo.id)} aria-label={(index + 1) + '번째 사진 삭제'}><Trash2 size={15}/></button>
              </div>
            </div>
          </div>)}
          {dropZone}
        </div>
      </div>}

      <p className="gallery-upload-pending-note">사진 등록 시 WebP로 압축해 GitHub에 업로드합니다. 이미지 배포까지 시간이 걸릴 수 있습니다.</p>
      <footer className="gallery-upload-footer">
        <button type="button" className="outline-action" disabled={busy} onClick={onClose}>취소</button>
        <button type="button" className="button button-primary" disabled={busy||!title.trim()||photos.length===0} onClick={()=>void saveAlbum()}>{busy?'이미지 저장 중...':initialAlbum?'변경 사항 저장':'사진 등록'}</button>
      </footer>
    </section>
  </div>;
}
