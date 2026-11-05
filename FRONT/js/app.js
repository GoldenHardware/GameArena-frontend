// ===== GameArena · panel del administrador =====
// Habla con la API REST de Spring Boot. Si no responde, pasa a modo demo (js/demo.js).

const API = "http://localhost:8080";
let modoDemo = false;

// Caché local para rellenar selectores y el resumen
let datos = { torneos: [], jugadores: [], videojuegos: [] };
let editandoTorneo = null;   // id del torneo que se está editando
let editandoJugador = null;  // id del jugador que se está editando
let listaTorneos = [];       // lo que devolvió la última consulta de torneos (con o sin filtro)
let destacadoId = null;      // id del torneo que aparece arriba
// Orden actual de cada tabla: campo y sentido
const orden = { torneos: { campo: "fecha", asc: true }, jugadores: { campo: "id", asc: true } };

const $ = id => document.getElementById(id);

// ---------- Utilidades ----------
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const euros = n => n == null || n === "" ? "—" : Number(n).toLocaleString("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0, useGrouping: "always" });
const fecha = f => f ? new Date(f + "T00:00").toLocaleDateString("es-ES", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const colores = ["#ffd60a", "#e8c547", "#f2f0ea", "#c9a400", "#ffe873", "#bdbdb5", "#ffb627"];
const avatar = nick => `<span class="avatar" style="background:${colores[(nick || "?").charCodeAt(0) % colores.length]}">${esc((nick || "?").slice(0, 2).toUpperCase())}</span>`;
const insigniaEstado = e => `<span class="badge estado estado-${esc(e)}">${esc((e || "").replace("_", " "))}</span>`;

const toast = Swal.mixin({ toast: true, position: "top-end", showConfirmButton: false, timer: 2600, timerProgressBar: true });

async function peticion(metodo, ruta, cuerpo) {
  if (modoDemo) {
    const r = await Demo.peticion(metodo, ruta, cuerpo);
    if (r.status >= 400) throw new Error(r.data?.mensaje || "Error " + r.status);
    return r.data;
  }
  const opciones = { method: metodo, headers: { "Content-Type": "application/json" } };
  if (cuerpo) opciones.body = JSON.stringify(cuerpo);
  const resp = await fetch(API + ruta, opciones);
  const texto = await resp.text();
  const json = texto ? JSON.parse(texto) : null;
  if (!resp.ok) throw new Error(json?.mensaje || json?.message || "Error " + resp.status);
  return json;
}

function aviso(tipo, mensaje) {
  // tipo: success (verde), warning (amarillo), danger (rojo)
  $("aviso").innerHTML = `<div class="alert alert-${tipo} alert-dismissible animate__animated animate__fadeInDown" role="alert">
    ${esc(mensaje)}<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div>`;
}

function error(e) {
  Swal.fire({ icon: "error", title: "No se ha podido hacer", text: e.message, confirmButtonColor: "#ffd60a", customClass: { confirmButton: "texto-oscuro" } });
}

function filasCargando(tbody, columnas) {
  tbody.innerHTML = Array.from({ length: 4 }, () =>
    `<tr class="cargando">${"<td><span></span></td>".repeat(columnas)}</tr>`).join("");
}

function filaVacia(columnas, texto) {
  return `<tr><td colspan="${columnas}" class="vacio"><i class="bi bi-inbox"></i>${texto}</td></tr>`;
}

function animarCifra(el, valor) {
  const inicio = Number(el.textContent) || 0, t0 = performance.now();
  const paso = t => {
    const k = Math.min(1, (t - t0) / 600);
    el.textContent = Math.round(inicio + (valor - inicio) * k);
    if (k < 1) requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

function pintarDestacado() {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const proximo = datos.torneos
    .filter(t => t.estado === "ABIERTO" && t.fecha && new Date(t.fecha + "T00:00") >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const caja = $("destacado");
  if (!proximo) {
    $("destNombre").textContent = "No hay torneos abiertos";
    $("destDetalle").textContent = "Crea uno en la pestaña Torneos y aparecerá aquí.";
    $("destDias").textContent = "–";
    $("destDiasTexto").textContent = "";
    $("destAcciones").hidden = true;
    destacadoId = null;
    caja.classList.add("vacio-destacado");
    return;
  }
  caja.classList.remove("vacio-destacado");
  destacadoId = proximo.id;
  $("destAcciones").hidden = false;
  const dias = Math.round((new Date(proximo.fecha + "T00:00") - hoy) / 86400000);
  $("destNombre").textContent = proximo.nombre;
  $("destDetalle").innerHTML = `<i class="bi bi-joystick"></i> ${esc(proximo.videojuego?.nombre)}<span class="sep"></span>${fecha(proximo.fecha)}<span class="sep"></span>Premio ${euros(proximo.premio)}`;
  $("destDiasTexto").textContent = dias === 0 ? "empieza hoy" : dias === 1 ? "día para empezar" : "días para empezar";
  animarCifra($("destDias"), dias);
}

// Datos vivos en la portada
function diasHasta(f) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  return Math.round((new Date(f + "T00:00") - hoy) / 86400000);
}

function pintarPortada() {
  const abiertos = datos.torneos.filter(t => t.estado === "ABIERTO");
  const premios = abiertos.reduce((suma, t) => suma + (Number(t.premio) || 0), 0);
  $("portadaPremios").textContent = euros(premios);
  $("portadaJugadores").textContent = datos.jugadores.length;
  $("portadaNumJuegos").textContent = datos.videojuegos.length;
  $("portadaEstado").textContent = abiertos.length === 1 ? "1 abierto" : abiertos.length + " abiertos";

  // Cartelera: lo que está en juego y lo próximo que empieza
  const proximos = datos.torneos
    .filter(t => t.estado === "EN_CURSO" || (t.estado === "ABIERTO" && t.fecha && diasHasta(t.fecha) >= 0))
    .sort((a, b) => (a.estado === "EN_CURSO" ? -1 : 0) - (b.estado === "EN_CURSO" ? -1 : 0) || a.fecha.localeCompare(b.fecha))
    .slice(0, 4);
  $("cartelera").innerHTML = proximos.length ? proximos.map(t => {
    const d = diasHasta(t.fecha);
    const cuando = t.estado === "EN_CURSO" ? '<span class="en-juego">En juego</span>'
      : d === 0 ? "<strong>Hoy</strong>" : `<strong>${d}</strong> ${d === 1 ? "día" : "días"}`;
    return `<li><button type="button" class="cartelera-item" data-torneo="${t.id}">
      <span class="cartelera-juego">${esc(t.videojuego?.nombre)}</span>
      <span class="cartelera-nombre">${esc(t.nombre)}</span>
      <span class="cartelera-premio">${euros(t.premio)}</span>
      <span class="cartelera-cuando">${cuando}</span>
    </button></li>`;
  }).join("") : '<li class="cartelera-vacia">No hay torneos abiertos. Crea uno y aparecerá aquí.</li>';

  // Rótulo: todos los torneos por fecha. Se duplica para que el bucle no tenga corte
  const items = [...datos.torneos].sort((a, b) => (a.fecha || "").localeCompare(b.fecha || "")).map(t =>
    `<span class="rotulo-item"><span class="punto punto-${esc(t.estado)}"></span>${esc(t.nombre)} <span class="rotulo-sec">${esc(t.videojuego?.nombre)}, ${fecha(t.fecha)}</span></span>`).join("");
  $("rotuloPista").innerHTML = items ? `<div>${items}</div><div aria-hidden="true">${items}</div>` : "";
}

function actualizarResumen() {
  pintarDestacado();
  pintarPortada();
  animarCifra($("statTorneos"), datos.torneos.length);
  animarCifra($("statAbiertos"), datos.torneos.filter(t => t.estado === "ABIERTO").length);
  animarCifra($("statJugadores"), datos.jugadores.length);
  animarCifra($("statJuegos"), datos.videojuegos.length);
}

function rellenarSelect(select, lista, texto, primeraOpcion = "") {
  const actual = select.value;
  select.innerHTML = `<option value="">${primeraOpcion}</option>` +
    lista.map(x => `<option value="${x.id}">${esc(texto(x))}</option>`).join("");
  select.value = actual;
}

function rellenarSelectores() {
  rellenarSelect($("tVideojuego"), datos.videojuegos, v => v.nombre);
  rellenarSelect($("filtroVideojuego"), datos.videojuegos, v => v.nombre, "Todos los videojuegos");
  rellenarSelect($("iJugador"), datos.jugadores, j => `${j.nick} (#${j.id})`);
  rellenarSelect($("iTorneo"), datos.torneos.filter(t => t.estado === "ABIERTO"), t => `${t.nombre} (#${t.id})`);
  if ($("iTorneo").value) marcarInscritos();
}

function validar(form) {
  form.classList.add("was-validated");
  if (!form.checkValidity()) {
    form.classList.add("animate__animated", "animate__headShake");
    form.addEventListener("animationend", () => form.classList.remove("animate__animated", "animate__headShake"), { once: true });
    return false;
  }
  return true;
}

function limpiarForm(form) {
  form.reset();
  form.classList.remove("was-validated");
}

function resaltar(tbody, id) {
  const fila = tbody.querySelector(`tr[data-id="${id}"]`);
  if (fila) { fila.classList.add("fila-nueva"); fila.scrollIntoView({ behavior: "smooth", block: "center" }); }
}

async function confirmar(titulo, texto) {
  const r = await Swal.fire({
    icon: "warning", title: titulo, text: texto, showCancelButton: true,
    confirmButtonText: "Sí, eliminar", cancelButtonText: "Cancelar",
    confirmButtonColor: "#dc3545", cancelButtonColor: "#30363d", reverseButtons: true
  });
  return r.isConfirmed;
}

function mostrarPanel(id) {
  const panel = $(id);
  panel.hidden = false;
  panel.classList.remove("animate__fadeOut");
  panel.classList.add("animate__animated", "animate__fadeInUp");
}

// ---------- Ordenar tablas ----------
function valorOrden(x, campo) {
  if (campo === "videojuego") return (x.videojuego?.nombre || "").toLowerCase();
  const v = x[campo];
  return typeof v === "string" ? v.toLowerCase() : (v ?? -Infinity);
}

function ordenar(lista, tabla) {
  const { campo, asc } = orden[tabla];
  return [...lista].sort((a, b) => {
    const va = valorOrden(a, campo), vb = valorOrden(b, campo);
    return (va < vb ? -1 : va > vb ? 1 : 0) * (asc ? 1 : -1);
  });
}

function marcarCabecera(tabla) {
  document.querySelectorAll(`tr[data-tabla="${tabla}"] th.ordenable`).forEach(th => {
    const activo = th.dataset.orden === orden[tabla].campo;
    th.setAttribute("aria-sort", activo ? (orden[tabla].asc ? "ascending" : "descending") : "none");
  });
}

// ---------- Navegación entre pestañas ----------
function irAPestana(idBoton) {
  return new Promise(res => {
    const boton = $(idBoton);
    if (boton.classList.contains("active")) { res(); return; }
    boton.addEventListener("shown.bs.tab", () => res(), { once: true });
    bootstrap.Tab.getOrCreateInstance(boton).show();
  });
}

function guardarPestana(id) {
  try { localStorage.setItem("gamearena.pestana", id); } catch { /* sin almacenamiento: no pasa nada */ }
}
function leerPestana() {
  try { return localStorage.getItem("gamearena.pestana"); } catch { return null; }
}

// ---------- Conexión ----------
async function comprobarConexion() {
  const badge = $("conexion");
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 2000);
    const r = await fetch(API + "/videojuegos", { signal: ctrl.signal });
    if (!r.ok) throw new Error();
    badge.className = "badge conectado";
    badge.textContent = "Conectado";
  } catch {
    modoDemo = true;
    badge.className = "badge demo";
    badge.textContent = "Modo demo";
    aviso("warning", "La API no responde en " + API + ". Estás viendo datos de ejemplo: los cambios se pierden al recargar. Arranca el backend y recarga para usar los datos reales.");
  }
}

// =================== TORNEOS ===================
function pintarTorneos(lista = listaTorneos) {
  listaTorneos = lista;
  const tbody = $("cuerpoTorneos");
  const q = $("filtroTextoTorneos").value.trim().toLowerCase();
  lista = ordenar(lista.filter(t => !q || t.nombre.toLowerCase().includes(q) || (t.videojuego?.nombre || "").toLowerCase().includes(q)), "torneos");
  marcarCabecera("torneos");
  $("contTorneos").textContent = lista.length === 1 ? "1 torneo" : lista.length + " torneos";
  if (!lista.length) {
    const hayFiltros = q || $("filtroEstado").value || $("filtroVideojuego").value;
    tbody.innerHTML = filaVacia(7, hayFiltros ? "Ningún torneo cumple estos filtros. Quita alguno para ver más." : "Todavía no hay torneos. Crea el primero con el formulario de abajo.");
    return;
  }
  tbody.innerHTML = lista.map(t => `
    <tr data-id="${t.id}">
      <td class="text-secondary">#${t.id}</td>
      <td class="fw-semibold">${esc(t.nombre)}</td>
      <td>${fecha(t.fecha)}</td>
      <td>${euros(t.premio)}</td>
      <td>${insigniaEstado(t.estado)}</td>
      <td><i class="bi bi-joystick text-secondary me-1"></i>${esc(t.videojuego?.nombre)}</td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-light" data-accion="participantes" title="Participantes" data-bs-toggle="tooltip"><i class="bi bi-people"></i></button>
        <button class="btn btn-sm btn-outline-warning" data-accion="editar" title="Editar" data-bs-toggle="tooltip"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-accion="eliminar" title="Eliminar" data-bs-toggle="tooltip"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join("");
  activarTooltips(tbody);
}

async function cargarTorneos() {
  filasCargando($("cuerpoTorneos"), 7);
  try {
    datos.torneos = await peticion("GET", "/torneos");
    aplicarFiltroTorneos();
    rellenarSelectores();
    actualizarResumen();
    pintarJuegos();
  } catch (e) { $("cuerpoTorneos").innerHTML = filaVacia(7, "Error al cargar: " + esc(e.message)); }
}

async function aplicarFiltroTorneos() {
  const estado = $("filtroEstado").value;
  const juego = $("filtroVideojuego").value;
  if (!estado && !juego) { pintarTorneos(datos.torneos); return; }
  let ruta;
  if (estado && juego) ruta = `/torneos/videojuego/${juego}/estado/${estado}`;
  else if (estado) ruta = `/torneos/estado/${estado}`;
  else ruta = `/torneos/videojuego/${juego}`;
  filasCargando($("cuerpoTorneos"), 7);
  try { pintarTorneos(await peticion("GET", ruta)); } catch (e) { error(e); }
}

async function buscarTorneo() {
  const id = $("buscarTorneoId").value;
  const res = $("resTorneo");
  if (!id) { res.innerHTML = ""; return; }
  try {
    const t = await peticion("GET", `/torneos/${id}`);
    res.innerHTML = `<div class="resultado animate__animated animate__fadeIn d-flex flex-wrap gap-3 align-items-center">
      <i class="bi bi-trophy fs-3 text-warning"></i>
      <div><div class="fw-bold">${esc(t.nombre)} <span class="text-secondary">#${t.id}</span></div>
      <small class="text-secondary">${fecha(t.fecha)} · ${euros(t.premio)} · ${esc(t.videojuego?.nombre)}</small></div>
      <div class="ms-auto">${insigniaEstado(t.estado)}</div></div>`;
  } catch (e) {
    res.innerHTML = `<div class="alert alert-danger animate__animated animate__shakeX">${esc(e.message)}</div>`;
  }
}

function editarTorneo(id) {
  const t = datos.torneos.find(x => x.id === id);
  if (!t) return;
  editandoTorneo = id;
  $("tNombre").value = t.nombre;
  $("tFecha").value = t.fecha;
  $("tPremio").value = t.premio ?? "";
  $("tEstado").value = t.estado;
  $("tVideojuego").value = t.videojuego?.id ?? "";
  $("tituloFormTorneo").innerHTML = `<i class="bi bi-pencil me-2"></i>Editando torneo #${id}`;
  $("btnTorneo").innerHTML = '<i class="bi bi-save me-1"></i>Guardar cambios';
  $("btnTorneo").className = "btn btn-warning w-100";
  $("btnCancelarTorneo").hidden = false;
  $("formTorneo").closest(".card").classList.add("modo-edicion");
  $("tNombre").focus();
  $("formTorneo").scrollIntoView({ behavior: "smooth", block: "center" });
}

function salirEdicionTorneo() {
  editandoTorneo = null;
  limpiarForm($("formTorneo"));
  $("tituloFormTorneo").innerHTML = '<i class="bi bi-plus-circle me-2"></i>Nuevo torneo';
  $("btnTorneo").innerHTML = '<i class="bi bi-check2-circle me-1"></i>Crear torneo';
  $("btnTorneo").className = "btn btn-success w-100";
  $("btnCancelarTorneo").hidden = true;
  $("formTorneo").closest(".card").classList.remove("modo-edicion");
}

async function guardarTorneo(ev) {
  ev.preventDefault();
  if (!validar(ev.target)) return;
  const cuerpo = {
    nombre: $("tNombre").value.trim(),
    fecha: $("tFecha").value,
    premio: $("tPremio").value === "" ? null : Number($("tPremio").value),
    estado: $("tEstado").value,
    videojuego: { id: Number($("tVideojuego").value) }
  };
  try {
    const t = editandoTorneo
      ? await peticion("PUT", `/torneos/${editandoTorneo}`, cuerpo)
      : await peticion("POST", "/torneos", cuerpo);
    toast.fire({ icon: "success", title: editandoTorneo ? "Torneo actualizado" : "Torneo creado" });
    salirEdicionTorneo();
    await cargarTorneos();
    resaltar($("cuerpoTorneos"), t.id);
  } catch (e) { error(e); }
}

async function eliminarTorneo(id) {
  const t = datos.torneos.find(x => x.id === id);
  if (!await confirmar("¿Eliminar torneo?", `Se borrará «${t?.nombre}». Esta acción no se puede deshacer.`)) return;
  try {
    await peticion("DELETE", `/torneos/${id}`);
    toast.fire({ icon: "success", title: "Torneo eliminado" });
    if (editandoTorneo === id) salirEdicionTorneo();
    await cargarTorneos();
  } catch (e) { error(e); }
}

async function verParticipantes(id) {
  const t = datos.torneos.find(x => x.id === id);
  const lista = $("listaParticipantesTorneo");
  $("tituloParticipantesTorneo").innerHTML = `<i class="bi bi-bar-chart-steps me-2"></i>Clasificación de ${esc(t?.nombre)}`;
  lista.innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div></li>';
  mostrarPanel("panelParticipantesTorneo");
  try {
    const ps = (await peticion("GET", `/torneos/${id}/participantes`))
      .sort((a, b) => (b.puntos ?? 0) - (a.puntos ?? 0));   // clasificación: más puntos arriba
    lista.innerHTML = ps.length ? ps.map((p, i) => {
      const j = p.jugador || p;   // por si la API devuelve directamente jugadores
      return `<li class="list-group-item d-flex align-items-center puesto-${i + 1}">
        <span class="puesto">${i + 1}</span>${avatar(j.nick)}
        <span class="fw-semibold">${esc(j.nick)}</span>
        <span class="ms-auto puntos">${p.puntos ?? 0} <small>pts</small></span></li>`;
    }).join("") : `<li class="list-group-item vacio"><i class="bi bi-person-x"></i>Aún no hay nadie inscrito.
        <button class="btn btn-link p-0 d-block mx-auto mt-1" type="button" data-inscribir="${id}">Inscribir un jugador</button></li>`;
  } catch (e) { lista.innerHTML = `<li class="list-group-item text-danger">${esc(e.message)}</li>`; }
}

// Al elegir torneo, marca los jugadores que ya están dentro para no repetir inscripción
async function marcarInscritos() {
  const idTorneo = $("iTorneo").value;
  const opciones = [...$("iJugador").options].filter(o => o.value);
  opciones.forEach(o => { o.disabled = false; o.textContent = o.textContent.replace(" · ya inscrito", ""); });
  $("ayudaInscripcion").textContent = "";
  if (!idTorneo) return;
  try {
    const ps = await peticion("GET", `/torneos/${idTorneo}/participantes`);
    const dentro = new Set(ps.map(p => (p.jugador || p).id));
    opciones.forEach(o => { if (dentro.has(Number(o.value))) { o.disabled = true; o.textContent += " · ya inscrito"; } });
    if (dentro.has(Number($("iJugador").value))) $("iJugador").value = "";
    const libres = opciones.length - dentro.size;
    $("ayudaInscripcion").textContent = libres > 0
      ? `${dentro.size} inscritos. Puedes añadir a ${libres === 1 ? "1 jugador más" : libres + " jugadores más"}.`
      : "Todos los jugadores ya están inscritos en este torneo.";
  } catch { /* si falla, el servidor avisará al inscribir */ }
}

async function prepararInscripcion(idTorneo) {
  await irAPestana("tabTorneos");
  if (![...$("iTorneo").options].some(o => o.value === String(idTorneo))) return;
  $("iTorneo").value = idTorneo;
  await marcarInscritos();
  $("formInscripcion").scrollIntoView({ behavior: "smooth", block: "center" });
  $("iJugador").focus();
}

async function inscribir(ev) {
  ev.preventDefault();
  if (!validar(ev.target)) return;
  const cuerpo = { jugador: { id: Number($("iJugador").value) }, torneo: { id: Number($("iTorneo").value) } };
  try {
    await peticion("POST", "/participaciones", cuerpo);
    const j = datos.jugadores.find(x => x.id === cuerpo.jugador.id);
    const t = datos.torneos.find(x => x.id === cuerpo.torneo.id);
    Swal.fire({ icon: "success", title: "¡Inscrito!", html: `<b>${esc(j?.nick)}</b> juega en <b>${esc(t?.nombre)}</b>`, timer: 2200, showConfirmButton: false });
    $("iJugador").value = "";
    ev.target.classList.remove("was-validated");
    await marcarInscritos();   // el torneo se queda elegido para inscribir a otro seguido
    if (!$("panelParticipantesTorneo").hidden) verParticipantes(cuerpo.torneo.id);
  } catch (e) { error(e); }
}

// =================== JUGADORES ===================
function pintarJugadores() {
  const tbody = $("cuerpoJugadores");
  const q = $("filtroJugadores").value.trim().toLowerCase();
  const lista = ordenar(datos.jugadores.filter(j => !q || j.nick.toLowerCase().includes(q) || j.email.toLowerCase().includes(q)), "jugadores");
  marcarCabecera("jugadores");
  $("contJugadores").textContent = lista.length === 1 ? "1 jugador" : lista.length + " jugadores";
  if (!lista.length) { tbody.innerHTML = filaVacia(5, q ? "Ningún jugador coincide con tu búsqueda." : "Todavía no hay jugadores. Crea el primero con el formulario de abajo."); return; }
  tbody.innerHTML = lista.map(j => `
    <tr data-id="${j.id}">
      <td class="text-secondary">#${j.id}</td>
      <td>${avatar(j.nick)}<span class="fw-semibold">${esc(j.nick)}</span></td>
      <td><a class="link-secondary text-decoration-none" href="mailto:${esc(j.email)}">${esc(j.email)}</a></td>
      <td><div class="nivel"><span>${esc(j.nivel)}</span><div class="progress"><div class="progress-bar" style="width:${Math.min(100, j.nivel)}%"></div></div></div></td>
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-light" data-accion="torneos" title="Torneos" data-bs-toggle="tooltip"><i class="bi bi-trophy"></i></button>
        <button class="btn btn-sm btn-outline-warning" data-accion="editar" title="Editar" data-bs-toggle="tooltip"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" data-accion="eliminar" title="Eliminar" data-bs-toggle="tooltip"><i class="bi bi-trash"></i></button>
      </td>
    </tr>`).join("");
  activarTooltips(tbody);
}

async function cargarJugadores() {
  filasCargando($("cuerpoJugadores"), 5);
  try {
    datos.jugadores = await peticion("GET", "/jugadores");
    pintarJugadores();
    rellenarSelectores();
    actualizarResumen();
  } catch (e) { $("cuerpoJugadores").innerHTML = filaVacia(5, "Error al cargar: " + esc(e.message)); }
}

async function buscarJugador() {
  const id = $("buscarJugadorId").value;
  const res = $("resJugador");
  if (!id) { res.innerHTML = ""; return; }
  try {
    const j = await peticion("GET", `/jugadores/${id}`);
    res.innerHTML = `<div class="resultado animate__animated animate__fadeIn d-flex align-items-center">
      ${avatar(j.nick)}<div><div class="fw-bold">${esc(j.nick)} <span class="text-secondary">#${j.id}</span></div>
      <small class="text-secondary">${esc(j.email)} · nivel ${esc(j.nivel)}</small></div></div>`;
  } catch (e) {
    res.innerHTML = `<div class="alert alert-danger animate__animated animate__shakeX">${esc(e.message)}</div>`;
  }
}

function editarJugador(id) {
  const j = datos.jugadores.find(x => x.id === id);
  if (!j) return;
  editandoJugador = id;
  $("jNick").value = j.nick;
  $("jEmail").value = j.email;
  $("jNivel").value = j.nivel;
  $("tituloFormJugador").innerHTML = `<i class="bi bi-pencil me-2"></i>Editando jugador #${id}`;
  $("btnJugador").innerHTML = '<i class="bi bi-save me-1"></i>Guardar cambios';
  $("btnJugador").className = "btn btn-warning w-100";
  $("btnCancelarJugador").hidden = false;
  $("formJugador").closest(".card").classList.add("modo-edicion");
  $("jNick").focus();
  $("formJugador").scrollIntoView({ behavior: "smooth", block: "center" });
}

function salirEdicionJugador() {
  editandoJugador = null;
  limpiarForm($("formJugador"));
  $("tituloFormJugador").innerHTML = '<i class="bi bi-person-plus me-2"></i>Nuevo jugador';
  $("btnJugador").innerHTML = '<i class="bi bi-check2-circle me-1"></i>Crear jugador';
  $("btnJugador").className = "btn btn-success w-100";
  $("btnCancelarJugador").hidden = true;
  $("formJugador").closest(".card").classList.remove("modo-edicion");
}

async function guardarJugador(ev) {
  ev.preventDefault();
  if (!validar(ev.target)) return;
  const cuerpo = { nick: $("jNick").value.trim(), email: $("jEmail").value.trim(), nivel: Number($("jNivel").value) };
  try {
    const j = editandoJugador
      ? await peticion("PUT", `/jugadores/${editandoJugador}`, cuerpo)
      : await peticion("POST", "/jugadores", cuerpo);
    toast.fire({ icon: "success", title: editandoJugador ? "Jugador actualizado" : "Jugador creado" });
    salirEdicionJugador();
    await cargarJugadores();
    resaltar($("cuerpoJugadores"), j.id);
  } catch (e) { error(e); }
}

async function eliminarJugador(id) {
  const j = datos.jugadores.find(x => x.id === id);
  if (!await confirmar("¿Eliminar jugador?", `Se borrará a «${j?.nick}». Esta acción no se puede deshacer.`)) return;
  try {
    await peticion("DELETE", `/jugadores/${id}`);
    toast.fire({ icon: "success", title: "Jugador eliminado" });
    if (editandoJugador === id) salirEdicionJugador();
    await cargarJugadores();
  } catch (e) { error(e); }
}

async function verTorneosJugador(id) {
  const j = datos.jugadores.find(x => x.id === id);
  const lista = $("listaTorneosJugador");
  $("tituloTorneosJugador").innerHTML = `<i class="bi bi-trophy me-2"></i>Torneos de ${esc(j?.nick)}`;
  lista.innerHTML = '<li class="list-group-item text-center"><div class="spinner-border spinner-border-sm"></div></li>';
  mostrarPanel("panelTorneosJugador");
  try {
    const ps = await peticion("GET", `/jugadores/${id}/participaciones`);
    lista.innerHTML = ps.length ? ps.map(p => {
      const t = datos.torneos.find(x => x.id === (p.torneo || p).id) || p.torneo || p;
      return `<li class="list-group-item d-flex align-items-center gap-2">
        <i class="bi bi-trophy text-warning"></i><span class="fw-semibold">${esc(t.nombre)}</span>
        <span class="ms-auto">${insigniaEstado(t.estado)}</span>
        <span class="badge text-bg-dark">${p.puntos ?? 0} pts</span></li>`;
    }).join("") : '<li class="list-group-item vacio"><i class="bi bi-calendar-x"></i>No está inscrito en ningún torneo</li>';
  } catch (e) { lista.innerHTML = `<li class="list-group-item text-danger">${esc(e.message)}</li>`; }
}

// =================== VIDEOJUEGOS ===================
function pintarJuegos() {
  const tbody = $("cuerpoJuegos");
  const n = datos.videojuegos.length;
  $("contJuegos").textContent = n === 1 ? "1 videojuego" : n + " videojuegos";
  if (!n) { tbody.innerHTML = filaVacia(4, "Todavía no hay videojuegos. Añade el primero con el formulario."); return; }
  tbody.innerHTML = datos.videojuegos.map(v => {
    const torneos = datos.torneos.filter(t => t.videojuego?.id === v.id).length;
    return `
    <tr data-id="${v.id}">
      <td class="text-secondary">#${v.id}</td>
      <td class="fw-semibold"><i class="bi bi-joystick text-secondary me-2"></i>${esc(v.nombre)}</td>
      <td><span class="genero">${esc(v.genero)}</span></td>
      <td class="text-end">${torneos
        ? `<button class="btn btn-link enlace-torneos" type="button" data-ver-torneos="${v.id}">${torneos === 1 ? "1 torneo" : torneos + " torneos"}</button>`
        : '<span class="text-secondary">Sin torneos</span>'}</td>
    </tr>`;
  }).join("");
}

async function cargarJuegos() {
  filasCargando($("cuerpoJuegos"), 4);
  try {
    datos.videojuegos = await peticion("GET", "/videojuegos");
    pintarJuegos();
    rellenarSelectores();
    actualizarResumen();
  } catch (e) { $("cuerpoJuegos").innerHTML = filaVacia(4, "Error al cargar: " + esc(e.message)); }
}

async function buscarJuego() {
  const id = $("buscarJuegoId").value;
  const res = $("resJuego");
  if (!id) { res.innerHTML = ""; return; }
  try {
    const v = await peticion("GET", `/videojuegos/${id}`);
    res.innerHTML = `<div class="resultado animate__animated animate__fadeIn d-flex align-items-center gap-3">
      <i class="bi bi-joystick fs-3"></i><div><div class="fw-bold">${esc(v.nombre)} <span class="text-secondary">#${v.id}</span></div>
      <small class="text-secondary">${esc(v.genero)}</small></div></div>`;
  } catch (e) {
    res.innerHTML = `<div class="alert alert-danger animate__animated animate__shakeX">${esc(e.message)}</div>`;
  }
}

async function guardarJuego(ev) {
  ev.preventDefault();
  if (!validar(ev.target)) return;
  try {
    const v = await peticion("POST", "/videojuegos", { nombre: $("gNombre").value.trim(), genero: $("gGenero").value.trim() });
    toast.fire({ icon: "success", title: "Videojuego creado" });
    limpiarForm(ev.target);
    await cargarJuegos();
    resaltar($("cuerpoJuegos"), v.id);
  } catch (e) { error(e); }
}

// ---------- Tooltips ----------
function activarTooltips(raiz) {
  raiz.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => bootstrap.Tooltip.getOrCreateInstance(el));
}
function cerrarTooltips() {
  document.querySelectorAll(".tooltip").forEach(t => t.remove());
}

// ---------- Eventos ----------
function idFila(boton) { return Number(boton.closest("tr").dataset.id); }

$("cuerpoTorneos").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-accion]");
  if (!b) return;
  cerrarTooltips();
  const id = idFila(b);
  if (b.dataset.accion === "participantes") verParticipantes(id);
  if (b.dataset.accion === "editar") editarTorneo(id);
  if (b.dataset.accion === "eliminar") eliminarTorneo(id);
});

