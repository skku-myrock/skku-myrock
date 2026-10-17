import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=await readFile(new URL('../src/toastBus.ts',import.meta.url),'utf8');
const match=source.match(/export function classifyToast\(message:string\):ToastTone\{([\s\S]*?)\n\}/);
assert.ok(match,'Toast classifier source must be available');
const classify=new Function('message',match[1]);

test('global toast tones distinguish real completion, validation warnings and operational errors',()=>{
 const messages=[
  ['로그인되었습니다. 내 정보에서 세션을 확인할 수 있습니다.','success'],
  ['로그아웃되었습니다.','success'],
  ['저장을 완료했습니다.','success'],
  ['인수인계 내용을 저장했습니다.','success'],
  ['CSV 8건을 추가했습니다.','success'],
  ['존재하지 않는 학번입니다.','warning'],
  ['CSV 헤더는 후원일,후원자명,학번,후원금액,익명여부 순서여야 합니다.','warning'],
  ['CSV 파일은 200KB 이하여야 합니다.','warning'],
  ['선택한 사진은 로컬 미리보기입니다. 변경 사항 저장 시 업로드됩니다.','warning'],
  ['등록 결과: 신규 8명, 기존 계정 2명, 실패 0명.','success'],
  ['등록 결과: 신규 8명, 기존 계정 2명, 실패 1명.','warning'],
  ['로그아웃하지 못했습니다. 잠시 후 다시 시도해 주세요.','error'],
  ['거래 내역 조회 실패','error'],
  ['CSV 등록 중 3건 완료 후 중단되었습니다.','error'],
  ['변경 사항을 저장했지만 이전 이미지 정리가 지연되었습니다.','warning'],
 ];
 for(const [message,tone] of messages)assert.equal(classify(message),tone,message);
});
