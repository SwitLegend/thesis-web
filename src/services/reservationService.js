// src/services/reservationService.js
import { db, auth } from "./firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  Timestamp,
  query,
  where,
  getDocs,
  limit,
  doc,
  runTransaction,
  onSnapshot,
  orderBy,
  updateDoc,
} from "firebase/firestore";

/** Generate a random token (good enough for a thesis app) */
function makeToken(len = 24) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusing chars
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function createReservation({
  branchId,
  customerName,
  customerPhone,
  items, // [{ medicineId, medicineName, qty, price }]
  expiresHours = 6,
}) {
  if (!branchId) throw new Error("branchId is required");
  if (!customerName?.trim()) throw new Error("Customer name is required");
  if (!items?.length) throw new Error("Please add at least 1 medicine");
  for (const it of items) {
    if (!it.medicineId) throw new Error("medicineId missing");
    if ((Number(it.qty) || 0) <= 0) throw new Error("Qty must be > 0");
  }

  const token = makeToken(20);
  const totalQty = items.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + expiresHours * 60 * 60 * 1000);

  // Create reservation
  const rRef = await addDoc(collection(db, "reservations"), {
    branchId,
    customerName: customerName.trim(),
    customerPhone: (customerPhone || "").trim(),
    status: "reserved",
    qrToken: token,
    createdAt: serverTimestamp(),
    expiresAt,
    claimedAt: null,
    claimedBy: null,
    completedAt: null,
    completedBy: null,
    archivedAt: null,
    archivedBy: null,
    totalQty,
    customerUid: auth.currentUser?.uid || null, // optional
  });

  // Create items in reservationItems collection
  const itemsCol = collection(db, "reservationItems");
  for (const it of items) {
    await addDoc(itemsCol, {
      reservationId: rRef.id,
      branchId,
      medicineId: it.medicineId,
      medicineName: it.medicineName || "",
      qty: Number(it.qty) || 0,
      price: Number(it.price) || 0,
      createdAt: serverTimestamp(),
    });
  }

  return { reservationId: rRef.id, qrToken: token, expiresAt };
}

/** ✅ lookup reservation by token (does NOT claim) */
export async function getReservationByToken({ branchId, qrToken }) {
  if (!branchId) throw new Error("branchId is required");
  if (!qrToken?.trim()) throw new Error("qrToken is required");

  const token = qrToken.trim().toUpperCase();

  const qRes = query(
    collection(db, "reservations"),
    where("branchId", "==", branchId),
    where("qrToken", "==", token),
    limit(1)
  );

  const snap = await getDocs(qRes);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/**
 * Verify token and claim reservation (pharmacist/admin)
 * - must match branch
 * - must be status="reserved"
 * - must not be expired
 */
export async function claimReservationByToken({ branchId, qrToken }) {
  if (!branchId) throw new Error("branchId is required");
  if (!qrToken?.trim()) throw new Error("qrToken is required");

  const token = qrToken.trim().toUpperCase();

  const res = await runTransaction(db, async (tx) => {
    const qRes = query(
      collection(db, "reservations"),
      where("branchId", "==", branchId),
      where("qrToken", "==", token),
      where("status", "==", "reserved"),
      limit(1)
    );

    const snap = await getDocs(qRes);

    if (snap.empty) {
      throw new Error(
        "No active reservation found for this token (wrong branch/token or already claimed)."
      );
    }

    const rDoc = snap.docs[0];
    const rRef = doc(db, "reservations", rDoc.id);
    const data = rDoc.data();

    // Expiry check
    const expiresAt = data.expiresAt;
    if (expiresAt?.toMillis && expiresAt.toMillis() < Date.now()) {
      tx.update(rRef, { status: "cancelled" });
      throw new Error("This reservation is expired.");
    }

    tx.update(rRef, {
      status: "claimed",
      claimedAt: serverTimestamp(),
      claimedBy: auth.currentUser?.uid || null,
    });

    return { reservationId: rDoc.id, ...data, status: "claimed" };
  });

  return res;
}

/** Get reservation items for display */
export async function getReservationItems(reservationId) {
  const qItems = query(
    collection(db, "reservationItems"),
    where("reservationId", "==", reservationId)
  );
  const snap = await getDocs(qItems);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** ✅ Real-time subscribe reservations (optionally by branch) */
export function subscribeReservations({ branchId = "" } = {}, cb) {
  const base = collection(db, "reservations");
  const qRes = branchId
    ? query(base, where("branchId", "==", branchId), orderBy("createdAt", "desc"))
    : query(base, orderBy("createdAt", "desc"));

  const unsub = onSnapshot(
    qRes,
    (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      cb?.(list);
    },
    (err) => {
      console.error("subscribeReservations error:", err);
      cb?.([]);
    }
  );

  return unsub;
}

/** Generic status update (admin/pharmacist UI helpers) */
export async function updateReservationStatus(reservationId, status, extra = {}) {
  if (!reservationId) throw new Error("reservationId is required");
  const ref = doc(db, "reservations", reservationId);

  await updateDoc(ref, {
    status: String(status || "").toLowerCase().trim(),
    ...extra,
    updatedAt: serverTimestamp(),
  });

  return true;
}

/** Mark completed */
export async function completeReservation(reservationId) {
  return updateReservationStatus(reservationId, "completed", {
    completedAt: serverTimestamp(),
    completedBy: auth.currentUser?.uid || null,
  });
}

/** Archive (moves to History) */
export async function archiveReservation(reservationId) {
  return updateReservationStatus(reservationId, "archived", {
    archivedAt: serverTimestamp(),
    archivedBy: auth.currentUser?.uid || null,
  });
}
