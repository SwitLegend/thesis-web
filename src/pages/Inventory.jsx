// src/pages/Inventory.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  listBranches,
  listMedicines,
  listInventoryForBranch, // ✅ FIX (was listInventoryByBranch)
  setInventoryQuantity,
  deleteInventoryItem,
  deleteMedicineEverywhere,
} from "../services/inventoryService";

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
        staggerChildren: reduce ? 0 : 0.08,
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
  row: {
    hidden: { opacity: 0, y: reduce ? 0 : 8 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { duration: 0.22, ease: easeOut, delay: Math.min(i * 0.015, 0.18) },
    }),
    exit: {
      opacity: 0,
      y: reduce ? 0 : 8,
      transition: reduce ? { duration: 0 } : { duration: 0.16, ease: easeOut },
    },
  },
});

export default function Inventory() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const [branches, setBranches] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [invMap, setInvMap] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const [search, setSearch] = useState("");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState(10);

  useEffect(() => {
    (async () => {
      try {
        const b = await listBranches();
        const m2 = await listMedicines();
        setBranches(b);
        setMedicines(m2);
        if (b.length) setBranchId(b[0].id);
      } catch (e) {
        setMsg(e?.message || "Failed to load branches/medicines.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!branchId) return;

    (async () => {
      try {
        const invRows = await listInventoryForBranch(branchId); // ✅ FIX
        const map = {};
        for (const r of invRows) map[r.medicineId] = Number(r.quantity) || 0;
        setInvMap(map);
      } catch (e) {
        setMsg(e?.message || "Failed to load inventory for branch.");
      }
    })();
  }, [branchId]);

  const rows = useMemo(() => {
    const mapped = medicines.map((m2) => ({
      ...m2,
      quantity: invMap[m2.id] ?? 0,
    }));

    const q = search.trim().toLowerCase();
    let out = mapped;

    if (q) {
      out = out.filter((m2) => {
        const hay = `${m2.name || ""} ${m2.genericName || ""} ${m2.form || ""} ${m2.strength || ""}`.toLowerCase();
        return hay.includes(q);
      });
    }

    if (onlyLowStock) {
      const t = Number(lowStockThreshold) || 0;
      out = out.filter((m2) => (Number(m2.quantity) || 0) <= t);
    }

    return out;
  }, [medicines, invMap, search, onlyLowStock, lowStockThreshold]);

  async function updateQty(medicineId, newQty) {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    try {
      setBusy(true);
      await setInventoryQuantity({ branchId, medicineId, quantity: newQty });
      setInvMap((prev) => ({ ...prev, [medicineId]: Number(newQty) || 0 }));
      setMsg("Saved ✅");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Update failed. Check console.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteStock(medicineId) {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    const ok = window.confirm("Remove this stock record for this branch?");
    if (!ok) return;

    try {
      setBusy(true);
      await deleteInventoryItem({ branchId, medicineId });
      setInvMap((prev) => {
        const copy = { ...prev };
        delete copy[medicineId];
        return copy;
      });
      setMsg("Stock removed ✅");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Delete failed. Check console.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteMedicine(medicineId) {
    setMsg("");
    const ok = window.confirm(
      "Delete this medicine from master list?\n\nThis removes it from ALL branches too."
    );
    if (!ok) return;

    try {
      setBusy(true);
      await deleteMedicineEverywhere(medicineId);

      setMedicines((prev) => prev.filter((m2) => m2.id !== medicineId));
      setInvMap((prev) => {
        const copy = { ...prev };
        delete copy[medicineId];
        return copy;
      });

      setMsg("Medicine deleted ✅");
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Delete failed. Check console.");
    } finally {
      setBusy(false);
    }
  }

  const selectedBranch = branches.find((b) => b.id === branchId);
  const shown = rows.length;

  const isBadMsg =
    String(msg || "").toLowerCase().includes("failed") ||
    String(msg || "").toLowerCase().includes("error");

  return (
    <div className="pPage inventoryPage">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            <motion.button
              className="btn btnGhost"
              onClick={() => navigate(-1)}
              whileHover={busy ? undefined : reduce ? undefined : { scale: 1.02 }}
              whileTap={busy ? undefined : reduce ? undefined : { scale: 0.98 }}
              transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
              disabled={busy}
              aria-label="Go back"
              title="Back"
            >
              ← Back
            </motion.button>

            <div className="pHeaderText">
              <div className="pTitle">Inventory</div>
              <div className="pSubtitle">
                {selectedBranch ? selectedBranch.name : "Select a branch"} • {shown} item(s)
              </div>
            </div>
          </div>

          <div className="pHeaderRight">
            <span className="pill">{profile?.role || "user"}</span>
            {onlyLowStock ? <span className="pill pillWarn">Low stock</span> : null}
          </div>
        </div>

        {/* Layout */}
        <div className="invGrid">
          {/* Left: Filters */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Filters</div>
                <div className="cardHint">Find items quickly</div>
              </div>
            </div>

            <div className="cardBody">
              <div className="field">
                <label className="label">Branch</label>
                <select className="control" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
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
                  placeholder="Name, generic, form, strength…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="miniCard">
                <div className="miniTitle">Low stock</div>

                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={onlyLowStock}
                    onChange={(e) => setOnlyLowStock(e.target.checked)}
                  />
                  Show only low stock
                </label>

                <div className="miniRow">
                  <div className="field fieldTight">
                    <label className="label">Threshold</label>
                    <input
                      className="control"
                      type="number"
                      min="0"
                      value={lowStockThreshold}
                      onChange={(e) => setLowStockThreshold(e.target.value)}
                      inputMode="numeric"
                    />
                  </div>

                  <div className="stat">
                    <div className="statLabel">Shown</div>
                    <div className="statValue">{shown}</div>
                  </div>
                </div>
              </div>

              <AnimatePresence mode="popLayout" initial={false}>
                {msg ? (
                  <motion.div
                    key={msg}
                    className={isBadMsg ? "alert bad" : "alert ok"}
                    initial={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
                    layout
                  >
                    {msg}
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="hintBox">
                <b>Tip:</b> Use <b>Save</b> to set exact quantity.
                <br />
                <b>Delete Stock</b> removes this item only for the selected branch.
                {isAdmin ? (
                  <>
                    <br />
                    <b>Delete Medicine</b> removes it from all branches.
                  </>
                ) : null}
              </div>
            </div>
          </motion.section>

          {/* Right: Stock table */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead cardHeadRow">
              <div>
                <div className="cardTitle">Stock</div>
                <div className="cardHint">Scroll inside the list</div>
              </div>

              <div className="cardRight">
                <span className="pill subtle">{shown} row(s)</span>
              </div>
            </div>

            <div className="tableShell">
              <div className="tableHead">
                <div>Medicine</div>
                <div className="hideSm">Form</div>
                <div className="hideSm">Strength</div>
                <div className="num">Price</div>
                <div className="num">Qty</div>
                <div className="num">Actions</div>
              </div>

              <div className="tableBody">
                <AnimatePresence initial={false}>
                  {rows.map((med, idx) => (
                    <motion.div
                      key={med.id}
                      variants={m.row}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                      custom={idx}
                    >
                      <Row
                        med={med}
                        disabled={busy}
                        lowThreshold={Number(lowStockThreshold) || 0}
                        canDeleteMedicine={isAdmin}
                        onUpdate={updateQty}
                        onDeleteStock={handleDeleteStock}
                        onDeleteMedicine={handleDeleteMedicine}
                        reduceMotion={!!reduce}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>

                {rows.length === 0 ? (
                  <div className="empty">No items found. Try changing branch or search.</div>
                ) : null}
              </div>
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

function Row({
  med,
  disabled,
  lowThreshold,
  canDeleteMedicine,
  onUpdate,
  onDeleteStock,
  onDeleteMedicine,
  reduceMotion,
}) {
  const [val, setVal] = useState(med.quantity);

  useEffect(() => {
    setVal(med.quantity);
  }, [med.quantity]);

  const qty = Number(med.quantity) || 0;
  const low = qty <= (Number(lowThreshold) || 0);

  const btnAnim = reduceMotion
    ? {}
    : {
        whileHover: { scale: 1.03 },
        whileTap: { scale: 0.98 },
        transition: { type: "spring", stiffness: 520, damping: 26 },
      };

  return (
    <div className="tRow">
      <div className="cellMain">
        <div className="mTitle">
          <span className="mTitleText">{med.name}</span>
          {low ? <span className="badgeLow">LOW</span> : null}
        </div>

        <div className="mSub">
          {med.genericName || "—"} <span className="dot">•</span>{" "}
          <span className="muted">
            {med.form || "—"} / {med.strength || "—"}
          </span>
        </div>
      </div>

      <div className="hideSm">{med.form || "—"}</div>
      <div className="hideSm">{med.strength || "—"}</div>

      <div className="num">₱{Number(med.price || 0).toFixed(2)}</div>
      <div className="num qtyStrong">{qty}</div>

      <div className="actions">
        <input
          className="qtyInput"
          type="number"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          disabled={disabled}
          inputMode="numeric"
        />

        <motion.button className="btn btnPrimary" onClick={() => onUpdate(med.id, val)} disabled={disabled} {...btnAnim}>
          Save
        </motion.button>

        <motion.button
          className="btn btnSoftDanger btnFixed"
          onClick={() => onDeleteStock(med.id)}
          disabled={disabled}
          title="Remove stock record for this branch"
          {...btnAnim}
        >
          Delete Stock
        </motion.button>

        {canDeleteMedicine ? (
          <motion.button
            className="btn btnHardDanger btnFixed"
            onClick={() => onDeleteMedicine(med.id)}
            disabled={disabled}
            title="Delete medicine from master list (all branches)"
            {...btnAnim}
          >
            Delete Medicine
          </motion.button>
        ) : null}
      </div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Tokens (NO global :root)
========================= */
.inventoryPage{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --surface: rgba(255,255,255,.94);
  --surface2: rgba(248,250,252,.95);
  --surface3: rgba(241,245,249,.92);

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --divider: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --success-bg:#ecfdf5;
  --success-stroke:#a7f3d0;
  --success-ink:#065f46;

  --danger-bg:#fef2f2;
  --danger-stroke:#fecaca;
  --danger-ink:#991b1b;

  --warn-bg:#fff7ed;
  --warn-stroke:#fed7aa;
  --warn-ink:#9a3412;

  --pill-bg: var(--surface);
  --pill-ink:#334155;

  --btn-bg: var(--surface);

  --tableHead-bg: var(--surface2);
  --tableHead-ink: #334155;
  --tableBody-bg: var(--surface);
  --row-bg: var(--surface);
  --row-hover: var(--surface2);

  --radius: 18px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .inventoryPage{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --surface: rgba(15,23,42,.70);
  --surface2: rgba(15,23,42,.55);
  --surface3: rgba(2,6,23,.55);

  --stroke:#1f2937;
  --stroke2:#334155;
  --divider: rgba(148,163,184,.22);

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);

  --success-bg: rgba(16,185,129,.12);
  --success-stroke: rgba(16,185,129,.35);
  --success-ink:#6ee7b7;

  --danger-bg: rgba(239,68,68,.12);
  --danger-stroke: rgba(239,68,68,.35);
  --danger-ink:#fca5a5;

  --warn-bg: rgba(245,158,11,.12);
  --warn-stroke: rgba(245,158,11,.35);
  --warn-ink:#fdba74;

  --pill-bg: var(--surface2);
  --pill-ink: var(--muted2);

  --btn-bg: var(--surface);

  --tableHead-bg: rgba(15,23,42,.62);
  --tableHead-ink: var(--muted2);
  --tableBody-bg: rgba(15,23,42,.58);
  --row-bg: rgba(15,23,42,.62);
  --row-hover: rgba(15,23,42,.72);

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.inventoryPage *{ box-sizing:border-box; }

/* =========================
   Page Layout
========================= */
.inventoryPage.pPage{
  min-height: 100vh;
  width: 100%;
  padding: clamp(16px, 3vw, 32px);
  padding-top: 40px;
  display:flex;
  justify-content:center;
  align-items:flex-start;

  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);

  background:
    radial-gradient(1100px 520px at 14% 8%, #eef2ff 0%, rgba(238,242,255,0) 60%),
    radial-gradient(900px 520px at 90% 20%, #eff6ff 0%, rgba(239,246,255,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}
[data-theme="dark"] .inventoryPage.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.inventoryPage .pShell{
  width: min(1400px, 100%);
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.inventoryPage .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;

  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}
.inventoryPage .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}
.inventoryPage .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 4px;
}
.inventoryPage .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}
.inventoryPage .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}
.inventoryPage .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 8px;
  flex-wrap: wrap;
}

/* =========================
   Buttons / Pills
========================= */
.inventoryPage .btn{
  height: 40px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: var(--btn-bg);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space: nowrap;
}
.inventoryPage .btn:disabled{ opacity: .7; cursor:not-allowed; }

.inventoryPage .btnGhost{
  background: var(--surface);
  border-color: var(--stroke);
}

.inventoryPage .btnPrimary{
  border: 1px solid rgba(37,99,235,.18);
  background: linear-gradient(180deg, #2f6cf2, var(--primary));
  color:#fff;
  box-shadow: 0 14px 26px rgba(37,99,235,.18);
}
[data-theme="dark"] .inventoryPage .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

.inventoryPage .btnSoftDanger{
  background: var(--surface);
  color: var(--danger-ink);
  border-color: var(--danger-stroke);
}

.inventoryPage .btnHardDanger{
  background: var(--surface);
  color: var(--danger-ink);
  border-color: color-mix(in srgb, var(--danger-stroke) 75%, var(--stroke));
}

.inventoryPage .btnFixed{ min-width: 140px; }

.inventoryPage .pill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--pill-bg);
  color: var(--pill-ink);
  box-shadow: var(--shadow-sm);
  text-transform: capitalize;
}
.inventoryPage .pill.subtle{
  background: var(--surface2);
  color: var(--muted2);
}
.inventoryPage .pillWarn{
  border-color: var(--warn-stroke);
  background: var(--warn-bg);
  color: var(--warn-ink);
}

/* =========================
   Cards / Grid
========================= */
.inventoryPage .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
}
.inventoryPage .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap:wrap;
}
.inventoryPage .cardHeadRow{ align-items:flex-start; }
.inventoryPage .cardTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}
.inventoryPage .cardHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 4px;
}
.inventoryPage .cardRight{
  display:flex;
  align-items:center;
  gap: 10px;
}
.inventoryPage .cardBody{
  display:grid;
  gap: 12px;
}

.inventoryPage .invGrid{
  display:grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  align-items:start;
}
@media (max-width: 980px){
  .inventoryPage .invGrid{ grid-template-columns: 1fr; }
}

/* =========================
   Inputs / Controls
========================= */
.inventoryPage .field{ display:grid; gap: 6px; min-width: 0; }
.inventoryPage .fieldTight{ margin: 0; }
.inventoryPage .label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.inventoryPage .control{
  height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline:none;
  background: var(--surface);
  font-size: 14px;
  font-weight: 750;
  color: var(--ink);
  width: 100%;
  min-width: 0;
  max-width: 100%;
}
.inventoryPage .control:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

/* =========================
   Mini Card
========================= */
.inventoryPage .miniCard{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  padding: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  display:grid;
  gap: 10px;
}
.inventoryPage .miniTitle{
  font-size: 12px;
  font-weight: 950;
  color: var(--pill-ink);
}

.inventoryPage .checkRow{
  display:flex;
  gap: 10px;
  align-items:center;
  font-size: 13px;
  font-weight: 800;
  color: var(--ink);
}
.inventoryPage .checkRow input{
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

.inventoryPage .miniRow{
  display:grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items:stretch;
}
@media (max-width: 420px){
  .inventoryPage .miniRow{ grid-template-columns: 1fr; }
}

.inventoryPage .stat{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  padding: 10px 12px;
  background: var(--surface2);
  display:grid;
  gap: 2px;
  align-content:center;
}
.inventoryPage .statLabel{ font-size: 12px; color: var(--muted); font-weight: 950; }
.inventoryPage .statValue{ font-size: 22px; font-weight: 950; }

/* =========================
   Alerts / Hint
========================= */
.inventoryPage .alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
}
.inventoryPage .alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}
.inventoryPage .alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.inventoryPage .hintBox{
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  padding: 12px;
  border-radius: 16px;
  line-height: 1.55;
}

/* =========================
   Table
========================= */
.inventoryPage .tableShell{
  margin: 0 -16px -16px;
  border-top: 1px solid var(--divider);
}

.inventoryPage .tableHead{
  display:grid;
  grid-template-columns: 1.6fr .8fr .8fr .7fr .5fr 2.2fr;
  gap: 12px;
  padding: 12px 16px;
  background: var(--tableHead-bg);
  font-size: 12px;
  font-weight: 950;
  color: var(--tableHead-ink);
  position: sticky;
  top: 0;
  z-index: 1;
  border-bottom: 1px solid var(--divider);
}

.inventoryPage .tableBody{
  max-height: 75vh;
  overflow: auto;
  background: var(--tableBody-bg);
}

.inventoryPage .tRow{
  display:grid;
  grid-template-columns: 1.6fr .8fr .8fr .7fr .5fr 2.2fr;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--divider);
  align-items:center;
  background: var(--row-bg);
}

.inventoryPage .tRow:hover{
  background: var(--row-hover);
}

.inventoryPage .hideSm{ display:block; }

.inventoryPage .num{
  text-align:right;
  font-weight: 850;
}
.inventoryPage .qtyStrong{ font-weight: 950; }

.inventoryPage .cellMain{ display:grid; gap: 4px; min-width: 0; }
.inventoryPage .mTitle{
  font-weight: 950;
  display:flex;
  gap: 8px;
  align-items:center;
  min-width: 0;
}
.inventoryPage .mTitleText{
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.inventoryPage .mSub{ font-size: 12px; color: var(--muted); font-weight: 800; }
.inventoryPage .dot{ margin: 0 6px; color: var(--stroke2); }
.inventoryPage .muted{ color: var(--muted); }

.inventoryPage .badgeLow{
  font-size: 11px;
  font-weight: 950;
  padding: 3px 8px;
  border-radius: 999px;
  border: 1px solid var(--danger-stroke);
  background: var(--danger-bg);
  color: var(--danger-ink);
}

.inventoryPage .actions{
  display:flex;
  gap: 8px;
  justify-content:flex-end;
  align-items:center;
  flex-wrap: wrap;
}

.inventoryPage .qtyInput{
  width: 92px;
  height: 40px;
  padding: 0 10px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  color: var(--ink);
  font-weight: 950;
}

.inventoryPage .qtyInput:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

/* ---------- responsive: stacked rows on phone ---------- */
@media (max-width: 980px){
  .inventoryPage .tableHead{ display:none; }
  .inventoryPage .tRow{ grid-template-columns: 1fr; gap: 10px; }
  .inventoryPage .hideSm{ display:none; }
  .inventoryPage .num{ text-align:left; }
  .inventoryPage .actions{ justify-content:flex-start; }
  .inventoryPage .qtyInput{ width: 120px; }
}

.inventoryPage .empty{
  margin: 16px;
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  font-weight: 950;
  text-align:center;
}
`;
