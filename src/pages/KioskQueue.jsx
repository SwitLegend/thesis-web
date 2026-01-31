// src/pages/KioskQueue.jsx
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { listBranches } from "../services/inventoryService";
import { joinQueue } from "../services/queueService";

export default function KioskQueue() {
  const [branches, setBranches] = useState([]);
  const [branchId, setBranchId] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState(null);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      const b = await listBranches();
      setBranches(b);
      if (b.length) setBranchId(b[0].id);
    })();
  }, []);

  async function handleJoin() {
    setMsg("");
    setTicket(null);
    if (!branchId) return setMsg("Select a branch first.");

    try {
      setBusy(true);
      const t = await joinQueue(branchId);
      setTicket(t);
    } catch (e) {
      console.error(e);
      setMsg("Failed to join queue. Check console.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={styles.page}>
      <motion.div
        style={styles.card}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeOut" }}
      >
        <div style={styles.header}>
          <div style={styles.title}>Kiosk</div>
          <div style={styles.sub}>Join the branch queue</div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          <label style={styles.label}>Branch</label>
          <select
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            style={styles.select}
          >
            {branches.map((b) => (
              <option value={b.id} key={b.id}>
                {b.name}
              </option>
            ))}
          </select>

          <motion.button
            onClick={handleJoin}
            disabled={busy}
            style={styles.btn}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            {busy ? "Joining..." : "Join Queue"}
          </motion.button>

          {ticket ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={styles.ticketBox}
            >
              <div style={styles.ticketLabel}>Your ticket number</div>
              <div style={styles.ticketNumber}>{ticket.ticketNumber}</div>
              <div style={styles.ticketHint}>Please wait to be called.</div>
            </motion.div>
          ) : null}

          {msg ? <div style={styles.msg}>{msg}</div> : null}
        </div>
      </motion.div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    padding: 24,
    display: "grid",
    placeItems: "center",
    background:
      "radial-gradient(1200px 600px at 20% 10%, #eef2ff 0%, #f8fafc 45%, #ffffff 100%)",
    fontFamily:
      "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    color: "#0f172a",
  },
  card: {
    width: "min(520px, 100%)",
    background: "rgba(255,255,255,0.88)",
    border: "1px solid #e2e8f0",
    borderRadius: 18,
    padding: 16,
    boxShadow: "0 10px 30px rgba(15,23,42,0.06)",
    backdropFilter: "blur(6px)",
  },
  header: { marginBottom: 12 },
  title: { fontSize: 22, fontWeight: 900 },
  sub: { fontSize: 13, color: "#475569", marginTop: 2 },
  label: { fontSize: 12, fontWeight: 800, color: "#475569" },
  select: {
    height: 42,
    padding: "0 12px",
    borderRadius: 12,
    border: "1px solid #e2e8f0",
    background: "white",
    outline: "none",
    fontWeight: 700,
  },
  btn: {
    height: 44,
    borderRadius: 14,
    border: 0,
    background: "#2563eb",
    color: "white",
    fontWeight: 900,
    cursor: "pointer",
    boxShadow: "0 10px 18px rgba(37,99,235,.18)",
  },
  ticketBox: {
    marginTop: 6,
    padding: 14,
    borderRadius: 16,
    border: "1px solid #dbeafe",
    background: "#eff6ff",
    textAlign: "center",
  },
  ticketLabel: { fontSize: 12, fontWeight: 900, color: "#1d4ed8" },
  ticketNumber: { fontSize: 48, fontWeight: 900, letterSpacing: -1 },
  ticketHint: { fontSize: 12, color: "#475569", fontWeight: 700 },
  msg: {
    marginTop: 8,
    padding: 10,
    borderRadius: 14,
    border: "1px solid #fecaca",
    background: "#fef2f2",
    color: "#991b1b",
    fontWeight: 800,
    fontSize: 13,
  },
};
