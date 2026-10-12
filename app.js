'use strict';

const APP_VERSION='7.5.12';
const DATA_SCHEMA_VERSION=4;
const DB_NAME='htl-praxis-db';
const DB_STORE='app';
const STORAGE_KEY='htl-praxis-state-v2';
const OLD_STORAGE_KEY='htl-praxis-state-v1';
const RUBRICS=['Eigen','Lehrer','Arbeitsbericht','Unterlagen','Allgemein','Sonstiges'];
const DEFAULT_SCHOOL_START='2026-09-14';
const SCHEDULES={
  BT12:{label:'Bautechnik 1. und 2. Jahrgang',blocks:[['07:50','09:30'],['09:40','12:10'],['12:40','14:20']]},
  BT3:{label:'Bautechnik 3. Jahrgang',blocks:[['07:50','09:30'],['09:40','12:10'],['12:40','14:20'],['14:30','17:00']]},
  BFS1:{label:'Baufachschule 1. Jahrgang',blocks:[['07:50','09:30'],['09:40','12:10'],['12:40','15:10']]},
  BFS23:{label:'Baufachschule 2. und 3. Jahrgang',blocks:[['07:50','09:30'],['09:40','12:10'],['12:40','14:15'],['14:25','16:10']]}
};

const initialBTD={
  'Gruppe 1':[],
  'Gruppe 2':[],
  'Gruppe 3':[]
};
const initialBFS={
  'Gruppe 1':[],
  'Gruppe 2':[],
  'Gruppe 3':[],
  'Gruppe 4':[],
  'Gruppe 5':[],
  'Gruppe 6':[]
};
const btdUnits=[['2026-09-29','Anreißen / Schnittübungen'],['2026-10-06','Schnittübung + gerades Eckblatt'],['2026-10-13','Gerades Eckblatt - Vertiefung'],['2026-10-20','Überblattung / Kreuzblatt'],['2026-11-03','Verzapfung - Anriss'],['2026-11-10','Verzapfung - Ausführung'],['2026-11-17','Holzverlängerung'],['2026-11-24','Verkämmung'],['2026-12-01','Versatz - Grundlagen'],['2026-12-15','Versatz - Ausführung'],['2026-12-22','Aufriss / Winkel'],['2027-01-12','Aufriss / rechter Winkel'],['2027-01-19','Holzkunde / Holzarten'],['2027-01-26','Arbeiten des Holzes'],['2027-02-02','Schnittholz / Dachformen'],['2027-02-09','Dachkonstruktion / Halbjahresabschluss']];
const bfsUnits=[['2026-10-01','Einheit'],['2026-10-08','Einheit'],['2026-10-15','Einheit'],['2026-10-22','Einheit'],['2026-11-05','Einheit'],['2026-11-12','Einheit'],['2026-11-19','Einheit'],['2026-11-26','Einheit'],['2026-12-03','Einheit'],['2026-12-10','Einheit'],['2026-12-17','Einheit'],['2027-01-07','Einheit'],['2027-01-14','Einheit'],['2027-01-21','Einheit'],['2027-01-28','Einheit'],['2027-02-04','Einheit'],['2027-02-11','Einheit']];

