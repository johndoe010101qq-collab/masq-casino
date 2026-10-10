// This is a local demo entry, never proof of an administrator's identity.
// Embedded access stays closed until an authoritative server session exists.
export function canOpenDemoAdmin({embedded=false,url=''}={}) {
  if(embedded)return false;
  try{return new URL(url).searchParams.get('demo-admin')==='1';}catch{return false;}
}