$("cuerpoJugadores").addEventListener("click", ev => {
  const b = ev.target.closest("button[data-accion]");
  if (!b) return;
  cerrarTooltips();
  const id = idFila(b);
  if (b.dataset.accion === "torneos") verTorneosJugador(id);
  if (b.dataset.accion === "editar") editarJugador(id);
  if (b.dataset.accion === "eliminar") eliminarJugador(id);
});

$("formTorneo").addEventListener("submit", guardarTorneo);
$("formJugador").addEventListener("submit", guardarJugador);
$("formJuego").addEventListener("submit", guardarJuego);
$("formInscripcion").addEventListener("submit", inscribir);
$("btnCancelarTorneo").addEventListener("click", salirEdicionTorneo);
$("btnCancelarJugador").addEventListener("click", salirEdicionJugador);

$("filtroEstado").addEventListener("change", aplicarFiltroTorneos);
$("filtroVideojuego").addEventListener("change", aplicarFiltroTorneos);
$("btnLimpiarFiltro").addEventListener("click", () => { $("filtroEstado").value = ""; $("filtroVideojuego").value = ""; aplicarFiltroTorneos(); });
$("filtroJugadores").addEventListener("input", pintarJugadores);
$("filtroTextoTorneos").addEventListener("input", () => pintarTorneos());
$("iTorneo").addEventListener("change", marcarInscritos);