function uid(prefix='id'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`}
function fmtDate(iso){if(!iso)return'';const [y,m,d]=iso.split('-');return `${d}.${m}.${y}`}
function escapeHtml(s=''){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function average(vals){const a=vals.filter(v=>Number.isFinite(v));return a.length?a.reduce((x,y)=>x+y,0)/a.length:null}
function initials(name){return name.split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}
function mins(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function scheduleMinutes(key){return (SCHEDULES[key]?.blocks||[]).reduce((a,[s,e])=>a+mins(e)-mins(s),0)}
function scheduleUE(key){return scheduleMinutes(key)/50}
function currentYear(){return state.schoolYears.find(y=>y.id===state.activeYear)||state.schoolYears[0]}
function schoolWeek(iso){const d=new Date(iso+'T12:00:00');const s=new Date((currentYear()?.schoolStart||DEFAULT_SCHOOL_START)+'T12:00:00');return Math.floor((d-s)/(7*864e5))+1}
function classSchedule(c,u=null,g=null){
 const base=SCHEDULES[c?.scheduleKey]||SCHEDULES.BT12;
 const override=u?.scheduleBlocks || g?.scheduleBlocks || c?.scheduleBlocks;
 return override?.length?{label:base.label+' (angepasst)',blocks:override}:base;
}
function classScheduleMinutes(c,u=null,g=null){return classSchedule(c,u,g).blocks.reduce((a,[start,end])=>a+mins(end)-mins(start),0)}
function validBlocks(blocks){return Array.isArray(blocks)&&blocks.length>0&&blocks.every(([a,b],i)=>/^([01]\d|2[0-3]):[0-5]\d$/.test(a)&&/^([01]\d|2[0-3]):[0-5]\d$/.test(b)&&mins(a)<mins(b)&&(!i||mins(a)>=mins(blocks[i-1][1])))}
function pauseLabel(a,b){const n=mins(b)-mins(a);return n>0?`<div class="schedule-pause" role="note">Pause: ${a}–${b} (${n} Minuten)</div>`:''}
function refreshBlockPauses(id){const rows=[...document.querySelectorAll('#'+id+' .schedule-block')];rows.forEach((row,i)=>{row.nextElementSibling?.classList.contains('schedule-pause')&&row.nextElementSibling.remove();if(i===rows.length-1)return;const end=row.querySelectorAll('input')[1]?.value,start=rows[i+1].querySelector('input')?.value;if(end&&start&&mins(start)>mins(end))row.insertAdjacentHTML('afterend',pauseLabel(end,start))})}
function timeBlockEditor(blocks,id){return `<div id="${id}">${blocks.map(([a,b],i)=>`${i?pauseLabel(blocks[i-1][1],a):''}<div class="schedule-block"><input type="time" value="${a}" aria-label="Beginn"> – <input type="time" value="${b}" aria-label="Ende"><button type="button" class="btn secondary" data-del-block>Entfernen</button></div>`).join('')}</div><button type="button" class="btn secondary" id="${id}Add">+ Zeitblock</button>`}
function bindBlockEditor(id){const el=document.getElementById(id);el.onclick=e=>{if(e.target.matches('[data-del-block]')){e.target.closest('.schedule-block').remove();refreshBlockPauses(id)}};el.addEventListener('input',()=>refreshBlockPauses(id));document.getElementById(id+'Add').onclick=()=>{const row=document.createElement('div');row.className='schedule-block';row.innerHTML='<input type="time" value="08:00" aria-label="Beginn"> – <input type="time" value="09:00" aria-label="Ende"><button type="button" class="btn secondary" data-del-block>Entfernen</button>';el.append(row);refreshBlockPauses(id)}}
function readBlockEditor(id){return [...document.querySelectorAll('#'+id+' .schedule-block')].map(row=>[...row.querySelectorAll('input')].map(x=>x.value))}


function makeInitialState(){
 const cfg=window.HTL_CONFIG||{};const st={version:DATA_SCHEMA_VERSION,schoolYears:[{id:'2026-27',label:'2026/27',schoolStart:DEFAULT_SCHOOL_START}],activeYear:'2026-27',classes:[],students:[],units:[],records:{},curriculum:{},sync:{lastSyncedAt:'',remoteETag:'',remoteModifiedAt:'',lastError:'',dirtySince:''},settings:{clientId:cfg.clientId||'',tenantId:cfg.tenantId||'common',autoSync:false,oneDriveFolder:'HTL-Praxis',rubrics:RUBRICS}};
 const addClass=(code,groups,units,scheduleKey)=>{const cid=uid('class');const c={id:cid,yearId:'2026-27',code,label:code,scheduleKey,groups:Object.keys(groups).map(n=>({id:uid('grp'),name:n}))};st.classes.push(c);Object.entries(groups).forEach(([g,names])=>{const gid=c.groups.find(x=>x.name===g).id;names.forEach(name=>st.students.push({id:uid('stu'),classId:cid,groupId:gid,name,photo:'',notes:'',strengths:'',supportNeed:'',supportGoal:''}))});c.groups.forEach(g=>units.forEach(([date,topic])=>st.units.push({id:uid('unit'),classId:cid,groupId:g.id,date,topic,notes:'',teacherArrive:'',teacherLeave:''})));st.curriculum[cid]=[]};
 addClass('1.BTD',initialBTD,btdUnits,'BT12'); addClass('1.BFS',initialBFS,bfsUnits,'BFS1'); return st;
}
function migrate(old){
 if(!old||!old.version)return makeInitialState();
 old.curriculum=old.curriculum||{};old.settings=old.settings||{};old.settings.rubrics=old.settings.rubrics||RUBRICS;old.settings.tenantId=old.settings.tenantId||'common';old.settings.autoSync=!!old.settings.autoSync;old.sync=old.sync||{lastSyncedAt:'',remoteETag:'',remoteModifiedAt:'',lastError:'',dirtySince:''};old.sync.dirtySince=old.sync.dirtySince||(!old.sync.lastSyncedAt?new Date().toISOString():'');
 old.classes.forEach(c=>{if(!c.scheduleKey)c.scheduleKey=c.code.includes('BFS')?'BFS1':'BT12';old.curriculum[c.id]=old.curriculum[c.id]||[]});old.units.forEach(u=>{u.teacherArrive=u.teacherArrive||'';u.teacherLeave=u.teacherLeave||''});Object.values(old.records||{}).forEach(r=>{r.absent=!!r.absent;r.absenceOverride=r.absenceOverride??'';if(!Array.isArray(r.workPhotos))r.workPhotos=[];r.ratingNotes=r.ratingNotes||{}});
 // Bestehende Klasseneinheiten je Gruppe getrennt übernehmen, ohne Bewertungen zu verlieren.
 if(old.version<4){
  old.classes.forEach(c=>{const groups=c.groups||[];if(!groups.length)return;
   old.units.filter(u=>u.classId===c.id&&!u.groupId).forEach(u=>{
    u.groupId=groups[0].id;
    groups.slice(1).forEach(g=>{const copy={...u,id:uid('unit'),groupId:g.id};old.units.push(copy);
     (old.students||[]).filter(st=>st.classId===c.id&&st.groupId===g.id).forEach(st=>{
      const from=`${st.id}::${u.id}`,to=`${st.id}::${copy.id}`;
      if(old.records?.[from]){old.records[to]={...old.records[from],_unitId:copy.id};delete old.records[from]}
     });
    });
   });
  });
 }
 old.version=DATA_SCHEMA_VERSION;return old;
}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbGet(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbSet(key,val){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(val,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function loadState(){try{const idb=await idbGet('state');if(idb)return migrate(idb);const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY);if(raw){const st=migrate(JSON.parse(raw));await idbSet('state',st);return st}return makeInitialState()}catch(e){console.warn('State load failed',e);return makeInitialState()}}
let state=null,route={type:'dashboard'},activePhotoTarget=null,activeCurriculumClassId=null,saveTimer=null,autoSyncTimer=null;
function saveState(){if(!state)return;if(!syncBusy){state.sync=state.sync||{};state.sync.dirtySince=state.sync.dirtySince||new Date().toISOString()}clearTimeout(saveTimer);saveTimer=setTimeout(()=>idbSet('state',state).catch(e=>console.warn('IndexedDB save failed',e)),50);renderNav();scheduleAutoSync()}
function cls(id){return state.classes.find(x=>x.id===id)}
function student(id){return state.students.find(x=>x.id===id)}
function classStudents(cid){return state.students.filter(s=>s.classId===cid)}
function groupStudents(cid,gid){return state.students.filter(s=>s.classId===cid&&s.groupId===gid)}
function classUnits(cid,gid=null){return state.units.filter(u=>u.classId===cid&&!u.archived&&(!gid||u.groupId===gid)).sort((a,b)=>a.date.localeCompare(b.date))}
function recKey(sid,uid){return `${sid}::${uid}`}
function getRecord(sid,uid,create=true){const k=recKey(sid,uid);if(!state.records[k]&&create)state.records[k]={ratings:{},absent:false,absenceOverride:'',arrive:'',leave:'',topicOverride:'',comment:'',ratingNotes:{},workPhotos:[]};const r=state.records[k]||null;if(r){r._unitId=uid;r._studentId=sid}if(r&&!Array.isArray(r.workPhotos))r.workPhotos=[];if(r&&!r.ratingNotes)r.ratingNotes={};return r}
function currentUnit(cid,gid=null){const us=classUnits(cid,gid),today=new Date().toISOString().slice(0,10);return [...us].reverse().find(u=>u.date<=today)||us[0]}
function studentAvg(sid){const vals=Object.entries(state.records).filter(([k])=>k.startsWith(sid+'::')).map(([,r])=>r.absent?null:r.ratings?.Lehrer).filter(v=>Number.isFinite(v)&&v>=1&&v<=4);return average(vals)}

function calcMissedUE(c,r,sid=null,unitId=null){if(!c||!r)return 0;if(r.present)return 0;if(r.absenceOverride!==''&&r.absenceOverride!=null&&!Number.isNaN(Number(r.absenceOverride)))return Number(r.absenceOverride);const unit=state.units.find(u=>u.id===(unitId||r._unitId)),group=state.students.find(s=>s.id===(sid||r._studentId))?.groupId;const g=c.groups?.find(x=>x.id===group);const sch=classSchedule(c,unit,g),total=classScheduleMinutes(c,unit,g);if(r.absent)return total/50;const first=mins(sch.blocks[0][0]),last=mins(sch.blocks.at(-1)[1]);const a=r.arrive?mins(r.arrive):first,l=r.leave?mins(r.leave):last;let present=0;sch.blocks.forEach(([s,e])=>{const bs=mins(s),be=mins(e);present+=Math.max(0,Math.min(l,be)-Math.max(a,bs))});return Math.max(0,total-present)/50}
function totalAbsence(sid){const s=student(sid),c=cls(s?.classId);return Object.entries(state.records).filter(([k])=>k.startsWith(sid+'::')).reduce((a,[k,r])=>a+calcMissedUE(c,r,sid,k.split('::')[1]),0)}
function teacherPresence(c,u){const sch=classSchedule(c,u),total=classScheduleMinutes(c,u);if(!u)return{present:0,total,ue:0,totalUE:total/50};const first=mins(sch.blocks[0][0]),last=mins(sch.blocks.at(-1)[1]);const a=u.teacherArrive?mins(u.teacherArrive):first,l=u.teacherLeave?mins(u.teacherLeave):last;let p=0;sch.blocks.forEach(([s,e])=>{p+=Math.max(0,Math.min(l,mins(e))-Math.max(a,mins(s)))});return{present:p,total,ue:p/50,totalUE:total/50}}

const view=document.getElementById('view'),modal=document.getElementById('modal');
function openModal(html){if(modal.open)modal.close();modal.innerHTML=`<div class="modal-body"><button type="button" class="modal-close" aria-label="Fenster schließen" title="Schließen">×</button>${html}<div class="modal-footer-close"><button type="button" class="btn secondary" data-close-modal>Schließen</button></div></div>`;modal.querySelector(".modal-close").onclick=closeModal;modal.querySelector("[data-close-modal]").onclick=closeModal;modal.showModal()}
function closeModal(){if(modal.open)modal.close()}
modal.addEventListener("click",e=>{if(e.target===modal)closeModal()});
function renderNav(){const ys=document.getElementById('yearSelect');ys.innerHTML=state.schoolYears.map(y=>`<option value="${y.id}" ${y.id===state.activeYear?'selected':''}>${escapeHtml(y.label)}</option>`).join('');const nav=document.getElementById('classNav');nav.innerHTML=state.classes.filter(c=>c.yearId===state.activeYear).map(c=>`<button class="nav-button ${route.classId===c.id?'active':''}" data-class="${c.id}">${escapeHtml(c.code)}</button>`).join('');nav.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{route={type:'class',classId:b.dataset.class};render()})}
function render(){renderNav();if(route.type==='dashboard')renderDashboard();else if(route.type==='class')renderClass(route.classId,route.unitId);else if(route.type==='group')renderGroup(route.classId,route.groupId,route.unitId);else if(route.type==='student')renderStudent(route.studentId,route.unitId);else if(route.type==='curriculum')renderCurriculum(route.classId);else if(route.type==='unitOverview')renderUnitOverview(route.classId,route.groupId)}

function renderDashboard(){const classes=state.classes.filter(c=>c.yearId===state.activeYear),all=classes.flatMap(c=>classStudents(c.id));let teacherUE=0,teacherTotal=0;classes.forEach(c=>classUnits(c.id).forEach(u=>{if(u.teacherArrive||u.teacherLeave){const p=teacherPresence(c,u);teacherUE+=p.ue;teacherTotal+=p.totalUE}}));view.innerHTML=`<div class="view-header"><div><h2>Übersicht</h2><div class="sub">${escapeHtml(currentYear()?.label||'')}</div></div></div><div class="stat-cards"><div class="stat-card"><div class="big">${classes.length}</div><div class="label">Klassen</div></div><div class="stat-card"><div class="big">${all.length}</div><div class="label">Schüler:innen</div></div><div class="stat-card"><div class="big">${all.reduce((a,s)=>a+totalAbsence(s.id),0).toFixed(1)}</div><div class="label">Fehlstunden (UE)</div></div><div class="stat-card"><div class="big">${teacherTotal?teacherUE.toFixed(1):'–'}</div><div class="label">Meine Anwesenheit (UE)</div></div></div><h3>Klassen</h3><div class="grid">${classes.map(c=>{const cur=state.curriculum[c.id]||[],assigned=cur.filter(i=>i.unitId).length;return `<div class="card clickable" data-c="${c.id}"><b>${escapeHtml(c.code)}</b><div class="sub">${classStudents(c.id).length} Schüler · ${c.groups.length} Gruppen</div><div class="mini-stats"><span class="pill">${classUnits(c.id).length} Einheiten</span><span class="pill">Stoff ${assigned}/${cur.length}</span><span class="pill">${escapeHtml(SCHEDULES[c.scheduleKey]?.label||'')}</span></div></div>`}).join('')}</div>`;view.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{route={type:'class',classId:x.dataset.c};render()})}

function renderClass(cid){const c=cls(cid);if(!c)return;
 view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(c.code)}</h2><div class="sub">${classStudents(cid).length} Schüler · ${c.groups.length} Gruppen</div></div><div class="toolbar"><button class="btn" id="addGroup">+ Gruppe</button><button class="btn" id="addStudent">+ Schüler</button><button class="btn secondary" id="batchPhotos">Schülerfotos importieren</button><button class="btn" id="curriculumBtn">Gesamtstoff</button><button class="btn secondary" id="scheduleBtn">Unterrichtszeiten</button></div></div><h3>Gruppen und Unterrichtseinheiten</h3><div class="grid">${c.groups.map(g=>`<div class="card clickable" data-g="${g.id}"><b>${escapeHtml(g.name)}</b><div class="sub">${groupStudents(cid,g.id).length} Schüler · ${classUnits(cid,g.id).length} Einheiten</div></div>`).join('')}</div><h3>Klassenliste</h3>${studentTable(cid,null,null)}`;
 document.getElementById('addGroup').onclick=()=>addGroupDialog(cid);document.getElementById('addStudent').onclick=()=>addStudentDialog(cid);document.getElementById('batchPhotos').onclick=()=>batchPhotoDialog(cid);document.getElementById('curriculumBtn').onclick=()=>{route={type:'curriculum',classId:cid};render()};document.getElementById('scheduleBtn').onclick=()=>scheduleDialog(cid);
 view.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{route={type:'group',classId:cid,groupId:x.dataset.g};render()});bindStudentLinks();bindRatings();
}
function renderGroup(cid,gid,unitId){const c=cls(cid),g=c?.groups.find(x=>x.id===gid);if(!c||!g)return;
 const units=classUnits(cid,gid),u=units.find(x=>x.id===unitId)||currentUnit(cid,gid);
 view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(c.code)} · ${escapeHtml(g.name)}</h2><div class="sub">${groupStudents(cid,gid).length} Schüler · ${units.length} Einheiten</div></div><div class="toolbar"><button class="btn secondary" id="backClass">Klasse</button><button class="btn secondary" id="unitOverview">Einheitenübersicht</button><button class="btn" id="addUnit">+ Einheit</button><button class="btn secondary" id="copyUnit">Einheit aus Gruppe kopieren</button></div></div><div class="section-card"><div class="unit-bar"><b>Einheit:</b><select id="unitSelect">${units.map(x=>`<option value="${x.id}" ${u&&x.id===u.id?'selected':''}>SW ${schoolWeek(x.date)} · ${fmtDate(x.date)} · ${escapeHtml(x.topic)}</option>`).join('')}</select><button class="btn secondary" id="editUnit" ${u?'':'disabled'}>Einheit bearbeiten</button><button class="btn secondary" id="deleteUnit" ${u?'':'disabled'}>Einheit löschen</button><button class="btn secondary" id="archivedUnits">Archiv (${state.units.filter(x=>x.groupId===gid&&x.archived).length})</button></div>${u?.showNotesInOverview&&u.notes?`<div class="notice" style="margin-top:12px">${escapeHtml(u.notes)}</div>`:''}</div>${studentTable(cid,gid,u?.id)}`;
 document.getElementById('backClass').onclick=()=>{route={type:'class',classId:cid};render()};document.getElementById('unitOverview').onclick=()=>{route={type:'unitOverview',classId:cid,groupId:gid};render()};document.getElementById('addUnit').onclick=()=>unitDialog(cid,null,gid);document.getElementById('copyUnit').onclick=()=>copyUnitDialog(cid,gid);document.getElementById('editUnit').onclick=()=>u&&unitDialog(cid,u.id,gid);document.getElementById('deleteUnit').onclick=()=>u&&deleteUnitDialog(cid,gid,u.id);document.getElementById('archivedUnits').onclick=()=>archivedUnitsDialog(cid,gid);
 document.getElementById('unitSelect').onchange=e=>{route.unitId=e.target.value;renderGroup(cid,gid,e.target.value)};bindStudentLinks();bindRatings();bindQuickAttendance(c,u);
}
function unitHasData(u){
 const records=Object.entries(state.records||{}).filter(([k,r])=>k.endsWith('::'+u.id)&&r&&(
  Object.values(r.ratings||{}).some(v=>Number(v)>0)||r.absent||r.present||r.arrive||r.leave||r.comment||r.topicOverride||r.absenceOverride!==''&&r.absenceOverride!=null||Object.values(r.ratingNotes||{}).some(Boolean)||(r.workPhotos||[]).length));
 const assignments=Object.values(state.curriculum||{}).some(items=>Array.isArray(items)&&items.some(i=>i.unitId===u.id));
 return records.length>0||assignments||!!(state.unitLinks?.[u.id]?.length||u.materials?.length||u.media?.length||u.pages?.length||u.scriptPages?.length||Object.keys(state.lessonPageNotes757||{}).some(k=>k.startsWith(u.id+'::')));
}
function permanentlyDeleteUnit(cid,gid,u){
 state.units=state.units.filter(x=>x.id!==u.id);
 if(state.unitLinks)delete state.unitLinks[u.id];
 if(state.lessonPageNotes757)Object.keys(state.lessonPageNotes757).filter(k=>k.startsWith(u.id+'::')).forEach(k=>delete state.lessonPageNotes757[k]);
 Object.keys(state.records||{}).forEach(k=>{if(k.endsWith('::'+u.id))delete state.records[k]});
 Object.values(state.curriculum||{}).forEach(items=>{if(Array.isArray(items))items.forEach(i=>{if(i.unitId===u.id)i.unitId=''})});
 saveState();closeModal();route={type:'group',classId:cid,groupId:gid};render();
}
function deleteUnitDialog(cid,gid,id){const u=state.units.find(x=>x.id===id);if(!u)return;
 const hasData=unitHasData(u),title=`${fmtDate(u.date)} – ${u.topic}`;
 if(!hasData){if(confirm(`Einheit ${title} wirklich löschen?\nDie Einheit wird aus dieser Gruppe entfernt.`))permanentlyDeleteUnit(cid,gid,u);return}
 openModal(`<h2>Einheit mit Daten entfernen</h2><p><b>${escapeHtml(title)}</b></p><div class="notice">Zu dieser Einheit sind Schülerdaten, Bewertungen, Anwesenheiten, Materialien oder Stoffzuordnungen vorhanden. Archivieren bewahrt diese Daten. Endgültiges Löschen entfernt auch alle zugehörigen Einträge.</div><div class="modal-actions"><button class="btn secondary" id="cancelUnitDelete">Abbrechen</button><button class="btn" id="archiveUnit">Archivieren (empfohlen)</button><button class="btn secondary" id="reallyDeleteUnit">Endgültig löschen …</button></div>`);
 document.getElementById('cancelUnitDelete').onclick=closeModal;
 document.getElementById('archiveUnit').onclick=()=>{u.archived=true;saveState();closeModal();route={type:'group',classId:cid,groupId:gid};render()};
 document.getElementById('reallyDeleteUnit').onclick=()=>{const answer=prompt(`WARNUNG: Alle Daten dieser Einheit werden dauerhaft gelöscht.\nZur Bestätigung LÖSCHEN eingeben:`);if(answer==='LÖSCHEN')permanentlyDeleteUnit(cid,gid,u)};
}
function archivedUnitsDialog(cid,gid){const units=state.units.filter(u=>u.classId===cid&&u.groupId===gid&&u.archived).sort((a,b)=>a.date.localeCompare(b.date));
 openModal(`<h2>Archivierte Einheiten</h2>${units.length?units.map(u=>`<div class="section-card"><b>${fmtDate(u.date)} · ${escapeHtml(u.topic)}</b><div class="modal-actions"><button class="btn secondary" data-restore-unit="${u.id}">Wiederherstellen</button><button class="btn secondary" data-delete-archived="${u.id}">Löschen …</button></div></div>`).join(''):'<p>Keine archivierten Einheiten.</p>'}<div class="modal-actions"><button class="btn secondary" id="closeArchive">Schließen</button></div>`);
 document.getElementById('closeArchive').onclick=closeModal;
 document.querySelectorAll('[data-restore-unit]').forEach(b=>b.onclick=()=>{const u=state.units.find(x=>x.id===b.dataset.restoreUnit);if(!u)return;u.archived=false;saveState();closeModal();route={type:'group',classId:cid,groupId:gid,unitId:u.id};render()});
 document.querySelectorAll('[data-delete-archived]').forEach(b=>b.onclick=()=>{const u=state.units.find(x=>x.id===b.dataset.deleteArchived);closeModal();if(u)deleteUnitDialog(cid,gid,u.id)});
}
function copyUnitDialog(cid,gid){const options=state.units.filter(u=>!u.archived&&u.groupId&&u.groupId!==gid&&cls(u.classId)?.yearId===cls(cid)?.yearId);
 if(!options.length){alert('Keine Einheiten anderer Gruppen vorhanden.');return}
 openModal(`<h2>Einheit aus anderer Gruppe kopieren</h2><p>Übernommen werden Stoff, Zeiten, Notizen und Materialreferenzen. Bewertungen, Anwesenheiten und Schülerdaten werden nicht kopiert.</p><div class="field"><label>Quelle</label><select id="copySource">${options.map(u=>{const c=cls(u.classId),g=c?.groups.find(g=>g.id===u.groupId);return `<option value="${u.id}">${escapeHtml(c?.code||'')} · ${escapeHtml(g?.name||'')} · ${fmtDate(u.date)} · ${escapeHtml(u.topic)}</option>`}).join('')}</select></div><div class="field"><label>Datum der neuen Einheit</label><input type="date" id="copyDate" value="${new Date().toISOString().slice(0,10)}"></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="confirmCopy">Kopieren</button></div>`);
 document.getElementById('copySource').onchange=()=>{const u=state.units.find(x=>x.id===document.getElementById('copySource').value);if(u)document.getElementById('copyDate').value=u.date};document.getElementById('copySource').dispatchEvent(new Event('change'));
 document.getElementById('confirmCopy').onclick=()=>{const source=state.units.find(u=>u.id===document.getElementById('copySource').value);if(!source)return;const date=document.getElementById('copyDate').value;if(!date)return alert('Datum auswählen.');const id=uid('unit');const copy=JSON.parse(JSON.stringify(source));Object.assign(copy,{id,classId:cid,groupId:gid,date});state.units.push(copy);saveState();closeModal();route={type:'group',classId:cid,groupId:gid,unitId:id};render()};
}
function ratingWeightLabel(cid, rubric){const w=typeof classWeights==='function'?classWeights(cid):null;const n=Number(w?.[rubric]??0);return `<span class="rating-weight">${Number.isFinite(n)?n.toLocaleString('de-AT'):0} %</span>`}
function studentTable(cid,gid,unitId){const ss=gid?groupStudents(cid,gid):classStudents(cid),u=state.units.find(x=>x.id===unitId),c=cls(cid);return `<div class="table-wrap"><table><thead><tr><th>Schüler</th><th>Fehlstd.</th><th>Ganztags anwesend</th><th>Ganztags abwesend</th><th>kommt</th><th>geht</th>${RUBRICS.map(r=>`<th>${r} ${ratingWeightLabel(cid,r)}</th>`).join('')}<th>Stoff</th></tr></thead><tbody>${ss.map(s=>{const r=u?getRecord(s.id,u.id):null,miss=r?calcMissedUE(c,r,s.id,u?.id):0;return `<tr><td><div class="name-cell" data-student="${s.id}" data-unit="${u?.id||''}">${s.photo?`<img class="thumb" src="${s.photo}">`:`<span class="thumb avatar placeholder">${initials(s.name)}</span>`}<span>${escapeHtml(s.name)}</span></div></td><td>${totalAbsence(s.id).toFixed(1)}${r&&miss?` <span class="pill warn">+${miss.toFixed(1)}</span>`:''}</td><td>${u?`<input type="checkbox" aria-label="Ganztags anwesend" data-present="${s.id}" ${r?.present?'checked':''}>`:''}</td><td>${u?`<input type="checkbox" aria-label="Ganztags abwesend" data-absent="${s.id}" ${r?.absent?'checked':''}>`:''}</td><td>${u?`<input class="quick-time" type="time" data-arrive="${s.id}" value="${r?.arrive||''}">`:''}</td><td>${u?`<input class="quick-time" type="time" data-leave="${s.id}" value="${r?.leave||''}">`:''}</td>${RUBRICS.map(x=>`<td>${u?ratingHtml(r?.ratings?.[x],s.id,u.id,x,!!r?.absent):'–'}</td>`).join('')}<td class="wide-note">${escapeHtml(r?.topicOverride||u?.topic||'')}</td></tr>`}).join('')}</tbody></table></div>`}
function ratingHtml(val,sid,uid,rubric,absent=false){return `<div class="rating ${absent?'rating-absent':''}" data-sid="${sid}" data-uid="${uid}" data-rubric="${rubric}" title="${absent?'Ganztags abwesend: keine Bewertung möglich':''}">${[1,2,3,4].map(n=>`<button class="${!absent&&val>=n?'filled':''}" data-v="${n}" title="${absent?'Abwesend':n+'/4'}" ${absent?'disabled':''}></button>`).join('')}<button class="rating-clear" data-clear="1" title="Bewertung entfernen (nicht bewertet)" ${absent?'disabled':''}>×</button></div>`}
function bindRatings(){view.querySelectorAll('.rating').forEach(el=>el.querySelectorAll('button').forEach(b=>b.onclick=e=>{e.stopPropagation();const r=getRecord(el.dataset.sid,el.dataset.uid);if(r.absent)return;const n=Number(b.dataset.v),key=el.dataset.rubric;if(b.dataset.clear){delete r.ratings[key]}else if(r.ratings[key]===n){delete r.ratings[key]}else{r.ratings[key]=n}saveState();render()}))}
function bindQuickAttendance(c,u){if(!u)return;
 for(const kind of ['present','absent'])view.querySelectorAll('[data-'+kind+']').forEach(el=>el.onchange=()=>{const r=getRecord(el.dataset[kind],u.id);r[kind]=el.checked;if(el.checked){r[kind==='present'?'absent':'present']=false;r.absenceOverride='';r.arrive='';r.leave=''}saveState();render()});
 view.querySelectorAll('[data-arrive]').forEach(i=>i.onchange=()=>{const r=getRecord(i.dataset.arrive,u.id);r.arrive=i.value;r.present=false;r.absent=false;saveState();render()});view.querySelectorAll('[data-leave]').forEach(i=>i.onchange=()=>{const r=getRecord(i.dataset.leave,u.id);r.leave=i.value;r.present=false;r.absent=false;saveState();render()})}
function bindStudentLinks(){view.querySelectorAll('[data-student]').forEach(x=>x.onclick=()=>{route={type:'student',studentId:x.dataset.student,unitId:x.dataset.unit||undefined};render()})}

function renderStudent(sid,unitId){const s=student(sid),c=cls(s?.classId);if(!s||!c)return;const u=state.units.find(x=>x.id===unitId&&x.groupId===s.groupId)||currentUnit(c.id,s.groupId),r=u?getRecord(s.id,u.id):null,miss=r?calcMissedUE(c,r,s.id,u?.id):0;view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(s.name)}</h2><div class="sub">${escapeHtml(c.code)} · ${escapeHtml(c.groups.find(g=>g.id===s.groupId)?.name||'')}</div></div><div class="toolbar"><button class="btn secondary" id="backBtn">Zurück</button><button class="btn danger" id="delStudent">Schüler löschen</button></div></div><div class="detail-head"><div class="profile-photo-box">${s.photo?`<img class="detail-avatar" id="profilePhoto" src="${s.photo}">`:`<div class="detail-avatar avatar placeholder" id="profilePhoto">${initials(s.name)}</div>`}<div class="photo-actions"><button class="btn secondary" id="setProfilePhoto">${s.photo?'Foto ersetzen':'Foto zuweisen'}</button>${s.photo?'<button class="btn danger" id="removeProfilePhoto">Foto löschen</button>':''}</div></div><div><div class="stat-cards"><div class="stat-card"><div class="big">${studentAvg(s.id)?.toFixed(1)||'–'}</div><div class="label">Ø Lehrer</div></div><div class="stat-card"><div class="big">${totalAbsence(s.id).toFixed(1)}</div><div class="label">Fehlstunden (UE)</div></div></div></div></div><div class="section-card"><div class="unit-bar"><b>Einheit:</b><select id="studentUnit">${classUnits(c.id,s.groupId).map(x=>`<option value="${x.id}" ${u&&x.id===u.id?'selected':''}>SW ${schoolWeek(x.date)} · ${fmtDate(x.date)} · ${escapeHtml(x.topic)}</option>`).join('')}</select></div></div>${u?`<div class="section-card"><h3>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</h3><div class="form-grid"><div class="field"><label>Globaler Stoff</label><input value="${escapeHtml(u.topic)}" disabled></div><div class="field"><label>Individueller Stoff / Abweichung</label><input id="topicOverride" value="${escapeHtml(r.topicOverride||'')}" placeholder="leer = globaler Stoff"></div><div class="field"><label>kommt</label><input id="arrive" type="time" value="${r.arrive||''}"></div><div class="field"><label>geht</label><input id="leave" type="time" value="${r.leave||''}"></div><div class="field"><label>Fehlstunden automatisch</label><input value="${miss.toFixed(1)} UE" disabled></div><div class="field"><label>Manuelle Fehlstunden (optional)</label><input id="absenceOverride" type="number" step="0.1" min="0" value="${r.absenceOverride??''}" placeholder="leer = automatisch"></div></div><label class="inline-check"><input id="present" type="checkbox" ${r.present?'checked':''}> ganzer Tag anwesend</label><label class="inline-check"><input id="absent" type="checkbox" ${r.absent?'checked':''}> ganzer Tag abwesend</label><h3 style="margin-top:18px">Bewertung</h3>${RUBRICS.map(x=>`<div class="metric-row"><div class="label">${x} ${ratingWeightLabel(c.id,x)}</div>${ratingHtml(r.ratings[x],s.id,u.id,x,!!r.absent)}<div class="score">${r.absent?'– (abwesend)':(r.ratings[x]??'–')+'/4'}</div></div><div class="field rating-note"><label>Notiz – ${x}</label><textarea rows="2" data-rating-note="${escapeHtml(x)}" placeholder="Beobachtung zu dieser Bewertung">${escapeHtml(r.ratingNotes?.[x]||'')}</textarea></div>`).join('')}<div class="field"><label>Bemerkung</label><textarea id="comment">${escapeHtml(r.comment||'')}</textarea></div><div class="work-photo-section"><div class="section-title-row"><h3 style="margin:0">Werkstückfotos dieser Einheit</h3><button class="btn secondary" id="addWorkPhoto">+ Foto</button></div><div class="photo-strip" style="margin-top:10px">${(r.workPhotos||[]).length?(r.workPhotos||[]).map((ph,i)=>`<div class="work-photo-wrap"><img class="work-photo" src="${ph}" data-work-photo="${i}" title="Foto öffnen"><button class="work-photo-remove" data-remove-work-photo="${i}" title="Foto löschen">×</button></div>`).join(''):'<span class="muted small">Noch kein Werkstückfoto für diese Einheit.</span>'}</div></div></div>`:''}<div class="section-card"><h3>Förderung / Entwicklung</h3><div class="form-grid"><div class="field"><label>Stärken</label><textarea id="strengths">${escapeHtml(s.strengths||'')}</textarea></div><div class="field"><label>Förderbedarf</label><textarea id="supportNeed">${escapeHtml(s.supportNeed||'')}</textarea></div><div class="field"><label>Förderziel</label><textarea id="supportGoal">${escapeHtml(s.supportGoal||'')}</textarea></div><div class="field"><label>Allgemeine Notizen</label><textarea id="studentNotes">${escapeHtml(s.notes||'')}</textarea></div></div></div>`;
 document.getElementById('backBtn').onclick=()=>{route={type:'group',classId:c.id,groupId:s.groupId,unitId:u?.id};render()};document.getElementById('delStudent').onclick=()=>confirmDeleteStudent(s.id);document.getElementById('profilePhoto').onclick=()=>pickPhoto({studentId:s.id});document.getElementById('setProfilePhoto').onclick=()=>pickPhoto({studentId:s.id});const rp=document.getElementById('removeProfilePhoto');if(rp)rp.onclick=()=>{if(confirm('Profilfoto dieses Schülers löschen?')){s.photo='';saveState();renderStudent(s.id,u?.id)}};document.getElementById('studentUnit').onchange=e=>{route.unitId=e.target.value;renderStudent(s.id,e.target.value)};bindRatings();if(u){view.querySelectorAll('[data-rating-note]').forEach(el=>{el.onchange=()=>{const rr=getRecord(s.id,u.id);rr.ratingNotes=rr.ratingNotes||{};rr.ratingNotes[el.dataset.ratingNote]=el.value;saveState()}});['topicOverride','arrive','leave','absenceOverride','comment'].forEach(id=>{document.getElementById(id).onchange=()=>{const rr=getRecord(s.id,u.id);rr[id]=document.getElementById(id).value;saveState();renderStudent(s.id,u.id)}});document.getElementById('present').onchange=e=>{r.present=e.target.checked;if(r.present){r.absent=false;r.absenceOverride='';r.arrive='';r.leave=''}saveState();renderStudent(s.id,u.id)};document.getElementById('absent').onchange=e=>{r.absent=e.target.checked;if(r.absent){r.present=false;r.absenceOverride='';r.arrive='';r.leave=''}saveState();renderStudent(s.id,u.id)};const awp=document.getElementById('addWorkPhoto');if(awp)awp.onclick=()=>pickPhoto({studentId:s.id,unitId:u.id,type:'work'});document.querySelectorAll('[data-work-photo]').forEach(img=>img.onclick=()=>openImageModal(img.src));document.querySelectorAll('[data-remove-work-photo]').forEach(btn=>btn.onclick=()=>removeWorkPhoto(s.id,u.id,Number(btn.dataset.removeWorkPhoto)));}['strengths','supportNeed','supportGoal','studentNotes'].forEach(id=>document.getElementById(id).onchange=()=>{if(id==='studentNotes')s.notes=document.getElementById(id).value;else s[id]=document.getElementById(id).value;saveState()})}

