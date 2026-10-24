import {handleHuevoRequest} from '../../../server/huevo-handler.mjs';
export const onRequest=({request,env})=>handleHuevoRequest(request,env);
