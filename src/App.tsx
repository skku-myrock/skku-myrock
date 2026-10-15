import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { auth, db, accountEmail } from './firebase';
import type { MemberProfile, Session } from './firebase';
import type { FormEvent, ReactNode } from 'react';
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown,
  Trash2,
  CircleHelp, ClipboardList, ExternalLink, FileText, Instagram,
  LockKeyhole, Mail, Menu, Plus, Search, Users, X, UserRound, LogOut,
} from 'lucide-react';
import logo from './logo-transparent.png';
import MemberManager from './MemberManager';
import { purgeAllOtherMembers } from './memberAdmin';
import PasswordChange from './PasswordChange';
import PhotoGallery from './PhotoGallery';
import { findSchedule, ScheduleDetail, ScheduleLanding } from './SchedulePages';
import { DonationHistory, ExpenseHistory, FinanceLanding } from './FinancePages';
import ExpenseManagement from './ExpenseManagement';
import DonationManagement from './DonationManagement';
import AboutManagement from './AboutManagement';
import { DEFAULT_ABOUT,getAbout } from './aboutContent';
import type { AboutContent } from './aboutContent';
import { purgeDonations } from './donationApi';
import { findNotice, notices } from './noticesData';
import type { NoticePost } from './noticesData';
import NoticeImageCarousel from './NoticeImageCarousel';
import NoticeComposer from './NoticeComposer';

type Page = 'home' | 'about' | 'about-manage' | 'news' | 'notice-detail' | 'notice-compose' | 'schedule' | 'schedule-detail' | 'gallery' | 'equipment' | 'finance' | 'donations' | 'donation-manage' | 'expenses' | 'expense-manage' | 'handover' | 'members' | 'profile';
type Navigate = (page: Page) => void;
type Notify = (message?: string) => void;
type NavItem = { id: Page; label: string };

const navGroups: { label: string; items: NavItem[] }[] = [
  { label: '소개', items: [{id:'about',label:'동아리 소개'},{id:'gallery',label:'포토존'}] },
  { label: '소식', items: [{id:'news',label:'공지사항'},{id:'finance',label:'후원 · 회계'}] },
  { label: '활동', items: [{id:'schedule',label:'합주 시간 조율'},{id:'equipment',label:'장비 대여'}] },
];
const publicNav = navGroups.flatMap(group => group.items);
const adminNav: NavItem[] = [{id:'members',label:'부원 관리'},{id:'handover',label:'인수인계'}];
const allNav: NavItem[] = [...publicNav,...adminNav,{id:'profile',label:'내 정보'}];
const managementLevel = (profile: MemberProfile | null, hasSystemClaim: boolean): 'part_leader' | 'staff' | 'president' | null => {
  if (!profile) return null;
  if (profile.superadmin && hasSystemClaim) return 'president';
  return profile.role === 'part_leader' || profile.role === 'staff' || profile.role === 'president' ? profile.role : null;
};
const profileRoleLabel = (profile: MemberProfile): string =>
  profile.role === 'president' ? '회장단'
  : profile.role === 'staff' ? '실무단'
  : profile.role === 'part_leader' ? '파트장'
  : profile.handoverAccess ? 'OB 운영진' : '일반부원';
const canViewHandover = (profile: MemberProfile | null, hasSystemClaim: boolean) => Boolean(profile && (profile.role !== 'member' || profile.handoverAccess || (profile.superadmin && hasSystemClaim)));
const pathFor = (page: Page) => page === 'home' ? '/' : page === 'notice-detail' ? '/news' : page === 'notice-compose' ? '/news/write' : page === 'schedule-detail' ? '/schedule' : page === 'donation-manage' ? '/finance/donations/manage' : page === 'about-manage' ? '/about/manage' : page === 'expense-manage' ? '/finance/expenses/manage' : page === 'donations' || page === 'expenses' ? `/finance/${page}` : `/${page}`;
const noticeIdFromPath = (): string | null => {
  const match = window.location.pathname.match(/^\/news\/([a-z0-9-]+)\/?$/);
  return match && match[1] !== 'write' ? match[1] : null;
};
const scheduleIdFromPath = (): string | null => {
  const match = window.location.pathname.match(/^\/schedule\/([a-z0-9-]+)\/?$/);
  return match ? match[1] : null;
};
const pathToPage = (): Page => {
  if (/^\/about\/manage\/?$/.test(window.location.pathname)) return 'about-manage';
  if (/^\/news\/write\/?$/.test(window.location.pathname)) return 'notice-compose';
  if (noticeIdFromPath()) return 'notice-detail';
  if (scheduleIdFromPath()) return 'schedule-detail';
  if (/^\/finance\/donations\/manage\/?$/.test(window.location.pathname)) return 'donation-manage';
  if (/^\/finance\/expenses\/manage\/?$/.test(window.location.pathname)) return 'expense-manage';
  if (/^\/finance\/donations\/?$/.test(window.location.pathname)) return 'donations';
  if (/^\/finance\/expenses\/?$/.test(window.location.pathname)) return 'expenses';
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/')[0];
  return allNav.some(item => item.id === path) ? path as Page : 'home';
};