function renderCurriculum(cid){const c=cls(cid),items=state.curriculum[cid]||[],units=classUnits(cid),assigned=items.filter(x=>x.unitId).length;state.curriculum[cid]=items;view.innerHTML=`<div class="view-header"><div><h2>Gesamtstoff · ${escapeHtml(c.code)}</h2><div class="sub">Stoff laden, automatisch auf Ausbildungsblöcke verteilen oder manuell zuordnen</div></div><div class="toolbar"><button class="btn secondary" id="backClass">Klasse</button><button class="btn" id="importCurr">Datei laden</button><button class="btn" id="pasteCurr">Text einfügen</button><button class="btn" id="addCurr">+ Stoffpunkt</button><button class="btn" id="autoCurr">Automatisch verteilen</button><button class="btn secondary" id="clearCurr">Zuordnung leeren</button></div></div><div class="section-card"><div class="kpi-line"><span class="pill">${items.length} Stoffpunkte</span><span class="pill">${assigned} zugeordnet</span><span class="pill">${units.length} Ausbildungsblöcke</span><span class="pill">${scheduleUE(c.scheduleKey).toFixed(0)} UE je Block</span></div><div class="progress" style="margin-top:10px"><span style="width:${items.length?assigned/items.length*100:0}%"></span></div></div><div class="section-card"><div class="curriculum-row"><b>Stoffpunkt</b><b>UE</b><b>Ausbildungsblock</b><b></b></div>${items.length?items.map(i=>`<div class="curriculum-row" data-ci="${i.id}"><input data-title="${i.id}" value="${escapeHtml(i.title)}"><input data-ue="${i.id}" type="number" min="0.5" step="0.5" value="${i.ue||1}"><select data-unit="${i.id}"><option value="">nicht zugeordnet</option>${units.map(u=>`<option value="${u.id}" ${i.unitId===u.id?'selected':''}>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</option>`).join('')}</select><button class="btn danger" data-del="${i.id}">Löschen</button></div>`).join(''):'<p class="muted">Noch kein Gesamtstoff vorhanden.</p>'}</div><div class="section-card"><h3>Ausbildungsblöcke</h3>${units.map(u=>{const its=items.filter(i=>i.unitId===u.id);return `<div class="schedule-block"><div><b>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</b><div class="small">${escapeHtml(u.topic||'')}</div></div><div>${its.reduce((a,i)=>a+Number(i.ue||1),0).toFixed(1)} / ${scheduleUE(c.scheduleKey).toFixed(1)} UE</div></div>`}).join('')}</div>`;
 document.getElementById('backClass').onclick=()=>{route={type:'class',classId:cid};render()};document.getElementById('importCurr').onclick=()=>{activeCurriculumClassId=cid;document.getElementById('curriculumImport').click()};document.getElementById('pasteCurr').onclick=()=>pasteCurriculumDialog(cid);document.getElementById('addCurr').onclick=()=>{items.push({id:uid('cur'),title:'Neuer Stoffpunkt',ue:1,notes:'',unitId:''});saveState();renderCurriculum(cid)};document.getElementById('autoCurr').onclick=()=>autoDistributeCurriculum(cid);document.getElementById('clearCurr').onclick=()=>{items.forEach(i=>i.unitId='');rebuildUnitTopics(cid);saveState();renderCurriculum(cid)};view.querySelectorAll('[data-title]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.title).title=x.value;rebuildUnitTopics(cid);saveState()});view.querySelectorAll('[data-ue]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.ue).ue=Number(x.value)||1;saveState();renderCurriculum(cid)});view.querySelectorAll('[data-unit]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.unit).unitId=x.value;rebuildUnitTopics(cid);saveState();renderCurriculum(cid)});view.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{state.curriculum[cid]=items.filter(i=>i.id!==x.dataset.del);rebuildUnitTopics(cid);saveState();renderCurriculum(cid)})}
function rebuildUnitTopics(cid){const items=state.curriculum[cid]||[];classUnits(cid).forEach(u=>{const titles=items.filter(i=>i.unitId===u.id).map(i=>i.title.trim()).filter(Boolean);if(titles.length)u.topic=titles.join(' · ')})}
function autoDistributeCurriculum(cid){const c=cls(cid),items=state.curriculum[cid]||[],units=classUnits(cid);if(!units.length){alert('Bitte zuerst Unterrichtseinheiten anlegen.');return}const cap=scheduleUE(c.scheduleKey);let ix=0,used=0;items.forEach(i=>{let need=Math.max(.5,Number(i.ue)||1);if(ix>=units.length){i.unitId='';return}if(used>0&&used+need>cap){ix++;used=0}if(ix>=units.length){i.unitId='';return}i.unitId=units[ix].id;used+=need;if(used>=cap){ix++;used=0}});rebuildUnitTopics(cid);saveState();renderCurriculum(cid)}
function pasteCurriculumDialog(cid){openModal(`<h2>Gesamtstoff einfügen</h2><p>Eine Zeile = ein Stoffpunkt. Optional kann am Zeilenende <b>; UE</b> angegeben werden, z. B. <code>Gerades Eckblatt; 3</code>.</p><div class="field"><label>Stoff</label><textarea id="currText" style="min-height:280px"></textarea></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="currSave">Übernehmen</button></div>`);document.getElementById('currSave').onclick=()=>{const arr=document.getElementById('currText').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);state.curriculum[cid]=(state.curriculum[cid]||[]).concat(arr.map(line=>{const p=line.split(';');return{id:uid('cur'),title:p[0].trim(),ue:Number((p[1]||'1').replace(',','.'))||1,notes:'',unitId:''}}));saveState();closeModal();renderCurriculum(cid)}}
async function importCurriculumFile(file){const cid=activeCurriculumClassId;if(!cid)return;const text=await file.text();let items=[];if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);items=(Array.isArray(data)?data:data.items||[]).map(x=>({id:uid('cur'),title:x.title||x.thema||x.stoff||'',ue:Number(x.ue||x.stunden||1)||1,notes:x.notes||x.notiz||'',unitId:''})).filter(x=>x.title)}else if(file.name.toLowerCase().endsWith('.csv')){const lines=text.split(/\r?\n/).filter(Boolean),delim=lines[0].includes(';')?';':',';const head=lines.shift().split(delim).map(x=>x.trim().toLowerCase());items=lines.map(line=>{const p=line.split(delim).map(x=>x.trim().replace(/^"|"$/g,'')),o={};head.forEach((h,i)=>o[h]=p[i]||'');return{id:uid('cur'),title:o.thema||o.stoff||o.topic||o.titel||p[0],ue:Number((o.ue||o.stunden||o.hours||'1').replace(',','.'))||1,notes:o.notiz||o.notes||'',unitId:''}}).filter(x=>x.title)}else{items=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>({id:uid('cur'),title:x,ue:1,notes:'',unitId:''}))}state.curriculum[cid]=(state.curriculum[cid]||[]).concat(items);saveState();renderCurriculum(cid);alert(`${items.length} Stoffpunkte geladen.`)}

