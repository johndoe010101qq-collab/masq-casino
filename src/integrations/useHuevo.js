import {useEffect,useState} from 'react';
import {HUEVO_EDITION} from '../huevo-edition.js';
import {loadHuevoSdk,createHuevoClient} from './huevo-sdk.js';
export default function useHuevo(){
  const [state,setState]=useState(()=>({status:HUEVO_EDITION&&window.parent!==window&&new URLSearchParams(location.search).has('hu_app_id')?'connecting':'standalone',initial:null}));
  useEffect(()=>{
    if(!HUEVO_EDITION||window.parent===window||!new URLSearchParams(location.search).has('hu_app_id'))return;
    let alive=true;setState({status:'connecting',initial:null});
    (async()=>{
      try{const sdk=await loadHuevoSdk();await sdk.init({origins:['https://huevo.su']});
        const initial=await createHuevoClient(null)('/login',{query:location.search});
        if(alive)setState({status:'ready',initial,sdk,request:createHuevoClient(initial.token),mode:initial.mode});
      }catch(error){if(alive)setState({status:'error',initial:null,error:error.message});}
    })();return()=>{alive=false;};
  },[]);return state;
}
