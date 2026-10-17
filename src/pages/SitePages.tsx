import {useEffect,useState} from 'react';
import type {FormEvent,ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {signInWithEmailAndPassword} from 'firebase/auth';
import {doc,serverTimestamp,updateDoc} from 'firebase/firestore';
import {auth,db,accountEmail} from '../firebase';
import type {MemberProfile,Session} from '../firebase';
import {
  ArrowRight,ArrowUpRight,CalendarDays,Check,ChevronDown,CircleHelp,ClipboardList,
  ExternalLink,FileText,Instagram,Plus,Search,Users,X,UserRound,
} from 'lucide-react';
import logo from '../logo-transparent.png';
import PasswordChange from '../PasswordChange';
import PhotoGallery from '../PhotoGallery';
import LoadingText from '../LoadingText';
import ImageShimmer from '../ImageShimmer';
import {DEFAULT_ABOUT,getAbout,peekAboutCache} from '../aboutContent';
import type {AboutContent} from '../aboutContent';
import type {NoticePost} from '../noticesData';
import NoticeImageCarousel from '../NoticeImageCarousel';
import type {Navigate,Notify} from '../app/siteNavigation';
import {equipmentStatusTone} from '../equipmentDemo';
import type {EquipmentItem} from '../equipmentDemo';
import type {EquipmentAction} from '../equipmentApi';

const profileRoleLabel = (profile: MemberProfile): string =>
  profile.role === 'president' ? '회장단'
  : profile.role === 'staff' ? '실무단'
  : profile.role === 'part_leader' ? '파트장'
  : profile.handoverAccess ? 'OB 운영진' : '일반부원';

const sessions = ['보컬', '기타', '베이스', '드럼', '키보드'];

export function Placeholder({ label, className = '' }: { label: string; className?: string }) {
  return <div role="img" aria-label={`${label} 자리표시자`} className={`placeholder ${className}`}>
    <span className="placeholder-symbol" aria-hidden="true">☒</span>
    <span className="placeholder-text">{label}</span>
  </div>;
}
export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15} aria-hidden="true" /></button>;
}
export function PageHeading({ tag, title, description }: { tag: string; title: string; description: string }) {
  return <div className="page-heading container"><span className="eyebrow">{tag}</span><h1>{title}</h1><p>{description}</p></div>;
}
export function SectionHeading({ title, aside, action, onAction }: { title: string; aside?: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><div><h2>{title}</h2>{aside && <p>{aside}</p>}</div>{action && onAction && <TextLink onClick={onAction}>{action}</TextLink>}</div>;
}
export function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <div className="empty-state">{icon && <span className="empty-icon">{icon}</span>}<strong>{title}</strong><p>{description}</p></div>;
}

