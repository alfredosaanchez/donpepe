import { guardarPedido, obtenerPagoMovil } from "./firebase.js";
import { obtenerTasaBCV, getTasaActual, convertirABolivares, formatBs } from "./bcv.js";

export const WHATSAPP = "584140000000";

export const MENU = [
  { id:1, emoji:"🍔", name:"Clásica Don Pepe",  desc:"Carne, queso, lechuga, tomate, mayonesa",        price:5    },
  { id:2, emoji:"🔥", name:"Burger Especial",    desc:"Doble carne, bacon, queso doble, salsa especial", price:8    },
  { id:3, emoji:"🌶️", name:"Picante Loca",       desc:"Carne, jalapeños, queso, salsa picante",          price:6    },
  { id:4, emoji:"🧀", name:"Cheese Lover",       desc:"Triple queso, carne, mostaza, pepinillos",        price:7    },
  { id:5, emoji:"🥓", name:"Bacon Crispy",       desc:"Bacon extra, carne, queso, cebolla caramelizada", price:7.50 },
];

const qty = {};
MENU.forEach(i => qty[i.id] = 0);
let pagoMovilConfig = null;

document.addEventListener("DOMContentLoaded", async () => {
  render();
  cargarBCV();
  pagoMovilConfig = await obtenerPagoMovil();
});

async function cargarBCV() {
  const result = await obtenerTasaBCV();
  if (result) {
    document.getElementById("bcv-rate").textContent   = `1 USD = Bs. ${result.tasa.toLocaleString("es-VE", { minimumFractionDigits: 2 })}`;
    document.getElementById("bcv-source").textContent = `${result.fuente} · Actualizado hoy`;
    document.getElementById("bcv-content").style.display = "flex";
    document.getElementById("bcv-loading").style.display = "none";
    updateSummary();
  } else {
    document.getElementById("bcv-loading").textContent = "Tasa BCV no disponible";
  }
}

function render() {
  document.getElementById("menu").innerHTML = MENU.map(item => {
    const sel = qty[item.id] > 0;
    return `
    <div class="item-card ${sel ? "selected" : ""}">
      <div class="item-emoji">${item.emoji}</div>
      <div class="item-info">
        <div class="item-name-row">
          <div class="item-name ${sel ? "sel" : ""}">${item.name}</div>
          <div class="item-price ${sel ? "sel" : ""}">$${item.price.toFixed(2)}</div>
        </div>
        <div class="item-desc">${item.desc}</div>
        <div class="item-bottom">
          ${sel
            ? `<div class="qty-ctrl">
                 <button class="qty-btn" onclick="window.change(${item.id},-1)">−</button>
                 <span class="qty-num">${qty[item.id]}</span>
                 <button class="qty-btn" onclick="window.change(${item.id},1)">+</button>
               </div>
               <div class="item-check"><i class="ti ti-check"></i></div>`
            : `<button class="add-btn" onclick="window.change(${item.id},1)">+ Agregar</button>`
          }
        </div>
      </div>
    </div>`;
  }).join("");
  updateSummary();
}

window.change = function(id, delta) {
  qty[id] = Math.max(0, qty[id] + delta);
  render();
};

function updateSummary() {
  const items = MENU.filter(i => qty[i.id] > 0);
  const total = items.reduce((s, i) => s + i.price * qty[i.id], 0);
  const sumEl = document.getElementById("summary");
  const btn   = document.getElementById("btn-pedir");

  if (!items.length) { sumEl.style.display = "none"; btn.disabled = true; return; }
  sumEl.style.display = "block";
  btn.disabled = false;

  document.getElementById("summary-items").innerHTML = items.map(i =>
    `<div class="summary-row"><span>${i.name} ×${qty[i.id]}</span><span>$${(i.price*qty[i.id]).toFixed(2)}</span></div>`
  ).join("");
  document.getElementById("total-usd").textContent = `$${total.toFixed(2)}`;

  const tasa = getTasaActual();
  const bsEl = document.getElementById("total-bs-row");
  if (tasa) {
    document.getElementById("total-bs").textContent = formatBs(convertirABolivares(total));
    bsEl.style.display = "flex";
  } else {
    bsEl.style.display = "none";
  }
}

window.copiarDato = function(texto, btn) {
  navigator.clipboard.writeText(texto).then(() => {
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="ti ti-check"></i>';
    btn.classList.add("copiado");
    setTimeout(() => { btn.innerHTML = original; btn.classList.remove("copiado"); }, 1500);
  });
};

