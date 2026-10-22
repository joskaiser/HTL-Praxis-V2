'use strict';

const APP_VERSION='7.5.43';
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
 const cfg=window.HTL_CONFIG||{};const st={version:DATA_SCHEMA_VERSION,ratingScale10Migrated:true,schoolYears:[{id:'2026-27',label:'2026/27',schoolStart:DEFAULT_SCHOOL_START}],activeYear:'2026-27',classes:[],students:[],units:[],records:{},curriculum:{},sync:{lastSyncedAt:'',remoteETag:'',remoteModifiedAt:'',lastError:'',dirtySince:''},settings:{clientId:cfg.clientId||'',tenantId:cfg.tenantId||'common',autoSync:false,oneDriveFolder:'HTL-Praxis',rubrics:RUBRICS}};
 const addClass=(code,groups,units,scheduleKey)=>{const cid=uid('class');const c={id:cid,yearId:'2026-27',code,label:code,scheduleKey,groups:Object.keys(groups).map(n=>({id:uid('grp'),name:n}))};st.classes.push(c);Object.entries(groups).forEach(([g,names])=>{const gid=c.groups.find(x=>x.name===g).id;names.forEach(name=>st.students.push({id:uid('stu'),classId:cid,groupId:gid,name,photo:'',notes:'',strengths:'',supportNeed:'',supportGoal:''}))});c.groups.forEach(g=>units.forEach(([date,topic])=>st.units.push({id:uid('unit'),classId:cid,groupId:g.id,date,topic,notes:'',teacherArrive:'',teacherLeave:''})));st.curriculum[cid]=[]};
 addClass('1.BTD',initialBTD,btdUnits,'BT12'); addClass('1.BFS',initialBFS,bfsUnits,'BFS1'); return st;
}
function migrate(old){
 if(!old||!old.version)return makeInitialState();
 old.curriculum=old.curriculum||{};old.settings=old.settings||{};old.settings.rubrics=old.settings.rubrics||RUBRICS;old.settings.tenantId=old.settings.tenantId||'common';old.settings.autoSync=!!old.settings.autoSync;old.sync=old.sync||{lastSyncedAt:'',remoteETag:'',remoteModifiedAt:'',lastError:'',dirtySince:''};old.sync.dirtySince=old.sync.dirtySince||(!old.sync.lastSyncedAt?new Date().toISOString():'');
 old.classes.forEach(c=>{if(!c.scheduleKey)c.scheduleKey=c.code.includes('BFS')?'BFS1':'BT12';old.curriculum[c.id]=old.curriculum[c.id]||[]});old.units.forEach(u=>{u.teacherArrive=u.teacherArrive||'';u.teacherLeave=u.teacherLeave||''});Object.values(old.records||{}).forEach(r=>{r.absent=!!r.absent;delete r.present;r.absenceOverride=r.absenceOverride??'';if(!Array.isArray(r.workPhotos))r.workPhotos=[];r.ratingNotes=r.ratingNotes||{}});
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
 // Einmalige, markierte Umstellung: alte Bewertungen bleiben proportional erhalten.
 if(!old.ratingScale10Migrated){
  Object.values(old.records||{}).forEach(r=>{Object.keys(r.ratings||{}).forEach(k=>{const v=Number(r.ratings[k]);if(Number.isFinite(v)&&v>=1&&v<=10)r.ratings[k]=Math.round(v*2.5*10)/10})});
  if(old.gradeThresholds)Object.keys(old.gradeThresholds).forEach(k=>{old.gradeThresholds[k]=old.gradeThresholds[k].map(v=>Math.round(Number(v)*2.5*100)/100)});
  old.ratingScale10Migrated=true;
 }
 old.version=DATA_SCHEMA_VERSION;return old;
}
function openDb(){return new Promise((resolve,reject)=>{const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{const db=r.result;if(!db.objectStoreNames.contains(DB_STORE))db.createObjectStore(DB_STORE)};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbGet(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readonly'),r=tx.objectStore(DB_STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function idbSet(key,val){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(DB_STORE,'readwrite');tx.objectStore(DB_STORE).put(val,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}
async function loadState(){try{const idb=await idbGet('state');if(idb)return migrate(idb);const raw=localStorage.getItem(STORAGE_KEY)||localStorage.getItem(OLD_STORAGE_KEY);if(raw){const st=migrate(JSON.parse(raw));await idbSet('state',st);return st}return makeInitialState()}catch(e){console.warn('State load failed',e);return makeInitialState()}}
let state=null,route={type:'dashboard'},activePhotoTarget=null,activeCurriculumClassId=null,saveTimer=null,autoSyncTimer=null;
function editingInProgress(){const el=document.activeElement;return !!(el&&el.matches('input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]')&& (view.contains(el)||modal.contains(el)));}
function renderAfterSync(){if(editingInProgress())return;render();}
function saveState(){if(!state)return;if(!syncBusy){state.sync=state.sync||{};state.sync.dirtySince=state.sync.dirtySince||new Date().toISOString()}clearTimeout(saveTimer);saveTimer=setTimeout(()=>idbSet('state',state).catch(e=>console.warn('IndexedDB save failed',e)),50);renderNav();scheduleAutoSync()}
function cls(id){return state.classes.find(x=>x.id===id)}
function student(id){return state.students.find(x=>x.id===id)}
function classStudents(cid){return state.students.filter(s=>s.classId===cid)}
function groupStudents(cid,gid){return state.students.filter(s=>s.classId===cid&&s.groupId===gid)}
function classUnits(cid,gid=null){return state.units.filter(u=>u.classId===cid&&!u.archived&&(!gid||u.groupId===gid)).sort((a,b)=>a.date.localeCompare(b.date))}
function recKey(sid,uid){return `${sid}::${uid}`}
function getRecord(sid,uid,create=true){const k=recKey(sid,uid);if(!state.records[k]&&create)state.records[k]={ratings:{},absent:false,absenceOverride:'',arrive:'',leave:'',arriveReason:'',leaveReason:'',topicOverride:'',comment:'',ratingNotes:{},ratingPhotos:{},ratingDocuments:{},workPhotos:[],workDocuments:[]};const r=state.records[k]||null;if(r){r._unitId=uid;r._studentId=sid}if(r&&!Array.isArray(r.workPhotos))r.workPhotos=[];if(r&&!r.ratingNotes)r.ratingNotes={};if(r&&!r.ratingDocuments)r.ratingDocuments={};if(r&&!Array.isArray(r.workDocuments))r.workDocuments=[];return r}
function currentUnit(cid,gid=null){const us=classUnits(cid,gid),today=new Date().toISOString().slice(0,10);return [...us].reverse().find(u=>u.date<=today)||us[0]}
function studentAvg(sid){const vals=Object.entries(state.records).filter(([k])=>k.startsWith(sid+'::')).map(([,r])=>r.absent?null:r.ratings?.Lehrer).filter(v=>Number.isFinite(v)&&v>=1&&v<=10);return average(vals)}

function calcMissedUE(c,r,sid=null,unitId=null){if(!c||!r)return 0;if(r.absenceOverride!==''&&r.absenceOverride!=null&&!Number.isNaN(Number(r.absenceOverride)))return Number(r.absenceOverride);const unit=state.units.find(u=>u.id===(unitId||r._unitId)),group=state.students.find(s=>s.id===(sid||r._studentId))?.groupId;const g=c.groups?.find(x=>x.id===group);const sch=classSchedule(c,unit,g),total=classScheduleMinutes(c,unit,g);if(r.absent)return total/50;const first=mins(sch.blocks[0][0]),last=mins(sch.blocks.at(-1)[1]);const a=r.arrive?mins(r.arrive):first,l=r.leave?mins(r.leave):last;let present=0;sch.blocks.forEach(([s,e])=>{const bs=mins(s),be=mins(e);present+=Math.max(0,Math.min(l,be)-Math.max(a,bs))});return Math.max(0,total-present)/50}
function totalAbsence(sid){const s=student(sid),c=cls(s?.classId);return Object.entries(state.records).filter(([k])=>k.startsWith(sid+'::')).reduce((a,[k,r])=>a+calcMissedUE(c,r,sid,k.split('::')[1]),0)}
function teacherPresence(c,u){const sch=classSchedule(c,u),total=classScheduleMinutes(c,u);if(!u)return{present:0,total,ue:0,totalUE:total/50};const first=mins(sch.blocks[0][0]),last=mins(sch.blocks.at(-1)[1]);const a=u.teacherArrive?mins(u.teacherArrive):first,l=u.teacherLeave?mins(u.teacherLeave):last;let p=0;sch.blocks.forEach(([s,e])=>{p+=Math.max(0,Math.min(l,mins(e))-Math.max(a,mins(s)))});return{present:p,total,ue:p/50,totalUE:total/50}}

const view=document.getElementById('view'),modal=document.getElementById('modal');
function openModal(html){if(modal.open)modal.close();modal.innerHTML=`<div class="modal-body"><button type="button" class="modal-close" aria-label="Fenster schließen" title="Schließen">×</button>${html}<div class="modal-footer-close"><button type="button" class="btn secondary" data-close-modal>Schließen</button></div></div>`;modal.querySelector(".modal-close").onclick=closeModal;modal.querySelector("[data-close-modal]").onclick=closeModal;modal.showModal()}
function closeModal(){if(modal.open)modal.close()}
modal.addEventListener("click",e=>{if(e.target===modal && !modal.classList.contains("general-movable-dialog"))closeModal()});
// Checklist windows close only through their explicit close control.
modal.addEventListener("cancel",e=>{if(modal.classList.contains("general-movable-dialog"))e.preventDefault()});
function renderNav(){const ys=document.getElementById('yearSelect');ys.innerHTML=state.schoolYears.map(y=>`<option value="${y.id}" ${y.id===state.activeYear?'selected':''}>${escapeHtml(y.label)}</option>`).join('');const nav=document.getElementById('classNav');nav.innerHTML=state.classes.filter(c=>c.yearId===state.activeYear).map(c=>`<button class="nav-button ${route.classId===c.id?'active':''}" data-class="${c.id}">${escapeHtml(c.code)}</button>`).join('');nav.querySelectorAll('[data-class]').forEach(b=>b.onclick=()=>{route={type:'class',classId:b.dataset.class};render()})}
function render(){renderNav();if(route.type==='dashboard')renderDashboard();else if(route.type==='class')renderClass(route.classId,route.unitId);else if(route.type==='group')renderGroup(route.classId,route.groupId,route.unitId);else if(route.type==='student')renderStudent(route.studentId,route.unitId);else if(route.type==='curriculum')renderCurriculum(route.classId);else if(route.type==='unitOverview')renderUnitOverview(route.classId,route.groupId);else if(route.type==='planning7528')renderPlanning7528()}

function renderDashboard(){const classes=state.classes.filter(c=>c.yearId===state.activeYear),all=classes.flatMap(c=>classStudents(c.id));let teacherUE=0,teacherTotal=0;classes.forEach(c=>classUnits(c.id).forEach(u=>{if(u.teacherArrive||u.teacherLeave){const p=teacherPresence(c,u);teacherUE+=p.ue;teacherTotal+=p.totalUE}}));view.innerHTML=`<div class="view-header"><div><h2>Übersicht</h2><div class="sub">${escapeHtml(currentYear()?.label||'')}</div></div></div><div class="stat-cards"><div class="stat-card"><div class="big">${classes.length}</div><div class="label">Klassen</div></div><div class="stat-card"><div class="big">${all.length}</div><div class="label">Schüler:innen</div></div><div class="stat-card"><div class="big">${all.reduce((a,s)=>a+totalAbsence(s.id),0).toFixed(1)}</div><div class="label">Fehlstunden (UE)</div></div><div class="stat-card"><div class="big">${teacherTotal?teacherUE.toFixed(1):'–'}</div><div class="label">Meine Anwesenheit (UE)</div></div></div><h3>Klassen</h3><div class="grid">${classes.map(c=>{const cur=state.curriculum[c.id]||[],assigned=cur.filter(i=>i.unitId).length;return `<div class="card clickable" data-c="${c.id}"><b>${escapeHtml(c.code)}</b><div class="sub">${classStudents(c.id).length} Schüler · ${c.groups.length} Gruppen</div><div class="mini-stats"><span class="pill">${classUnits(c.id).length} Einheiten</span><span class="pill">Stoff ${assigned}/${cur.length}</span><span class="pill">${escapeHtml(SCHEDULES[c.scheduleKey]?.label||'')}</span></div></div>`}).join('')}</div>`;view.querySelectorAll('[data-c]').forEach(x=>x.onclick=()=>{route={type:'class',classId:x.dataset.c};render()})}

function renderClass(cid){const c=cls(cid);if(!c)return;
 view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(c.code)}</h2><div class="sub">${classStudents(cid).length} Schüler · ${c.groups.length} Gruppen</div></div><div class="toolbar"><button class="btn" id="addGroup">+ Gruppe</button><button class="btn" id="addStudent">+ Schüler</button><button class="btn secondary" id="batchPhotos">Schülerfotos importieren</button><button class="btn" id="curriculumBtn">Gesamtstoff</button><button class="btn secondary" id="scheduleBtn">Unterrichtszeiten</button></div></div><h3>Gruppen und Unterrichtseinheiten</h3><div class="grid">${c.groups.map(g=>`<div class="card clickable" data-g="${g.id}"><b>${escapeHtml(g.name)}</b><div class="sub">${groupStudents(cid,g.id).length} Schüler · ${classUnits(cid,g.id).length} Einheiten</div></div>`).join('')}</div><h3>Klassenliste</h3>${studentTable(cid,null,null)}`;
 document.getElementById('addGroup').onclick=()=>addGroupDialog(cid);document.getElementById('addStudent').onclick=()=>addStudentDialog(cid);document.getElementById('batchPhotos').onclick=()=>batchPhotoDialog(cid);document.getElementById('curriculumBtn').onclick=()=>{route={type:'curriculum',classId:cid};render()};document.getElementById('scheduleBtn').onclick=()=>scheduleDialog(cid);
 view.querySelectorAll('[data-g]').forEach(x=>x.onclick=()=>{route={type:'group',classId:cid,groupId:x.dataset.g};render()});bindStudentLinks();bindRatings();
}
function renderGroup(cid,gid,unitId){const c=cls(cid),g=c?.groups.find(x=>x.id===gid);if(!c||!g)return;
 const units=classUnits(cid,gid),u=units.find(x=>x.id===unitId)||currentUnit(cid,gid);
 view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(c.code)} · ${escapeHtml(g.name)}</h2><div class="sub">${groupStudents(cid,gid).length} Schüler · ${units.length} Einheiten</div></div><div class="toolbar"><button class="btn secondary" id="backClass">Klasse</button><button class="btn secondary" id="unitOverview">Einheitenübersicht</button><button class="btn" id="addUnit">+ Einheit</button><button class="btn secondary" id="copyUnit">Einheit aus Gruppe kopieren</button></div></div><div class="section-card"><div class="unit-bar"><b>Einheit:</b><select id="unitSelect">${units.map(x=>`<option value="${x.id}" ${u&&x.id===u.id?'selected':''}>SW ${schoolWeek(x.date)} · ${fmtDate(x.date)} · ${escapeHtml(x.topic)}</option>`).join('')}</select><button class="btn secondary" id="editUnit" ${u?'':'disabled'}>Einheit bearbeiten</button><button class="btn secondary" id="deleteUnit" ${u?'':'disabled'}>Einheit löschen</button><button class="btn secondary" id="archivedUnits">Archiv (${state.units.filter(x=>x.groupId===gid&&x.archived).length})</button></div>${u?.showNotesInOverview&&u.notes?`<div class="notice" style="margin-top:12px;white-space:pre-wrap">${escapeHtml(u.notes)}</div>`:''}</div>${u?`<div class="section-card"><b>Unterrichtsstoff:</b> ${escapeHtml(u.topic||'Kein Stoff eingetragen')} <span class="small">· Lehrperson: ${escapeHtml(unitTeacherLabel(u))}</span>${(state.curriculum?.[cid]||[]).filter(i=>i.unitId===u.id).length?`<div class="small">Zugeordnete Stoffpunkte: ${(state.curriculum[cid]||[]).filter(i=>i.unitId===u.id).map(i=>escapeHtml(i.title)).join(' · ')}</div>`:''}</div>`:''}${studentTable(cid,gid,u?.id)}`;
 document.getElementById('backClass').onclick=()=>{route={type:'class',classId:cid};render()};document.getElementById('unitOverview').onclick=()=>{route={type:'unitOverview',classId:cid,groupId:gid};render()};document.getElementById('addUnit').onclick=()=>unitDialog(cid,null,gid);document.getElementById('copyUnit').onclick=()=>copyUnitDialog(cid,gid);document.getElementById('editUnit').onclick=()=>u&&unitDialog(cid,u.id,gid);document.getElementById('deleteUnit').onclick=()=>u&&deleteUnitDialog(cid,gid,u.id);document.getElementById('archivedUnits').onclick=()=>archivedUnitsDialog(cid,gid);
 document.getElementById('unitSelect').onchange=e=>{route.unitId=e.target.value;renderGroup(cid,gid,e.target.value)};bindStudentLinks();bindRatings();bindQuickAttendance(c,u);
}
function unitHasData(u){
 const records=Object.entries(state.records||{}).filter(([k,r])=>k.endsWith('::'+u.id)&&r&&(
  Object.values(r.ratings||{}).some(v=>Number(v)>0)||r.absent||r.arrive||r.leave||r.comment||r.topicOverride||r.absenceOverride!==''&&r.absenceOverride!=null||Object.values(r.ratingNotes||{}).some(Boolean)||(r.workPhotos||[]).length));
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
function studentTable(cid,gid,unitId){const ss=gid?groupStudents(cid,gid):classStudents(cid),u=state.units.find(x=>x.id===unitId),c=cls(cid);return `<div class="table-wrap assessment-scroll"><table><thead><tr><th>Schüler</th><th>Fehlstd.</th><th>Ganztags abwesend</th><th>kommt / Grund</th><th>geht / Grund</th>${RUBRICS.map(r=>`<th>${r} ${ratingWeightLabel(cid,r)}</th>`).join('')}<th>Individueller Stoff</th></tr></thead><tbody>${ss.map(s=>{const r=u?getRecord(s.id,u.id):null,miss=r?calcMissedUE(c,r,s.id,u?.id):0;return `<tr><td><div class="name-cell" data-student="${s.id}" data-unit="${u?.id||''}">${s.photo?`<img class="thumb" src="${s.photo}">`:`<span class="thumb avatar placeholder">${initials(s.name)}</span>`}<span>${escapeHtml(s.name)}</span></div></td><td>${totalAbsence(s.id).toFixed(1)}${r&&miss?` <span class="pill warn">+${miss.toFixed(1)}</span>`:''}</td><td>${u?`<input type="checkbox" aria-label="Ganztags abwesend" data-absent="${s.id}" ${r?.absent?'checked':''}>`:''}</td><td>${u?`<div class="attendance-time"><input class="quick-time" type="time" step="300" aria-label="Kommt um" data-arrive="${s.id}" value="${r?.arrive||''}"><input class="attendance-reason" type="text" aria-label="Grund für spätes Kommen" data-arrive-reason="${s.id}" value="${escapeHtml(r?.arriveReason||'')}" placeholder="Grund (optional)"></div>`:''}</td><td>${u?`<div class="attendance-time"><input class="quick-time" type="time" step="300" aria-label="Geht um" data-leave="${s.id}" value="${r?.leave||''}"><input class="attendance-reason" type="text" aria-label="Grund für früheres Gehen" data-leave-reason="${s.id}" value="${escapeHtml(r?.leaveReason||'')}" placeholder="Grund (optional)"></div>`:''}</td>${RUBRICS.map(x=>`<td>${u?ratingHtml(r?.ratings?.[x],s.id,u.id,x,!!r?.absent):'–'}</td>`).join('')}<td class="wide-note">${escapeHtml(r?.topicOverride||'')}${!r?.topicOverride?'<span class="small">–</span>':''}</td></tr>`}).join('')}</tbody></table></div>`}
function ratingHtml(val,sid,uid,rubric,absent=false){return `<div class="rating ${absent?'rating-absent':''}" data-sid="${sid}" data-uid="${uid}" data-rubric="${rubric}"><select class="rating-select" data-score ${absent?'disabled':''} aria-label="${escapeHtml(rubric)} bewerten"><option value="">–</option>${Array.from({length:19},(_,i)=>(i+2)/2).map(n=>`<option value="${n}" ${Number(val)===n?'selected':''}>${n.toLocaleString('de-AT')}</option>`).join('')}</select></div>`}
function bindRatings(){view.querySelectorAll('.rating [data-score]').forEach(el=>el.onchange=()=>{const parent=el.closest('.rating'),r=getRecord(parent.dataset.sid,parent.dataset.uid);if(r.absent)return;const key=parent.dataset.rubric;if(el.value==='')delete r.ratings[key];else r.ratings[key]=Number(el.value);saveState();const label=el.closest('.metric-row')?.querySelector('.score');if(label)label.textContent=(el.value||'–')+'/10';})}
function bonusFactor(unitId){const unit=state.units?.find(u=>u.id===unitId);const v=Number(unit?.bonusFactor??state.settings?.bonusFactor??1);return Number.isFinite(v)&&v>=0?v:1}
function bonusTotal(r){return r&&!r.absent?(r.bonusPoints||[]).reduce((n,b)=>n+(Number(b.points)||0),0):0}
function bonusEditor(sid,uid,r){const items=r.bonusPoints||[];return `<div class="section-card"><h3>Zusatzpunkte</h3><p class="small">Zusatzpunkte je Unterrichtseinheit, maximal 10 Gesamtpunkte.</p><div class="bonus-items">${items.map((b,i)=>`<div class="bonus-item"><span>${escapeHtml(b.reason||'Zusatzpunkte')}: +${Number(b.points).toLocaleString('de-AT')}</span><button class="btn secondary" type="button" data-bonus-remove="${i}">Entfernen</button></div>`).join('')}</div><div class="form-grid"><div class="field"><label>Grund</label><select id="bonusReason"><option>Hilfsbereitschaft</option><option>Selbstständiges Arbeiten</option><option>Besonderer Einsatz</option><option>Besondere Problemlösung</option><option value="">Eigener Grund</option></select><input id="bonusCustom" placeholder="Eigener Grund (optional)"></div><div class="field"><label>Zusatzpunkte</label><input id="bonusAmount" type="number" min="0.5" max="10" step="0.5" value="0.5"></div></div><button class="btn secondary" type="button" id="bonusAdd" ${r.absent?'disabled':''}>+ Zusatzpunkte vergeben</button><div class="small">Summe: +${bonusTotal(r).toLocaleString('de-AT')} · Faktor ${bonusFactor(uid).toLocaleString('de-AT')} = +${(bonusTotal(r)*bonusFactor(uid)).toLocaleString('de-AT')}</div></div>`}
function bindBonus(sid,uid){const add=document.getElementById('bonusAdd');if(!add)return;add.onclick=()=>{const r=getRecord(sid,uid),reason=document.getElementById('bonusCustom').value.trim()||document.getElementById('bonusReason').value,points=Number(document.getElementById('bonusAmount').value);if(!reason||!Number.isFinite(points)||points<=0||points>10)return alert('Grund und gültige Punkte eingeben.');r.bonusPoints=r.bonusPoints||[];r.bonusPoints.push({reason,points});saveState();renderStudent(sid,uid)};view.querySelectorAll('[data-bonus-remove]').forEach(b=>b.onclick=()=>{const r=getRecord(sid,uid);r.bonusPoints.splice(Number(b.dataset.bonusRemove),1);saveState();renderStudent(sid,uid)})}
function bindQuickAttendance(c,u){if(!u)return;
 for(const kind of ['absent'])view.querySelectorAll('[data-'+kind+']').forEach(el=>el.onchange=()=>{const r=getRecord(el.dataset[kind],u.id);r[kind]=el.checked;if(el.checked){r.absenceOverride='';r.arrive='';r.leave=''}saveState();render()});
 view.querySelectorAll('[data-arrive]').forEach(i=>i.onchange=()=>{const r=getRecord(i.dataset.arrive,u.id);r.arrive=i.value;r.absent=false;saveState();render()});view.querySelectorAll('[data-leave]').forEach(i=>i.onchange=()=>{const r=getRecord(i.dataset.leave,u.id);r.leave=i.value;r.absent=false;saveState();render()});for(const [attr,key] of [['data-arrive-reason','arriveReason'],['data-leave-reason','leaveReason']])view.querySelectorAll('['+attr+']').forEach(i=>i.oninput=()=>{const r=getRecord(i.getAttribute(attr),u.id);r[key]=i.value;saveState()})}
function bindStudentLinks(){view.querySelectorAll('[data-student]').forEach(x=>x.onclick=()=>{route={type:'student',studentId:x.dataset.student,unitId:x.dataset.unit||undefined};render()})}

function renderStudent(sid,unitId){const s=student(sid),c=cls(s?.classId);if(!s||!c)return;const u=state.units.find(x=>x.id===unitId&&x.groupId===s.groupId)||currentUnit(c.id,s.groupId),r=u?getRecord(s.id,u.id):null,miss=r?calcMissedUE(c,r,s.id,u?.id):0;view.innerHTML=`<div class="view-header"><div><h2>${escapeHtml(s.name)}</h2><div class="sub">${escapeHtml(c.code)} · ${escapeHtml(c.groups.find(g=>g.id===s.groupId)?.name||'')}</div></div><div class="toolbar"><button class="btn secondary" id="backBtn">Zurück</button><button class="btn danger" id="delStudent">Schüler löschen</button></div></div><div class="detail-head"><div class="profile-photo-box">${s.photo?`<img class="detail-avatar" id="profilePhoto" src="${s.photo}">`:`<div class="detail-avatar avatar placeholder" id="profilePhoto">${initials(s.name)}</div>`}<div class="photo-actions"><button class="btn secondary" id="setProfilePhoto">${s.photo?'Foto ersetzen':'Foto zuweisen'}</button>${s.photo?'<button class="btn danger" id="removeProfilePhoto">Foto löschen</button>':''}</div></div><div><div class="stat-cards"><div class="stat-card"><div class="big">${studentAvg(s.id)?.toFixed(1)||'–'}</div><div class="label">Ø Lehrer</div></div><div class="stat-card"><div class="big">${totalAbsence(s.id).toFixed(1)}</div><div class="label">Fehlstunden (UE)</div></div></div></div></div><div class="section-card"><div class="unit-bar"><b>Einheit:</b><select id="studentUnit">${classUnits(c.id,s.groupId).map(x=>`<option value="${x.id}" ${u&&x.id===u.id?'selected':''}>SW ${schoolWeek(x.date)} · ${fmtDate(x.date)} · ${escapeHtml(x.topic)}</option>`).join('')}</select></div></div>${u?`<div class="section-card"><h3>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</h3><div class="form-grid"><div class="field"><label>Globaler Stoff</label><input value="${escapeHtml(u.topic)}" disabled></div><div class="field"><label>Individueller Stoff / Abweichung</label><input id="topicOverride" value="${escapeHtml(r.topicOverride||'')}" placeholder="leer = globaler Stoff"></div><div class="field"><label>kommt (Uhrzeit)</label><input id="arrive" type="time" step="300" value="${r.arrive||''}"><input id="arriveReason" type="text" value="${escapeHtml(r.arriveReason||'')}" placeholder="Begründung (optional)"></div><div class="field"><label>geht (Uhrzeit)</label><input id="leave" type="time" step="300" value="${r.leave||''}"><input id="leaveReason" type="text" value="${escapeHtml(r.leaveReason||'')}" placeholder="Begründung (optional)"></div><div class="field"><label>Fehlstunden automatisch</label><input value="${miss.toFixed(1)} UE" disabled></div><div class="field"><label>Manuelle Fehlstunden (optional)</label><input id="absenceOverride" type="number" step="0.1" min="0" value="${r.absenceOverride??''}" placeholder="leer = automatisch"></div></div><label class="inline-check"><input id="absent" type="checkbox" ${r.absent?'checked':''}> ganzer Tag abwesend</label><h3 style="margin-top:18px">Bewertung</h3>${RUBRICS.map(x=>`<div class="rating-category"><div class="metric-row"><div class="label">${x} ${ratingWeightLabel(c.id,x)}</div>${ratingHtml(r.ratings[x],s.id,u.id,x,!!r.absent)}<div class="score">${r.absent?'– (abwesend)':(r.ratings[x]??'–')+'/10'}</div></div><div class="field rating-note"><label>Notiz – ${x}</label><textarea rows="2" data-rating-note="${escapeHtml(x)}" placeholder="Beobachtung zu dieser Bewertung">${escapeHtml(r.ratingNotes?.[x]||'')}</textarea><div class="rating-photo-section"><button type="button" class="btn secondary" data-add-rating-photo="${escapeHtml(x)}">+ Foto / PDF zu ${escapeHtml(x)}</button><div class="photo-strip">${(r.ratingPhotos?.[x]||[]).map((ph,i)=>`<span class="work-photo-wrap"><img class="work-photo" src="${ph}" data-open-rating-photo="${escapeHtml(x)}" data-photo-index="${i}" title="Foto öffnen"><button type="button" class="work-photo-remove" data-remove-rating-photo="${escapeHtml(x)}" data-photo-index="${i}" title="Foto entfernen">×</button></span>`).join('')}</div>${(r.ratingDocuments?.[x]||[]).map((doc,i)=>`<div class="rating-document"><a href="${doc.data}" download="${escapeHtml(doc.name)}" title="PDF herunterladen">📄 ${escapeHtml(doc.name)}</a><button type="button" class="btn secondary" data-remove-rating-pdf="${escapeHtml(x)}" data-pdf-index="${i}" title="PDF entfernen">×</button></div>`).join('')}</div></div></div>`).join('')}${bonusEditor(s.id,u.id,r)}<div class="field"><label>Bemerkung</label><textarea id="comment">${escapeHtml(r.comment||'')}</textarea></div><div class="work-photo-section"><div class="section-title-row"><h3 style="margin:0">Werkstückfotos dieser Einheit</h3><button class="btn secondary" id="addWorkPhoto">+ Foto / PDF</button></div><div class="photo-strip" style="margin-top:10px">${(r.workPhotos||[]).length?(r.workPhotos||[]).map((ph,i)=>`<div class="work-photo-wrap"><img class="work-photo" src="${ph}" data-work-photo="${i}" title="Foto öffnen"><button class="work-photo-remove" data-remove-work-photo="${i}" title="Foto löschen">×</button></div>`).join(''):'<span class="muted small">Noch kein Werkstückfoto für diese Einheit.</span>'}${(r.workDocuments||[]).map((doc,i)=>`<div class="rating-document"><a href="${doc.data}" download="${escapeHtml(doc.name)}">📄 ${escapeHtml(doc.name)}</a><button type="button" class="btn secondary" data-remove-work-pdf="${i}">×</button></div>`).join('')}</div></div></div>`:''}<div class="section-card"><h3>Förderung / Entwicklung</h3><div class="form-grid"><div class="field"><label>Stärken</label><textarea id="strengths">${escapeHtml(s.strengths||'')}</textarea></div><div class="field"><label>Förderbedarf</label><textarea id="supportNeed">${escapeHtml(s.supportNeed||'')}</textarea></div><div class="field"><label>Förderziel</label><textarea id="supportGoal">${escapeHtml(s.supportGoal||'')}</textarea></div><div class="field"><label>Allgemeine Notizen</label><textarea id="studentNotes">${escapeHtml(s.notes||'')}</textarea></div></div></div>`;
 document.getElementById('backBtn').onclick=()=>{route={type:'group',classId:c.id,groupId:s.groupId,unitId:u?.id};render()};document.getElementById('delStudent').onclick=()=>confirmDeleteStudent(s.id);document.getElementById('profilePhoto').onclick=()=>pickPhoto({studentId:s.id});document.getElementById('setProfilePhoto').onclick=()=>pickPhoto({studentId:s.id});const rp=document.getElementById('removeProfilePhoto');if(rp)rp.onclick=()=>{if(confirm('Profilfoto dieses Schülers löschen?')){s.photo='';saveState();renderStudent(s.id,u?.id)}};document.getElementById('studentUnit').onchange=e=>{route.unitId=e.target.value;renderStudent(s.id,e.target.value)};bindRatings();if(u){bindBonus(s.id,u.id);view.querySelectorAll('[data-rating-note]').forEach(el=>{el.oninput=()=>{const rr=getRecord(s.id,u.id);rr.ratingNotes=rr.ratingNotes||{};rr.ratingNotes[el.dataset.ratingNote]=el.value;saveState()}});['topicOverride','arrive','leave','absenceOverride','comment'].forEach(id=>{document.getElementById(id).onchange=()=>{const rr=getRecord(s.id,u.id);rr[id]=document.getElementById(id).value;saveState();renderStudent(s.id,u.id)}});['arriveReason','leaveReason'].forEach(id=>{document.getElementById(id).oninput=e=>{const rr=getRecord(s.id,u.id);rr[id]=e.target.value;saveState()}});document.getElementById('absent').onchange=e=>{r.absent=e.target.checked;if(r.absent){r.absenceOverride='';r.arrive='';r.leave=''}saveState();renderStudent(s.id,u.id)};view.querySelectorAll('[data-add-rating-photo]').forEach(b=>b.onclick=()=>pickPhoto({studentId:s.id,unitId:u.id,type:'rating',rubric:b.dataset.addRatingPhoto}));view.querySelectorAll('[data-open-rating-photo]').forEach(img=>img.onclick=()=>openImageModal(img.src));view.querySelectorAll('[data-remove-rating-photo]').forEach(b=>b.onclick=()=>{const rr=getRecord(s.id,u.id),arr=rr.ratingPhotos?.[b.dataset.removeRatingPhoto]||[];if(confirm('Bewertungsfoto entfernen?')){arr.splice(Number(b.dataset.photoIndex),1);saveState();renderStudent(s.id,u.id)}});view.querySelectorAll('[data-remove-rating-pdf]').forEach(b=>b.onclick=()=>{const rr=getRecord(s.id,u.id),arr=rr.ratingDocuments?.[b.dataset.removeRatingPdf]||[];if(confirm('PDF entfernen?')){arr.splice(Number(b.dataset.pdfIndex),1);saveState();renderStudent(s.id,u.id)}});view.querySelectorAll('[data-remove-work-pdf]').forEach(b=>b.onclick=()=>{const rr=getRecord(s.id,u.id);if(confirm('PDF entfernen?')){rr.workDocuments.splice(Number(b.dataset.removeWorkPdf),1);saveState();renderStudent(s.id,u.id)}});const awp=document.getElementById('addWorkPhoto');if(awp)awp.onclick=()=>pickPhoto({studentId:s.id,unitId:u.id,type:'work'});document.querySelectorAll('[data-work-photo]').forEach(img=>img.onclick=()=>openImageModal(img.src));document.querySelectorAll('[data-remove-work-photo]').forEach(btn=>btn.onclick=()=>removeWorkPhoto(s.id,u.id,Number(btn.dataset.removeWorkPhoto)));}['strengths','supportNeed','supportGoal','studentNotes'].forEach(id=>document.getElementById(id).oninput=()=>{if(id==='studentNotes')s.notes=document.getElementById(id).value;else s[id]=document.getElementById(id).value;saveState()})}

function renderCurriculum(cid){const c=cls(cid),items=state.curriculum[cid]||[],units=classUnits(cid),assigned=items.filter(x=>x.unitId).length;state.curriculum[cid]=items;view.innerHTML=`<div class="view-header"><div><h2>Gesamtstoff · ${escapeHtml(c.code)}</h2><div class="sub">Stoff laden, automatisch auf Ausbildungsblöcke verteilen oder manuell zuordnen</div></div><div class="toolbar"><button class="btn secondary" id="backClass">Klasse</button><button class="btn" id="importCurr">Datei laden</button><button class="btn" id="pasteCurr">Text einfügen</button><button class="btn" id="addCurr">+ Stoffpunkt</button><button class="btn" id="autoCurr">Automatisch verteilen</button><button class="btn secondary" id="clearCurr">Zuordnung leeren</button></div></div><div class="section-card"><div class="kpi-line"><span class="pill">${items.length} Stoffpunkte</span><span class="pill">${assigned} zugeordnet</span><span class="pill">${units.length} Ausbildungsblöcke</span><span class="pill">${scheduleUE(c.scheduleKey).toFixed(0)} UE je Block</span></div><div class="progress" style="margin-top:10px"><span style="width:${items.length?assigned/items.length*100:0}%"></span></div></div><div class="section-card"><div class="curriculum-row"><b>Stoffpunkt</b><b>UE</b><b>Ausbildungsblock</b><b></b></div>${items.length?items.map(i=>`<div class="curriculum-row" data-ci="${i.id}"><input data-title="${i.id}" value="${escapeHtml(i.title)}"><input data-ue="${i.id}" type="number" min="0.5" step="0.5" value="${i.ue||1}"><select data-unit="${i.id}"><option value="">nicht zugeordnet</option>${units.map(u=>`<option value="${u.id}" ${i.unitId===u.id?'selected':''}>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</option>`).join('')}</select><button class="btn danger" data-del="${i.id}">Löschen</button></div>`).join(''):'<p class="muted">Noch kein Gesamtstoff vorhanden.</p>'}</div><div class="section-card"><h3>Ausbildungsblöcke</h3>${units.map(u=>{const its=items.filter(i=>i.unitId===u.id);return `<div class="schedule-block"><div><b>SW ${schoolWeek(u.date)} · ${fmtDate(u.date)}</b><div class="small">${escapeHtml(u.topic||'')}</div></div><div>${its.reduce((a,i)=>a+Number(i.ue||1),0).toFixed(1)} / ${scheduleUE(c.scheduleKey).toFixed(1)} UE</div></div>`}).join('')}</div>`;
 document.getElementById('backClass').onclick=()=>{route={type:'class',classId:cid};render()};document.getElementById('importCurr').onclick=()=>{activeCurriculumClassId=cid;document.getElementById('curriculumImport').click()};document.getElementById('pasteCurr').onclick=()=>pasteCurriculumDialog(cid);document.getElementById('addCurr').onclick=()=>{items.push({id:uid('cur'),title:'Neuer Stoffpunkt',ue:1,notes:'',unitId:''});saveState();renderCurriculum(cid)};document.getElementById('autoCurr').onclick=()=>autoDistributeCurriculum(cid);document.getElementById('clearCurr').onclick=()=>{items.forEach(i=>i.unitId='');rebuildUnitTopics(cid);saveState();renderCurriculum(cid)};view.querySelectorAll('[data-title]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.title).title=x.value;rebuildUnitTopics(cid);saveState()});view.querySelectorAll('[data-ue]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.ue).ue=Number(x.value)||1;saveState();renderCurriculum(cid)});view.querySelectorAll('[data-unit]').forEach(x=>x.onchange=()=>{items.find(i=>i.id===x.dataset.unit).unitId=x.value;rebuildUnitTopics(cid);saveState();renderCurriculum(cid)});view.querySelectorAll('[data-del]').forEach(x=>x.onclick=()=>{state.curriculum[cid]=items.filter(i=>i.id!==x.dataset.del);rebuildUnitTopics(cid);saveState();renderCurriculum(cid)})}
function rebuildUnitTopics(cid){const items=state.curriculum[cid]||[];classUnits(cid).forEach(u=>{const titles=items.filter(i=>i.unitId===u.id).map(i=>i.title.trim()).filter(Boolean);if(titles.length)u.topic=titles.join(' · ')})}
function autoDistributeCurriculum(cid){const c=cls(cid),items=state.curriculum[cid]||[],units=classUnits(cid);if(!units.length){alert('Bitte zuerst Unterrichtseinheiten anlegen.');return}const cap=scheduleUE(c.scheduleKey);let ix=0,used=0;items.forEach(i=>{let need=Math.max(.5,Number(i.ue)||1);if(ix>=units.length){i.unitId='';return}if(used>0&&used+need>cap){ix++;used=0}if(ix>=units.length){i.unitId='';return}i.unitId=units[ix].id;used+=need;if(used>=cap){ix++;used=0}});rebuildUnitTopics(cid);saveState();renderCurriculum(cid)}
function pasteCurriculumDialog(cid){openModal(`<h2>Gesamtstoff einfügen</h2><p>Eine Zeile = ein Stoffpunkt. Optional kann am Zeilenende <b>; UE</b> angegeben werden, z. B. <code>Gerades Eckblatt; 3</code>.</p><div class="field"><label>Stoff</label><textarea id="currText" style="min-height:280px"></textarea></div><div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="currSave">Übernehmen</button></div>`);document.getElementById('currSave').onclick=()=>{const arr=document.getElementById('currText').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);state.curriculum[cid]=(state.curriculum[cid]||[]).concat(arr.map(line=>{const p=line.split(';');return{id:uid('cur'),title:p[0].trim(),ue:Number((p[1]||'1').replace(',','.'))||1,notes:'',unitId:''}}));saveState();closeModal();renderCurriculum(cid)}}
async function importCurriculumFile(file){const cid=activeCurriculumClassId;if(!cid)return;const text=await file.text();let items=[];if(file.name.toLowerCase().endsWith('.json')){const data=JSON.parse(text);items=(Array.isArray(data)?data:data.items||[]).map(x=>({id:uid('cur'),title:x.title||x.thema||x.stoff||'',ue:Number(x.ue||x.stunden||1)||1,notes:x.notes||x.notiz||'',unitId:''})).filter(x=>x.title)}else if(file.name.toLowerCase().endsWith('.csv')){const lines=text.split(/\r?\n/).filter(Boolean),delim=lines[0].includes(';')?';':',';const head=lines.shift().split(delim).map(x=>x.trim().toLowerCase());items=lines.map(line=>{const p=line.split(delim).map(x=>x.trim().replace(/^"|"$/g,'')),o={};head.forEach((h,i)=>o[h]=p[i]||'');return{id:uid('cur'),title:o.thema||o.stoff||o.topic||o.titel||p[0],ue:Number((o.ue||o.stunden||o.hours||'1').replace(',','.'))||1,notes:o.notiz||o.notes||'',unitId:''}}).filter(x=>x.title)}else{items=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(x=>({id:uid('cur'),title:x,ue:1,notes:'',unitId:''}))}state.curriculum[cid]=(state.curriculum[cid]||[]).concat(items);saveState();renderCurriculum(cid);alert(`${items.length} Stoffpunkte geladen.`)}

function unitTeacherNames(){
 const settings=state.settings||{};
 const names=[settings.teacherName||'Josef Kaiser',...(settings.teacherRoster||[])];
 return [...new Set(names.map(x=>String(x||'').trim()).filter(Boolean))];
}
function unitTeacherLabel(u){return (u?.teacherName||state.settings?.teacherName||'Josef Kaiser').trim()||'Josef Kaiser'}
function unitDialog(cid,unitId,gid){
 const u=state.units.find(x=>x.id===unitId);if(u&&u.groupId!==gid)return alert('Diese Einheit gehört zu einer anderen Gruppe.');
 const returningOverview=route.type==='unitOverview';
 const teacherOptions=unitTeacherNames();
 const chosenTeacher=unitTeacherLabel(u);
 if(!teacherOptions.includes(chosenTeacher))teacherOptions.push(chosenTeacher);
 const teacherMarkup=`<div class="field"><label for="mUnitTeacher">Lehrperson (hauptverantwortlich)</label><select id="mUnitTeacher">${teacherOptions.map(n=>`<option value="${escapeHtml(n)}" ${n===chosenTeacher?'selected':''}>${escapeHtml(n)}</option>`).join('')}</select><button type="button" class="btn secondary" id="mAddUnitTeacher" style="margin-top:6px">+ Lehrperson hinzufügen</button></div>`;

 // Existing links are keyed by the stable unit ID. Never recreate them when editing.
 const existingLinks=u?(state.unitLinks?.[u.id]||[]):[];
 const assignedMarkup=u?`<div class="section-card" id="mExistingMaterials"><b>Bereits zugewiesene Unterlagen (${existingLinks.length})</b>${existingLinks.length?existingLinks.map((link,i)=>{const doc=(state.library||[]).find(d=>d.id===link.docId);return `<div class="schedule-block"><div><b>${escapeHtml(doc?.name||'Datei nicht im Verzeichnis gefunden')}</b><div class="small">${escapeHtml(link.pages?'Seiten: '+link.pages:'Gesamtes Dokument')}${link.notes?' · '+escapeHtml(link.notes):''}</div></div><button type="button" class="btn secondary" data-existing-material="${i}" ${doc?'':'disabled'}>Öffnen</button></div>`}).join(''):'<div class="small">Noch keine Unterlagen zugewiesen.</div>'}</div>`:'';
 openModal(`<h2>${u?'Einheit bearbeiten':'Einheit anlegen'}</h2><div class="form-grid"><div class="field"><label>Datum</label><input id="mDate" type="date" value="${u?.date||new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Globaler Stoff</label><input id="mTopic" value="${escapeHtml(u?.topic||'')}"></div>${teacherMarkup}<div class="field"><label>Faktor Zusatzpunkte (Bewertung dieser Einheit)</label><input id="mUnitBonusFactor" type="number" min="0" step="0.1" value="${escapeHtml(String(u?.bonusFactor??state.settings?.bonusFactor??1))}"></div><div class="field"><label>Meine Ankunft</label><input id="mTeacherArrive" type="time" value="${u?.teacherArrive||''}"></div><div class="field"><label>Mein Ende</label><input id="mTeacherLeave" type="time" value="${u?.teacherLeave||''}"></div></div><div class="field"><label for="mNotes">Notiz</label><div class="toolbar" style="margin:5px 0"><button type="button" class="btn secondary" id="mNotesBullet" title="Aufzählungszeichen einfügen">• Aufzählung</button><span class="small" id="mNotesSaveStatus" aria-live="polite">${u?'Änderungen werden automatisch gespeichert':'Neue Einheit mit Speichern anlegen'}</span></div><textarea id="mNotes" rows="5" style="white-space:pre-wrap">${escapeHtml(u?.notes||'')}</textarea></div><div class="field"><label><input type="checkbox" id="mShowNotes" ${u?.showNotesInOverview?'checked':''}> Notiz in der Gruppenübersicht anzeigen</label></div><div class="field"><label>Abweichende Unterrichtszeiten nur für diese Einheit (optional)</label><label><input type="checkbox" id="mUnitCustomTime" ${u?.scheduleBlocks?'checked':''}> Individuelle Zeitblöcke</label><div id="unitTimeEditor" style="display:${u?.scheduleBlocks?'block':'none'}">${timeBlockEditor(u?.scheduleBlocks||classSchedule(cls(cid)).blocks,'unitTimeBlocks')}</div></div>${assignedMarkup}${u?`<div class="modal-actions"><button class="btn secondary" id="mUnitMaterials">Speichern und Skriptseiten / Fotos / Skizzen öffnen</button></div>`:''}<div class="modal-actions"><button class="btn secondary" onclick="document.getElementById('modal').close()">Abbrechen</button><button class="btn" id="mSave">Speichern</button></div>`);
 document.getElementById('mAddUnitTeacher').onclick=()=>{
  const name=prompt('Name der weiteren Lehrperson:');
  if(name===null)return;
  const trimmed=name.trim();
  if(!trimmed)return;
  if(trimmed.length>120)return alert('Name zu lang (maximal 120 Zeichen).');
  state.settings=state.settings||{};
  const roster=unitTeacherNames();
  if(!roster.includes(trimmed))state.settings.teacherRoster=[...(state.settings.teacherRoster||[]),trimmed];
  const select=document.getElementById('mUnitTeacher');
  if(![...select.options].some(o=>o.value===trimmed))select.add(new Option(trimmed,trimmed));
  select.value=trimmed;
  saveState();
 };
 // Existing unit notes are updated immediately in memory and saved on every edit,
 // even when the modal is closed using X, Escape, or the footer button.
 const noteField=document.getElementById('mNotes');
 const noteStatus=document.getElementById('mNotesSaveStatus');
 let noteSaveDelay;
 function persistUnitNote(){
  if(!u)return;
  clearTimeout(noteSaveDelay);
  if(u.notes!==noteField.value){u.notes=noteField.value;saveState()}
  noteStatus.textContent='Notiz gespeichert (lokal; OneDrive-Abgleich ausstehend)';
 }
 if(u){
  noteField.addEventListener('input',()=>{
   u.notes=noteField.value;
   noteStatus.textContent='Notiz wird gespeichert …';
   clearTimeout(noteSaveDelay);
   noteSaveDelay=setTimeout(()=>{saveState();noteStatus.textContent='Notiz gespeichert (lokal; OneDrive-Abgleich ausstehend)'},350);
  });
  noteField.addEventListener('blur',persistUnitNote);
  modal.addEventListener('close',()=>{clearTimeout(noteSaveDelay);if(u.notes!==noteField.value){u.notes=noteField.value;saveState()}},{once:true});
 }
 document.getElementById('mNotesBullet').onclick=()=>{
  const start=noteField.selectionStart,end=noteField.selectionEnd,value=noteField.value;
  const lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1;
  const prefix=value.slice(lineStart,start);
  const bullet=/^\s*[•-]\s/.test(prefix)?'':'• ';
  noteField.setRangeText(bullet,start,end,'end');
  noteField.focus();noteField.dispatchEvent(new Event('input',{bubbles:true}));
 };
 noteField.addEventListener('keydown',e=>{
  if(e.key!=='Enter'||e.shiftKey)return;
  const value=noteField.value,pos=noteField.selectionStart;
  const line=value.slice(value.lastIndexOf('\n',Math.max(0,pos-1))+1,pos);
  if(!/^\s*•\s/.test(line))return;
  e.preventDefault();
  const insert=line.trim()==='•'?'\n':'\n• ';
  noteField.setRangeText(insert,noteField.selectionStart,noteField.selectionEnd,'end');
  noteField.dispatchEvent(new Event('input',{bubbles:true}));
 });
 bindBlockEditor('unitTimeBlocks');document.getElementById('mUnitCustomTime').onchange=e=>document.getElementById('unitTimeEditor').style.display=e.target.checked?'block':'none';
 function commit(openMaterials=false){
  const date=document.getElementById('mDate').value;
  if(!date)return alert('Bitte ein gültiges Datum auswählen.');
  const unitFactor=Number(document.getElementById('mUnitBonusFactor').value);if(!Number.isFinite(unitFactor)||unitFactor<0)return alert('Bitte einen gültigen Zusatzpunkte-Faktor eingeben.');
  const data={bonusFactor:unitFactor,date,topic:document.getElementById('mTopic').value.trim()||'Einheit',notes:document.getElementById('mNotes').value,showNotesInOverview:document.getElementById('mShowNotes').checked,teacherName:document.getElementById('mUnitTeacher').value,teacherArrive:document.getElementById('mTeacherArrive').value,teacherLeave:document.getElementById('mTeacherLeave').value};
  if(document.getElementById('mUnitCustomTime').checked){const b=readBlockEditor('unitTimeBlocks');if(!validBlocks(b))return alert('Ungültige Unterrichtszeiten');data.scheduleBlocks=b}else data.scheduleBlocks=null;
  let target=u;if(target)Object.assign(target,data);else{target={id:uid('unit'),classId:cid,groupId:gid,...data};state.units.push(target)}
  // Keep unit ID stable: state.unitLinks and PDF page annotations are keyed by this ID.
  saveState();closeModal();
  if(openMaterials){route={type:'group',classId:cid,groupId:gid,unitId:target.id};render();mediaUnitDialog(cid,target.id);return}
  route=returningOverview?{type:'unitOverview',classId:cid,groupId:gid}:{type:'group',classId:cid,groupId:gid,unitId:target.id};render();
 }
 document.getElementById('mSave').onclick=()=>commit(false);
 if(u)document.getElementById('mUnitMaterials').onclick=()=>commit(true);
 if(u)document.querySelectorAll('[data-existing-material]').forEach(button=>button.onclick=()=>{
  // Save edits before opening a file, so neither changes nor page assignments are lost.
  const link=existingLinks[Number(button.dataset.existingMaterial)];
  const doc=(state.library||[]).find(d=>d.id===link?.docId);
  if(!doc)return alert('Die Datei ist derzeit nicht im Verzeichnis verfügbar. Bitte OneDrive-Dateien einlesen.');
  const date=document.getElementById('mDate').value;
  if(!date)return alert('Bitte ein gültiges Datum auswählen.');
  const unitFactor=Number(document.getElementById('mUnitBonusFactor').value);if(!Number.isFinite(unitFactor)||unitFactor<0)return alert('Bitte einen gültigen Zusatzpunkte-Faktor eingeben.');
  const changes={bonusFactor:unitFactor,date,topic:document.getElementById('mTopic').value.trim()||'Einheit',notes:document.getElementById('mNotes').value,showNotesInOverview:document.getElementById('mShowNotes').checked,teacherName:document.getElementById('mUnitTeacher').value,teacherArrive:document.getElementById('mTeacherArrive').value,teacherLeave:document.getElementById('mTeacherLeave').value};
  if(document.getElementById('mUnitCustomTime').checked){const blocks=readBlockEditor('unitTimeBlocks');if(!validBlocks(blocks))return alert('Ungültige Unterrichtszeiten');changes.scheduleBlocks=blocks}else changes.scheduleBlocks=null;
  Object.assign(u,changes);saveState();
  openLibraryFile(doc);
 });
}
function renderUnitOverview(cid,gid){
 const c=cls(cid),g=c?.groups.find(x=>x.id===gid);if(!c||!g)return;
 const units=classUnits(cid,gid);
 view.innerHTML=`<div class="view-header"><div><h2>Einheitenübersicht · ${escapeHtml(c.code)} / ${escapeHtml(g.name)}</h2><div class="sub">${units.length} aktive Einheiten · Mehrfachauswahl für gemeinsame Änderungen</div></div><div class="toolbar"><button class="btn secondary" id="uoBack">Zur Gruppe</button><button class="btn" id="uoAdd">+ Einheit</button><button class="btn secondary" id="uoCopy">Aus Gruppe kopieren</button></div></div><div class="section-card"><div class="toolbar" style="flex-wrap:wrap"><label><input type="checkbox" id="uoAll"> Alle auswählen</label><button class="btn secondary" id="uoBatch" disabled>Ausgewählte bearbeiten</button><button class="btn danger" id="uoDelete" disabled>Ausgewählte löschen</button><button class="btn secondary" id="uoArchive">Archiv</button></div><div class="table-wrap"><table><thead><tr><th>Auswahl</th><th>Datum</th><th>Stoff</th><th>Lehrperson</th><th>Notiz</th><th>PDF-Seiten / Dateien</th><th>Aktion</th></tr></thead><tbody>${units.map(u=>`<tr><td><input type="checkbox" data-uo-select="${u.id}" aria-label="Einheit auswählen"></td><td>${fmtDate(u.date)}</td><td>${escapeHtml(u.topic||'')}</td><td>${escapeHtml(unitTeacherLabel(u))}</td><td>${escapeHtml(u.notes||'').slice(0,100)}</td><td>${(state.unitLinks?.[u.id]||[]).length} Zuordnung(en)</td><td><button class="btn secondary" data-uo-edit="${u.id}">Bearbeiten</button> <button class="btn secondary" data-uo-open="${u.id}">Öffnen</button></td></tr>`).join('')}</tbody></table></div></div>`;
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

function pickPhoto(target){activePhotoTarget=target;imageIntake7528({pdf:!!target.unitId,onFile:processPhoto})}
async function processPhoto(file){if(!activePhotoTarget?.studentId)return;
 if(file.type==='application/pdf'||/\.pdf$/i.test(file.name||'')){
  if(!activePhotoTarget.unitId)throw new Error('Profilbilder müssen Bilddateien sein.');
  if(file.size>6*1024*1024)throw new Error('PDF zu groß (maximal 6 MB). Bitte Datei verkleinern.');
  const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('PDF konnte nicht gelesen werden.'));reader.readAsDataURL(file)});
  const rr=getRecord(activePhotoTarget.studentId,activePhotoTarget.unitId),doc={name:file.name||'Dokument.pdf',data};
  if(activePhotoTarget.type==='rating'&&activePhotoTarget.rubric){rr.ratingDocuments=rr.ratingDocuments||{};(rr.ratingDocuments[activePhotoTarget.rubric]??=[]).push(doc)}
  else if(activePhotoTarget.type==='work'){(rr.workDocuments??=[]).push(doc)}
  else throw new Error('Für dieses Feld sind nur Bilder möglich.');
  saveState();renderStudent(activePhotoTarget.studentId,activePhotoTarget.unitId);return;
 }
 const data=await resizeImage(file,1000,.72);if(activePhotoTarget.type==='rating'&&activePhotoTarget.unitId&&activePhotoTarget.rubric){const rr=getRecord(activePhotoTarget.studentId,activePhotoTarget.unitId);rr.ratingPhotos=rr.ratingPhotos||{};rr.ratingPhotos[activePhotoTarget.rubric]=rr.ratingPhotos[activePhotoTarget.rubric]||[];rr.ratingPhotos[activePhotoTarget.rubric].push(data);saveState();renderStudent(activePhotoTarget.studentId,activePhotoTarget.unitId);return;}if(activePhotoTarget.type==='work'&&activePhotoTarget.unitId){const r=getRecord(activePhotoTarget.studentId,activePhotoTarget.unitId);r.workPhotos=r.workPhotos||[];r.workPhotos.push(data);saveState();renderStudent(activePhotoTarget.studentId,activePhotoTarget.unitId);return;}student(activePhotoTarget.studentId).photo=data;saveState();render()}
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
// Laufzeitstatus statt widerspruechlicher Meldungen aus mehreren Dialogen.
let syncLive={phase:'idle',message:'',verified:false,startedAt:0};
let syncAttempt=0;
const GRAPH_SCOPES=['User.Read','Files.ReadWrite.AppFolder'];
function msalConfig(){const cfg=window.HTL_CONFIG||{};return{auth:{clientId:state.settings.clientId||cfg.clientId||'',authority:`https://login.microsoftonline.com/${state.settings.tenantId||cfg.tenantId||'common'}`,redirectUri:cfg.redirectUri||location.origin+location.pathname},cache:{cacheLocation:'localStorage'}}}
// iOS home-screen apps cannot reliably open MSAL popups. Use full-page redirect there.
function isStandaloneIOS(){return /iPad|iPhone|iPod/.test(navigator.userAgent)&& (navigator.standalone===true || window.matchMedia('(display-mode: standalone)').matches)}
let msalReadyPromise=null;
async function readyMsal(){if(!msalReadyPromise){msalReadyPromise=(async()=>{const app=new msal.PublicClientApplication(msalConfig());await app.initialize?.();const redirectResult=await app.handleRedirectPromise();if(redirectResult?.account)app.setActiveAccount?.(redirectResult.account);msalApp=app;return app})().catch(e=>{msalReadyPromise=null;throw e})}return msalReadyPromise}
// Prefer the account chosen by the user; never silently switch back to the first cached account.
function selectedMicrosoftAccount(app){
 const active=app.getActiveAccount?.();
 if(active)return active;
 const accounts=app.getAllAccounts();
 if(accounts.length===1){app.setActiveAccount?.(accounts[0]);return accounts[0]}
 return null;
}
async function getGraphToken(interactive=true){
 const clientId=state.settings.clientId||(window.HTL_CONFIG||{}).clientId;
 if(!clientId)throw new Error('Bitte zuerst unter Einstellungen die Microsoft App Client-ID eintragen.');
 if(!window.msal)throw new Error('Microsoft-Anmeldemodul konnte nicht geladen werden.');
 const app=await readyMsal();let acc=selectedMicrosoftAccount(app);
 if(!acc){
  if(!interactive)throw new Error('Microsoft-Anmeldung erforderlich: Bitte das Konto im OneDrive-Fenster auswaehlen.');
  await app.loginRedirect({scopes:GRAPH_SCOPES,prompt:'select_account'});return null;
 }
 try{
  const result=await app.acquireTokenSilent({account:acc,scopes:GRAPH_SCOPES});
  if(!result?.accessToken)throw new Error('Microsoft hat kein Zugriffstoken geliefert.');
  return result.accessToken;
 }catch(e){
  if(!interactive)throw e;
  await app.acquireTokenRedirect({scopes:GRAPH_SCOPES,account:acc});return null;
 }
}
// The public GitHub Pages shell is not a security boundary. Keep all application UI
// hidden until Microsoft has issued a valid access token for the configured tenant.
async function requireMicrosoftLogin(){
 const overlay=document.getElementById('authGate');
 const message=document.getElementById('authMessage');
 const login=document.getElementById('authLogin');
 overlay.hidden=false;document.body.classList.add('auth-locked');
 login.disabled=true;
 message.textContent='Microsoft-Anmeldung wird geprüft …';
 try{
  if(!window.msal)throw new Error('Microsoft-Anmeldemodul nicht verfügbar. Bitte Internetverbindung prüfen.');
  const app=await readyMsal();
  const account=selectedMicrosoftAccount(app);
  if(!account)throw new Error('Bitte mit deinem Microsoft-Konto anmelden.');
  const result=await app.acquireTokenSilent({account,scopes:GRAPH_SCOPES});
  if(!result?.accessToken)throw new Error('Kein gültiges Zugriffstoken.');
  const expectedTenant=(window.HTL_CONFIG||{}).tenantId;
  if(expectedTenant && expectedTenant!=='common' && String(account.tenantId||'').toLowerCase()!==String(expectedTenant).toLowerCase())throw new Error('Dieses Microsoft-Konto gehört nicht zum freigegebenen Mandanten.');
  const allowed=(window.HTL_CONFIG||{}).allowedUsernames;
  if(Array.isArray(allowed)&&allowed.length&&!allowed.some(u=>String(u).toLowerCase()===String(account.username||'').toLowerCase()))throw new Error('Dieses Konto ist für i-i_Doku nicht freigegeben.');
  overlay.hidden=true;document.body.classList.remove('auth-locked');
  // Anmeldung ist nicht gleich erfolgreicher Datenabgleich.
  return;
 }catch(e){
  message.textContent=e?.message||String(e);
 }
 // Redirect instead of popup: the callback points to this same page, so a popup
 // would otherwise run the entire app inside the MSAL authentication window.
 login.disabled=false;
 login.onclick=async()=>{
  login.disabled=true;
  message.textContent='Weiterleitung zur Microsoft-Anmeldung …';
  try{
   const app=await readyMsal();
   await app.loginRedirect({scopes:GRAPH_SCOPES,prompt:'select_account'});
  }catch(e){
   message.textContent='Anmeldung konnte nicht gestartet werden: '+(e?.message||String(e));
   login.disabled=false;
  }
 };
 await new Promise(()=>{}); // boot resumes only after successful redirect on page reload
}
function lockApplication(){location.reload()}
// Explicit account reauthentication. Does not clear application or MSAL storage.
async function reauthenticateMicrosoft(useRedirect=false){
 if(!window.msal){alert('Microsoft-Anmeldemodul konnte nicht geladen werden.');return}
 try{
  const app=await readyMsal();
  await app.loginRedirect({scopes:GRAPH_SCOPES,prompt:'select_account'});
 }catch(e){alert('Microsoft-Anmeldung konnte nicht gestartet werden: '+(e?.message||String(e)))}
}