export function Home({ navigate, openNotice, notices, noticeLoading }: { navigate: Navigate; openNotice: (id: string) => void; notices: NoticePost[];noticeLoading:boolean }) {
  const [homeImage,setHomeImage]=useState<string|null>(()=>peekAboutCache()?.content.homeImage??null);
  useEffect(()=>{let active=true;void getAbout().then(({content})=>{if(active)setHomeImage(content.homeImage??'');}).catch(()=>{if(active)setHomeImage('');});return()=>{active=false;};},[]);
  return <>
    <section className="hero container">
      <div className="hero-copy">
        <span className="eyebrow">SUNGKYUNKWAN UNIVERSITY BAND CLUB</span>
        <h1>여기로,<br /><span>모여락!</span></h1>
        <p>성균관대학교 중앙 밴드 동아리 모여락입니다.<br />우리의 음악과 이야기를 이곳에 담습니다.</p>
        <TextLink onClick={() => navigate('about')}>동아리 소개</TextLink>
      </div>
      <div className="hero-media">{homeImage?<ImageShimmer key={homeImage} className="home-hero-image" src={homeImage} alt="메인 페이지 사진" loading="eager" fetchPriority="high"/>:homeImage===null?<div className="home-hero-image image-pending image-shimmer-frame is-image-loading" role="status" aria-label="메인 페이지 사진을 불러오는 중"><span className="image-shimmer-band" aria-hidden="true"/></div>:<Placeholder label="메인 페이지 사진" />}</div>
    </section>
    <section className="container home-updates">
      <SectionHeading title="공지사항" aside="모여락의 새로운 소식" action="전체 보기" onAction={() => navigate('news')} />
      <div className="simple-notice-list">
        {noticeLoading?<LoadingText>최근 공지를 불러오는 중입니다</LoadingText>:notices.slice(0, 3).map(post => <button type="button" className="simple-notice" key={post.id} onClick={() => openNotice(post.id)}>
          <span className="notice-category">{post.category}</span><span className="notice-title">{post.title}</span><span className="notice-date">{post.date}</span><ArrowUpRight size={16} aria-hidden="true" />
        </button>)}
      </div>
    </section>
    <section className="container home-bottom-links" aria-label="주요 서비스 바로가기">
      <button type="button" onClick={() => navigate('schedule')}><CalendarDays size={18} /><span><strong>합주 시간 조율</strong><small>함께할 시간을 찾아보세요</small></span><ArrowUpRight size={16} /></button>
      <button type="button" onClick={() => navigate('equipment')}><ClipboardList size={18} /><span><strong>장비 대여</strong><small>동아리 장비를 확인하세요</small></span><ArrowUpRight size={16} /></button>
    </section>
  </>;
}

export function About({ navigate, canEdit }: { navigate: Navigate;canEdit:boolean }) {
  const [content,setContent]=useState<AboutContent>(()=>peekAboutCache()?.content??DEFAULT_ABOUT);
  const [contentLoaded,setContentLoaded]=useState(()=>Boolean(peekAboutCache()));
  const [loadError,setLoadError]=useState('');
  useEffect(()=>{
    let active=true;
    void getAbout().then(data=>{if(active){setContent(data.content);setContentLoaded(true);}})
      .catch(()=>{if(active){setContentLoaded(true);setLoadError('최신 소개 정보를 불러오지 못해 기본 소개 내용을 표시합니다.');}});
    return()=>{active=false;};
  },[]);
  return <><PageHeading tag="ABOUT MYROCK" title="모여락 소개" description="함께 음악을 만들고 무대에 서는 사람들, 모여락을 소개합니다." />
    <section className="container about-admin-tools">
      {canEdit&&<button type="button" className="admin-only-action" onClick={()=>navigate('about-manage')}>정보 수정</button>}
      {loadError&&<p role="status" className="about-load-error">{loadError}</p>}
    </section>
    <section className="container about-intro section-block"><div className="about-description"><h2>음악을 좋아하는 사람들이<br />함께하는 공간</h2><p>보컬, 기타, 베이스, 드럼, 키보드. 서로 다른 소리로 모여 한 곡을 완성합니다. 이곳에는 동아리 소개와 활동 이야기가 정리될 예정입니다.</p><TextLink onClick={() => navigate('gallery')}>활동 사진 보러 가기</TextLink></div>
      {content.heroImage?<ImageShimmer key={content.heroImage} className="about-hero-image" src={content.heroImage} alt="동아리 소개 사진" loading="eager" fetchPriority="high"/>:contentLoaded?<Placeholder label="동아리 대표 사진"/>:<div className="about-hero-image image-pending image-shimmer-frame is-image-loading" role="status" aria-label="동아리 소개 사진을 불러오는 중"><span className="image-shimmer-band" aria-hidden="true"/></div>}
    </section>
    <section className="container section-block" aria-label="28기 운영진 소개">
      <SectionHeading title="운영진" aside={content.cohortLabel} />
      <div className="leadership-grid">
        {content.officers.map(officer => <article className="leader-item" key={officer.id}>
          {officer.photoUrl?<ImageShimmer key={officer.photoUrl} className="leader-photo" src={officer.photoUrl} alt={officer.name+' 사진'}/>:contentLoaded?<Placeholder label="사진" className="leader-photo" />:<div className="leader-photo image-pending image-shimmer-frame is-image-loading" role="status" aria-label="운영진 사진을 불러오는 중"><span className="image-shimmer-band" aria-hidden="true"/></div>}
          <div className="leader-description">
            <h3>{officer.name}</h3>
            <p>{officer.position}</p>
          </div>
        </article>)}
      </div>
    </section>
    <section className="container section-block">
      <SectionHeading title="연혁" aside="모여락의 활동 기록" />
      <div className="archive-timeline">
        {!contentLoaded?<LoadingText>연혁 정보를 불러오는 중입니다</LoadingText>:content.history.map(item=><div key={item.id}><span>{item.year}</span><p>{item.description}</p></div>)}
      </div>
    </section>
    <section className="container section-block about-social">
      <SectionHeading title="모여락 채널" />
      <div className="plain-links">
        <a href="https://www.instagram.com/skku_m.y.rock/" target="_blank" rel="noopener noreferrer" aria-label="인스타그램 @skku_m.y.rock 열기">
          <Instagram size={19} aria-hidden="true" />
          <span className="social-link-label">인스타그램 <small>@skku_m.y.rock</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
        <a href="https://www.youtube.com/@SKKUMYRock" target="_blank" rel="noopener noreferrer" aria-label="유튜브 @SKKUMYRock 열기">
          <ExternalLink size={19} aria-hidden="true" />
          <span className="social-link-label">유튜브 <small>@SKKUMYRock</small></span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  </>;
}


