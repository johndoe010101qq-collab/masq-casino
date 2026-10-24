// Host selection is a presentation hint, never authenticated identity.
export function embeddedHost({embedded=false,referrer='',search=''}={}) {
  if(!embedded)return 'standalone';
  let origin='';try{origin=new URL(referrer).origin;}catch{}
  if(origin==='https://huevo.su')return 'huevo';
  if(origin==='https://spworlds.ru')return 'spworlds';
  // Referrer may be suppressed. hu_* still selects the disabled huEVO bridge,
  // but cannot grant a session, admin role, balance or payment capability.
  if(new URLSearchParams(search).has('hu_app_id'))return 'huevo';
  return 'unknown';
}
