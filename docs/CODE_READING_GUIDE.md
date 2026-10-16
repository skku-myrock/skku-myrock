# MYROCK 코드 읽기 가이드

## 1. 시작점부터 읽기

1. **`package.json`** — 사용 기술, 실행·테스트 명령을 확인합니다.
2. **`index.html` → `src/main.tsx`** — `#root`에 React를 마운트하고 React Router 및 전역 CSS를 설정합니다.
3. **`src/App.tsx`** — 로그인 상태, 권한, 공통 UI와 `pageViews`(페이지별 컴포넌트 연결)를 살펴봅니다.
4. **`src/app/siteNavigation.ts`** — URL ↔ 페이지 이름 매핑과 메뉴 구성을 확인합니다.

## 2. 기능 하나를 끝까지 따라가기

5. **화면:** 간단한 페이지는 `src/pages/SitePages.tsx`, 복잡한 기능은 `src/ScheduleRoom.tsx`, `src/EquipmentManager.tsx`, `src/HandoverNotes.tsx` 등에서 찾습니다.
6. **프런트엔드 API:** `src/scheduleApi.ts`, `src/equipmentApi.ts`, `src/handoverNotesApi.ts` 등에서 서버 요청을 확인합니다.
7. **서버 API:** `functions/api/**`에서 HTTP 요청과 권한 검사를 확인합니다. 파일 경로가 `/api/...` URL에 대응합니다.
8. **서버 공통 로직:** `functions/_lib/google.js`(인증·Google API), `shared.js`(공통 검사·응답), 각 기능별 라이브러리에서 실제 처리를 추적합니다.
9. **데이터와 스타일:** `src/firebase.ts`, `firestore.rules`, `src/styles.css` 및 `src/styles/`를 살펴봅니다. 중요한 데이터 쓰기는 서버에서 처리됩니다.
10. **테스트:** 해당 기능의 `tests/*.test.mjs`를 읽어 의도한 동작과 예외 처리를 확인합니다.

## 3. 예시: 인수인계 확인하기

`/handover/view` → `siteNavigation.ts` → `App.tsx` → `HandoverNotes.tsx` → `handoverNotesApi.ts` → `functions/api/handover-notes/archive.js` → `functions/_lib/handoverNotes.js` → Firestore

이 흐름을 따라가며 **누가 호출할 수 있는지, 어떤 데이터를 읽는지, 어떤 형태로 화면에 전달하는지**를 확인해 보세요.

## 4. 로컬 실행·검증

```bash
npm install
npm run dev          # 개발 서버
npm run build        # TypeScript 검사 + Vite 빌드
npm run check:api    # API 및 동작 테스트
npm run check:pages  # Cloudflare Pages Functions 컴파일
```

> 프런트엔드에서 버튼을 감추는 것만으로 권한이 보장되지는 않습니다. 권한 관련 변경은 `functions/api/`의 **서버 검증**도 확인하세요.
