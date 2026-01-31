import { db } from "./firebase";
import {
  collection,
  doc,
  serverTimestamp,
  runTransaction,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";

function queueRef(branchId) {
  return doc(db, "queues", branchId);
}

function ticketsCol(branchId) {
  return collection(db, "queues", branchId, "tickets");
}

/* ---------------- REALTIME SUBSCRIBERS ---------------- */

export function subscribeQueueMeta(branchId, cb) {
  if (!branchId) return () => {};
  return onSnapshot(queueRef(branchId), (snap) => {
    if (!snap.exists()) {
      cb({ currentNumber: 0, servingTicketId: null });
      return;
    }
    const d = snap.data();
    cb({
      currentNumber: Number(d.currentNumber || 0),
      servingTicketId: d.servingTicketId || null,
    });
  });
}

export function subscribeNextWaiting(branchId, cb) {
  if (!branchId) return () => {};
  const q = query(
    ticketsCol(branchId),
    where("status", "==", "waiting"),
    orderBy("ticketNumber", "asc"),
    limit(1)
  );

  return onSnapshot(q, (snap) => {
    if (snap.empty) return cb(null);
    const d = snap.docs[0];
    cb({ id: d.id, ...d.data() });
  });
}

export function subscribeWaitingCount(branchId, cb) {
  if (!branchId) return () => {};
  const q = query(ticketsCol(branchId), where("status", "==", "waiting"));
  return onSnapshot(q, (snap) => cb(snap.size));
}

export function subscribeNowServing(branchId, servingTicketId, cb) {
  if (!branchId) return () => {};
  if (!servingTicketId) {
    cb(null);
    return () => {};
  }
  const ref = doc(db, "queues", branchId, "tickets", servingTicketId);
  return onSnapshot(ref, (snap) => {
    if (!snap.exists()) return cb(null);
    cb({ id: snap.id, ...snap.data() });
  });
}

/* ---------------- CORE ACTIONS ---------------- */

// KIOSK: Join Queue (atomic ticket increment + create ticket doc)
export async function joinQueue(branchId) {
  if (!branchId) throw new Error("branchId is required");

  const res = await runTransaction(db, async (tx) => {
    const qRef = queueRef(branchId);
    const qSnap = await tx.get(qRef);

    let nextNumber = 1;

    if (qSnap.exists()) {
      const data = qSnap.data();
      nextNumber = (Number(data.currentNumber) || 0) + 1;

      tx.set(
        qRef,
        { currentNumber: nextNumber, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } else {
      nextNumber = 1;
      tx.set(qRef, {
        currentNumber: 1,
        servingTicketId: null,
        updatedAt: serverTimestamp(),
      });
    }

    const tRef = doc(ticketsCol(branchId)); // auto-id
    tx.set(tRef, {
      ticketNumber: nextNumber,
      status: "waiting",
      createdAt: serverTimestamp(),
    });

    return { ticketNumber: nextNumber, ticketId: tRef.id };
  });

  return res;
}

// One-time get now serving
export async function getNowServing(branchId) {
  if (!branchId) return null;

  const qSnap = await getDoc(queueRef(branchId));
  if (!qSnap.exists()) return null;

  const servingTicketId = qSnap.data().servingTicketId;
  if (!servingTicketId) return null;

  const tSnap = await getDoc(doc(db, "queues", branchId, "tickets", servingTicketId));
  if (!tSnap.exists()) return null;

  return { id: tSnap.id, ...tSnap.data() };
}

// DASHBOARD: Next
export async function nextTicket(branchId) {
  if (!branchId) throw new Error("branchId is required");

  const res = await runTransaction(db, async (tx) => {
    const qRef = queueRef(branchId);

    const qWaiting = query(
      ticketsCol(branchId),
      where("status", "==", "waiting"),
      orderBy("ticketNumber", "asc"),
      limit(1)
    );

    const waitingSnap = await getDocs(qWaiting);

    if (waitingSnap.empty) {
      tx.set(qRef, { servingTicketId: null, updatedAt: serverTimestamp() }, { merge: true });
      return null;
    }

    const nextDoc = waitingSnap.docs[0];

    tx.update(nextDoc.ref, { status: "serving" });
    tx.set(qRef, { servingTicketId: nextDoc.id, updatedAt: serverTimestamp() }, { merge: true });

    return { id: nextDoc.id, ...nextDoc.data(), status: "serving" };
  });

  return res;
}

// DASHBOARD: Done
export async function doneTicket(branchId) {
  if (!branchId) throw new Error("branchId is required");

  const res = await runTransaction(db, async (tx) => {
    const qRef = queueRef(branchId);
    const qSnap = await tx.get(qRef);
    if (!qSnap.exists()) return null;

    const servingTicketId = qSnap.data().servingTicketId;
    if (!servingTicketId) return null;

    const tRef = doc(db, "queues", branchId, "tickets", servingTicketId);
    const tSnap = await tx.get(tRef);

    if (tSnap.exists()) tx.update(tRef, { status: "done" });

    tx.set(qRef, { servingTicketId: null, updatedAt: serverTimestamp() }, { merge: true });

    return tSnap.exists() ? { id: servingTicketId, ...tSnap.data(), status: "done" } : null;
  });

  return res;
}

/* ---------------- RESET QUEUE (ADMIN) ----------------
   This will:
   1) Set queues/{branchId}.currentNumber = 0
   2) Set servingTicketId = null
   3) Delete ALL tickets under queues/{branchId}/tickets

   NOTE: Firestore deletes are limited per batch (500). We do it in chunks.
*/
export async function resetQueue(branchId) {
  if (!branchId) throw new Error("branchId is required");

  // 1) Reset queue meta (atomic)
  await runTransaction(db, async (tx) => {
    tx.set(
      queueRef(branchId),
      {
        currentNumber: 0,
        servingTicketId: null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  // 2) Delete all tickets in batches of 450-500 (safe)
  // If you expect thousands of tickets, consider using a Cloud Function later.
  while (true) {
    const snap = await getDocs(query(ticketsCol(branchId), limit(450)));
    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  return true;
}