function unitDialog(cid,unitId,gid){
 const u=state.units.find(x=>x.id===unitId);if(u&&u.groupId!==gid)return alert('Diese Einheit gehört zu einer anderen Gruppe.');
 const returningOverview=route.type==='unitOverview';
 openModal(`<h2>${u?'Einheit bearbeiten':'Einheit anlegen'}</h2><div class="form-grid"><div class="field"><label>Datum</label><input id="mDate" type="date" value="${u?.date||new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Globaler Stoff</label><input id="mTopic" value="${escapeHtml(u?.topic||'')}"></div><div class="field"><label>Meine Ankunft</label><input id="mTeacherArrive" type="time" value="${u?.teacherArrive||''}"></div><div class="field"><label>Mein Ende</label><input id="mTeacherLeave" type="time" value="${u?.teacherLeave||''}"></div></div><div class="field"><label>Notiz</label><textarea id="mNotes">${escapeHtml(u?.notes||'')}</textarea></div><div class="field"><label><input type="checkbox" id="mShowNotes" ${u?.showNotesInOverview?'checked':''}> Notiz in der Gruppenübersicht anzeigen</label></div><div class="field"><label>Abweichende Unterrichtszeiten nur für diese Einheit (optional)</label><label><input type="checkbox" id="mUnitCustomTime" ${u?.scheduleBlocks?'checked':''}> Individuelle Zeitblöcke</label><div id="unitTimeEditor" style="display:${u?.scheduleBlocks?'block':'none'}">${timeBlockEditor(u?.scheduleBlocks||classSchedule(cls(cid)).blocks,'unitTimeBlocks')}</div></div>${u?`<div class="modal-actions"><button class="btn secondary" id="mUnitMaterials">Speichern und Skriptseiten / Fotos / Skizzen öffnen</button></div>`:''}<div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="mSave">Speichern</button></div>`);
 bindBlockEditor('unitTimeBlocks');document.getElementById('mUnitCustomTime').onchange=e=>document.getElementById('unitTimeEditor').style.display=e.target.checked?'block':'none';
 function commit(openMaterials=false){
  const date=document.getElementById('mDate').value;
  if(!date)return alert('Bitte ein gültiges Datum auswählen.');
  const data={date,topic:document.getElementById('mTopic').value.trim()||'Einheit',notes:document.getElementById('mNotes').value,showNotesInOverview:document.getElementById('mShowNotes').checked,teacherArrive:document.getElementById('mTeacherArrive').value,teacherLeave:document.getElementById('mTeacherLeave').value};
  if(document.getElementById('mUnitCustomTime').checked){const b=readBlockEditor('unitTimeBlocks');if(!validBlocks(b))return alert('Ungültige Unterrichtszeiten');data.scheduleBlocks=b}else data.scheduleBlocks=null;
  let target=u;if(target)Object.assign(target,data);else{target={id:uid('unit'),classId:cid,groupId:gid,...data};state.units.push(target)}
  // Keep unit ID stable: state.unitLinks and PDF page annotations are keyed by this ID.
  saveState();closeModal();
  if(openMaterials){route={type:'group',classId:cid,groupId:gid,unitId:target.id};render();mediaUnitDialog(cid,target.id);return}
  route=returningOverview?{type:'unitOverview',classId:cid,groupId:gid}:{type:'group',classId:cid,groupId:gid,unitId:target.id};render();
 }
 document.getElementById('mSave').onclick=()=>commit(false);
 if(u)document.getElementById('mUnitMaterials').onclick=()=>commit(true);
}
function renderUnitOverview(cid,gid){
 const c=cls(cid),g=c?.groups.find(x=>x.id===gid);if(!c||!g)return;
 const units=classUnits(cid,gid);
 view.innerHTML=`<div class="view-header"><div><h2>Einheitenübersicht · ${escapeHtml(c.code)} / ${escapeHtml(g.name)}</h2><div class="sub">${units.length} aktive Einheiten · Mehrfachauswahl für gemeinsame Änderungen</div></div><div class="toolbar"><button class="btn secondary" id="uoBack">Zur Gruppe</button><button class="btn" id="uoAdd">+ Einheit</button><button class="btn secondary" id="uoCopy">Aus Gruppe kopieren</button></div></div><div class="section-card"><div class="toolbar" style="flex-wrap:wrap"><label><input type="checkbox" id="uoAll"> Alle auswählen</label><button class="btn secondary" id="uoBatch" disabled>Ausgewählte bearbeiten</button><button class="btn danger" id="uoDelete" disabled>Ausgewählte löschen</button><button class="btn secondary" id="uoArchive">Archiv</button></div><div class="table-wrap"><table><thead><tr><th>Auswahl</th><th>Datum</th><th>Stoff</th><th>Notiz</th><th>PDF-Seiten / Dateien</th><th>Aktion</th></tr></thead><tbody>${units.map(u=>`<tr><td><input type="checkbox" data-uo-select="${u.id}" aria-label="Einheit auswählen"></td><td>${fmtDate(u.date)}</td><td>${escapeHtml(u.topic||'')}</td><td>${escapeHtml(u.notes||'').slice(0,100)}</td><td>${(state.unitLinks?.[u.id]||[]).length} Zuordnung(en)</td><td><button class="btn secondary" data-uo-edit="${u.id}">Bearbeiten</button> <button class="btn secondary" data-uo-open="${u.id}">Öffnen</button></td></tr>`).join('')}</tbody></table></div></div>`;
 const selected=()=>[...view.querySelectorAll('[data-uo-select]:checked')].map(x=>x.dataset.uoSelect);
 const refresh=()=>{const n=selected().length;view.querySelector('#uoBatch').disabled=!n;view.querySelector('#uoDelete').disabled=!n};
 view.querySelector('#uoBack').onclick=()=>{route={type:'group',classId:cid,groupId:gid};render()};
 view.querySelector('#uoAdd').onclick=()=>unitDialog(cid,null,gid);
 view.querySelector('#uoCopy').onclick=()=>copyUnitDialog(cid,gid);
 view.querySelector('#uoArchive').onclick=()=>archivedUnitsDialog(cid,gid);
 view.querySelector('#uoAll').onchange=e=>{view.querySelectorAll('[data-uo-select]').forEach(x=>x.checked=e.target.checked);refresh()};
 view.querySelectorAll('[data-uo-select]').forEach(x=>x.onchange=refresh);
 view.querySelectorAll('[data-uo-edit]').forEach(x=>x.onclick=()=>unitDialog(cid,x.dataset.uoEdit,gid));
 view.querySelectorAll('[data-uo-open]').forEach(x=>x.onclick=()=>{route={type:'group',classId:cid,groupId:gid,unitId:x.dataset.uoOpen};render()});
 view.querySelector('#uoBatch').onclick=()=>batchUnitDialog(cid,gid,selected());
 view.querySelector('#uoDelete').onclick=()=>batchDeleteUnits(cid,gid,selected());
}
function batchUnitDialog(cid,gid,ids){
 if(!ids.length)return;
 openModal(`<h2>${ids.length} Einheiten gemeinsam bearbeiten</h2><p>Nur aktivierte Felder werden geändert. PDF-Seitenzuweisungen, Bewertungen und Anwesenheiten bleiben unverändert.</p><div class="field"><label><input type="checkbox" id="buTopicOn"> Stoff ändern</label><input id="buTopic" placeholder="Neuer Stoff"></div><div class="field"><label><input type="checkbox" id="buNotesOn"> Notiz ändern</label><textarea id="buNotes"></textarea></div><div class="field"><label><input type="checkbox" id="buVisibleOn"> Anzeige der Notizen ändern</label><label><input type="checkbox" id="buVisible"> Notiz in Übersicht anzeigen</label></div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Abbrechen</button><button class="btn" id="buSave">Änderungen speichern</button></div>`);
 document.getElementById('buSave').onclick=()=>{
  const changeTopic=document.getElementById('buTopicOn').checked,changeNotes=document.getElementById('buNotesOn').checked,changeVisible=document.getElementById('buVisibleOn').checked;
  if(!changeTopic&&!changeNotes&&!changeVisible)return alert('Bitte mindestens ein Feld zur Änderung auswählen.');
  const topic=document.getElementById('buTopic').value.trim(),notes=document.getElementById('buNotes').value,visible=document.getElementById('buVisible').checked;
  if(changeTopic&&!topic)return alert('Bitte einen Stoff eingeben.');
  ids.forEach(id=>{const u=state.units.find(x=>x.id===id&&x.classId===cid&&x.groupId===gid&&!x.archived);if(!u)return;if(changeTopic)u.topic=topic;if(changeNotes)u.notes=notes;if(changeVisible)u.showNotesInOverview=visible});
  saveState();closeModal();renderUnitOverview(cid,gid);
 };
}
function batchDeleteUnits(cid,gid,ids){
 const units=ids.map(id=>state.units.find(x=>x.id===id&&x.classId===cid&&x.groupId===gid&&!x.archived)).filter(Boolean);if(!units.length)return;
 const protectedUnits=units.filter(unitHasData),plain=units.filter(u=>!unitHasData(u));
 if(protectedUnits.length){
  openModal(`<h2>${units.length} Einheiten entfernen</h2><div class="notice">${protectedUnits.length} Einheiten enthalten Schülerdaten, PDF-Seitenzuweisungen oder andere Einträge. Archivieren wird empfohlen.</div><div class="modal-actions"><button class="btn secondary" onclick="closeModal()">Abbrechen</button><button class="btn" id="bdArchive">Alle archivieren</button><button class="btn danger" id="bdDelete">Endgültig löschen …</button></div>`);
  document.getElementById('bdArchive').onclick=()=>{units.forEach(u=>u.archived=true);saveState();closeModal();renderUnitOverview(cid,gid)};
  document.getElementById('bdDelete').onclick=()=>{const answer=prompt(`WARNUNG: ${units.length} Einheiten inklusive zugehöriger Daten endgültig löschen. Zur Bestätigung LÖSCHEN eingeben:`);if(answer!=='LÖSCHEN')return;units.forEach(u=>permanentlyDeleteUnit(cid,gid,u));closeModal();route={type:'unitOverview',classId:cid,groupId:gid};render()};
 }else if(confirm(`${plain.length} ausgewählte Einheiten ohne erfasste Daten löschen?`)){plain.forEach(u=>permanentlyDeleteUnit(cid,gid,u));route={type:'unitOverview',classId:cid,groupId:gid};render()}
}

