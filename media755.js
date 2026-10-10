'use strict';
// 7.5.5: Dateiverwaltung ueber die App. Keine Zugangsdaten in Dateien speichern.
const mediaState=()=>{state.library ||= [];state.unitLinks ||= {};state.studentFiles ||= {};return state};
const mediaText=s=>escapeHtml(String(s??''));
const mediaPart=s=>safeFolder(s).replace(/\s+/g,'_');
const mediaYear=()=>currentYear()?.label||'Schuljahr';
function mediaUnitPath(u){const c=cls(u.classId);return ['Schuljahre',mediaYear(),c.code,'Unterrichtseinheiten',`${u.date}_${u.id.slice(-6)}`]}
function mediaStudentPath(s){const c=cls(s.classId),g=c.groups.find(x=>x.id===s.groupId);return ['Schuljahre',mediaYear(),c.code,'Gruppen',g?.name||'Ohne Gruppe',`${mediaPart(s.name)}_${s.id.slice(-6)}`,'Unterlagen']}
// Microsoft Graph Upload Session: chunks must be multiples of 320 KiB (except last).
const MEDIA_MAX_BYTES=250*1024*1024;
async function mediaPutDriveFile(token,folderId,filename,file){
 if(file.size>MEDIA_MAX_BYTES)throw Error('Maximal 250 MB je Datei.');
 const base=`https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(folderId)}:/${encodeURIComponent(filename)}:`;
 if(file.size<=4*1024*1024){
  const r=await fetch(base+'/content',{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':file.type||'application/octet-stream'},body:file});
  if(!r.ok)throw Error(`OneDrive-Upload fehlgeschlagen (${r.status}): ${await r.text()}`);
  return r.json();
 }
 const create=await fetch(base+'/createUploadSession',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'rename',name:filename}})});
 if(!create.ok)throw Error(`Upload-Sitzung fehlgeschlagen (${create.status}): ${await create.text()}`);
 const session=await create.json();if(!session.uploadUrl)throw Error('Keine Upload-URL erhalten.');
 const chunkSize=5*1024*1024;let pos=0,result=null;
 try{
  while(pos<file.size){
   const end=Math.min(pos+chunkSize,file.size),part=file.slice(pos,end);
   let r=null;
   for(let attempt=0;attempt<3;attempt++){
    try{r=await fetch(session.uploadUrl,{method:'PUT',headers:{'Content-Length':String(end-pos),'Content-Range':`bytes ${pos}-${end-1}/${file.size}`},body:part});}
    catch(e){if(attempt===2)throw e;await new Promise(ok=>setTimeout(ok,800*(attempt+1)));continue;}
    if([429,500,502,503,504].includes(r.status)&&attempt<2){await new Promise(ok=>setTimeout(ok,1000*(attempt+1)));continue;}break;
   }
   if(!r||![200,201,202].includes(r.status))throw Error(`Datei-Upload unterbrochen (${r?.status||'Netzwerk'}). Bitte erneut versuchen.`);
   result=await r.json();pos=end;
  }
  if(!result?.id)throw Error('Upload nicht abgeschlossen: OneDrive hat keine Datei-ID geliefert.');
  return result;
 }catch(e){try{await fetch(session.uploadUrl,{method:'DELETE'})}catch(_){}throw e;}
}
async function mediaUpload(file,parts){
 if(!file)throw Error('Bitte Datei auswählen.');
 if(!(/\.pdf$/i.test(file.name)||/^image\//.test(file.type)))throw Error('Erlaubt sind PDF-Dateien und Bilder.');
 const token=await getGraphToken(true),folder=await ensurePath(token,parts);
 const filename=`${uid('f')}_${mediaPart(file.name)}`;
 const item=await mediaPutDriveFile(token,folder.id,filename,file);mediaState();
 const entry={id:uid('lib'),name:file.name,driveId:item.id,mime:file.type||'application/octet-stream',size:file.size,notes:'',createdAt:new Date().toISOString(),folderPath:parts.join('/')};
 state.library.push(entry);saveState();return entry;
}
async function mediaChildren(token,id){let url=`/me/drive/items/${id}/children?$top=200&$select=id,name,size,file,folder,webUrl`;const out=[];while(url){const result=await graph(token,url.startsWith('https://graph.microsoft.com/v1.0')?url.replace('https://graph.microsoft.com/v1.0',''):url);out.push(...(result.value||[]));url=result['@odata.nextLink']||''}return out}
async function mediaImportFolder(parts,deep=false){
 const token=await getGraphToken(true),folder=await ensurePath(token,parts);let added=0;
 async function scan(id,path,level){for(const item of await mediaChildren(token,id)){
  if(item.folder){if(deep&&level<3)await scan(item.id,[...path,item.name],level+1);continue}
  if(!item.file||!(/\.pdf$/i.test(item.name)||/\.(png|jpg|jpeg|webp|gif|heic)$/i.test(item.name)))continue;
  if(state.library.some(x=>x.driveId===item.id))continue;
  state.library.push({id:uid('lib'),name:item.name,driveId:item.id,mime:item.file.mimeType||'',size:item.size||0,notes:'',createdAt:new Date().toISOString(),folderPath:path.join('/')});added++;
 }}
 mediaState();await scan(folder.id,parts,0);if(added)saveState();return added;
}
function mediaAttachUnit(u,docId,pages='',notes=''){mediaState();state.unitLinks[u.id] ||= [];if(!state.unitLinks[u.id].some(l=>l.docId===docId&&l.pages===pages))state.unitLinks[u.id].push({docId,pages,notes});saveState()}
function mediaAttachStudent(s,docId,unitId='',notes=''){mediaState();state.studentFiles[s.id] ||= [];state.studentFiles[s.id].push({id:uid('link'),docId,unitId,notes,at:new Date().toISOString()});saveState()}
function mediaPicker(label,handler){const input=document.createElement('input');input.type='file';input.accept='.pdf,image/*';input.style.display='none';document.body.append(input);input.onchange=async()=>{try{await handler(input.files[0])}catch(e){alert(e.message)}finally{input.remove()}};input.click()}
function mediaUnitDialog(cid,unitId){mediaState();const u=state.units.find(x=>x.id===unitId);if(!u)return;const links=state.unitLinks[u.id]||[];
 openModal(`<h2>Materialien · ${mediaText(fmtDate(u.date))}</h2><p>${mediaText(u.topic)}</p><div class="section-card">${links.map((l,i)=>{const d=state.library.find(x=>x.id===l.docId);return `<div class="schedule-block"><div><b>${mediaText(d?.name||'Datei nicht gefunden')}</b><div class="small">${mediaText(l.pages||'Gesamte Datei')} · ${mediaText(l.notes||'')}</div></div><div class="toolbar"><button class="btn secondary" data-open-m="${i}">Öffnen</button><button class="btn secondary" data-del-m="${i}">Lösen</button></div></div>`}).join('')||'Noch keine Dateien zugeordnet.'}</div><div class="field"><label>Vorhandene Datei auswählen</label><select id="m755doc"><option value="">Bitte auswählen</option>${state.library.map(d=>`<option value="${mediaText(d.id)}">${mediaText(d.name)}</option>`).join('')}</select></div><div class="field"><label>Skriptseiten (optional)</label><input id="m755pages" placeholder="7-9"></div><div class="field"><label>Notiz / Skizzenbeschreibung</label><textarea id="m755notes"></textarea></div><div class="modal-actions"><button class="btn secondary" id="m755import">OneDrive-Dateien einlesen</button><button class="btn secondary" id="m755upload">+ Foto / PDF</button><button class="btn" id="m755attach">Zuordnen</button></div>`);
 document.getElementById('m755attach').onclick=()=>{const id=document.getElementById('m755doc').value;if(!id)return alert('Bitte Datei auswählen oder hochladen.');mediaAttachUnit(u,id,document.getElementById('m755pages').value,document.getElementById('m755notes').value);mediaUnitDialog(cid,u.id)};
 document.getElementById('m755upload').onclick=()=>mediaPicker('Datei',async file=>{const d=await mediaUpload(file,mediaUnitPath(u));mediaAttachUnit(u,d.id);mediaUnitDialog(cid,u.id)});
 document.getElementById('m755import').onclick=async()=>{try{const count=await mediaImportFolder(mediaUnitPath(u),true);const shared=await mediaImportFolder(['Skriptothek'],true);alert(`${count+shared} neue Dateien eingelesen.`);mediaUnitDialog(cid,u.id)}catch(e){alert(e.message)}};
 modal.querySelectorAll('[data-open-m]').forEach(b=>b.onclick=()=>{const d=state.library.find(x=>x.id===links[+b.dataset.openM].docId);if(d)openLibraryFile(d)});
 modal.querySelectorAll('[data-del-m]').forEach(b=>b.onclick=()=>{links.splice(+b.dataset.delM,1);saveState();mediaUnitDialog(cid,u.id)});
}
function mediaStudentDialog(sid){mediaState();const s=student(sid);if(!s)return;const files=state.studentFiles[s.id]||[];const units=classUnits(s.classId);
 openModal(`<h2>Schülerunterlagen · ${mediaText(s.name)}</h2><div class="section-card">${files.map((l,i)=>{const d=state.library.find(x=>x.id===l.docId);const u=state.units.find(x=>x.id===l.unitId);return `<div class="schedule-block"><div><b>${mediaText(d?.name||'Datei fehlt')}</b><div class="small">${mediaText(u?.topic||'Allgemein')} · ${mediaText(l.notes)}</div></div><div class="toolbar"><button class="btn secondary" data-open-s="${i}">Öffnen</button><button class="btn secondary" data-del-s="${i}">Lösen</button></div></div>`}).join('')||'Noch keine Schülerunterlagen.'}</div><div class="field"><label>Unterrichtseinheit (optional)</label><select id="m755unit"><option value="">Allgemein</option>${units.map(u=>`<option value="${u.id}">${mediaText(fmtDate(u.date)+' '+u.topic)}</option>`).join('')}</select></div><div class="field"><label>Notiz</label><textarea id="m755snote"></textarea></div><div class="field"><label>Vorhandene Datei</label><select id="m755sdoc"><option value="">Datei auswählen</option>${state.library.map(d=>`<option value="${d.id}">${mediaText(d.name)}</option>`).join('')}</select></div><div class="modal-actions"><button class="btn secondary" id="m755simport">OneDrive einlesen</button><button class="btn secondary" id="m755supload">+ Foto / PDF</button><button class="btn" id="m755sattach">Zuordnen</button></div>`);
 const fields=()=>({unitId:document.getElementById('m755unit').value,notes:document.getElementById('m755snote').value});
 document.getElementById('m755sattach').onclick=()=>{const id=document.getElementById('m755sdoc').value;if(!id)return alert('Datei auswählen.');const v=fields();mediaAttachStudent(s,id,v.unitId,v.notes);mediaStudentDialog(s.id)};
 document.getElementById('m755supload').onclick=()=>{const v=fields();mediaPicker('Datei',async file=>{const d=await mediaUpload(file,mediaStudentPath(s));mediaAttachStudent(s,d.id,v.unitId,v.notes);mediaStudentDialog(s.id)})};
 document.getElementById('m755simport').onclick=async()=>{try{const n=await mediaImportFolder(mediaStudentPath(s),true);alert(`${n} Dateien eingelesen.`);mediaStudentDialog(s.id)}catch(e){alert(e.message)}};
 modal.querySelectorAll('[data-open-s]').forEach(b=>b.onclick=()=>{const d=state.library.find(x=>x.id===files[+b.dataset.openS].docId);if(d)openLibraryFile(d)});
 modal.querySelectorAll('[data-del-s]').forEach(b=>b.onclick=()=>{files.splice(+b.dataset.delS,1);saveState();mediaStudentDialog(s.id)});
}
function mediaMoveStudent(sid){const s=student(sid);if(!s)return;const choices=state.classes.filter(c=>c.yearId===state.activeYear);openModal(`<h2>Schüler verschieben</h2><p>${mediaText(s.name)}</p><div class="field"><label>Zielklasse</label><select id="m755class">${choices.map(c=>`<option value="${c.id}" ${c.id===s.classId?'selected':''}>${mediaText(c.code)}</option>`).join('')}</select></div><div class="field"><label>Zielgruppe</label><select id="m755group"></select></div><p class="small">Die vorhandenen Bewertungen bleiben den bisherigen Unterrichtseinheiten zugeordnet. OneDrive-Dateien werden nicht gelöscht oder verschoben; ihre Verknüpfungen bleiben erhalten.</p><div class="modal-actions"><button class="btn" id="m755move">Verschieben</button></div>`);const a=document.getElementById('m755class'),b=document.getElementById('m755group');const refresh=()=>{const c=cls(a.value);b.innerHTML=c.groups.map(g=>`<option value="${g.id}">${mediaText(g.name)}</option>`).join('');if(c.id===s.classId)b.value=s.groupId};a.onchange=refresh;refresh();document.getElementById('m755move').onclick=()=>{if(!b.value)return alert('Zielgruppe auswählen.');if(!confirm(`Schüler ${s.name} wirklich verschieben?`))return;s.classId=a.value;s.groupId=b.value;saveState();closeModal();route={type:'student',studentId:s.id};render()}}
const mediaBaseRender=render;
render=function(){mediaBaseRender();mediaState();const head=view.querySelector('.view-header .toolbar');if(!head)return;
 if(route.type==='class'){const master=document.createElement('button');master.className='btn secondary';master.textContent='Stammdaten';master.onclick=()=>mediaEditClass(route.classId);head.append(master)}
 if(route.type==='class'||route.type==='group'){const c=cls(route.classId);const u=state.units.find(x=>x.id===route.unitId)||currentUnit(c.id);if(u){const b=document.createElement('button');b.className='btn secondary';b.textContent='Materialien / Fotos';b.onclick=()=>mediaUnitDialog(c.id,u.id);head.append(b)}}
 if(route.type==='student'){const s=student(route.studentId);if(!s)return;const docs=document.createElement('button');docs.className='btn secondary';docs.textContent='Schülerunterlagen';docs.onclick=()=>mediaStudentDialog(s.id);head.append(docs);const move=document.createElement('button');move.className='btn secondary';move.textContent='Schüler verschieben';move.onclick=()=>mediaMoveStudent(s.id);head.append(move)}
 if(route.type==='dashboard'){const master=document.createElement('button');master.className='btn secondary';master.textContent='Stammdaten';master.onclick=mediaMasterData;head.append(master);const b=document.createElement('button');b.className='btn secondary';b.textContent='OneDrive-Dateien einlesen';b.onclick=async()=>{try{const n=await mediaImportFolder(['Skriptothek'],true);alert(`${n} neue Skripte/Bilder eingelesen.`);renderLibrary()}catch(e){alert(e.message)}};head.append(b)}
};

// Zentrale Stammdatenpflege. IDs bleiben bei Umbenennungen unveraendert.
function mediaMasterData(){
 mediaState();const classes=state.classes.filter(c=>c.yearId===state.activeYear);
 openModal(`<h2>Stammdaten · ${mediaText(currentYear()?.label||'')}</h2><p>Klassen, Gruppen, Unterrichtsstoff und Schueler zentral pflegen. Bestehende IDs und Bewertungen bleiben erhalten.</p><div class="section-card">${classes.map(c=>`<div class="schedule-block"><div><b>${mediaText(c.code)}</b><div class="small">${c.groups.length} Gruppen · ${classStudents(c.id).length} Schueler · ${classUnits(c.id).length} Einheiten</div></div><div class="toolbar"><button class="btn secondary" data-md-edit="${mediaText(c.id)}">Klasse / Gruppen</button><button class="btn secondary" data-md-stoff="${mediaText(c.id)}">Unterrichtsstoff</button><button class="btn secondary" data-md-open="${mediaText(c.id)}">Klasse oeffnen</button></div></div>`).join('')}</div><div class="modal-actions"><button class="btn secondary" id="mdAddClass">+ Klasse</button><button class="btn secondary" id="mdLibrary">Skriptothek</button><button class="btn" id="mdClose">Schliessen</button></div>`);
 modal.querySelectorAll('[data-md-edit]').forEach(b=>b.onclick=()=>mediaEditClass(b.dataset.mdEdit));
 modal.querySelectorAll('[data-md-stoff]').forEach(b=>b.onclick=()=>{const id=b.dataset.mdStoff;closeModal();route={type:'curriculum',classId:id};render()});
 modal.querySelectorAll('[data-md-open]').forEach(b=>b.onclick=()=>{const id=b.dataset.mdOpen;closeModal();route={type:'class',classId:id};render()});
 document.getElementById('mdAddClass').onclick=addClassDialog;
 document.getElementById('mdLibrary').onclick=()=>{closeModal();renderLibrary()};
 document.getElementById('mdClose').onclick=closeModal;
}
function mediaEditClass(cid){const c=cls(cid);if(!c)return;
 openModal(`<h2>Stammdaten · ${mediaText(c.code)}</h2><div class="field"><label>Klassenbezeichnung</label><input id="mdClassName" value="${mediaText(c.code)}"></div><h3>Gruppen</h3>${c.groups.map(g=>`<div class="field"><label>Gruppe</label><input data-md-group="${mediaText(g.id)}" value="${mediaText(g.name)}"></div>`).join('')}<div class="notice">Namen koennen geaendert werden. Die interne Zuordnung der Schueler bleibt bestehen. Vorhandene OneDrive-Ordner werden nicht automatisch umbenannt.</div><div class="modal-actions"><button class="btn secondary" id="mdBack">Zurueck</button><button class="btn secondary" id="mdNewGroup">+ Gruppe</button><button class="btn" id="mdSave">Speichern</button></div>`);
 document.getElementById('mdBack').onclick=mediaMasterData;
 document.getElementById('mdNewGroup').onclick=()=>addGroupDialog(cid);
 document.getElementById('mdSave').onclick=()=>{const name=document.getElementById('mdClassName').value.trim();if(!name)return alert('Klassenbezeichnung erforderlich.');if(state.classes.some(x=>x.id!==cid&&x.yearId===c.yearId&&x.code===name))return alert('Klassenbezeichnung bereits vorhanden.');const entries=[...modal.querySelectorAll('[data-md-group]')].map(x=>({id:x.dataset.mdGroup,name:x.value.trim()}));if(entries.some(x=>!x.name)||new Set(entries.map(x=>x.name)).size!==entries.length)return alert('Gruppennamen muessen eindeutig und ausgefuellt sein.');c.code=name;c.label=name;entries.forEach(x=>{const g=c.groups.find(g=>g.id===x.id);if(g)g.name=x.name});saveState();render();mediaMasterData()};
}
