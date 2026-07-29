const DB='PromptDirectorDB', VERSION=1, STORES=['workflows','characters','archive'];
let dbp;
export function db(){if(!dbp)dbp=new Promise((ok,no)=>{const r=indexedDB.open(DB,VERSION);r.onupgradeneeded=()=>STORES.forEach(s=>{if(!r.result.objectStoreNames.contains(s))r.result.createObjectStore(s,{keyPath:'id'})});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});return dbp}
async function store(name,mode='readonly'){return (await db()).transaction(name,mode).objectStore(name)}
export async function all(name){return new Promise(async(ok,no)=>{const r=(await store(name)).getAll();r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
export async function put(name,value){return new Promise(async(ok,no)=>{const r=(await store(name,'readwrite')).put(value);r.onsuccess=()=>ok(value);r.onerror=()=>no(r.error)})}
export async function del(name,id){return new Promise(async(ok,no)=>{const r=(await store(name,'readwrite')).delete(id);r.onsuccess=()=>ok();r.onerror=()=>no(r.error)})}
export async function get(name,id){return new Promise(async(ok,no)=>{const r=(await store(name)).get(id);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
export const uid=()=>crypto.randomUUID?.()||Date.now()+'-'+Math.random().toString(16).slice(2);
export async function clearStore(name){return new Promise(async(ok,no)=>{const r=(await store(name,'readwrite')).clear();r.onsuccess=()=>ok();r.onerror=()=>no(r.error)})}
