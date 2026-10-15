import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, ImagePlus, Link, Link2Off, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {createNotice,updateNotice} from './noticesData';
import type {NoticeCategory,NoticePost,NoticeBlock,NoticeImage} from './noticesData';
import {uploadImagesBatch} from './imageUpload';
import {useEditorLeaveGuard} from './useEditorLeaveGuard';
import {validateSourceImage} from './imageCompression';
import { initialImageDimensions, MAX_IMAGE_DIMENSION, resizeImageDimensions, restoreInitialImageDimensions } from './noticeImageSize';
import { reorderGalleryImages, shiftGalleryImage } from './noticeGalleryOrder';
import type { DimensionAxis } from './noticeImageSize';
import NoticeImageCarousel from './NoticeImageCarousel';
import type { NoticeSlide } from './NoticeImageCarousel';

type ImageBlock = { id: number; kind: 'image'; url: string; name: string; width: number; height: number; ratioLocked: boolean; naturalWidth: number; naturalHeight: number };
type DraftBlock = { id: number; kind: 'text'; text: string } | ImageBlock | { id: number; kind: 'gallery'; images: ImageBlock[] };

export default function NoticeComposer({ onBack, onSaved, initial, registerLeaveGuard }: { onBack: () => void; onSaved: (post:NoticePost) => void; initial?:NoticePost; registerLeaveGuard:(guard:(()=>boolean)|null)=>void }) {
  const [title, setTitle] = useState(initial?.title??'');
  const [category, setCategory] = useState<NoticeCategory>(initial?.category??'공지');
  const [blocks, setBlocks] = useState<DraftBlock[]>(()=>{
    if(!initial?.blocks?.length)return [{id:1,kind:'text',text:''}];
    const hydrate=(image:NoticeImage,id:number):ImageBlock=>({...image,id,kind:'image',width:Number(image.width),height:Number(image.height),naturalWidth:Number(image.naturalWidth),naturalHeight:Number(image.naturalHeight)});
    return initial.blocks.map((block,i)=>block.kind==='text'?{id:i+1,kind:'text',text:block.text}:block.kind==='image'?hydrate(block,i+1):{id:i+1,kind:'gallery',images:block.images.map((image,j)=>hydrate(image,1000+i*30+j))});
  });
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [busy,setBusy]=useState(false);
  const [dimensionDrafts,setDimensionDrafts]=useState<Record<string,string>>({});
  const [dimensionErrors,setDimensionErrors]=useState<Record<string,string>>({});
  const localFiles=useRef(new Map<string,File>());
  const uploaded=useRef(new Map<string,string>());
  const nextId = useRef(100000);
  const objectUrls = useRef<string[]>([]);
  const draggingSlide = useRef<{ groupId: number; imageId: number } | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [newImagePickerOpen,setNewImagePickerOpen]=useState(false);
  const [slidePickerId,setSlidePickerId]=useState<number|null>(null);
  const [pickerUrl,setPickerUrl]=useState('');
  const originalDraft=useRef(JSON.stringify({title,category,blocks}));
  const hasUnsavedChanges=JSON.stringify({title,category,blocks})!==originalDraft.current||Boolean(pickerUrl.trim())||Object.keys(dimensionDrafts).length>0;
  useEditorLeaveGuard(hasUnsavedChanges||busy,registerLeaveGuard);

  useEffect(() => () => { objectUrls.current.forEach(url => URL.revokeObjectURL(url)); }, []);

  function addText() {
    setBlocks(previous => [...previous, { id: nextId.current++, kind: 'text', text: '' }]);
    setPreview(false);
  }
  function addImages(event: ChangeEvent<HTMLInputElement>, targetBlockId?: number) {
    const selected = Array.from(event.target.files ?? []);
    if (!selected.length) return;
    const target = targetBlockId === undefined ? null : blocks.find(block => block.id === targetBlockId);
    if (targetBlockId !== undefined && (!target || target.kind === 'text')) {
      setError('이미지를 추가할 슬라이드를 찾을 수 없습니다.');
      event.target.value = '';
      return;
    }
    try{selected.forEach(validateSourceImage);}
    catch(reason){setError(reason instanceof Error?reason.message:'이미지 파일을 확인해 주세요.');event.target.value='';return;}
    const existingCount = target?.kind === 'gallery' ? target.images.length : target?.kind === 'image' ? 1 : 0;
    if (selected.length + existingCount > 20) {
      setError('한 슬라이드에는 최대 20장까지 추가할 수 있습니다.');
      event.target.value = '';
      return;
    }
    const newImages: ImageBlock[] = selected.map(file => {
      const url = URL.createObjectURL(file);
      objectUrls.current.push(url);
      localFiles.current.set(url,file);
      return { id: nextId.current++, kind: 'image', url, name: file.name, width: 0, height: 0,
        ratioLocked: true, naturalWidth: 0, naturalHeight: 0 };
    });
    setBlocks(previous => targetBlockId === undefined
      ? [...previous, selected.length > 1
        ? { id: nextId.current++, kind: 'gallery', images: newImages } : newImages[0]]
      : previous.map(block => {
          if (block.id !== targetBlockId) return block;
          if (block.kind === 'image') return { id: block.id, kind: 'gallery', images: [block, ...newImages] };
          if (block.kind === 'gallery') return { ...block, images: [...block.images, ...newImages] };
          return block;
        }));
    for (const image of newImages) {
      const loader = new Image();
      loader.onload = () => setNaturalSize(image.id, loader.naturalWidth, loader.naturalHeight);
      loader.src = image.url;
    }
    setError('');
    setPreview(false);
    setNewImagePickerOpen(false);
    setSlidePickerId(null);
    setPickerUrl('');
    event.target.value = '';
  }
  function toggleImagePicker(targetBlockId?:number) {
    const alreadyOpen=targetBlockId===undefined?newImagePickerOpen:slidePickerId===targetBlockId;
    setNewImagePickerOpen(targetBlockId===undefined?!alreadyOpen:false);
    setSlidePickerId(targetBlockId===undefined?null:alreadyOpen?null:targetBlockId);
    setPickerUrl('');
    setError('');
    setPreview(false);
  }
  function addUrlImage(targetBlockId?:number) {
    const input=pickerUrl.trim();
    let parsed:URL;
    try {
      parsed=new URL(input);
      if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('bad protocol');
    }catch{
      setError('이미지 URL은 https://로 시작하는 올바른 주소여야 합니다.');
      return;
    }
    const target=targetBlockId===undefined?null:blocks.find(block=>block.id===targetBlockId);
    if(targetBlockId!==undefined&&(!target||target.kind==='text')){
      setError('사진을 추가할 슬라이드를 찾을 수 없습니다.');return;
    }
    if(target?.kind==='gallery'&&target.images.length>=20){
      setError('한 슬라이드에는 최대 20장까지 추가할 수 있습니다.');return;
    }
    const image:ImageBlock={
      id:nextId.current++,kind:'image',url:parsed.href,
      name:decodeURIComponent(parsed.pathname.split('/').pop()||parsed.hostname).slice(0,150),
      width:0,height:0,ratioLocked:true,naturalWidth:0,naturalHeight:0,
    };
    setBlocks(previous=>targetBlockId===undefined?[...previous,image]:previous.map(block=>{
      if(block.id!==targetBlockId)return block;
      if(block.kind==='image')return {id:block.id,kind:'gallery',images:[block,image]};
      if(block.kind==='gallery')return {...block,images:[...block.images,image]};
      return block;
    }));
    const loader=new Image();
    loader.onload=()=>setNaturalSize(image.id,loader.naturalWidth,loader.naturalHeight);
    loader.onerror=()=>setError('URL 이미지를 불러오지 못했습니다. 주소와 이미지 공개 설정을 확인해 주세요.');
    loader.src=image.url;
    setNewImagePickerOpen(false);
    setSlidePickerId(null);
    setPickerUrl('');
    setError('');
    setPreview(false);
  }
  function imagePicker(targetBlockId?:number) {
    const pickerLabel=targetBlockId===undefined?'본문 이미지':'슬라이드 이미지';
    return <div className={targetBlockId===undefined?'notice-composer-image-picker is-new-image':'notice-composer-image-picker'} role="group" aria-label={pickerLabel+' 추가'}>
      <div className="notice-composer-image-picker-heading"><strong>이미지 추가</strong><span>이미지 URL 또는 파일을 선택하세요.</span></div>
      <div className="notice-composer-image-picker-controls">
        <label className="notice-composer-image-picker-url">이미지 URL
          <input type="url" placeholder="https://example.com/photo.jpg" value={pickerUrl}
            aria-label={pickerLabel+' URL'} onChange={event=>setPickerUrl(event.target.value)}
            onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();addUrlImage(targetBlockId);}}}/>
        </label>
        <button type="button" className="outline-action" disabled={!pickerUrl.trim()} onClick={()=>addUrlImage(targetBlockId)}>URL 이미지 추가</button>
        <label className="outline-action notice-composer-file notice-composer-picker-file"><ImagePlus size={15}/> 파일 업로드
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple
            onChange={event=>addImages(event,targetBlockId)}
            aria-label={targetBlockId===undefined?'본문 이미지 선택':'슬라이드에 추가할 이미지 선택'}/>
        </label>
      </div>
      <p>여러 파일을 선택하면 이미지 슬라이드로 표시됩니다. 원본 30MB 이하의 JPG·PNG·WebP 사진은 저장 시 자동 압축됩니다.</p>
    </div>;
  }
  function changeText(id: number, text: string) {
    setBlocks(previous => previous.map(block => block.id === id && block.kind === 'text' ? { ...block, text } : block));
  }
  function setNaturalSize(id: number, naturalWidth: number, naturalHeight: number) {
    if (naturalWidth < 1 || naturalHeight < 1) return;
    const update = (image: ImageBlock): ImageBlock => image.id !== id ||
      (image.naturalWidth === naturalWidth && image.naturalHeight === naturalHeight)
      ? image : { ...image, naturalWidth, naturalHeight,
          ...(image.width === 0 ? initialImageDimensions(naturalWidth, naturalHeight) : {}) };
    setBlocks(previous => previous.map(block => block.kind === 'gallery'
      ? { ...block, images: block.images.map(update) } : block.kind === 'image' ? update(block) : block));
  }
  function changeImageSize(id: number, axis: DimensionAxis, value: number) {
    setBlocks(previous => previous.map(block => {
      if (block.kind === 'gallery') return { ...block, images: block.images.map(image =>
        image.id === id ? { ...image, ...resizeImageDimensions(image, axis, value, image.ratioLocked) } : image) };
      return block.kind === 'image' && block.id === id
        ? { ...block, ...resizeImageDimensions(block, axis, value, block.ratioLocked) } : block;
    }));
  }
  const dimensionKey=(id:number,axis:DimensionAxis)=>id+':'+axis;
  function commitDimension(id:number,axis:DimensionAxis,raw:string){
    const key=dimensionKey(id,axis),value=raw.trim(),number=Number(value);
    if(!/^[0-9]+$/.test(value)||!Number.isInteger(number)||number<1||number>MAX_IMAGE_DIMENSION){
      setDimensionErrors(prev=>({...prev,[key]:'1~'+MAX_IMAGE_DIMENSION+' 사이의 정수를 입력해 주세요.'}));
      return;
    }
    setDimensionErrors(prev=>{const next={...prev};delete next[key];return next;});
    setDimensionDrafts(prev=>{const next={...prev};delete next[key];return next;});
    changeImageSize(id,axis,number);
  }
  function dimensionInput(image:ImageBlock,axis:DimensionAxis,label:string){
    const key=dimensionKey(image.id,axis);
    return <label>{axis==='width'?'W':'H'}
      <input type="number" min={1} max={MAX_IMAGE_DIMENSION} step={1} inputMode="numeric"
        aria-label={label} aria-invalid={Boolean(dimensionErrors[key])}
        value={dimensionDrafts[key]??(image[axis]||'')} disabled={!image[axis]}
        onChange={event=>setDimensionDrafts(prev=>({...prev,[key]:event.target.value}))}
        onBlur={event=>commitDimension(image.id,axis,event.currentTarget.value)}/>
      <span>px</span>
    </label>;
  }
  function dimensionWarning(id:number){
    const warning=dimensionErrors[dimensionKey(id,'width')]||dimensionErrors[dimensionKey(id,'height')];
    return warning?<p className="notice-dimension-error" role="alert">{warning}</p>:null;
  }
  function toggleImageRatio(id: number) {
    setBlocks(previous => previous.map(block => {
      if (block.kind === 'gallery') return { ...block, images: block.images.map(image =>
        image.id === id ? { ...image, ratioLocked: !image.ratioLocked } : image) };
      return block.kind === 'image' && block.id === id ? { ...block, ratioLocked: !block.ratioLocked } : block;
    }));
  }
  function restoreImageSize(id: number) {
    const restore = (image: ImageBlock): ImageBlock => image.id === id
      ? { ...image, ...restoreInitialImageDimensions(image), ratioLocked: true } : image;
    setBlocks(previous => previous.map(block => block.kind === 'gallery'
      ? { ...block, images: block.images.map(restore) } : block.kind === 'image' ? restore(block) : block));
  }
  function moveGallerySlide(groupId: number, imageId: number, offset: number) {
    setBlocks(previous => previous.map(block => block.id === groupId && block.kind === 'gallery'
      ? { ...block, images: shiftGalleryImage(block.images, imageId, offset) } : block));
  }
  function startSlideDrag(event: DragEvent<HTMLButtonElement>, groupId: number, imageId: number) {
    draggingSlide.current = { groupId, imageId };
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(imageId));
  }
  function dropSlide(event: DragEvent<HTMLDivElement>, groupId: number, targetId: number) {
    event.preventDefault();
    const dragged = draggingSlide.current;
    draggingSlide.current = null;
    setDropTarget(null);
    if (!dragged || dragged.groupId !== groupId) return;
    setBlocks(previous => previous.map(block => block.id === groupId && block.kind === 'gallery'
      ? { ...block, images: reorderGalleryImages(block.images, dragged.imageId, targetId) } : block));
  }
  function removeSlide(groupId: number, imageId: number) {
    setBlocks(previous => previous.flatMap(block => block.id === groupId && block.kind === 'gallery'
      ? block.images.length === 1 ? [] : [{ ...block, images: block.images.filter(image => image.id !== imageId) }]
      : [block]));
  }
  function gallerySlides(images: ImageBlock[]): NoticeSlide[] {
    return images.map(image => ({ id: image.id, src: image.url, alt: image.name,
      width: image.width || 320, height: image.height || 240,
      onLoad: (width: number, height: number) => setNaturalSize(image.id, width, height) }));
  }
  function moveBlock(index: number, offset: number) {
    setBlocks(previous => {
      const to = index + offset;
      if (to < 0 || to >= previous.length) return previous;
      const next = [...previous];
      [next[index], next[to]] = [next[to], next[index]];
      return next;
    });
  }
  function removeBlock(id: number) {
    setBlocks(previous => previous.filter(block => block.id !== id));
  }
  async function publish(){
    if(busy)return;
    if(!title.trim()){setError('제목을 입력해 주세요.');return;}
    const activeIds=new Set(blocks.flatMap(block=>block.kind==='image'?[block.id]:block.kind==='gallery'?block.images.map(image=>image.id):[]));
    if(Object.entries(dimensionErrors).some(([key,msg])=>msg&&activeIds.has(Number(key.split(':')[0])))){
      setError('잘못된 이미지 크기를 수정한 뒤 저장해 주세요.');return;
    }
    setError('');setBusy(true);
    try{
      const allImages=blocks.flatMap(block=>block.kind==='image'?[block]:block.kind==='gallery'?block.images:[]);
      const pending=[...new Set(allImages.map(image=>image.url).filter(url=>localFiles.current.has(url)&&!uploaded.current.has(url)))];
      if(pending.length){
        const urls=await uploadImagesBatch(pending.map(url=>localFiles.current.get(url)!),'notices');
        pending.forEach((url,i)=>uploaded.current.set(url,urls[i]));
      }
      const serialize=(image:ImageBlock):NoticeImage=>({kind:'image',url:uploaded.current.get(image.url)??image.url,name:image.name,width:image.width,height:image.height,ratioLocked:image.ratioLocked,naturalWidth:image.naturalWidth,naturalHeight:image.naturalHeight});
      const payload:NoticeBlock[]=blocks.map(block=>block.kind==='text'?{kind:'text',text:block.text}:block.kind==='image'?serialize(block):{kind:'gallery',images:block.images.map(serialize)});
      const input={title,category,blocks:payload};
      const saved=initial?await updateNotice(initial.id,{...input,expectedUpdateTime:initial.updateTime}):await createNotice(input);
      registerLeaveGuard(null);
      onSaved(saved);
    }catch(reason){setError(reason instanceof Error?reason.message:'공지사항 저장에 실패했습니다.');}
    finally{setBusy(false);}
  }
  function back() {onBack();}

  return <>
    <div className="page-heading container"><span className="eyebrow">NOTICE EDITOR</span>
      <h1>{initial?'공지사항 수정하기':'공지사항 글쓰기'}</h1><p>글을 작성하고 이미지 위치를 조정할 수 있습니다.</p>
    </div>
    <section className="container section-block notice-composer-page">
      <button type="button" className="notice-detail-back" onClick={back}><ArrowLeft size={16}/> 공지사항 목록</button>
      <div className="notice-composer-info" role="note">이미지를 저장할 때 자동으로 압축·크기 조정할 수 있습니다. <strong>업로드된 이미지는 원본을 대체하지 못하므로 원본 사진을 별도로 보관해 주세요.</strong></div>
      <div className="notice-composer-fields">
        <label>분류
          <select value={category} onChange={event => setCategory(event.target.value as NoticeCategory)}>
            <option value="공지">공지</option><option value="공연">공연</option><option value="행사">행사</option>
          </select>
        </label>
        <label>제목
          <input value={title} maxLength={150} placeholder="공지사항 제목을 입력하세요" onChange={event => setTitle(event.target.value)}/>
        </label>
      </div>
      <div className="notice-composer-top"><h2>본문</h2><p>글과 이미지를 원하는 순서로 배치하세요. 글자 크기 등의 서식 편집은 지원하지 않습니다.</p></div>
      {preview ? <div className="notice-composer-preview" aria-label="게시글 미리보기">
        <span className="notice-detail-category">{category}</span>
        <h3>{title.trim() || '제목 없음'}</h3>
        {blocks.map(block => block.kind === 'text'
          ? <p key={block.id}>{block.text || ' '}</p>
          : block.kind === 'gallery'
          ? <NoticeImageCarousel key={block.id} label="작성 중인 이미지 슬라이드 미리보기" slides={gallerySlides(block.images)}/>
          : <div key={block.id} className="notice-composer-preview-image"
              style={{ width: block.width || 320, aspectRatio: block.width && block.height ? `${block.width} / ${block.height}` : '4 / 3' }}>
              <img className="notice-composer-resized-image" src={block.url} alt={block.name} onLoad={event => setNaturalSize(block.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}/>
            </div>)}
      </div> : <div className="notice-composer-blocks">
        {blocks.map((block, index) => <div key={block.id} className="notice-composer-block">
          <div className="notice-composer-block-top">
            <strong>{block.kind === 'text' ? '텍스트' : block.kind === 'gallery' ? '이미지 슬라이드' : '이미지'} {index + 1}</strong>
            <div className="notice-composer-block-actions">
              <button type="button" aria-label={'블록 ' + (index + 1) + ' 위로 이동'} disabled={index === 0} onClick={() => moveBlock(index, -1)}><ArrowUp size={15}/></button>
              <button type="button" aria-label={'블록 ' + (index + 1) + ' 아래로 이동'} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)}><ArrowDown size={15}/></button>
              <button type="button" aria-label={'블록 ' + (index + 1) + ' 삭제'} onClick={() => removeBlock(block.id)}><Trash2 size={15}/></button>
            </div>
          </div>
          {block.kind === 'text' ?
            <textarea aria-label={'본문 텍스트 ' + (index + 1)} value={block.text} rows={5} placeholder="내용을 입력하세요."
              onChange={event => changeText(block.id, event.target.value)}/> :
            block.kind === 'gallery' ? <div className="notice-composer-gallery">
              <NoticeImageCarousel label="작성 중인 이미지 슬라이드" slides={gallerySlides(block.images)}/>
              <button type="button" className="outline-action notice-composer-gallery-add"
                aria-expanded={slidePickerId===block.id} onClick={()=>toggleImagePicker(block.id)}>
                <ImagePlus size={15}/> 슬라이드에 사진 추가
              </button>
              <p className="notice-composer-gallery-note">사진을 드래그하거나 이동 버튼으로 순서를 바꿀 수 있습니다. 각 이미지의 크기는 따로 설정하며, 슬라이드 영역은 가장 넓고 가장 높은 이미지에 맞춰집니다.</p>
              <div className="notice-composer-gallery-sizes">
                {block.images.map((image, imageIndex) => <div key={image.id}
                  className={`notice-composer-gallery-size-row${dropTarget === image.id ? ' is-drop-target' : ''}`}
                  onDragOver={event => {
                    if (draggingSlide.current?.groupId === block.id) { event.preventDefault(); setDropTarget(image.id); }
                  }}
                  onDrop={event => dropSlide(event, block.id, image.id)}>
                  <div className="notice-composer-gallery-size-heading">
                    <button type="button" draggable className="notice-composer-gallery-drag-handle"
                      title="드래그해서 이미지 순서 변경" aria-label={(imageIndex + 1) + '번째 이미지 순서 드래그'}
                      onDragStart={event => startSlideDrag(event, block.id, image.id)}
                      onDragEnd={() => { draggingSlide.current = null; setDropTarget(null); }}><GripVertical size={17}/></button>
                    <img className="notice-composer-gallery-thumb" src={image.url} alt="" draggable={false}/>
                    <strong className="notice-composer-gallery-file-label">
                      <span className="notice-composer-gallery-image-number">{imageIndex + 1}번째 이미지</span>
                      <span className="notice-composer-gallery-filename" title={image.name}>{image.name}</span>
                    </strong>
                    <div className="notice-composer-gallery-order-actions">
                      <button type="button" disabled={imageIndex === 0} aria-label={(imageIndex + 1) + '번째 이미지 앞으로 이동'}
                        onClick={() => moveGallerySlide(block.id, image.id, -1)}><ArrowUp size={14}/></button>
                      <button type="button" disabled={imageIndex === block.images.length - 1} aria-label={(imageIndex + 1) + '번째 이미지 뒤로 이동'}
                        onClick={() => moveGallerySlide(block.id, image.id, 1)}><ArrowDown size={14}/></button>
                      <button type="button" className="notice-composer-gallery-remove" onClick={() => removeSlide(block.id, image.id)}
                        aria-label={(imageIndex + 1) + '번째 이미지 삭제'}><Trash2 size={14}/></button>
                    </div>
                  </div>
                  <div className="notice-composer-dimensions" role="group" aria-label={(imageIndex + 1) + '번째 이미지 크기'}>
                    {dimensionInput(image,'width',(imageIndex+1)+'번째 이미지 가로 크기 (px)')}
                    <button type="button" className="notice-composer-ratio-toggle" onClick={() => toggleImageRatio(image.id)}
                      aria-label={image.ratioLocked ? '가로 세로 비율 유지 해제' : '가로 세로 비율 유지'}
                      aria-pressed={image.ratioLocked} title={image.ratioLocked ? '비율 유지 중' : '비율 자유 조절'}>
                      {image.ratioLocked ? <Link size={19} aria-hidden="true"/> : <Link2Off size={19} aria-hidden="true"/>}
                    </button>
                    {dimensionInput(image,'height',(imageIndex+1)+'번째 이미지 세로 크기 (px)')}
                    <button type="button" className="notice-composer-original-size" onClick={() => restoreImageSize(image.id)}
                      disabled={!image.naturalWidth || !image.naturalHeight} title="최초 삽입 크기와 원본 비율로 복원">
                      <RotateCcw size={14}/> 원본 비율 복원
                    </button>
                  </div>
                </div>)}
              </div>
              {block.images.map(image=><span key={image.id}>{dimensionWarning(image.id)}</span>)}
              {slidePickerId===block.id&&imagePicker(block.id)}
            </div> :
            <div className="notice-composer-image">
              <div className="notice-composer-image-stage" style={{
                width: block.width || 320,
                aspectRatio: block.width && block.height ? `${block.width} / ${block.height}` : '4 / 3',
              }}>
                <img className="notice-composer-resized-image" src={block.url} alt={block.name} onLoad={event => setNaturalSize(block.id, event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}/>
              </div>
              <div className="notice-composer-dimensions" role="group" aria-label={`이미지 ${index + 1} 크기 조절`}>
                {dimensionInput(block,'width',`이미지 ${index+1} 가로 크기 (px)`)}
                <button type="button" className="notice-composer-ratio-toggle" onClick={() => toggleImageRatio(block.id)}
                  aria-label={block.ratioLocked ? '가로 세로 비율 유지 해제' : '가로 세로 비율 유지'}
                  aria-pressed={block.ratioLocked} title={block.ratioLocked ? '비율 유지 중' : '비율 자유 조절'}>
                  {block.ratioLocked ? <Link size={19} aria-hidden="true"/> : <Link2Off size={19} aria-hidden="true"/>}
                </button>
                {dimensionInput(block,'height',`이미지 ${index+1} 세로 크기 (px)`)}
                <button type="button" className="notice-composer-original-size" onClick={() => restoreImageSize(block.id)}
                  disabled={!block.naturalWidth || !block.naturalHeight} title="최초 삽입 크기와 원본 비율로 복원">
                  <RotateCcw size={14}/> 원본 비율 복원
                </button>
              </div>
              {dimensionWarning(block.id)}
              <button type="button" className="outline-action notice-composer-gallery-add"
                aria-expanded={slidePickerId===block.id} onClick={()=>toggleImagePicker(block.id)}>
                <ImagePlus size={15}/> 슬라이드로 사진 추가
              </button>
              {slidePickerId===block.id&&imagePicker(block.id)}
              <small>{block.name}</small>
            </div>}
        </div>)}
      </div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {newImagePickerOpen&&imagePicker()}
      <div className="notice-composer-actions">
        <button type="button" className="outline-action" onClick={addText}><Plus size={15}/> 본문 추가</button>
        <button type="button" className="outline-action" aria-expanded={newImagePickerOpen}
          onClick={()=>toggleImagePicker()}><ImagePlus size={15}/> 이미지 추가</button>
        <button type="button" className="button button-primary" onClick={() => setPreview(previous => !previous)}>{preview ? '편집으로 돌아가기' : '미리보기'}</button>
      </div>
      <div className="notice-composer-publish">
        <button type="button" className="button button-primary" disabled={busy} onClick={()=>void publish()}>{busy?"저장 중...":initial?"변경 사항 저장":"발행"}</button>
      </div>
      <p className="notice-composer-footnote">사진은 저장 시 업로드됩니다. GitHub 커밋 후 이미지가 공개되기까지 Cloudflare 배포 시간이 걸릴 수 있습니다.</p>
    </section>
  </>;
}
