import { obtenerPedidos, obtenerPedidosPorRango } from "./firebase.js";
import { MENU } from "./menu.js";

// ── PIN ───────────────────────────────────────────────────────
const PIN = "1234"; // ← Cámbialo aquí

// ── Init ──────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  // Enter en el PIN
  document.getElementById("pin-input").addEventListener("keydown", e => {
    if (e.key === "Enter") checkPin();
  });

  // Tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById(tab.dataset.tab).classList.add("active");
    });
  });

  // Filtro de fechas por defecto: últimos 7 días
  const hoy    = new Date();
  const hace7  = new Date(); hace7.setDate(hoy.getDate() - 7);
  document.getElementById("fecha-desde").value = hace7.toISOString().split("T")[0];
  document.getElementById("fecha-hasta").value = hoy.toISOString().split("T")[0];
});

// ── Login ─────────────────────────────────────────────────────
window.checkPin = function() {
  const val = document.getElementById("pin-input").value;
  if (val === PIN) {
    document.getElementById("login-box").style.display   = "none";
    document.getElementById("dashboard").style.display   = "block";
    cargarDatos();
  } else {
    document.getElementById("pin-error").style.display = "block";
    document.getElementById("pin-input").value = "";
  }
};

// ── Cargar datos ──────────────────────────────────────────────
async function cargarDatos() {
  showLoading(true);
  const pedidos = await obtenerPedidos();
  showLoading(false);
  renderResumen(pedidos);
  renderHistorial(pedidos);
}

window.filtrarPorFecha = async function() {
  const desde = new Date(document.getElementById("fecha-desde").value + "T00:00:00");
  const hasta = new Date(document.getElementById("fecha-hasta").value + "T23:59:59");
  if (isNaN(desde) || isNaN(hasta)) return;
  showLoading(true);
  const pedidos = await obtenerPedidosPorRango(desde, hasta);
  showLoading(false);
  renderResumen(pedidos);
  renderHistorial(pedidos);
};

function showLoading(on) {
  document.getElementById("loading-indicator").style.display = on ? "block" : "none";
}

// ── Resumen / estadísticas ────────────────────────────────────
function renderResumen(pedidos) {
  const totalPedidos  = pedidos.length;
  const totalUSD      = pedidos.reduce((s, p) => s + (p.total || 0), 0);
  const totalUnidades = pedidos.reduce((s, p) =>
    s + (p.items || []).reduce((a, i) => a + i.qty, 0), 0);

  // Conteo por producto
  const ventas = {};
  MENU.forEach(m => ventas[m.id] = { qty: 0, revenue: 0 });
  pedidos.forEach(p => {
    (p.items || []).forEach(i => {
      if (ventas[i.id] !== undefined) {
        ventas[i.id].qty     += i.qty;
        ventas[i.id].revenue += i.qty * i.price;
      }
    });
  });

  const sorted  = [...MENU].sort((a, b) => ventas[b.id].qty - ventas[a.id].qty);
  const topItem = ventas[sorted[0].id].qty > 0 ? sorted[0] : null;

  document.getElementById("stat-pedidos").textContent  = totalPedidos;
  document.getElementById("stat-total").textContent    = `$${totalUSD.toFixed(2)}`;
  document.getElementById("stat-unidades").textContent = totalUnidades;
  document.getElementById("stat-top").textContent      = topItem ? `${topItem.emoji} ${topItem.name.split(" ")[0]}` : "—";

  // Ranking
  const maxQty = sorted[0] ? ventas[sorted[0].id].qty : 1;
  document.getElementById("ranking").innerHTML = sorted.map(item => {
    const v   = ventas[item.id];
    const pct = maxQty > 0 ? Math.round((v.qty / maxQty) * 100) : 0;
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

// ── Historial por día ─────────────────────────────────────────
function renderHistorial(pedidos) {
  const histEl = document.getElementById("historial");

  if (!pedidos.length) {
    histEl.innerHTML = `
      <div class="empty-state">
        <i class="ti ti-receipt-off"></i>
        No hay pedidos en este período
      </div>`;
    return;
  }

  // Agrupar por día
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
      <div class="day-header" onclick="toggleDia('dia-${idx}')">
        <div>
          <div class="day-date">${label}</div>
          <div class="day-summary">${dia.pedidos.length} pedido${dia.pedidos.length !== 1 ? "s" : ""}</div>
        </div>
        <div style="font-weight:700; color:#1a7a1a;">$${dia.total.toFixed(2)}</div>
      </div>
      <div class="day-orders" id="dia-${idx}">
        ${dia.pedidos.map(p => {
          const hora  = p.fechaDate.toLocaleTimeString("es-VE", { hour:"2-digit", minute:"2-digit" });
          const items = (p.items || []).map(i => `${i.qty}× ${i.name}`).join(", ");
          return `
          <div class="order-row">
            <div>
              <div class="order-client"><i class="ti ti-user" style="font-size:12px;"></i> ${p.cliente || "Cliente"}</div>
              <div class="order-items">${items}${p.nota ? ` · 📝 ${p.nota}` : ""}</div>
            </div>
            <div style="text-align:right; flex-shrink:0;">
              <div class="order-total">$${(p.total || 0).toFixed(2)}</div>
              <div class="order-time">${hora}</div>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>`;
  }).join("");
}

window.toggleDia = function(id) {
  const el = document.getElementById(id);
  el.classList.toggle("open");
};

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}
