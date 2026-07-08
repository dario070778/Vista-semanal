(() => {
  const DAYS = ["L", "M", "X", "J", "V", "S", "D"];
  const STORE_KEY = "vista-semanal-data-v2";
  const OLD_STORE_KEY = "vista-semanal-data-v1";
  const PAST_KEY = "vista-semanal-hide-past-v1";
  const COLOR_KEY = "vista-semanal-activity-colors-v1";

  const PALETTE = [
    { name: "Sin color", value: "" },
    { name: "Rojo", value: "#ffd6d6" },
    { name: "Naranja", value: "#ffe1c2" },
    { name: "Amarillo", value: "#fff3a8" },
    { name: "Verde", value: "#d8f6d4" },
    { name: "Azul", value: "#d8ebff" },
    { name: "Morado", value: "#eadcff" },
    { name: "Gris", value: "#e9e9ee" }
  ];

  let data = loadData();
  let activityColors = loadJSON(COLOR_KEY, {});
  let hidePast = localStorage.getItem(PAST_KEY) !== "0";
  let editTarget = null;
  let selectedColor = "";
  let pointerDown = false;
  let dragMode = null;
  let dragCell = null;
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
  const colorPalette = document.getElementById("colorPalette");

  function loadJSON(storageKey, fallback) {
    try { return JSON.parse(localStorage.getItem(storageKey)) || fallback; }
    catch { return fallback; }
  }

  function loadData() {
    let next = loadJSON(STORE_KEY, null);
    if (!next) {
      const old = loadJSON(OLD_STORE_KEY, {});
      next = {};
      for (const [k, v] of Object.entries(old)) {
        if (typeof v === "string" && v.trim()) next[k] = { text: v.trim(), color: "" };
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(next));
    }
    return normalizeData(next);
  }

  function normalizeData(raw) {
    const out = {};
    for (const [k, v] of Object.entries(raw || {})) {
      if (typeof v === "string") out[k] = { text: v.trim(), color: "" };
      else if (v && typeof v === "object") out[k] = { text: String(v.text || "").trim(), color: String(v.color || "") };
      if (!out[k]?.text) delete out[k];
    }
    return out;
  }

  function saveData() { localStorage.setItem(STORE_KEY, JSON.stringify(data)); }
  function saveActivityColors() { localStorage.setItem(COLOR_KEY, JSON.stringify(activityColors)); }

  function mondayOfCurrentWeek(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    return d;
  }

  function key(day, hour) { return `${day}-${hour}`; }
  function dayIndexMondayFirst(date = new Date()) {
    const js = date.getDay();
    return js === 0 ? 6 : js - 1;
  }
  function getCell(day, hour) { return data[key(day, hour)] || { text: "", color: "" }; }
  function setCell(day, hour, cell) {
    const k = key(day, hour);
    const text = String(cell.text || "").trim();
    if (!text) { delete data[k]; return; }
    data[k] = { text, color: cell.color || activityColors[text.toLowerCase()] || "" };
  }

  function render() {
    const now = new Date();
    const todayIdx = dayIndexMondayFirst(now);
    const currentHour = now.getHours();
    const monday = mondayOfCurrentWeek(now);

    togglePast.textContent = hidePast ? "Mostrar pasado" : "Ocultar pasado";

    dayHeader.innerHTML = '<th class="timehead">Notas</th>';
    for (let d = 0; d < 7; d++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + d);
      const th = document.createElement("th");
      if (d === todayIdx) th.classList.add("today");
      th.innerHTML = `<span class="dow ${d === todayIdx ? "today-letter" : ""}">${DAYS[d]}</span><span class="date">${date.getDate()}</span>`;
      dayHeader.appendChild(th);
    }

    gridBody.innerHTML = "";
    for (let h = 0; h < 24; h++) {
      const tr = document.createElement("tr");
      const hour = document.createElement("td");
      hour.className = "hour" + (h === currentHour ? " current-hour" : "");
      hour.textContent = h;
      tr.appendChild(hour);

      for (let d = 0; d < 7; d++) {
        const td = document.createElement("td");
        const cell = getCell(d, h);
        td.className = "cell";
        td.dataset.day = d;
        td.dataset.hour = h;
        td.textContent = cell.text;
        if (cell.color) td.style.backgroundColor = cell.color;
        if (d === todayIdx && h === currentHour) td.classList.add("now");
        if (hidePast && d === todayIdx && h < currentHour) td.classList.add("past");
        td.addEventListener("pointerdown", onPointerDown);
        td.addEventListener("pointerenter", onPointerEnter);
        td.addEventListener("pointerup", onPointerUp);
        td.addEventListener("pointercancel", resetPointer);
        td.addEventListener("dblclick", () => openEdit(td));
        tr.appendChild(td);
      }
      gridBody.appendChild(tr);
    }
  }

  function onPointerDown(e) {
    const td = e.currentTarget;
    pointerDown = true;
    longPress = false;
    startCell = td;
    const cell = getCell(td.dataset.day, td.dataset.hour);
    dragCell = { text: cell.text, color: cell.color };
    dragMode = cell.text ? "fill" : "erase";
    td.setPointerCapture?.(e.pointerId);
    longTimer = setTimeout(() => {
      longPress = true;
      td.classList.add("selected");
    }, 260);
  }

  function onPointerEnter(e) {
    if (!pointerDown || !longPress || !startCell) return;
    const td = e.currentTarget;
    const sd = Number(startCell.dataset.day);
    const sh = Number(startCell.dataset.hour);
    const d = Number(td.dataset.day);
    const h = Number(td.dataset.hour);
    clearDragMarks();
    if (d !== sd) return;
    const min = Math.min(sh, h), max = Math.max(sh, h);
    for (let hour = min; hour <= max; hour++) {
      const cell = document.querySelector(`td.cell[data-day="${sd}"][data-hour="${hour}"]`);
      if (cell) cell.classList.add("dragging");
    }
  }

  function onPointerUp(e) {
    clearTimeout(longTimer);
    const td = e.currentTarget;
    if (longPress && startCell) {
      const sd = Number(startCell.dataset.day);
      const sh = Number(startCell.dataset.hour);
      const d = Number(td.dataset.day);
      const h = Number(td.dataset.hour);
      if (d === sd) {
        const min = Math.min(sh, h), max = Math.max(sh, h);
        for (let hour = min; hour <= max; hour++) {
          if (dragMode === "fill") setCell(sd, hour, dragCell);
          else delete data[key(sd, hour)];
        }
        saveData();
        render();
      }
    } else {
      openEdit(td);
    }
    resetPointer();
  }

  function resetPointer() {
    clearTimeout(longTimer);
    pointerDown = false;
    startCell = null;
    clearDragMarks();
  }

  function clearDragMarks() {
    document.querySelectorAll(".selected,.dragging").forEach(el => el.classList.remove("selected", "dragging"));
  }

  function renderPalette() {
    colorPalette.innerHTML = "";
    for (const item of PALETTE) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "color-btn" + (item.value === selectedColor ? " active" : "");
      b.title = item.name;
      b.setAttribute("aria-label", item.name);
      b.dataset.color = item.value;
      b.innerHTML = item.value ? "" : "×";
      if (item.value) b.style.backgroundColor = item.value;
      b.addEventListener("click", () => {
        selectedColor = item.value;
        renderPalette();
      });
      colorPalette.appendChild(b);
    }
  }

  function openEdit(td) {
    editTarget = td;
    const d = Number(td.dataset.day), h = Number(td.dataset.hour);
    const cell = getCell(d, h);
    editTitle.textContent = `${DAYS[d]} · ${h}:00`;
    cellText.value = cell.text;
    selectedColor = cell.color || activityColors[cell.text.toLowerCase()] || "";
    renderPalette();
    dialog.showModal();
    setTimeout(() => cellText.focus(), 50);
  }

  function saveEditedCell() {
    if (!editTarget) return;
    const d = Number(editTarget.dataset.day);
    const h = Number(editTarget.dataset.hour);
    const text = cellText.value.trim();
    if (text) {
      if (selectedColor) {
        activityColors[text.toLowerCase()] = selectedColor;
      } else {
        delete activityColors[text.toLowerCase()];
      }
      saveActivityColors();
      setCell(d, h, { text, color: selectedColor });
    } else {
      delete data[key(d, h)];
    }
    saveData();
    dialog.close();
    render();
  }

  saveCell.addEventListener("click", (e) => {
    e.preventDefault();
    saveEditedCell();
  });

  cellText.addEventListener("input", () => {
    const text = cellText.value.trim().toLowerCase();
    if (text && Object.prototype.hasOwnProperty.call(activityColors, text)) {
      selectedColor = activityColors[text];
      renderPalette();
    }
  });

  cellText.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveEditedCell();
    }
  });

  deleteCell.addEventListener("click", (e) => {
    e.preventDefault();
    if (editTarget) delete data[key(editTarget.dataset.day, editTarget.dataset.hour)];
    saveData();
    dialog.close();
    render();
  });

  togglePast.addEventListener("click", () => {
    hidePast = !hidePast;
    localStorage.setItem(PAST_KEY, hidePast ? "1" : "0");
    render();
  });

  clearWeek.addEventListener("click", () => {
    if (confirm("¿Borrar toda la hoja semanal?")) {
      data = {};
      saveData();
      render();
    }
  });

  render();
  setInterval(render, 60_000);
})();
