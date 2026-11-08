// Comportamiento común de la web de Hiluma. Los textos llegan en window.T (uno por idioma).
(() => {
const T = window.T;
const WHATSAPP = "34681818093";
// Al final de cada mensaje va la página desde la que se escribe, para saber qué páginas traen consultas
const ORIGEN = `\n\n(${location.hostname.replace(/^www\./, "")}${location.pathname})`;
const waLink = msg => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg + ORIGEN)}`;
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// Enlaces de WhatsApp con mensaje fijo
$$(".js-wa").forEach(a => { a.href = waLink(a.dataset.msg || T.wa.hola); a.target = "_blank"; a.rel = "noopener"; });

// Menú móvil
const menuBtn = $("#menuBtn"), menuNav = $("#menuNav");
if (menuBtn) menuBtn.addEventListener("click", () => menuBtn.setAttribute("aria-expanded", menuNav.classList.toggle("abierto")));

// Recordar el idioma elegido
$$(".idiomas a[hreflang]").forEach(a => a.addEventListener("click", () => { try { localStorage.setItem("hiluma-idioma", a.hreflang); } catch {} }));
try { localStorage.setItem("hiluma-idioma", document.documentElement.lang); } catch {}

const anio = $("#anio"); if (anio) anio.textContent = new Date().getFullYear();

// Personajes: se marcan y desmarcan; cada grupo guarda su selección
const elegidos = grupo => $$(".personaje[aria-pressed='true']", grupo).map(b => b.dataset.nombre);
$$(".personajes").forEach(grupo => {
  const contador = grupo.parentElement.querySelector(".contador");
  const pintar = () => {
    const n = elegidos(grupo).length;
    if (contador) contador.textContent = n === 0 ? "" : n === 1 ? T.personajes.uno : T.personajes.varios.replace("{n}", n);
  };
  grupo.addEventListener("click", e => {
    const b = e.target.closest(".personaje"); if (!b) return;
    b.setAttribute("aria-pressed", b.getAttribute("aria-pressed") === "true" ? "false" : "true");
    pintar();
  });
});

// Visor de fotos del local: toca una foto para verla en grande y pasar a la siguiente de su zona
const visor = $("#visor");
if (visor) {
  let grupo = [], pos = 0;
  const img = $("img", visor), pie = $("figcaption", visor);
  const mostrar = i => { pos = (i + grupo.length) % grupo.length; const a = grupo[pos]; img.src = a.href; img.alt = $("img", a).alt; pie.textContent = img.alt; };
  $$(".ampliar").forEach(a => a.addEventListener("click", e => {
    e.preventDefault();
    grupo = $$(".ampliar").filter(x => x.dataset.grupo === a.dataset.grupo);
    mostrar(grupo.indexOf(a)); visor.showModal();
  }));
  $(".visor-cerrar", visor).addEventListener("click", () => visor.close());
  $(".visor-ant", visor).addEventListener("click", () => mostrar(pos - 1));
  $(".visor-sig", visor).addEventListener("click", () => mostrar(pos + 1));
  visor.addEventListener("click", e => { if (e.target === visor || e.target.tagName === "FIGURE") visor.close(); });
  visor.addEventListener("keydown", e => { if (e.key === "ArrowLeft") mostrar(pos - 1); if (e.key === "ArrowRight") mostrar(pos + 1); });
  let x0 = null;
  visor.addEventListener("touchstart", e => { x0 = e.touches[0].clientX; }, { passive: true });
  visor.addEventListener("touchend", e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 40) mostrar(pos + (dx < 0 ? 1 : -1)); x0 = null; });
}

// Mensaje con los extras elegidos
const lineaExtras = grupo => {
  const l = grupo ? elegidos(grupo) : [];
  return l.length ? `\n• ${T.wa.extras}: ${l.join(", ")}` : "";
};
const lineaNota = campo => campo && campo.value.trim() ? `\n• ${campo.value.trim()}` : "";

// Página de personajes: fiesta en Hiluma o alquiler para llevar
const formPersonajes = $("#formPersonajes");
if (formPersonajes) {
  let modo = "hiluma";
  $$(".modo button").forEach(b => b.addEventListener("click", () => {
    modo = b.dataset.modo;
    $$(".modo button").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  }));
  const fecha = $("#fechaPersonajes");
  const hoy = new Date(); hoy.setDate(hoy.getDate() + 1);
  fecha.min = hoy.toISOString().slice(0, 10);
  formPersonajes.addEventListener("submit", e => {
    e.preventDefault();
    const grupo = $("#personajesGaleria");
    if (!elegidos(grupo).length) { $("#avisoPersonajes").textContent = T.personajes.elige; return; }
    $("#avisoPersonajes").textContent = "";
    let msg = modo === "hiluma" ? T.wa.personajesHiluma : T.wa.personajesLlevar;
    msg += lineaExtras(grupo).replace(T.wa.extras, T.wa.personajes);
    if (fecha.value) msg += `\n• ${new Date(fecha.value + "T12:00").toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long" })}`;
    msg += lineaNota($("#notaPersonajes"));
    window.open(waLink(msg), "_blank", "noopener");
  });
}

