import {failure,reject,secureOrigin,success,FIRESTORE_ROOT,memberView} from '../../_lib/shared.js';
import {assertAccess,googleRequest} from '../../_lib/google.js';

// Prefix lookup on indexed profile fields; only part leaders and above may search.
export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  await assertAccess(request,env,'part_leader');
  const q=new URL(request.url).searchParams.get('q')?.trim()??'';
  if(q.length<1||q.length>40)reject('검색어를 1~40자로 입력해 주세요.');
  const field=/^\d+$/.test(q)?'studentId':'name';
  const result=await googleRequest(env,FIRESTORE_ROOT+':runQuery',{
   method:'POST',body:{structuredQuery:{
    from:[{collectionId:'users'}],
    where:{compositeFilter:{op:'AND',filters:[
     {fieldFilter:{field:{fieldPath:field},op:'GREATER_THAN_OR_EQUAL',value:{stringValue:q}}},
     {fieldFilter:{field:{fieldPath:field},op:'LESS_THAN',value:{stringValue:q+'\uf8ff'}}},
    ]}},
    orderBy:[{field:{fieldPath:field},direction:'ASCENDING'}],
    limit:20,
   }}
  });
  if(!result.ok)throw new Error('부원 검색에 실패했습니다.');
  const members=(Array.isArray(result.data)?result.data:[])
   .map(row=>row.document).filter(Boolean).map(memberView)
   .filter(member=>member.name&&/^\d{10}$/.test(member.studentId))
   .map(({uid,name,studentId})=>({uid,name,studentId}));
  return success({members});
 }catch(error){return failure(error);}
}