export function News({ canWrite, onWrite, openNotice, notices, loading, error, hasMore, moreLoading, onLoadMore }: { canWrite: boolean; onWrite: () => void; openNotice: (id: string) => void; notices: NoticePost[]; loading:boolean; error:string; hasMore:boolean; moreLoading:boolean; onLoadMore:()=>void }) {
  const [category, setCategory] = useState('전체');
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase('ko');
  const filtered = notices.filter(post =>
    (category === '전체' || post.category === category) &&
    (post.title + post.description).toLocaleLowerCase('ko').includes(search)
  );
  return <>
    <PageHeading tag="NOTICE" title="공지사항" description="공연, 행사, 동아리 운영에 관한 소식을 확인하세요." />
    <section className="container section-block news-page">
      <div className="toolbar">
        <div className="tabs" aria-label="공지 분류">
          {['전체', '공지', '공연', '행사'].map(c => <button type="button" key={c}
            className={category === c ? 'active' : ''} aria-pressed={category === c}
            onClick={() => setCategory(c)}>{c}</button>)}
        </div>
        <div className="toolbar-actions">
          <label className="input-search"><Search size={16}/><input aria-label="공지사항 검색"
            placeholder="제목 검색" value={query} onChange={e => setQuery(e.target.value)} /></label>
          {canWrite && <button type="button" className="button button-primary" onClick={onWrite}>
            <Plus size={15}/> 글쓰기
          </button>}
        </div>
      </div>
      <div className="table-shell">
        <div className={'notice-table-head has-author'}><span>분류</span><span>제목</span><span className="notice-date-cell">등록일</span><span className="notice-author-cell">작성자</span></div>
        {filtered.map(post => <button type="button" key={post.id} className={'notice-table-row has-author'}
          onClick={() => openNotice(post.id)} aria-label={post.title + ' 상세보기'}>
          <span className="notice-category">{post.category}</span>
          <span><strong>{post.title}</strong><small>{post.description}</small></span>
          <span className="notice-date-cell">{post.date}</span>
          <span className="notice-author-cell">{post.author}</span>
        </button>)}
        {error&&<p role="alert" className="form-error">{error}</p>}
        {loading&&<LoadingText>공지사항 목록을 불러오는 중입니다</LoadingText>}
        {!loading&&filtered.length===0&&<EmptyState title="공지사항이 없습니다" description="등록된 공지사항이 없습니다." />}
      </div>
      {hasMore&&<div className="list-bottom notice-list-bottom"><button type="button" className={moreLoading?"outline-action is-fetching":"outline-action"} disabled={moreLoading} onClick={onLoadMore}>{moreLoading?"더 불러오는 중...":"공지사항 더 보기"}</button></div>}
    </section>
  </>;
}