// Calendario de disponibilidad
const cal = $("#calendario");
if (!cal) return;
const FRANJAS = [
  { id: "manana", nombre: T.franjas.manana, horas: "10:00 – 14:00" },
  { id: "tarde", nombre: T.franjas.tarde, horas: "16:00 – 20:00" },
  { id: "noche", nombre: T.franjas.noche, horas: "20:30 – 23:30" },
];
const local = ["localhost", "127.0.0.1"].includes(location.hostname);
// En la web publicada se pregunta directamente al flujo de n8n (admite peticiones desde hilumaeventos.com);
// en la vista previa local pasa por servir.py
const API = local ? "/api/disponibilidad" : "https://app.kaelorsyrona.com/webhook/hiluma-disponibilidad";
const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const manana = new Date(); manana.setHours(0, 0, 0, 0); manana.setDate(manana.getDate() + 1);
const limite = new Date(manana); limite.setFullYear(limite.getFullYear() + 1);
let mes = new Date(manana.getFullYear(), manana.getMonth(), 1);
let diaSel = null, franjaSel = null, datos = {}, ejemplo = false;
const cache = {};

// Datos inventados y estables por fecha, solo para ver el calendario en local sin conexión con Calendar
const ejemploMes = clave => {
  const [a, m] = clave.split("-").map(Number), dias = {};
  for (let d = 1; d <= new Date(a, m, 0).getDate(); d++) {
    const k = `${clave}-${String(d).padStart(2, "0")}`, s = (a * 31 + m * 7 + d * 13) % 10, f = new Date(a, m - 1, d).getDay();
    dias[k] = { manana: s % 4 !== 0, tarde: !(f === 6 || f === 0) || s % 3 === 0, noche: s !== 5 && s !== 7 };
  }
  return dias;
};

async function cargar(clave) {
  if (cache[clave]) return cache[clave];
  try {
    const r = await fetch(`${API}?mes=${clave}`, { headers: { accept: "application/json" } });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json();
    if (!j || !j.dias) throw new Error("sin datos");
    return (cache[clave] = { dias: j.dias, ejemplo: false });
  } catch {
    if (local) return (cache[clave] = { dias: ejemploMes(clave), ejemplo: true });
    return { dias: null, ejemplo: false };
  }
}

// true = libre, false = ocupada, null = sin dato (se confirma por WhatsApp)
const estado = (k, f) => { const d = datos && datos[k]; return d && typeof d[f] === "boolean" ? d[f] : null; };