function isMicrosoftAuthError(message){return /invalid_authentication_token|unauthorized|login_required|interaction_required|consent_required|Microsoft-Anmeldung ist abgelaufen|Microsoft-Anmeldung erforderlich|kein gültiges Zugriffstoken/i.test(String(message||''))}
function syncErrorGerman(error){
 const raw=String(error?.message||error||'Unbekannter Fehler');
 const status=Number(error?.status)||0;
 if(status===401||/invalid_authentication_token|unauthorized|login_required|interaction_required|consent_required/i.test(raw))return 'Die Microsoft-Anmeldung ist abgelaufen oder nicht mehr gültig. Bitte erneut anmelden. Lokale Daten bleiben erhalten.';
 if(status===403)return 'OneDrive verweigert den Zugriff (HTTP 403). Bitte Konto und Dateiberechtigungen prüfen. Lokale Daten bleiben erhalten.';
 if(status===404)return 'Die benötigte OneDrive-Datei oder der Ordner wurde nicht gefunden (HTTP 404).';
 if(status===409||status===412)return 'OneDrive wurde zwischenzeitlich von einem anderen Gerät geändert. Der Abgleich wurde zum Schutz der Daten gestoppt. Bitte erneut abgleichen.';
 if(status===429)return 'OneDrive begrenzt derzeit die Anfragen (HTTP 429). Bitte später erneut versuchen.';
 if(status>=500)return 'Microsoft OneDrive ist derzeit nicht verfügbar (HTTP '+status+'). Bitte später erneut versuchen.';
 if(/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(raw))return 'Netzwerkfehler: Die Verbindung zu Microsoft OneDrive konnte nicht hergestellt oder abgeschlossen werden. Bitte Internetverbindung und Microsoft-Anmeldung prüfen. Es wurde kein erfolgreicher Abgleich bestätigt.';
 if(/timeout|timed out|aborted/i.test(raw))return 'Zeitüberschreitung beim OneDrive-Abgleich. Bitte Verbindung prüfen und später erneut versuchen.';
 if(/^Netzwerkfehler:|^Die Microsoft-Anmeldung|^OneDrive verweigert|^OneDrive wurde|^Microsoft OneDrive ist|^Zeitüberschreitung|^OneDrive-Abgleich fehlgeschlagen:/i.test(raw))return raw;
 return 'OneDrive-Abgleich fehlgeschlagen: '+raw;
}
async function graph(token,url,opts={}){
 let r;
 try{r=await fetch('https://graph.microsoft.com/v1.0'+url,{...opts,headers:{Authorization:`Bearer ${token}`,...(opts.headers||{})}})}
 catch(e){const err=new Error(syncErrorGerman(e));err.cause=e;throw err}
 if(!r.ok){let detail='';try{const body=await r.text();const parsed=JSON.parse(body);detail=parsed?.error?.code||''}catch(_){}const err=new Error(syncErrorGerman({status:r.status,message:detail||'HTTP '+r.status}));err.status=r.status;throw err}
 const ct=r.headers.get('content-type')||'';if(r.status===204)return null;if(ct.includes('json'))return r.json();return r.text()
}
async function appRoot(token){try{return await graph(token,'/me/drive/special/approot')}catch(e){throw new Error('OneDrive-Appordner konnte nicht geöffnet werden: '+syncErrorGerman(e))}}
async function remoteMeta(token,rootId){try{return await graph(token,`/me/drive/items/${rootId}:/htl-praxis-data.json`)}catch(e){if(e.status===404)return null;throw e}}
async function ensureChildFolder(token,parentId,name){try{return await graph(token,`/me/drive/items/${parentId}:/${encodeURIComponent(name)}`)}catch(e){if(e.status!==404)throw e;return graph(token,`/me/drive/items/${parentId}/children`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,folder:{},'@microsoft.graph.conflictBehavior':'rename'})})}}
async function uploadJson(token,parentId,name,obj,extraHeaders={}){return graph(token,`/me/drive/items/${parentId}:/${encodeURIComponent(name)}:/content`,{method:'PUT',headers:{'Content-Type':'application/json',...extraHeaders},body:JSON.stringify(obj)})}
async function downloadState(token,rootId){try{return await graph(token,`/me/drive/items/${rootId}:/htl-praxis-data.json:/content`)}catch(e){throw new Error('OneDrive-Datendatei konnte nicht heruntergeladen werden: '+syncErrorGerman(e))}}
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
 // Sicherheit: Fehlende Daten sind KEINE Loeschanweisung.
 if(local===undefined)return cloneData(remote);
 if(remote===undefined)return cloneData(local);
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
// Lokale Sicherheitskopien vor jedem Datenwechsel. Keine Schuelerdaten in localStorage.
async function saveSyncSafetySnapshot(reason){
 const key='sync-safety-'+new Date().toISOString()+'-'+Math.random().toString(36).slice(2,8);
 await idbSet(key,{reason,createdAt:new Date().toISOString(),state:cloneData(state)});
 return key;
}
function syncProgress(percent,message,status='running'){
 syncLive={phase:status,message,verified:status==='success',startedAt:syncLive.startedAt||Date.now()};
 updateHeaderStatus();refreshSyncDialogStatus();
 let el=document.getElementById('syncProgress7531');
 if(!el){el=document.createElement('div');el.id='syncProgress7531';el.setAttribute('role','status');el.setAttribute('aria-live','polite');el.style.cssText='position:fixed;bottom:16px;right:16px;z-index:99999;background:#173047;color:white;padding:14px 18px;border-radius:12px;box-shadow:0 4px 22px #0005;width:min(360px,calc(100vw - 32px));font:14px system-ui';document.body.appendChild(el)}
 const value=status==='success'?100:Math.max(0,Math.min(95,Number(percent)||0));
 const color=status==='error'?'#e88a8a':status==='success'?'#7bd5ae':'#8dc6ff';
 el.replaceChildren();
 const heading=document.createElement('div');heading.style.marginBottom='8px';heading.textContent=message;el.appendChild(heading);
 const track=document.createElement('div');track.style.cssText='height:10px;background:#ffffff44;border-radius:8px;overflow:hidden';
 const fill=document.createElement('div');fill.style.cssText='height:100%;transition:width .2s;background:'+color+';width:'+value+'%';track.appendChild(fill);el.appendChild(track);
 const footer=document.createElement('div');footer.style.cssText='font-size:12px;margin-top:5px';footer.textContent=value+' % · '+(status==='success'?'Erfolgreich abgeschlossen':status==='error'?'Fehlgeschlagen':'In Bearbeitung');el.appendChild(footer);
 el.onclick=null;el.style.cursor='default';el.title='';
 if(status!=='running'){const close=document.createElement('button');close.type='button';close.textContent='Schließen';close.style.cssText='margin-top:8px;padding:4px 9px;cursor:pointer';close.onclick=()=>el.remove();el.appendChild(close)}
}