function scheduleDialog(cid){
 const c=cls(cid),blocks=(c.scheduleBlocks||classSchedule(c).blocks).map(b=>[...b]);
 openModal(`<h2>Unterrichtszeiten · ${escapeHtml(c.code)}</h2><div class="field"><label>Zeitmodell</label><select id="mSchedule">${Object.entries(SCHEDULES).map(([k,v])=>`<option value="${k}" ${c.scheduleKey===k?'selected':''}>${escapeHtml(v.label)}</option>`).join('')}</select></div><p><b>Unterrichtsblöcke individuell bearbeiten</b></p>${timeBlockEditor(blocks,'classTimeBlocks')}<p id="timeTotal"></p><div class="notice">Pausen werden nicht gezählt. 1 UE = 50 Minuten. Änderungen an Unterrichtszeiten können Fehlstunden rückwirkend verändern. Vor dem Speichern wird eine Bestätigung verlangt.</div><div class="modal-actions"><button class="btn secondary" id="resetTimeModel">Zeitmodell übernehmen</button><button class="btn" id="mSave">Speichern</button></div>`);
 bindBlockEditor('classTimeBlocks');
 const show=()=>{const b=readBlockEditor('classTimeBlocks');document.getElementById('timeTotal').textContent=validBlocks(b)?`Unterricht: ${(b.reduce((a,[x,y])=>a+mins(y)-mins(x),0)/50).toFixed(2)} UE`:'Bitte gültige, nicht überlappende Zeitblöcke eingeben.'};
 document.getElementById('classTimeBlocks').addEventListener('input',show);show();
 document.getElementById('resetTimeModel').onclick=()=>{const b=SCHEDULES[document.getElementById('mSchedule').value].blocks;document.getElementById('classTimeBlocks').innerHTML=b.map(([a,z])=>`<div class="schedule-block"><input type="time" value="${a}"> – <input type="time" value="${z}"><button type="button" class="btn secondary" data-del-block>Entfernen</button></div>`).join('');refreshBlockPauses('classTimeBlocks');show()};
 document.getElementById('mSave').onclick=()=>{const b=readBlockEditor('classTimeBlocks');if(!validBlocks(b))return alert('Ungültige oder überlappende Zeitblöcke.');if(!confirm('Unterrichtszeiten speichern? Vorhandene Fehlstunden können neu berechnet werden.'))return;c.scheduleKey=document.getElementById('mSchedule').value;c.scheduleBlocks=b;saveState();closeModal();render()};
}

