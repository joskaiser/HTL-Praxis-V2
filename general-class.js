// Class-wide editable matrix, using exactly the same per-student data as general7521.js.
'use strict';
function generalMatrixPreference(cid,gid){try{return localStorage.getItem('general-last-checklist:'+cid+':'+(gid||'class'))}catch(e){return null}}
function generalSaveMatrixPreference(cid,gid,id){try{localStorage.setItem('general-last-checklist:'+cid+':'+(gid||'class'),id)}catch(e){}}
function generalClassMatrix(cid, selected, gid=null){
 if(!selected)selected=generalMatrixPreference(cid,gid);
 const templates=generalTemplates(cid),t=templates.find(x=>x.id===selected)||templates[0];
 const pupils=(gid?groupStudents(cid,gid):classStudents(cid)).slice().sort((a,b)=>String(a.name).localeCompare(String(b.name),'de'));
 if(!t)return;
 generalSaveMatrixPreference(cid,gid,t.id);
 const e=generalEscape;
 openModal(`<div class="general-matrix"><h2>Allgemein / Checklisten · ${e(cls(cid)?.code||'Klasse')}${gid?' · '+e(cls(cid)?.groups.find(g=>g.id===gid)?.name||'Gruppe'):''}</h2><div class="general-matrix-tools"><label>Checkliste <select id="generalMatrixSelect">${templates.map(x=>`<option value="${e(x.id)}" ${x.id===t.id?'selected':''}>${e(x.name)}</option>`).join('')}</select></label><button class="btn secondary" id="generalMatrixEdit">Vorlage bearbeiten</button><button class="btn" id="generalMatrixNew">+ Checkliste</button></div><p class="small">Änderungen werden direkt in der Schülerakte gespeichert. Unterschriften werden einzeln erfasst.</p><div class="general-matrix-scroll"><table class="general-matrix-table"><thead><tr><th>Schüler:in</th>${t.items.map(i=>`<th>${e(i.label)}</th>`).join('')}</tr></thead><tbody>${pupils.map(s=>{const d=generalData(s.id,t.id);return `<tr><th><button class="general-matrix-name" data-general-person="${e(s.id)}">${e(s.name)}</button></th>${t.items.map(i=>{const v=d.values[i.id]??'',base=`data-general-student="${e(s.id)}" data-general-item="${e(i.id)}"`;if(i.type==='check')return `<td class="general-matrix-center"><input type="checkbox" ${base} ${v?'checked':''} aria-label="${e(s.name)}: ${e(i.label)}"></td>`;if(i.type==='signature')return `<td><button class="btn secondary" data-general-matrix-sign="${e(s.id)}" data-general-item="${e(i.id)}">${v?'✓ Unterschrieben':'Unterschreiben'}</button>${v?`<button class="btn danger" data-general-matrix-remove-sign="${e(s.id)}" data-general-item="${e(i.id)}" title="Unterschrift entfernen">Entfernen</button>`:''}</td>`;if(i.type==='date')return `<td><input type="date" ${base} value="${e(v)}" aria-label="${e(s.name)}: ${e(i.label)}"></td>`;return `<td><textarea rows="2" ${base} aria-label="${e(s.name)}: ${e(i.label)}">${e(v)}</textarea></td>`}).join('')}</tr>`}).join('')}</tbody></table></div></div>`);
 document.getElementById('generalMatrixSelect').onchange=ev=>generalClassMatrix(cid,ev.target.value,gid);
 const anchor=pupils[0]?.id;
 document.getElementById('generalMatrixEdit').onclick=()=>anchor?generalEdit(anchor,t.id):alert('Bitte zuerst einen Schüler anlegen.');
 document.getElementById('generalMatrixNew').onclick=()=>anchor?generalEdit(anchor,null):alert('Bitte zuerst einen Schüler anlegen.');
 document.querySelectorAll('[data-general-student]').forEach(el=>{
  const commit=()=>{const d=generalData(el.dataset.generalStudent,t.id);d.values[el.dataset.generalItem]=el.type==='checkbox'?el.checked:el.value;saveState()};
  el.addEventListener(el.type==='checkbox'?'change':'input',commit);
  if(el.type!=='checkbox')el.addEventListener('change',commit);
 });
 document.querySelectorAll('[data-general-matrix-sign]').forEach(el=>el.onclick=()=>{generalReturnMatrix={cid,gid,selected:t.id};generalSign(el.dataset.generalMatrixSign,t.id,el.dataset.generalItem)});
 document.querySelectorAll('[data-general-matrix-remove-sign]').forEach(el=>el.onclick=()=>{
  const sid=el.dataset.generalMatrixRemoveSign,field=el.dataset.generalItem,d=generalData(sid,t.id);
  if(!d.values[field])return;
  if(!confirm('Unterschrift von '+(student(sid)?.name||'diesem Schüler')+' wirklich entfernen?'))return;
  delete d.values[field];delete d.signedAt[field];saveState();generalClassMatrix(cid,t.id,gid);
 });
 document.querySelectorAll('[data-general-person]').forEach(el=>el.onclick=()=>{generalReturnMatrix={cid,gid,selected:t.id};generalOpen(el.dataset.generalPerson)});
}
const generalClassOriginalRender=renderClass;
renderClass=function(cid){generalClassOriginalRender(cid);const toolbar=view.querySelector('.view-header .toolbar');if(!toolbar)return;const b=document.createElement('button');b.className='btn secondary';b.textContent='Allgemein / Checklisten';b.onclick=()=>generalClassMatrix(cid);toolbar.append(b)};

const generalGroupOriginalRender=renderGroup;
renderGroup=function(cid,gid,unitId){generalGroupOriginalRender(cid,gid,unitId);const toolbar=view.querySelector('.view-header .toolbar');if(toolbar){const b=document.createElement('button');b.className='btn secondary';b.textContent='Allgemein / Checklisten';b.onclick=()=>generalClassMatrix(cid,null,gid);toolbar.append(b)}};