async function commitSync(remote,meta){const localPrefs={clientId:state.settings?.clientId,tenantId:state.settings?.tenantId,autoSync:state.settings?.autoSync};
 const base=syncData(remote);await idbSet(SYNC_BASE_KEY,base);
 state.sync={...(state.sync||{}),remoteETag:meta?.eTag||'',remoteModifiedAt:meta?.lastModifiedDateTime||'',lastSyncedAt:new Date().toISOString(),lastError:'',dirtySince:''};
 state.settings={...state.settings,...localPrefs};await idbSet('state',state);updateHeaderStatus();}
function syncError(e,silent){state.sync=state.sync||{};state.sync.lastError=syncErrorGerman(e);state.sync.lastFailedAt=new Date().toISOString();if(state.settings?.autoSync){state.settings.autoSync=false;state.sync.lastError+=' Automatischer Abgleich wurde vorsorglich deaktiviert.'}idbSet('state',state).catch(console.warn);updateHeaderStatus();refreshSyncDialogStatus();if(!silent)alert(state.sync.lastError)}
async function syncNow({silent=false,downloadOnly=false,resolutions={}}={}){
 if(syncBusy){if(!silent)alert('Ein OneDrive-Abgleich läuft bereits. Bitte dessen Abschluss abwarten.');return false;}
 syncBusy=true;syncAttempt++;syncLive={phase:'running',message:'Abgleich gestartet',verified:false,startedAt:Date.now()};
 syncProgress(5,'Sicheren Datenabgleich vorbereiten');
 const before=dataFingerprint(state);
 try{
  syncProgress(12,'Microsoft-Anmeldung pruefen');
  const token=await getGraphToken(!silent);
  if(!token){syncProgress(12,'Microsoft-Anmeldung erforderlich – kein Datenabgleich erfolgt','error');return false} // Redirect-Anmeldung laeuft
  syncProgress(25,'OneDrive-Datenstand pruefen');
  const root=await appRoot(token),meta=await remoteMeta(token,root.id);
  let base=await getSyncBase();
  if(!meta){
   if(downloadOnly){syncProgress(25,'Kein Cloud-Datenstand vorhanden','error');if(!silent)alert('Noch kein Datenbestand in OneDrive.');return false}
   await saveSyncSafetySnapshot('Vor erstem OneDrive-Abgleich');
   const payload=cloneData(state);payload.sync={};
   const saved=await uploadJson(token,root.id,'htl-praxis-data.json',payload,{'If-None-Match':'*'});
   if(before!==dataFingerprint(state))throw Error('Waehrend des Abgleichs wurden weitere lokale Aenderungen vorgenommen. Bitte erneut synchronisieren.');
   const initialMeta=await remoteMeta(token,root.id);
   const initialData=await downloadState(token,root.id);
   if(!initialMeta?.eTag||initialMeta.eTag!==saved?.eTag||!dataEqual(syncData(typeof initialData==='string'?JSON.parse(initialData):initialData),syncData(payload)))throw Error('Erster Upload konnte nicht vollständig bestätigt werden.');
   await commitSync(payload,initialMeta);syncProgress(100,'Erster OneDrive-Abgleich überprüft','success');if(!silent){closeModal();alert('Erster OneDrive-Abgleich erfolgreich.')}return true;
  }
  // Auch bei unveraendertem ETag die Cloud-Daten tatsaechlich lesen und vergleichen.
  syncProgress(42,'OneDrive-Daten herunterladen');
  const remoteRaw=await downloadState(token,root.id);const remote=migrate(cloneData(typeof remoteRaw==='string'?JSON.parse(remoteRaw):remoteRaw));
  if(before!==dataFingerprint(state))throw Error('Lokale Daten haben sich waehrend des Downloads geaendert. Bitte erneut synchronisieren.');
  const checkMeta=await remoteMeta(token,root.id);
  if(!checkMeta||checkMeta.eTag!==meta.eTag)throw Error('Der Cloud-Datenstand hat sich während des Lesens geändert. Bitte erneut abgleichen.');
  const local=syncData(state),cloud=syncData(remote);
  // Upgrade from older app: unchanged remote ETag is a trustworthy common base.
  if(!base&&state.sync?.remoteETag&&state.sync.remoteETag===meta.eTag)base=cloud;
  let merged;
  if(!base){
   // Ohne gemeinsamen Basisstand niemals einen kompletten Stand uebernehmen.
   // Bei unterschiedlichen Werten manueller Konflikt statt stiller Ueberschreibung.
   const conflicts=[];merged=mergeThree(undefined,local,cloud,'',conflicts,resolutions);
   if(conflicts.length){state.sync.lastError='Erster Abgleich: unterschiedliche Daten ohne gemeinsamen Basisstand. Bitte Konflikte pruefen.';updateHeaderStatus();syncProgress(62,'Datenkonflikt – kein Abgleich durchgeführt','error');if(!silent)showSyncConflicts(conflicts,resolutions);return false}
  }else{
   const conflicts=[];merged=mergeThree(base,local,cloud,'',conflicts,resolutions);
   if(conflicts.length){
    state.sync.lastError=conflicts.length+' gleichzeitige Aenderung(en) am selben Datenfeld. Kein automatisches Ueberschreiben.';
    state.sync.conflicts=conflicts.map(c=>c.path);
    updateHeaderStatus();syncProgress(62,'Datenkonflikt – kein Abgleich durchgeführt','error');if(!silent)showSyncConflicts(conflicts,resolutions);
    return false;
   }
  }
  syncProgress(62,'Daten auf Unterschiede pruefen');
  if(downloadOnly&& !dataEqual(local,merged)){
   if(!dataEqual(local,base||cloud)){
    syncProgress(62,'Lokale Änderungen – Übernahme gestoppt','error');if(!silent)alert('Es gibt lokale Aenderungen. Bitte „Jetzt abgleichen“ verwenden, um sie mit der Cloud zusammenzufuehren.');return false;
   }
  }
  if(dataEqual(merged,cloud)){
   if(before!==dataFingerprint(state))throw Error('Lokale Daten wurden während des Abgleichs geändert. Bitte erneut synchronisieren.');
   if(!dataEqual(local,merged))await saveSyncSafetySnapshot('Vor Uebernahme aus OneDrive');
   syncProgress(83,'Zusammengefuehrte Daten lokal sichern');
   applySyncData(merged);await commitSync(remote,meta);renderAfterSync();syncProgress(100,'Cloud-Daten erfolgreich geprüft und lokal gesichert','success');if(!silent){closeModal();alert('OneDrive ist aktuell. Aenderungen wurden uebernommen.')}return true;
  }
  // Cloud nur bei unveraendertem ETag ersetzen. Bei parallelem Schreibzugriff wird 412 gemeldet.
  syncProgress(72,'Sicherheitskopien erstellen');
  await saveSyncSafetySnapshot('Vor OneDrive-Upload und Datenzusammenfuehrung');
  await makeRemoteBackup(token,root.id,remoteRaw);
  const payload={...remote,...merged,sync:{}};
  syncProgress(85,'Daten sicher zu OneDrive uebertragen');
  const saved=await uploadJson(token,root.id,'htl-praxis-data.json',payload,{'If-Match':meta.eTag});
  syncProgress(92,'OneDrive-Upload überprüfen');
  const confirmedMeta=await remoteMeta(token,root.id);
  if(!confirmedMeta||!confirmedMeta.eTag||confirmedMeta.eTag!==saved?.eTag)throw Error('Der Upload wurde nicht eindeutig durch OneDrive bestätigt. Datenstand bitte prüfen; kein erfolgreicher Abgleich markiert.');
  const confirmedRaw=await downloadState(token,root.id);
  const confirmed=typeof confirmedRaw==='string'?JSON.parse(confirmedRaw):confirmedRaw;
  if(!dataEqual(syncData(confirmed),syncData(payload)))throw Error('Die Datenprüfung nach dem Upload ist fehlgeschlagen. Kein erfolgreicher Abgleich bestätigt.');
  if(before!==dataFingerprint(state))throw Error('Lokale Aenderung waehrend des Uploads. Cloud ist gespeichert; bitte erneut abgleichen, um die neue Aenderung zu uebernehmen.');
  applySyncData(merged);await commitSync(payload,saved);renderAfterSync();syncProgress(100,'Daten in OneDrive überprüft – Abgleich erfolgreich','success');if(!silent){closeModal();alert('Aenderungen beider Geraete erfolgreich zusammengefuehrt.')}return true;
 }catch(e){syncError(e,silent);syncProgress(0,state.sync.lastError,'error');return false}
 finally{syncBusy=false}

}
// Lesbare Konfliktanzeige; die eigentliche 3-Wege-Merge-Logik bleibt unveraendert.
const SYNC_FIELD_LABELS={
 showNotesInOverview:'Notiz in der Gruppenübersicht anzeigen',notes:'Notizen',topic:'Unterrichtsstoff',date:'Datum',
 teacherName:'Lehrperson',teacherArrive:'Ankunft Lehrperson',teacherLeave:'Ende Lehrperson',
 absent:'Ganztägig abwesend',arrive:'Kommt (Uhrzeit)',leave:'Geht (Uhrzeit)',
 arriveReason:'Grund für spätes Kommen',leaveReason:'Grund für früheres Gehen',
 absenceOverride:'Manuelle Fehlstunden',topicOverride:'Individueller Unterrichtsstoff',
 comment:'Bemerkung',ratings:'Bewertungen',ratingNotes:'Bewertungsnotizen',ratingPhotos:'Bewertungsfotos',
 workPhotos:'Werkstückfotos',bonus:'Zusatzpunkte',bonusPoints:'Zusatzpunkte',bonusFactor:'Faktor Zusatzpunkte',
 name:'Name',code:'Klassenbezeichnung',groupId:'Gruppe',classId:'Klasse',photo:'Schülerfoto',
 strengths:'Stärken',supportNeed:'Förderbedarf',supportGoal:'Förderziel',
 signature:'Unterschrift',signedAt:'Unterschriftsdatum',signedBy:'Unterschrift von',
 weight:'Gewichtung',points:'Punkte',maxPoints:'Maximalpunkte',checked:'Erledigt',
 settings:'Einstellungen',classes:'Klassen',students:'Schüler',units:'Unterrichtseinheiten',
 records:'Einheitsbewertungen',curriculum:'Lehrplan',materials:'Materialien',scripts:'Skripte',
 generalChecklists:'Allgemeine Checklisten',checklists:'Checklisten',activeYear:'Aktuelles Schuljahr'
};
function syncFieldName(key){return SYNC_FIELD_LABELS[key]||key.replace(/([a-zäöü])([A-Z])/g,'$1 $2').replace(/_/g,' ')}
function syncConflictDescription(path){
 const parts=String(path).match(/[^.\[\]]+/g)||[];
 const section=parts[0]||'',id=parts[1]||'';
 const unit=state.units?.find(u=>u.id===id);
 const pupil=state.students?.find(s=>s.id===id);
 const klass=state.classes?.find(c=>c.id===id);
 const groupFor=(cid,gid)=>state.classes?.find(c=>c.id===cid)?.groups?.find(g=>g.id===gid);
 let location=[];
 if(unit){const c=cls(unit.classId),g=groupFor(unit.classId,unit.groupId);location=[c?.code,g?.name,unit.date?fmtDate(unit.date):'',unit.topic].filter(Boolean);}
 else if(pupil){const c=cls(pupil.classId),g=groupFor(pupil.classId,pupil.groupId);location=[c?.code,g?.name,pupil.name].filter(Boolean);}
 else if(klass)location=[klass.code||klass.label].filter(Boolean);
 else if(section==='records'){
  const ids=id.split('::');const st=student(ids[0]),un=state.units?.find(u=>u.id===ids[1]);
  if(st)location=[cls(st.classId)?.code,groupFor(st.classId,st.groupId)?.name,st.name].filter(Boolean);
  if(un)location.push([un.date?fmtDate(un.date):'',un.topic].filter(Boolean).join(' · '));
 }
 if(!location.length)location=[syncFieldName(section)];
 const last=parts.at(-1)||section;
 const field=syncFieldName(last);
 const extra=parts.slice(section==='records'?2:2,-1).filter(x=>x!==last).map(syncFieldName);
 return {location:location.join(' → '),field:extra.length?extra.join(' → ')+' → '+field:field};
}
function syncConflictValue(v){
 if(v===undefined)return 'Nicht vorhanden / gelöscht';
 if(v===null)return 'Leer (null)';
 if(typeof v==='boolean')return v?'Ja':'Nein';
 if(typeof v==='string'){
  if(!v)return 'Leer';
  if(/^data:image\//.test(v))return 'Bild / Unterschrift vorhanden (Bilddaten ausgeblendet)';
  return v.length>1200?v.slice(0,1200)+' … (gekürzt)':v;
 }
 if(typeof v==='number')return String(v).replace('.',',');
 const value=JSON.stringify(v,null,2);
 return value.length>1800?value.slice(0,1800)+' … (gekürzt)':value;
}
function showSyncConflicts(conflicts,previous={}){
 const rows=conflicts.slice(0,40).map((c,i)=>{
  const d=syncConflictDescription(c.path);
  return `<section class="sync-conflict-item" style="border:1px solid #cbd5e1;border-radius:10px;padding:14px;margin:12px 0">
   <div class="small" style="color:#52677a">Konflikt ${i+1} von ${conflicts.length} · ${escapeHtml(d.location)}</div>
   <b>${escapeHtml(d.field)}</b>
   <div class="sync-conflict-compare" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px;margin:12px 0">
    <div style="border:1px solid #d8e0e8;border-radius:7px;padding:10px;min-width:0"><b>Dieser Computer (lokal)</b><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:190px;overflow:auto;margin-bottom:0">${escapeHtml(syncConflictValue(c.local))}</pre></div>
    <div style="border:1px solid #d8e0e8;border-radius:7px;padding:10px;min-width:0"><b>OneDrive (Cloud)</b><pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:190px;overflow:auto;margin-bottom:0">${escapeHtml(syncConflictValue(c.remote))}</pre></div>
   </div>
   <label for="confChoice${i}">Welche Fassung soll übernommen werden?</label>
   <select id="confChoice${i}" data-resolve="${i}" style="width:100%"><option value="">Bitte entscheiden</option><option value="local" ${previous[c.path]==='local'?'selected':''}>Lokale Fassung – dieser Computer</option><option value="remote" ${previous[c.path]==='remote'?'selected':''}>OneDrive-Fassung – Cloud</option></select>
   <details style="margin-top:9px"><summary>Technische Details anzeigen</summary><code style="overflow-wrap:anywhere">${escapeHtml(c.path)}</code></details>
  </section>`;
 }).join('');
 openModal(`<h2>Synchronisationskonflikt</h2><p>${conflicts.length} Felder wurden parallel geändert. Vergleiche die Werte und entscheide für jedes Feld. Vor der Bestätigung wird nichts überschrieben.</p>${rows}${conflicts.length>40?'<p>Mehr als 40 Konflikte: Bitte zuerst Daten sichern und manuell prüfen.</p>':''}<div class="modal-actions"><button class="btn secondary" id="confBackup">Backup exportieren</button><button class="btn secondary" id="confClose">Abbrechen</button><button class="btn" id="confResolve" ${conflicts.length>40?'disabled':''}>Auswahl übernehmen und abgleichen</button></div>`);
 document.getElementById('confBackup').onclick=exportBackup;
 document.getElementById('confClose').onclick=closeModal;
 document.getElementById('confResolve').onclick=()=>{
  const choices={...previous};for(let i=0;i<conflicts.length;i++){const value=document.querySelector(`[data-resolve="${i}"]`).value;if(!value){alert('Bitte für jeden Konflikt eine Fassung auswählen.');return}choices[conflicts[i].path]=value}
  closeModal();syncNow({silent:false,resolutions:choices});
 };
}
async function syncPull({silent=false}={}){return syncNow({silent,downloadOnly:true})}
async function syncPush({silent=false}={}){return syncNow({silent})}
// 7.5.36: Debounce for edits; remote metadata-only checks when local data is clean.
const AUTO_SYNC_DELAY=30000, AUTO_CHECK_INTERVAL=300000;
let lastAutoAttempt=0;
function scheduleAutoSync(){
 clearTimeout(autoSyncTimer);
 if(!state?.settings?.autoSync||!navigator.onLine||syncBusy||editingInProgress()||state.sync?.lastError)return;
 autoSyncTimer=setTimeout(()=>autoSyncNow(),AUTO_SYNC_DELAY);
}
async function autoSyncNow(){
 if(!state?.settings?.autoSync||!navigator.onLine||syncBusy||editingInProgress()||state.sync?.lastError)return false;
 if(Date.now()-lastAutoAttempt<25000)return false;
 lastAutoAttempt=Date.now();
 // A clean local copy only needs a cheap metadata request; full sync on changes.
 if(!state.sync?.dirtySince&&state.sync?.remoteETag){
  syncBusy=true;
  try{
   const token=await getGraphToken(false);if(!token)return false;
   const root=await appRoot(token),meta=await remoteMeta(token,root.id);
   if(meta?.eTag===state.sync.remoteETag){
    state.sync.lastCheckedAt=new Date().toISOString();
    await idbSet('state',state);syncLive={phase:'success',message:'OneDrive-Datenstand geprüft – unverändert',verified:true,startedAt:Date.now()};updateHeaderStatus();refreshSyncDialogStatus();return true;
   }
  }catch(e){syncError(e,true);return false}
  finally{syncBusy=false}
 }
 return syncNow({silent:true});
}
function syncDialog(){const s=state.sync||{};openModal(`<h2>OneDrive Synchronisierung</h2><p><b>Keine automatische Loeschung:</b> Fehlende Cloud- oder Lokaldaten werden beim Abgleich bewahrt. Vor kritischen Datenwechseln wird lokal eine Sicherheitskopie angelegt. Ein altes Backup gezielt wiederherzustellen ist ein gesonderter Vorgang.</p><p>Automatischer 3-Wege-Abgleich: Aenderungen an verschiedenen Schuelern, Einheiten und Feldern werden zusammengefuehrt. Bei gleichzeitiger Bearbeitung desselben Feldes wird sicherheitshalber angehalten.</p><div class="system-grid"><div><b>Letzter Abgleich</b><br>${escapeHtml(s.lastSyncedAt?new Date(s.lastSyncedAt).toLocaleString('de-AT'):'noch nie')}</div><div><b>Lokale Aenderungen</b><br>${s.dirtySince?'ja':'nein'}</div><div><b>Auto-Sync</b><br>${state.settings.autoSync?'ein':'aus'}</div><div><b>Status</b><br><span id="syncDialogStatus7533">${escapeHtml(s.lastError?'Fehler – bitte prüfen':s.lastSyncedAt?'Letzter Abgleich erfolgreich':'Noch kein Abgleich')}</span></div></div><div id="syncDialogError7533" class="notice error-note" ${s.lastError?'':'hidden'}>${escapeHtml(s.lastError||'')}</div><div class="field"><p><b>Microsoft-Anmeldung</b>: Bei abgelaufener Anmeldung hier erneut anmelden. Die lokalen Daten bleiben erhalten.</p><button type="button" class="btn secondary" id="reauthMicrosoft">Erneut bei Microsoft anmelden</button> <button type="button" class="btn secondary" id="reauthRedirect">Anmeldung über Weiterleitung</button></div><div class="field"><label><input type="checkbox" id="autoSyncToggle" ${state.settings.autoSync?'checked':''}> Automatisch: nach Änderungen (30 Sekunden), Cloud prüfen (alle 5 Minuten)</label></div><div class="modal-actions"><button class="btn secondary" id="syncBackup">Backup exportieren</button><button class="btn" id="push">Mit OneDrive abgleichen</button></div>`);
 document.getElementById('push').onclick=()=>syncNow({silent:false});document.getElementById('syncBackup').onclick=exportBackup;document.getElementById('reauthMicrosoft').onclick=()=>reauthenticateMicrosoft(false);document.getElementById('reauthRedirect').onclick=()=>{if(confirm('Die App wird zur Microsoft-Anmeldung weitergeleitet. Vorher bitte ein Backup exportieren, falls lokale Aenderungen vorhanden sind. Fortfahren?'))reauthenticateMicrosoft(true)};
 document.getElementById('autoSyncToggle').onchange=e=>{state.settings.autoSync=e.target.checked;if(e.target.checked){state.sync.lastError='';}saveState();if(e.target.checked)scheduleAutoSync()};refreshSyncDialogStatus();}
function refreshSyncDialogStatus(){
 const el=document.getElementById('syncDialogStatus7533');if(!el||!state)return;
 const s=state.sync||{};
 el.textContent=syncLive.phase==='running'?'Abgleich läuft':syncLive.phase==='error'?'Fehlgeschlagen':syncLive.phase==='success'?'Erfolgreich geprüft':s.lastError?'Fehler – bitte prüfen':s.lastSyncedAt?'Letzter Abgleich erfolgreich':'Noch kein Abgleich';
 const error=document.getElementById('syncDialogError7533');if(error){const msg=syncLive.phase==='error'?syncLive.message:s.lastError||'';error.textContent=msg;error.hidden=!msg;}
 const btn=document.getElementById('push');if(btn)btn.disabled=syncBusy;
}
function updateHeaderStatus(){
 const el=document.getElementById('syncStatus');if(!el||!state)return;
 const s=state.sync||{};
 let label,cls='';
 if(syncLive.phase==='running'){label='OneDrive: Abgleich läuft';}
 else if(syncLive.phase==='error'){label=isMicrosoftAuthError(syncLive.message)?'OneDrive: Anmeldung erforderlich':'OneDrive: Abgleich fehlgeschlagen';cls='bad';}
 else if(syncLive.phase==='success'){label=s.dirtySince?'OneDrive: lokal geändert':'OneDrive: geprüft';cls=s.dirtySince?'':'good';}
 else if(s.lastError){label=isMicrosoftAuthError(s.lastError)?'OneDrive: Anmeldung erforderlich':'OneDrive: Fehler – prüfen';cls='bad';}
 else if(s.dirtySince){label='OneDrive: lokal geändert';}
 else if(s.lastSyncedAt){label='OneDrive: zuletzt synchronisiert';cls='good';}
 else label='OneDrive: nicht abgeglichen';
 el.textContent=label;el.className='sync-status '+cls;
 el.title=s.lastSyncedAt?'Letzter bestätigter Abgleich: '+new Date(s.lastSyncedAt).toLocaleString('de-AT'):'';
}


// --- PWA Updates ---
let swRegistration=null,deferredInstallPrompt=null;
function showUpdateBanner(version){const b=document.getElementById('updateBanner');if(!b)return;document.getElementById('updateText').textContent=`Neue Version ${version||''} verfügbar`;b.hidden=false}
function hideUpdateBanner(){const b=document.getElementById('updateBanner');if(b)b.hidden=true}
function compareAppVersions(a,b){const parts=v=>String(v||'').split('.').map(x=>parseInt(x,10)||0);const x=parts(a),y=parts(b);for(let i=0;i<Math.max(x.length,y.length);i++){if((x[i]||0)!==(y[i]||0))return (x[i]||0)>(y[i]||0)?1:-1}return 0}
async function checkForUpdates(silent=true){try{const r=await fetch(`./version.json?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('Versionsdatei nicht erreichbar');const v=await r.json();if(v.version&&compareAppVersions(v.version,APP_VERSION)>0){showUpdateBanner(v.version);if(swRegistration)await swRegistration.update();if(!silent)alert(`Neue Version ${v.version} ist verfügbar.`)}else {hideUpdateBanner();if(!silent)alert(`HTL Praxis ist aktuell (Version ${APP_VERSION}).`)}}catch(e){if(!silent)alert('Updateprüfung nicht möglich: '+e.message)}}
async function applyUpdate(){if(swRegistration){await swRegistration.update();if(swRegistration.waiting){swRegistration.waiting.postMessage({type:'SKIP_WAITING'});return}const installing=swRegistration.installing;if(installing){installing.addEventListener('statechange',()=>{if(installing.state==='installed')installing.postMessage({type:'SKIP_WAITING'})});return}}location.reload()}
async function initPwa(){if(!('serviceWorker'in navigator)||location.protocol==='file:')return;try{swRegistration=await navigator.serviceWorker.register('./sw.js');navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload());swRegistration.addEventListener('updatefound',()=>{const w=swRegistration.installing;if(!w)return;w.addEventListener('statechange',()=>{if(w.state==='installed'&&navigator.serviceWorker.controller)checkForUpdates(true)})});setTimeout(()=>checkForUpdates(true),2500);setInterval(()=>checkForUpdates(true),30*60*1000)}catch(e){console.warn('Service worker',e)}}
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstallPrompt=e;const b=document.getElementById('btnInstall');if(b)b.hidden=false});
window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;const b=document.getElementById('btnInstall');if(b)b.hidden=true});

// UI bindings
function bindUi(){document.getElementById('btnLock').onclick=lockApplication;document.getElementById('btnDashboard').onclick=()=>{route={type:'dashboard'};render()};document.getElementById('btnImport').onclick=importDialog;document.getElementById('btnSettings').onclick=settingsDialog;document.getElementById('btnSync').onclick=syncDialog;document.getElementById('btnAddClass').onclick=addClassDialog;document.getElementById('yearSelect').onchange=e=>{state.activeYear=e.target.value;saveState();route={type:'dashboard'};render()};document.getElementById('fileImport').onchange=e=>{if(e.target.files[0])importCsv(e.target.files[0]);e.target.value=''};document.getElementById('curriculumImport').onchange=e=>{if(e.target.files[0])importCurriculumFile(e.target.files[0]);e.target.value=''};document.getElementById('photoPicker').onchange=e=>{if(e.target.files[0])processPhoto(e.target.files[0]);e.target.value=''};document.getElementById('btnInstall').onclick=async()=>{if(deferredInstallPrompt){deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;document.getElementById('btnInstall').hidden=true}else alert('Im Browser-Menü „App installieren“ bzw. am Handy „Zum Startbildschirm hinzufügen“ wählen.')};document.getElementById('applyUpdate').onclick=applyUpdate;document.getElementById('dismissUpdate').onclick=hideUpdateBanner}
async function boot(){state=makeInitialState();await requireMicrosoftLogin();state=await loadState();applySchoolBranding();bindUi();initPlanning7528();render();updateHeaderStatus();await initPwa();window.addEventListener('online',()=>{updateHeaderStatus();if(state.settings.autoSync)autoSyncNow()});window.addEventListener('offline',updateHeaderStatus);window.addEventListener('focus',()=>{if(state.settings.autoSync&&Date.now()-lastAutoAttempt>AUTO_CHECK_INTERVAL)autoSyncNow()});setInterval(()=>{if(state.settings.autoSync&&navigator.onLine)autoSyncNow()},AUTO_CHECK_INTERVAL);if(state.settings.autoSync&&navigator.onLine)setTimeout(()=>autoSyncNow(),3000)}
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
