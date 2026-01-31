// src/services/userAdminService.js
import { db, getSecondaryAuth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  collection,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

export const ROLES = ["admin", "pharmacist", "customer", "kiosk", "display"];

export async function adminCreateUser({
  fullName,
  email,
  password,
  role = "customer",
}) {
  if (!fullName?.trim()) throw new Error("Full name is required");
  if (!email?.trim()) throw new Error("Email is required");
  if (!password || password.length < 6) throw new Error("Password must be at least 6 characters");
  if (!ROLES.includes(role)) throw new Error("Invalid role");

  const secondaryAuth = getSecondaryAuth();

  // Create auth user WITHOUT affecting current admin login
  const cred = await createUserWithEmailAndPassword(
    secondaryAuth,
    email.trim(),
    password
  );

  // Create Firestore profile doc using UID
  await setDoc(doc(db, "users", cred.user.uid), {
    fullName: fullName.trim(),
    email: email.trim().toLowerCase(),
    role,
    disabled: false,
    createdAt: serverTimestamp(),
    createdBy: "admin",
  });

  // Clean up secondary session
  await signOut(secondaryAuth);

  return { uid: cred.user.uid };
}

export async function adminListUsers() {
  const qy = query(collection(db, "users"), orderBy("createdAt", "desc"));
  const snap = await getDocs(qy);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function adminUpdateUserRole(uid, role) {
  if (!uid) throw new Error("uid is required");
  if (!ROLES.includes(role)) throw new Error("Invalid role");

  await updateDoc(doc(db, "users", uid), {
    role,
    updatedAt: serverTimestamp(),
  });
}

export async function adminSetUserDisabled(uid, disabled) {
  if (!uid) throw new Error("uid is required");

  await updateDoc(doc(db, "users", uid), {
    disabled: !!disabled,
    updatedAt: serverTimestamp(),
  });
}
