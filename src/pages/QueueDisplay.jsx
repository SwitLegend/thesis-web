// src/pages/QueueDisplay.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listBranches } from "../services/inventoryService";
import {
  subscribeQueueMeta,
  subscribeNowServing,
  subscribeNextWaiting,
  subscribeWaitingCount,
} from "../services/queueService";
import { useAuth } from "../hooks/useAuth";
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
});

function MotionCard({ label, value, big = false, variants, reduce }) {
  return (
    <motion.section className={`card ${big ? "cardBig" : ""}`} variants={variants}>
      <div className="cardLabel">{label}</div>

      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={String(value)}
          className={`cardValue ${big ? "cardValueBig" : ""}`}
          initial={{ opacity: 0, y: reduce ? 0 : 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -8 }}
          transition={reduce ? { duration: 0 } : { duration: 0.2, ease: easeOut }}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </motion.section>
  );
}

function Stat({ label, value, reduce }) {
  return (
    <div className="stat">
      <div className="statLabel">{label}</div>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={String(value)}
          className="statValue"
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: reduce ? 0 : -6 }}
          transition={reduce ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export default function QueueDisplay() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  const { profile } = useAuth();
  const role = String(profile?.role || "").toLowerCase();
  const showBack = role === "admin" || role === "pharmacist";

  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");

  const [lastIssued, setLastIssued] = useState(0);
  const [servingTicketId, setServingTicketId] = useState(null);

  const [serving, setServing] = useState(null);
  const [nextUp, setNextUp] = useState(null);
  const [waitingCount, setWaitingCount] = useState(0);

  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // Load branches
  useEffect(() => {
    (async () => {
      try {
        setBusy(true);
        const b = await listBranches();
        setBranches(b || []);
        if ((b || []).length) setBranchId(b[0].id);
      } catch (e) {
        setMsg(e?.message || "Failed to load branches.");
      } finally {
        setBusy(false);
      }
    })();
  }, []);

  // Realtime subscriptions per selected branch
  useEffect(() => {
    if (!branchId) return;

    let stopServing = () => {};

    const stopMeta = subscribeQueueMeta(branchId, (meta) => {
      setLastIssued(meta?.currentNumber || 0);
      setServingTicketId(meta?.servingTicketId || null);

      stopServing();
      stopServing = subscribeNowServing(branchId, meta?.servingTicketId, setServing);
    });

    const stopNext = subscribeNextWaiting(branchId, setNextUp);
    const stopCount = subscribeWaitingCount(branchId, setWaitingCount);

    return () => {
      stopMeta?.();
      stopServing?.();
      stopNext?.();
      stopCount?.();
    };
  }, [branchId]);

  const branchName = useMemo(() => {
    return branches.find((b) => b.id === branchId)?.name || "Select branch";
  }, [branches, branchId]);

  const nowServing = serving?.ticketNumber ?? "—";
  const nextTicket = nextUp?.ticketNumber ?? "—";

  const servingShortId = servingTicketId
    ? `${String(servingTicketId).slice(0, 6)}…`
    : "—";

  const isBadMsg =
    String(msg || "").toLowerCase().includes("fail") ||
    String(msg || "").toLowerCase().includes("error");

  return (
    <div className="pPage">
      <style>{css}</style>

      <motion.div className="pShell" variants={m.page} initial="hidden" animate="show">
        {/* Header */}
        <div className="pHeader">
          <div className="pHeaderLeft">
            {showBack ? (
              <motion.button
                className="btn btnGhost"
                onClick={() => navigate(-1)}
                disabled={busy}
                whileHover={busy ? undefined : reduce ? undefined : { scale: 1.02 }}
                whileTap={busy ? undefined : reduce ? undefined : { scale: 0.98 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 36 }}
                aria-label="Go back"
                title="Back"
              >
                ← Back
              </motion.button>
            ) : null}

            <div className="pHeaderText">
              <div className="pTitle">Queue Display</div>
              <div className="pSubtitle">
                Branch: <b>{branchName}</b>
              </div>
            </div>
          </div>

          <div className="pHeaderRight">
            <div className="fieldInline">
              <label className="label">Branch</label>
              <select
                className="control"
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                disabled={busy}
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <span className="pill">Waiting: {waitingCount}</span>
            <span className="pill subtle">Latest: {lastIssued || 0}</span>
          </div>
        </div>

        {/* Alerts */}
        {msg ? (
          <div className={isBadMsg ? "alert bad" : "alert ok"} role="status">
            {msg}
          </div>
        ) : null}

        {/* Main display */}
        <div className="grid">
          <MotionCard
            label="Now Serving"
            value={nowServing}
            big
            variants={m.card}
            reduce={!!reduce}
          />
          <MotionCard
            label="Next Up"
            value={nextTicket}
            big
            variants={m.card}
            reduce={!!reduce}
          />

          <motion.section className="card statsCard" variants={m.card}>
            <div className="statsHead">
              <div>
                <div className="statsTitle">Live Stats</div>
                <div className="statsHint">Updates automatically</div>
              </div>

              <span className="chip">serving id: {servingShortId}</span>
            </div>

            <div className="statsGrid">
              <Stat label="Waiting" value={waitingCount} reduce={!!reduce} />
              <Stat label="Latest Issued" value={lastIssued || 0} reduce={!!reduce} />
              <Stat label="Branch" value={branchName} reduce={!!reduce} />
            </div>

            <div className="footNote">
              Tip: Put this on a TV/monitor for customers. Staff controls from Queue Dashboard.
            </div>
          </motion.section>
        </div>
      </motion.div>
    </div>
  );
}

