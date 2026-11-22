// Gruppenwechsel und druckbares Laufblatt, Daten bleiben in classes[].groups[].transitions.
function transitionList(cid,gid){return cls(cid)?.groups?.find(g=>g.id===gid)?.transitions||[]}
function transitionStatus(t){const now=new Date().toLocaleDateString('en-CA');if(t.completed)return 'Abgeschlossen';if(t.end&&now>t.end)return 'Übergabe überfällig';if(t.end&&now>=t.end)return 'Übergabe fällig';if(t.end&&Math.round((new Date(t.end+'T12:00:00')-new Date(now+'T12:00:00'))/86400000)<=7&&now>=t.start)return 'Wechsel in Kürze';if(now<t.start)return 'Geplant';return 'Aktiv'}
function transitionGroupNotice(cid,gid){const list=transitionList(cid,gid).filter(t=>['Wechsel in Kürze','Übergabe fällig','Übergabe überfällig'].includes(transitionStatus(t)));return list.length?`<div class="notice"><b>Gruppenwechsel:</b> ${list.map(t=>`${escapeHtml(transitionStatus(t))} am ${fmtDate(t.end)} · Übergabe an ${escapeHtml(t.nextTeacher||'noch offen')}`).join('; ')} <button class="btn secondary" onclick="groupTransitionDialog('${cid}','${gid}')">Laufblatt / Übergabe</button></div>`:''}
function transitionDashboardNotice(){const entries=[];state.classes.filter(c=>c.yearId===state.activeYear).forEach(c=>(c.groups||[]).forEach(g=>transitionList(c.id,g.id).forEach(t=>{const status=transitionStatus(t);if(['Wechsel in Kürze','Übergabe fällig','Übergabe überfällig'].includes(status))entries.push(`${c.code} / ${g.name}: ${status} (${fmtDate(t.end)}) → ${t.nextTeacher||'Lehrer offen'}`)})));return entries.length?`<div class="notice"><b>Anstehende Gruppenwechsel</b><ul>${entries.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</ul></div>`:''}
// Only meaningful, saved lesson/student information determines the suggested period.
function transitionUnitHasData(cid,gid,u){
 const students=groupStudents(cid,gid);
 const meaningful=students.some(st=>{
  const r=getRecord(st.id,u.id,false);
  if(!r)return false;
  return !!(r.absent||r.present===false||r.absenceOverride||r.arrive||r.leave||r.arriveReason||r.leaveReason||r.topicOverride||r.comment||
   Object.values(r.ratings||{}).some(v=>typeof validRating==='function'&&validRating(v)!==null)||
   Object.values(r.ratingNotes||{}).some(Boolean)||Object.values(r.ratingPhotos||{}).some(Boolean)||
   (r.workPhotos||[]).length||(r.workDocuments||[]).length||Object.values(r.ratingDocuments||{}).some(Boolean));
 });
 return meaningful||!!(u.notes&&u.notes.trim())||!!(u.topic&&u.topic.trim()&&!/^einheit$/i.test(u.topic.trim())&&!/^unterricht$/i.test(u.topic.trim()));
}
function transitionSuggestedDates(cid,gid){
 const dates=classUnits(cid,gid).filter(u=>transitionUnitHasData(cid,gid,u)).map(u=>u.date).sort();
 return dates.length?{start:dates[0],end:dates[dates.length-1]}:null;
}
function transitionSuggestedGrade(cid,gid,sid,start,end){
 if(!start||!end)return '';
 const weights=classWeights(cid);
 let total=0,den=0;
 for(const u of classUnits(cid,gid).filter(u=>u.date>=start&&u.date<=end)){
  const detail=scoreDetail(getRecord(sid,u.id,false),weights,u.id);
  if(detail&&detail.average!==null&&detail.weightSum>0){total+=detail.weightedPoints;den+=detail.weightSum;}
 }
 return den?String(gradeFor(cid,total/den)):'';
}
function groupTransitionDialog(cid,gid,tid=''){
 const c=cls(cid),g=c?.groups.find(x=>x.id===gid);if(!g)return;
 const t=transitionList(cid,gid).find(x=>x.id===tid)||null;
 const today=new Date().toLocaleDateString('en-CA');
 const suggested=transitionSuggestedDates(cid,gid);
 const initialStart=t?.start||suggested?.start||today,initialEnd=t?.end||suggested?.end||today;
 const inp=(id,label,val='',type='text')=>`<div class="field"><label>${label}</label><input id="${id}" type="${type}" value="${escapeHtml(val)}"></div>`;
 openModal(`<h2>Gruppenwechsel – ${escapeHtml(c.code)} / ${escapeHtml(g.name)}</h2><p>Unterrichtsabschnitt und Übergabe an die nächste Lehrperson verwalten.</p><div class="form-grid">${inp('trStart','Unterricht von',initialStart,'date')}${inp('trEnd','Unterricht bis / Übergabe',initialEnd,'date')}${inp('trPrev','Übernommen von (Lehrer)',t?.previousTeacher||'')}${inp('trCurrent','Aktueller Lehrer',t?.currentTeacher||'')}${inp('trNext','Übergabe an (Lehrer)',t?.nextTeacher||'')}</div><div class="field"><label>Übergabehinweise</label><textarea id="trNotes" rows="3">${escapeHtml(t?.notes||'')}</textarea></div><label class="inline-check"><input type="checkbox" id="trComplete" ${t?.completed?'checked':''}> Übergabe abgeschlossen</label><h3>Endnoten je Schüler (optional)</h3><p class="small">Vorschlag aus den gewichteten Bewertungen im Unterrichtszeitraum. Die Auswahl bleibt manuell änderbar.</p><div class="form-grid">${groupStudents(cid,gid).map(st=>`<div class="field"><label>${escapeHtml(st.name)}</label><select data-tr-grade="${st.id}"><option value="">–</option>${[1,2,3,4,5].map(n=>`<option value="${n}" ${String(t?.grades?.[st.id]||transitionSuggestedGrade(cid,gid,st.id,initialStart,initialEnd))===String(n)?'selected':''}>${n}</option>`).join('')}</select></div>`).join('')}</div><div class="modal-actions"><button class="btn" id="trSave">${t?'Änderungen speichern':'Abschnitt anlegen'}</button>${t?'<button class="btn secondary" id="trPrint">Laufblatt / PDF</button><button class="btn danger" id="trDelete">Abschnitt löschen</button>':''}</div><h3>Gespeicherte Abschnitte</h3><div class="table-wrap"><table><thead><tr><th>Zeitraum</th><th>Lehrerwechsel</th><th>Status</th><th>Aktion</th></tr></thead><tbody>${transitionList(cid,gid).map(x=>`<tr><td>${fmtDate(x.start)} – ${fmtDate(x.end)}</td><td>${escapeHtml(x.previousTeacher||'–')} → ${escapeHtml(x.currentTeacher||'–')} → ${escapeHtml(x.nextTeacher||'–')}</td><td>${escapeHtml(transitionStatus(x))}</td><td><button class="btn secondary" data-tr-edit="${x.id}">Bearbeiten</button> <button class="btn secondary" data-tr-print="${x.id}">Laufblatt</button></td></tr>`).join('')}</tbody></table></div>`);
 const refreshGradeSuggestions=()=>{const start=document.getElementById('trStart').value,end=document.getElementById('trEnd').value;modal.querySelectorAll('[data-tr-grade]').forEach(el=>{if(el.dataset.manualGrade==='1')return;el.value=t?.grades?.[el.dataset.trGrade]||transitionSuggestedGrade(cid,gid,el.dataset.trGrade,start,end)})};
 modal.querySelectorAll('[data-tr-grade]').forEach(el=>el.addEventListener('change',()=>{el.dataset.manualGrade='1'}));
 document.getElementById('trStart').addEventListener('change',refreshGradeSuggestions);
 document.getElementById('trEnd').addEventListener('change',refreshGradeSuggestions);
 document.getElementById('trSave').onclick=()=>{const v=id=>document.getElementById(id).value.trim();const start=v('trStart'),end=v('trEnd');if(!start||!end||start>end)return alert('Bitte gültigen Zeitraum eingeben (Beginn nicht nach Ende).');const other=transitionList(cid,gid).find(x=>x.id!==tid&&start<=x.end&&end>=x.start);if(other)return alert('Dieser Zeitraum überschneidet sich mit einem anderen Unterrichtsabschnitt.');const obj=t||{id:uid('transition')};Object.assign(obj,{start,end,previousTeacher:v('trPrev'),currentTeacher:v('trCurrent'),nextTeacher:v('trNext'),notes:v('trNotes'),grades:Object.fromEntries([...modal.querySelectorAll('[data-tr-grade]')].filter(el=>el.value).map(el=>[el.dataset.trGrade,el.value])),completed:document.getElementById('trComplete').checked});if(!t){g.transitions=g.transitions||[];g.transitions.push(obj)}saveState();closeModal();render();groupTransitionDialog(cid,gid,obj.id)};
 if(t){document.getElementById('trPrint').onclick=()=>printGroupLaufblatt(cid,gid,t.id);document.getElementById('trDelete').onclick=()=>{if(confirm('Nur diesen Gruppenwechsel-Eintrag löschen? Unterrichtsdaten bleiben erhalten.')){g.transitions=g.transitions.filter(x=>x.id!==t.id);saveState();closeModal();render();groupTransitionDialog(cid,gid)}}}
 modal.querySelectorAll('[data-tr-edit]').forEach(b=>b.onclick=()=>groupTransitionDialog(cid,gid,b.dataset.trEdit));modal.querySelectorAll('[data-tr-print]').forEach(b=>b.onclick=()=>printGroupLaufblatt(cid,gid,b.dataset.trPrint));
}
function printGroupLaufblatt(cid,gid,tid){
 const c=cls(cid),g=c?.groups.find(x=>x.id===gid),t=transitionList(cid,gid).find(x=>x.id===tid);if(!t)return;
 const units=classUnits(cid,gid).filter(u=>u.date>=t.start&&u.date<=t.end),students=groupStudents(cid,gid);
 const h=escapeHtml;
 const head=units.map(u=>`<th>SW ${schoolWeek(u.date)}<br>${fmtDate(u.date)}</th>`).join('');
 const rows=students.map(st=>{let missed=0;const cells=units.map(u=>{const r=getRecord(st.id,u.id,false);if(!r)return '<td>–</td>';const f=calcMissedUE(c,r,st.id,u.id);missed+=f;return `<td>${f>0?h(f.toLocaleString('de-AT',{maximumFractionDigits:1}))+' F':'✓'}</td>`}).join('');const grades=units.map(u=>getRecord(st.id,u.id,false)?.ratings?.Lehrer).filter(v=>Number.isFinite(Number(v))&&Number(v)>0).map(Number);const avg=grades.length?grades.reduce((a,b)=>a+b,0)/grades.length:null;return `<tr><th>${h(st.name)}</th>${cells}<td>${missed.toLocaleString('de-AT',{maximumFractionDigits:1})}</td><td>${h(t.grades?.[st.id]||transitionSuggestedGrade(cid,gid,st.id,t.start,t.end)||'–')}</td></tr>`}).join('');
 const work=units.map(u=>`<tr><td>SW ${schoolWeek(u.date)}</td><td>${fmtDate(u.date)}</td><td>${h(u.topic||'')}</td><td>${h(u.notes||'')}</td></tr>`).join('');
 const html=`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Laufblatt ${h(c.code)} ${h(g.name)}</title><style>body{font:12px Arial,sans-serif;margin:18mm;color:#111}h1{font-size:19px}table{border-collapse:collapse;width:100%;margin:12px 0}th,td{border:1px solid #777;padding:5px;text-align:center}th:first-child{text-align:left}thead{background:#e9edf0}.meta{line-height:1.7}.small{font-size:10px}.print{margin-bottom:12px}@media print{@page{size:A4 landscape;margin:12mm}.print{display:none}table{font-size:9px}tr{break-inside:avoid}}</style></head><body><button class="print" onclick="window.print()">Drucken / als PDF speichern</button><h1>Laufblatt – ${h(c.code)} / ${h(g.name)}</h1><div class="meta"><b>Schuljahr:</b> ${h(currentYear()?.label||'')} &nbsp; <b>Zeitraum:</b> ${fmtDate(t.start)} – ${fmtDate(t.end)}<br><b>Übernommen von:</b> ${h(t.previousTeacher||'–')} &nbsp; <b>Lehrperson:</b> ${h(t.currentTeacher||'–')} &nbsp; <b>Übergabe an:</b> ${h(t.nextTeacher||'–')}<br><b>Übergabestatus:</b> ${h(transitionStatus(t))}</div><h2>Anwesenheit / Fehlstunden / Note</h2><table><thead><tr><th>Schüler</th>${head}<th>Fehl-UE</th><th>Note</th></tr></thead><tbody>${rows}</tbody></table><p class="small">✓ = keine erfassten Fehlstunden; – = keine Erfassung. Die Note wird aus den gewichteten Bewertungen des Unterrichtsabschnitts vorgeschlagen und kann im Gruppenwechsel-Dialog angepasst werden.</p><h2>Ausgeführte Arbeiten</h2><table><thead><tr><th>Schulwoche</th><th>Datum</th><th>Arbeit / Unterricht</th><th>Bemerkung</th></tr></thead><tbody>${work}</tbody></table><h2>Übergabehinweise</h2><p>${h(t.notes||'–').replace(/\n/g,'<br>')}</p><p>Übergabe am: __________________ &nbsp; Unterschrift: __________________</p></body></html>`;
 const win=window.open('','_blank');if(!win)return alert('Bitte Pop-ups für das Laufblatt erlauben.');win.document.open();win.document.write(html);win.document.close();
}