// Clic en una cabecera ordenable: ordena por esa columna; otro clic invierte el sentido
document.querySelectorAll("th.ordenable").forEach(th => {
  th.tabIndex = 0;
  const accion = () => {
    const tabla = th.closest("tr").dataset.tabla;
    const o = orden[tabla];
    o.asc = o.campo === th.dataset.orden ? !o.asc : true;
    o.campo = th.dataset.orden;
    tabla === "torneos" ? pintarTorneos() : pintarJugadores();
  };
  th.addEventListener("click", accion);
  th.addEventListener("keydown", ev => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); accion(); } });
});

// Botones del torneo destacado
$("btnDestInscribir").addEventListener("click", () => destacadoId && prepararInscripcion(destacadoId));
$("btnDestInscritos").addEventListener("click", async () => {
  if (!destacadoId) return;
  await irAPestana("tabTorneos");
  await verParticipantes(destacadoId);
  $("panelParticipantesTorneo").scrollIntoView({ behavior: "smooth", block: "center" });
});

// Enlace «Inscribir un jugador» dentro de una clasificación vacía
$("listaParticipantesTorneo").addEventListener("click", ev => {
  const b = ev.target.closest("[data-inscribir]");
  if (b) prepararInscripcion(Number(b.dataset.inscribir));
});