const css = `
:root{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.88);
  --stroke:#e2e8f0;

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --success-bg:#ecfdf5;
  --success-stroke:#a7f3d0;
  --success-ink:#065f46;

  --danger-bg:#fef2f2;
  --danger-stroke:#fecaca;
  --danger-ink:#991b1b;

  --radius: 18px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

[data-theme="dark"]{
  --bg0:#050814;
  --bg1:#0b1022;

  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --stroke:#1f2937;

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);

  --success-bg: rgba(16,185,129,.12);
  --success-stroke: rgba(16,185,129,.35);
  --success-ink:#6ee7b7;

  --danger-bg: rgba(239,68,68,.12);
  --danger-stroke: rgba(239,68,68,.35);
  --danger-ink:#fca5a5;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

*{ box-sizing:border-box; }

.pPage{
  min-height:100vh;
  width:100%;
  padding: clamp(16px, 3vw, 40px);
  padding-top: 34px;
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

[data-theme="dark"] .pPage{
  background:
    radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.pShell{
  width: min(1200px, 100%);
  display:grid;
  gap: 16px;
}

.pHeader{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
  gap: 12px;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(226,232,240,.85);
}

[data-theme="dark"] .pHeader{
  border-bottom-color: rgba(51,65,85,.6);
}

.pHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
}

.pHeaderText{
  min-width: 240px;
  display:grid;
  gap: 4px;
}

.pTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.pSubtitle{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  line-height: 1.45;
}

.pHeaderRight{
  display:flex;
  align-items:flex-end;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}

.btn{
  height: 42px;
  padding: 0 14px;
  border-radius: 14px;
  font-weight: 950;
  cursor:pointer;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,.92);
  color: var(--ink);
  box-shadow: var(--shadow-sm);
  display:inline-flex;
  align-items:center;
  justify-content:center;
  white-space: nowrap;
}
[data-theme="dark"] .btn{
  background: rgba(2,6,23,.34);
  border-color: rgba(51,65,85,.6);
}
.btn:disabled{ opacity: .7; cursor:not-allowed; }

.btnGhost{
  background: rgba(255,255,255,.96);
}
[data-theme="dark"] .btnGhost{
  background: rgba(2,6,23,.34);
}

.fieldInline{
  display:grid;
  gap: 6px;
  min-width: 240px;
}

.label{
  font-size: 12px;
  color: var(--muted2);
  font-weight: 900;
}

.control{
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline:none;
  background: rgba(255,255,255,.96);
  font-size: 14px;
  font-weight: 800;
  color: var(--ink);
}
[data-theme="dark"] .control{
  background: rgba(2,6,23,.42);
  border-color: rgba(51,65,85,.6);
  color: var(--ink);
}

.pill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background:#fff;
  color:#334155;
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}
[data-theme="dark"] .pill{
  background: rgba(2,6,23,.34);
  border-color: rgba(51,65,85,.6);
  color: rgba(229,231,235,1);
}
.pill.subtle{
  background: rgba(248,250,252,.95);
  color: var(--muted2);
}
[data-theme="dark"] .pill.subtle{
  background: rgba(2,6,23,.28);
  color: rgba(203,213,225,.9);
}

.alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background:#fff;
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
}
[data-theme="dark"] .alert{
  background: rgba(2,6,23,.34);
  border-color: rgba(51,65,85,.6);
}
.alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}
.alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.grid{
  display:grid;
  gap: 16px;
  grid-template-columns: 1fr 1fr;
  align-items: stretch;
}
@media (max-width: 980px){
  .grid{ grid-template-columns: 1fr; }
  .fieldInline{ min-width: 200px; }
}

.card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 16px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(8px);
  overflow: hidden;
}

.cardBig{
  display:grid;
  align-content:start;
  gap: 10px;
  min-height: 260px;
}

.cardLabel{
  font-size: 13px;
  color: var(--muted);
  font-weight: 950;
  letter-spacing: .2px;
  text-transform: uppercase;
}

.cardValue{
  font-size: 44px;
  font-weight: 1000;
  letter-spacing: -1px;
  line-height: 1.05;
}

.cardValueBig{
  font-size: clamp(72px, 8vw, 120px);
  margin-top: 4px;
}

.statsCard{
  grid-column: 1 / -1;
}

.statsHead{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  flex-wrap:wrap;
  align-items:flex-start;
  margin-bottom: 12px;
}

.statsTitle{
  font-size: 16px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.statsHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  margin-top: 4px;
}

.chip{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: rgba(255,255,255,.92);
  color: var(--muted2);
}
[data-theme="dark"] .chip{
  background: rgba(2,6,23,.28);
  border-color: rgba(51,65,85,.6);
  color: rgba(203,213,225,.9);
}

.statsGrid{
  display:grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
}
@media (max-width: 980px){
  .statsGrid{ grid-template-columns: 1fr; }
}

.stat{
  border: 1px solid rgba(226,232,240,.9);
  background: rgba(255,255,255,.92);
  border-radius: 16px;
  padding: 12px;
  box-shadow: var(--shadow-sm);
}
[data-theme="dark"] .stat{
  border-color: rgba(51,65,85,.6);
  background: rgba(2,6,23,.28);
}

.statLabel{
  font-size: 12px;
  color: var(--muted);
  font-weight: 950;
}

.statValue{
  font-size: 22px;
  font-weight: 1000;
  margin-top: 6px;
  letter-spacing: -0.3px;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.footNote{
  margin-top: 12px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  border-top: 1px dashed rgba(226,232,240,.9);
  padding-top: 10px;
}
[data-theme="dark"] .footNote{
  border-top-color: rgba(51,65,85,.6);
}
`;