export function NoticeDetail({ notice, canManage, backToList, onEdit, onDelete }: { notice: NoticePost | undefined; canManage: boolean; backToList: () => void; onEdit: () => void; onDelete: () => void }) {
  const [manageOpen,setManageOpen]=useState(false);
  if (!notice) {
    return <section className="container section-block notice-detail-missing">
      <EmptyState title="공지사항을 찾을 수 없습니다" description="존재하지 않거나 이동된 공지사항입니다." />
      <button type="button" className="outline-action" onClick={backToList}><ArrowRight size={15}/> 공지사항 목록</button>
    </section>;
  }
  return <>
    <PageHeading tag="NOTICE DETAIL" title="공지사항" description="모여락에서 전하는 소식입니다." />
    <article className="container section-block notice-detail-page">
      <button type="button" className="notice-detail-back" onClick={backToList}>
        <ArrowRight size={16} aria-hidden="true" /> 공지사항 목록
      </button>
      <header className="notice-detail-header">
        <span className="notice-detail-category">{notice.category}</span>
        <h2>{notice.title}</h2>
        <div className="notice-detail-meta">
          <div className="notice-detail-byline"><time dateTime={notice.publishedAt}>{notice.date}</time>
            <span>작성자 {notice.author}</span>
          </div>
          {canManage&&<div className="notice-manage-actions"><button type="button" className="outline-action" aria-expanded={manageOpen} onClick={()=>setManageOpen(x=>!x)}>관리 <ChevronDown size={15}/></button>{manageOpen&&<div className="notice-manage-menu"><button type="button" onClick={onEdit}>수정하기</button><button type="button" onClick={onDelete}>삭제하기</button></div>}</div>}
        </div>
      </header>
      <div className="notice-detail-content">
        {notice.blocks.map((block,index)=>block.kind==='text'?<div className="notice-detail-body" key={index}><p>{block.text}</p></div>:block.kind==='gallery'?
          <div key={index} className="notice-detail-images"><NoticeImageCarousel label={notice.title+' 이미지 슬라이드'} slides={block.images.map((image,i)=>({id:i,src:image.url,alt:image.name,width:Number(image.width)||320,height:Number(image.height)||240}))}/></div>:
          <div key={index} className="notice-detail-image-single" style={{maxWidth:Number(block.width)||800}}><img src={block.url} alt={block.name} loading="lazy" decoding="async" style={{width:'100%',aspectRatio:Number(block.width)&&Number(block.height)?Number(block.width)+' / '+Number(block.height):'auto'}}/></div>)}
      </div>
      <div className="notice-detail-footer">
        <button type="button" className="outline-action" onClick={backToList}>
          <ArrowRight size={15} aria-hidden="true" /> 목록으로 돌아가기
        </button>
      </div>
    </article>
  </>;
}


export function Gallery({ canRegister }: { canRegister: boolean }) {
  return <>
    <PageHeading tag="PHOTO ARCHIVE" title="갤러리" description="공연부터 일상까지, 모여락의 순간들을 모아두는 공간입니다." />
    <PhotoGallery canRegister={canRegister} />
  </>;
}

