
(() => {
const DAYS=["L","M","X","J","V","S","D"];
const MONTHS=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const STATE_KEY="vista-semanal-state-v3";
const WORDS_KEY="vista-semanal-words"; // clave estable: no cambia entre versiones
const LEGACY_WORD_KEYS=["vista-semanal-words-v2","vista-semanal-words-v1"];
const LEGACY_DATA_KEYS=["vista-semanal-data-v2","vista-semanal-simple-v4"];
const LEGACY_IMPORTANT_KEYS=["vista-semanal-important-v1"];
const MIGRATION_KEY="vista-semanal-migrated-v3";
const DEFAULT_WORDS=[
{text:"Casa",color:"#13bde8",textColor:"#111111"},
{text:"Gym",color:"#63D471",textColor:"#111111"},
{text:"Gym",color:"#63D471",textColor:"#111111"},
{text:"Cardio",color:"#FF9F43",textColor:"#111111"},
{text:"Oficina",color:"#0b5ed7",textColor:"#111111"},
{text:"Cardio",color:"#FF9F43",textColor:"#111111"},
{text:"Libre",color:"#D9D9D9",textColor:"#111111"},
{text:"Borrar",color:"#ffffff",textColor:"#b80016",action:"clear"}
];
const PALETTE=["#ffffff","#FF6B6B","#FF9F43","#FFD54A","#63D471","#13bde8","#0b5ed7","#B57BFF","#D9D9D9"];
function load(k,fb){try{const x=localStorage.getItem(k);return x===null?fb:JSON.parse(x)}catch{return fb}}
function clone(x){return JSON.parse(JSON.stringify(x))}
function pad(n){return String(n).padStart(2,"0")}
function isoDate(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function parseISO(s){const [y,m,d]=s.split("-").map(Number);return new Date(y,m-1,d)}
function addDays(s,n){const d=parseISO(s);d.setDate(d.getDate()+n);return isoDate(d)}
function mondayOf(d=new Date()){const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());const idx=(x.getDay()+6)%7;x.setDate(x.getDate()-idx);return x}
// Las columnas siguen siendo L-M-X-J-V-S-D, pero cada una muestra la próxima fecha de ese día.
// Ejemplo: si hoy es martes 11, L=17, M=11, X=12, J=13...
function weekDates(){const n=new Date(),base=new Date(n.getFullYear(),n.getMonth(),n.getDate()),todayIdx=(base.getDay()+6)%7;return Array.from({length:7},(_,i)=>{const d=new Date(base);d.setDate(base.getDate()+((i-todayIdx+7)%7));return isoDate(d)})}
function dayIndexFromISO(s){return (parseISO(s).getDay()+6)%7}
function formatTime(min){min=Math.max(0,Math.min(1440,+min||0));const h=Math.floor(min/60),m=min%60;return `${h}:${pad(m)}`}
function eventStartMin(e){return Number.isFinite(+e?.startMin)?+e.startMin:(+e?.startHour||0)*60}
function eventEndMin(e){return Number.isFinite(+e?.endMin)?+e.endMin:(+e?.endHour||((+e?.startHour||0)+1))*60}
function eventStartHour(e){return Math.floor(eventStartMin(e)/60)}
function eventEndHourExclusive(e){return Math.ceil(eventEndMin(e)/60)}
function norm(c){return(c&&c[0]==="#")?c:"#ffffff"}
function uid(){return `e${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`}

let state=load(STATE_KEY,{cells:{},events:[]});
if(!state||typeof state!=="object")state={cells:{},events:[]};
if(!state.cells)state.cells={};if(!Array.isArray(state.events))state.events=[];
let words=load(WORDS_KEY,null);
if(!Array.isArray(words)){for(const k of LEGACY_WORD_KEYS){const w=load(k,null);if(Array.isArray(w)){words=w;break}}}
if(!Array.isArray(words))words=clone(DEFAULT_WORDS);
const fixed=[];for(let i=0;i<8;i++){const w=words[i];if(i===7)fixed[i]={text:"Borrar",color:"#ffffff",textColor:"#b80016",action:"clear"};else if(w&&w.text!==undefined)fixed[i]={text:w.text,color:w.color||DEFAULT_WORDS[i].color,textColor:w.textColor||DEFAULT_WORDS[i].textColor};else fixed[i]=clone(DEFAULT_WORDS[i]);}words=fixed;

function saveState(){localStorage.setItem(STATE_KEY,JSON.stringify(state))}
function saveWords(){localStorage.setItem(WORDS_KEY,JSON.stringify(words))}
function migrateLegacy(){if(load(MIGRATION_KEY,false))return;const dates=weekDates();let legacy=null;for(const k of LEGACY_DATA_KEYS){const x=load(k,null);if(x&&Object.keys(x).length){legacy=x;break}}let imp={};for(const k of LEGACY_IMPORTANT_KEYS){const x=load(k,null);if(x&&Object.keys(x).length){imp=x;break}}
if(legacy){for(const [k,v] of Object.entries(legacy)){const m=k.match(/^(\d)-(\d{1,2})$/);if(!m||!v?.text)continue;const d=+m[1],h=+m[2];const date=dates[d];state.cells[`${date}-${pad(h)}`]={text:v.text,color:norm(v.color),textColor:v.textColor||"#111111",important:!!imp[k]};}}
localStorage.setItem(MIGRATION_KEY,"true");saveState();saveWords()}
migrateLegacy();

let undoStack=[];
let selectedWord=null,selectedCell=null,editTarget=null,drag=false,dragValue=null,longTimer=null,suppressClick=false;
let eventEdit={mode:"new",eventId:null,date:null,scope:"day"};
const monthTitle=document.getElementById("monthTitle"),dayRow=document.getElementById("dayRow"),grid=document.getElementById("grid"),wordbar=document.getElementById("wordbar"),modal=document.getElementById("modal"),textInput=document.getElementById("textInput"),noteInput=document.getElementById("noteInput"),cellNoteField=document.getElementById("cellNoteField"),colorInput=document.getElementById("colorInput"),textColorInput=document.getElementById("textColorInput"),modalTitle=document.getElementById("modalTitle"),palette=document.getElementById("palette"),previewCard=document.getElementById("previewCard"),undoBtn=document.getElementById("undoBtn"),importantBtn=document.getElementById("importantBtn"),planBtn=document.getElementById("planBtn");
const eventModal=document.getElementById("eventModal"),eventTitle=document.getElementById("eventTitle"),eventText=document.getElementById("eventText"),eventNote=document.getElementById("eventNote"),eventDate=document.getElementById("eventDate"),eventRepeat=document.getElementById("eventRepeat"),eventStart=document.getElementById("eventStart"),eventEnd=document.getElementById("eventEnd"),eventUntil=document.getElementById("eventUntil"),eventColor=document.getElementById("eventColor"),eventTextColor=document.getElementById("eventTextColor"),eventImportant=document.getElementById("eventImportant"),repeatBox=document.getElementById("repeatBox"),weekdayPicker=document.getElementById("weekdayPicker"),scopeRow=document.getElementById("scopeRow"),eventListModal=document.getElementById("eventListModal"),eventList=document.getElementById("eventList");

function snap(){undoStack=[{state:JSON.stringify(state),words:JSON.stringify(words)}];undoBtn.disabled=false}
function undo(){if(!undoStack.length)return;const s=undoStack.pop();state=JSON.parse(s.state);words=JSON.parse(s.words);saveState();saveWords();undoBtn.disabled=true;render()}
function cellKey(date,h){return `${date}-${pad(h)}`}
function slotEnd(date,h){const d=parseISO(date);d.setHours(h+1,0,0,0);return d}
function effectiveDate(displayDate,h){return slotEnd(displayDate,h)<=new Date()?addDays(displayDate,7):displayDate}
// Para una franja ya terminada, la celda queda vacía salvo que el usuario la haya editado manualmente para la próxima semana.
// Los eventos planificados/repetitivos futuros NO se muestran antes de que su fecha llegue a la cabecera.
function visibleResolved(displayDate,h){
 const now=new Date();
 if(slotEnd(displayDate,h)<=now){
   const nextDate=addDays(displayDate,7),manual=state.cells[cellKey(nextDate,h)];
   return manual?{...manual,source:"cell",sourceId:cellKey(nextDate,h),startHour:h,endHour:h+1,date:nextDate}:null;
 }
 return resolved(displayDate,h)
}
function cleanupPast(){const now=new Date();let changed=false;for(const k of Object.keys(state.cells)){const m=k.match(/^(\d{4}-\d{2}-\d{2})-(\d{2})$/);if(!m)continue;const date=m[1],h=+m[2];if(slotEnd(date,h)<=now){delete state.cells[k];changed=true}}
state.events=state.events.filter(e=>{if(e.repeat&&e.repeat!=="none")return true;const end=eventEndMin(e),d=parseISO(e.date);d.setHours(Math.floor(end/60),end%60,0,0);if(d<=now){changed=true;return false}return true});if(changed)saveState()}
function eventMatches(e,date,h){if(!e||e.disabled)return false;let spec=e;if(e.repeat&&e.repeat!=="none"){
 if(date<e.startDate)return false;if(e.until&&date>e.until)return false;
 const ex=e.exceptions?.[date];if(ex?.cancelled)return false;if(ex)spec={...e,...ex};
 const dow=dayIndexFromISO(date),startDow=dayIndexFromISO(e.startDate);
 if(e.repeat==="daily"){} else if(e.repeat==="weekdays"&&dow>4)return false; else if(e.repeat==="weekly"&&dow!==startDow)return false; else if(e.repeat==="custom"&&!e.days?.includes(dow))return false;
 }else{if(e.date!==date)return false}
 const sm=eventStartMin(spec),em=eventEndMin(spec),slotS=h*60,slotE=(h+1)*60;return em>slotS&&sm<slotE;
}
function resolved(date,h){const manual=state.cells[cellKey(date,h)];if(manual)return {...manual,source:"cell",sourceId:cellKey(date,h),startHour:h,endHour:h+1,date};
for(let i=state.events.length-1;i>=0;i--){const e=state.events[i];if(e.repeat&&e.repeat!=="none")continue;if(eventMatches(e,date,h))return {text:e.text,note:e.note||"",color:e.color,textColor:e.textColor,important:!!e.important,source:"event",sourceId:e.id,startMin:eventStartMin(e),endMin:eventEndMin(e),startHour:eventStartHour(e),endHour:eventEndHourExclusive(e),repeat:"none",date}}
for(let i=state.events.length-1;i>=0;i--){const e=state.events[i];if(!e.repeat||e.repeat==="none")continue;if(eventMatches(e,date,h)){const ex=e.exceptions?.[date];const spec=ex&&!ex.cancelled?{...e,...ex}:e;return {text:spec.text,note:spec.note||"",color:spec.color,textColor:spec.textColor,important:!!spec.important,source:"event",sourceId:e.id,startMin:eventStartMin(spec),endMin:eventEndMin(spec),startHour:eventStartHour(spec),endHour:eventEndHourExclusive(spec),repeat:e.repeat,date}}}return null}
function sameEventRange(a,b){return !!a&&!!b&&a.source==="event"&&b.source==="event"&&a.sourceId===b.sourceId&&a.date===b.date&&a.startMin===b.startMin&&a.endMin===b.endMin}
function eventFillPercent(v,h){if(!v||v.source!=="event")return 100;const sm=v.startMin??v.startHour*60,em=v.endMin??v.endHour*60,startH=Math.floor(sm/60),endH=Math.ceil(em/60)-1,sr=sm%60,er=em%60;if(startH===endH){if(sr>0&&er===0)return sr/60*100;if(sr===0&&er>0)return er/60*100;if(sr>0&&er>0)return Math.max(25,(em-sm)/60*100);return 100}if(h===startH&&sr>0)return sr/60*100;if(h===endH&&er>0)return er/60*100;return 100}
function applyEventBackground(td,v,h){const c=norm(v.color),pct=eventFillPercent(v,h);if(pct>=99.9){td.style.background=c;return}td.classList.add("partialEvent");td.style.background=`linear-gradient(to bottom, ${c} 0 ${pct}%, var(--cell) ${pct}% 100%)`}
function sameImportantRange(a,b){return sameEventRange(a,b)&&a.important&&b.important}

PALETTE.forEach(c=>{const b=document.createElement("button");b.className="sw";b.type="button";b.style.background=c;b.onclick=()=>colorInput.value=c;palette.appendChild(b)});
for(let m=0;m<1440;m+=15){const a=document.createElement("option");a.value=m;a.textContent=formatTime(m);eventStart.appendChild(a)}for(let m=15;m<=1440;m+=15){const b=document.createElement("option");b.value=m;b.textContent=formatTime(m);eventEnd.appendChild(b)}
DAYS.forEach((d,i)=>{const b=document.createElement("button");b.type="button";b.className="daytoggle";b.textContent=d;b.dataset.day=i;b.onclick=()=>b.classList.toggle("on");weekdayPicker.appendChild(b)});

function render(){cleanupPast();renderMonth();renderHeader();renderGrid();renderWords();renderCurrentPreview();renderTools()}
function renderMonth(){const n=new Date();monthTitle.textContent=MONTHS[n.getMonth()]+" "+n.getFullYear()}
function renderHeader(){dayRow.innerHTML="<th>Notas</th>";const dates=weekDates(),today=isoDate(new Date());dates.forEach((s,i)=>{const th=document.createElement("th"),d=parseISO(s);th.innerHTML=DAYS[i]+"<span class='daynum'>"+d.getDate()+"</span>";if(s===today)th.classList.add("todayHead");dayRow.appendChild(th)})}
function renderGrid(){
 grid.innerHTML="";const now=new Date(),today=isoDate(now),hr=now.getHours(),dates=weekDates();
 for(let h=0;h<24;h++){
  const tr=document.createElement("tr"),th=document.createElement("th");th.textContent=h;if(h===hr)th.classList.add("currentHour");tr.appendChild(th);
  for(let d=0;d<7;d++){
   const displayDate=dates[d],td=document.createElement("td");td.dataset.d=d;td.dataset.date=displayDate;td.dataset.h=h;const v=visibleResolved(displayDate,h);
   if(v){
    if(v.source==="event")applyEventBackground(td,v,h);else td.style.background=norm(v.color);
    td.style.color=v.textColor||"#111111";let showText=true;
    if(v.source==="event"){
     const prev=h>0?visibleResolved(displayDate,h-1):null,next=h<23?visibleResolved(displayDate,h+1):null;const samePrev=sameEventRange(prev,v),sameNext=sameEventRange(v,next);
     if(samePrev){showText=false;td.classList.add(sameNext?"eventBlockMid":"eventBlockEnd")}else if(sameNext)td.classList.add("eventBlockStart");
     if(v.important){td.classList.add("importantRange");if(!sameImportantRange(prev,v))td.classList.add("importantStart");if(!sameImportantRange(v,next))td.classList.add("importantEnd")}
    }
    td.textContent=showText?(v.text||""):"";
   }else{td.textContent="";td.style.background="var(--cell)";td.style.color="#111"}
   if(displayDate===today&&h===hr)td.classList.add("currentCell");bindCell(td);tr.appendChild(td)
  }
  grid.appendChild(tr)
 }
}
function renderWords(){wordbar.innerHTML="";words.forEach((w,i)=>{const isClear=w.action==="clear",div=document.createElement("div");div.className="chip"+(selectedWord===i?" active":"")+(isClear&&selectedWord===i?" deleteMode":"");div.textContent=w.text||"+";div.style.background=isClear?"#fff":norm(w.color);div.style.color=isClear?"#b80016":(w.textColor||"#111111");div.onclick=()=>{if(suppressClick){suppressClick=false;return}if(isClear){selectedWord=selectedWord===i?null:i;renderWords();return}if(!w.text){openWord(i);return}selectedWord=selectedWord===i?null:i;renderWords()};let timer;const start=()=>{clearTimeout(timer);if(!isClear)timer=setTimeout(()=>{suppressClick=true;openWord(i)},520)},end=()=>clearTimeout(timer);div.addEventListener("touchstart",start,{passive:true});div.addEventListener("touchend",end,{passive:true});div.addEventListener("mousedown",start);div.addEventListener("mouseup",end);wordbar.appendChild(div)})}
function bindCell(td){td.onclick=()=>{if(suppressClick){suppressClick=false;return}const displayDate=td.dataset.date,h=+td.dataset.h,d=+td.dataset.d,date=effectiveDate(displayDate,h);selectedCell={displayDate,date,h,d};if(selectedWord!==null&&words[selectedWord]?.action==="clear"){snap();deleteAt(date,h);render();return}if(selectedWord!==null&&words[selectedWord]?.text){snap();setCell(date,h,words[selectedWord].text,words[selectedWord].color,words[selectedWord].textColor,"",false);render();return}const v=visibleResolved(displayDate,h);if(v?.source==="event")openEventForExisting(v.sourceId,v.date);else openCell(displayDate,date,h,d)};td.addEventListener("touchstart",startDrag,{passive:false});td.addEventListener("touchmove",moveDrag,{passive:false});td.addEventListener("touchend",endDrag,{passive:false});td.addEventListener("mousedown",startDrag);td.addEventListener("mouseenter",moveDragMouse)}
window.addEventListener("mouseup",endDrag);
function startDrag(e){const td=e.currentTarget;clearTimeout(longTimer);longTimer=setTimeout(()=>{suppressClick=true;drag=true;snap();const displayDate=td.dataset.date,h=+td.dataset.h,date=effectiveDate(displayDate,h);if(selectedWord!==null&&words[selectedWord]?.action==="clear")dragValue={clear:true};else if(selectedWord!==null&&words[selectedWord]?.text)dragValue={text:words[selectedWord].text,color:norm(words[selectedWord].color),textColor:words[selectedWord].textColor||"#111111"};else{const v=resolved(date,h);dragValue=v?{text:v.text,note:v.note||"",color:norm(v.color),textColor:v.textColor||"#111111"}:{clear:true}}applyDrag(td);if(navigator.vibrate)navigator.vibrate(25)},360)}
function cellFromTouch(e){const t=e.touches?.[0];if(!t)return null;return document.elementFromPoint(t.clientX,t.clientY)?.closest("td")}
function moveDrag(e){if(!drag)return;e.preventDefault();const td=cellFromTouch(e);if(td)applyDrag(td)}
function moveDragMouse(e){if(drag)applyDrag(e.currentTarget)}
function endDrag(){clearTimeout(longTimer);if(drag){drag=false;dragValue=null;saveState();render()}}
function applyDrag(td){const displayDate=td.dataset.date,h=+td.dataset.h,date=effectiveDate(displayDate,h);if(dragValue.clear)deleteAt(date,h);else setCell(date,h,dragValue.text,dragValue.color,dragValue.textColor,dragValue.note||"",false,false);}
function setCell(date,h,text,color,textColor="#111111",note="",important=false,doSave=true){const k=cellKey(date,h),old=state.cells[k];if(text)state.cells[k]={text,note:note||"",color:norm(color),textColor:textColor||"#111111",important:important||!!old?.important};else delete state.cells[k];if(doSave)saveState()}
function deleteAt(date,h){const v=resolved(date,h);if(v?.source==="event"){const e=state.events.find(x=>x.id===v.sourceId);if(e?.repeat&&e.repeat!=="none"){e.exceptions=e.exceptions||{};e.exceptions[date]={cancelled:true}}else if(e)state.events=state.events.filter(x=>x.id!==e.id)}else delete state.cells[cellKey(date,h)];saveState()}
function renderCurrentPreview(){const n=new Date(),date=isoDate(n),h=n.getHours(),minute=h*60+n.getMinutes(),v=resolved(date,h);if(v?.source==="event"&&(minute<(v.startMin??0)||minute>=(v.endMin??1440)))return hidePreview();if(!v)return hidePreview();previewCard.textContent=(v.note&&v.note.trim())?v.note:v.text;previewCard.style.background=norm(v.color);previewCard.style.color=v.textColor||"#111111";previewCard.classList.toggle("importantPreview",!!v.important);previewCard.classList.add("show")}
function hidePreview(){previewCard.classList.remove("show","importantPreview");previewCard.textContent="";previewCard.style.background="var(--page)"}
function renderTools(){if(!selectedCell){importantBtn.classList.remove("importantActive");return}const v=visibleResolved(selectedCell.displayDate||selectedCell.date,selectedCell.h);importantBtn.classList.toggle("importantActive",!!v?.important)}
function openCell(displayDate,date,h,d){selectedCell={displayDate,date,h,d};editTarget={type:"cell",displayDate,date,h,d};const v=state.cells[cellKey(date,h)]||visibleResolved(displayDate,h)||{text:"",note:"",color:"#ffffff",textColor:"#111111"};modalTitle.textContent=`${DAYS[d]} ${h}:00`;textInput.value=v.text||"";noteInput.value=v.note||"";cellNoteField.style.display="block";colorInput.value=norm(v.color);textColorInput.value=norm(v.textColor||"#111111");modal.classList.add("show");renderTools();setTimeout(()=>textInput.focus(),50)}
function openWord(i){editTarget={type:"word",i};const w=words[i]||{text:"",color:"#ffffff",textColor:"#111111"};modalTitle.textContent="Palabra rápida";textInput.value=w.text||"";noteInput.value="";cellNoteField.style.display="none";colorInput.value=norm(w.color);textColorInput.value=norm(w.textColor||"#111111");modal.classList.add("show");setTimeout(()=>textInput.focus(),50)}

document.getElementById("saveBtn").onclick=()=>{const text=textInput.value.trim(),note=noteInput.value.trim(),color=norm(colorInput.value),textColor=norm(textColorInput.value||"#111111");snap();if(editTarget?.type==="cell"){const old=state.cells[cellKey(editTarget.date,editTarget.h)];setCell(editTarget.date,editTarget.h,text,color,textColor,note,!!old?.important)}if(editTarget?.type==="word"){words[editTarget.i]={text,color,textColor};saveWords()}cellNoteField.style.display="block";modal.classList.remove("show");render()};
document.getElementById("deleteBtn").onclick=()=>{snap();if(editTarget?.type==="cell")deleteAt(editTarget.date,editTarget.h);if(editTarget?.type==="word"){words[editTarget.i]={text:"",color:"#ffffff",textColor:"#111111"};saveWords()}cellNoteField.style.display="block";modal.classList.remove("show");render()};
document.getElementById("cancelBtn").onclick=()=>{cellNoteField.style.display="block";modal.classList.remove("show")};modal.onclick=e=>{if(e.target===modal){cellNoteField.style.display="block";modal.classList.remove("show")}};
undoBtn.onclick=undo;
importantBtn.onclick=()=>{if(!selectedCell)return;const v=visibleResolved(selectedCell.displayDate||selectedCell.date,selectedCell.h);if(!v)return;snap();if(v.source==="cell"){const k=cellKey(v.date||selectedCell.date,selectedCell.h);state.cells[k].important=!state.cells[k].important}else{const e=state.events.find(x=>x.id===v.sourceId);if(e){if(e.repeat&&e.repeat!=="none"){e.exceptions=e.exceptions||{};const base=e.exceptions[v.date]||{};e.exceptions[v.date]={...base,important:!v.important}}else e.important=!e.important}}saveState();render()};
planBtn.onclick=()=>openEventNew();

function setWeekdayPicker(days=[]){weekdayPicker.querySelectorAll(".daytoggle").forEach(b=>b.classList.toggle("on",days.includes(+b.dataset.day)))}
function getWeekdayPicker(){return [...weekdayPicker.querySelectorAll(".daytoggle.on")].map(b=>+b.dataset.day)}
function updateRepeatUI(){const r=eventRepeat.value;repeatBox.style.display=r==="none"?"none":"block";if(r==="weekdays")setWeekdayPicker([0,1,2,3,4]);else if(r==="weekly")setWeekdayPicker([dayIndexFromISO(eventDate.value||isoDate(new Date()))]);else if(r==="daily")setWeekdayPicker([0,1,2,3,4,5,6]);}
eventRepeat.onchange=updateRepeatUI;eventDate.onchange=()=>{if(eventRepeat.value==="weekly")setWeekdayPicker([dayIndexFromISO(eventDate.value)])};
scopeRow.querySelectorAll(".scopeBtn").forEach(b=>b.onclick=()=>{eventEdit.scope=b.dataset.scope;scopeRow.querySelectorAll(".scopeBtn").forEach(x=>x.classList.toggle("on",x===b))});
function nextOccurrence(e,from=isoDate(new Date())){
 if(!e)return null;
 if(!e.repeat||e.repeat==="none")return e.date>=from?e.date:null;
 const start=e.startDate||from,begin=start>from?start:from;
 for(let i=0;i<370;i++){const date=addDays(begin,i);if(e.until&&date>e.until)break;const h=eventStartHour(e);if(eventMatches(e,date,h))return date}
 return null
}
function repeatLabel(e){if(!e.repeat||e.repeat==="none")return "Una vez";if(e.repeat==="weekdays")return "L-V";if(e.repeat==="daily")return "Cada día";if(e.repeat==="weekly")return "Semanal";if(e.repeat==="custom")return "Días concretos";return "Repetitivo"}
function openEventList(){
 eventList.innerHTML="";
 const items=state.events.map(e=>({e,date:nextOccurrence(e)})).filter(x=>x.date).sort((a,b)=>a.date.localeCompare(b.date)||eventStartMin(a.e)-eventStartMin(b.e));
 if(!items.length){eventList.innerHTML='<div class="emptyList">No hay eventos planificados.</div>'}
 else items.forEach(({e,date})=>{const b=document.createElement("button");b.type="button";b.className="eventItem";const d=parseISO(date);const dateTxt=`${DAYS[dayIndexFromISO(date)]} ${d.getDate()} ${MONTHS[d.getMonth()]}`;b.innerHTML=`<div class="eventItemTitle"><span class="eventDot" style="background:${norm(e.color)}"></span>${e.text||"(Sin texto)"}</div><div class="eventItemMeta">${dateTxt} · ${formatTime(eventStartMin(e))}–${formatTime(eventEndMin(e))} · ${repeatLabel(e)}</div>`;b.onclick=()=>{eventListModal.classList.remove("show");openEventForExisting(e.id,date)};eventList.appendChild(b)})
 eventModal.classList.remove("show");eventListModal.classList.add("show")
}
function fillEventForm(e,dateOverride){const repeat=e?.repeat||"none",date=dateOverride||e?.date||e?.startDate||isoDate(new Date());eventText.value=e?.text||"";eventNote.value=e?.note||"";eventDate.value=date;eventRepeat.value=repeat;eventStart.value=String(e?eventStartMin(e):480);eventEnd.value=String(e?eventEndMin(e):540);eventUntil.value=e?.until||"";eventColor.value=norm(e?.color||"#13bde8");eventTextColor.value=norm(e?.textColor||"#111111");eventImportant.checked=!!e?.important;setWeekdayPicker(e?.days||[]);updateRepeatUI()}
function openEventNew(){eventEdit={mode:"new",eventId:null,date:null,scope:"day"};eventTitle.textContent="Planificar evento";scopeRow.classList.remove("show");fillEventForm(null);document.getElementById("eventDelete").style.visibility="hidden";eventModal.classList.add("show")}
function openEventForExisting(id,date){const e=state.events.find(x=>x.id===id);if(!e)return;eventEdit={mode:"edit",eventId:id,date,scope:(e.repeat&&e.repeat!=="none")?"day":"series"};eventTitle.textContent=(e.repeat&&e.repeat!=="none")?"Editar evento repetitivo":"Editar evento";scopeRow.classList.toggle("show",e.repeat&&e.repeat!=="none");scopeRow.querySelectorAll(".scopeBtn").forEach(b=>b.classList.toggle("on",b.dataset.scope===eventEdit.scope));const ex=e.exceptions?.[date];fillEventForm(ex&&!ex.cancelled?{...e,...ex}:e,date);document.getElementById("eventDelete").style.visibility="visible";eventModal.classList.add("show")}
function formEvent(){const text=eventText.value.trim(),note=eventNote.value.trim(),date=eventDate.value,startMin=+eventStart.value,endMin=+eventEnd.value,repeat=eventRepeat.value;if(!text||!date||endMin<=startMin)return null;let days=getWeekdayPicker();if(repeat==="weekdays")days=[0,1,2,3,4];if(repeat==="daily")days=[0,1,2,3,4,5,6];if(repeat==="weekly")days=[dayIndexFromISO(date)];return {text,note,date,startDate:date,startMin,endMin,startHour:Math.floor(startMin/60),endHour:Math.ceil(endMin/60),repeat,days,until:eventUntil.value||null,color:norm(eventColor.value),textColor:norm(eventTextColor.value),important:eventImportant.checked}}
function previousDate(s){return addDays(s,-1)}
document.getElementById("eventSave").onclick=()=>{const f=formEvent();if(!f){alert("Revisa el texto, la fecha y las horas del evento.");return}snap();if(eventEdit.mode==="new"){state.events.push({id:uid(),...f,exceptions:{}})}else{const e=state.events.find(x=>x.id===eventEdit.eventId);if(!e)return;const repeating=e.repeat&&e.repeat!=="none";if(!repeating||eventEdit.scope==="series"){Object.assign(e,f,{date:f.repeat==="none"?f.date:undefined,startDate:f.repeat==="none"?undefined:f.startDate});if(f.repeat==="none"){delete e.startDate;delete e.until;delete e.days}else delete e.date;e.exceptions=e.exceptions||{}}else if(eventEdit.scope==="day"){e.exceptions=e.exceptions||{};e.exceptions[eventEdit.date]={text:f.text,note:f.note,startMin:f.startMin,endMin:f.endMin,startHour:f.startHour,endHour:f.endHour,color:f.color,textColor:f.textColor,important:f.important}}else if(eventEdit.scope==="from"){e.until=previousDate(eventEdit.date);state.events.push({id:uid(),...f,startDate:eventEdit.date,date:undefined,exceptions:{}})}}saveState();eventModal.classList.remove("show");render()};
document.getElementById("eventDelete").onclick=()=>{if(eventEdit.mode!=="edit")return;snap();const e=state.events.find(x=>x.id===eventEdit.eventId);if(!e)return;const repeating=e.repeat&&e.repeat!=="none";if(repeating&&eventEdit.scope==="day"){e.exceptions=e.exceptions||{};e.exceptions[eventEdit.date]={cancelled:true}}else if(repeating&&eventEdit.scope==="from"){e.until=previousDate(eventEdit.date)}else state.events=state.events.filter(x=>x.id!==e.id);saveState();eventModal.classList.remove("show");render()};
document.getElementById("eventCancel").onclick=()=>eventModal.classList.remove("show");eventModal.onclick=e=>{if(e.target===eventModal)eventModal.classList.remove("show")};

document.getElementById("eventListBtn").onclick=openEventList;
document.getElementById("eventListClose").onclick=()=>eventListModal.classList.remove("show");eventListModal.onclick=e=>{if(e.target===eventListModal)eventListModal.classList.remove("show")};

saveWords();saveState();render();setInterval(render,60000);
})();
