import {failure,secureOrigin,success} from '../../_lib/shared.js';
import {callerForEquipment,listEquipment,renderItem} from '../../_lib/equipment.js';

export async function onRequestGet({request,env}){
 try{
  secureOrigin(request);
  const manager=new URL(request.url).searchParams.get('manage')==='1';
  const caller=await callerForEquipment(request,env,{manager});
  const items=(await listEquipment(env)).map(item=>renderItem(item,caller,manager));
  return success({items});
 }catch(error){return failure(error);}
}
