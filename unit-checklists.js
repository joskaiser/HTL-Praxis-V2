// Checklists associated with individual teaching units (existing class templates and evidence are reused).
'use strict';
function unitChecklistDialog(cid,gid,unitId){
 const u=state.units.find(x=>x.id===unitId&&x.classId===cid&&x.groupId===gid);
 if(!u)return;
 const templates=generalTemplates(cid);
 u.checklistIds=Array.isArray(u.checklistIds)?u.checklistIds:[];
 const selected=u.checklistIds.filter(id=>templates.some(t=>t.id===id));
 openModal(`<h2>Checklisten · ${escapeHtml(u.topic||'Einheit')} · ${fmtDate(u.date)}</h2><p class="small">Hier legst du fest, welche Checklisten in dieser Unterrichtseinheit verwendet werden. Die Einträge bleiben mit der Schülerakte verknüpft.</p><div class="field"><label>Vorhandene Checkliste hinzufügen</label><select id="ucPick"><option value="">Bitte auswählen</option>${templates.filter(t=>!selected.includes(t.id)).map(t=>`<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}</option>`).join('')}</select><button class="btn" id="ucAdd">Hinzufügen</button></div><div class="section-card">${selected.length?selected.map(id=>{const t=templates.find(x=>x.id===id);return `<div class="general-template-row"><b>${escapeHtml(t.name)}</b><label style="margin:0 10px">Gewichtung <input type="number" min="0" max="100" step="1" style="width:76px" data-uc-weight="${escapeHtml(id)}" value="${Number(u.checklistWeights?.[id]??20)}"> %</label><div><button class="btn secondary" data-uc-points="${escapeHtml(id)}">Punkte festlegen</button> <button class="btn secondary" data-uc-open="${escapeHtml(id)}">Tabelle öffnen</button> <button class="btn secondary" data-uc-unlink="${escapeHtml(id)}">Aus Einheit entfernen</button> <button class="btn danger" data-uc-delete="${escapeHtml(id)}">Checkliste löschen</button></div></div>`}).join(''):'Noch keine Checkliste zugewiesen.'}</div><div class="modal-actions"><button class="btn secondary" id="ucNew">+ Neue Checkliste</button></div>`);
 document.getElementById('ucAdd').onclick=()=>{const id=document.getElementById('ucPick').value;if(!id)return;u.checklistIds.push(id);u.checklistWeights ||= {};u.checklistWeights[id] ??= 20;saveState();unitChecklistDialog(cid,gid,unitId)};
 document.querySelectorAll('[data-uc-weight]').forEach(el=>el.onchange=()=>{const v=Number(el.value);if(!Number.isFinite(v)||v<0||v>100){alert('Gewichtung muss zwischen 0 und 100 liegen.');return}u.checklistWeights ||= {};u.checklistWeights[el.dataset.ucWeight]=v;saveState();renderGroup(cid,gid,unitId)});
 document.querySelectorAll('[data-uc-points]').forEach(el=>el.onclick=()=>unitChecklistPointEditor(cid,el.dataset.ucPoints,()=>unitChecklistDialog(cid,gid,unitId)));
 document.querySelectorAll('[data-uc-open]').forEach(b=>b.onclick=()=>generalClassMatrix(cid,b.dataset.ucOpen,gid));
 document.querySelectorAll('[data-uc-unlink]').forEach(b=>b.onclick=()=>{u.checklistIds=u.checklistIds.filter(id=>id!==b.dataset.ucUnlink);saveState();unitChecklistDialog(cid,gid,unitId)});
 document.querySelectorAll('[data-uc-delete]').forEach(b=>b.onclick=()=>{const id=b.dataset.ucDelete,t=templates.find(x=>x.id===id);if(!t||!confirm('Checkliste „'+t.name+'“ für die gesamte Klasse löschen? Bereits erfasste Nachweise bleiben gespeichert.'))return;templates.splice(templates.indexOf(t),1);state.units.forEach(unit=>{if(Array.isArray(unit.checklistIds))unit.checklistIds=unit.checklistIds.filter(x=>x!==id)});saveState();unitChecklistDialog(cid,gid,unitId)});
 document.getElementById('ucNew').onclick=()=>{const name=prompt('Name der neuen Checkliste:');if(!name?.trim())return;const t={id:uid('checklist'),name:name.trim(),items:[]};templates.push(t);u.checklistIds.push(t.id);u.checklistWeights ||= {};u.checklistWeights[t.id]=20;saveState();const first=groupStudents(cid,gid)[0]||classStudents(cid)[0];if(first)generalEdit(first.id,t.id);else unitChecklistDialog(cid,gid,unitId)};
}
const originalUnitChecklistRenderGroup=renderGroup;
renderGroup=function(cid,gid,unitId){originalUnitChecklistRenderGroup(cid,gid,unitId);const u=state.units.find(x=>x.id===unitId&&x.groupId===gid&&x.classId===cid);if(!u)return;const toolbar=view.querySelector('.view-header .toolbar');if(!toolbar)return;const b=document.createElement('button');b.className='btn secondary';b.textContent='Checkliste der Einheit zuweisen';b.onclick=()=>unitChecklistDialog(cid,gid,u.id);toolbar.append(b)};