export function Equipment({items,canManage,onManage,loggedIn,onLogin,loading,error,busyId,onRefresh,onAction}:{
 items:EquipmentItem[];canManage:boolean;onManage:()=>void;
 loggedIn:boolean;onLogin:()=>void;loading:boolean;error:string;busyId:string|null;onRefresh:()=>void;
 onAction:(id:string,action:EquipmentAction)=>void;
}){
 return <><PageHeading tag="EQUIPMENT" title="장비 대여" description="동아리 장비 목록을 보고 대여를 신청하는 공간입니다." />
  <section className="container section-block">
   <div className="toolbar toolbar-bottom"><div><h2 className="plain-h2">장비 목록</h2></div>
    <div className="toolbar-actions">{canManage&&<button type="button" className="button button-secondary" onClick={onManage}>장비 관리 <ArrowRight size={15}/></button>}
     <button type="button" className="button button-secondary" onClick={()=>document.getElementById('equipment-my-requests')?.scrollIntoView({behavior:'smooth'})}><ClipboardList size={16}/> 내 대여 내역</button>
     <button type="button" className="outline-action" onClick={onRefresh} disabled={loading||busyId!==null}>새로고침</button>
    </div>
   </div>
   {error&&<p className="form-error" role="alert">{error}</p>}
   {loading&&<LoadingText>장비 목록을 불러오는 중입니다.</LoadingText>}
   <div className="equipment-list">{!loading&&items.map(g=><div className="equipment-row" key={g.id}>
    {g.imageUrl?<img className="equipment-photo" src={g.imageUrl} alt={g.name+" 장비 사진"} loading="lazy" decoding="async"/>:<Placeholder label="장비 사진" />}
    <div className="equipment-info"><h3>{g.name}</h3><p>{g.product}</p>
     <span className={"equipment-status equipment-status-"+equipmentStatusTone(g.status)}>{g.status}</span>
     {g.myPosition!==null&&<small className="equipment-own-position">내 신청 대기 순번: {g.myPosition}순위</small>}
    </div>
    {g.isBorrower?g.status==='반납 확인중'?
     <button type="button" className="outline-action" disabled>반납 확인중</button>:
     <button type="button" className="outline-action" disabled={loading||busyId!==null} onClick={()=>onAction(g.id,'return')}>반납하기 <ArrowRight size={15}/></button>
     :g.myPosition!==null?
      <button type="button" className="outline-action" disabled={loading||busyId!==null} onClick={()=>onAction(g.id,'cancel')}>신청 취소</button>
     :g.status==='대여중'||g.status==='반납 확인중'?
      <button type="button" className="outline-action" disabled>{g.status}</button>
     :<button type="button" className="outline-action" disabled={loading||busyId!==null} onClick={()=>loggedIn?onAction(g.id,'apply'):onLogin()}>대여 신청 <ArrowRight size={15}/></button>}
   </div>)}</div>
   {!loading&&items.length===0&&<p className="equipment-manage-empty">등록된 장비가 없습니다.</p>}
   <section id="equipment-my-requests" className="equipment-my-requests">
    <h2 className="plain-h2">내 대여 내역</h2>
    {loading?<LoadingText className="is-compact">장비 목록을 불러오는 중입니다.</LoadingText>:!loggedIn?<p>대여 신청과 내역 조회는 로그인 후 이용할 수 있습니다.</p>:
     items.filter(item=>item.myPosition!==null||item.isBorrower).length===0?<p>대여 신청 또는 대여 중인 장비가 없습니다.</p>:
     <div>{items.filter(item=>item.myPosition!==null||item.isBorrower).map(item=>
      <p key={item.id}>{item.name} · {item.isBorrower?item.status:'승인 대기 '+item.myPosition+'순위'}</p>)}</div>}
   </section>
   <div className="process-note"><strong>대여 절차</strong><div>{['대여 신청','운영진 승인','장비 반납','반납 확인'].map((step,i)=><span key={step}>{i+1}. {step}</span>)}</div></div>
  </section>
 </>;
}

