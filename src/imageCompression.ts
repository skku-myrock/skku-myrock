/**
 * Compress photographs in the browser before committing them to GitHub.
 * No image-processing service, Cloudflare Function or extra storage is required.
 */
export const MAX_SOURCE_IMAGE_BYTES = 30_000_000;
export const MAX_UPLOAD_IMAGE_BYTES = 5_000_000;
export const MAX_COMPRESSED_IMAGE_BYTES = 2_000_000;
export const MAX_IMAGE_EDGE = 2560;
const types = new Set(['image/jpeg','image/png','image/webp','image/gif']);

export function validateSourceImage(file: Pick<File,'size'|'type'>):void {
  if (!types.has(file.type) || file.size <= 0)
    throw new Error('JPG, PNG, WebP 또는 GIF 이미지만 선택할 수 있습니다.');
  if (file.type === 'image/gif' && file.size > MAX_UPLOAD_IMAGE_BYTES)
    throw new Error('움직이는 GIF는 압축하지 않으므로 5MB 이하 파일만 선택할 수 있습니다.');
  if (file.size > MAX_SOURCE_IMAGE_BYTES)
    throw new Error('원본 사진은 30MB 이하만 선택할 수 있습니다. 더 큰 파일은 먼저 크기를 줄여 주세요.');
}

function isAnimatedWebp(bytes:Uint8Array):boolean {
  const prefix=String.fromCharCode(...bytes.slice(0,16));
  return prefix.startsWith('RIFF')&&prefix.slice(8,16)==='WEBPVP8X'&&Boolean(bytes[20]&0x02);
}

function canvasBlob(canvas:HTMLCanvasElement,quality:number):Promise<Blob> {
  return new Promise((resolve,reject)=>{
    canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('사진 압축에 실패했습니다.')), 'image/webp', quality);
  });
}

export async function prepareImageForUpload(file:File):Promise<File> {
  validateSourceImage(file);
  if(file.type==='image/gif')return file; // Preserve animation.
  if(file.type==='image/webp' && isAnimatedWebp(new Uint8Array(await file.slice(0,24).arrayBuffer()))) {
    if(file.size>MAX_UPLOAD_IMAGE_BYTES)throw new Error('움직이는 WebP는 압축하지 않으므로 5MB 이하 파일만 선택할 수 있습니다.');
    return file;
  }
  if(file.size<=400_000)return file; // Avoid needless recompression of tiny files.

  let image:ImageBitmap;
  try {image=await createImageBitmap(file);}
  catch {
    if(file.size<=MAX_UPLOAD_IMAGE_BYTES)return file;
    throw new Error('큰 사진을 브라우저에서 읽지 못했습니다. JPG 또는 PNG로 변환한 뒤 다시 시도해 주세요.');
  }

  try {
    const canvas=document.createElement('canvas');
    const context=canvas.getContext('2d');
    if(!context)throw new Error('브라우저에서 이미지 압축을 지원하지 않습니다.');
    let best:Blob|null=null;
    for(const edge of [2560,2048,1600,1280,1024]){
      const scale=Math.min(1,edge/Math.max(image.width,image.height));
      canvas.width=Math.max(1,Math.round(image.width*scale));
      canvas.height=Math.max(1,Math.round(image.height*scale));
      context.clearRect(0,0,canvas.width,canvas.height);
      context.drawImage(image,0,0,canvas.width,canvas.height);
      for(const quality of [0.82,0.7,0.58]){
        const result=await canvasBlob(canvas,quality);
        if(result.type!=='image/webp'){
          if(file.size<=MAX_UPLOAD_IMAGE_BYTES)return file;
          throw new Error('이 브라우저에서 WebP 압축을 지원하지 않습니다. 사진을 5MB 이하로 줄여 주세요.');
        }
        if(!best||result.size<best.size)best=result;
        if(result.size<=MAX_COMPRESSED_IMAGE_BYTES && result.size<file.size){
          return new File([result],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified});
        }
      }
    }
    if(best&&best.size<=MAX_UPLOAD_IMAGE_BYTES && (file.size>MAX_UPLOAD_IMAGE_BYTES||best.size<file.size))
      return new File([best],file.name.replace(/\.[^.]+$/,'')+'.webp',{type:'image/webp',lastModified:file.lastModified});
    if(file.size<=MAX_UPLOAD_IMAGE_BYTES)return file;
    throw new Error('사진을 5MB 이하로 압축할 수 없었습니다. 원본 파일 크기나 해상도를 줄여 다시 시도해 주세요.');
  }catch(reason){
    if(reason instanceof Error&&reason.message.includes('사진'))throw reason;
    if(file.size<=MAX_UPLOAD_IMAGE_BYTES)return file;
    throw new Error('사진 압축에 실패했습니다. 크기를 줄이거나 다른 이미지 형식으로 다시 시도해 주세요.');
  }finally{image.close();}
}
