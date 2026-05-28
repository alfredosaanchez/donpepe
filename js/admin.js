import { obtenerPedidos, obtenerPedidosPorRango, guardarPagoMovil, obtenerPagoMovil, eliminarPedido, guardarProductos, obtenerProductos } from "./firebase.js";
import { obtenerTasaBCV, formatBs, convertirABolivares } from "./bcv.js";
import { MENU_DEFAULT } from "./data.js";

const PIN = "1234";
let pedidoABorrar = null;
let tasaAdmin = null;
let productos = [...MENU_DEFAULT];

const EMOJIS = ["🍔","🌮","🌯","🥙","🍕","🥪","🍟","🌭","🥗","🍗","🥩","🫔","🍖","🥚","🧀","🥓","🫕","🍜","🍝","🥘","🫙","🧆","🥙","🍱"];

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btn-pin").addEventListener("click", checkPin);
  document.getElementById("pin-input").addEventListener("keydown", e => { if (e.key === "Enter") checkPin(); });

  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  const hoy = new Date(); const hace7 = new Date(); hace7.setDate(hoy.getDate() - 7);
  document.getElementById("fecha-desde").value = hace7.toISOString().split("T")[0];
  document.getElementById("fecha-hasta").value = hoy.toISOString().split("T")[0];

  document.getElementById("btn-filtrar").addEventListener("click", filtrarPorFecha);
  document.getElementById("btn-guardar-pago").addEventListener("click", guardarPago);
  document.getElementById("btn-cancelar-borrar").addEventListener("click", cerrarModalBorrar);
  document.getElementById("modal-borrar").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-borrar")) cerrarModalBorrar();
  });
  document.getElementById("btn-confirmar-borrar").addEventListener("click", ejecutarBorrar);
  document.getElementById("borrar-pin-input").addEventListener("keydown", e => { if (e.key === "Enter") ejecutarBorrar(); });
  document.getElementById("btn-agregar-producto").addEventListener("click", agregarProducto);
});

// ── Login ─────────────────────────────────────────────────────
function checkPin() {
  const val = document.getElementById("pin-input").value;
  if (val === PIN) {
    document.getElementById("login-box").style.display = "none";
    document.getElementById("dashboard").style.display = "block";
    cargarDatos();
    cargarPagoMovil();
    cargarProductos();
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
  }
}

// ── Datos / historial ─────────────────────────────────────────
async function cargarDatos() {
  showLoading(true);
  const result = await obtenerTasaBCV();
  if (result) tasaAdmin = result.tasa;
  const pedidos = await obtenerPedidos();
  showLoading(false);
  renderResumen(pedidos);
  renderHistorial(pedidos);
}

async function filtrarPorFecha() {
  const desde = new Date(document.getElementById("fecha-desde").value + "T00:00:00");
  const hasta = new Date(document.getElementById("fecha-hasta").value + "T23:59:59");
  if (isNaN(desde) || isNaN(hasta)) return;
  showLoading(true);
  const pedidos = await obtenerPedidosPorRango(desde, hasta);
  showLoading(false);
  renderResumen(pedidos);
  renderHistorial(pedidos);
}

function showLoading(on) {
  document.getElementById("loading-indicator").style.display = on ? "block" : "none";
}

// ── Resumen ───────────────────────────────────────────────────
function renderResumen(pedidos) {
  const totalUSD      = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const totalUnidades = pedidos.reduce((s, p) => s + (p.items||[]).reduce((a,i) => a+i.qty, 0), 0);

  const ventas = {};
  productos.forEach(m => ventas[m.id] = { qty: 0, revenue: 0, name: m.name, emoji: m.emoji });
  pedidos.forEach(p => (p.items||[]).forEach(i => {
    if (!ventas[i.id]) ventas[i.id] = { qty: 0, revenue: 0, name: i.name, emoji: "🍔" };
    ventas[i.id].qty += i.qty;
    ventas[i.id].revenue += i.qty * i.price;
  }));

  const sorted  = Object.values(ventas).sort((a,b) => b.qty - a.qty);
  const topItem = sorted[0]?.qty > 0 ? sorted[0] : null;

  document.getElementById("stat-pedidos").textContent  = pedidos.length;
  const bsTotal = tasaAdmin ? ` / ${formatBs(convertirABolivares(totalUSD))}` : "";
  document.getElementById("stat-total").textContent    = `$${totalUSD.toFixed(2)}${bsTotal}`;
  document.getElementById("stat-unidades").textContent = totalUnidades;
  document.getElementById("stat-top").textContent      = topItem ? `${topItem.emoji} ${topItem.name.split(" ")[0]}` : "—";

  const maxQty = sorted[0]?.qty || 1;
  document.getElementById("ranking").innerHTML = sorted.map(item => {
    const pct = Math.round((item.qty / maxQty) * 100);
    return `
    <div class="rank-item">
      <div class="rank-emoji">${item.emoji}</div>
      <div class="rank-info">
        <div class="rank-name">${item.name}</div>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="rank-right">
        <div class="rank-count">${item.qty} uds.</div>
        <div class="rank-revenue">$${item.revenue.toFixed(2)}</div>
      </div>
    </div>`;
  }).join("");
}