export function Handover({openView,openWrite,notify}:{openView:()=>void;openWrite:()=>void;notify:Notify}){
 const [menuOpen,setMenuOpen]=useState(false);
 return <><PageHeading tag="HANDOVER" title="인수인계" description="운영진이 해마다 업무와 기록을 이어갈 수 있도록 마련한 공간입니다." />
  <section className="container section-block">
   <div className="section-heading handover-heading"><div><h2>인수인계 자료</h2><p>인수인계 자료를 작성하거나 확인할 수 있습니다.</p></div></div>
   <div className="handover-items"><button type="button" onClick={()=>setMenuOpen(true)}><FileText size={21}/><span><strong>직책별 인수인계 노트</strong><small>직책별 · 운영진 공통 인수인계</small></span><ArrowUpRight size={17}/></button>
    <button type="button" onClick={()=>notify('연결된 링크가 없습니다')}><ExternalLink size={21}/><span><strong>인수인계 드라이브</strong><small>문서 및 업무 파일 링크</small></span><ArrowUpRight size={17}/></button>
   </div>
  </section>
  {menuOpen&&<div className="handover-choice-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)setMenuOpen(false);}}>
   <div role="dialog" aria-modal="true" aria-labelledby="handover-choice-title" className="handover-choice-dialog">
    <div className="handover-choice-heading"><h2 id="handover-choice-title">직책별 인수인계 노트</h2><button type="button" aria-label="닫기" onClick={()=>setMenuOpen(false)}><X size={18}/></button></div>
    <p>사용할 메뉴를 선택해 주세요.</p>
    <div className="handover-choice-actions">
     <button type="button" className="outline-action" onClick={()=>{setMenuOpen(false);openView();}}>인수인계 확인하기 <ArrowRight size={15}/></button>
     <button type="button" className="button button-primary" onClick={()=>{setMenuOpen(false);openWrite();}}>인수인계 작성하기 <ArrowRight size={15}/></button>
    </div>
   </div>
  </div>}
 </>;
}

export function LoginDialog({ close, notify }: { close: () => void; notify: Notify }) {
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { const onKey = (e: KeyboardEvent) => { if(e.key === 'Escape') close(); }; window.addEventListener('keydown',onKey); return ()=>window.removeEventListener('keydown',onKey); },[close]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!/^\d{10}$/.test(studentId.trim())) {setError('학번 10자리를 입력해 주세요.');return;}
    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, accountEmail(studentId.trim()), password);
      close();
      notify('로그인되었습니다. 내 정보에서 세션을 확인할 수 있습니다.');
    } catch (err) {
      const code = (err as {code?:string}).code;
      if (code === 'auth/too-many-requests') setError('로그인 시도가 많습니다. 잠시 후 다시 시도해 주세요.');
      else if (code === 'auth/network-request-failed') setError('네트워크 연결을 확인해 주세요.');
      else if (code === 'auth/operation-not-allowed') setError('Firebase 콘솔에서 이메일/비밀번호 로그인을 활성화해야 합니다.');
      else setError('학번 또는 비밀번호가 올바르지 않거나 등록되지 않은 계정입니다.');
    } finally {setBusy(false);}
  }
  return <div className="modal-overlay" data-async-busy={busy ? "true" : undefined} onMouseDown={event=>{if(event.target===event.currentTarget)close();}}>
    <div className="login-dialog" role="dialog" aria-modal="true" aria-labelledby="login-heading">
      <button type="button" className="dialog-close" onClick={close} aria-label="닫기"><X size={20}/></button>
      <div className="dialog-brand"><img src={logo} alt="" /> <span>모여락</span></div>
      <h2 id="login-heading">회원 로그인</h2>
      <p>신규 발급 계정은 학번 10자리가 초기 비밀번호입니다. 기존 회원은 설정한 비밀번호로 로그인해 주세요.</p>
      <form onSubmit={submit}>
        <label>학번<input type="text" inputMode="numeric" maxLength={10} autoComplete="username" placeholder="학번 10자리" value={studentId} onChange={event=>setStudentId(event.target.value.replace(/\D/g,''))} required /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" placeholder="비밀번호" value={password} onChange={event=>setPassword(event.target.value)} required /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="button button-primary" disabled={busy}>{busy?'로그인 중...':'로그인'} <ArrowRight size={17}/></button>
      </form>
      <p className="login-note"><CircleHelp size={15}/> 로그인에 문제가 있거나 비밀번호를 잊었다면 운영진에게 문의해 주세요. 로그인 후 내 정보에서 비밀번호를 변경할 수 있습니다.</p>
    </div>
  </div>;
}

