// src/services/posService.js
//
// POS = Point of Sale helpers
// - Creates a sale record
// - Deducts branch inventory atomically
// - Optionally links back to a reservation

import { auth, db } from "./firebase";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
} from "firebase/firestore";

function asNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normMethod(m) {
  const v = String(m || "").toLowerCase().trim();
  if (v === "cash" || v === "card" || v === "gcash") return v;
  return "cash";
}

function normalizeItems(items = []) {
  // Merge duplicates by medicineId
  const map = new Map();
  for (const it of items || []) {
    const medicineId = String(it?.medicineId || "").trim();
    if (!medicineId) continue;

    const prev = map.get(medicineId);
    const qty = Math.max(0, asNumber(it?.qty, 0));
    const unitPrice = Math.max(0, asNumber(it?.price ?? it?.unitPrice, 0));
    const medicineName = String(it?.medicineName || it?.name || "").trim();

    if (!prev) {
      map.set(medicineId, {
        medicineId,
        medicineName,
        qty,
        unitPrice,
      });
    } else {
      // qty adds up; keep latest name/price if provided
      map.set(medicineId, {
        ...prev,
        qty: prev.qty + qty,
        unitPrice: unitPrice || prev.unitPrice,
        medicineName: medicineName || prev.medicineName,
      });
    }
  }

  const out = Array.from(map.values()).filter((x) => (asNumber(x.qty) || 0) > 0);
  if (!out.length) throw new Error("Cart is empty");
  return out;
}

export async function createSale({
  branchId,
  items,
  paymentMethod = "cash",
  cashReceived = null,
  reservationId = null,
  customerName = "",
  customerPhone = "",
  customerUid = null,
} = {}) {
  const bid = String(branchId || "").trim();
  if (!bid) throw new Error("branchId is required");

  const method = normMethod(paymentMethod);
  const cart = normalizeItems(items);

  // Pre-compute totals
  const totalQty = cart.reduce((s, it) => s + (asNumber(it.qty) || 0), 0);
  const subtotal = cart.reduce(
    (s, it) => s + (asNumber(it.unitPrice) || 0) * (asNumber(it.qty) || 0),
    0
  );
  const total = subtotal; // (no tax/discount yet)

  const received = cashReceived == null ? null : Math.max(0, asNumber(cashReceived, 0));
  if (method === "cash") {
    if (received == null) throw new Error("Cash received is required for cash payments");
    if (received < total) throw new Error("Cash received is less than total");
  }
  const change = method === "cash" ? Math.max(0, (received || 0) - total) : 0;

  const uid = auth.currentUser?.uid || null;

  const result = await runTransaction(db, async (tx) => {
    // Create sale doc ref (deterministic id for this transaction)
    const saleRef = doc(collection(db, "sales"));

    // Inventory deduction
    for (const it of cart) {
      const invRef = doc(db, "branches", bid, "inventory", it.medicineId);
      const invSnap = await tx.get(invRef);

      const currentQty = invSnap.exists() ? asNumber(invSnap.data()?.quantity, 0) : 0;
      const need = asNumber(it.qty, 0);

      if (need <= 0) continue;
      if (currentQty < need) {
        throw new Error(
          `Insufficient stock for ${it.medicineName || it.medicineId}. Available: ${currentQty}, Needed: ${need}`
        );
      }

      tx.set(
        invRef,
        {
          medicineId: it.medicineId,
          quantity: currentQty - need,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      const itemRef = doc(collection(db, "sales", saleRef.id, "items"));
      tx.set(itemRef, {
        medicineId: it.medicineId,
        medicineName: it.medicineName || "",
        qty: need,
        unitPrice: asNumber(it.unitPrice, 0),
        lineTotal: asNumber(it.unitPrice, 0) * need,
        createdAt: serverTimestamp(),
      });
    }

    // Sale record
    tx.set(saleRef, {
      branchId: bid,
      createdAt: serverTimestamp(),
      createdBy: uid,
      status: "paid",
      paymentStatus: "paid",
      paymentMethod: method,
      subtotal,
      total,
      totalQty,
      cashReceived: method === "cash" ? received : null,
      cashChange: method === "cash" ? change : null,
      reservationId: reservationId ? String(reservationId) : null,
      customerName: String(customerName || "").trim(),
      customerPhone: String(customerPhone || "").trim(),
      customerUid: customerUid || null,
      updatedAt: serverTimestamp(),
    });

    // Link reservation -> completed
    if (reservationId) {
      const rRef = doc(db, "reservations", String(reservationId));
      const rSnap = await tx.get(rRef);
      if (rSnap.exists()) {
        tx.update(rRef, {
          status: "completed",
          completedAt: serverTimestamp(),
          completedBy: uid,
          saleId: saleRef.id,
          updatedAt: serverTimestamp(),
        });
      }
    }

    return { saleId: saleRef.id };
  });

  return { ...result, change };
}

export async function getSale(saleId) {
  const sid = String(saleId || "").trim();
  if (!sid) throw new Error("saleId is required");
  const snap = await getDoc(doc(db, "sales", sid));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function listSaleItems(saleId) {
  const sid = String(saleId || "").trim();
  if (!sid) throw new Error("saleId is required");
  const qy = query(collection(db, "sales", sid, "items"), orderBy("createdAt", "asc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}