function addClassDialog(){openModal(`<h2>Klasse hinzufügen</h2><div class="form-grid"><div class="field"><label>Klassenbezeichnung</label><input id="mCode" placeholder="2.BTD"></div><div class="field"><label>Unterrichtszeiten</label><select id="mSchedule">${Object.entries(SCHEDULES).map(([k,v])=>`<option value="${k}">${escapeHtml(v.label)}</option>`).join('')}</select></div></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="mSave">Anlegen</button></div>`);document.getElementById('mSave').onclick=()=>{const code=document.getElementById('mCode').value.trim();if(code){const id=uid('class');state.classes.push({id,yearId:state.activeYear,code,label:code,scheduleKey:document.getElementById('mSchedule').value,groups:[{id:uid('grp'),name:'Gruppe 1'}]});state.curriculum[id]=[];saveState();closeModal();route={type:'class',classId:id};render()}}}
function addGroupDialog(cid){openModal(`<h2>Gruppe hinzufügen</h2><div class="field"><label>Name</label><input id="mGroup" value="Gruppe ${cls(cid).groups.length+1}"></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="mSave">Anlegen</button></div>`);document.getElementById('mSave').onclick=()=>{const n=document.getElementById('mGroup').value.trim();if(n)cls(cid).groups.push({id:uid('grp'),name:n});saveState();closeModal();render()}}
function addStudentDialog(cid){const c=cls(cid);openModal(`<h2>Schüler hinzufügen</h2><div class="form-grid"><div class="field"><label>Name</label><input id="mName"></div><div class="field"><label>Gruppe</label><select id="mGroup">${c.groups.map(g=>`<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('')}</select></div></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="mSave">Anlegen</button></div>`);document.getElementById('mSave').onclick=()=>{const name=document.getElementById('mName').value.trim();if(name){state.students.push({id:uid('stu'),classId:cid,groupId:document.getElementById('mGroup').value,name,photo:'',notes:'',strengths:'',supportNeed:'',supportGoal:''});saveState();closeModal();render()}}}
function confirmDeleteStudent(id){if(confirm('Schüler wirklich löschen? Bewertungen und Profilfoto werden ebenfalls entfernt.')){state.students=state.students.filter(s=>s.id!==id);Object.keys(state.records).filter(k=>k.startsWith(id+'::')).forEach(k=>delete state.records[k]);saveState();route={type:'dashboard'};render()}}

function pickPhoto(target){activePhotoTarget=target;document.getElementById('photoPicker').click()}
async function processPhoto(file){if(!activePhotoTarget?.studentId)return;const data=await resizeImage(file,1000,.72);if(activePhotoTarget.type==='work'&&activePhotoTarget.unitId){const r=getRecord(activePhotoTarget.studentId,activePhotoTarget.unitId);r.workPhotos=r.workPhotos||[];r.workPhotos.push(data);saveState();renderStudent(activePhotoTarget.studentId,activePhotoTarget.unitId);return;}student(activePhotoTarget.studentId).photo=data;saveState();render()}
function removeWorkPhoto(sid,unitId,index){const r=getRecord(sid,unitId);if(!r?.workPhotos?.[index])return;if(confirm('Werkstückfoto löschen?')){r.workPhotos.splice(index,1);saveState();renderStudent(sid,unitId)}}
function openImageModal(src){openModal(`<div class="image-preview"><img src="${src}" alt="Werkstückfoto"></div><div class="modal-actions"><button class="btn" onclick="document.getElementById('modal').close()">Schließen</button></div>`)}
function resizeImage(file,max,q){return new Promise((res,rej)=>{const rd=new FileReader();rd.onload=()=>{const im=new Image();im.onload=()=>{let w=im.width,h=im.height;if(Math.max(w,h)>max){const sc=max/Math.max(w,h);w=Math.round(w*sc);h=Math.round(h*sc)}const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(im,0,0,w,h);res(c.toDataURL('image/jpeg',q))};im.onerror=rej;im.src=rd.result};rd.onerror=rej;rd.readAsDataURL(file)})}

function normalizeStudentName(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ß/g,'ss').replace(/[^a-zA-Z0-9]/g,'').toLowerCase()}
function batchPhotoDialog(cid){
 const c=cls(cid);
 openModal(`<h2>Schülerfotos importieren · ${escapeHtml(c.code)}</h2><p>Mehrere JPG/PNG/WebP auswählen. Dateinamen müssen Schülernamen enthalten, z. B. <b>Nachname Vorname.jpg</b> oder <b>Vorname Nachname.jpg</b>.</p><input id="batchPhotoFiles" type="file" accept="image/jpeg,image/png,image/webp" multiple><div id="batchPhotoMatches" class="section-card">Noch keine Fotos ausgewählt.</div><div class="notice">Nur eindeutige Treffer werden zugeordnet. Unklare Fotos bleiben unverändert. Die Fotos werden in den geschützten App-Datenbestand aufgenommen und bei der nächsten OneDrive-Synchronisierung übertragen. Kein Upload nach GitHub.</div><div class="modal-actions"><button class="btn" id="batchPhotoSave" disabled>Fotos zuordnen</button></div>`);
 let matches=[];const input=document.getElementById('batchPhotoFiles'),result=document.getElementById('batchPhotoMatches'),save=document.getElementById('batchPhotoSave');
 input.onchange=()=>{const students=classStudents(cid);matches=[...input.files].map(file=>{const name=normalizeStudentName(file.name.replace(/\.[^.]+$/,''));const found=students.filter(s=>{const parts=s.name.trim().split(/\s+/);return name===normalizeStudentName(s.name)||name===normalizeStudentName([...parts].reverse().join(' '))});return{file,student:found.length===1?found[0]:null}});result.innerHTML=matches.map(m=>`<div class="schedule-block"><span>${escapeHtml(m.file.name)}</span><span>${m.student?'✓ '+escapeHtml(m.student.name):'Keine eindeutige Zuordnung'}</span></div>`).join('');save.disabled=!matches.some(m=>m.student)};
 save.onclick=async()=>{save.disabled=true;let done=0;try{for(const m of matches){if(!m.student)continue;m.student.photo=await resizeImage(m.file,700,.75);done++}saveState();closeModal();render();alert(`${done} Schülerfotos zugeordnet. ${matches.length-done} nicht zugeordnet.`)}catch(e){alert('Fotoimport abgebrochen: '+e.message);save.disabled=false}};
}

function importDialog(){openModal(`<h2>Klassen-/Gruppenliste importieren</h2><p>CSV mit <b>Klasse;Gruppe;Name</b> oder <b>Nachname;Vorname;Klasse;Gruppe</b>.</p><div class="notice">Neue Klassen und Gruppen werden automatisch angelegt. Bestehende Schüler mit identischem Namen in derselben Klasse werden nicht doppelt importiert.</div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="chooseCsv">CSV auswählen</button></div>`);document.getElementById('chooseCsv').onclick=()=>document.getElementById('fileImport').click()}
async function importCsv(file){const text=await file.text(),lines=text.split(/\r?\n/).filter(Boolean);if(!lines.length)return;const delim=lines[0].includes(';')?';':',',head=lines.shift().split(delim).map(x=>x.trim().toLowerCase());let count=0;for(const line of lines){const p=line.split(delim).map(x=>x.trim().replace(/^"|"$/g,'')),o={};head.forEach((h,i)=>o[h]=p[i]||'');const classCode=o.klasse||o.class||'',groupName=o.gruppe||o.group||'Gruppe 1',name=o.name||[o.nachname,o.vorname].filter(Boolean).join(' ');if(!classCode||!name)continue;let c=state.classes.find(x=>x.yearId===state.activeYear&&x.code===classCode);if(!c){c={id:uid('class'),yearId:state.activeYear,code:classCode,label:classCode,scheduleKey:classCode.includes('BFS')?'BFS1':'BT12',groups:[]};state.classes.push(c);state.curriculum[c.id]=[]}let g=c.groups.find(x=>x.name===groupName);if(!g){g={id:uid('grp'),name:groupName};c.groups.push(g)}if(!state.students.some(s=>s.classId===c.id&&s.name.toLowerCase()===name.toLowerCase())){state.students.push({id:uid('stu'),classId:c.id,groupId:g.id,name,photo:'',notes:'',strengths:'',supportNeed:'',supportGoal:''});count++}}saveState();closeModal();alert(`${count} Schüler importiert.`);render()}

function settingsDialog(){
 const set=state.settings,cfg=window.HTL_CONFIG||{},redirect=cfg.redirectUri||location.origin+location.pathname;
 openModal(`<h2>Einstellungen</h2>
 <div class="form-grid">
  <div class="field"><label>Schulname</label><input id="mSchoolName" value="${escapeHtml(set.schoolName||'HTL1 Bau und Design')}"></div>
  <div class="field"><label>Lehrperson</label><input id="mTeacherName" value="${escapeHtml(set.teacherName||'')}" placeholder="Vorname Nachname"></div>
  <div class="field"><label>Schullogo (PNG, JPG, WEBP)</label><input id="mSchoolLogo" type="file" accept="image/png,image/jpeg,image/webp"><div class="small">Das Logo wird in der App gespeichert und synchronisiert. Für das installierte iPhone-Symbol ist eventuell eine Neuinstallation nötig.</div></div>
  <div class="field"><label>Logovorschau</label><img id="mLogoPreview" src="${escapeHtml(set.schoolLogo||'icon-192.png')}" alt="Logo" style="width:88px;height:88px;object-fit:contain"></div>
  <div class="field"><label>Microsoft App Client-ID</label><input id="mClient" value="${escapeHtml(set.clientId||'')}" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"></div>
  <div class="field"><label>Tenant</label><input id="mTenant" value="${escapeHtml(set.tenantId||'common')}" placeholder="common oder Tenant-ID"></div>
  <div class="field"><label>Schulbeginn</label><input id="mSchoolStart" type="date" value="${currentYear()?.schoolStart||DEFAULT_SCHOOL_START}"></div>
  <div class="field"><label>Automatische OneDrive-Synchronisierung</label><select id="mAutoSync"><option value="0" ${!set.autoSync?'selected':''}>Aus</option><option value="1" ${set.autoSync?'selected':''}>Ein</option></select></div>
 </div>
 <div class="notice"><b>OneDrive-Speicher:</b> Die App verwendet den geschützten Microsoft-App-Ordner <code>Apps/HTL Praxis</code>. Benötigte delegierte Berechtigungen: <code>User.Read</code> und <code>Files.ReadWrite.AppFolder</code>.<br><br><b>Redirect-URI für die Entra-Appregistrierung:</b><br><code>${escapeHtml(redirect)}</code></div>
 <div class="system-grid">
  <div><b>App-Version</b><br>${APP_VERSION}</div><div><b>Datenversion</b><br>${DATA_SCHEMA_VERSION}</div><div><b>Letzte Synchronisierung</b><br>${escapeHtml(state.sync?.lastSyncedAt?new Date(state.sync.lastSyncedAt).toLocaleString('de-AT'):'noch nie')}</div><div><b>Online</b><br>${navigator.onLine?'ja':'nein'}</div>
 </div>
 <div class="modal-actions"><button class="btn secondary" id="importBackup">Backup importieren</button><button class="btn secondary" id="exportBackup">Backup exportieren</button><button class="btn secondary" id="checkUpdate">Updates prüfen</button><button class="btn" id="mSave">Speichern</button></div>`);
 document.getElementById('mSchoolLogo').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{if(f.size>8*1024*1024)throw Error('Bitte ein Bild unter 8 MB auswählen.');const url=await schoolLogoFromFile(f);set.schoolLogo=url;document.getElementById('mLogoPreview').src=url;saveState();applySchoolBranding()}catch(err){alert(err.message)}};
 document.getElementById('mSave').onclick=()=>{set.schoolName=document.getElementById('mSchoolName').value.trim();set.teacherName=document.getElementById('mTeacherName').value.trim();set.clientId=document.getElementById('mClient').value.trim();set.tenantId=document.getElementById('mTenant').value.trim()||'common';set.autoSync=document.getElementById('mAutoSync').value==='1';currentYear().schoolStart=document.getElementById('mSchoolStart').value;msalApp=null;msalReadyPromise=null;saveState();applySchoolBranding();closeModal();render()};
 document.getElementById('exportBackup').onclick=exportBackup;document.getElementById('importBackup').onclick=importBackup;document.getElementById('checkUpdate').onclick=()=>checkForUpdates(false);
}
function exportBackup(){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`HTL-Praxis_Backup_${new Date().toISOString().replace(/[:.]/g,'-')}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importBackup(){const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=async()=>{if(!input.files?.[0])return;try{const data=JSON.parse(await input.files[0].text());if(!confirm('Lokalen Datenbestand durch dieses Backup ersetzen?'))return;state=migrate(data);await idbSet('state',state);closeModal();render();alert('Backup wurde geladen.')}catch(e){alert('Backup konnte nicht geladen werden: '+e.message)}};input.click()}

let msalApp=null,syncBusy=false;
const GRAPH_SCOPES=['User.Read','Files.ReadWrite.AppFolder'];
function msalConfig(){const cfg=window.HTL_CONFIG||{};return{auth:{clientId:state.settings.clientId||cfg.clientId||'',authority:`https://login.microsoftonline.com/${state.settings.tenantId||cfg.tenantId||'common'}`,redirectUri:cfg.redirectUri||location.origin+location.pathname},cache:{cacheLocation:'localStorage'}}}
// iOS home-screen apps cannot reliably open MSAL popups. Use full-page redirect there.
function isStandaloneIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)&& (navigator.standalone===true || window.matchMedia('(display-mode: standalone)').matches)}
let msalReadyPromise=null;
async function readyMsal(){if(!msalReadyPromise){msalReadyPromise=(async()=>{const app=new msal.PublicClientApplication(msalConfig());await app.initialize?.();await app.handleRedirectPromise();msalApp=app;return app})().catch(e=>{msalReadyPromise=null;throw e})}return msalReadyPromise}
async function getGraphToken(interactive=true){const clientId=state.settings.clientId||(window.HTL_CONFIG||{}).clientId;if(!clientId)throw new Error('Bitte zuerst unter Einstellungen die Microsoft App Client-ID eintragen.');if(!window.msal)throw new Error('Microsoft-Anmeldemodul konnte nicht geladen werden.');const app=await readyMsal();let acc=app.getAllAccounts()[0];if(!acc){if(!interactive)throw new Error('Nicht angemeldet');if(isStandaloneIOS()){await app.loginRedirect({scopes:GRAPH_SCOPES});throw new Error('Microsoft-Anmeldung wird geöffnet. Bitte danach OneDrive erneut aufrufen.')}const r=await app.loginPopup({scopes:GRAPH_SCOPES});acc=r.account}try{return(await app.acquireTokenSilent({account:acc,scopes:GRAPH_SCOPES})).accessToken}catch(e){if(!interactive)throw e;if(isStandaloneIOS()){await app.acquireTokenRedirect({scopes:GRAPH_SCOPES,account:acc});throw new Error('Microsoft-Anmeldung wird geöffnet. Bitte danach OneDrive erneut aufrufen.')}return(await app.acquireTokenPopup({scopes:GRAPH_SCOPES,account:acc})).accessToken}}
async function graph(token,url,opts={}){const r=await fetch('https://graph.microsoft.com/v1.0'+url,{...opts,headers:{Authorization:`Bearer ${token}`,...(opts.headers||{})}});if(!r.ok){const body=await r.text();const err=new Error(`${r.status} ${body}`);err.status=r.status;throw err}const ct=r.headers.get('content-type')||'';if(r.status===204)return null;if(ct.includes('json'))return r.json();return r.text()}
async function appRoot(token){return graph(token,'/me/drive/special/approot')}
async function remoteMeta(token,rootId){try{return await graph(token,`/me/drive/items/${rootId}:/htl-praxis-data.json`)}catch(e){if(e.status===404)return null;throw e}}
async function ensureChildFolder(token,parentId,name){try{return await graph(token,`/me/drive/items/${parentId}:/${encodeURIComponent(name)}`)}catch(e){if(e.status!==404)throw e;return graph(token,`/me/drive/items/${parentId}/children`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'rename'})})}}
async function uploadJson(token,parentId,name,obj,extraHeaders={}){return graph(token,`/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`,{method:'PUT',headers:{'Content-Type':'application/json',...extraHeaders},body:JSON.stringify(obj)})}
async function downloadState(token,rootId){return graph(token,`/me/drive/items/${rootId}:/htl-praxis-data.json:/content`)}
async function makeRemoteBackup(token,rootId,remoteData){if(!remoteData)return;const b=await ensureChildFolder(token,rootId,'Backups');const stamp=new Date().toISOString().replace(/[:.]/g,'-');await uploadJson(token,b.id,`htl-praxis_${stamp}.json`,remoteData)}
// Synchronisation v7.5.5: gemeinsamer Basisstand, 3-Wege-Abgleich, bedingtes Schreiben.
// Geraetespezifische Zugangsdaten und Sync-Metadaten werden nie zusammengefuehrt.
const SYNC_BASE_KEY='sync-base-v754';
const SYNC_KEYS=['schoolYears','activeYear','classes','students','units','records','curriculum','roomPlans','roomLayouts','rooms','classRooms','groupRooms','scripts','scriptLibrary','materials','settings'];
const isPlain=o=>!!o&&typeof o==='object'&&!Array.isArray(o);
const cloneData=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
function syncData(st){const out={};for(const k of Object.keys(st||{})){if(k==='sync'||k==='version')continue;out[k]=cloneData(st[k])}if(out.settings){delete out.settings.clientId;delete out.settings.tenantId;delete out.settings.autoSync}return out}
function dataEqual(a,b){return JSON.stringify(a)===JSON.stringify(b)}
function dataFingerprint(st){return JSON.stringify(syncData(st))}
function itemArray(a){return Array.isArray(a)&&a.every(x=>isPlain(x)&&typeof x.id==='string')}
function mergeThree(base,local,remote,path,conflicts,resolutions={}){
 if(dataEqual(local,remote))return cloneData(local);
 if(dataEqual(local,base))return cloneData(remote);
 if(dataEqual(remote,base))return cloneData(local);
 if(isPlain(local)&&isPlain(remote)&&(isPlain(base)||base===undefined)){
  const result={};const keys=new Set([...Object.keys(base||{}),...Object.keys(local),...Object.keys(remote)]);
  for(const key of keys){const v=mergeThree(base?.[key],local[key],remote[key],path?path+'.'+key:key,conflicts,resolutions);if(v!==undefined)result[key]=v}return result;
 }
 if(itemArray(local)&&itemArray(remote)&&(itemArray(base)||base===undefined)){
  const b=new Map((base||[]).map(x=>[x.id,x]));const l=new Map(local.map(x=>[x.id,x]));const r=new Map(remote.map(x=>[x.id,x]));
  const ids=[...new Set([...local.map(x=>x.id),...remote.map(x=>x.id),...(base||[]).map(x=>x.id)])];
  return ids.map(id=>mergeThree(b.get(id),l.get(id),r.get(id),path+'['+id+']',conflicts,resolutions)).filter(x=>x!==undefined);
 }
 // Eine echte parallele Aenderung am selben Feld wird NICHT automatisch ueberschrieben.
 if(resolutions[path]==='local')return cloneData(local);
 if(resolutions[path]==='remote')return cloneData(remote);
 conflicts.push({path,local:cloneData(local),remote:cloneData(remote)});
 return cloneData(local);
}
function applySyncData(merged){const device={clientId:state.settings?.clientId,tenantId:state.settings?.tenantId,autoSync:state.settings?.autoSync};const oldSync=state.sync||{};state=migrate({...state,...merged,settings:{...(merged.settings||{}),...device},sync:oldSync});}
async function getSyncBase(){return await idbGet(SYNC_BASE_KEY)}
async function commitSync(remote,meta){const localPrefs={clientId:state.settings?.clientId,tenantId:state.settings?.tenantId,autoSync:state.settings?.autoSync};
 const base=syncData(remote);await idbSet(SYNC_BASE_KEY,base);
 state.sync={...(state.sync||{}),remoteETag:meta?.eTag||'',remoteModifiedAt:meta?.lastModifiedDateTime||'',lastSyncedAt:new Date().toISOString(),lastError:'',dirtySince:''};
 state.settings={...state.settings,...localPrefs};await idbSet('state',state);updateHeaderStatus();}