export function Profile({ user, profile, pending, error, notify, onSaved }: {user: User | null; profile: MemberProfile | null; pending: boolean; error: string; notify: Notify; onSaved: (sessions: Session[]) => void}) {
  const [selected, setSelected] = useState<Session[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(()=>{setSelected(profile?.sessions ?? []);},[profile?.uid,profile?.sessions?.join('|')]);
  if (pending) return <><PageHeading tag="MY PROFILE" title="내 정보" description="회원 정보를 불러오는 중입니다."/><section className="container section-block"><EmptyState title="잠시만 기다려 주세요" description="로그인 상태와 회원 정보를 확인하고 있습니다." /></section></>;
  if (!user) return <><PageHeading tag="MY PROFILE" title="내 정보" description="로그인이 필요한 페이지입니다."/><section className="container section-block"><EmptyState title="로그인이 필요합니다" description="상단의 로그인 버튼에서 학번과 비밀번호를 입력해 주세요." /></section></>;
  if (!profile) return <><PageHeading tag="MY PROFILE" title="내 정보" description="회원 프로필을 찾지 못했습니다."/><section className="container section-block"><EmptyState title="회원 정보를 불러올 수 없습니다" description={error || 'Firebase 계정과 회원 프로필이 연결되어 있는지 확인해 주세요.'} /></section></>;
  const toggle = (item: Session) => setSelected(prev=>prev.includes(item)?prev.filter(x=>x!==item):[...prev,item]);
  async function save() {
    if (!profile || !user) return;
    if (selected.length === 0) {notify('세션을 적어도 하나 선택해 주세요.');return;}
    setSaving(true);
    try {
      await updateDoc(doc(db,'users',user.uid),{sessions:selected,updatedAt:serverTimestamp()});
      onSaved(selected);
      notify('세션 정보가 저장되었습니다.');
    } catch (err) {
      console.error('프로필 변경 오류',err);
      notify('저장하지 못했습니다. Firestore 보안 규칙과 네트워크를 확인해 주세요.');
    } finally {setSaving(false);}
  }
  return <><PageHeading tag="MY PROFILE" title="내 정보" description="등록된 회원 정보를 확인하고, 세션과 비밀번호를 변경할 수 있습니다."/>
    <section className="container section-block profile-layout" data-async-busy={saving ? "true" : undefined}>
      <div className="profile-panel profile-details-panel"><div className="profile-title"><UserRound size={20}/><h2>회원 정보</h2></div>
        <dl className="profile-data"><div><dt>이름</dt><dd>{profile.name}</dd></div><div><dt>학번</dt><dd>{profile.studentId}</dd></div><div><dt>기수</dt><dd>{profile.generation}기</dd></div><div><dt>직책</dt><dd>{profile.positions.length?profile.positions.join(', '):'없음'}</dd></div><div><dt>권한</dt><dd>{profileRoleLabel(profile)}</dd></div></dl>
        <p className="profile-help">정보 수정이 필요할 경우 운영진에게 연락 바랍니다.</p>
      </div>
      <div className="profile-panel"><div className="profile-title"><Users size={20}/><h2>나의 세션</h2></div>
        <p className="profile-help">본인의 세션을 선택해주세요. 세션은 중복으로 선택할 수 있습니다.</p>
        <div className="session-options">{sessions.map(item=><label className={selected.includes(item as Session)?'chosen':''} key={item}><input type="checkbox" checked={selected.includes(item as Session)} onChange={()=>toggle(item as Session)}/><span>{item}</span><Check size={17}/></label>)}</div>
        <button className="button button-primary profile-save" type="button" onClick={save} disabled={saving||selected.length===0||selected.join('|')===profile.sessions.join('|')}>{saving?'저장 중...':'세션 저장'} <ArrowRight size={15}/></button>
      </div>
      <PasswordChange user={user}/>
    </section>
  </>;
}

