// src/pages/ReservationsHub.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

import { listBranches, listMedicines } from "../services/inventoryService";
import {
  subscribeReservations,
  getReservationItems,
  completeReservation,
  archiveReservation,
} from "../services/reservationService";

const easeOut = [0.16, 1, 0.3, 1];

const makeMotion = (reduce) => ({
  page: {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: reduce ? 0 : 0.45,
        ease: easeOut,
        when: "beforeChildren",
        staggerChildren: reduce ? 0 : 0.06,
      },
    },
  },
  card: {
    hidden: {
      opacity: 0,
      y: reduce ? 0 : 14,
      scale: reduce ? 1 : 0.99,
      filter: reduce ? "none" : "blur(6px)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: reduce
        ? { duration: 0 }
        : { type: "spring", stiffness: 420, damping: 34, mass: 0.9 },
    },
  },
  item: {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce ? { duration: 0 } : { duration: 0.22, ease: easeOut },
    },
    exit: {
      opacity: 0,
      y: reduce ? 0 : 10,
      transition: reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut },
    },
  },
});

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts?.toDate === "function") return ts.toDate();
  if (typeof ts?.toMillis === "function") return new Date(ts.toMillis());
  return null;
}

function fmt(dt) {
  if (!dt) return "—";
  try {
    return new Intl.DateTimeFormat(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(dt);
  } catch {
    return dt.toString();
  }
}

function normStatus(s) {
  const v = String(s || "reserved").toLowerCase().trim();
  if (!v) return "reserved";
  return v;
}

function statusMeta(statusRaw, isExpired) {
  const s = normStatus(statusRaw);

  if (s === "reserved") {
    if (isExpired) return { label: "Expired", cls: "tag bad" };
    return { label: "Reserved", cls: "tag soft" };
  }
  if (s === "claimed") return { label: "Claimed", cls: "tag ok" };
  if (s === "completed") return { label: "Completed", cls: "tag ok2" };
  if (s === "archived") return { label: "Archived", cls: "tag ghost" };
  if (s === "cancelled") return { label: "Cancelled", cls: "tag bad" };
  return { label: s, cls: "tag ghost" };
}

export default function ReservationsHub() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState(""); // "" = All
  const [meds, setMeds] = useState([]);
  const medsById = useMemo(() => {
    const map = {};
    for (const mm of meds) map[mm.id] = mm;
    return map;
  }, [meds]);

  const [tab, setTab] = useState("current"); // current | completed | history
  const [search, setSearch] = useState("");

  const [rows, setRows] = useState([]); // ALL reservations list
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [selected, setSelected] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [detailsBusy, setDetailsBusy] = useState(false);

  const unsubRef = useRef(null);

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      const mm = await listMedicines();
      setBranches(b);
      setMeds(mm);
      setBranchId(""); // default: All branches
    })();
  }, []);

  // Subscribe to ALL reservations, then filter client-side by branchId
  useEffect(() => {
    try {
      if (unsubRef.current) unsubRef.current();
    } catch {
      // ignore
    }

    unsubRef.current = subscribeReservations({}, (list) => {
      setRows(list || []);
    });

    return () => {
      try {
        if (unsubRef.current) unsubRef.current();
      } catch {
        // ignore
      }
    };
  }, []);

  const selectedBranchName = useMemo(() => {
    if (!branchId) return "";
    return branches.find((b) => b.id === branchId)?.name || "";
  }, [branches, branchId]);

  const branchName = useMemo(() => {
    if (!branchId) return "All branches";
    return branches.find((b) => b.id === branchId)?.name || "Select branch";
  }, [branches, branchId]);

  // If you switch branch and selected isn't in that branch, clear details
  useEffect(() => {
    if (!selected) return;
    const selB = String(branchId || "").trim();
    if (!selB) return;
    if (String(selected.branchId || "").trim() !== selB) {
      setSelected(null);
      setSelectedItems([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId]);

  const computed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = Date.now();

    const selBranchId = String(branchId || "").trim();
    const selBranchName = String(selectedBranchName || "").trim();

    const withDerived = (rows || []).map((r) => {
      const createdAt = toDate(r.createdAt);
      const expiresAt = toDate(r.expiresAt);
      const claimedAt = toDate(r.claimedAt);
      const completedAt = toDate(r.completedAt);
      const archivedAt = toDate(r.archivedAt);

      const s = normStatus(r.status);
      const isExpired = !!expiresAt && expiresAt.getTime() < now && s === "reserved";

      // branch match: supports docs that stored branchId as ID OR as branch name
      const rBranch = String(r.branchId || "").trim();
      const matchesBranch =
        !selBranchId || rBranch === selBranchId || (selBranchName && rBranch === selBranchName);

      const hay = [r.id, r.customerName, r.customerPhone, r.qrToken, rBranch, s]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !q || hay.includes(q);

      return {
        ...r,
        _status: s,
        _createdAt: createdAt,
        _expiresAt: expiresAt,
        _claimedAt: claimedAt,
        _completedAt: completedAt,
        _archivedAt: archivedAt,
        _isExpired: isExpired,
        _matches: matchesBranch && matchesSearch,
      };
    });

    const filtered = withDerived.filter((x) => x._matches);

    const current = filtered.filter((x) => ["reserved", "claimed"].includes(x._status));
    const completed = filtered.filter((x) => x._status === "completed");
    const history = filtered.filter(
      (x) => ["archived", "cancelled"].includes(x._status) || x._isExpired
    );

    const sortByCreatedDesc = (a, b) => {
      const aa = a._createdAt?.getTime?.() || 0;
      const bb = b._createdAt?.getTime?.() || 0;
      return bb - aa;
    };

    current.sort(sortByCreatedDesc);
    completed.sort(sortByCreatedDesc);
    history.sort(sortByCreatedDesc);

    return { current, completed, history };
  }, [rows, search, branchId, selectedBranchName]);

  const visible = computed[tab] || [];
  const counts = {
    current: computed.current.length,
    completed: computed.completed.length,
    history: computed.history.length,
  };

  const selectedTotalCost = useMemo(() => {
    return (selectedItems || []).reduce((sum, it) => {
      const qty = Number(it.qty) || 0;
      const priceFromItem = Number(it.price) || 0;
      const fallback = Number(medsById[it.medicineId]?.price) || 0;
      const unit = priceFromItem || fallback;
      return sum + unit * qty;
    }, 0);
  }, [selectedItems, medsById]);

  async function openDetails(r) {
    setMsg("");
    setSelected(r);
    setSelectedItems([]);
    try {
      setDetailsBusy(true);
      const items = await getReservationItems(r.id);
      setSelectedItems(items || []);
    } catch (e) {
      setMsg(e?.message || "Failed to load reservation items.");
    } finally {
      setDetailsBusy(false);
    }
  }

  function closeDetails() {
    setSelected(null);
    setSelectedItems([]);
  }

  async function doComplete(r) {
    setMsg("");
    const ok = window.confirm(
      "Mark this reservation as COMPLETED?\n\nThis means medicines are already dispensed."
    );
    if (!ok) return;

    try {
      setBusy(true);
      await completeReservation(r.id);
      setMsg("Marked as completed ✅");
      if (selected?.id === r.id) {
        setSelected((prev) => (prev ? { ...prev, status: "completed" } : prev));
      }
    } catch (e) {
      setMsg(e?.message || "Complete failed.");
    } finally {
      setBusy(false);
    }
  }

  async function doArchive(r) {
    setMsg("");
    const ok = window.confirm("Archive this reservation?\n\nIt will move to History (Archived).");
    if (!ok) return;

    try {
      setBusy(true);
      await archiveReservation(r.id);
      setMsg("Archived ✅");
      if (selected?.id === r.id) {
        setSelected((prev) => (prev ? { ...prev, status: "archived" } : prev));
      }
    } catch (e) {
      setMsg(e?.message || "Archive failed.");
    } finally {
      setBusy(false);
    }
  }

  const isBadMsg = /fail|error|denied|invalid/i.test(String(msg || ""));

  return (
    <div className="pPage">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            <motion.button
              onClick={() => navigate(-1)}
              className="btn btnGhost"
              disabled={busy}
              whileHover={busy || reduce ? undefined : { scale: 1.02 }}
              whileTap={busy || reduce ? undefined : { scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
            >
              ← Back
            </motion.button>

            <div className="pHeaderText">
              <div className="pTitleRow">
                <div className="pTitle">Reservations Hub</div>
                <span className="pill">admin/pharmacist</span>
              </div>
              <div className="pSubtitle">Central management: Current • Completed • History (Archived)</div>
            </div>
          </div>

          <div className="pHeaderRight">
            <span className="pill pillWide">
              Branch: <b title={branchName}>{branchName}</b>
            </span>

            <div className="pillGrid" aria-label="Counts">
              <span className="pill subtle pillSmall">
                Current: <b>{counts.current}</b>
              </span>
              <span className="pill subtle pillSmall">
                Completed: <b>{counts.completed}</b>
              </span>
              <span className="pill subtle pillSmall">
                History: <b>{counts.history}</b>
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <motion.section className="card" variants={m.card}>
          <div className="cardHead">
            <div>
              <div className="cardTitle">Filters</div>
              <div className="cardHint">Branch, search, and category tabs</div>
            </div>
          </div>

          <div className="controls">
            <div className="row2">
              <div className="field">
                <label className="label">Branch</label>
                <select
                  className="control"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={busy}
                >
                  <option value="">All branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label className="label">Search</label>
                <input
                  className="control"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Customer / phone / token / status..."
                  disabled={busy}
                />
              </div>
            </div>

            {/* ✅ Tabs: Safari-safe + no clipping + synchronized theme transitions */}
            <div className="tabs" role="tablist" aria-label="Reservation tabs">
              <button
                type="button"
                className={`tab ${tab === "current" ? "on" : ""}`}
                onClick={() => setTab("current")}
                role="tab"
                aria-selected={tab === "current"}
              >
                <span className="tabLabel">Current</span>
                <span className="tabCount" aria-label={`${counts.current} current`}>
                  {counts.current}
                </span>
              </button>

              <button
                type="button"
                className={`tab ${tab === "completed" ? "on" : ""}`}
                onClick={() => setTab("completed")}
                role="tab"
                aria-selected={tab === "completed"}
              >
                <span className="tabLabel">Completed</span>
                <span className="tabCount" aria-label={`${counts.completed} completed`}>
                  {counts.completed}
                </span>
              </button>

              <button
                type="button"
                className={`tab ${tab === "history" ? "on" : ""}`}
                onClick={() => setTab("history")}
                role="tab"
                aria-selected={tab === "history"}
              >
                <span className="tabLabel">History</span>
                <span className="tabCount" aria-label={`${counts.history} history`}>
                  {counts.history}
                </span>
              </button>
            </div>
          </div>
        </motion.section>

        {/* List + Detail */}
        <div className="grid2">
          {/* LIST */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">
                  {tab === "current" ? "Current Reservations" : tab === "completed" ? "Completed" : "History"}
                </div>
                <div className="cardHint">Tap a row to view details.</div>
              </div>

              <div className="miniPills">
                <span className="chip">{visible.length} shown</span>
              </div>
            </div>

            {visible.length === 0 ? (
              <div className="empty">No reservations found for this tab. Try another branch or search keyword.</div>
            ) : (
              <div className="list">
                <AnimatePresence initial={false}>
                  {visible.slice(0, 200).map((r) => {
                    const meta = statusMeta(r._status, r._isExpired);
                    return (
                      <motion.button
                        key={r.id}
                        type="button"
                        className="rowBtn"
                        onClick={() => openDetails(r)}
                        disabled={busy}
                        variants={m.item}
                        initial="hidden"
                        animate="show"
                        exit="exit"
                        whileHover={busy || reduce ? undefined : { y: -1, scale: 1.01 }}
                        whileTap={busy || reduce ? undefined : { scale: 0.985 }}
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 34 }}
                      >
                        <div className="rowMain">
                          <div className="rowTop">
                            <div className="rowName">
                              {r.customerName || "Unknown customer"}
                              {r.customerPhone ? <span className="rowPhone"> • {r.customerPhone}</span> : null}
                            </div>
                            <span className={meta.cls}>{meta.label}</span>
                          </div>

                          <div className="rowSub">
                            <span className="mono">Token: {r.qrToken || "—"}</span>
                            <span className="dot">•</span>
                            Qty: <b>{r.totalQty ?? "—"}</b>
                            <span className="dot">•</span>
                            Created: <b>{fmt(r._createdAt)}</b>
                            {r._expiresAt ? (
                              <>
                                <span className="dot">•</span>
                                Expires: <b>{fmt(r._expiresAt)}</b>
                              </>
                            ) : null}
                          </div>
                        </div>

                        <div className="rowRight">
                          <div className="rowGo">Open</div>
                          <div className="rowArrow">→</div>
                        </div>
                      </motion.button>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}

            <AnimatePresence initial={false}>
              {msg ? (
                <motion.div
                  key={msg}
                  className={`toast ${isBadMsg ? "bad" : "ok"}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {msg}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.section>

          {/* DETAIL */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Details</div>
                <div className="cardHint">Select a reservation from the list</div>
              </div>

              {selected ? (
                <div className="miniPills">
                  <span className="chip chipSoft">{selected.branchId || "—"}</span>
                </div>
              ) : null}
            </div>

            {!selected ? (
              <div className="empty">
                No reservation selected yet.
                <br />
                Pick one from the left list to view items and actions.
              </div>
            ) : (
              <div className="stack">
                <div className="detailBox">
                  {(() => {
                    const meta = statusMeta(selected.status, selected._isExpired);
                    return (
                      <div className="detailRow">
                        <span className="k">Status</span>
                        <span className={meta.cls}>{meta.label}</span>
                      </div>
                    );
                  })()}

                  <div className="detailRow">
                    <span className="k">Customer</span>
                    <span className="v">{selected.customerName || "—"}</span>
                  </div>

                  <div className="detailRow">
                    <span className="k">Phone</span>
                    <span className="v">{selected.customerPhone || "—"}</span>
                  </div>

                  <div className="detailRow">
                    <span className="k">Token</span>
                    <span className="vMono">{selected.qrToken || "—"}</span>
                  </div>

                  <div className="detailRow">
                    <span className="k">Total Qty</span>
                    <span className="v">{selected.totalQty ?? "—"}</span>
                  </div>

                  <div className="detailRow">
                    <span className="k">Created</span>
                    <span className="v">{fmt(toDate(selected.createdAt) || selected._createdAt)}</span>
                  </div>

                  {selected.expiresAt ? (
                    <div className="detailRow">
                      <span className="k">Expires</span>
                      <span className="v">{fmt(toDate(selected.expiresAt) || selected._expiresAt)}</span>
                    </div>
                  ) : null}

                  {selected.claimedAt ? (
                    <div className="detailRow">
                      <span className="k">Claimed</span>
                      <span className="v">{fmt(toDate(selected.claimedAt) || selected._claimedAt)}</span>
                    </div>
                  ) : null}

                  {selected.completedAt ? (
                    <div className="detailRow">
                      <span className="k">Completed</span>
                      <span className="v">{fmt(toDate(selected.completedAt) || selected._completedAt)}</span>
                    </div>
                  ) : null}

                  {selected.archivedAt ? (
                    <div className="detailRow">
                      <span className="k">Archived</span>
                      <span className="v">{fmt(toDate(selected.archivedAt) || selected._archivedAt)}</span>
                    </div>
                  ) : null}

                  <div className="detailRow">
                    <span className="k">Est. Total</span>
                    <span className="v">₱{selectedTotalCost.toFixed(2)}</span>
                  </div>
                </div>

                <div className="btnRow">
                  <motion.button
                    className="btn btnPrimary"
                    onClick={() => doComplete(selected)}
                    disabled={busy || ["completed", "archived"].includes(normStatus(selected.status))}
                    whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                    whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                  >
                    Mark Completed
                  </motion.button>

                  <motion.button
                    className="btn btnWarn"
                    onClick={() => doArchive(selected)}
                    disabled={busy || normStatus(selected.status) === "archived"}
                    whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                    whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                  >
                    Archive
                  </motion.button>

                  <motion.button
                    className="btn btnGhost"
                    onClick={closeDetails}
                    disabled={busy}
                    whileHover={busy || reduce ? undefined : { scale: 1.02 }}
                    whileTap={busy || reduce ? undefined : { scale: 0.98 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 32 }}
                  >
                    Clear
                  </motion.button>
                </div>

                <div className="divider" />

                <div className="sectionTitle">Items</div>

                {detailsBusy ? (
                  <div className="empty">Loading items…</div>
                ) : selectedItems.length === 0 ? (
                  <div className="empty">No items found for this reservation.</div>
                ) : (
                  <div className="itemsBox">
                    {selectedItems.map((it) => {
                      const qty = Number(it.qty) || 0;
                      const priceFromItem = Number(it.price) || 0;
                      const fallback = Number(medsById[it.medicineId]?.price) || 0;
                      const unit = priceFromItem || fallback;
                      const lineTotal = unit * qty;

                      const niceName =
                        (it.medicineName || "").trim() ||
                        medsById[it.medicineId]?.name ||
                        medsById[it.medicineId]?.genericName ||
                        "Medicine";

                      const subParts = [];
                      const m0 = medsById[it.medicineId];
                      if (m0?.genericName) subParts.push(m0.genericName);
                      const fs = [m0?.form, m0?.strength].filter(Boolean).join(" / ");
                      if (fs) subParts.push(fs);

                      return (
                        <div key={it.id} className="itemRow">
                          <div className="itemLeft">
                            <div className="itemName">{niceName}</div>
                            <div className="itemSub">{subParts.length ? subParts.join(" • ") : it.medicineId}</div>
                          </div>

                          <div className="itemRight">
                            <div className="qty">x{qty}</div>
                            <div className="price">
                              ₱{unit.toFixed(2)}
                              <span className="dot">•</span>
                              Line: ₱{lineTotal.toFixed(2)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   ReservationsHub Palette (improved contrast + consistent dark surfaces)
   NOTE: We keep .pPage background transparent so it matches your global theme background,
   and to keep theme transitions perfectly synced.
========================= */

*{ box-sizing:border-box; }

.pPage{
  /* sync with your global theme-switching duration/ease */
  --theme-dur: 260ms;
  --theme-ease: cubic-bezier(0.16, 1, 0.3, 1);

  /* Light palette */
  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --stroke: rgba(226,232,240,.95);
  --stroke2: rgba(203,213,225,.95);

  --surface-0: rgba(255,255,255,.86); /* cards */
  --surface-1: rgba(255,255,255,.94); /* inputs/rows */
  --surface-2: rgba(248,250,252,.96); /* subtle chips/empty */

  --primary:#2563eb;
  --primary-soft: rgba(37,99,235,.12);

  --ok-bg:#ecfdf5;
  --ok-stroke:#a7f3d0;
  --ok-ink:#065f46;

  --ok2-bg:#eff6ff;
  --ok2-stroke:#bfdbfe;
  --ok2-ink:#1d4ed8;

  --bad-bg:#fef2f2;
  --bad-stroke:#fecaca;
  --bad-ink:#991b1b;

  --warn-bg:#fff7ed;
  --warn-stroke:#fed7aa;
  --warn-ink:#9a3412;

  --shadow: 0 18px 40px rgba(15,23,42,.10);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.08);

  min-height:100vh;
  width:100%;
  padding: clamp(14px, 3vw, 32px);
  padding-top: 36px;
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);

  /* ✅ keep consistent with global background + synced transitions */
  background: transparent;
  -webkit-text-size-adjust: 100%;
}

/* Dark palette (better contrast) */
[data-theme="dark"] .pPage{
  --ink:#e5e7eb;
  --muted: rgba(148,163,184,.92);
  --muted2: rgba(203,213,225,.92);

  --stroke: rgba(51,65,85,.78);
  --stroke2: rgba(71,85,105,.78);

  --surface-0: rgba(15,23,42,.84);
  --surface-1: rgba(2,6,23,.46);
  --surface-2: rgba(2,6,23,.62);

  --primary:#3b82f6;
  --primary-soft: rgba(59,130,246,.18);

  --ok-bg: rgba(16,185,129,.14);
  --ok-stroke: rgba(16,185,129,.38);
  --ok-ink: #6ee7b7;

  --ok2-bg: rgba(59,130,246,.16);
  --ok2-stroke: rgba(59,130,246,.42);
  --ok2-ink: #93c5fd;

  --bad-bg: rgba(239,68,68,.14);
  --bad-stroke: rgba(239,68,68,.40);
  --bad-ink: #fca5a5;

  --warn-bg: rgba(245,158,11,.14);
  --warn-stroke: rgba(245,158,11,.40);
  --warn-ink: #fdba74;

  --shadow: 0 18px 40px rgba(0,0,0,.44);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.30);
}

/* ✅ Extra safety: if your global index.css isn't applied, this keeps transitions synced */
html.theme-switching .pPage,
html.theme-switching .pPage *{
  transition-duration: var(--theme-dur) !important;
  transition-timing-function: var(--theme-ease) !important;
  transition-property:
    background-color,
    color,
    border-color,
    box-shadow,
    outline-color,
    text-decoration-color,
    fill,
    stroke,
    opacity !important;
}

.pShell{
  max-width: 1200px;
  margin: 0 auto;
  display:grid;
  gap: 16px;
}

/* header */
.pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--stroke);
}
.pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
  min-width:0;
}
.pHeaderText{ min-width: 240px; display:grid; gap: 6px; min-width:0; }
.pTitleRow{ display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
.pTitle{ font-size: 22px; font-weight: 950; letter-spacing: -0.2px; }
.pSubtitle{ font-size: 13px; color: var(--muted2); font-weight: 750; line-height: 1.45; }

.pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap:wrap;
  justify-content:flex-end;
  min-width: 0;
}
.pillGrid{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content:flex-end;
  min-width: 0;
}

.pill{
  font-size:12px;
  font-weight:950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  text-transform: capitalize;
  white-space: nowrap;
  display:inline-flex;
  align-items:center;
  gap: 6px;
}
.pill b{
  display:inline-block;
  min-width:0;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  max-width: 22ch;
}
.pill.subtle{
  background-color: var(--surface-2);
  color: var(--muted2);
}
.pillWide{ max-width: 100%; }
.pillSmall b{ max-width: 10ch; }

/* MOBILE header cleanup */
@media (max-width: 520px){
  .pPage{ padding: 14px; padding-top: 26px; }
  .pHeader{ gap: 10px; }
  .pHeaderLeft{ width: 100%; }
  .pHeaderText{ min-width: 0; width: 1fr; }
  .pTitle{ font-size: 19px; }
  .pSubtitle{ font-size: 12px; }

  .pHeaderRight{
    width: 100%;
    justify-content: flex-start;
    gap: 8px;
  }

  .pill{
    padding: 6px 9px;
    font-size: 11px;
    box-shadow: none;
  }

  .pillWide{
    width: 100%;
    justify-content: space-between;
  }
  .pillWide b{ max-width: 18ch; }

  .pillGrid{
    width: 100%;
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .pillGrid .pill{
    width: 100%;
    justify-content: space-between;
  }
  .pillGrid .pill b{
    max-width: 6ch;
    text-align:right;
  }
}

/* layout */
.grid2{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  align-items:start;
}
@media (max-width: 520px){
  .grid2{ grid-template-columns: 1fr; }
}

/* card */
.card{
  min-width: 0;
  background-color: var(--surface-0);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(8px);
}
@media (max-width: 520px){
  .card{ padding: 14px; border-radius: 16px; }
}
.cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap:wrap;
}
.cardTitle{ font-size: 16px; font-weight: 950; }
.cardHint{ font-size: 12px; color: var(--muted); font-weight: 750; }

/* controls */
.controls{ display:grid; gap: 12px; }
.row2{
  display:grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
@media (max-width: 560px){
  .row2{ grid-template-columns: 1fr; }
}

.field{ display:grid; gap: 6px; min-width:0; }
.label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.control{
  height: 42px;
  width: 100%;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background-color: var(--surface-1);
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
  min-width:0;
}
.control:focus{
  border-color: rgba(147,197,253,.75);
  box-shadow: 0 0 0 4px rgba(37,99,235,.14);
}
[data-theme="dark"] .control:focus{
  border-color: rgba(59,130,246,.65);
  box-shadow: 0 0 0 4px rgba(59,130,246,.18);
}
.control::placeholder{
  font-size: 12px;
  font-weight: 800;
  color: rgba(148,163,184,.95);
}

/* =========================
   Tabs (FIX: no clipping on mobile)
   - flex-shrink:0 + white-space:nowrap for label & badge
   - grid 3 columns on iPhone Safari so it stays perfectly horizontal
========================= */
.tabs{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  width: 100%;
}

.tab{
  -webkit-appearance: none;
  appearance: none;

  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  color: var(--ink);

  border-radius: 999px;
  padding: 10px 12px;

  font-weight: 950;
  font-size: 13px;

  cursor:pointer;

  display:flex;
  align-items:center;
  justify-content:center;
  gap: 8px;

  /* ✅ keeps everything on one line, prevents Safari shrink-clipping */
  white-space: nowrap;
  min-width: 0;
}

.tabLabel{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  flex-shrink: 0;       /* ✅ requested */
  white-space: nowrap;  /* ✅ requested */
}

.tab.on{
  border-color: rgba(147,197,253,.75);
  background-color: var(--primary-soft);
  color: var(--primary);
}

.tabCount{
  display:inline-flex;
  align-items:center;
  justify-content:center;

  flex-shrink: 0;       /* ✅ requested */
  white-space: nowrap;  /* ✅ requested */

  height: 22px;
  min-width: 28px;
  padding: 0 8px;

  border-radius: 999px;

  font-size: 12px;
  font-weight: 950;
  line-height: 1;

  border: 1px solid var(--stroke2);
  background-color: var(--surface-2);
  color: var(--ink);
}

/* iPhone Safari: force perfect horizontal */
@media (max-width: 520px){
  .tabs{
    display:grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .tab{
    width: 100%;
    padding: 10px 8px;
    font-size: 12px;
    gap: 6px;
  }
  .tabLabel{
    font-size: 12px;
    letter-spacing: -0.1px;
  }
  .tabCount{
    height: 20px;
    min-width: 24px;
    padding: 0 6px;
    font-size: 11px;
  }
}

/* list */
.list{
  display:grid;
  gap: 10px;
  max-height: 560px;
  overflow:auto;
  padding-right: 4px;
  -webkit-overflow-scrolling: touch;
}
@media (max-width: 520px){
  .list{ max-height: 62vh; }
}
.rowBtn{
  width: 100%;
  text-align:left;
  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  border-radius: 16px;
  padding: 12px;
  cursor: pointer;
  display:flex;
  justify-content:space-between;
  gap: 10px;
  align-items:center;
  min-width: 0;
}
.rowBtn:disabled{ opacity:.7; cursor:not-allowed; }
@media (max-width: 520px){
  .rowBtn{ padding: 11px; gap: 8px; }
}
.rowMain{ min-width:0; display:grid; gap: 6px; flex: 1 1 auto; }
.rowTop{
  display:flex;
  gap: 10px;
  align-items:center;
  justify-content:space-between;
  min-width: 0;
}
.rowName{
  font-weight: 950;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
  min-width:0;
  max-width: 100%;
}
.rowPhone{ color: var(--muted); font-weight: 850; }
.rowSub{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
}
.mono{ font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 900; }
.dot{ margin: 0 6px; color: rgba(148,163,184,.8); }

/* right-side */
.rowRight{
  flex: 0 0 auto;
  display:flex;
  align-items:center;
  gap: 6px;
  min-width: 0;
}
.rowGo{
  font-weight: 950;
  color: var(--primary);
  font-size: 13px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(147,197,253,.55);
  background-color: var(--primary-soft);
  white-space: nowrap;
}
.rowArrow{ font-weight: 950; color: var(--primary); }
@media (max-width: 520px){
  .rowGo{ padding: 6px 9px; font-size: 12px; }
}

/* tags */
.tag{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background-color: var(--surface-2);
  color: var(--ink);
  white-space:nowrap;
  flex: 0 0 auto;
}
.tag.soft{
  border-color: rgba(147,197,253,.55);
  background-color: var(--primary-soft);
  color: var(--primary);
}
.tag.ok{ border-color: var(--ok-stroke); background-color: var(--ok-bg); color: var(--ok-ink); }
.tag.ok2{ border-color: var(--ok2-stroke); background-color: var(--ok2-bg); color: var(--ok2-ink); }
.tag.bad{ border-color: var(--bad-stroke); background-color: var(--bad-bg); color: var(--bad-ink); }
.tag.ghost{
  border-color: var(--stroke);
  background-color: rgba(148,163,184,.10);
  color: var(--muted2);
}
[data-theme="dark"] .tag.ghost{
  background-color: rgba(148,163,184,.08);
  border-color: var(--stroke);
}

/* buttons */
.btn{
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space: nowrap;
}
.btn:disabled{ opacity:.7; cursor:not-allowed; }
.btnGhost{ background-color: var(--surface-1); }
.btnPrimary{
  border: 0;
  background-color: var(--primary);
  color:#fff;
  box-shadow: 0 10px 18px rgba(37,99,235,.18);
}
[data-theme="dark"] .btnPrimary{
  box-shadow: 0 12px 22px rgba(59,130,246,.20);
}
.btnWarn{
  border-color: var(--warn-stroke);
  background-color: var(--warn-bg);
  color: var(--warn-ink);
}

/* responsive action buttons */
.btnRow{
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
}
@media (max-width: 520px){
  .btnRow{
    display:grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .btnRow .btn{ width: 100%; }
}

.stack{ display:grid; gap: 12px; }
.divider{ height: 1px; background-color: var(--stroke); }

.detailBox{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  background-color: var(--surface-1);
  padding: 12px;
  display:grid;
  gap: 8px;
}
.detailRow{
  display:flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}
.k{ font-size: 12px; color: var(--muted); font-weight: 900; }
.v{ font-size: 13px; font-weight: 950; }
.vMono{
  font-size: 12px;
  font-weight: 950;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  word-break: break-all;
}

.sectionTitle{
  font-size: 12px;
  font-weight: 950;
  color: var(--muted2);
}

.itemsBox{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  background-color: var(--surface-1);
  overflow: hidden;
}
.itemRow{
  display:flex;
  justify-content: space-between;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--stroke);
  align-items: center;
}
.itemLeft{ display:grid; gap: 4px; min-width: 0; }
.itemName{
  font-weight: 950;
  line-height: 1.2;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.itemSub{
  font-size: 12px;
  color: var(--muted);
  font-weight: 850;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}
.itemRight{
  display:grid;
  justify-items: end;
  gap: 2px;
}
.qty{ font-weight: 950; }
.price{ font-size: 12px; color: var(--muted2); font-weight: 950; }

/* toast + empty */
.toast{
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid;
  font-size: 13px;
  font-weight: 950;
}
.toast.ok{ background-color: var(--ok-bg); border-color: var(--ok-stroke); color: var(--ok-ink); }
.toast.bad{ background-color: var(--bad-bg); border-color: var(--bad-stroke); color: var(--bad-ink); }

.empty{
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background-color: var(--surface-2);
  color: var(--muted);
  font-weight: 950;
  text-align: center;
}

.miniPills{ display:flex; gap: 8px; flex-wrap: wrap; justify-content:flex-end; }
.chip{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background-color: var(--surface-1);
  color: var(--ink);
  white-space: nowrap;
}
.chipSoft{
  background-color: var(--surface-2);
  color: var(--muted2);
}
`;