const sessions = ['보컬', '기타', '베이스', '드럼', '키보드'];

function Placeholder({ label, className = '' }: { label: string; className?: string }) {
  return <div role="img" aria-label={`${label} 자리표시자`} className={`placeholder ${className}`}>
    <span className="placeholder-symbol" aria-hidden="true">☒</span>
    <span className="placeholder-text">{label}</span>
  </div>;
}
function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" className="text-link" onClick={onClick}>{children}<ArrowUpRight size={15} aria-hidden="true" /></button>;
}
function PageHeading({ tag, title, description }: { tag: string; title: string; description: string }) {
  return <div className="page-heading container"><span className="eyebrow">{tag}</span><h1>{title}</h1><p>{description}</p></div>;
}
function SectionHeading({ title, aside, action, onAction }: { title: string; aside?: string; action?: string; onAction?: () => void }) {
  return <div className="section-heading"><div><h2>{title}</h2>{aside && <p>{aside}</p>}</div>{action && onAction && <TextLink onClick={onAction}>{action}</TextLink>}</div>;
}
function EmptyState({ icon, title, description }: { icon?: ReactNode; title: string; description: string }) {
  return <div className="empty-state">{icon && <span className="empty-icon">{icon}</span>}<strong>{title}</strong><p>{description}</p></div>;
}

