import { useRef, useState } from 'react';
import type { TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { galleryFrame, slideDimensions } from './noticeCarouselSizing';

export type NoticeSlide = {
  id: number | string;
  src: string | null;
  alt: string;
  width?: number;
  height?: number;
  onLoad?: (width: number, height: number) => void;
};

export default function NoticeImageCarousel({ slides, label }: { slides: readonly NoticeSlide[]; label: string }) {
  const [activeId, setActiveId] = useState<number | string | null>(null);
  const touchOrigin = useRef<{ x: number; y: number } | null>(null);
  if (!slides.length) return null;
  const selectedIndex = slides.findIndex(slide => slide.id === activeId);
  const activeIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const active = slides[activeIndex];
  const frame = galleryFrame(slides);
  const size = slideDimensions(active);
  const go = (delta: number) => setActiveId(slides[(activeIndex + delta + slides.length) % slides.length].id);
  const onTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (touch) touchOrigin.current = { x: touch.clientX, y: touch.clientY };
  };
  const onTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchOrigin.current;
    const touch = event.changedTouches[0];
    touchOrigin.current = null;
    if (!start || !touch || slides.length < 2) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1);
  };
  return <div className="notice-carousel" role="region" aria-label={label} tabIndex={0}
    onKeyDown={event => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        if (slides.length > 1) go(event.key === 'ArrowLeft' ? -1 : 1);
      }
    }}>
    <div className="notice-slide-viewport" style={{ width: frame.width, aspectRatio: frame.width + ' / ' + frame.height }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touchOrigin.current = null; }}>
      <div className="notice-slide-media" style={{ width: (size.width / frame.width * 100) + '%', height: (size.height / frame.height * 100) + '%' }}>
        {active.src ?
          <img key={active.id} src={active.src} alt={active.alt} draggable={false}
            onLoad={event => active.onLoad?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)}/> :
          <div className="notice-detail-photo-placeholder" role="img" aria-label={active.alt + ' 준비 중'}>
            <span aria-hidden="true">▧</span><small>{active.alt} 자리</small>
          </div>}
      </div>
      {slides.length > 1 && <>
        <button type="button" className="notice-slide-arrow previous" aria-label="이전 이미지" onClick={() => go(-1)}><ChevronLeft size={21}/></button>
        <button type="button" className="notice-slide-arrow next" aria-label="다음 이미지" onClick={() => go(1)}><ChevronRight size={21}/></button>
      </>}
    </div>
    {slides.length > 1 && <div className="notice-slide-pagination">
      <span aria-live="polite">{activeIndex + 1} / {slides.length}</span>
      <div className="notice-slide-dots" aria-label="이미지 선택">
        {slides.map((slide, index) => <button key={slide.id} type="button" aria-label={(index + 1) + '번째 이미지'} aria-current={index === activeIndex ? 'true' : undefined}
          className={index === activeIndex ? 'active' : ''} onClick={() => setActiveId(slide.id)}/>)}
      </div>
    </div>}
  </div>;
}
