// src/services/inventoryService.js
import { db } from "./firebase";
import {
  collection,
  collectionGroup,
  addDoc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  limit,
  orderBy,
  serverTimestamp,
  runTransaction,
} from "firebase/firestore";

/** -------------------------------
 * Helpers
 * ------------------------------*/
function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function makeMedicineKey(m) {
  return [norm(m.name), norm(m.genericName), norm(m.form), norm(m.strength)].join(
    "|"
  );
}

/** -------------------------------
 * Branches (Collection: branches)
 * ------------------------------*/
export async function listBranches() {
  const snap = await getDocs(query(collection(db, "branches"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addBranch({ name, address = "", contact = "" }) {
  const branchName = String(name || "").trim();
  if (!branchName) throw new Error("Branch name is required");

  const payload = {
    name: branchName,
    address: String(address || "").trim(),
    contact: String(contact || "").trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, "branches"), payload);
  return ref.id;
}

export async function updateBranch(branchId, updates = {}) {
  if (!branchId) throw new Error("branchId is required");
  const ref = doc(db, "branches", branchId);

  const payload = { ...updates, updatedAt: serverTimestamp() };
  if (payload.name != null) payload.name = String(payload.name).trim();
  if (payload.address != null) payload.address = String(payload.address).trim();
  if (payload.contact != null) payload.contact = String(payload.contact).trim();

  await updateDoc(ref, payload);
  return true;
}

export async function deleteBranch(branchId) {
  if (!branchId) throw new Error("branchId is required");

  // delete all inventory docs under this branch
  const invSnap = await getDocs(collection(db, "branches", branchId, "inventory"));
  await Promise.all(invSnap.docs.map((d) => deleteDoc(d.ref)));

  // delete the branch doc
  await deleteDoc(doc(db, "branches", branchId));
  return true;
}

/** -------------------------------
 * Medicines (Collection: medicines)
 * ------------------------------*/
export async function listMedicines() {
  const snap = await getDocs(query(collection(db, "medicines"), orderBy("name")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addMedicine(form) {
  const payload = {
    name: (form.name || "").trim(),
    genericName: (form.genericName || "").trim(),
    form: (form.form || "").trim(),
    strength: (form.strength || "").trim(),
    price: Number(form.price) || 0,
    key: makeMedicineKey(form),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (!payload.name) throw new Error("Medicine name is required");

  const ref = await addDoc(collection(db, "medicines"), payload);
  return ref.id;
}

export async function findMedicineByKey(form) {
  const key = makeMedicineKey(form);

  const q = query(
    collection(db, "medicines"),
    where("key", "==", key),
    limit(1)
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

/** -------------------------------
 * Inventory
 * Path: branches/{branchId}/inventory/{medicineId}
 * ------------------------------*/
export async function setInventoryQuantity({ branchId, medicineId, quantity }) {
  if (!branchId) throw new Error("branchId is required");
  if (!medicineId) throw new Error("medicineId is required");

  const qty = Math.max(0, Number(quantity) || 0);
  const invRef = doc(db, "branches", branchId, "inventory", medicineId);

  await setDoc(
    invRef,
    {
      medicineId,
      quantity: qty,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}

export async function addInventoryQuantity({
  branchId,
  medicineId,
  quantityDelta,
}) {
  if (!branchId) throw new Error("branchId is required");
  if (!medicineId) throw new Error("medicineId is required");

  const delta = Number(quantityDelta) || 0;
  const invRef = doc(db, "branches", branchId, "inventory", medicineId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(invRef);
    const currentQty = snap.exists() ? Number(snap.data().quantity || 0) : 0;
    const nextQty = Math.max(0, currentQty + delta);

    if (!snap.exists()) {
      tx.set(invRef, {
        medicineId,
        quantity: nextQty,
        updatedAt: serverTimestamp(),
      });
    } else {
      tx.update(invRef, {
        quantity: nextQty,
        updatedAt: serverTimestamp(),
      });
    }
  });

  return true;
}

export async function getInventoryQuantity({ branchId, medicineId }) {
  if (!branchId) throw new Error("branchId is required");
  if (!medicineId) throw new Error("medicineId is required");

  const invRef = doc(db, "branches", branchId, "inventory", medicineId);
  const snap = await getDoc(invRef);
  return snap.exists() ? Number(snap.data().quantity || 0) : 0;
}

export async function listInventoryForBranch(branchId) {
  if (!branchId) throw new Error("branchId is required");

  const snap = await getDocs(collection(db, "branches", branchId, "inventory"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * ✅ Used by Inventory.jsx
 * Deletes ONE inventory doc inside one branch
 */
export async function deleteInventoryItem({ branchId, medicineId }) {
  if (!branchId) throw new Error("branchId is required");
  if (!medicineId) throw new Error("medicineId is required");

  await deleteDoc(doc(db, "branches", branchId, "inventory", medicineId));
  return true;
}

/** -------------------------------
 * Customer Feature:
 * find branches with stock for medicine
 * Returns: [{ branchId, branchName, quantity }]
 * ------------------------------*/
export async function findBranchesWithStock(medicineId, minQty = 1) {
  const mid = String(medicineId || "").trim();
  if (!mid) throw new Error("medicineId is required");

  const qRef = query(
    collectionGroup(db, "inventory"),
    where("medicineId", "==", mid),
    where("quantity", ">=", Number(minQty) || 1)
  );

  const snap = await getDocs(qRef);
  if (snap.empty) return [];

  const rows = snap.docs.map((d) => {
    const parts = d.ref.path.split("/");
    const branchId = parts[1];
    const data = d.data();
    return {
      branchId,
      quantity: Number(data.quantity || 0),
    };
  });

  const uniqueBranchIds = Array.from(new Set(rows.map((r) => r.branchId)));

  const branches = await Promise.all(
    uniqueBranchIds.map(async (bid) => {
      const bSnap = await getDoc(doc(db, "branches", bid));
      return {
        id: bid,
        name: bSnap.exists() ? bSnap.data().name || bid : bid,
      };
    })
  );

  const nameById = {};
  for (const b of branches) nameById[b.id] = b.name;

  return rows
    .map((r) => ({
      branchId: r.branchId,
      branchName: nameById[r.branchId] || r.branchId,
      quantity: r.quantity,
    }))
    .sort((a, b) => b.quantity - a.quantity);
}

/**
 * ✅ Used by Inventory.jsx
 * Deletes a medicine doc + deletes that medicine from ALL branch inventory subcollections.
 *
 * - medicines/{medicineId}
 * - branches/{branchId}/inventory/{medicineId} (for every branch that has it)
 */
export async function deleteMedicineEverywhere(medicineId) {
  const mid = String(medicineId || "").trim();
  if (!mid) throw new Error("medicineId is required");

  // 1) Find all inventory docs for this medicine
  const qRef = query(collectionGroup(db, "inventory"), where("medicineId", "==", mid));
  const snap = await getDocs(qRef);

  // 2) Delete all inventory docs
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));

  // 3) Delete medicine doc itself
  await deleteDoc(doc(db, "medicines", mid));

  return true;
}
