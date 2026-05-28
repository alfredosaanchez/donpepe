import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, where, Timestamp, doc, setDoc, getDoc, deleteDoc, runTransaction }
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

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db  = getFirestore(app);

// ── Número correlativo seguro con transacción ─────────────────
async function obtenerSiguienteNumero() {
  const contadorRef = doc(db, "config", "contador");
  let numero = 1;
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(contadorRef);
    numero = snap.exists() ? (snap.data().ultimo + 1) : 1;
    transaction.set(contadorRef, { ultimo: numero });
  });
  return numero;
}

export async function guardarPedido(pedido) {
  try {
    const numero = await obtenerSiguienteNumero();
    await addDoc(collection(db, "pedidos"), { ...pedido, numero, fecha: Timestamp.now() });
    return numero;
  } catch (e) { console.error(e); return null; }
}

export async function obtenerPedidos() {
  try {
    const snap = await getDocs(query(collection(db, "pedidos"), orderBy("fecha", "desc")));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); return []; }
}

export async function obtenerPedidosPorRango(desde, hasta) {
  try {
    const q = query(collection(db, "pedidos"),
      where("fecha", ">=", Timestamp.fromDate(desde)),
      where("fecha", "<=", Timestamp.fromDate(hasta)),
      orderBy("fecha", "desc"));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) { console.error(e); return []; }
}

export async function eliminarPedido(id) {
  try { await deleteDoc(doc(db, "pedidos", id)); return true; }
  catch (e) { console.error(e); return false; }
}

export async function guardarPagoMovil(datos) {
  try { await setDoc(doc(db, "config", "pagoMovil"), datos); return true; }
  catch (e) { console.error(e); return false; }
}

export async function obtenerPagoMovil() {
  try { const s = await getDoc(doc(db, "config", "pagoMovil")); return s.exists() ? s.data() : null; }
  catch (e) { console.error(e); return null; }
}

export async function guardarProductos(productos) {
  try { await setDoc(doc(db, "config", "productos"), { lista: productos }); return true; }
  catch (e) { console.error(e); return false; }
}

export async function obtenerProductos() {
  try { const s = await getDoc(doc(db, "config", "productos")); return s.exists() ? s.data().lista : null; }
  catch (e) { console.error(e); return null; }
}