// ── Historial ─────────────────────────────────────────────────
function renderHistorial(pedidos) {
  const histEl = document.getElementById("historial");
  if (!pedidos.length) { histEl.innerHTML = `<div class="empty-state"><i class="ti ti-receipt-off"></i> No hay pedidos en este período</div>`; return; }

  const porDia = {};
  pedidos.forEach(p => {
    const fecha = p.fecha?.toDate ? p.fecha.toDate() : new Date(p.fecha);
    const key   = fecha.toLocaleDateString("es-VE", { year:"numeric", month:"2-digit", day:"2-digit" });
    if (!porDia[key]) porDia[key] = { fecha, pedidos: [], total: 0 };
    porDia[key].pedidos.push({ ...p, fechaDate: fecha });
    porDia[key].total += p.total || 0;
  });

  histEl.innerHTML = Object.entries(porDia).map(([key, dia], idx) => {
    const label = dia.fecha.toLocaleDateString("es-VE", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
    return `
    <div class="day-block">
      <div class="day-header" id="header-dia-${idx}">
        <div><div class="day-date">${label}</div><div class="day-summary">${dia.pedidos.length} pedido${dia.pedidos.length!==1?"s":""}</div></div>
        <div style="font-weight:700;color:#1a7a1a;">$${dia.total.toFixed(2)}</div>
      </div>
      <div class="day-orders" id="dia-${idx}">
        ${dia.pedidos.map(p => {
          const hora  = p.fechaDate.toLocaleTimeString("es-VE", { hour:"2-digit", minute:"2-digit" });
          const items = (p.items||[]).map(i => `${i.qty}× ${i.name}`).join(", ");
          return `
          <div class="order-row" id="order-${p.id}">
            <div style="flex:1;min-width:0;">
              <div class="order-client"><i class="ti ti-user" style="font-size:12px;"></i> ${p.cliente||"Cliente"}</div>
              <div class="order-items">${items}${p.nota?` · 📝 ${p.nota}`:""}</div>
            </div>
            <div style="text-align:right;flex-shrink:0;">
              <div class="order-total">$${(p.total||0).toFixed(2)}</div>
              <div class="order-time">${hora}</div>
              <button class="btn-borrar-pedido" data-id="${p.id}"><i class="ti ti-trash"></i></button>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");

  document.querySelectorAll("[id^='header-dia-']").forEach(header => {
    const idx = header.id.replace("header-dia-", "");
    header.addEventListener("click", () => document.getElementById(`dia-${idx}`).classList.toggle("open"));
  });
  document.querySelectorAll(".btn-borrar-pedido").forEach(btn => {
    btn.addEventListener("click", () => abrirModalBorrar(btn.dataset.id));
  });
}

// ── Borrar pedido ─────────────────────────────────────────────
function abrirModalBorrar(id) {
  pedidoABorrar = id;
  document.getElementById("borrar-pin-input").value = "";
  document.getElementById("borrar-pin-error").style.display = "none";
  document.getElementById("modal-borrar").classList.add("visible");
}
function cerrarModalBorrar() {
  pedidoABorrar = null;
  document.getElementById("modal-borrar").classList.remove("visible");
}
async function ejecutarBorrar() {
  const val = document.getElementById("borrar-pin-input").value;
  if (val !== PIN) { document.getElementById("borrar-pin-error").style.display = "block"; document.getElementById("borrar-pin-input").value = ""; return; }
  const ok = await eliminarPedido(pedidoABorrar);
  if (ok) { cerrarModalBorrar(); showToast("Pedido eliminado"); cargarDatos(); }
  else { showToast("Error al eliminar"); }
}

// ── Pago Móvil ────────────────────────────────────────────────
async function cargarPagoMovil() {
  const datos = await obtenerPagoMovil();
  if (!datos) return;
  document.getElementById("pm-banco").value    = datos.banco    || "";
  document.getElementById("pm-telefono").value = datos.telefono || "";
  document.getElementById("pm-cedula").value   = datos.cedula   || "";
  document.getElementById("pm-nombre").value   = datos.nombre   || "";
  mostrarPreviewPago(datos);
}
async function guardarPago() {
  const datos = { banco: document.getElementById("pm-banco").value.trim(), telefono: document.getElementById("pm-telefono").value.trim(), cedula: document.getElementById("pm-cedula").value.trim(), nombre: document.getElementById("pm-nombre").value.trim() };
  if (!datos.banco || !datos.telefono || !datos.cedula || !datos.nombre) { showToast("Completa todos los campos"); return; }
  const ok = await guardarPagoMovil(datos);
  if (ok) { document.getElementById("pago-guardado").style.display = "block"; setTimeout(() => document.getElementById("pago-guardado").style.display = "none", 3000); mostrarPreviewPago(datos); }
}
function mostrarPreviewPago(datos) {
  document.getElementById("pago-preview").style.display = "block";
  document.getElementById("pago-preview-content").innerHTML = `
    <div class="preview-pago-box">
      <div class="preview-row"><span>Banco</span><strong>${datos.banco}</strong></div>
      <div class="preview-row"><span>Teléfono</span><strong>${datos.telefono}</strong></div>
      <div class="preview-row"><span>Cédula</span><strong>${datos.cedula}</strong></div>
      <div class="preview-row"><span>Nombre</span><strong>${datos.nombre}</strong></div>
    </div>`;
}

// ── Gestión de productos ──────────────────────────────────────
async function cargarProductos() {
  const db = await obtenerProductos();
  if (db && db.length > 0) productos = db;
  renderProductos();
}

function renderProductos() {
  const lista = document.getElementById("productos-lista");
  lista.innerHTML = productos.map((p, idx) => `
    <div class="producto-row" id="prod-row-${idx}">
      <div class="prod-emoji-wrap">
        <select class="prod-emoji-select" data-idx="${idx}">
          ${EMOJIS.map(e => `<option value="${e}" ${e === p.emoji ? "selected" : ""}>${e}</option>`).join("")}
        </select>
      </div>
      <div class="prod-fields">
        <input class="prod-input" type="text" placeholder="Nombre" value="${p.name}" data-idx="${idx}" data-field="name" />
        <input class="prod-input prod-desc" type="text" placeholder="Descripción" value="${p.desc}" data-idx="${idx}" data-field="desc" />
      </div>
      <div class="prod-price-wrap">
        <span class="prod-price-symbol">$</span>
        <input class="prod-input prod-price" type="number" min="0" step="0.5" placeholder="0.00" value="${p.price}" data-idx="${idx}" data-field="price" />
      </div>
      <button class="btn-eliminar-prod" data-idx="${idx}" title="Eliminar"><i class="ti ti-trash"></i></button>
    </div>`).join("");

  // Eventos
  lista.querySelectorAll(".prod-emoji-select").forEach(sel => {
    sel.addEventListener("change", e => { productos[e.target.dataset.idx].emoji = e.target.value; });
  });
  lista.querySelectorAll(".prod-input").forEach(inp => {
    inp.addEventListener("input", e => {
      const idx = e.target.dataset.idx; const field = e.target.dataset.field;
      productos[idx][field] = field === "price" ? parseFloat(e.target.value) || 0 : e.target.value;
    });
  });
  lista.querySelectorAll(".btn-eliminar-prod").forEach(btn => {
    btn.addEventListener("click", e => {
      const idx = parseInt(btn.dataset.idx);
      productos.splice(idx, 1);
      renderProductos();
    });
  });
}

function agregarProducto() {
  const nuevoId = Date.now();
  productos.push({ id: nuevoId, emoji: "🍔", name: "", desc: "", price: 0 });
  renderProductos();
  // Scroll al nuevo producto
  setTimeout(() => {
    const lista = document.getElementById("productos-lista");
    lista.lastElementChild?.scrollIntoView({ behavior: "smooth" });
  }, 100);
}

async function guardarProductosAdmin() {
  const invalidos = productos.filter(p => !p.name.trim());
  if (invalidos.length) { showToast("Todos los productos deben tener nombre"); return; }
  const ok = await guardarProductos(productos);
  if (ok) { showToast("✅ Productos guardados"); }
  else { showToast("Error al guardar productos"); }
}
// Exponer para el botón del HTML
window.guardarProductosAdmin = guardarProductosAdmin;

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
