// ── Tasa BCV ──────────────────────────────────────────────────
// Usa ExchangeRate-API (gratuita, sin registro para consultas básicas)
// o el API pública de pydolarve para Venezuela

let tasaActual = null;

export async function obtenerTasaBCV() {
  // Intentamos primero con pydolarve (API venezolana oficial BCV)
  try {
    const res = await fetch("https://pydolarve.org/api/v1/dollar?page=bcv", {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      // La API retorna el precio en la propiedad 'price'
      const tasa = parseFloat(data?.monitors?.usd?.price);
      if (!isNaN(tasa) && tasa > 0) {
        tasaActual = tasa;
        return { tasa, fuente: "BCV", fecha: data?.monitors?.usd?.last_update || "hoy" };
      }
    }
  } catch (e) { /* continúa con fallback */ }

  // Fallback: ExchangeRate-API
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await res.json();
      const tasa = data?.rates?.VES;
      if (tasa) {
        tasaActual = tasa;
        return { tasa, fuente: "     Referencial", fecha: data.time_last_update_utc };
      }
    }
  } catch (e) { /* fallo total */ }

  return null;
}

export function getTasaActual() { return tasaActual; }

export function convertirABolivares(dolares) {
  if (!tasaActual || !dolares) return null;
  return (dolares * tasaActual).toFixed(2);
}

export function formatBs(monto) {
  if (!monto) return "—";
  return "Bs. " + parseFloat(monto).toLocaleString("es-VE", { minimumFractionDigits: 2 });
}