async function pintarMes() {
  const clave = `${mes.getFullYear()}-${String(mes.getMonth() + 1).padStart(2, "0")}`;
  const titulo = mes.toLocaleDateString(T.locale, { month: "long", year: "numeric" });
  $("#calMes").textContent = titulo.charAt(0).toUpperCase() + titulo.slice(1);
  $("#calAntes").disabled = mes <= new Date(manana.getFullYear(), manana.getMonth(), 1);
  $("#calDespues").disabled = mes >= new Date(limite.getFullYear(), limite.getMonth(), 1);
  const dias = $("#calDias");
  dias.innerHTML = "";
  $("#calEstado").textContent = T.cal.cargando;
  const r = await cargar(clave);
  datos = r.dias || {}; ejemplo = r.ejemplo;
  $("#calEjemplo").hidden = !ejemplo;
  $("#calEstado").textContent = r.dias ? "" : T.cal.error;
  const primero = (new Date(mes).getDay() + 6) % 7;
  for (let i = 0; i < primero; i++) dias.append(Object.assign(document.createElement("span"), { className: "cal-vacio" }));
  const total = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
  for (let n = 1; n <= total; n++) {
    const d = new Date(mes.getFullYear(), mes.getMonth(), n), k = iso(d);
    const b = document.createElement("button");
    b.type = "button"; b.className = "dia"; b.dataset.fecha = k;
    b.setAttribute("aria-pressed", k === diaSel ? "true" : "false");
    const fuera = d < manana || d > limite;
    const estados = FRANJAS.map(f => estado(k, f.id));
    b.innerHTML = `<span>${n}</span>` + (fuera || !r.dias ? "" : `<span class="puntos">${estados.map(e => `<i class="${e === false ? "ocupada" : e === null ? "duda" : ""}"></i>`).join("")}</span>`);
    if (fuera) b.disabled = true;
    else if (r.dias && estados.every(e => e === false)) { b.classList.add("lleno"); b.disabled = true; b.setAttribute("aria-label", `${n}: ${T.cal.completo}`); }
    dias.append(b);
  }
}

function pintarFranjas() {
  const caja = $("#franjasElegir");
  caja.innerHTML = "";
  if (!diaSel) { $("#elegido").textContent = T.cal.eligeDia; return; }
  $("#elegido").textContent = new Date(diaSel + "T12:00").toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long" });
  FRANJAS.forEach(f => {
    const e = estado(diaSel, f.id), b = document.createElement("button");
    b.type = "button"; b.className = "franja"; b.dataset.franja = f.id;
    b.innerHTML = `<span>${f.nombre} · ${f.horas}</span><small class="${e === false ? "e-ocupada" : e === null ? "e-duda" : "e-libre"}">${e === false ? T.cal.ocupada : e === null ? T.cal.aConfirmar : T.cal.libre}</small>`;
    b.disabled = e === false;
    b.setAttribute("aria-pressed", f.id === franjaSel ? "true" : "false");
    caja.append(b);
  });
}

function actualizarBoton() { $("#enviarReserva").disabled = !(diaSel && franjaSel); }

$("#calDias").addEventListener("click", e => {
  const b = e.target.closest(".dia"); if (!b || b.disabled) return;
  diaSel = b.dataset.fecha; franjaSel = null;
  $$(".dia", cal).forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  pintarFranjas(); actualizarBoton();
  if (matchMedia("(max-width:900px)").matches) $("#panelReserva").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#franjasElegir").addEventListener("click", e => {
  const b = e.target.closest(".franja"); if (!b || b.disabled) return;
  franjaSel = b.dataset.franja;
  $$(".franja").forEach(x => x.setAttribute("aria-pressed", x === b ? "true" : "false"));
  actualizarBoton();
});
$("#calAntes").addEventListener("click", () => { mes = new Date(mes.getFullYear(), mes.getMonth() - 1, 1); pintarMes(); });
$("#calDespues").addEventListener("click", () => { mes = new Date(mes.getFullYear(), mes.getMonth() + 1, 1); pintarMes(); });

$("#formReserva").addEventListener("submit", e => {
  e.preventDefault();
  if (!diaSel || !franjaSel) return;
  const f = FRANJAS.find(x => x.id === franjaSel);
  const fecha = new Date(diaSel + "T12:00").toLocaleDateString(T.locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  let msg = `${T.wa.reserva}\n• ${$("#tipo").value}\n• ${fecha}\n• ${f.nombre} (${f.horas})`;
  msg += lineaExtras($("#personajesReserva"));
  msg += lineaNota($("#nota"));
  window.open(waLink(msg), "_blank", "noopener");
});

// Si llegan desde una tarjeta con ?tipo=..., se preselecciona
const pTipo = new URLSearchParams(location.search).get("tipo");
if (pTipo) { const o = [...$("#tipo").options].find(o => o.dataset.clave === pTipo); if (o) o.selected = true; }

pintarMes(); pintarFranjas(); actualizarBoton();
})();