window.mostrarPago = function() {
  const nombre = document.getElementById("nombre").value.trim();
  const inpEl  = document.getElementById("nombre");
  const errEl  = document.getElementById("nombre-error");
  if (!nombre) { inpEl.classList.add("error"); errEl.style.display = "block"; inpEl.focus(); return; }
  inpEl.classList.remove("error"); errEl.style.display = "none";

  const items   = MENU.filter(i => qty[i.id] > 0);
  if (!items.length) return;
  const total   = items.reduce((s, i) => s + i.price * qty[i.id], 0);
  const tasa    = getTasaActual();
  const totalBs = tasa ? convertirABolivares(total) : null;

  let pagoHTML = "";
  if (pagoMovilConfig?.telefono) {
    const filas = [
      { label: "Banco",    valor: pagoMovilConfig.banco    },
      { label: "Teléfono", valor: pagoMovilConfig.telefono },
      { label: "Cédula",   valor: pagoMovilConfig.cedula   },
      { label: "Nombre",   valor: pagoMovilConfig.nombre   },
    ];
    pagoHTML = `
    <div class="pago-datos">
      <div class="pago-titulo"><i class="ti ti-device-mobile"></i> Datos de Pago Móvil</div>
      ${filas.map(f => `
        <div class="pago-row">
          <span>${f.label}</span>
          <div class="pago-valor-wrap">
            <strong>${f.valor}</strong>
            <button class="btn-copiar" onclick="window.copiarDato('${f.valor}', this)" title="Copiar">
              <i class="ti ti-copy"></i>
            </button>
          </div>
        </div>`).join("")}
      <div class="pago-monto">
        Monto a pagar
        <span>${totalBs ? formatBs(totalBs) : `$${total.toFixed(2)}`}</span>
      </div>
    </div>
    <div class="comprobante-aviso">
      <i class="ti ti-info-circle"></i>
      <span>Estimado cliente, recuerde <strong>enviar su comprobante a nuestro WhatsApp</strong> para confirmar su pedido.</span>
    </div>`;
  } else {
    pagoHTML = `<div class="pago-datos"><p style="color:#888;text-align:center;padding:1rem;">Coordinar pago con el local.</p></div>`;
  }

  document.getElementById("modal-pago-body").innerHTML = pagoHTML;
  document.getElementById("modal-pago").classList.add("visible");
  document.body.style.overflow = "hidden";
};

window.cerrarModal = function() {
  document.getElementById("modal-pago").classList.remove("visible");
  document.body.style.overflow = "";
};

window.enviarPedido = async function() {
  const nombre  = document.getElementById("nombre").value.trim();
  const items   = MENU.filter(i => qty[i.id] > 0);
  const nota    = document.getElementById("nota").value.trim();
  const total   = items.reduce((s, i) => s + i.price * qty[i.id], 0);
  const tasa    = getTasaActual();
  const totalBs = tasa ? convertirABolivares(total) : null;

  const btnEnviar = document.getElementById("btn-enviar-pedido");
  btnEnviar.disabled    = true;
  btnEnviar.textContent = "Enviando...";

  await guardarPedido({
    cliente: nombre,
    items:   items.map(i => ({ id: i.id, name: i.name, qty: qty[i.id], price: i.price })),
    total,
    totalBs: totalBs ? parseFloat(totalBs) : null,
    tasaBCV: tasa || null,
    nota:    nota || null,
  });

  let msg = `¡Hola! Soy *${nombre}* y este es mi pedido 🍔\n\n`;
  items.forEach(i => msg += `• ${i.name} ×${qty[i.id]} — $${(i.price*qty[i.id]).toFixed(2)}\n`);
  msg += `\n*Total: $${total.toFixed(2)}*`;
  if (totalBs) msg += ` _(${formatBs(totalBs)})_`;
  if (nota) msg += `\n\n📝 *Notas:* ${nota}`;
  msg += `\n\n📸 *En seguida le envío el comprobante de pago.*`;

  cerrarModal();
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`, "_blank");
  showToast("¡Pedido enviado! Recuerda enviar el comprobante 📸");

  MENU.forEach(i => qty[i.id] = 0);
  document.getElementById("nota").value   = "";
  document.getElementById("nombre").value = "";
  btnEnviar.disabled = false;
  btnEnviar.innerHTML = '<i class="ti ti-brand-whatsapp"></i> Confirmar y enviar pedido';
  render();
};

function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 4000);
}