// Individuelle Maximalpunkte für jeden bewertbaren Kontrollpunkt.
// Nicht bewertbare Felder (Datum, Text, Unterschrift) bleiben Nachweise.
function unitChecklistPointEditor(cid,tid,back){
 const t=generalTemplates(cid).find(x=>x.id===tid);if(!t)return;
 openModal(`<h2>Punkte je Checklistenpunkt · ${escapeHtml(t.name)}</h2><p>Nur Checkboxen werden automatisch bewertet. Erfüllte Punkte / mögliche Punkte × 10.</p>${t.items.filter(i=>i.type==='check').map(i=>`<div class="field"><label>${escapeHtml(i.label)} · Maximalpunkte</label><input type="number" min="0" step="0.5" data-uc-points="${escapeHtml(i.id)}" value="${Number(i.points??1)}"></div>`).join('')||'<p>Keine bewertbaren Checkboxen vorhanden.</p>'}<div class="modal-actions"><button class="btn" id="ucPointsSave">Speichern</button></div>`);
 document.getElementById('ucPointsSave').onclick=()=>{const edits=[...document.querySelectorAll('[data-uc-points]')];if(edits.some(el=>!Number.isFinite(Number(el.value))||Number(el.value)<0||el.value===''))return alert('Bitte gültige nichtnegative Punkte eingeben.');edits.forEach(el=>{const i=t.items.find(i=>i.id===el.dataset.ucPoints);if(i)i.points=Number(el.value)});saveState();back()};
}
// Auswertung: ohne ausgefüllte Checkboxen noch keine Bewertung.
function unitChecklistScore(sid,u,tid){
 const t=generalTemplates(u.classId).find(x=>x.id===tid);if(!t)return null;
 const fields=t.items.filter(i=>i.type==='check'&&Number(i.points??1)>0);
 if(!fields.length)return null;
 const data=student(sid)?.generalForms?.[tid]?.values||{};
 if(!fields.some(i=>Object.prototype.hasOwnProperty.call(data,i.id)))return null;
 const total=fields.reduce((n,i)=>n+Number(i.points??1),0);
 const earned=fields.reduce((n,i)=>n+(data[i.id]?Number(i.points??1):0),0);
 return total>0?Math.round(earned/total*1000)/100:null;
}
// Der gewichtete Grunddurchschnitt bleibt erhalten; Checklistengewichte
// sind Prozentanteile an der Einheit. Nur bewertete Checklisten zählen.
const unitChecklistBaseScoreDetail=scoreDetail;
scoreDetail=function(r,weights){
 const base=unitChecklistBaseScoreDetail(r,weights);
 if(!r||r.absent)return base;
 const u=state.units.find(x=>x.id===r._unitId);
 if(!u||!Array.isArray(u.checklistIds)||!u.checklistIds.length)return base;
 const entries=u.checklistIds.map(id=>({id,score:unitChecklistScore(r._studentId,u,id),weight:Math.max(0,Number(u.checklistWeights?.[id]??20)||0)})).filter(x=>x.score!==null&&x.weight>0);
 if(!entries.length)return base;
 const total=entries.reduce((n,x)=>n+x.weight,0);
 const fraction=Math.min(100,total)/total;
 const weighted=entries.reduce((n,x)=>n+x.score*x.weight,0)/total;
 const original=base?.average;
 // Ohne normale Bewertung wird die Checkliste allein bewertet.
 const avg=original===null||original===undefined?weighted:original*(1-Math.min(100,total)/100)+weighted*Math.min(100,total)/100;
 const denominator=base?.weightSum||100;
 return {...(base||{points:0,bonus:0,count:0}),average:Math.min(10,avg),weightedPoints:Math.min(10,avg)*denominator,weightSum:denominator,count:(base?.count||0)+entries.length};
};
// Bewertungsfelder direkt in der Einheitsübersicht ergänzen.
const unitChecklistRenderWithScores=renderGroup;
renderGroup=function(cid,gid,unitId){
 unitChecklistRenderWithScores(cid,gid,unitId);
 const u=state.units.find(x=>x.id===(unitId||document.getElementById('unitSelect')?.value));
 if(!u)return;
 const ids=(u.checklistIds||[]).filter(id=>generalTemplates(cid).some(t=>t.id===id));
 const table=view.querySelector('.assessment-scroll table');
 if(!table||!ids.length)return;
 const head=table.querySelector('thead tr');
 const rows=[...table.querySelectorAll('tbody tr')];
 const pupils=groupStudents(cid,gid);
 ids.forEach(id=>{
  const t=generalTemplates(cid).find(x=>x.id===id);
  const th=document.createElement('th');th.textContent=t.name+' ('+Number(u.checklistWeights?.[id]??20)+' %)';head.append(th);
  rows.forEach((row,n)=>{
   const sid=row.querySelector('[data-student]')?.dataset.student||pupils[n]?.id;
   const td=document.createElement('td');
   const val=sid?unitChecklistScore(sid,u,id):null;
   td.textContent=val===null?'–':val.toLocaleString('de-AT',{maximumFractionDigits:2})+' / 10';
   row.append(td);
  });
 });
};
