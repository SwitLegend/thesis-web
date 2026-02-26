// src/hooks/useToasts.jsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./useAuth";
import { listBranches, listMedicines } from "../services/inventoryService";
import {
  subscribeNowServing,
  subscribeQueueMeta,
  subscribeWaitingCount,
} from "../services/queueService";

const ToastCtx = createContext(null);

const MAX_TOASTS = 4;
const MAX_NOTIFS = 120;

function makeId(prefix = "id") {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
  } catch {
    // ignore
  }
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function safeParse(json, fallback) {
  try {
    return JSON.parse(json);
  } catch {
    return fallback;
  }
}

function formatRelative(ts) {
  const t = typeof ts === "number" ? ts : ts?.toMillis?.() || 0;
  if (!t) return "";
  const diff = Date.now() - t;
  const s = Math.floor(diff / 1000);
  if (s < 10) return "now";
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function storageKey(uid) {
  return `pms.notifications.${uid || "anon"}`;
}

function readStoredNotifs(uid) {
  const raw = localStorage.getItem(storageKey(uid));
  const parsed = safeParse(raw || "", null);
  if (!parsed || !Array.isArray(parsed.items)) return [];
  return parsed.items.slice(0, MAX_NOTIFS);
}

function writeStoredNotifs(uid, items) {
  try {
    localStorage.setItem(
      storageKey(uid),
      JSON.stringify({ v: 1, items: items.slice(0, MAX_NOTIFS) })
    );
  } catch {
    // ignore
  }
}

function sessionKey(uid, key) {
  return `pms.session.${uid || "anon"}.${key}`;
}

function hasSessionFlag(uid, key) {
  try {
    return sessionStorage.getItem(sessionKey(uid, key)) === "1";
  } catch {
    return false;
  }
}

function setSessionFlag(uid, key) {
  try {
    sessionStorage.setItem(sessionKey(uid, key), "1");
  } catch {
    // ignore
  }
}

function normLoose(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function eventIcon(kind) {
  switch (kind) {
    case "success":
      return "✅";
    case "warning":
      return "⚠️";
    case "error":
      return "⛔";
    case "queue":
      return "🎫";
    case "reservation":
      return "🗂️";
    case "stock":
      return "📦";
    default:
      return "🔔";
  }
}

function normalizeNotif(n) {
  return {
    id: n.id || makeId("n"),
    title: String(n.title || "Notification"),
    message: String(n.message || ""),
    kind: n.kind || "info",
    icon: n.icon || eventIcon(n.kind),
    href: n.href || "",
    createdAt: n.createdAt || Date.now(),
    read: Boolean(n.read),
    meta: n.meta || {},
  };
}

export function ToastProvider({ children, lowStockThreshold = 10 }) {
  const { user, profile, loading } = useAuth();

  const [toasts, setToasts] = useState([]);
  const [notifs, setNotifs] = useState([]);

  const timersRef = useRef(new Map());
  const seenKeysRef = useRef(new Set());
  const seenQueueRef = useRef([]);

  // Load persisted notifications when user changes
  useEffect(() => {
    if (!user?.uid) {
      setNotifs([]);
      return;
    }
    const stored = readStoredNotifs(user.uid);
    setNotifs(stored);
  }, [user?.uid]);

  // Persist notifications
  useEffect(() => {
    if (!user?.uid) return;
    writeStoredNotifs(user.uid, notifs);
  }, [user?.uid, notifs]);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const tm = timersRef.current.get(id);
    if (tm) {
      clearTimeout(tm);
      timersRef.current.delete(id);
    }
  }, []);

  const pushToast = useCallback(
    ({ title, message = "", kind = "info", icon, durationMs, action }) => {
      const id = makeId("t");
      const d =
        typeof durationMs === "number"
          ? clamp(durationMs, 1500, 20000)
          : kind === "error"
          ? 7000
          : 4500;

      const toast = {
        id,
        title: String(title || ""),
        message: String(message || ""),
        kind,
        icon: icon || eventIcon(kind),
        createdAt: Date.now(),
        action: action || null,
      };

      setToasts((prev) => [toast, ...prev].slice(0, MAX_TOASTS));
      timersRef.current.set(id, setTimeout(() => dismissToast(id), d));
      return id;
    },
    [dismissToast]
  );

  const pushNotification = useCallback((n, { dedupeKey } = {}) => {
    if (dedupeKey) {
      if (seenKeysRef.current.has(dedupeKey)) return null;
      seenKeysRef.current.add(dedupeKey);

      // keep the set from growing forever
      seenQueueRef.current.push(dedupeKey);
      if (seenQueueRef.current.length > 350) {
        const old = seenQueueRef.current.splice(0, 150);
        old.forEach((k) => seenKeysRef.current.delete(k));
      }
    }

    const item = normalizeNotif(n);
    setNotifs((prev) => [item, ...prev].slice(0, MAX_NOTIFS));
    return item.id;
  }, []);

  const markRead = useCallback((id) => {
    setNotifs((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifs([]);
  }, []);

  const unreadCount = useMemo(
    () => notifs.reduce((sum, n) => sum + (n.read ? 0 : 1), 0),
    [notifs]
  );

  // =========================
  // Real-time feeds
  // =========================
  useEffect(() => {
    if (loading) return;
    if (!user?.uid) return;

    const role = String(profile?.role || "").toLowerCase();
    const threshold = Math.max(1, Number(lowStockThreshold) || 10);

    // Only staff roles are meant to see these system alerts.
    const isStaff = role === "admin" || role === "pharmacist";
    if (!isStaff) return;

    let cancelled = false;

    let unsubReservations = () => {};
    const cleanupQueueFns = [];
    const cleanupInvFns = [];

    // ---------------- Reservations events (added + status changes)
    const statusById = new Map();
    let resReady = false;

    const branchId = String(profile?.branchId || "");
    const resBase = collection(db, "reservations");
    const resQ = branchId
      ? query(
          resBase,
          where("branchId", "==", branchId),
          orderBy("createdAt", "desc"),
          limit(50)
        )
      : query(resBase, orderBy("createdAt", "desc"), limit(50));

    unsubReservations = onSnapshot(
      resQ,
      (snap) => {
        if (!resReady) {
          snap.docs.forEach((d) =>
            statusById.set(d.id, String(d.data()?.status || ""))
          );
          resReady = true;
          return;
        }

        snap.docChanges().forEach((ch) => {
          const d = ch.doc;
          const data = d.data() || {};
          const nextStatus = String(data.status || "");
          const prevStatus = statusById.get(d.id);
          statusById.set(d.id, nextStatus);

          const customer = data.customerName || "Customer";
          const qty = Number(data.totalQty || 0) || 0;
          const b = data.branchName || data.branchId || branchId || "";
          const titleBase = !branchId && b ? `${b} • ` : "";

          const emit = ({ title, message, kind, icon, href, dedupeKey }) => {
            pushToast({ title, message, kind, icon });
            pushNotification(
              {
                title,
                message,
                kind,
                icon,
                href,
                createdAt: Date.now(),
                read: false,
                meta: { source: "reservation", reservationId: d.id },
              },
              { dedupeKey }
            );
          };

          if (ch.type === "added") {
            if (nextStatus === "reserved") {
              const title = `${titleBase}New reservation`;
              const message = `${customer}${qty ? ` • Qty ${qty}` : ""}`;
              emit({
                title,
                message,
                kind: "reservation",
                icon: "🗂️",
                href: "/reservations-hub",
                dedupeKey: `res:add:${d.id}:${nextStatus}`,
              });
            }
            return;
          }

          if (ch.type === "modified" && prevStatus && prevStatus !== nextStatus) {
            if (nextStatus === "claimed") {
              emit({
                title: `${titleBase}Reservation claimed`,
                message: `${customer}${qty ? ` • Qty ${qty}` : ""}`,
                kind: "success",
                icon: "✅",
                href: "/reservations-hub",
                dedupeKey: `res:status:${d.id}:${nextStatus}`,
              });
            } else if (nextStatus === "completed") {
              emit({
                title: `${titleBase}Reservation completed`,
                message: `${customer}${qty ? ` • Qty ${qty}` : ""}`,
                kind: "success",
                icon: "🎉",
                href: "/reservations-hub",
                dedupeKey: `res:status:${d.id}:${nextStatus}`,
              });
            } else if (nextStatus === "cancelled") {
              emit({
                title: `${titleBase}Reservation expired/cancelled`,
                message: `${customer}${qty ? ` • Qty ${qty}` : ""}`,
                kind: "warning",
                icon: "⚠️",
                href: "/reservations-hub",
                dedupeKey: `res:status:${d.id}:${nextStatus}`,
              });
            } else if (nextStatus === "archived") {
              emit({
                title: `${titleBase}Reservation archived`,
                message: `${customer}${qty ? ` • Qty ${qty}` : ""}`,
                kind: "info",
                icon: "📁",
                href: "/reservations-hub",
                dedupeKey: `res:status:${d.id}:${nextStatus}`,
              });
            }
          }
        });
      },
      (err) => console.error("Reservations feed error:", err)
    );

    // ---------------- Helpers: resolve which branches to watch
    const resolveBranchesToWatch = async () => {
      const pBranchId = String(profile?.branchId || "").trim();
      const pBranchName = String(profile?.branchName || "").trim();

      if (pBranchId) {
        return [{ id: pBranchId, name: pBranchName || pBranchId }];
      }

      // Admin: watch ALL branches
      if (role === "admin") {
        try {
          const bs = await listBranches();
          return (bs || []).map((b) => ({ id: b.id, name: b.name || b.id }));
        } catch (e) {
          console.error("Failed to list branches (admin watch):", e);
          return [];
        }
      }

      // Pharmacist: try to resolve branch via branchName, else fallback to first branch
      if (role === "pharmacist") {
        try {
          const bs = await listBranches();
          if (!bs?.length) return [];

          let match = null;
          if (pBranchName) {
            const needle = normLoose(pBranchName);
            match =
              bs.find((b) => normLoose(b.id) === needle) ||
              bs.find((b) => normLoose(b.name) === needle);
          }

          if (!match) match = bs[0];

          // Let you know once per session if branchId is missing from the user profile
          if (!hasSessionFlag(user.uid, "missingBranchId")) {
            setSessionFlag(user.uid, "missingBranchId");
            pushNotification(
              {
                title: "Branch not assigned",
                message:
                  "Your user profile is missing branchId. Notifications will use a fallback branch until an admin assigns your branch.",
                kind: "warning",
                icon: "⚠️",
                href: "",
                createdAt: Date.now(),
                read: false,
                meta: { source: "system" },
              },
              { dedupeKey: `sys:missingBranchId:${user.uid}` }
            );
          }

          return [{ id: match.id, name: match.name || match.id }];
        } catch (e) {
          console.error("Failed to resolve branches (pharmacist watch):", e);
          return [];
        }
      }

      return [];
    };

    // ---------------- Queue events
    const watchQueueForBranch = (b) => {
      const bId = b.id;
      const label = b?.name ? `${b.name} • ` : "";

      let metaReady = false;
      let prevServingId = null;
      let toastNextServingId = null;

      let unsubServing = () => {};
      const unsubMeta = subscribeQueueMeta(
        bId,
        (meta) => {
          if (!meta) return;
          const nextServingId = meta.servingTicketId || null;

          if (!metaReady) {
            metaReady = true;
            prevServingId = nextServingId;
            unsubServing();
            unsubServing = subscribeNowServing(bId, prevServingId, () => {});
            return;
          }

          if (nextServingId !== prevServingId) {
            // cleared
            if (!nextServingId && prevServingId) {
              const title = `${label}Now serving cleared`;
              const message = "No ticket is currently serving";

              pushToast({ title, message, kind: "queue", icon: "🎫" });
              pushNotification(
                {
                  title,
                  message,
                  kind: "queue",
                  icon: "🎫",
                  href: "/queue-dashboard",
                  createdAt: Date.now(),
                  read: false,
                  meta: { source: "queue", branchId: bId },
                },
                { dedupeKey: `q:cleared:${bId}:${prevServingId}` }
              );

              unsubServing();
            }

            // changed
            if (nextServingId) {
              toastNextServingId = nextServingId;
              unsubServing();
              unsubServing = subscribeNowServing(bId, nextServingId, (ticket) => {
                if (!ticket) return;
                if (toastNextServingId && ticket.id === toastNextServingId) {
                  toastNextServingId = null;

                  const n = Number(ticket.ticketNumber || 0) || 0;
                  const title = `${label}Now serving updated`;
                  const message = n ? `Ticket #${n}` : "Now serving changed";

                  pushToast({ title, message, kind: "queue", icon: "🎫" });
                  pushNotification(
                    {
                      title,
                      message,
                      kind: "queue",
                      icon: "🎫",
                      href: "/queue-dashboard",
                      createdAt: Date.now(),
                      read: false,
                      meta: { source: "queue", branchId: bId },
                    },
                    { dedupeKey: `q:serving:${bId}:${ticket.id}` }
                  );
                }
              });
            }

            prevServingId = nextServingId;
          }
        },
        (err) => console.error(`Queue meta error (${bId}):`, err)
      );

      let waitingReady = false;
      let prevWaiting = null;
      const unsubWaiting = subscribeWaitingCount(
        bId,
        (count) => {
          const c = Number(count || 0) || 0;
          if (!waitingReady) {
            waitingReady = true;
            prevWaiting = c;
            return;
          }

          if (prevWaiting == null) prevWaiting = c;
          if (c !== prevWaiting) {
            const title = `${label}Queue updated`;
            const message = `Waiting: ${c}`;

            // toast only on increase to avoid spam
            if (c > prevWaiting) pushToast({ title, message, kind: "queue", icon: "🎫" });

            pushNotification(
              {
                title,
                message,
                kind: "queue",
                icon: "🎫",
                href: "/queue-dashboard",
                createdAt: Date.now(),
                read: false,
                meta: { source: "queue", branchId: bId },
              },
              { dedupeKey: `q:wait:${bId}:${c}` }
            );
          }
          prevWaiting = c;
        },
        (err) => console.error(`Queue waitingCount error (${bId}):`, err)
      );

      return () => {
        unsubMeta();
        unsubServing();
        unsubWaiting();
      };
    };

    // ---------------- Low-stock warnings
    const watchLowStock = async (branchesToWatch) => {
      const qtyByKey = new Map();

      // build medicine name map
      let medNameById = {};
      try {
        const meds = await listMedicines();
        medNameById = (meds || []).reduce((acc, m) => {
          acc[m.id] = m.name || m.genericName || m.id;
          return acc;
        }, {});
      } catch (e) {
        console.warn("listMedicines failed (low stock names):", e);
      }

      branchesToWatch.forEach((b) => {
        const bId = b.id;
        const bName = b.name || bId;
        const colRef = collection(db, "branches", bId, "inventory");
        let ready = false;

        const unsub = onSnapshot(
          colRef,
          (snap) => {
            if (!ready) {
              // seed map + optionally push a single summary if low items already exist
              const lows = [];
              snap.docs.forEach((d) => {
                const q = Number(d.data()?.quantity || 0) || 0;
                qtyByKey.set(`${bId}:${d.id}`, q);
                if (q <= threshold) lows.push({ id: d.id, q, data: d.data() || {} });
              });
              ready = true;

              const flagKey = `stockInit:${bId}:${threshold}`;
              if (lows.length && !hasSessionFlag(user.uid, flagKey)) {
                setSessionFlag(user.uid, flagKey);

                // keep it non-spammy: one summary notification
                const title = "Low stock detected";
                const message =
                  lows.length === 1
                    ? `${medNameById[lows[0].id] || lows[0].data?.medicineName || lows[0].id} • ${bName} • Qty ${lows[0].q}`
                    : `${bName} • ${lows.length} items at/below Qty ${threshold}`;

                pushToast({ title, message, kind: "warning", icon: "📦" });
                pushNotification(
                  {
                    title,
                    message,
                    kind: "stock",
                    icon: "📦",
                    href: "/inventory",
                    createdAt: Date.now(),
                    read: false,
                    meta: { source: "stock", branchId: bId },
                  },
                  { dedupeKey: `stock:init:${bId}:${threshold}` }
                );
              }
              return;
            }

            snap.docChanges().forEach((ch) => {
              if (ch.type === "removed") return;
              const id = ch.doc.id;
              const data = ch.doc.data() || {};
              const q = Number(data.quantity || 0) || 0;
              const key = `${bId}:${id}`;
              const prev = qtyByKey.get(key);
              qtyByKey.set(key, q);

              // trigger only when crossing threshold (or new doc)
              if ((prev == null || prev > threshold) && q <= threshold) {
                const name = medNameById[id] || data.medicineName || id;
                const title = "Low stock warning";
                const message = `${name} • ${bName} • Qty ${q}`;

                pushToast({ title, message, kind: "warning", icon: "📦" });
                pushNotification(
                  {
                    title,
                    message,
                    kind: "stock",
                    icon: "📦",
                    href: "/inventory",
                    createdAt: Date.now(),
                    read: false,
                    meta: { source: "stock", branchId: bId, medicineId: id },
                  },
                  { dedupeKey: `stock:low:${bId}:${id}:${q}` }
                );
              }
            });
          },
          (err) => console.error(`Inventory feed error (${bId}):`, err)
        );

        cleanupInvFns.push(unsub);
      });
    };

    // ---------------- Init queue + stock watchers
    (async () => {
      const branchesToWatch = await resolveBranchesToWatch();
      if (cancelled) return;

      // Queue watchers: for each branch
      branchesToWatch.forEach((b) => {
        const stop = watchQueueForBranch(b);
        cleanupQueueFns.push(stop);
      });

      // Stock watchers: same branches
      await watchLowStock(branchesToWatch);
    })();

    return () => {
      cancelled = true;
      unsubReservations();
      cleanupQueueFns.forEach((fn) => fn());
      cleanupInvFns.forEach((fn) => fn());
    };
  }, [
    loading,
    user?.uid,
    profile?.role,
    profile?.branchId,
    profile?.branchName,
    lowStockThreshold,
  ]);

  const api = useMemo(
    () => ({
      toasts,
      pushToast,
      dismissToast,

      notifications: notifs,
      pushNotification,
      markRead,
      markAllRead,
      clearNotifications,
      unreadCount,

      formatRelative,
    }),
    [
      toasts,
      pushToast,
      dismissToast,
      notifs,
      pushNotification,
      markRead,
      markAllRead,
      clearNotifications,
      unreadCount,
    ]
  );

  return <ToastCtx.Provider value={api}>{children}</ToastCtx.Provider>;
}

export function useToasts() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToasts must be used within <ToastProvider>");
  return ctx;
}
