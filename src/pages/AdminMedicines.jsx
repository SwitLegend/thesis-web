// src/pages/AdminMedicines.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  addMedicine,
  listMedicines,
  listBranches,
  addInventoryQuantity,
  findMedicineByKey,
} from "../services/inventoryService";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

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
  item: {
    hidden: { opacity: 0, y: reduce ? 0 : 10 },
    show: (i = 0) => ({
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0 }
        : { duration: 0.22, ease: easeOut, delay: Math.min(i * 0.02, 0.18) },
    }),
    exit: {
      opacity: 0,
      y: reduce ? 0 : 10,
      transition: reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut },
    },
  },
});

export default function AdminMedicines() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const [branches, setBranches] = useState([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState([]);
  const [initialQty, setInitialQty] = useState("0");

  const [meds, setMeds] = useState([]);
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    name: "",
    genericName: "",
    form: "",
    strength: "",
    price: "",
  });

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function refreshMedicines() {
    const data = await listMedicines();
    setMeds(data);
  }

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      setBranches(b);
      if (b.length) setSelectedBranchIds([b[0].id]);
      await refreshMedicines();
    })();
  }, []);

  function toggleBranch(branchId) {
    setSelectedBranchIds((prev) => {
      if (prev.includes(branchId)) return prev.filter((id) => id !== branchId);
      return [...prev, branchId];
    });
  }

  const filteredMeds = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meds;
    return meds.filter((m2) => {
      const hay = `${m2.name || ""} ${m2.genericName || ""} ${m2.form || ""} ${m2.strength || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [meds, search]);

  async function handleAdd(e) {
    e.preventDefault();
    setMsg("");

    if (!form.name.trim()) return setMsg("Please enter medicine name.");
    if (selectedBranchIds.length === 0) return setMsg("Please select at least one branch.");

    const qty = Number(initialQty) || 0;

    try {
      setBusy(true);

      // If same medicine exists, we will just update stock
      const existing = await findMedicineByKey(form);
      const medicineId = existing ? existing.id : await addMedicine(form);

      // Update inventory on all selected branches
      await Promise.all(
        selectedBranchIds.map((branchId) =>
          addInventoryQuantity({
            branchId,
            medicineId,
            quantityDelta: qty,
          })
        )
      );

      setForm({ name: "", genericName: "", form: "", strength: "", price: "" });
      setInitialQty("0");

      setMsg(
        existing
          ? "Medicine already exists — inventory updated ✅"
          : "Medicine added + assigned to selected branch(es) ✅"
      );

      refreshMedicines();
    } catch (err) {
      console.error(err);
      setMsg(err?.message || "Something went wrong. Check console for details.");
    } finally {
      setBusy(false);
    }
  }

  const isBadMsg =
    String(msg || "").toLowerCase().includes("wrong") ||
    String(msg || "").toLowerCase().includes("failed") ||
    String(msg || "").toLowerCase().includes("error");

  return (
    <div className="pPage adminMedicines">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            <motion.button
              onClick={() => navigate(-1)}
              className="btn btnGhost"
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
              <div className="pTitle">Medicines</div>
              <div className="pSubtitle">Add medicine + assign inventory per branch</div>
            </div>
          </div>

          <div className="pHeaderRight">
            <div className="pill">{filteredMeds.length} item(s)</div>
          </div>
        </div>

        <div className="twoCol">
          {/* Left: Form */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Add / Update Inventory</div>
                <div className="cardHint">
                  Adding the same medicine again will <b>increase stock</b>.
                </div>
              </div>
            </div>

            <form onSubmit={handleAdd} className="form">
              {/* Branch selector */}
              <div className="section">
                <div className="sectionTitle">Branches</div>

                <div className="branchList" role="group" aria-label="Select branches">
                  {branches.map((b) => (
                    <label key={b.id} className="branchItem">
                      <input
                        type="checkbox"
                        checked={selectedBranchIds.includes(b.id)}
                        onChange={() => toggleBranch(b.id)}
                      />
                      <span className="branchName">{b.name}</span>
                    </label>
                  ))}
                </div>

                <div className="row1">
                  <div className="field">
                    <label className="label">Initial Quantity</label>
                    <input
                      className="control"
                      type="number"
                      value={initialQty}
                      onChange={(e) => setInitialQty(e.target.value)}
                      min="0"
                      inputMode="numeric"
                    />
                    <div className="smallHint">
                      Tip: set 0 if you only want to add the medicine to the branch list.
                    </div>
                  </div>
                </div>
              </div>

              {/* Medicine details */}
              <div className="section">
                <div className="sectionTitle">Medicine details</div>

                <div className="row2">
                  <div className="field">
                    <label className="label">Brand / Medicine name</label>
                    <input
                      className="control"
                      placeholder="e.g., Bioflu"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Generic name</label>
                    <input
                      className="control"
                      placeholder="e.g., Paracetamol"
                      value={form.genericName}
                      onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                    />
                  </div>
                </div>

                <div className="row3">
                  <div className="field">
                    <label className="label">Form</label>
                    <input
                      className="control controlSmPh"
                      placeholder="Tablet / Syrup"
                      value={form.form}
                      onChange={(e) => setForm({ ...form, form: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Strength</label>
                    <input
                      className="control controlSmPh"
                      placeholder="500mg"
                      value={form.strength}
                      onChange={(e) => setForm({ ...form, strength: e.target.value })}
                    />
                  </div>

                  <div className="field">
                    <label className="label">Price (₱)</label>
                    <input
                      className="control controlSmPh"
                      placeholder="e.g., 12"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <motion.button
                type="submit"
                className="btn btnPrimary"
                disabled={busy}
                whileHover={busy ? undefined : reduce ? undefined : { scale: 1.01 }}
                whileTap={busy ? undefined : reduce ? undefined : { scale: 0.985 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 650, damping: 35 }}
              >
                {busy ? "Saving..." : "Add / Update"}
              </motion.button>

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
            </form>
          </motion.section>

          {/* Right: List */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead cardHeadRow">
              <div>
                <div className="cardTitle">Existing Medicines</div>
                <div className="cardHint">Browse and verify details</div>
              </div>

              <div className="cardRight">
                <span className="pill subtle">{filteredMeds.length} item(s)</span>
              </div>
            </div>

            <div className="searchWrap">
              <input
                className="control"
                placeholder="Search medicine..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <motion.div className="list" layout>
              <AnimatePresence initial={false}>
                {filteredMeds.map((m2, idx) => (
                  <motion.div
                    key={m2.id}
                    className="listItem"
                    layout
                    variants={m.item}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    custom={idx}
                  >
                    <div className="liText">
                      <div className="mName">
                        {m2.name} <span className="mMeta">({m2.genericName || "—"})</span>
                      </div>
                      <div className="mSub">
                        {m2.form || "—"} • {m2.strength || "—"}
                      </div>
                    </div>

                    <div className="priceChip">₱{Number(m2.price || 0).toFixed(2)}</div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredMeds.length === 0 ? (
                <motion.div
                  className="empty"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
                >
                  No medicines found.
                </motion.div>
              ) : null}
            </motion.div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Tokens (NO global :root)
========================= */
.adminMedicines{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --surface: rgba(255,255,255,.94);
  --surface2: rgba(248,250,252,.95);

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

  --pill-bg: var(--surface);
  --pill-ink:#334155;

  --btn-bg: var(--surface);

  --price-bg:#eff6ff;
  --price-stroke:#dbeafe;
  --price-ink:#1d4ed8;

  --radius: 18px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .adminMedicines{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --surface: rgba(15,23,42,.70);
  --surface2: rgba(15,23,42,.55);

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

  --pill-bg: var(--surface2);
  --pill-ink: var(--muted2);

  --btn-bg: var(--surface);

  --price-bg: rgba(59,130,246,.16);
  --price-stroke: rgba(59,130,246,.35);
  --price-ink: #93c5fd;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.adminMedicines *{ box-sizing:border-box; }
@media (prefers-reduced-motion: reduce){
  .adminMedicines *{ scroll-behavior:auto !important; }
}

/* =========================
   Page Layout
========================= */
.adminMedicines.pPage{
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

[data-theme="dark"] .adminMedicines.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.adminMedicines .pShell{
  width: min(1100px, 100%);
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.adminMedicines .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;

  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.adminMedicines .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.adminMedicines .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 4px;
}

.adminMedicines .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.adminMedicines .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}

.adminMedicines .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
}

/* =========================
   Buttons / Pills
========================= */
.adminMedicines .btn{
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: var(--btn-bg);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
}
.adminMedicines .btn:disabled{ opacity: .7; cursor:not-allowed; }

.adminMedicines .btnGhost{
  background: var(--surface);
  border-color: var(--stroke);
}

.adminMedicines .btnPrimary{
  border: 1px solid rgba(37,99,235,.18);
  background: linear-gradient(180deg, #2f6cf2, var(--primary));
  color:#fff;
  box-shadow: 0 14px 26px rgba(37,99,235,.18);
}

[data-theme="dark"] .adminMedicines .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

.adminMedicines .pill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--pill-bg);
  color: var(--pill-ink);
  box-shadow: var(--shadow-sm);
}
.adminMedicines .pill.subtle{
  background: var(--surface2);
  color: var(--muted2);
}

/* =========================
   Cards / Layout
========================= */
.adminMedicines .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.adminMedicines .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap:wrap;
}
.adminMedicines .cardHeadRow{ align-items:flex-start; }

.adminMedicines .cardTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.adminMedicines .cardHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 4px;
}

.adminMedicines .cardRight{ display:flex; align-items:center; gap: 10px; }

.adminMedicines .twoCol{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  align-items:start;
}

/* =========================
   Sections
========================= */
.adminMedicines .section{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  padding: 12px;
  background: var(--surface);
  box-shadow: var(--shadow-sm);
  overflow: hidden;
}

.adminMedicines .sectionTitle{
  font-size: 12px;
  font-weight: 950;
  color: var(--muted2);
  margin-bottom: 10px;
}

/* Branch list */
.adminMedicines .branchList{
  display:grid;
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
}

.adminMedicines .branchItem{
  display:flex;
  gap: 10px;
  align-items:center;
  font-size: 14px;
  color: var(--ink);
  font-weight: 850;
  min-width: 0;
}

.adminMedicines .branchName{
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.adminMedicines .branchItem input{
  width: 16px;
  height: 16px;
  accent-color: var(--primary);
}

/* Rows */
.adminMedicines .row1{ display:grid; gap: 10px; margin-top: 10px; }

.adminMedicines .row2{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.adminMedicines .row3{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(0, 1fr));
  gap: 10px;
  margin-top: 10px;
}

@media (max-width: 420px){
  .adminMedicines .twoCol{ grid-template-columns: 1fr; }
  .adminMedicines .row2{ grid-template-columns: 1fr; }
  .adminMedicines .row3{ grid-template-columns: 1fr; }
}

/* =========================
   Form / Inputs
========================= */
.adminMedicines .form{ display:grid; gap: 12px; }

.adminMedicines .field{
  display:grid;
  gap: 6px;
  min-width: 0;
}

.adminMedicines .label{
  font-size: 12px;
  color: var(--muted2);
  font-weight: 900;
}

.adminMedicines .control{
  height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  font-size: 14px;
  font-weight: 750;
  color: var(--ink);
  width: 100%;
  min-width: 0;
  max-width: 100%;
}

.adminMedicines .control::placeholder{
  color: var(--muted);
}

.adminMedicines .control:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

.adminMedicines .smallHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
  margin-top: 4px;
  line-height: 1.45;
}

/* Only these placeholders smaller */
.adminMedicines .controlSmPh::placeholder{
  font-size: 10px;
  font-weight: 750;
  color: var(--muted);
  line-height: normal;
}
.adminMedicines .controlSmPh::-webkit-input-placeholder{ font-size: 10px; }
.adminMedicines .controlSmPh::-moz-placeholder{ font-size: 10px; }

/* =========================
   Alerts
========================= */
.adminMedicines .alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
}

.adminMedicines .alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}

.adminMedicines .alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.adminMedicines .searchWrap{ margin-bottom: 12px; }

/* =========================
   List
========================= */
.adminMedicines .list{ display:grid; gap: 10px; }

.adminMedicines .listItem{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  align-items:center;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.adminMedicines .liText{
  display:grid;
  gap: 4px;
  min-width: 0;
}

.adminMedicines .mName{
  font-weight: 950;
  font-size: 14px;
  letter-spacing: -0.1px;
}

.adminMedicines .mMeta{
  font-weight: 850;
  color: var(--muted);
}

.adminMedicines .mSub{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
}

.adminMedicines .priceChip{
  font-size: 12px;
  font-weight: 950;
  padding: 8px 10px;
  border-radius: 999px;
  border: 1px solid var(--price-stroke);
  background: var(--price-bg);
  color: var(--price-ink);
  white-space: nowrap;
  box-shadow: var(--shadow-sm);
}

.adminMedicines .empty{
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  text-align:center;
  font-weight: 850;
}

@media (max-width: 520px){
  .adminMedicines .btn{ height: 40px; border-radius: 12px; }
  .adminMedicines .control{ border-radius: 12px; }
}
`;
