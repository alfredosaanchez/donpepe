// ── Configuración Firebase ────────────────────────────────────
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, Timestamp }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:            "AIzaSyAvO8mKOitUzLfaj-7exe5rrexsw-31IrQ",
  authDomain:        "burger-don-pepe.firebaseapp.com",
  projectId:         "burger-don-pepe",
  storageBucket:     "burger-don-pepe.firebasestorage.app",
  messagingSenderId: "289295612007",
  appId:             "1:289295612007:web:2ed6462e189a1ed5b9fcc2",
  measurementId:     "G-ZQWCYV5L2Y"
};

const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Guardar pedido ────────────────────────────────────────────
export async function guardarPedido(pedido) {
  try {
    await addDoc(collection(db, "pedidos"), {
      ...pedido,
      fecha: Timestamp.now()
    });
    return true;
  } catch (e) {
    console.error("Error guardando pedido:", e);
    return false;
  }
}

// ── Obtener todos los pedidos ─────────────────────────────────
export async function obtenerPedidos() {
  try {
    const q = query(collection(db, "pedidos"), orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Error obteniendo pedidos:", e);
    return [];
  }
}

// ── Obtener pedidos entre dos fechas ──────────────────────────
export async function obtenerPedidosPorRango(desde, hasta) {
  try {
    const q = query(
      collection(db, "pedidos"),
      where("fecha", ">=", Timestamp.fromDate(desde)),
      where("fecha", "<=", Timestamp.fromDate(hasta)),
      orderBy("fecha", "desc")
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("Error filtrando pedidos:", e);
    return [];
  }
}
