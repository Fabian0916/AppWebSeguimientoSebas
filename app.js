// Seguimiento de L — lógica de la app
(function () {
  "use strict";
  const CFG = window.APP_CONFIG;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const keyOf = (iso) => dayKey(new Date(iso));
  const toLocalInput = (d) => `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const hhmm = (iso) => { const d = new Date(iso); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const startOfDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 0, 0, 0, 0); };
  const endOfDay = (k) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d, 23, 59, 59, 999); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const short = (k) => { const d = startOfDay(k); return d.getDate() + " " + MESES[d.getMonth()].slice(0, 3); };
  const fmt = (n) => (n == null || n === "" || isNaN(n) ? "—" : Number(n).toLocaleString("es-CO", { maximumFractionDigits: 1 }));
  const params = new URLSearchParams(location.search);

  const S = {
    doctor: params.get("doc"),
    tab: "hoy",
    day: dayKey(new Date()),
    dayRecs: [],
    recs: [],
    range: { preset: "14", cd: "", ch: "", desde: null, hasta: null },
    charts: [],
  };
  let F = null; // estado del formulario

  /* ---------- Iconos y tipos ---------- */
  const IC = {
    toma: '<path d="M12 2.7s6 6.2 6 10.3a6 6 0 0 1-12 0c0-4.1 6-10.3 6-10.3z"/>',
    panal: '<path d="M3 8h18l-2 8a4 4 0 0 1-4 3H9a4 4 0 0 1-4-3z"/>',
    medida: '<path d="M3 17L17 3l4 4L7 21z"/><path d="M8 12l2 2M11 9l2 2M14 6l2 2"/>',
    saturacion: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    episodio: '<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
    sueno: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
    temperatura: '<path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z"/>',
    medicamento: '<path d="M10.5 20.5a5 5 0 0 1-7-7l9-9a5 5 0 0 1 7 7z"/><path d="M8.5 8.5l7 7"/>',
    nota: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  };
  const svg = (k) => `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
  const calCls = (o) => ({ Buena: "q-ok", Regular: "q-warn", Mala: "q-bad" }[o] || "");
  const intCls = (o) => ({ Leve: "q-ok", Moderado: "q-warn", Severo: "q-bad" }[o] || "");

  const SPECS = {
    toma: {
      label: "Toma",
      fields: [
        { k: "origen", t: "seg", label: "Origen", opts: ["Fórmula", "Materna"], req: true },
        { k: "producto", t: "select", label: "Producto", opts: ["Infatrini", "NAN sin lactosa", "NeoSure", "Alfaré", "Otra"], show: (d) => d.origen === "Fórmula" },
        { k: "lado", t: "seg", label: "Lado", opts: ["Izquierdo", "Derecho", "Ambos"], show: (d) => d.origen === "Materna" },
        { k: "ml", t: "num", label: "Cantidad (mL)", half: true, show: (d) => d.origen === "Fórmula" },
        { k: "min", t: "num", label: "Duración (min)", half: true },
        { k: "calidad", t: "seg", label: "Calidad de la toma", opts: ["Buena", "Regular", "Mala"], cls: calCls },
        { k: "senales", t: "checks", label: "Durante la toma", opts: ["Se cansó", "Tos o ahogo", "Reflujo", "Estridor", "La dejó a medias", "Con oxígeno", "Se quedó dormido"] },
      ],
      defaults: { origen: "Fórmula", producto: "Infatrini" },
    },
    panal: {
      label: "Pañal",
      fields: [
        { k: "tipo", t: "seg", label: "Contenido", opts: ["Orina", "Popo", "Ambos"], req: true },
        { k: "cantidad", t: "seg", label: "Cantidad", opts: ["Poca", "Normal", "Mucha"] },
        { k: "consistencia", t: "seg", label: "Consistencia", opts: ["Líquida", "Blanda", "Pastosa", "Dura"], wrap: true, show: (d) => d.tipo && d.tipo !== "Orina" },
        { k: "color", t: "seg", label: "Color", opts: ["Amarilla", "Verde", "Café", "Con moco", "Con sangre", "Blanca o clara"], wrap: true, show: (d) => d.tipo && d.tipo !== "Orina" },
      ],
      defaults: {},
    },
    medida: {
      label: "Peso, talla y perímetro",
      fields: [
        { k: "peso_g", t: "num", label: "Peso (g)", half: true },
        { k: "talla_cm", t: "num", label: "Talla (cm)", half: true },
        { k: "pc_cm", t: "num", label: "Perímetro cefálico (cm)" },
      ],
      defaults: {},
      validate: (d) => (d.peso_g || d.talla_cm || d.pc_cm ? "" : "Escribe al menos una medida."),
    },
    saturacion: {
      label: "Saturación y oxígeno",
      fields: [
        { k: "sat", t: "num", label: "Saturación (%)", half: true, req: true },
        { k: "fc", t: "num", label: "Pulso (lpm)", half: true },
        { k: "o2", t: "select", label: "Oxígeno (L/min)", opts: ["Sin oxígeno", "1/32", "1/16", "1/8", "1/4", "1/2", "1", "Otro"], blank: "Sin dato" },
        { k: "situacion", t: "seg", label: "Situación", opts: ["Despierto", "Dormido", "Comiendo", "Llorando"], wrap: true },
      ],
      defaults: {},
    },
    episodio: {
      label: "Reflujo, vómito o estridor",
      fields: [
        { k: "tipo", t: "seg", label: "Qué pasó", opts: ["Reflujo", "Vómito", "Estridor", "Esfuerzo respiratorio", "Tos o ahogo", "Color morado", "Otro"], wrap: true, req: true },
        { k: "intensidad", t: "seg", label: "Intensidad", opts: ["Leve", "Moderado", "Severo"], cls: intCls },
        { k: "relacion", t: "seg", label: "Relación con la toma", opts: ["Durante toma", "Después de toma", "Dormido", "Sin relación"], wrap: true },
      ],
      defaults: {},
    },
    sueno: {
      label: "Sueño",
      fechaLabel: "Se durmió",
      fields: [
        { k: "fin", t: "dt", label: "Despertó", req: true },
        { k: "calidad", t: "seg", label: "Cómo durmió", opts: ["Tranquilo", "Inquieto"] },
      ],
      defaults: {},
    },
    temperatura: {
      label: "Temperatura",
      fields: [
        { k: "temp", t: "num", label: "Temperatura (°C)", req: true },
        { k: "lugar", t: "seg", label: "Dónde", opts: ["Axilar", "Rectal", "Frente", "Otra"], wrap: true },
      ],
      defaults: {},
    },
    medicamento: {
      label: "Medicamentos y suplementos",
      fields: [
        { k: "nombre", t: "select", label: "Cuál", opts: ["Vitaminas", "Biogaia", "Levotiroxina", "Vitamina D", "Sulfato ferroso", "Domperidona", "Paracetamol", "Otro"], blank: "Elegir…", req: true },
        { k: "otro", t: "text", label: "Nombre", show: (d) => d.nombre === "Otro" },
        { k: "dosis", t: "text", label: "Dosis", ph: "p. ej. 5 gotas" },
      ],
      defaults: {},
    },
    nota: { label: "Nota o foto", fields: [], defaults: {} },
  };
  const TIPOS = Object.keys(SPECS);

  /* ---------- Descripción de un registro ---------- */
  function describe(r) {
    const d = r.datos || {};
    let title = "", sub = [], chip = null;
    switch (r.tipo) {
      case "toma":
        if (d.origen === "Materna") title = "Pecho" + (d.lado ? " · " + d.lado.toLowerCase() : "") + (d.min ? " · " + d.min + " min" : "");
        else { title = "Fórmula" + (d.producto ? " · " + d.producto : "") + (d.ml ? " · " + d.ml + " mL" : ""); if (d.min) sub.push(d.min + " min"); }
        sub.push((d.senales || []).length ? d.senales.join(", ") : "sin incidentes");
        if (d.calidad) chip = { t: d.calidad, c: { Buena: "ok", Regular: "warn", Mala: "bad" }[d.calidad] };
        break;
      case "panal":
        title = "Pañal · " + (d.tipo || "").toLowerCase();
        sub = [d.cantidad, d.consistencia, d.color].filter(Boolean).map((x) => x.toLowerCase());
        break;
      case "medida":
        title = "Medidas";
        if (d.peso_g) sub.push(fmt(d.peso_g) + " g");
        if (d.talla_cm) sub.push("talla " + fmt(d.talla_cm) + " cm");
        if (d.pc_cm) sub.push("PC " + fmt(d.pc_cm) + " cm");
        break;
      case "saturacion":
        title = "Saturación " + fmt(d.sat) + " %";
        if (d.fc) sub.push("pulso " + d.fc);
        if (d.o2) sub.push(d.o2 === "Sin oxígeno" ? "sin oxígeno" : "oxígeno " + d.o2);
        if (d.situacion) sub.push(d.situacion.toLowerCase());
        break;
      case "episodio":
        title = (d.tipo || "Episodio") + (d.intensidad ? " · " + d.intensidad.toLowerCase() : "");
        if (d.relacion) sub.push(d.relacion.toLowerCase());
        if (d.intensidad) chip = { t: d.intensidad, c: { Leve: "ok", Moderado: "warn", Severo: "bad" }[d.intensidad] };
        break;
      case "sueno": {
        const m = d.fin ? Math.round((new Date(d.fin) - new Date(r.fecha)) / 60000) : 0;
        title = "Sueño · " + (m > 0 ? Math.floor(m / 60) + " h " + (m % 60) + " min" : "sin hora de fin");
        if (d.calidad) sub.push(d.calidad.toLowerCase());
        break;
      }
      case "temperatura":
        title = "Temperatura " + fmt(d.temp) + " °C";
        if (d.lugar) sub.push(d.lugar.toLowerCase());
        break;
      case "medicamento":
        title = (d.nombre === "Otro" ? d.otro || "Otro" : d.nombre || "Medicamento") + (d.dosis ? " · " + d.dosis : "");
        sub.push("medicamento o suplemento");
        break;
      default:
        title = "Nota";
    }
    return { title, sub: sub.join(" · "), chip, nota: r.nota };
  }

  function itemHTML(r) {
    const x = describe(r);
    const foto = (r.fotos || [])[0];
    const right = foto ? `<img src="${esc(foto)}" alt="Foto del registro">` : x.chip ? `<span class="chip ${x.chip.c || "sand"}">${esc(x.chip.t)}</span>` : "";
    return `<button type="button" class="item" data-id="${esc(r.id)}"><span class="t">${hhmm(r.fecha)}</span><span class="m"><div class="a">${esc(x.title)}</div>${x.sub ? `<div class="b">${esc(x.sub)}</div>` : ""}${x.nota ? `<div class="b">“${esc(x.nota)}”</div>` : ""}</span>${right}</button>`;
  }

  /* ---------- Agregados por día ---------- */
  function agg(recs) {
    const m = {};
    const g = (k) => m[k] || (m[k] = { formN: 0, ml: 0, pecN: 0, pecMin: 0, q: { Buena: 0, Regular: 0, Mala: 0 }, orina: 0, popo: 0, ep: {}, epN: 0, satMin: null, satSum: 0, satN: 0, sleep: 0, tmax: null, tmin: null, peso: null, talla: null, pc: null });
    for (const r of recs) {
      const x = g(keyOf(r.fecha)), d = r.datos || {};
      if (r.tipo === "toma") {
        if (d.origen === "Materna") { x.pecN++; x.pecMin += Number(d.min) || 0; } else { x.formN++; x.ml += Number(d.ml) || 0; }
        if (d.calidad) x.q[d.calidad]++;
      } else if (r.tipo === "panal") {
        if (d.tipo === "Orina" || d.tipo === "Ambos") x.orina++;
        if (d.tipo === "Popo" || d.tipo === "Ambos") x.popo++;
      } else if (r.tipo === "episodio") { x.epN++; const t = d.tipo || "Otro"; x.ep[t] = (x.ep[t] || 0) + 1; }
      else if (r.tipo === "saturacion" && d.sat != null) { x.satMin = x.satMin == null ? d.sat : Math.min(x.satMin, d.sat); x.satSum += d.sat; x.satN++; }
      else if (r.tipo === "sueno" && d.fin) x.sleep += Math.max(0, (new Date(d.fin) - new Date(r.fecha)) / 60000);
      else if (r.tipo === "temperatura" && d.temp != null) { x.tmax = x.tmax == null ? d.temp : Math.max(x.tmax, d.temp); x.tmin = x.tmin == null ? d.temp : Math.min(x.tmin, d.temp); }
      else if (r.tipo === "medida") { if (d.peso_g) x.peso = d.peso_g; if (d.talla_cm) x.talla = d.talla_cm; if (d.pc_cm) x.pc = d.pc_cm; }
    }
    return m;
  }
  const daysBetween = (a, b) => { const out = []; for (let d = startOfDay(a); dayKey(d) <= b; d = addDays(d, 1)) out.push(dayKey(d)); return out; };

  /* ---------- Utilidades de interfaz ---------- */
  let toastT;
  function toast(msg) { const t = $("#toast"); t.textContent = msg; t.classList.remove("hidden"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.add("hidden"), 2600); }
  function edadTxt() {
    const n = new Date(CFG.NACIMIENTO + "T00:00:00"), t = new Date();
    let m = (t.getFullYear() - n.getFullYear()) * 12 + t.getMonth() - n.getMonth(), d = t.getDate() - n.getDate();
    if (d < 0) { m--; d += new Date(t.getFullYear(), t.getMonth(), 0).getDate(); }
    const dd = d + (d === 1 ? " día" : " días");
    return m > 0 ? `${m} ${m === 1 ? "mes" : "meses"} y ${dd}` : dd;
  }
  function updateHeader() {
    const pesos = S.recs.concat(S.dayRecs).filter((r) => r.tipo === "medida" && r.datos && r.datos.peso_g).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const last = pesos[pesos.length - 1];
    $("#edad").textContent = edadTxt() + (last ? " · " + fmt(last.datos.peso_g) + " g" : "");
  }

  /* ---------- Vista: Día ---------- */
  async function loadDay() {
    const d = startOfDay(S.day).toISOString(), h = endOfDay(S.day).toISOString();
    S.dayRecs = S.doctor ? await DB.listShared(S.doctor, d, h) : await DB.list(d, h);
  }
  function renderDay() {
    const today = dayKey(new Date());
    const dt = startOfDay(S.day);
    $("#dLabel").textContent = (S.day === today ? "Hoy, " : S.day === dayKey(addDays(new Date(), -1)) ? "Ayer, " : "") + `${DIAS[dt.getDay()]} ${dt.getDate()} de ${MESES[dt.getMonth()]}`;
    $("#dPick").value = S.day;
    const x = agg(S.dayRecs)[S.day] || agg([])["_"] || { formN: 0, ml: 0, pecN: 0, pecMin: 0, orina: 0, popo: 0, ep: {}, epN: 0 };
    const epTxt = Object.entries(x.ep).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ") || "ninguno";
    $("#dayStats").innerHTML = [
      ["Fórmula", fmt(x.ml) === "—" || !x.ml ? "0 mL" : fmt(x.ml) + " mL", x.formN + (x.formN === 1 ? " toma" : " tomas")],
      ["Pecho", x.pecN + (x.pecN === 1 ? " toma" : " tomas"), (x.pecMin || 0) + " min en total"],
      ["Pañales", String(S.dayRecs.filter((r) => r.tipo === "panal").length), `${x.orina || 0} orina · ${x.popo || 0} popo`],
      ["Episodios", String(x.epN || 0), epTxt],
    ].map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join("");
    const sats = S.dayRecs.filter((r) => r.tipo === "saturacion");
    const ls = sats[sats.length - 1];
    $("#satStrip").innerHTML = ls ? `<div class="strip"><b>Saturación ${fmt(ls.datos.sat)} %</b><span>${ls.datos.o2 && ls.datos.o2 !== "Sin oxígeno" ? "Oxígeno " + esc(ls.datos.o2) + " · " : ""}${hhmm(ls.fecha)}</span></div>` : "";
    $("#timeline").innerHTML = S.dayRecs.length ? S.dayRecs.map(itemHTML).join("") : `<div class="empty">Sin registros este día.${S.doctor ? "" : " Toca + para agregar."}</div>`;
  }

  /* ---------- Rango (gráficas y reporte) ---------- */
  function setRange(preset) {
    const R = S.range, today = new Date();
    R.preset = String(preset);
    let d, h;
    if (R.preset === "all") { d = CFG.NACIMIENTO; h = dayKey(today); }
    else if (R.preset === "custom") {
      if (!R.cd) R.cd = dayKey(addDays(today, -13));
      if (!R.ch) R.ch = dayKey(today);
      d = R.cd; h = R.ch;
    } else { d = dayKey(addDays(today, -(Number(R.preset) - 1))); h = dayKey(today); }
    if (d > h) [d, h] = [h, d];
    R.desde = d; R.hasta = h;
    $$(".rangetxt").forEach((e) => (e.textContent = `${short(d)} al ${short(h)}`));
    renderRangeBars();
  }
  function renderRangeBars() {
    const P = [["7", "7 días"], ["14", "14 días"], ["30", "30 días"], ["all", "Todo"], ["custom", "Fechas"]];
    const R = S.range;
    const html = P.map(([p, l]) => `<button type="button" class="pill ${R.preset === p ? "on" : ""}" data-preset="${p}">${l}</button>`).join("") +
      (R.preset === "custom" ? `<div class="custom"><input type="date" data-cd value="${R.cd}" aria-label="Desde"><span>a</span><input type="date" data-ch value="${R.ch}" aria-label="Hasta"></div>` : "");
    $$("[data-range]").forEach((el) => (el.innerHTML = html));
  }
  async function loadRange() {
    const d = startOfDay(S.range.desde).toISOString(), h = endOfDay(S.range.hasta).toISOString();
    S.recs = S.doctor ? await DB.listShared(S.doctor, d, h) : await DB.list(d, h);
    updateHeader();
  }
  async function changeRange(p) { setRange(p); try { await loadRange(); } catch (e) { toast("No se pudieron cargar los datos"); } renderActive(); }

  /* ---------- Vista: Gráficas ---------- */
  Chart.defaults.locale = "es-CO";
  Chart.defaults.font.family = "Inter, system-ui, sans-serif";
  const COL = { teal: "#2F7F79", amber: "#C27A1A", green: "#4C9A6A", red: "#B5432B", blue: "#4A7FB5", purple: "#7C5FA8", gray: "#8C968F" };
  function mkChart(id, type, labels, datasets, opt = {}) {
    const el = document.getElementById(id);
    if (!el) return;
    const stacked = !!opt.stacked;
    const scales = { x: { stacked, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8, font: { size: 10 } } }, y: { stacked, beginAtZero: opt.zero !== false, grid: { color: "#EEE9DF" }, ticks: { font: { size: 10 }, precision: 0 }, suggestedMin: opt.min, suggestedMax: opt.max } };
    if (opt.y2) scales.y2 = { position: "right", grid: { display: false }, ticks: { font: { size: 10 } } };
    S.charts.push(new Chart(el, {
      type, data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false, spanGaps: true, animation: false, interaction: { mode: "index", intersect: false },
        plugins: { legend: { display: datasets.length > 1, position: "bottom", labels: { boxWidth: 10, boxHeight: 10, font: { size: 11 } } } }, scales },
    }));
  }
  function card(id, title, sub) { return `<div class="card"><h3><span>${title}</span>${sub ? `<small>${sub}</small>` : ""}</h3><div class="cv"><canvas id="${id}" role="img" aria-label="${esc(title)}"></canvas></div></div>`; }

  function renderCharts() {
    S.charts.forEach((c) => c.destroy()); S.charts = [];
    const box = $("#charts");
    if (!S.recs.length) { box.innerHTML = `<div class="empty">No hay registros en este rango.</div>`; return; }
    const days = daysBetween(S.range.desde, S.range.hasta), A = agg(S.recs), labels = days.map(short);
    const col = (f) => days.map((k) => (A[k] ? f(A[k]) : null));
    const has = (f) => days.some((k) => A[k] && f(A[k]) != null && f(A[k]) !== 0 && f(A[k]) !== false);
    const parts = [], draw = [];
    const add = (id, title, sub, fn) => { parts.push(card(id, title, sub)); draw.push(fn); };

    if (has((x) => x.peso)) {
      const w = S.recs.filter((r) => r.tipo === "medida" && r.datos.peso_g).sort((a, b) => a.fecha.localeCompare(b.fecha));
      let sub = "";
      if (w.length > 1) { const dd = (new Date(w[w.length - 1].fecha) - new Date(w[0].fecha)) / 864e5; if (dd >= 0.5) sub = `${(w[w.length - 1].datos.peso_g - w[0].datos.peso_g) / dd >= 0 ? "+" : ""}${fmt((w[w.length - 1].datos.peso_g - w[0].datos.peso_g) / dd)} g por día`; }
      add("c_peso", "Peso (g)", sub, () => mkChart("c_peso", "line", labels, [{ label: "Peso (g)", data: col((x) => x.peso), borderColor: COL.teal, backgroundColor: COL.teal, pointRadius: 3, tension: 0.25, borderWidth: 2.5 }], { zero: false }));
    }
    if (has((x) => x.talla) || has((x) => x.pc)) {
      add("c_tpc", "Talla y perímetro cefálico (cm)", "", () => mkChart("c_tpc", "line", labels, [
        { label: "Talla", data: col((x) => x.talla), borderColor: COL.blue, backgroundColor: COL.blue, pointRadius: 4, borderWidth: 2, yAxisID: "y" },
        { label: "Perímetro cefálico", data: col((x) => x.pc), borderColor: COL.purple, backgroundColor: COL.purple, pointRadius: 4, borderWidth: 2, yAxisID: "y2" }], { zero: false, y2: true }));
    }
    if (has((x) => x.ml)) add("c_form", "Fórmula por día (mL)", "", () => mkChart("c_form", "bar", labels, [{ label: "mL", data: col((x) => x.ml || null), backgroundColor: COL.teal, borderRadius: 4 }]));
    if (has((x) => x.q.Buena + x.q.Regular + x.q.Mala)) add("c_cal", "Calidad de las tomas", "", () => mkChart("c_cal", "bar", labels, [
      { label: "Buena", data: col((x) => x.q.Buena || null), backgroundColor: COL.green },
      { label: "Regular", data: col((x) => x.q.Regular || null), backgroundColor: COL.amber },
      { label: "Mala", data: col((x) => x.q.Mala || null), backgroundColor: COL.red }], { stacked: true }));
    if (has((x) => x.pecMin)) add("c_pec", "Pecho por día (min)", "", () => mkChart("c_pec", "bar", labels, [{ label: "min", data: col((x) => x.pecMin || null), backgroundColor: COL.purple, borderRadius: 4 }]));
    if (has((x) => x.orina + x.popo)) add("c_pan", "Pañales por día", "", () => mkChart("c_pan", "bar", labels, [
      { label: "Orina", data: col((x) => x.orina || null), backgroundColor: COL.teal },
      { label: "Popo", data: col((x) => x.popo || null), backgroundColor: COL.amber }], { stacked: true }));
    if (has((x) => x.epN)) {
      const tipos = [...new Set(S.recs.filter((r) => r.tipo === "episodio").map((r) => r.datos.tipo || "Otro"))];
      const pal = [COL.red, COL.amber, COL.blue, COL.purple, COL.green, COL.gray, COL.teal];
      add("c_ep", "Episodios por día", "", () => mkChart("c_ep", "bar", labels, tipos.map((t, i) => ({ label: t, data: col((x) => x.ep[t] || null), backgroundColor: pal[i % pal.length] })), { stacked: true }));
    }
    if (has((x) => x.satN)) add("c_sat", "Saturación (%)", "", () => mkChart("c_sat", "line", labels, [
      { label: "Promedio", data: col((x) => (x.satN ? Math.round((x.satSum / x.satN) * 10) / 10 : null)), borderColor: COL.teal, backgroundColor: COL.teal, pointRadius: 3, borderWidth: 2.5 },
      { label: "Mínima", data: col((x) => x.satMin), borderColor: COL.red, backgroundColor: COL.red, pointRadius: 3, borderWidth: 2 }], { zero: false, max: 100 }));
    if (has((x) => x.sleep)) add("c_sue", "Sueño por día (horas)", "", () => mkChart("c_sue", "bar", labels, [{ label: "horas", data: col((x) => (x.sleep ? Math.round((x.sleep / 60) * 10) / 10 : null)), backgroundColor: COL.blue, borderRadius: 4 }]));
    if (has((x) => x.tmax)) add("c_tem", "Temperatura (°C)", "", () => mkChart("c_tem", "line", labels, [
      { label: "Máxima", data: col((x) => x.tmax), borderColor: COL.red, backgroundColor: COL.red, pointRadius: 3, borderWidth: 2 },
      { label: "Mínima", data: col((x) => x.tmin), borderColor: COL.blue, backgroundColor: COL.blue, pointRadius: 3, borderWidth: 2 }], { zero: false }));

    box.innerHTML = parts.length ? parts.join("") : `<div class="empty">Todavía no hay datos para graficar en este rango.</div>`;
    draw.forEach((f) => f());
  }

  /* ---------- Vista: Reporte ---------- */
  function renderReport() {
    const box = $("#report");
    if (!S.recs.length) { box.innerHTML = `<div class="empty">No hay registros en este rango${S.doctor ? " (o el enlace fue desactivado)" : ""}.</div>`; return; }
    const A = agg(S.recs), keys = Object.keys(A).sort(), D = keys.length;
    const sum = (f) => keys.reduce((s, k) => s + f(A[k]), 0);
    const medidas = S.recs.filter((r) => r.tipo === "medida").sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pesos = medidas.filter((r) => r.datos.peso_g);
    let gain = "—";
    if (pesos.length > 1) { const dd = (new Date(pesos[pesos.length - 1].fecha) - new Date(pesos[0].fecha)) / 864e5; if (dd >= 0.5) gain = fmt((pesos[pesos.length - 1].datos.peso_g - pesos[0].datos.peso_g) / dd) + " g/día"; }
    const diasForm = keys.filter((k) => A[k].formN).length;
    const qTot = sum((x) => x.q.Buena + x.q.Regular + x.q.Mala);
    const last = (f) => { for (let i = medidas.length - 1; i >= 0; i--) if (medidas[i].datos[f]) return medidas[i]; return null; };
    const lt = last("talla_cm"), lp = last("pc_cm");
    let html = `<div class="kpis">
      <div class="kpi"><div class="k">Ganancia de peso</div><div class="v">${esc(gain)}</div></div>
      <div class="kpi"><div class="k">Fórmula promedio</div><div class="v">${diasForm ? fmt(sum((x) => x.ml) / diasForm) + " mL/día" : "—"}</div></div>
      <div class="kpi"><div class="k">Tomas buenas</div><div class="v">${qTot ? Math.round((sum((x) => x.q.Buena) / qTot) * 100) + " %" : "—"}</div></div>
      <div class="kpi"><div class="k">Episodios por día</div><div class="v">${D ? fmt(sum((x) => x.epN) / D) : "—"}</div></div>
      ${lt ? `<div class="kpi"><div class="k">Talla (${short(keyOf(lt.fecha))})</div><div class="v">${fmt(lt.datos.talla_cm)} cm</div></div>` : ""}
      ${lp ? `<div class="kpi"><div class="k">Perímetro cefálico (${short(keyOf(lp.fecha))})</div><div class="v">${fmt(lp.datos.pc_cm)} cm</div></div>` : ""}
    </div><p class="muted" style="margin:-4px 0 10px">Los promedios usan solo los días con registros.</p>`;

    // Tabla por día
    const rows = keys.slice().reverse().map((k) => { const x = A[k]; return `<tr><td><b>${short(k)}</b></td><td>${x.ml ? fmt(x.ml) + " mL" : "—"}${x.formN ? " · " + x.formN + (x.formN === 1 ? " toma" : " tomas") : ""}</td><td>${x.pecN ? x.pecN + " · " + x.pecMin + " min" : "—"}</td><td>${x.orina} / ${x.popo}</td><td>${x.epN || "—"}</td><td>${x.satMin != null ? fmt(x.satMin) + " %" : "—"}</td><td>${x.peso ? fmt(x.peso) : "—"}</td></tr>`; }).join("");
    html += `<div class="tbl"><div class="scroll"><table><thead><tr><th>Día</th><th>Fórmula</th><th>Pecho</th><th>Orina / popo</th><th>Episodios</th><th>Sat. mín.</th><th>Peso (g)</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;

    // Señales
    const sen = {}; let fotos = [];
    S.recs.forEach((r) => { if (r.tipo === "toma") (r.datos.senales || []).forEach((s) => (sen[s] = (sen[s] || 0) + 1)); (r.fotos || []).forEach((u) => fotos.push({ u, f: r.fecha })); });
    const ep = {}; S.recs.filter((r) => r.tipo === "episodio").forEach((r) => { const t = r.datos.tipo || "Otro"; ep[t] = (ep[t] || 0) + 1; });
    const chips = [
      ...Object.entries(ep).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip bad">${esc(k)} · ${v}</span>`),
      ...Object.entries(sen).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip warn">${esc(k)} en toma · ${v}</span>`),
      fotos.length ? `<span class="chip sand">Fotos · ${fotos.length}</span>` : "",
    ].join("");
    if (chips) html += `<div class="card"><h3><span>Señales registradas</span></h3><div class="chips">${chips}</div></div>`;

    // Medicamentos
    const med = {};
    S.recs.filter((r) => r.tipo === "medicamento").forEach((r) => { const n = r.datos.nombre === "Otro" ? r.datos.otro || "Otro" : r.datos.nombre || "Medicamento"; const m = med[n] || (med[n] = { n: 0, last: r.fecha }); m.n++; if (r.fecha > m.last) m.last = r.fecha; });
    if (Object.keys(med).length) html += `<div class="card"><h3><span>Medicamentos y suplementos</span></h3><div class="chips">${Object.entries(med).map(([k, v]) => `<span class="chip sand">${esc(k)} · ${v.n} ${v.n === 1 ? "dosis" : "dosis"} · última ${short(keyOf(v.last))} ${hhmm(v.last)}</span>`).join("")}</div></div>`;

    // Medidas
    if (medidas.length) {
      let prev = null;
      const mr = medidas.map((r) => { let dif = "—"; if (r.datos.peso_g) { if (prev) { const dd = (new Date(r.fecha) - new Date(prev.fecha)) / 864e5; if (dd >= 0.5) { const v = (r.datos.peso_g - prev.datos.peso_g) / dd; dif = (v >= 0 ? "+" : "") + fmt(v) + " g/día"; } } prev = r; } return `<tr><td><b>${short(keyOf(r.fecha))}</b></td><td>${r.datos.peso_g ? fmt(r.datos.peso_g) : "—"}</td><td>${dif}</td><td>${r.datos.talla_cm ? fmt(r.datos.talla_cm) : "—"}</td><td>${r.datos.pc_cm ? fmt(r.datos.pc_cm) : "—"}</td></tr>`; }).reverse().join("");
      html += `<h2>Medidas</h2><div class="tbl"><div class="scroll"><table><thead><tr><th>Fecha</th><th>Peso (g)</th><th>Cambio</th><th>Talla (cm)</th><th>PC (cm)</th></tr></thead><tbody>${mr}</tbody></table></div></div>`;
    }

    // Observaciones
    const notas = S.recs.filter((r) => r.nota).slice(-15).reverse();
    if (notas.length) html += `<h2>Observaciones</h2>` + notas.map((r) => `<div class="card" style="padding:10px 12px"><div class="muted" style="margin:0 0 2px">${short(keyOf(r.fecha))} ${hhmm(r.fecha)} · ${esc(describe(r).title)}</div>${esc(r.nota)}</div>`).join("");

    // Fotos
    if (fotos.length) html += `<h2>Fotos</h2><div class="gallery">${fotos.slice().reverse().map((f) => `<button type="button" data-img="${esc(f.u)}"><img src="${esc(f.u)}" alt="Foto del ${short(keyOf(f.f))}" loading="lazy">${short(keyOf(f.f))}</button>`).join("")}</div>`;
    box.innerHTML = html;
  }

  /* ---------- Compartir con la doctora ---------- */
  async function renderShare() {
    const box = $("#shareBox");
    if (S.doctor) { box.innerHTML = ""; return; }
    let links = [];
    try { links = await DB.links(); } catch (e) { box.innerHTML = ""; return; }
    const base = location.origin + location.pathname;
    box.innerHTML = `<div class="sharecard"><h3><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>Enlace para la doctora</h3>
      <p>Solo lectura. Ella elige las fechas y ve todo lo anterior. Se puede desactivar cuando quieran.</p>
      ${links.map((l) => `<div><strong style="font-size:13px">${esc(l.nombre)}</strong><div class="linkrow ${l.activo ? "" : "off"}"><div class="url">${esc(base + "?doc=" + l.token)}</div><button type="button" class="btn" data-copy="${esc(l.token)}">Copiar</button></div>
        <div class="linkrow"><button type="button" class="btn" data-toggle="${esc(l.token)}" data-on="${l.activo ? 1 : 0}">${l.activo ? "Desactivar" : "Activar"}</button><button type="button" class="btn danger" data-dellink="${esc(l.token)}">Borrar</button></div></div>`).join("")}
      <div class="newlink"><input id="newLinkName" placeholder="Nombre, p. ej. Dra. gastropediatra" aria-label="Nombre del enlace"><button type="button" class="btn primary" id="btnNewLink">Crear</button></div></div>
      <div class="card" style="margin-top:10px"><h3><span>Copia de seguridad</span></h3><p class="muted" style="margin:4px 0 8px">Descarga todos los registros en un archivo que abre Excel. Conviene hacerlo cada semana.</p><button type="button" class="btn block" id="btnExport">Descargar copia (CSV)</button></div>`;
  }
  async function exportCSV() {
    toast("Preparando copia…");
    const all = await DB.list(new Date(2020, 0, 1).toISOString(), new Date(2100, 0, 1).toISOString());
    const q = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const rows = [["fecha", "hora", "tipo", "resumen", "datos", "observaciones", "fotos"].join(",")];
    for (const r of all) {
      const x = describe(r);
      rows.push([keyOf(r.fecha), hhmm(r.fecha), r.tipo, x.title + (x.sub ? " · " + x.sub : ""), JSON.stringify(r.datos || {}), r.nota || "", (r.fotos || []).map((u) => (u.startsWith("data:") ? "(foto local)" : u)).join(" ")].map(q).join(","));
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `seguimiento-${CFG.NOMBRE_BEBE}-${dayKey(new Date())}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    toast(`Copia descargada (${all.length} registros)`);
  }

  /* ---------- Formulario ---------- */
  function fieldHTML(f) {
    const v = F.datos[f.k];
    if (f.t === "seg") return `<div class="field"><span class="lbl">${f.label}</span><div class="seg ${f.wrap ? "wrap" : ""}">${f.opts.map((o) => `<button type="button" data-seg="${f.k}" data-v="${esc(o)}" class="${v === o ? "on " + (f.cls ? f.cls(o) : "") : ""}">${esc(o)}</button>`).join("")}</div></div>`;
    if (f.t === "checks") return `<div class="field"><span class="lbl">${f.label}</span><div class="checks">${f.opts.map((o) => `<button type="button" data-chk="${f.k}" data-v="${esc(o)}" class="${(v || []).includes(o) ? "on" : ""}">${esc(o)}</button>`).join("")}</div></div>`;
    if (f.t === "select") return `<div class="field"><label for="f_${f.k}">${f.label}</label><select id="f_${f.k}" data-sel="${f.k}"><option value="">${f.blank || "Elegir…"}</option>${f.opts.map((o) => `<option ${v === o ? "selected" : ""}>${esc(o)}</option>`).join("")}</select></div>`;
    if (f.t === "dt") return `<div class="field"><label for="f_${f.k}">${f.label}</label><input id="f_${f.k}" type="datetime-local" data-dt="${f.k}" value="${v ? toLocalInput(new Date(v)) : ""}"></div>`;
    return `<div class="field"><label for="f_${f.k}">${f.label}</label><input id="f_${f.k}" data-${f.t}="${f.k}" ${f.t === "num" ? 'inputmode="decimal"' : ""} value="${esc(v ?? "")}" placeholder="${esc(f.ph || "")}"></div>`;
  }
  function renderFields() {
    const spec = SPECS[F.tipo], vis = spec.fields.filter((f) => !f.show || f.show(F.datos));
    let html = "";
    for (let i = 0; i < vis.length; i++) {
      if (vis[i].half && vis[i + 1] && vis[i + 1].half) { html += `<div class="row2">${fieldHTML(vis[i])}${fieldHTML(vis[i + 1])}</div>`; i++; } else html += fieldHTML(vis[i]);
    }
    $("#fCampos").innerHTML = html;
  }
  function renderThumbs() {
    $("#fFotos").innerHTML = F.fotos.map((u, i) => `<div class="thumb"><img src="${esc(u)}" alt="Foto ${i + 1}"><button type="button" data-rmfoto="${i}" aria-label="Quitar foto">×</button></div>`).join("");
  }
  function openForm(tipo, rec) {
    const spec = SPECS[tipo];
    F = { tipo, id: rec ? rec.id : null, datos: rec ? JSON.parse(JSON.stringify(rec.datos || {})) : { ...spec.defaults }, fotos: rec ? [...(rec.fotos || [])] : [] };
    $("#fTitulo").textContent = (rec ? "Editar: " : "Registrar ") + spec.label.toLowerCase();
    $("label[for=fFecha]").textContent = spec.fechaLabel || "Fecha y hora";
    let when = rec ? new Date(rec.fecha) : new Date();
    if (!rec && S.day !== dayKey(new Date())) { const n = new Date(), d = startOfDay(S.day); d.setHours(n.getHours(), n.getMinutes()); when = d; }
    $("#fFecha").value = toLocalInput(when);
    $("#fNota").value = rec ? rec.nota || "" : "";
    $("#fErr").textContent = "";
    const del = $("#fDel"); del.classList.toggle("hidden", !rec); del.textContent = "Eliminar"; del.dataset.armed = "";
    renderFields(); renderThumbs();
    $("#dlgTipo").close();
    $("#dlgForm").showModal();
  }
  async function addPhotos(files) {
    for (const f of files) {
      try {
        toast("Subiendo foto…");
        const blob = await compress(f);
        F.fotos.push(await DB.upload(blob));
        renderThumbs(); toast("Foto agregada");
      } catch (e) { toast("No se pudo subir la foto"); console.error(e); }
    }
  }
  async function compress(file) {
    const max = 1280;
    let bmp;
    try { bmp = await createImageBitmap(file); } catch (e) {
      bmp = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, sc = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas"); c.width = Math.round(w * sc); c.height = Math.round(h * sc);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.8));
  }
  async function submitForm(ev) {
    ev.preventDefault();
    const spec = SPECS[F.tipo], d = F.datos, err = $("#fErr");
    for (const f of spec.fields) {
      if (f.show && !f.show(d)) { delete d[f.k]; continue; }
      if (f.req && (d[f.k] == null || d[f.k] === "")) { err.textContent = `Falta: ${f.label.toLowerCase()}.`; return; }
    }
    if (spec.validate) { const m = spec.validate(d); if (m) { err.textContent = m; return; } }
    if (F.tipo === "nota" && !$("#fNota").value.trim() && !F.fotos.length) { err.textContent = "Escribe una nota o agrega una foto."; return; }
    const fecha = new Date($("#fFecha").value);
    if (isNaN(fecha)) { err.textContent = "Revisa la fecha y la hora."; return; }
    if (F.tipo === "sueno" && new Date(d.fin) <= fecha) { err.textContent = "La hora de despertar debe ser posterior."; return; }
    const datos = {};
    for (const [k, v] of Object.entries(d)) if (v !== "" && v != null && !(Array.isArray(v) && !v.length)) datos[k] = v;
    $("#fOk").disabled = true;
    try {
      await DB.save({ id: F.id, tipo: F.tipo, fecha: fecha.toISOString(), datos, nota: $("#fNota").value.trim(), fotos: F.fotos });
      $("#dlgForm").close();
      toast("Guardado");
      if (keyOf(fecha.toISOString()) !== S.day && S.tab === "hoy") S.day = keyOf(fecha.toISOString());
      await Promise.all([loadDay(), loadRange()]);
      renderActive();
    } catch (e) { err.textContent = "No se pudo guardar: " + (e.message || e); console.error(e); }
    $("#fOk").disabled = false;
  }

  /* ---------- Navegación ---------- */
  function renderActive() {
    updateHeader();
    if (S.tab === "hoy") renderDay();
    else if (S.tab === "graf") renderCharts();
    else { renderReport(); renderShare(); }
  }
  async function switchTab(t) {
    S.tab = t;
    $$("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.tab === t));
    $("#v-hoy").classList.toggle("hidden", t !== "hoy");
    $("#v-graf").classList.toggle("hidden", t !== "graf");
    $("#v-rep").classList.toggle("hidden", t !== "rep");
    if (t === "hoy") await loadDay();
    renderActive();
    window.scrollTo(0, 0);
  }

  /* ---------- Eventos ---------- */
  function bind() {
    $("#tabs").addEventListener("click", (e) => { const b = e.target.closest("button[data-tab]"); if (b) switchTab(b.dataset.tab); });
    $("#fab").addEventListener("click", () => $("#dlgTipo").showModal());
    $("#tipoGrid").innerHTML = TIPOS.map((t) => `<button type="button" class="tipo" data-tipo="${t}">${svg(t)}${esc(SPECS[t].label)}</button>`).join("");
    $("#tipoGrid").addEventListener("click", (e) => { const b = e.target.closest("[data-tipo]"); if (b) openForm(b.dataset.tipo); });

    $$("[data-close]").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));
    $$("dialog").forEach((dlg) => dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); }));

    const goDay = async (k) => { S.day = k; await loadDay(); renderDay(); };
    $("#dPrev").addEventListener("click", () => goDay(dayKey(addDays(startOfDay(S.day), -1))));
    $("#dNext").addEventListener("click", () => goDay(dayKey(addDays(startOfDay(S.day), 1))));
    $("#dPick").addEventListener("change", (e) => { if (e.target.value) goDay(e.target.value); });

    $("#timeline").addEventListener("click", (e) => {
      const b = e.target.closest(".item"); if (!b) return;
      const r = S.dayRecs.find((x) => x.id === b.dataset.id); if (!r) return;
      if (S.doctor) { if ((r.fotos || [])[0]) showImg(r.fotos[0]); return; }
      openForm(r.tipo, r);
    });

    document.addEventListener("click", async (e) => {
      const t = e.target;
      const pr = t.closest("[data-preset]"); if (pr) return changeRange(pr.dataset.preset);
      const im = t.closest("[data-img]"); if (im) return showImg(im.dataset.img);
      const cp = t.closest("[data-copy]");
      if (cp) { const url = location.origin + location.pathname + "?doc=" + cp.dataset.copy; try { await navigator.clipboard.writeText(url); toast("Enlace copiado"); } catch (_) { prompt("Copia el enlace:", url); } return; }
      const tg = t.closest("[data-toggle]"); if (tg) { await DB.setLinkActive(tg.dataset.toggle, tg.dataset.on !== "1"); return renderShare(); }
      const dl = t.closest("[data-dellink]");
      if (dl) { if (dl.dataset.armed) { await DB.deleteLink(dl.dataset.dellink); return renderShare(); } dl.dataset.armed = "1"; dl.textContent = "¿Seguro? Toca otra vez"; return; }
      if (t.closest("#btnExport")) { try { await exportCSV(); } catch (er) { toast("No se pudo descargar la copia"); console.error(er); } return; }
      if (t.closest("#btnNewLink")) { const n = $("#newLinkName").value.trim(); if (!n) return toast("Escribe un nombre"); await DB.createLink(n); toast("Enlace creado"); return renderShare(); }
    });
    document.addEventListener("change", (e) => {
      if (e.target.matches("[data-cd]")) { S.range.cd = e.target.value; changeRange("custom"); }
      if (e.target.matches("[data-ch]")) { S.range.ch = e.target.value; changeRange("custom"); }
    });

    // Formulario
    const fc = $("#fCampos");
    fc.addEventListener("click", (e) => {
      const s = e.target.closest("[data-seg]");
      if (s) { const k = s.dataset.seg, v = s.dataset.v; F.datos[k] = F.datos[k] === v ? "" : v; renderFields(); return; }
      const c = e.target.closest("[data-chk]");
      if (c) { const k = c.dataset.chk, v = c.dataset.v, a = F.datos[k] || []; F.datos[k] = a.includes(v) ? a.filter((x) => x !== v) : [...a, v]; renderFields(); }
    });
    fc.addEventListener("change", (e) => {
      if (e.target.matches("[data-sel]")) { F.datos[e.target.dataset.sel] = e.target.value; renderFields(); }
      if (e.target.matches("[data-dt]")) F.datos[e.target.dataset.dt] = e.target.value ? new Date(e.target.value).toISOString() : "";
    });
    fc.addEventListener("input", (e) => {
      if (e.target.matches("[data-num]")) { const v = e.target.value.replace(",", "."); F.datos[e.target.dataset.num] = v === "" || isNaN(v) ? "" : Number(v); }
      if (e.target.matches("[data-text]")) F.datos[e.target.dataset.text] = e.target.value;
    });
    $("#form").addEventListener("submit", submitForm);
    $("#btnCam").addEventListener("click", () => $("#inCam").click());
    $("#btnGal").addEventListener("click", () => $("#inGal").click());
    for (const id of ["#inCam", "#inGal"]) $(id).addEventListener("change", async (e) => { const fs = [...e.target.files]; e.target.value = ""; await addPhotos(fs); });
    $("#fFotos").addEventListener("click", (e) => { const b = e.target.closest("[data-rmfoto]"); if (b) { F.fotos.splice(Number(b.dataset.rmfoto), 1); renderThumbs(); } });
    $("#fDel").addEventListener("click", async (e) => {
      const b = e.currentTarget;
      if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "¿Seguro? Toca otra vez"; setTimeout(() => { b.dataset.armed = ""; b.textContent = "Eliminar"; }, 4000); return; }
      try { await DB.remove(F.id); $("#dlgForm").close(); toast("Eliminado"); await Promise.all([loadDay(), loadRange()]); renderActive(); } catch (er) { $("#fErr").textContent = "No se pudo eliminar."; }
    });
    $("#btnPrint").addEventListener("click", () => window.print());
    $("#btnSalir").addEventListener("click", async () => { await DB.signOut(); location.reload(); });
  }
  function showImg(u) { $("#bigImg").src = u; $("#dlgImg").showModal(); }

  /* ---------- Inicio ---------- */
  async function start() {
    $("#login").classList.add("hidden");
    $("#app").classList.remove("hidden");
    const b = $("#modeBadge");
    if (S.doctor) { document.body.classList.add("doctor"); b.textContent = "Vista de la doctora · solo lectura"; b.classList.add("doc"); b.classList.remove("hidden"); $("#btnSalir").classList.add("hidden"); S.tab = "rep"; }
    else if (DB.demo) { b.textContent = "Modo demo"; b.classList.remove("hidden"); }
    bind();
    setRange("14");
    try { await Promise.all([loadRange(), loadDay()]); } catch (e) { toast("No se pudieron cargar los datos"); console.error(e); }
    await switchTab(S.tab);
  }
  async function init() {
    $$(".bn").forEach((e) => (e.textContent = CFG.NOMBRE_BEBE));
    document.title = "Seguimiento de " + CFG.NOMBRE_BEBE;
    if (S.doctor) return start();
    let ses = null;
    try { ses = await DB.session(); } catch (e) { console.error(e); }
    if (ses) return start();
    $("#login").classList.remove("hidden");
    $("#loginForm").addEventListener("submit", async (ev) => {
      ev.preventDefault(); $("#lErr").textContent = "";
      try { await DB.signIn($("#lEmail").value.trim(), $("#lPass").value); await start(); } catch (e) {
        const m = String((e && e.message) || e);
        console.error(e);
        $("#lErr").textContent = /invalid login/i.test(m) ? "Correo o contraseña incorrectos." : /not confirmed/i.test(m) ? "El correo aún no está confirmado en Supabase." : /api key|apikey|jwt/i.test(m) ? "La clave de Supabase en config.js no es válida." : /fetch|network|failed/i.test(m) ? "No se pudo conectar con Supabase. Revisa el SUPABASE_URL en config.js." : "Error: " + m;
      }
    });
  }
  init();
})();
