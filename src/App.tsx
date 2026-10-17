import {useCallback,useEffect,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import type {User} from 'firebase/auth';
import {onAuthStateChanged,signOut} from 'firebase/auth';
import {doc,getDoc} from 'firebase/firestore';
import {useBlocker,useLocation,useNavigate as useRouterNavigate,Route,Routes,Navigate as RouterRedirect} from 'react-router-dom';
import {auth,db} from './firebase';
import type {MemberProfile} from './firebase';
import {ArrowRight,ChevronDown,Trash2,CircleHelp,LockKeyhole,Mail,Menu,X,UserRound,LogOut} from 'lucide-react';
import logo from './logo-transparent.png';
import MemberManager from './MemberManager';
import EquipmentManager from './EquipmentManager';
import {equipmentAction,getEquipment,manageEquipment} from './equipmentApi';
import type {EquipmentAction,EquipmentManageAction,EquipmentManageInput} from './equipmentApi';
import type {EquipmentItem} from './equipmentDemo';
import {purgeAllOtherMembers} from './memberAdmin';
import {ScheduleLanding} from './SchedulePages';
import ScheduleRoom from './ScheduleRoom';
import ScheduleCreation from './ScheduleCreation';
import HandoverNotesEditor,{HandoverNotesView} from './HandoverNotes';
import {DonationHistory,ExpenseHistory,FinanceLanding} from './FinancePages';
import ExpenseManagement from './ExpenseManagement';
import DonationManagement from './DonationManagement';
import AboutManagement from './AboutManagement';
import TimedBottomToast from './TimedBottomToast';
import {purgeDonations} from './donationApi';
import {purgeNotices,resetClubIntroduction,resetSiteAssets,purgeGallery} from './adminResets';
import {invalidateAboutCache} from './aboutContent';
import {listNoticesPage,getNotice,deleteNotice} from './noticesData';
import type {NoticePost} from './noticesData';
import NoticeComposer from './NoticeComposer';
import {Home,About,News,NoticeDetail,Gallery,Equipment,Handover,LoginDialog,Profile,PageHeading,EmptyState} from './pages/SitePages';
import {navGroups,allNav,routeDefinitions,routeFromPath,pathFor,noticePath,editNoticePath,schedulePath} from './app/siteNavigation';
import type {Page,Navigate,Notify} from './app/siteNavigation';

const managementLevel = (profile: MemberProfile | null, hasSystemClaim: boolean): 'part_leader' | 'staff' | 'president' | null => {
  if (!profile) return null;
  if (profile.superadmin && hasSystemClaim) return 'president';
  return profile.role === 'part_leader' || profile.role === 'staff' || profile.role === 'president' ? profile.role : null;
};
const canViewHandover = (profile: MemberProfile | null, hasSystemClaim: boolean) => Boolean(profile && (profile.role !== 'member' || profile.handoverAccess || (profile.superadmin && hasSystemClaim)));

function App() {
  const location=useLocation();
  const routerNavigate=useRouterNavigate();
  const matched=routeFromPath(location.pathname);
  const page=matched.page;
  const activeNoticeId=(page==='notice-detail'||page==='notice-edit')?(matched.params.id??null):null;
  const activeScheduleId=page==='schedule-detail'?(matched.params.id??null):null;
  const [notices,setNotices]=useState<NoticePost[]>([]);
  const [noticeLoading,setNoticeLoading]=useState(true);
  const [noticeError,setNoticeError]=useState('');
  const [noticeCursor,setNoticeCursor]=useState<string|null>(null);
  const [noticeMoreLoading,setNoticeMoreLoading]=useState(false);
  const [noticeDetail,setNoticeDetail]=useState<NoticePost|null>(null);
  const [noticeDetailLoading,setNoticeDetailLoading]=useState(false);
  const [noticeDetailError,setNoticeDetailError]=useState('');
  useEffect(()=>{
    let live=true;
    void listNoticesPage().then(result=>{if(live){setNotices(result.notices);setNoticeCursor(result.nextPageToken);setNoticeError('');}})
      .catch(e=>{if(live)setNoticeError(e instanceof Error?e.message:'공지사항 조회 실패');})
      .finally(()=>{if(live)setNoticeLoading(false);});
    return()=>{live=false;};
  },[]);
  async function loadMoreNotices(){
    if(!noticeCursor||noticeMoreLoading)return;
    setNoticeMoreLoading(true);
    try{
      const result=await listNoticesPage(noticeCursor);
      setNotices(prev=>[...prev,...result.notices.filter(item=>!prev.some(p=>p.id===item.id))]);
      setNoticeCursor(result.nextPageToken);
      setNoticeError('');
    }catch(e){setNoticeError(e instanceof Error?e.message:'공지사항 조회 실패');}
    finally{setNoticeMoreLoading(false);}
  }
  useEffect(()=>{
    let live=true;
    if(!activeNoticeId){setNoticeDetail(null);setNoticeDetailError('');setNoticeDetailLoading(false);return;}
    setNoticeDetail(null);setNoticeDetailError('');setNoticeDetailLoading(true);
    void getNotice(activeNoticeId).then(item=>{if(live)setNoticeDetail(item);})
      .catch(e=>{if(live)setNoticeDetailError(e instanceof Error?e.message:'공지사항 상세 조회 실패');})
      .finally(()=>{if(live)setNoticeDetailLoading(false);});
    return()=>{live=false;};
  },[activeNoticeId]);
  const [menuOpen,setMenuOpen] = useState(false);
  const [openGroup,setOpenGroup] = useState<string | null>(null);
  const [accountOpen,setAccountOpen] = useState(false);
  const [loginOpen,setLoginOpen] = useState(false);
  const [toast,setToast] = useState('');
  const [aboutSaveNotice,setAboutSaveNotice]=useState('');
  const [loginNotice,setLoginNotice]=useState('');
  const leaveGuardRef=useRef<(()=>boolean)|null>(null);
  const registerEditorLeaveGuard=useCallback((guard:(()=>boolean)|null)=>{leaveGuardRef.current=guard;},[]);
  const canLeaveEditor=()=>leaveGuardRef.current?.()??true;
  const [user,setUser] = useState<User | null>(null);
  const [profile,setProfile] = useState<MemberProfile | null>(null);
  const [authPending,setAuthPending] = useState(true);
  const [profileError,setProfileError] = useState('');
  const [hasSystemClaim,setHasSystemClaim] = useState(false);
  const [rosterResetting,setRosterResetting] = useState(false);
  const [rosterResetDeleted,setRosterResetDeleted] = useState(0);
  const [financeResetting,setFinanceResetting] = useState(false);
  const [noticeResetting,setNoticeResetting]=useState(false);
  const [aboutResetting,setAboutResetting]=useState(false);
  const [assetResetting,setAssetResetting]=useState(false);
  const [galleryResetting,setGalleryResetting]=useState(false);
  const [galleryRevision,setGalleryRevision]=useState(0);
  const [aboutRevision,setAboutRevision]=useState(0);
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
  // React Router handles browser history, including back/forward and POP.
  // A blocked transition is resumed or cancelled without inserting extra history entries.
  const blocker=useBlocker(({currentLocation,nextLocation})=>
    currentLocation.pathname!==nextLocation.pathname&&Boolean(leaveGuardRef.current)
  );
  useEffect(()=>{
    if(blocker.state!=='blocked')return;
    if(leaveGuardRef.current?.()??true)blocker.proceed();
    else blocker.reset();
  },[blocker]);
  useEffect(()=>{document.title=`${page==='notice-compose' ? '공지사항 글쓰기' : page==='notice-edit' ? '공지사항 수정하기' : page==='notice-detail' ? (notices.find(item=>item.id===activeNoticeId)?.title??'공지사항') : page==='schedule-create' ? '시간표 만들기' : page==='schedule-detail' ? '합주 시간표' : page==='donations' ? '후원 내역' : page==='expense-manage' ? '회비 집행 내역 관리' : page==='expenses' ? '회비 집행 내역' : page==='about-manage' ? '동아리 소개 수정' : page==='home' ? '모여락' : allNav.find(n=>n.id===page)?.label ?? '모여락'} | MYROCK`;},[page,activeNoticeId,activeScheduleId,notices]);
  useEffect(()=>{document.body.style.overflow=loginOpen?'hidden':'';return()=>{document.body.style.overflow='';};},[loginOpen]);
  useEffect(()=>{const onEscape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);}};window.addEventListener('keydown',onEscape);return()=>window.removeEventListener('keydown',onEscape);},[]);
  const navigate:Navigate=next=>{const path=pathFor(next);if(location.pathname!==path)routerNavigate(path);setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  const openNotice=(id:string)=>{routerNavigate(noticePath(id));setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  const editNotice=(id:string)=>{routerNavigate(editNoticePath(id));window.scrollTo({top:0,behavior:'instant'});};
  const savedNotice=(post:NoticePost)=>{
    setNoticeDetail(post);
    setNotices(prev=>[post,...prev.filter(x=>x.id!==post.id)].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)));
    openNotice(post.id);
  };
  const removeNotice=async(post:NoticePost)=>{
    if(!window.confirm('공지사항을 삭제하시겠습니까? 삭제한 글은 되돌릴 수 없습니다.'))return;
    try{await deleteNotice(post.id,post.updateTime);setNoticeDetail(null);setNotices(prev=>prev.filter(x=>x.id!==post.id));navigate('news');notify('공지사항을 삭제했습니다.');}
    catch(e){notify(e instanceof Error?e.message:'공지사항 삭제 실패');}
  };
  const openSchedule=(id:string)=>{routerNavigate(schedulePath(id));setOpenGroup(null);setAccountOpen(false);setMenuOpen(false);window.scrollTo({top:0,behavior:'instant'});};
  const notify: Notify = (message='아직 연결되지 않은 기능입니다. 현재는 화면 구성 미리보기입니다.') => {setToast(message);window.setTimeout(()=>setToast(''),3500);};
  const showLogin=()=>{setLoginOpen(true);setMenuOpen(false);setAccountOpen(false);};
  const logout=async()=>{if(!canLeaveEditor())return;try{await signOut(auth);leaveGuardRef.current=null;navigate('home');notify('로그아웃되었습니다.');}catch{notify('로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.');}};
  async function resetRosterExceptMyself() {
    if (rosterResetting || financeResetting || noticeResetting || aboutResetting || assetResetting || !user || !profile?.superadmin || !hasSystemClaim) return;
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
    if(financeResetting||rosterResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    if(!window.confirm('경고: 모든 후원 기록, 회비 집행 내역 및 익명자 명단을 영구 삭제합니다. 복구할 수 없습니다. 계속하시겠습니까?'))return;
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
  async function resetAllNotices(){
    if(rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    if(!window.confirm('경고: 모든 공지사항과 GitHub notices/ 폴더의 사진을 영구 삭제합니다. gallery/와 site/는 유지됩니다. 계속하시겠습니까?'))return;
    setNoticeResetting(true);setAccountOpen(false);setMenuOpen(false);
    let removed=0;
    try{
      let done=false;
      for(let i=0;i<500&&!done;i++){
        const result=await purgeNotices();
        removed+=result.deleted;done=result.done;
      }
      if(!done)throw Error('초기화 요청 횟수를 초과했습니다.');
      setNotices([]);setNoticeCursor(null);setNoticeDetail(null);setNoticeError('');navigate('news');
      window.alert('공지사항과 notices/ 사진 초기화가 완료되었습니다. 삭제된 공지사항: '+removed+'건');
    }catch(error){
      window.alert('공지사항 초기화가 중단되었습니다. 지금까지 삭제한 공지사항: '+removed+'건. '+(error instanceof Error?error.message:'서버 오류'));
      void listNoticesPage().then(result=>{setNotices(result.notices);setNoticeCursor(result.nextPageToken);}).catch(()=>{});
    }finally{setNoticeResetting(false);}
  }
  async function resetIntroduction(){
    if(rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    if(!window.confirm('경고: 모여락 소개의 운영진 정보와 연혁을 28기 기본값으로 되돌립니다. 메인 페이지·동아리 소개·운영진 사진 URL과 GitHub 이미지 파일은 유지됩니다. 계속하시겠습니까?'))return;
    setAboutResetting(true);setAccountOpen(false);setMenuOpen(false);
    try{
      await resetClubIntroduction();
      invalidateAboutCache();
      setAboutRevision(v=>v+1);
      navigate('about');
      window.alert('모여락 소개 내용이 28기 운영진과 1998년·2023년 연혁으로 초기화되었습니다. 메인·동아리 소개·운영진 사진 URL과 GitHub 파일은 그대로 유지됩니다.');
    }catch(error){
      window.alert('모여락 소개 초기화에 실패했습니다. Firestore 상태를 확인해 주세요. '+(error instanceof Error?error.message:'서버 오류'));
    }finally{setAboutResetting(false);}
  }
  async function resetAssets(){
    if(rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    if(!window.confirm('경고: GitHub site/ 사진과 Firestore의 메인·동아리 소개·운영진 사진 URL을 삭제합니다. gallery/, notices/, 운영진 정보와 연혁은 유지됩니다. 계속하시겠습니까?'))return;
    setAssetResetting(true);setAccountOpen(false);setMenuOpen(false);
    try{
      await resetSiteAssets();
      invalidateAboutCache();
      setAboutRevision(v=>v+1);
      window.alert('site/ 에셋과 Firebase의 메인·동아리 소개·운영진 사진 URL이 초기화되었습니다. 기존 직접 이미지 URL은 Cloudflare 캐시에 잠시 남을 수 있습니다.');
    }catch(error){
      window.alert('에셋 초기화가 완료되지 않았습니다. GitHub 파일 정리가 먼저 완료되었을 수도 있으니 저장소를 확인하고 다시 시도해 주세요. '+(error instanceof Error?error.message:'서버 오류'));
    }finally{setAssetResetting(false);}
  }
  async function resetGallery(){
    if(galleryResetting||rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||!user||!profile?.superadmin||!hasSystemClaim)return;
    if(!window.confirm('경고: 모든 갤러리 앨범 데이터와 GitHub 이미지 저장소 gallery/ 폴더의 사진을 삭제합니다. 영구 삭제이며 다른 페이지 사진은 유지됩니다. 계속하시겠습니까?'))return;
    setGalleryResetting(true);setAccountOpen(false);setMenuOpen(false);
    let deleted=0;
    try{
      let done=false;
      for(let attempt=0;attempt<200;attempt++){
        const result=await purgeGallery();
        deleted+=result.deleted;
        if(result.done){done=true;break;}
      }
      if(!done)throw Error('처리 한도를 초과했습니다. 초기화를 다시 실행해 주세요.');
      setGalleryRevision(value=>value+1);
      window.alert('갤러리 초기화를 완료했습니다. 삭제한 앨범: '+deleted+'개. 이미지 repo gallery/ 파일도 정리했습니다.');
    }catch(error){
      setGalleryRevision(value=>value+1);
      window.alert('갤러리 초기화가 중단되었습니다. 삭제한 앨범: '+deleted+'개. 다시 초기화를 실행하면 남은 데이터를 정리합니다. '+(error instanceof Error?error.message:'서버 오류'));
    }finally{setGalleryResetting(false);}
  }
  const isDeveloperSuperadmin=Boolean(user && profile?.superadmin && hasSystemClaim);
  const [equipmentItems,setEquipmentItems]=useState<EquipmentItem[]>([]);
  const [equipmentLoading,setEquipmentLoading]=useState(true);
  const [equipmentError,setEquipmentError]=useState('');
  const [equipmentBusyId,setEquipmentBusyId]=useState<string|null>(null);
  const loadEquipment=useCallback(async(manage:boolean,showLoading=false)=>{
    if(showLoading)setEquipmentLoading(true);
    try{
      const result=await getEquipment(manage);
      setEquipmentItems(result.items);
      setEquipmentError('');
    }catch(error){
      setEquipmentItems([]);
      setEquipmentError(error instanceof Error?error.message:'장비를 불러오지 못했습니다.');
    }finally{if(showLoading)setEquipmentLoading(false);}
  },[]);
  useEffect(()=>{
    if((page!=='equipment'&&page!=='equipment-manage')||authPending)return;
    if(page==='equipment-manage'&&!user)return;
    const manage=page==='equipment-manage';
    void loadEquipment(manage,true);
    const timer=window.setInterval(()=>{void loadEquipment(manage);},15000);
    return()=>window.clearInterval(timer);
  },[page,authPending,user?.uid,loadEquipment]);
  async function handleEquipmentAction(id:string,action:EquipmentAction){
    if(equipmentBusyId)return;
    if(action==='return'&&!window.confirm('이 장비를 반납하고 운영진에게 확인을 요청하시겠습니까?'))return;
    setEquipmentBusyId(id);
    try{
      await equipmentAction(id,action);
      await loadEquipment(false,true);
      notify(action==='apply'?'대여 신청을 접수했습니다.':action==='cancel'?'대여 신청을 취소했습니다.':'반납 확인을 요청했습니다.');
    }catch(error){notify(error instanceof Error?error.message:'장비 요청에 실패했습니다.');await loadEquipment(false,true);}
    finally{setEquipmentBusyId(null);}
  }
  async function handleEquipmentManage(action:EquipmentManageAction,input:EquipmentManageInput){
    if(equipmentBusyId)throw new Error('이전 장비 요청을 처리하는 중입니다.');
    setEquipmentBusyId(input.id??'equipment-new');
    try{
      await manageEquipment(action,input);
      await loadEquipment(true,true);
    }finally{setEquipmentBusyId(null);}
  }
  const currentLevel=managementLevel(profile,hasSystemClaim);
  const canManage=currentLevel!==null;
  const canManageDonations=currentLevel==='staff'||currentLevel==='president';
  const canHandover=canViewHandover(profile,hasSystemClaim);
  const activeFullNotice=noticeDetail?.id===activeNoticeId?noticeDetail:null;
  const pageViews:Record<Page,ReactNode>={
    'home': <Home key={aboutRevision} navigate={navigate} openNotice={openNotice} notices={notices}/>,
    'about': <About key={aboutRevision} navigate={navigate} canEdit={Boolean(user&&!authPending&&canManageDonations)}/>,
    'about-manage': (authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canManageDonations?<AboutManagement onBack={()=>navigate('about')} registerLeaveGuard={registerEditorLeaveGuard} onSaved={message=>{navigate('about');setAboutSaveNotice(message??'변경 사항을 저장했습니다. 이미지 업로드까지 시간이 걸릴 수 있습니다.');}}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="동아리 소개 수정은 실무단 이상만 가능합니다."/></section>),
    'news': <News canWrite={Boolean(user && !authPending && currentLevel)} onWrite={() => navigate('notice-compose')} openNotice={openNotice} notices={notices} loading={noticeLoading} error={noticeError} hasMore={Boolean(noticeCursor)} moreLoading={noticeMoreLoading} onLoadMore={()=>void loadMoreNotices()}/>,
    'notice-compose': (authPending ? <section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다." /></section> : user && currentLevel ? <NoticeComposer onBack={() => navigate('news')} onSaved={savedNotice} registerLeaveGuard={registerEditorLeaveGuard}/> : <section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="공지사항 글쓰기는 파트장 이상 운영진만 사용할 수 있습니다." /></section>),
    'notice-edit': (authPending||noticeDetailLoading||(!noticeDetailError&&!activeFullNotice)?<section className="container section-block"><EmptyState title="공지사항 확인 중" description="공지사항과 로그인 상태를 확인하고 있습니다."/></section>:user&&currentLevel&&activeFullNotice?<NoticeComposer key={activeNoticeId} initial={activeFullNotice} onBack={()=>activeNoticeId?openNotice(activeNoticeId):navigate('news')} onSaved={savedNotice} registerLeaveGuard={registerEditorLeaveGuard}/>:<section className="container section-block"><EmptyState title="접근 권한이 없습니다" description="공지사항 수정은 파트장 이상만 가능합니다."/></section>),
    'notice-detail': (noticeDetailLoading||(!noticeDetailError&&!activeFullNotice)?<section className="container section-block"><p>공지사항을 불러오는 중입니다.</p></section>:noticeDetailError?<section className="container section-block"><EmptyState title="공지사항을 불러올 수 없습니다" description={noticeDetailError}/></section>:<NoticeDetail key={activeNoticeId} notice={activeFullNotice??undefined} canManage={Boolean(user&&!authPending&&currentLevel)} backToList={()=>navigate('news')} onEdit={()=>activeNoticeId&&editNotice(activeNoticeId)} onDelete={()=>{if(activeFullNotice)void removeNotice(activeFullNotice);}}/>),
    'schedule': <ScheduleLanding
        canCreateTeam={Boolean(user && !authPending && currentLevel)}
        loggedIn={Boolean(user && profile && !authPending)}
        authPending={authPending}
        onLogin={showLogin}
        onCreate={() => navigate('schedule-create')}
        onCreateTeam={() => navigate('schedule-team-create')}
        onOpen={openSchedule}
      />,
    'schedule-create': authPending
      ? <section className="container section-block"><p>로그인 상태를 확인하고 있습니다.</p></section>
      : !user || !profile ? <section className="container section-block"><p>시간표 생성은 로그인한 부원만 사용할 수 있습니다.</p><button type="button" className="button button-primary" onClick={showLogin}>로그인</button></section>
      : <ScheduleCreation onBack={() => navigate('schedule')} onCreated={openSchedule}/>,
    'schedule-team-create': authPending
      ? <section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>
      : !user || !currentLevel || !profile
      ? <section className="container section-block"><EmptyState title="접근 권한이 없습니다" description="구성팀 시간표 만들기는 파트장 이상만 사용할 수 있습니다."/></section>
      : <ScheduleCreation teamMode onBack={()=>navigate('schedule')} onCreated={openSchedule}/>,
    'schedule-detail': activeScheduleId && user && profile && !authPending
      ? <ScheduleRoom key={activeScheduleId} id={activeScheduleId} onBack={() => navigate('schedule')} registerLeaveGuard={registerEditorLeaveGuard}/>
      : <section className="container section-block"><p>시간표를 확인하려면 로그인해 주세요.</p><button type="button" className="button button-primary" onClick={showLogin}>로그인</button></section>,
    'gallery': <Gallery key={galleryRevision} canRegister={Boolean(user && !authPending && currentLevel)}/>,
    'equipment': <Equipment items={equipmentItems} canManage={Boolean(user&&!authPending&&currentLevel)} onManage={()=>navigate('equipment-manage')} loggedIn={Boolean(user&&profile&&!authPending)} onLogin={showLogin} loading={equipmentLoading} error={equipmentError} busyId={equipmentBusyId} onRefresh={()=>void loadEquipment(false,true)} onAction={(id,action)=>void handleEquipmentAction(id,action)}/>,
    'equipment-manage': authPending?<section className="container section-block"><p>권한 확인 중입니다.</p></section>:user&&currentLevel?<EquipmentManager items={equipmentItems} busy={equipmentBusyId!==null} loading={equipmentLoading} error={equipmentError} onRefresh={()=>void loadEquipment(true,true)} onMutate={handleEquipmentManage} onBack={()=>navigate('equipment')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="장비 관리는 파트장 이상만 이용할 수 있습니다."/></section>,
    'finance': <FinanceLanding onDonations={() => navigate('donations')} onExpenses={() => navigate('expenses')} canEditAccount={Boolean(user&&!authPending&&currentLevel==='president')} loggedIn={Boolean(user&&profile&&!authPending)} authPending={authPending} onLogin={showLogin}/>,
    'donations': <DonationHistory key={financeRevision} onBack={() => navigate('finance')} loggedIn={Boolean(user)} authPending={authPending} onLogin={showLogin} canManageDonations={Boolean(!authPending&&user&&canManageDonations)} onManage={()=>navigate('donation-manage')}/>,
    'donation-manage': (authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태 확인 중입니다."/></section>:user&&canManageDonations?<DonationManagement onBack={()=>navigate('donations')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="후원 내역 관리는 실무단 이상만 가능합니다."/></section>),
    'expenses': <ExpenseHistory onBack={() => navigate('finance')} canManageExpenses={Boolean(user&&!authPending&&canManageDonations)} onManage={()=>navigate('expense-manage')}/>,
    'expense-manage': (authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canManageDonations?<ExpenseManagement onBack={()=>navigate('expenses')}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="회비 집행 내역 관리는 실무단 이상만 가능합니다."/></section>),
    'profile': <Profile user={user} profile={profile} pending={authPending} error={profileError} notify={notify} onSaved={next=>setProfile(previous=>previous?{...previous,sessions:next}:null)}/>,
    'handover': (authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다." /></section>:page==='members'&&canManage&&user?<><PageHeading tag="MEMBER MANAGEMENT" title="부원 관리" description="부원 명단 조회와 운영 권한에 따른 부원 정보 수정"/><MemberManager key={rosterRevision} currentUid={user.uid} level={currentLevel!} notify={notify}/></>:page==='handover'&&canHandover?<Handover openView={()=>navigate('handover-view')} openWrite={()=>navigate('handover-write')} notify={notify}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="해당 메뉴에 접근할 수 있는 운영진 권한이 필요합니다." /></section>),
    'handover-view': authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canHandover?<HandoverNotesView onBack={()=>navigate('handover')}/>:<section className="container section-block"><EmptyState title="접근 권한이 없습니다" description="인수인계 접근 권한이 필요합니다."/></section>,
    'handover-write': authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다."/></section>:user&&canHandover?<HandoverNotesEditor onBack={()=>navigate('handover')}/>:<section className="container section-block"><EmptyState title="접근 권한이 없습니다" description="인수인계 접근 권한이 필요합니다."/></section>,
    'members': (authPending?<section className="container section-block"><EmptyState title="권한 확인 중" description="로그인 상태를 확인하고 있습니다." /></section>:page==='members'&&canManage&&user?<><PageHeading tag="MEMBER MANAGEMENT" title="부원 관리" description="부원 명단 조회와 운영 권한에 따른 부원 정보 수정"/><MemberManager key={rosterRevision} currentUid={user.uid} level={currentLevel!} notify={notify}/></>:page==='handover'&&canHandover?<Handover openView={()=>navigate('handover-view')} openWrite={()=>navigate('handover-write')} notify={notify}/>:<section className="container section-block"><EmptyState icon={<LockKeyhole size={26}/>} title="접근 권한이 없습니다" description="해당 메뉴에 접근할 수 있는 운영진 권한이 필요합니다." /></section>),
  };
  return <div className="site-root" data-async-busy={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting ? "true" : undefined}>
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
          aria-haspopup="menu" aria-expanded={accountOpen}><UserRound size={15}/>{profile?.name??'내 계정'}<ChevronDown size={13}/></button>{accountOpen&&<div className="more-menu account-menu"><button type="button" onClick={()=>navigate('profile')}>내 정보</button>{canManage&&<button type="button" onClick={()=>navigate('members')}>부원 관리</button>}{canHandover&&<button type="button" onClick={()=>navigate('handover')}>인수인계</button>}<button type="button" onClick={logout} disabled={rosterResetting}>로그아웃</button>{isDeveloperSuperadmin && <><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetRosterExceptMyself()}>명단 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetDonationFinance()}>후원 · 회계 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetAllNotices()}>공지사항 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetIntroduction()}>모여락 소개 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetAssets()}>에셋 초기화</button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetGallery()}>갤러리 초기화</button></>}</div>}</div>}
        <button type="button" className="mobile-menu-button" onClick={()=>setMenuOpen(!menuOpen)} aria-label={menuOpen?'메뉴 닫기':'메뉴 열기'} aria-expanded={menuOpen}>{menuOpen?<X size={22}/>:<Menu size={22}/>}</button>
      </div>
    </div>{menuOpen&&<nav className="mobile-nav" aria-label="모바일 메뉴"><div className="container">{navGroups.map(group=><div className="mobile-group" key={group.label}><button type="button" aria-expanded={openGroup===group.label} onClick={()=>setOpenGroup(openGroup===group.label?null:group.label)}><strong>{group.label}</strong><ChevronDown size={16}/></button>{openGroup===group.label&&<div className="mobile-submenu">{group.items.map(item=><button type="button" key={item.id} onClick={()=>navigate(item.id)}>{item.label}</button>)}</div>}</div>)}{user&&<><button type="button" onClick={()=>navigate('profile')}>내 정보<ArrowRight size={16}/></button>{canManage&&<button type="button" onClick={()=>navigate('members')}>부원 관리<ArrowRight size={16}/></button>}{canHandover&&<button type="button" onClick={()=>navigate('handover')}>인수인계<ArrowRight size={16}/></button>}<button type="button" onClick={logout} disabled={rosterResetting}>로그아웃<LogOut size={16}/></button>{isDeveloperSuperadmin && <><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetRosterExceptMyself()}>명단 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetDonationFinance()}>후원 · 회계 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetAllNotices()}>공지사항 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetIntroduction()}>모여락 소개 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetAssets()}>에셋 초기화<Trash2 size={15}/></button><button type="button" className="developer-reset-action" disabled={rosterResetting||financeResetting||noticeResetting||aboutResetting||assetResetting||galleryResetting} onClick={() => void resetGallery()}>갤러리 초기화<Trash2 size={15}/></button></>}</>}</div></nav>}
    </header>
    <main key={page}>
      <Routes>
        {routeDefinitions.map(route=><Route key={route.path} path={route.path} element={pageViews[route.page]}/>)}
        <Route path="*" element={<RouterRedirect to="/" replace/>}/>
      </Routes>
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
    {loginOpen&&<LoginDialog close={()=>setLoginOpen(false)} notify={message=>setLoginNotice(message??'')}/>}
    {aboutSaveNotice&&<TimedBottomToast message={aboutSaveNotice} onClose={()=>setAboutSaveNotice('')}/>}
    {loginNotice&&<TimedBottomToast message={loginNotice} onClose={()=>setLoginNotice('')}/>}
    {toast&&<div className="toast" role="status"><CircleHelp size={17}/><span>{toast}</span><button type="button" aria-label="알림 닫기" onClick={()=>setToast('')}><X size={15}/></button></div>}
  </div>;
}
export default App;