// En Videojuegos, «N torneos» lleva a Torneos ya filtrado por ese juego
$("cuerpoJuegos").addEventListener("click", async ev => {
  const b = ev.target.closest("[data-ver-torneos]");
  if (!b) return;
  $("filtroEstado").value = "";
  $("filtroVideojuego").value = b.dataset.verTorneos;
  await irAPestana("tabTorneos");
  aplicarFiltroTorneos();
});

$("btnBuscarTorneo").addEventListener("click", buscarTorneo);
$("btnBuscarJugador").addEventListener("click", buscarJugador);
$("btnBuscarJuego").addEventListener("click", buscarJuego);
[["buscarTorneoId", buscarTorneo], ["buscarJugadorId", buscarJugador], ["buscarJuegoId", buscarJuego]].forEach(([id, fn]) =>
  $(id).addEventListener("keydown", ev => { if (ev.key === "Enter") fn(); }));

document.querySelectorAll("[data-cerrar]").forEach(b => b.addEventListener("click", () => { $(b.dataset.cerrar).hidden = true; }));

// Al abrir una pestaña, su lista se carga sola (sin botón «Ver») y entra con animación
document.querySelectorAll('button[data-bs-toggle="tab"]').forEach(tab => {
  tab.addEventListener("shown.bs.tab", ev => {
    const panel = document.querySelector(ev.target.dataset.bsTarget);
    panel.classList.remove("animate__animated", "animate__fadeIn");
    void panel.offsetWidth;
    panel.classList.add("animate__animated", "animate__fadeIn");
    guardarPestana(ev.target.id);
    if (ev.target.id === "tabTorneos") cargarTorneos();
    if (ev.target.id === "tabJugadores") cargarJugadores();
    if (ev.target.id === "tabVideojuegos") cargarJuegos();
  });
});