function Home({ navigate, openNotice }: { navigate: Navigate; openNotice: (id: string) => void }) {
  return <>
    <section className="hero container">
      <div className="hero-copy">
        <span className="eyebrow">SUNGKYUNKWAN UNIVERSITY BAND CLUB</span>
        <h1>여기로,<br /><span>모여락!</span></h1>
        <p>성균관대학교 중앙 밴드 동아리 모여락입니다.<br />우리의 음악과 이야기를 이곳에 담습니다.</p>
        <TextLink onClick={() => navigate('about')}>동아리 소개</TextLink>
      </div>
      <div className="hero-media"><Placeholder label="대표 공연 사진" /></div>
    </section>
    <section className="container home-updates">
      <SectionHeading title="공지사항" aside="모여락의 새로운 소식" action="전체 보기" onAction={() => navigate('news')} />
      <div className="simple-notice-list">
        {notices.slice(0, 3).map(post => <button type="button" className="simple-notice" key={post.id} onClick={() => openNotice(post.id)}>
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

function About({ navigate, canEdit }: { navigate: Navigate;canEdit:boolean }) {
  const [content,setContent]=useState<AboutContent>(DEFAULT_ABOUT);
  const [loadError,setLoadError]=useState('');
  useEffect(()=>{
    let active=true;
    void getAbout().then(data=>{if(active)setContent(data.content);})
      .catch(()=>{if(active)setLoadError('최신 소개 정보를 불러오지 못해 기본 소개 내용을 표시합니다.');});
    return()=>{active=false;};
  },[]);
  return <><PageHeading tag="ABOUT MYROCK" title="모여락 소개" description="함께 음악을 만들고 무대에 서는 사람들, 모여락을 소개합니다." />
    <section className="container about-admin-tools">
      {canEdit&&<button type="button" className="admin-only-action" onClick={()=>navigate('about-manage')}>정보 수정</button>}
      {loadError&&<p role="status" className="about-load-error">{loadError}</p>}
    </section>
    <section className="container about-intro section-block"><div className="about-description"><h2>음악을 좋아하는 사람들이<br />함께하는 공간</h2><p>보컬, 기타, 베이스, 드럼, 키보드. 서로 다른 소리로 모여 한 곡을 완성합니다. 이곳에는 동아리 소개와 활동 이야기가 정리될 예정입니다.</p><TextLink onClick={() => navigate('gallery')}>활동 사진 보러 가기</TextLink></div>
      {content.heroImage?<img className="about-hero-image" src={content.heroImage} alt="동아리 대표 사진"/>:<Placeholder label="동아리 대표 사진"/>}
    </section>
    <section className="container section-block" aria-label="28기 운영진 소개">
      <SectionHeading title="운영진" aside={content.cohortLabel} />
      <div className="leadership-grid">
        {content.officers.map(officer => <article className="leader-item" key={officer.id}>
          {officer.photoUrl?<img className="leader-photo" src={officer.photoUrl} alt={officer.name+' 사진'}/>:<Placeholder label="사진" className="leader-photo" />}
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
        {content.history.map(item=><div key={item.id}><span>{item.year}</span><p>{item.description}</p></div>)}
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


function News({ canWrite, onWrite, openNotice }: { canWrite: boolean; onWrite: () => void; openNotice: (id: string) => void }) {
  const [category, setCategory] = useState('전체');
  const [query, setQuery] = useState('');
  const search = query.trim().toLocaleLowerCase('ko');
  const filtered = notices.filter(post =>
    (category === '전체' || post.category === category) &&
    (post.title + post.description + post.body).toLocaleLowerCase('ko').includes(search)
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
        <div className={`notice-table-head${canWrite ? ' has-author' : ''}`}><span>분류</span><span>제목</span><span className="notice-date-cell">등록일</span>{canWrite && <span className="notice-author-cell">작성자</span>}</div>
        {filtered.map(post => <button type="button" key={post.id} className={`notice-table-row${canWrite ? ' has-author' : ''}`}
          onClick={() => openNotice(post.id)} aria-label={post.title + ' 상세보기'}>
          <span className="notice-category">{post.category}</span>
          <span><strong>{post.title}</strong><small>{post.description}</small></span>
          <span className="notice-date-cell">{post.date}</span>
          {canWrite && <span className="notice-author-cell">{post.author}</span>}
        </button>)}
        {filtered.length === 0 && <EmptyState title="검색 결과가 없습니다" description="검색어 또는 분류를 변경해 보세요." />}
      </div>
      <div className="list-bottom"><span>총 {filtered.length}건</span></div>
    </section>
  </>;
}

function NoticeDetail({ notice, canViewAuthor, backToList }: { notice: NoticePost | undefined; canViewAuthor: boolean; backToList: () => void }) {
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
        <div className="notice-detail-meta"><time dateTime={notice.publishedAt}>{notice.date}</time>
          {canViewAuthor && <span>작성자 {notice.author}</span>}
        </div>
      </header>
      <div className="notice-detail-content">
        <div className="notice-detail-images" aria-label="공지사항 이미지">
          <NoticeImageCarousel key={notice.id} label={notice.title + ' 첨부 이미지'} slides={notice.images.map((src, index) => ({
            id: index, src, alt: '공지 이미지 ' + (index + 1), width: 800, height: 450,
          }))}/>
        </div>
        <div className="notice-detail-body">
          {notice.body.split(/\n\s*\n/).map((paragraph, index) =>
            <p key={index}>{paragraph}</p>)}
        </div>
      </div>
      <div className="notice-detail-footer">
        <button type="button" className="outline-action" onClick={backToList}>
          <ArrowRight size={15} aria-hidden="true" /> 목록으로 돌아가기
        </button>
      </div>
    </article>
  </>;
}


function Gallery({ notify }: { notify: Notify }) {
  return <>
    <PageHeading tag="PHOTO ARCHIVE" title="포토존" description="공연부터 일상까지, 모여락의 순간들을 모아두는 공간입니다." />
    <PhotoGallery onRegister={() => notify('사진 등록 기능은 추후 연결될 예정입니다. 현재는 앨범별 사진 뷰어를 이용할 수 있습니다.')} />
  </>;
}

function Equipment({ notify }: { notify: Notify }) {
  const gears = [{name:'기타 앰프', detail:'기타 연주 장비'},{name:'마이크',detail:'보컬 및 녹음용 장비'},{name:'DI 박스',detail:'악기 연결용 장비'},{name:'마이크 스탠드',detail:'공연 및 연습용 장비'}];
  return <><PageHeading tag="EQUIPMENT" title="장비 대여" description="동아리 장비 목록을 보고 대여를 신청하는 공간입니다." />
    <section className="container section-block"><div className="toolbar toolbar-bottom"><div><h2 className="plain-h2">장비 목록</h2><p className="toolbar-description">장비 정보 및 대여 상태 표시 예시</p></div><button type="button" className="button button-secondary" onClick={() => notify()}><ClipboardList size={16}/> 내 대여 내역</button></div><div className="equipment-list">{gears.map(g => <div className="equipment-row" key={g.name}><Placeholder label="장비 사진" /><div className="equipment-info"><h3>{g.name}</h3><p>{g.detail}</p><span>등록 정보 예시</span></div><button type="button" className="outline-action" onClick={() => notify()}>대여 신청 <ArrowRight size={15} /></button></div>)}</div><div className="process-note"><strong>대여 절차</strong><div>{['대여 신청','운영진 승인','장비 반납','반납 확인'].map((s,i) => <span key={s}>{i+1}. {s}</span>)}</div></div></section>
  </>;
}


function Handover({ openLogin, notify }: { openLogin: () => void; notify: Notify }) {
  return <><PageHeading tag="HANDOVER" title="인수인계" description="운영진이 해마다 업무와 기록을 이어갈 수 있도록 마련한 공간입니다." />
    <section className="container section-block"><div className="handover-gate"><LockKeyhole size={23}/><div><h2>운영진 전용 공간</h2><p>직책별 인수인계 기록과 자료는 권한이 있는 운영진에게만 공개됩니다. 현재는 레이아웃 미리보기입니다.</p></div><button type="button" className="button button-primary" onClick={openLogin}>운영진 로그인 <ArrowRight size={16}/></button></div><div className="section-heading handover-heading"><div><h2>인수인계 자료</h2><p>자료 목록 구성 예시</p></div></div><div className="handover-items"><button type="button" onClick={() => notify()}><FileText size={21}/><span><strong>직책별 인수인계 노트</strong><small>회장단 · 실무단 · 파트장</small></span><ArrowUpRight size={17}/></button><button type="button" onClick={() => notify()}><ExternalLink size={21}/><span><strong>인수인계 드라이브</strong><small>문서 및 업무 파일 링크</small></span><ArrowUpRight size={17}/></button></div></section>
  </>;
}

function LoginDialog({ close, notify }: { close: () => void; notify: Notify }) {
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

function Profile({ user, profile, pending, error, notify, onSaved }: {user: User | null; profile: MemberProfile | null; pending: boolean; error: string; notify: Notify; onSaved: (sessions: Session[]) => void}) {
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
      <div className="profile-panel"><div className="profile-title"><UserRound size={20}/><h2>회원 정보</h2></div>
        <dl className="profile-data"><div><dt>이름</dt><dd>{profile.name}</dd></div><div><dt>학번</dt><dd>{profile.studentId}</dd></div><div><dt>기수</dt><dd>{profile.generation}기</dd></div><div><dt>직책</dt><dd>{profile.positions.length?profile.positions.join(', '):'없음'}</dd></div><div><dt>권한</dt><dd>{profileRoleLabel(profile)}</dd></div></dl>
      </div>
      <div className="profile-panel"><div className="profile-title"><Users size={20}/><h2>나의 세션</h2></div>
        <p className="profile-help">참여하는 세션을 모두 선택할 수 있습니다. 이 정보만 본인이 직접 수정할 수 있습니다.</p>
        <div className="session-options">{sessions.map(item=><label className={selected.includes(item as Session)?'chosen':''} key={item}><input type="checkbox" checked={selected.includes(item as Session)} onChange={()=>toggle(item as Session)}/><span>{item}</span><Check size={17}/></label>)}</div>
        <button className="button button-primary profile-save" type="button" onClick={save} disabled={saving||selected.length===0||selected.join('|')===profile.sessions.join('|')}>{saving?'저장 중...':'세션 저장'} <ArrowRight size={15}/></button>
      </div>
      <PasswordChange user={user}/>
    </section>
  </>;
}

function App() {
  const [page,setPage] = useState<Page>(pathToPage);
  const [activeNoticeId,setActiveNoticeId] = useState<string | null>(noticeIdFromPath);
  const [activeScheduleId,setActiveScheduleId] = useState<string | null>(scheduleIdFromPath);
  const [menuOpen,setMenuOpen] = useState(false);
  const [openGroup,setOpenGroup] = useState<string | null>(null);
  const [accountOpen,setAccountOpen] = useState(false);
  const [loginOpen,setLoginOpen] = useState(false);
  const [toast,setToast] = useState('');
  const [user,setUser] = useState<User | null>(null);
  const [profile,setProfile] = useState<MemberProfile | null>(null);
  const [authPending,setAuthPending] = useState(true);
  const [profileError,setProfileError] = useState('');
  const [hasSystemClaim,setHasSystemClaim] = useState(false);
  const [rosterResetting,setRosterResetting] = useState(false);
  const [rosterResetDeleted,setRosterResetDeleted] = useState(0);
  const [financeResetting,setFinanceResetting] = useState(false);
  const [financeRevision,setFinanceRevision] = useState(0);
  const [rosterRevision,setRosterRevision] = useState(0);
  useEffect(()=>{
    let live = true;
    const unsub = onAuthStateChanged(auth,async current=>{
      if(!live)return;
      setUser(current);setProfile(null);setProfileError('');setHasSystemClaim(false);setAuthPending(true);
      if(current){
        try {
          const snapshot = await getDoc(doc(db,'users',current.uid));
          const token = await current.getIdTokenResult().catch(() => null);
          if(live)setHasSystemClaim(token?.claims.superadmin === true);
          if(!live)return;
          if(!snapshot.exists()) setProfileError('등록된 프로필이 없습니다. 관리자에게 문의해 주세요.');
          else {
            const data = snapshot.data();
            setProfile({uid:current.uid,studentId:String(data.studentId??''),name:String(data.name??''),generation:String(data.generation??''),sessions:Array.isArray(data.sessions)?data.sessions:[],positions:Array.isArray(data.positions)?data.positions:[],role:data.role==='part_leader'||data.role==='staff'||data.role==='president'?data.role:'member',handoverAccess:data.handoverAccess===true,superadmin:data.superadmin===true});
          }
        } catch(err){console.error(err);if(live)setProfileError('프로필 조회 권한 또는 연결을 확인해 주세요.');}
      }
      if(live)setAuthPending(false);
    });
    return()=>{live=false;unsub();};
  },[]);
  useEffect(()=>{const onPop=()=>{setPage(pathToPage());setActiveNoticeId(noticeIdFromPath());setActiveScheduleId(scheduleIdFromPath());};window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);},[]);
  useEffect(()=>{document.title=`${page==='notice-compose' ? '공지사항 글쓰기' : page==='notice-detail' ? (findNotice(activeNoticeId ?? '')?.title ?? '공지사항') : page==='schedule-detail' ? (findSchedule(activeScheduleId ?? '')?.title ?? '합주 시간표') : page==='donations' ? '후원 내역' : page==='expense-manage' ? '회비 집행 내역 관리' : page==='expenses' ? '회비 집행 내역' : page==='about-manage' ? '동아리 소개 수정' : page==='home' ? '모여락' : allNav.find(n=>n.id===page)?.label ?? '모여락'} | MYROCK`;},[page,activeNoticeId,activeScheduleId]);
  useEffect(()=>{document.body.style.overflow=loginOpen?'hidden':'';return()=>{document.body.style.overflow='';};},[loginOpen]);
  useEffect(()=>{const onEscape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);}};window.addEventListener('keydown',onEscape);return()=>window.removeEventListener('keydown',onEscape);},[]);
  const navigate: Navigate = next => { if(window.location.pathname!==pathFor(next))window.history.pushState(null,'',pathFor(next));setPage(next);setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  const openNotice = (id: string) => {
    if (!findNotice(id)) return;
    const path = '/news/' + encodeURIComponent(id);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setActiveNoticeId(id);
    setPage('notice-detail');
    setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);
    window.scrollTo({top:0,behavior:'instant'});
  };

  const openSchedule = (id: string) => {
    if (!findSchedule(id)) return;
    const path = '/schedule/' + encodeURIComponent(id);
    if (window.location.pathname !== path) window.history.pushState(null, '', path);
    setActiveScheduleId(id);
    setPage('schedule-detail');
    setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);
    window.scrollTo({top:0,behavior:'instant'});
  };
  const notify: Notify = (message='아직 연결되지 않은 기능입니다. 현재는 화면 구성 미리보기입니다.') => {setToast(message);window.setTimeout(()=>setToast(''),3500);};
  const showLogin=()=>{setLoginOpen(true);setMenuOpen(false);setAccountOpen(false);};
  const logout=async()=>{try{await signOut(auth);navigate('home');notify('로그아웃되었습니다.');}catch{notify('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');}};
  async function resetRosterExceptMyself() {
    if (rosterResetting || !user || !profile?.superadmin || !hasSystemClaim) return;
    const confirmed = window.confirm(
      '개발용 명단 초기화입니다. 본인 계정을 제외한 모든 부원의 Firestore 프로필과 Firebase 로그인 계정이 삭제됩니다.\n\n삭제된 계정은 자동 복구할 수 없습니다. 실행할까요?'
    );
    if (!confirmed) return;
    setAccountOpen(false);
    setMenuOpen(false);
    setRosterResetDeleted(0);
    setRosterResetting(true);
    try {
      const deleted = await purgeAllOtherMembers(setRosterResetDeleted);
      setRosterRevision(previous => previous + 1);
      navigate('members');
      window.alert('명단 초기화가 완료되었습니다. 본인을 제외하고 삭제한 부원: ' + deleted + '명');
    } catch (error) {
      const message = error instanceof Error ? error.message : '알 수 없는 서버 오류';
      window.alert('명단 초기화가 중단되었습니다.\n' + message + '\n\nFirebase Auth 및 Firestore의 실제 상태를 확인한 뒤 다시 시도해 주세요.');
      setRosterRevision(previous => previous + 1);
    } finally {
      setRosterResetting(false);
    }
  }
  async function resetDonationFinance() {
    if(financeResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    const typed=window.prompt('모든 후원 기록과 익명자 명단, 회비 집행 내역이 영구 삭제됩니다. 계속하려면 후원 · 회계 초기화를 입력하세요.');
    if(typed!=='후원 · 회계 초기화')return;
    if(!window.confirm('후원과 회비 집행 내역 전체를 영구 삭제합니다. 복구할 수 없습니다. 실행할까요?'))return;
    setFinanceResetting(true);setAccountOpen(false);setMenuOpen(false);
    let removed=0;
    try {
      let complete=false;
      for(let i=0;i<500&&!complete;i++){
        const response=await purgeDonations();
        removed+=response.deleted;complete=response.done;
      }
      if(!complete)throw Error('초기화 허용 처리 횟수를 초과했습니다.');
      setFinanceRevision(prev=>prev+1);
      navigate('donations');
      window.alert('후원 · 회계 초기화가 완료되었습니다. 삭제된 기록: '+removed+'건');
    }catch(error) {
      window.alert('후원 · 회계 초기화가 중단되었습니다. '+(error instanceof Error?error.message:'서버 오류')+'\n관리 화면에서 남은 데이터를 확인해 주세요.');
      setFinanceRevision(prev=>prev+1);
    }finally{setFinanceResetting(false);}
  }
  const isDeveloperSuperadmin=Boolean(user && profile?.superadmin && hasSystemClaim);
  const currentLevel=managementLevel(profile,hasSystemClaim);
  const canManage=currentLevel!==null;
  const canManageDonations=currentLevel==='staff'||currentLevel==='president';
  const canHandover=canViewHandover(profile,hasSystemClaim);
  return <div className="site-root" data-async-busy={rosterResetting||financeResetting ? "true" : undefined}>
    <header className="site-header"><div className="container header-inner">
      <button type="button" className="brand" onClick={()=>navigate('home')} aria-label="모여락 홈으로 이동"><img src={logo} alt="모여락 로고"/><span><strong>모여락</strong><small>MYROCK</small></span></button>
      <nav className="desktop-nav" aria-label="주 메뉴">{navGroups.map(group=><div className="more-wrapper nav-group" key={group.label} onMouseEnter={()=>setOpenGroup(group.label)} onMouseLeave={()=>setOpenGroup(null)}><button type="button" aria-expanded={openGroup===group.label} className={group.items.some(i=>i.id===page)?'active':''} onClick={()=>setOpenGroup(openGroup===group.label?null:group.label)}>{group.label} <ChevronDown size={13}/></button>{openGroup===group.label&&<div className="more-menu">{group.items.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)}>{item.label}</button>)}</div>}</div>)}</nav>
      <div className="header-actions">
        {!user?<button type="button" className="login-button" onClick={showLogin}>로그인</button>:<div className="more-wrapper account-wrapper"
          onMouseEnter={() => { if (window.matchMedia('(hover: hover)').matches) { setAccountOpen(true); setOpenGroup(null); } }}
          onMouseLeave={() => setAccountOpen(false)}
          onFocus={() => { if (window.matchMedia('(hover: hover)').matches) setAccountOpen(true); }}
          onBlur={event => { if (!event.relatedTarget || !event.currentTarget.contains(event.relatedTarget as Node)) setAccountOpen(false); }}
        ><button className="login-button account-toggle" type="button"
          onClick={() => { if (!window.matchMedia('(hover: hover)').matches) setAccountOpen(previous => !previous); }}
          aria-haspopup="menu" aria-expanded={accountOpen}><UserRound size={15}/>{profile?.name??'내 계정'}<ChevronDown size={13}/></button>{accountOpen&&<div className="more-menu account-menu"><button type="button" onClick={()=>navigate('profile')}>내 정보</button>{canManage&&<button type="button" onClick={()=>navigate('members')}>부원 관리</button>}{canHandover&&<button type="button" onClick={()=>navigate('handover')}>인수인계</button>}<button type="button" onClick={logout} disabled={rosterResetting}>로그아웃</button>{isDeveloperSuperadmin && <><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting} onClick={() => void resetRosterExceptMyself()}>명단 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting} onClick={() => void resetDonationFinance()}>후원 · 회계 초기화</button></>}</div>}</div>}
        <button type="button" className="mobile-menu-button" onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?'메뉴 닫기':'메뉴 열기'} aria-expanded={menuOpen}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
      </div>
    </div>{menuOpen&&<nav className="mobile-nav" aria-label="모바일 메뉴"><div className="container">{navGroups.map(group=><div className="mobile-group" key={group.label}><button type="button" aria-expanded={openGroup===group.label} onClick={()=>setOpenGroup(openGroup===group.label?null:group.label)}><strong>{group.label}</strong><ChevronDown size={16}/></button>{openGroup===group.label&&<div className="mobile-submenu">{group.items.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)}>{item.label}</button>)}</div>}</div>)}{user&&<><button type="button" onClick={()=>navigate('profile')}>내 정보<ArrowRight size={16}/></button>{canManage&&<button type="button" onClick={()=>navigate('members')}>부원 관리<ArrowRight size={16}/></button>}{canHandover&&<button type="button" onClick={()=>navigate('handover')}>인수인계<ArrowRight size={16}/></button>}<button type="button" onClick={logout} disabled={rosterResetting}>로그아웃<LogOut size={16}/></button>{isDeveloperSuperadmin && <><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting} onClick={() => void resetRosterExceptMyself()}>명단 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting} onClick={() => void resetDonationFinance()}>후원 · 회계 초기화<Trash2 size={15}/></button></>}</>}</div></nav>}
    </header>
    <main key={page}>
      {page==='home'&&<Home navigate={navigate} openNotice={openNotice}/>}
      {page==='about'&&<About navigate={navigate} canEdit={Boolean(user&&!authPending&&canManageDonations)}/>}
       {page==='about-manage'&&(authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canManageDonations?<AboutManagement onBack={()=>navigate('about')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="동아리 소개 수정은 실무단 이상만 가능합니다."/></section>)}
      {page==='news'&&<News canWrite={Boolean(user && !authPending && currentLevel)} onWrite={() => navigate('notice-compose')} openNotice={openNotice}/>}
      {page==='notice-compose'&&(authPending ? <section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다." /></section> : user && currentLevel ? <NoticeComposer onBack={() => navigate('news')}/> : <section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="공지사항 글쓰기는 파트장 이상 운영진만 사용할 수 있습니다." /></section>)}
      {page==='notice-detail'&&<NoticeDetail notice={findNotice(activeNoticeId ?? '')} canViewAuthor={Boolean(user && !authPending && currentLevel)} backToList={() => navigate('news')}/>}
      {page==='schedule'&&<ScheduleLanding
        canCreateTeam={Boolean(user && !authPending && currentLevel)}
        onCreate={() => notify('시간표 만들기 기능은 추후 연결할 예정입니다.')}
        onCreateTeam={() => notify('구성팀 시간표 만들기 기능은 추후 연결할 예정입니다.')}
        onOpen={openSchedule}
      />}
      {page==='schedule-detail'&&<ScheduleDetail schedule={findSchedule(activeScheduleId ?? '')} onBack={() => navigate('schedule')}/>}

      {page==='gallery'&&<Gallery notify={notify}/>}
      {page==='equipment'&&<Equipment notify={notify}/>}
      {page==='finance'&&<FinanceLanding onDonations={() => navigate('donations')} onExpenses={() => navigate('expenses')} canEditAccount={Boolean(user&&!authPending&&currentLevel==='president')}/>}
      {page==='donations'&&<DonationHistory key={financeRevision} onBack={() => navigate('finance')} loggedIn={Boolean(user)} authPending={authPending} onLogin={showLogin} canManageDonations={Boolean(!authPending&&user&&canManageDonations)} onManage={()=>navigate('donation-manage')}/>}
      {page==='donation-manage'&&(authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태 확인 중입니다."/></section>:user&&canManageDonations?<DonationManagement onBack={()=>navigate('donations')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="후원 내역 관리는 실무단 이상만 가능합니다."/></section>)}
      {page==='expenses'&&<ExpenseHistory onBack={() => navigate('finance')} canManageExpenses={Boolean(user&&!authPending&&canManageDonations)} onManage={()=>navigate('expense-manage')}/>}
      {page==='expense-manage'&&(authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canManageDonations?<ExpenseManagement onBack={()=>navigate('expenses')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="회비 집행 내역 관리는 실무단 이상만 가능합니다."/></section>)}
      {page==='profile'&&<Profile user={user} profile={profile} pending={authPending} error={profileError} notify={notify} onSaved={next=>setProfile(previous=>previous?{...previous,sessions:next}:null)}/>}
      {(page==='handover'||page==='members')&&(authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다." /></section>:page==='members'&&canManage&&user?<><PageHeading tag="MEMBER MANAGEMENT" title="부원 관리" description="부원 명단 조회와 운영 권한에 따른 부원 정보 수정"/><MemberManager key={rosterRevision} currentUid={user.uid} level={currentLevel!}/></>:page==='handover'&&canHandover?<Handover openLogin={showLogin} notify={notify}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="해당 메뉴에 접근할 수 있는 운영진 권한이 필요합니다." /></section>)}
    </main>
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <span>모여락 <small>MYROCK</small></span>
          <p>여기로, 모여락!</p>
        </div>
        <nav className="footer-nav" aria-label="푸터 사이트 메뉴">
          {navGroups.map(group => <div key={group.label}>
            <strong>{group.label}</strong>
            {group.items.map(item => <button type="button" key={item.id} onClick={() => navigate(item.id)}>{item.label}</button>)}
          </div>)}
        </nav>
      </div>
      <div className="container footer-lower">
        <div className="footer-bottom">
          <span>© MYROCK · 성균관대학교 중앙 밴드동아리</span>
        </div>
        <div className="footer-contact-section">
          <div className="footer-contact-people">
            <span>회장 김서연 · 010-6350-7007</span>
            <span>부회장 신희수 · 010-7684-4336</span>
          </div>
          <span className="footer-bug-report">
            <Mail size={14} aria-hidden="true" /> 오류 보고 · naa3000@naver.com
          </span>
        </div>
      </div>
    </footer>
    {rosterResetting&&<div className="modal-overlay roster-reset-overlay" aria-live="polite">
      <div className="login-dialog roster-reset-dialog" role="status">
        <div className="profile-title"><Trash2 size={20}/><h2>명단 초기화 진행 중</h2></div>
        <p>본인 계정은 유지하고 다른 부원들의 Firebase 로그인 계정과 프로필을 정리하고 있습니다.</p>
        <p className="roster-reset-counter">삭제 확인: <strong>{rosterResetDeleted}명</strong></p>
        <p className="form-hint">완료될 때까지 창을 새로고침하거나 닫지 마세요.</p>
      </div>
    </div>}
    {loginOpen&&<LoginDialog close={()=>setLoginOpen(false)} notify={notify}/>}
    {toast&&<div className="toast" role="status"><CircleHelp size={17}/><span>{toast}</span><button type="button" aria-label="알림 닫기" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}
export default App;
