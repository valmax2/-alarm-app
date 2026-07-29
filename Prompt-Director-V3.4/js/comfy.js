export function base(c){return `${c.protocol}://${c.host}${c.port?':'+c.port:''}`}
export function headers(c){if(c.authType==='basic')return{Authorization:'Basic '+btoa(`${c.username}:${c.secret}`)};if(c.authType==='bearer')return{Authorization:'Bearer '+c.secret};return{}}
export async function test(c){const r=await fetch(base(c)+'/system_stats',{headers:headers(c)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}
export function validateWorkflow(j){if(!j||Array.isArray(j)||typeof j!=='object')return'Il file non contiene un oggetto JSON valido.';if(Array.isArray(j.nodes)||Array.isArray(j.links))return'Workflow non in formato API. In ComfyUI usa “Save (API Format)” / abilita Dev Mode e salva il formato API.';const vals=Object.values(j);if(!vals.length||!vals.every(n=>n&&typeof n==='object'&&typeof n.class_type==='string'&&n.inputs&&typeof n.inputs==='object'))return'Formato API non riconosciuto: ogni nodo deve avere class_type e inputs.';return''}

// Riconosce sia il formato API (oggetto piatto {id:{class_type,inputs}}) sia il formato normale
// esportato da ComfyUI con il tasto "Save" (oggetto con array nodes/links).
export function workflowFormat(j){if(!j||typeof j!=='object'||Array.isArray(j))return'invalid';if(Array.isArray(j.nodes))return'ui';const vals=Object.values(j);if(vals.length&&vals.every(n=>n&&typeof n==='object'&&typeof n.class_type==='string'&&n.inputs&&typeof n.inputs==='object'))return'api';return'invalid'}

export async function fetchObjectInfo(c){const r=await fetch(base(c)+'/object_info',{headers:headers(c)});if(!r.ok)throw new Error(`${r.status} ${r.statusText}`);return r.json()}

function widgetFields(info,linkedNames){if(!info?.input)return[];return[...Object.entries(info.input.required||{}),...Object.entries(info.input.optional||{})].filter(([name])=>!linkedNames.has(name)).map(([name,def])=>({name,extra:!!(Array.isArray(def)&&def[1]&&def[1].control_after_generate)}))}

// Converte un workflow "normale" (nodes/links, valori widget posizionali senza nome campo) nel
// formato API piatto {id:{class_type,inputs}} usato dal resto dell'app, così i nodi si mappano
// esattamente come quelli importati in formato API. Serve /object_info da un'istanza ComfyUI
// raggiungibile per conoscere il nome di ogni widget (l'export normale non lo include).
export function convertUiWorkflow(ui,objectInfo){
  const linkById=new Map((ui.links||[]).map(l=>[l[0],l]));
  const graph={},nodeTitles={},warn=[];
  for(const node of ui.nodes||[]){
    const id=String(node.id),classType=node.type,info=objectInfo?.[classType];
    if(node.title&&node.title!==classType)nodeTitles[id]=node.title;
    if(!info)warn.push(`Nodo ${id} (${classType}): tipo non trovato in ComfyUI — verifica che il custom node corrispondente sia installato.`);
    const inputs={},linkedNames=new Set();
    (node.inputs||[]).forEach(inp=>{linkedNames.add(inp.name);if(inp.link==null)return;const link=linkById.get(inp.link);if(!link){warn.push(`Nodo ${id} (${classType}): collegamento mancante per l'input "${inp.name}".`);return}inputs[inp.name]=[String(link[1]),link[2]]});
    const values=Array.isArray(node.widgets_values)?node.widgets_values:[];
    if(values.length){const fields=widgetFields(info,linkedNames);let vi=0;for(const f of fields){if(vi>=values.length)break;inputs[f.name]=values[vi];vi++;if(f.extra)vi++}if(!fields.length&&info)warn.push(`Nodo ${id} (${classType}): impossibile associare i valori dei widget al nodo.`)}
    if(node.mode===2||node.mode===4)warn.push(`Nodo ${id} (${classType}): è disattivato/bypassato nel workflow originale — viene comunque incluso ed eseguito normalmente. Disattivalo in ComfyUI se non deve girare.`);
    graph[id]={class_type:classType,inputs}
  }
  return{graph,warnings:warn,nodeTitles}
}
export async function uploadImage(c,blob,name){const f=new FormData();f.append('image',new File([blob],name,{type:blob.type||'image/png'}));f.append('overwrite','true');const r=await fetch(base(c)+'/upload/image',{method:'POST',headers:headers(c),body:f});if(!r.ok)throw new Error('Upload immagine: '+await r.text());return r.json()}
export async function queue(c,graph,clientId){const body=JSON.stringify({prompt:graph,client_id:clientId});const r=await fetch(base(c)+'/prompt',{method:'POST',headers:headers(c),body});if(!r.ok)throw new Error('Invio workflow: '+await r.text());return r.json()}
export async function wait(c,id,onTick,timeout=1200000){const start=Date.now();while(Date.now()-start<timeout){onTick?.(Date.now()-start);const r=await fetch(base(c)+'/history/'+encodeURIComponent(id),{headers:headers(c)});if(r.ok){const j=await r.json();if(j[id])return j[id]}await new Promise(x=>setTimeout(x,1500))}throw new Error('Timeout generazione superato.')}
export function outputs(history){const out=[];Object.values(history.outputs||{}).forEach(node=>['images','gifs','videos'].forEach(k=>(node[k]||[]).forEach(f=>out.push(f))));return out}
export async function fetchOutput(c,f){const q=new URLSearchParams({filename:f.filename,subfolder:f.subfolder||'',type:f.type||'output'});const r=await fetch(base(c)+'/view?'+q,{headers:headers(c)});if(!r.ok)throw new Error('Download risultato fallito');return r.blob()}
export const safeName=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]/g,'').slice(0,40)||'image';
