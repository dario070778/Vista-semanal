(() => {
  const DAYS = ["L","M","X","J","V","S","D"];
  const STORE_KEY = "vista-semanal-data-v1";
  const PAST_KEY = "vista-semanal-hide-past-v1";
  let data = load();
  let hidePast = localStorage.getItem(PAST_KEY) !== "0";
  let editTarget = null;
  let pointerDown = false;
  let dragMode = null;
  let dragValue = "";
  let startCell = null;
  let longTimer = null;
  let longPress = false;

  const dayHeader = document.getElementById("dayHeader");
  const gridBody = document.getElementById("gridBody");
  const togglePast = document.getElementById("togglePast");
  const clearWeek = document.getElementById("clearWeek");
  const dialog = document.getElementById("editDialog");
  const cellText = document.getElementById("cellText");
  const saveCell = document.getElementById("saveCell");
  const deleteCell = document.getElementById("deleteCell");
  const editTitle = document.getElementById("editTitle");

  function mondayOfCurrentWeek(now=new Date()){
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }
  function key(day,hour){return `${day}-${hour}`}
  function load(){try{return JSON.parse(localStorage.getItem(STORE_KEY)) || {}}catch{return {}}}
  function save(){localStorage.setItem(STORE_KEY, JSON.stringify(data))}
  function dayIndexMondayFirst(date=new Date()){
    const js = date.getDay();
    return js === 0 ? 6 : js - 1;
  }

  function render(){
    const now = new Date();
    const todayIdx = dayIndexMondayFirst(now);
    const currentHour = now.getHours();
    const monday = mondayOfCurrentWeek(now);

    togglePast.textContent = hidePast ? "Mostrar pasado" : "Ocultar pasado";
    dayHeader.innerHTML = '<th class="timehead">Notas</th>';
    for(let d=0; d<7; d++){
      const date = new Date(monday); date.setDate(monday.getDate()+d);
      const th = document.createElement("th");
      if(d === todayIdx) th.classList.add("today");
      th.innerHTML = `<span class="dow ${d===todayIdx?'today-letter':''}">${DAYS[d]}</span><span class="date">${date.getDate()}</span>`;
      dayHeader.appendChild(th);
    }

    gridBody.innerHTML = "";
    for(let h=0; h<24; h++){
      const tr = document.createElement("tr");
      const hour = document.createElement("td");
      hour.className = "hour" + (h === currentHour ? " current-hour" : "");
      hour.textContent = h;
      tr.appendChild(hour);
      for(let d=0; d<7; d++){
        const td = document.createElement("td");
        td.className = "cell";
        td.dataset.day = d;
        td.dataset.hour = h;
        td.textContent = data[key(d,h)] || "";
        if(d === todayIdx && h === currentHour) td.classList.add("now");
        if(hidePast && d === todayIdx && h < currentHour) td.classList.add("past");
        td.addEventListener("pointerdown", onPointerDown);
        td.addEventListener("pointerenter", onPointerEnter);
        td.addEventListener("pointerup", onPointerUp);
        td.addEventListener("dblclick", () => openEdit(td));
        tr.appendChild(td);
      }
      gridBody.appendChild(tr);
    }
  }

  function onPointerDown(e){
    const td = e.currentTarget;
    pointerDown = true; longPress = false; startCell = td;
    dragValue = data[key(td.dataset.day, td.dataset.hour)] || "";
    dragMode = dragValue ? "fill" : "erase";
    td.setPointerCapture?.(e.pointerId);
    longTimer = setTimeout(() => {
      longPress = true;
      td.classList.add("selected");
    }, 260);
  }
  function onPointerEnter(e){
    if(!pointerDown || !longPress || !startCell) return;
    const td = e.currentTarget;
    const sd = Number(startCell.dataset.day);
    const sh = Number(startCell.dataset.hour);
    const d = Number(td.dataset.day);
    const h = Number(td.dataset.hour);
    clearDragMarks();
    if(d !== sd) return;
    const min = Math.min(sh,h), max = Math.max(sh,h);
    for(let hour=min; hour<=max; hour++){
      const cell = document.querySelector(`td.cell[data-day="${sd}"][data-hour="${hour}"]`);
      if(cell) cell.classList.add("dragging");
    }
  }
  function onPointerUp(e){
    clearTimeout(longTimer);
    const td = e.currentTarget;
    if(longPress && startCell){
      const sd = Number(startCell.dataset.day);
      const sh = Number(startCell.dataset.hour);
      const d = Number(td.dataset.day);
      const h = Number(td.dataset.hour);
      if(d === sd){
        const min = Math.min(sh,h), max = Math.max(sh,h);
        for(let hour=min; hour<=max; hour++){
          if(dragMode === "fill") data[key(sd,hour)] = dragValue;
          else delete data[key(sd,hour)];
        }
        save(); render();
      }
    } else {
      openEdit(td);
    }
    pointerDown = false; startCell = null; clearDragMarks();
  }
  function clearDragMarks(){document.querySelectorAll(".selected,.dragging").forEach(el=>el.classList.remove("selected","dragging"))}

  function openEdit(td){
    editTarget = td;
    const d = Number(td.dataset.day), h = Number(td.dataset.hour);
    editTitle.textContent = `${DAYS[d]} · ${h}:00`;
    cellText.value = data[key(d,h)] || "";
    dialog.showModal();
    setTimeout(()=>cellText.focus(),50);
  }
  saveCell.addEventListener("click", (e)=>{
    e.preventDefault();
    if(!editTarget) return;
    const k = key(editTarget.dataset.day, editTarget.dataset.hour);
    const v = cellText.value.trim();
    if(v) data[k] = v; else delete data[k];
    save(); dialog.close(); render();
  });
  deleteCell.addEventListener("click", (e)=>{
    e.preventDefault();
    if(editTarget) delete data[key(editTarget.dataset.day, editTarget.dataset.hour)];
    save(); dialog.close(); render();
  });
  togglePast.addEventListener("click", ()=>{
    hidePast = !hidePast; localStorage.setItem(PAST_KEY, hidePast ? "1" : "0"); render();
  });
  clearWeek.addEventListener("click", ()=>{
    if(confirm("¿Borrar toda la hoja semanal?")){ data = {}; save(); render(); }
  });

  render();
  setInterval(render, 60_000);
})();
