// src/pages/AdminBranches.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addBranch, listBranches, deleteBranch } from "../services/inventoryService";
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

export default function AdminBranches() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const [branches, setBranches] = useState([]);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  async function refresh() {
    const data = await listBranches();
    setBranches(data);
  }

  useEffect(() => {
    refresh();
  }, []);

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((b) => {
      const hay = `${b.name || ""} ${b.address || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }, [branches, search]);

  async function handleAdd(e) {
    e.preventDefault();
    setMsg("");

    if (!name.trim()) {
      setMsg("Please enter branch name.");
      return;
    }

    try {
      setBusy(true);
      await addBranch({ name, address });
      setName("");
      setAddress("");
      setMsg("Branch added ✅");
      refresh();
    } catch (err) {
      console.error(err);
      setMsg("Something went wrong. Check console for details.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(branch) {
    setMsg("");

    const ok = window.confirm(
      `Delete branch "${branch.name}"?\n\nThis will also delete ALL inventory records for this branch.`
    );
    if (!ok) return;

    try {
      setBusy(true);
      await deleteBranch(branch.id);
      setMsg("Branch deleted ✅");
      refresh();
    } catch (err) {
      console.error(err);
      setMsg("Delete failed. Check console for details.");
    } finally {
      setBusy(false);
    }
  }

  const isBadMsg =
    String(msg || "").toLowerCase().includes("wrong") ||
    String(msg || "").toLowerCase().includes("failed");

  return (
    <div className="pPage adminBranches">
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
              <div className="pTitle">Branches</div>
              <div className="pSubtitle">Create branches and manage locations</div>
            </div>
          </div>

          <div className="pHeaderRight">
            <div className="pill">
              {filteredBranches.length} branch{filteredBranches.length === 1 ? "" : "es"}
            </div>
          </div>
        </div>

        <div className="twoCol">
          {/* Left: Add Branch */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Add Branch</div>
                <div className="cardHint">Fill in details then save</div>
              </div>
            </div>

            <form onSubmit={handleAdd} className="form">
              <div className="field">
                <label className="label">Branch name</label>
                <input
                  className="control"
                  placeholder="e.g., Hub Ahib Pharmacy"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="field">
                <label className="label">Address</label>
                <input
                  className="control"
                  placeholder="e.g., Poblacion, Davao City"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>

              <motion.button
                type="submit"
                className="btn btnPrimary"
                disabled={busy}
                whileHover={busy ? undefined : reduce ? undefined : { scale: 1.01 }}
                whileTap={busy ? undefined : reduce ? undefined : { scale: 0.985 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 650, damping: 35 }}
              >
                {busy ? "Saving..." : "Add Branch"}
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

              <div className="note noteWarn">
                Deleting a branch will also delete <b>ALL</b> inventory records for that branch.
              </div>
            </form>
          </motion.section>

          {/* Right: Existing Branches */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead cardHeadRow">
              <div>
                <div className="cardTitle">Existing Branches</div>
                <div className="cardHint">Search, review, and remove branches</div>
              </div>

              <div className="cardRight">
                <span className="pill subtle">
                  {filteredBranches.length} result{filteredBranches.length === 1 ? "" : "s"}
                </span>
              </div>
            </div>

            <div className="searchWrap">
              <input
                className="control"
                placeholder="Search branch..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <motion.div className="list" layout>
              <AnimatePresence initial={false}>
                {filteredBranches.map((b, idx) => (
                  <motion.div
                    key={b.id}
                    className="listItem"
                    layout
                    variants={m.item}
                    initial="hidden"
                    animate="show"
                    exit="exit"
                    custom={idx}
                  >
                    <div className="liText">
                      <div className="bName">{b.name}</div>
                      <div className="bAddr">{b.address || "No address"}</div>
                    </div>

                    <motion.button
                      onClick={() => handleDelete(b)}
                      className="btn btnDangerGhost"
                      disabled={busy}
                      title="Delete branch"
                      whileHover={busy ? undefined : reduce ? undefined : { scale: 1.02 }}
                      whileTap={busy ? undefined : reduce ? undefined : { scale: 0.98 }}
                      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
                    >
                      Delete
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>

              {filteredBranches.length === 0 ? (
                <motion.div
                  className="empty"
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
                >
                  No branches found.
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
.adminBranches{
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

  --danger:#b91c1c;
  --danger-bg:#fef2f2;
  --danger-stroke:#fecaca;
  --danger-ink:#991b1b;

  --warn-bg: rgba(245,158,11,.10);
  --warn-stroke: rgba(245,158,11,.28);

  --pill-bg: var(--surface);
  --pill-ink: #334155;

  --btn-bg: var(--surface);

  --radius: 18px;
  --radius-sm: 14px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"] .adminBranches{
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

  --warn-bg: rgba(245,158,11,.12);
  --warn-stroke: rgba(245,158,11,.35);

  --pill-bg: var(--surface2);
  --pill-ink: var(--muted2);

  --btn-bg: var(--surface);

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.adminBranches *{ box-sizing:border-box; }
@media (prefers-reduced-motion: reduce){
  .adminBranches *{ scroll-behavior:auto !important; }
}

/* =========================
   Page Layout
========================= */
.adminBranches.pPage{
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

[data-theme="dark"] .adminBranches.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.adminBranches .pShell{
  width: min(1100px, 100%);
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.adminBranches .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;

  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.adminBranches .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.adminBranches .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 4px;
}

.adminBranches .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.adminBranches .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}

.adminBranches .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
}

/* =========================
   Buttons / Pills
========================= */
.adminBranches .btn{
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

.adminBranches .btn:disabled{ opacity: .7; cursor:not-allowed; }

.adminBranches .btnGhost{
  background: var(--surface);
  border-color: var(--stroke);
}

.adminBranches .btnPrimary{
  border: 1px solid rgba(37,99,235,.18);
  background: linear-gradient(180deg, #2f6cf2, var(--primary));
  color:#fff;
  box-shadow: 0 14px 26px rgba(37,99,235,.18);
}

[data-theme="dark"] .adminBranches .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

.adminBranches .btnDangerGhost{
  border-color: var(--danger-stroke);
  background: var(--surface);
  color: var(--danger-ink);
}

.adminBranches .pill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--pill-bg);
  color: var(--pill-ink);
  box-shadow: var(--shadow-sm);
}

.adminBranches .pill.subtle{
  background: var(--surface2);
  color: var(--muted2);
}

/* =========================
   Cards
========================= */
.adminBranches .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
}

.adminBranches .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap:wrap;
}

.adminBranches .cardHeadRow{ align-items:flex-start; }

.adminBranches .cardTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.adminBranches .cardHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 4px;
}

.adminBranches .cardRight{
  display:flex;
  align-items:center;
  gap: 10px;
}

/* =========================
   Layout Grid
========================= */
.adminBranches .twoCol{
  display:grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
  align-items:start;
}

/* =========================
   Form / Inputs
========================= */
.adminBranches .form{ display:grid; gap: 12px; }
.adminBranches .field{ display:grid; gap: 6px; }

.adminBranches .label{
  font-size: 12px;
  color: var(--muted2);
  font-weight: 900;
}

.adminBranches .control{
  height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  font-size: 14px;
  font-weight: 750;
  color: var(--ink);
}

.adminBranches .control::placeholder{
  color: color-mix(in srgb, var(--muted) 85%, transparent);
}

.adminBranches .control:focus{
  border-color: #93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

.adminBranches .searchWrap{ margin-bottom: 12px; }

/* =========================
   Alerts / Notes
========================= */
.adminBranches .alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
}

.adminBranches .alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}

.adminBranches .alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.adminBranches .note{
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  padding: 12px;
  border-radius: 14px;
  line-height: 1.55;
  font-weight: 750;
}

.adminBranches .noteWarn{
  border-color: var(--warn-stroke);
  background: var(--warn-bg);
}

.adminBranches .noteWarn b{
  color: var(--ink);
}

/* =========================
   List
========================= */
.adminBranches .list{ display:grid; gap: 10px; }

.adminBranches .listItem{
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

.adminBranches .liText{
  display:grid;
  gap: 4px;
  min-width: 0;
}

.adminBranches .bName{
  font-weight: 950;
  font-size: 14px;
  letter-spacing: -0.1px;
}

.adminBranches .bAddr{
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: min(680px, 56vw);
}

.adminBranches .empty{
  padding: 14px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  color: var(--muted);
  text-align:center;
  font-weight: 800;
}

@media (max-width: 520px){
  .adminBranches .bAddr{ max-width: 62vw; }
  .adminBranches .btn{ height: 40px; border-radius: 12px; }
  .adminBranches .control{ border-radius: 12px; }
}
`;