function syncError(e,silent){state.sync=state.sync||{};state.sync.lastError=e.message||String(e);idbSet('state',state).catch(console.warn);updateHeaderStatus();if(!silent)alert('OneDrive-Abgleich: '+state.sync.lastError)}
async function syncNow({silent=false,downloadOnly=false,resolutions={}}={}){
 if(syncBusy)return false;
 syncBusy=true;
 const before=dataFingerprint(state);
 try{
  const token=await getGraphToken(!silent),root=await appRoot(token),meta=await remoteMeta(token,root.id);
  let base=await getSyncBase();
  if(!meta){
   if(downloadOnly){if(!silent)alert('Noch kein Datenbestand in OneDrive.');return false}
   const payload=cloneData(state);payload.sync={};
   const saved=await uploadJson(token,root.id,'htl-praxis-data.json',payload,{'If-None-Match':'*'});
   if(before!==dataFingerprint(state))throw Error('Waehrend des Abgleichs wurden weitere lokale Aenderungen vorgenommen. Bitte erneut synchronisieren.');
   await commitSync(payload,saved);if(!silent){closeModal();alert('Erster OneDrive-Abgleich erfolgreich.')}return true;
  }
  if(base&&meta.eTag===state.sync?.remoteETag&&dataEqual(syncData(state),base)){
   if(!silent){closeModal();alert('Bereits aktuell – keine Aenderungen.')}return true;
  }
  const remoteRaw=await downloadState(token,root.id);const remote=migrate(cloneData(typeof remoteRaw==='string'?JSON.parse(remoteRaw):remoteRaw));
  if(before!==dataFingerprint(state))throw Error('Lokale Daten haben sich waehrend des Downloads geaendert. Bitte erneut synchronisieren.');
  const local=syncData(state),cloud=syncData(remote);
  // Upgrade from older app: unchanged remote ETag is a trustworthy common base.
  if(!base&&state.sync?.remoteETag&&state.sync.remoteETag===meta.eTag)base=cloud;
  let merged;
  if(!base){
   if(dataEqual(local,cloud))merged=cloud;
   else if(!state.sync?.dirtySince)merged=cloud;
   else{
    state.sync.lastError='Erster Abgleich: unterschiedliche lokale und Cloud-Daten ohne gemeinsamen Basisstand. Bitte Backup exportieren und die Daten manuell pruefen.';
    if(!silent)alert(state.sync.lastError);
    updateHeaderStatus();return false;
   }
  }else{
   const conflicts=[];merged=mergeThree(base,local,cloud,'',conflicts,resolutions);
   if(conflicts.length){
    state.sync.lastError=conflicts.length+' gleichzeitige Aenderung(en) am selben Datenfeld. Kein automatisches Ueberschreiben.';
    state.sync.conflicts=conflicts.map(c=>c.path);
    updateHeaderStatus();if(!silent)showSyncConflicts(conflicts,resolutions);
    return false;
   }
  }
  if(downloadOnly&& !dataEqual(local,merged)){
   if(!dataEqual(local,base||cloud)){
    if(!silent)alert('Es gibt lokale Aenderungen. Bitte „Jetzt abgleichen“ verwenden, um sie mit der Cloud zusammenzufuehren.');return false;
   }
  }
  if(dataEqual(merged,cloud)){
   applySyncData(merged);await commitSync(remote,meta);render();if(!silent){closeModal();alert('OneDrive ist aktuell. Aenderungen wurden uebernommen.')}return true;
  }
  // Cloud nur bei unveraendertem ETag ersetzen. Bei parallelem Schreibzugriff wird 412 gemeldet.
  await makeRemoteBackup(token,root.id,remoteRaw);
  const payload={...remote,...merged,sync:{}};
  const saved=await uploadJson(token,root.id,'htl-praxis-data.json',payload,{'If-Match':meta.eTag});
  if(before!==dataFingerprint(state))throw Error('Lokale Aenderung waehrend des Uploads. Cloud ist gespeichert; bitte erneut abgleichen, um die neue Aenderung zu uebernehmen.');
  applySyncData(merged);await commitSync(payload,saved);render();if(!silent){closeModal();alert('Aenderungen beider Geraete erfolgreich zusammengefuehrt.')}return true;
 }catch(e){if(e.status===412||e.status===409)e=new Error('Ein anderes Geraet hat gleichzeitig gespeichert. Nichts ueberschrieben; bitte erneut abgleichen.');syncError(e,silent);return false}
 finally{syncBusy=false}
}
function showSyncConflicts(conflicts,previous={}){
 const rows=conflicts.slice(0,40).map((c,i)=>`<div class="field"><label><code>${escapeHtml(c.path)}</code></label><select data-resolve="${i}"><option value="">Bitte entscheiden</option><option value="local">Diese Geraeteversion behalten</option><option value="remote">OneDrive-Version uebernehmen</option></select></div>`).join('');
 openModal(`<h2>Synchronisationskonflikt</h2><p>${conflicts.length} Felder wurden parallel geaendert. Waehle fuer jedes Feld die gueltige Fassung. Es wird nichts geloescht, bevor du bestaetigst.</p>${rows}${conflicts.length>40?'<p>Mehr als 40 Konflikte: Bitte zuerst Daten sichern und manuell pruefen.</p>':''}<div class="modal-actions"><button class="btn secondary" id="confBackup">Backup exportieren</button><button class="btn secondary" id="confClose">Abbrechen</button><button class="btn" id="confResolve" ${conflicts.length>40?'disabled':''}>Auswahl uebernehmen und abgleichen</button></div>`);
 document.getElementById('confBackup').onclick=exportBackup;
 document.getElementById('confClose').onclick=closeModal;
 document.getElementById('confResolve').onclick=()=>{
  const choices={...previous};for(let i=0;i<conflicts.length;i++){const value=document.querySelector(`[data-resolve="${i}"]`).value;if(!value){alert('Bitte fuer jeden Konflikt eine Fassung auswaehlen.');return}choices[conflicts[i].path]=value}
  closeModal();syncNow({silent:false,resolutions:choices});
 };
}
async function syncPull({silent=false}={}){return syncNow({silent,downloadOnly:true})}
async function syncPush({silent=false}={}){return syncNow({silent})}
function scheduleAutoSync(){if(!state?.settings?.autoSync||!navigator.onLine||syncBusy)return;clearTimeout(autoSyncTimer);autoSyncTimer=setTimeout(()=>autoSyncNow(),7000)}
async function autoSyncNow(){if(!state?.settings?.autoSync||!navigator.onLine||syncBusy)return false;return syncNow({silent:true})}
function syncDialog(){const s=state.sync||{};openModal(`<h2>OneDrive Synchronisierung</h2><p>Automatischer 3-Wege-Abgleich: Aenderungen an verschiedenen Schuelern, Einheiten und Feldern werden zusammengefuehrt. Bei gleichzeitiger Bearbeitung desselben Feldes wird sicherheitshalber angehalten.</p><div class="system-grid"><div><b>Letzter Abgleich</b><br>${escapeHtml(s.lastSyncedAt?new Date(s.lastSyncedAt).toLocaleString('de-AT'):'noch nie')}</div><div><b>Lokale Aenderungen</b><br>${s.dirtySince?'ja':'nein'}</div><div><b>Auto-Sync</b><br>${state.settings.autoSync?'ein':'aus'}</div><div><b>Status</b><br>${escapeHtml(s.lastError?'Pruefen':'bereit')}</div></div>${s.lastError?`<div class="notice error-note">${escapeHtml(s.lastError)}</div>`:''}<div class="field"><label><input type="checkbox" id="autoSyncToggle" ${state.settings.autoSync?'checked':''}> Automatisch abgleichen (bei Aenderungen und regelmaessig)</label></div><div class="modal-actions"><button class="btn secondary" id="syncBackup">Backup exportieren</button><button class="btn secondary" id="pull">Cloud laden (nur ohne lokale Aenderungen)</button><button class="btn" id="push">Jetzt abgleichen</button></div>`);
 document.getElementById('push').onclick=()=>syncNow({silent:false});document.getElementById('pull').onclick=()=>syncPull({silent:false});document.getElementById('syncBackup').onclick=exportBackup;
 document.getElementById('autoSyncToggle').onchange=e=>{state.settings.autoSync=e.target.checked;saveState();if(e.target.checked)scheduleAutoSync()};}
