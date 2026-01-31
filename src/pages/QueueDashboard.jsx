// src/pages/QueueDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBranches } from "../services/inventoryService";
import {
  nextTicket,
  doneTicket,
  resetQueue,
  subscribeQueueMeta,
  subscribeNowServing,
  subscribeNextWaiting,
  subscribeWaitingCount,
} from "../services/queueService";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";

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
});

export default function QueueDashboard() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  const [lastIssued, setLastIssued] = useState(0);
  const [servingTicketId, setServingTicketId] = useState(null);

  const [serving, setServing] = useState(null);
  const [nextUp, setNextUp] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      setBranches(b);
      if (b.length) setBranchId(b[0].id);
    })();
  }, []);

  useEffect(() => {
    if (!branchId) return;

    let stopServing = () => {};

    const stopMeta = subscribeQueueMeta(branchId, (meta) => {
      setLastIssued(meta.currentNumber || 0);
      setServingTicketId(meta.servingTicketId || null);

      stopServing();
      stopServing = subscribeNowServing(branchId, meta.servingTicketId, setServing);
    });

    const stopNext = subscribeNextWaiting(branchId, setNextUp);
    const stopCount = subscribeWaitingCount(branchId, setWaitingCount);

    return () => {
      stopMeta();
      stopServing();
      stopNext();
      stopCount();
    };
  }, [branchId]);

  const branchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "Select a branch";
  }, [branches, branchId]);

  async function handleNext() {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    try {
      setBusy(true);
      const res = await nextTicket(branchId);
      if (!res) setMsg("No waiting tickets.");
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Failed to call next");
    } finally {
      setBusy(false);
    }
  }

  async function handleDone() {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    try {
      setBusy(true);
      const res = await doneTicket(branchId);
      if (!res) setMsg("No ticket is currently serving.");
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Failed to mark done");
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    setMsg("");
    if (!branchId) return setMsg("Select a branch first.");

    const ok = window.confirm(
      "RESET QUEUE?\n\nThis will:\n• Set Latest Issued back to 0\n• Clear Now Serving\n• Delete all tickets for this branch\n\nContinue?"
    );
    if (!ok) return;

    try {
      setBusy(true);
      await resetQueue(branchId);
      setMsg("Queue reset ✅");
    } catch (e) {
      console.error(e);
      setMsg(e?.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  }

  const isBadMsg =
    String(msg || "").toLowerCase().includes("fail") ||
    String(msg || "").toLowerCase().includes("error");

  return (
    <div className="pPage queueDash">
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
              <div className="pTitle">Queue Dashboard</div>
              <div className="pSubtitle">
                Branch: <b>{branchName}</b>
              </div>
            </div>
          </div>

          <div className="pHeaderRight">
            <span className="pill">{profile?.role || "user"}</span>

            <span className="pill subtle">
              Latest Issued:{" "}
              <motion.span
                key={`issued-pill-${lastIssued}`}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
              >
                {lastIssued || 0}
              </motion.span>
            </span>

            <span className="pill subtle">
              Waiting:{" "}
              <motion.span
                key={`waiting-pill-${waitingCount}`}
                initial={{ opacity: 0, y: reduce ? 0 : 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
              >
                {waitingCount}
              </motion.span>
            </span>
          </div>
        </div>

        {/* Layout */}
        <div className="qdLayout">
          {/* Left: Controls */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Controls</div>
                <div className="cardHint">Pick branch + manage the queue</div>
              </div>
              {isAdmin ? <span className="chip chipWarn">Admin tools</span> : <span className="chip">Staff</span>}
            </div>

            <div className="cardBody">
              <div className="field">
                <label className="label">Branch</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="control"
                  disabled={busy}
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="btnRow">
                <motion.button
                  onClick={handleNext}
                  disabled={!branchId || busy}
                  className="btn btnPrimary btnWide"
                  whileHover={busy ? undefined : reduce ? undefined : { scale: 1.01 }}
                  whileTap={busy ? undefined : reduce ? undefined : { scale: 0.985 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 650, damping: 35 }}
                >
                  {busy ? "Working..." : "Next"}
                </motion.button>

                <motion.button
                  onClick={handleDone}
                  disabled={!branchId || busy}
                  className="btn btnDanger btnWide"
                  whileHover={busy ? undefined : reduce ? undefined : { scale: 1.01 }}
                  whileTap={busy ? undefined : reduce ? undefined : { scale: 0.985 }}
                  transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 650, damping: 35 }}
                >
                  {busy ? "Working..." : "Done"}
                </motion.button>

                {isAdmin ? (
                  <motion.button
                    onClick={handleReset}
                    disabled={!branchId || busy}
                    className="btn btnWarn btnWide"
                    whileHover={busy ? undefined : reduce ? undefined : { scale: 1.01 }}
                    whileTap={busy ? undefined : reduce ? undefined : { scale: 0.985 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 650, damping: 35 }}
                    title="Reset ticket numbering for this branch"
                  >
                    {busy ? "Working..." : "Reset Queue"}
                  </motion.button>
                ) : null}
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
                <b>Note:</b> “Latest Issued” matches the kiosk ticket.
                <br />
                “Now Serving” changes only when staff presses <b>Next</b>.
                <br />
                {isAdmin ? (
                  <>
                    Reset Queue will also <b>delete all tickets</b> for that branch.
                  </>
                ) : (
                  <>Only admins can reset the queue.</>
                )}
              </div>
            </div>
          </motion.section>

          {/* Right: Live Status */}
          <motion.section className="card" variants={m.card}>
            <div className="cardHead">
              <div>
                <div className="cardTitle">Live Status</div>
                <div className="cardHint">Updates instantly</div>
              </div>

              <div className="chipsRow">
                <span className="chip">{waitingCount} waiting</span>
                <span className="chip chipSoft">
                  serving id: {servingTicketId ? `${String(servingTicketId).slice(0, 6)}…` : "—"}
                </span>
              </div>
            </div>

            <div className="statusGrid">
              <div className="statCard">
                <div className="statLabel">Latest Issued (same as kiosk)</div>
                <motion.div
                  className="statValue"
                  key={`issued-${lastIssued}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {lastIssued || 0}
                </motion.div>
              </div>

              <div className="statCard">
                <div className="statLabel">Now Serving</div>
                <motion.div
                  className="statValue"
                  key={`serving-${serving?.ticketNumber ?? "none"}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {serving?.ticketNumber ?? "—"}
                </motion.div>
                <div className="statHint">
                  {servingTicketId ? `Ticket status: ${serving?.status || "serving"}` : "None serving"}
                </div>
              </div>

              <div className="statCard">
                <div className="statLabel">Next Up</div>
                <motion.div
                  className="statValue"
                  key={`next-${nextUp?.ticketNumber ?? "none"}`}
                  initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                >
                  {nextUp?.ticketNumber ?? "—"}
                </motion.div>
                <div className="statHint">{nextUp ? "Waiting" : "No waiting tickets"}</div>
              </div>
            </div>
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
.queueDash{
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

  --warn-bg:#fff7ed;
  --warn-stroke:#fed7aa;
  --warn-ink:#9a3412;

  --radius: 18px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

html.dark .queueDash,
[data-theme="dark"] .queueDash{
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
  --warn-ink:#fdba74;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.queueDash *{ box-sizing:border-box; }
@media (prefers-reduced-motion: reduce){
  .queueDash *{ scroll-behavior:auto !important; }
}

/* page */
.queueDash.pPage{
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

html.dark .queueDash.pPage,
[data-theme="dark"] .queueDash.pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.queueDash .pShell{
  width: min(1200px, 100%);
  display:grid;
  gap: 16px;
}

/* header */
.queueDash .pHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}

.queueDash .pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.queueDash .pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 4px;
}

.queueDash .pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.queueDash .pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}

.queueDash .pHeaderRight{
  display:flex;
  align-items:center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

/* buttons / pills */
.queueDash .btn{
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space: nowrap;
}
.queueDash .btn:disabled{ opacity: .7; cursor:not-allowed; }

.queueDash .btnGhost{
  border-color: color-mix(in srgb, var(--stroke) 70%, transparent);
  background: var(--surface);
}

.queueDash .btnPrimary{
  border: 1px solid rgba(37,99,235,.18);
  background: linear-gradient(180deg, #2f6cf2, var(--primary));
  color:#fff;
  box-shadow: 0 14px 26px rgba(37,99,235,.18);
}
html.dark .queueDash .btnPrimary,
[data-theme="dark"] .queueDash .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}

.queueDash .btnDanger{
  border: 1px solid var(--danger-stroke);
  background: var(--surface);
  color: var(--danger-ink);
}

.queueDash .btnWarn{
  border: 1px solid var(--warn-stroke);
  background: var(--warn-bg);
  color: var(--warn-ink);
}

.queueDash .pill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
  text-transform: capitalize;
}

.queueDash .pill.subtle{
  background: var(--surface2);
  color: var(--muted2);
}

/* layout */
.queueDash .qdLayout{
  display:grid;
  grid-template-columns: 360px 1fr;
  gap: 16px;
  align-items:start;
}
@media (max-width: 980px){
  .queueDash .qdLayout{ grid-template-columns: 1fr; }
}

/* card */
.queueDash .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
  min-width: 0;
}

.queueDash .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap:wrap;
}

.queueDash .cardTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.queueDash .cardHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 4px;
}

.queueDash .cardBody{
  display:grid;
  gap: 12px;
}

/* controls */
.queueDash .field{ display:grid; gap: 6px; min-width: 0; }
.queueDash .label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.queueDash .control{
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

.queueDash .control:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 4px var(--primary-weak);
}

.queueDash .btnRow{
  display:grid;
  gap: 10px;
}
.queueDash .btnWide{ width: 100%; }

/* alerts */
.queueDash .alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
}

.queueDash .alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}

.queueDash .alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.queueDash .hintBox{
  font-size: 12px;
  color: var(--muted);
  border: 1px dashed var(--stroke2);
  background: var(--surface2);
  padding: 12px;
  border-radius: 14px;
  line-height: 1.55;
  font-weight: 750;
}

/* chips */
.queueDash .chipsRow{ display:flex; gap: 8px; flex-wrap: wrap; justify-content:flex-end; }
.queueDash .chip{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  white-space: nowrap;
}
.queueDash .chipSoft{
  background: var(--surface2);
  color: var(--muted2);
}
.queueDash .chipWarn{
  border-color: var(--warn-stroke);
  background: var(--warn-bg);
  color: var(--warn-ink);
}

/* status */
.queueDash .statusGrid{
  display:grid;
  gap: 12px;
}

.queueDash .statCard{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  padding: 14px;
  background: var(--surface);
}

.queueDash .statLabel{
  font-size: 12px;
  color: var(--muted);
  font-weight: 950;
}

.queueDash .statValue{
  font-size: clamp(40px, 5vw, 54px);
  font-weight: 1000;
  line-height: 1.05;
  margin-top: 8px;
  letter-spacing: -0.8px;
}

.queueDash .statHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 8px;
}

/* small screens */
@media (max-width: 520px){
  .queueDash .chipsRow{ justify-content:flex-start; }
}
`;