// Portada: enlaces del menú, cartelera y botón de crear
document.querySelectorAll("[data-ir-pestana]").forEach(a => a.addEventListener("click", async ev => {
  ev.preventDefault();
  $("panel").scrollIntoView({ behavior: "smooth" });
  await irAPestana(a.dataset.irPestana);
}));

$("cartelera").addEventListener("click", async ev => {
  const b = ev.target.closest("[data-torneo]");
  if (!b) return;
  await irAPestana("tabTorneos");
  await verParticipantes(Number(b.dataset.torneo));
  $("panelParticipantesTorneo").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("btnPortadaCrear").addEventListener("click", async () => {
  await irAPestana("tabTorneos");
  $("formTorneo").scrollIntoView({ behavior: "smooth", block: "center" });
  $("tNombre").focus({ preventScroll: true });
});

// Portada: la flecha y el botón bajan con suavidad hasta el panel
document.querySelectorAll("[data-bajar]").forEach(a => a.addEventListener("click", ev => {
  ev.preventDefault();
  $("panel").scrollIntoView({ behavior: "smooth" });
}));

// ---------- Inicio ----------
(async function iniciar() {
  await comprobarConexion();
  await Promise.all([cargarJuegos(), cargarJugadores()]);
  await cargarTorneos();
  // Vuelve a la pestaña que tenías abierta la última vez
  const ultima = leerPestana();
  if (ultima && ultima !== "tabTorneos" && $(ultima)) irAPestana(ultima);
})();