function updateHeaderStatus(){const el=document.getElementById('syncStatus');if(!el||!state)return;const s=state.sync||{};el.textContent=s.lastError?'OneDrive: Konflikt/Fehler':s.dirtySince?'OneDrive: lokal geaendert':s.lastSyncedAt?'OneDrive: aktuell':'OneDrive: lokal';el.className='sync-status '+(s.lastError?'bad':s.dirtySince?'':'good')}

// --- PWA Updates ---
let swRegistration=null,deferredInstallPrompt=null;
function showUpdateBanner(version){const b=document.getElementById('updateBanner');if(!b)return;document.getElementById('updateText').textContent=`Neue Version ${version||''} verfügbar`;b.hidden=false}
function hideUpdateBanner(){const b=document.getElementById('updateBanner');if(b)b.hidden=true}
async function checkForUpdates(silent=true){try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('Versionsdatei nicht erreichbar');const v=await r.json();if(v.version&&v.version!==APP_VERSION){showUpdateBanner(v.version);if(swRegistration)await swRegistration.update();if(!silent)alert(`Neue Version ${v.version} ist verfügbar.`)}else if(!silent)alert(`HTL Praxis ist aktuell (Version ${APP_VERSION}).`)}catch(e){if(!silent)alert('Updateprüfung nicht möglich: '+e.message)}}
async function applyUpdate(){if(swRegistration){await swRegistration.update();if(swRegistration.waiting){swRegistration.waiting.postMessage({type:'SKIP_WAITING'});return}const installing=swRegistration.installing;if(installing){installing.addEventListener('statechange',()=>{if(installing.state==='installed')installing.postMessage({type:'SKIP_WAITING'})});return}}location.reload()}
async function initPwa(){if(!('serviceWorker'in navigator)||location.protocol==='file:')return;try{swRegistration=await navigator.serviceWorker.register('./sw.js');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());swRegistration.addEventListener('updatefound',()=>{const w=swRegistration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)showUpdateBanner('')})});setTimeout(()=>checkForUpdates(true),2500);setInterval(()=>checkForUpdates(true),30*60*1000)}catch(e){console.warn('Service worker',e)}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('btnInstall');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('btnInstall');if(b)b.hidden=true});

// UI bindings
function bindUi(){document.getElementById('btnDashboard').onclick=()=>{route={type:'dashboard'};render()};document.getElementById('btnImport').onclick=importDialog;document.getElementById('btnSettings').onclick=settingsDialog;document.getElementById('btnSync').onclick=syncDialog;document.getElementById('btnAddClass').onclick=addClassDialog;document.getElementById('yearSelect').onchange=e=>{state.activeYear=e.target.value;saveState();route={type:'dashboard'};render()};document.getElementById('fileImport').onchange=e=>{if(e.target.files[0])importCsv(e.target.files[0]);e.target.value=''};document.getElementById('curriculumImport').onchange=e=>{if(e.target.files[0])importCurriculumFile(e.target.files[0]);e.target.value=''};document.getElementById('photoPicker').onchange=e=>{if(e.target.files[0])processPhoto(e.target.files[0]);e.target.value=''};document.getElementById('btnInstall').onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;document.getElementById('btnInstall').hidden=true}else alert('Im Browser-Menü „App installieren“ bzw. am Handy „Zum Startbildschirm hinzufügen“ wählen.')};document.getElementById('applyUpdate').onclick=applyUpdate;document.getElementById('dismissUpdate').onclick=hideUpdateBanner}
async function boot(){state=await loadState();applySchoolBranding();bindUi();render();updateHeaderStatus();await initPwa();window.addEventListener('online',()=>{updateHeaderStatus();if(state.settings.autoSync)autoSyncNow()});window.addEventListener('offline',updateHeaderStatus);window.addEventListener('focus',()=>{if(state.settings.autoSync)autoSyncNow()});setInterval(()=>{if(state.settings.autoSync&&navigator.onLine)autoSyncNow()},60000);if(state.settings.autoSync&&navigator.onLine)setTimeout(()=>autoSyncNow(),1500)}
boot();


// School logo is kept small so OneDrive state sync stays manageable.
async function schoolLogoFromFile(file){
 const bitmap=await createImageBitmap(file);const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,512,512);const factor=Math.min(512/bitmap.width,512/bitmap.height);const w=bitmap.width*factor,h=bitmap.height*factor;ctx.drawImage(bitmap,(512-w)/2,(512-h)/2,w,h);bitmap.close?.();return canvas.toDataURL('image/png');
}
let schoolManifestUrl=null;
function applySchoolBranding(){
 const settings=state?.settings||{};const logo=settings.schoolLogo;const name=settings.schoolName||'HTL1 Bau und Design';
 const eyebrow=document.querySelector('.topbar .eyebrow');if(eyebrow)eyebrow.textContent=name;
 if(!logo)return;
 let favicon=document.querySelector('link[rel=icon]');if(!favicon){favicon=document.createElement('link');favicon.rel='icon';document.head.append(favicon)}favicon.href=logo;
 let touch=document.querySelector('link[rel=apple-touch-icon]');if(!touch){touch=document.createElement('link');touch.rel='apple-touch-icon';document.head.append(touch)}touch.href=logo;
 const manifest=document.querySelector('link[rel=manifest]');if(manifest){
  if(schoolManifestUrl)URL.revokeObjectURL(schoolManifestUrl);
  const data={id:'./',name:'HTL Praxis',short_name:'HTL Praxis',start_url:'./?source=pwa',scope:'./',display:'standalone',theme_color:'#233747',background_color:'#f4f6f7',icons:[{src:logo,sizes:'512x512',type:'image/png',purpose:'any'}]};
  schoolManifestUrl=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/manifest+json'}));manifest.href=schoolManifestUrl;
 }
}
