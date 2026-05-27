import { obtenerPedidos, obtenerPedidosPorRango, guardarPagoMovil, obtenerPagoMovil, eliminarPedido } from "./firebase.js";
import { MENU } from "./menu.js";

const PIN = "1234";
let pedidoABorrar = null;

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // PIN login
  document.getElementById("btn-pin").addEventListener("click", checkPin);
  document.getElementById("pin-input").addEventListener("keydown", e => { if (e.key === "Enter") checkPin(); });

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // Fechas por defecto
  const hoy   = new Date();
  const hace7 = new Date(); hace7.setDate(hoy.getDate() - 7);
  document.getElementById("fecha-desde").value = hace7.toISOString().split("T")[0];
  document.getElementById("fecha-hasta").value = hoy.toISOString().split("T")[0];

  // Filtrar
  document.getElementById("btn-filtrar").addEventListener("click", filtrarPorFecha);

  // Guardar pago
  document.getElementById("btn-guardar-pago").addEventListener("click", guardarPago);

  // Modal borrar
  document.getElementById("btn-cancelar-borrar").addEventListener("click", cerrarModalBorrar);
  document.getElementById("modal-borrar").addEventListener("click", e => {
    if (e.target === document.getElementById("modal-borrar")) cerrarModalBorrar();
  });
  document.getElementById("btn-confirmar-borrar").addEventListener("click", ejecutarBorrar);
  document.getElementById("borrar-pin-input").addEventListener("keydown", e => { if (e.key === "Enter") ejecutarBorrar(); });
});

// ── Login ─────────────────────────────────────────────────────
function checkPin() {
  const val = document.getElementById("pin-input").value;
  if (val === PIN) {
    document.getElementById("login-box").style.display  = "none";
    document.getElementById("dashboard").style.display  = "block";
    cargarDatos();
    cargarPagoMovil();
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
  }
}

// ── Cargar datos ──────────────────────────────────────────────
async function cargarDatos() {
  showLoading(true);
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
  MENU.forEach(m => ventas[m.id] = { qty: 0, revenue: 0 });
  pedidos.forEach(p => (p.items||[]).forEach(i => {
    if (ventas[i.id]) { ventas[i.id].qty += i.qty; ventas[i.id].revenue += i.qty * i.price; }
  }));

  const sorted  = [...MENU].sort((a,b) => ventas[b.id].qty - ventas[a.id].qty);
  const topItem = ventas[sorted[0].id].qty > 0 ? sorted[0] : null;

  document.getElementById("stat-pedidos").textContent  = pedidos.length;
  document.getElementById("stat-total").textContent    = `$${totalUSD.toFixed(2)}`;
  document.getElementById("stat-unidades").textContent = totalUnidades;
  document.getElementById("stat-top").textContent      = topItem ? `${topItem.emoji} ${topItem.name.split(" ")[0]}` : "—";

  const maxQty = ventas[sorted[0].id].qty || 1;
  document.getElementById("ranking").innerHTML = sorted.map(item => {
    const v   = ventas[item.id];
    const pct = Math.round((v.qty / maxQty) * 100);
    return `
    <div class="rank-item">
      <div class="rank-emoji">${item.emoji}</div>
      <div class="rank-info">
        <div class="rank-name">${item.name}</div>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${pct}%"></div></div>
      </div>
      <div class="rank-right">
        <div class="rank-count">${v.qty} uds.</div>
        <div class="rank-revenue">$${v.revenue.toFixed(2)}</div>
      </div>
    </div>`;
  }).join("");
}

// ── Historial ─────────────────────────────────────────────────
function renderHistorial(pedidos) {
  const histEl = document.getElementById("historial");
  if (!pedidos.length) {
    histEl.innerHTML = `<div class="empty-state"><i class="ti ti-receipt-off"></i> No hay pedidos en este período</div>`;
    return;
  }

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
        <div>
          <div class="day-date">${label}</div>
          <div class="day-summary">${dia.pedidos.length} pedido${dia.pedidos.length!==1?"s":""}</div>
        </div>
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

  // Eventos: toggle días
  document.querySelectorAll("[id^='header-dia-']").forEach(header => {
    const idx = header.id.replace("header-dia-", "");
    header.addEventListener("click", () => document.getElementById(`dia-${idx}`).classList.toggle("open"));
  });

  // Eventos: botones borrar
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
  if (val !== PIN) {
    document.getElementById("borrar-pin-error").style.display = "block";
    document.getElementById("borrar-pin-input").value = "";
    return;
  }
  const ok = await eliminarPedido(pedidoABorrar);
  if (ok) {
    cerrarModalBorrar();
    const el = document.getElementById(`order-${pedidoABorrar}`);
    if (el) { el.style.opacity = "0"; el.style.transition = "opacity 0.3s"; setTimeout(() => el.remove(), 300); }
    showToast("Pedido eliminado");
cargarDatos();
  } else {
    showToast("Error al eliminar el pedido");
  }
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
  const datos = {
    banco:    document.getElementById("pm-banco").value.trim(),
    telefono: document.getElementById("pm-telefono").value.trim(),
    cedula:   document.getElementById("pm-cedula").value.trim(),
    nombre:   document.getElementById("pm-nombre").value.trim(),
  };
  if (!datos.banco || !datos.telefono || !datos.cedula || !datos.nombre) {
    showToast("Por favor completa todos los campos"); return;
  }
  const ok = await guardarPagoMovil(datos);
  if (ok) {
    document.getElementById("pago-guardado").style.display = "block";
    setTimeout(() => document.getElementById("pago-guardado").style.display = "none", 3000);
    mostrarPreviewPago(datos);
  }
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

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
