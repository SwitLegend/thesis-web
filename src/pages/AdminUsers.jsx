// src/pages/AdminUsers.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ROLES,
  adminCreateUser,
  adminListUsers,
  adminSetUserDisabled,
  adminUpdateUserRole,
} from "../services/userAdminService";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

export default function AdminUsers() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  const fadeUp = useMemo(
    () => ({
      hidden: { opacity: 0, y: reduce ? 0 : 10 },
      show: (d = 0) => ({
        opacity: 1,
        y: 0,
        transition: reduce
          ? { duration: 0 }
          : { delay: d, duration: 0.22, ease: "easeOut" },
      }),
    }),
    [reduce]
  );

  const pop = useMemo(
    () => ({
      hover: reduce ? undefined : { scale: 1.02 },
      tap: reduce ? undefined : { scale: 0.97 },
    }),
    [reduce]
  );

  const [users, setUsers] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // ✅ search
  const [search, setSearch] = useState("");

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    role: "pharmacist",
  });

  const isBadMsg = useMemo(() => {
    const t = String(msg || "").toLowerCase();
    return t.includes("fail") || t.includes("error") || t.includes("invalid");
  }, [msg]);

  async function load() {
    const list = await adminListUsers();
    setUsers(list || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setMsg("");

    try {
      setBusy(true);
      await adminCreateUser(form);
      setMsg("✅ Account created!");
      setForm({ fullName: "", email: "", password: "", role: "pharmacist" });
      await load();
    } catch (e2) {
      setMsg(e2?.message || "Failed to create user.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(uid, role) {
    setMsg("");
    try {
      setBusy(true);
      await adminUpdateUserRole(uid, role);
      await load();
      setMsg("Role updated ✅");
    } catch (e) {
      setMsg(e?.message || "Failed to update role.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleDisabled(uid, disabled) {
    setMsg("");
    try {
      setBusy(true);
      await adminSetUserDisabled(uid, disabled);
      await load();
      setMsg(disabled ? "User disabled ✅" : "User enabled ✅");
    } catch (e) {
      setMsg(e?.message || "Failed to update disabled.");
    } finally {
      setBusy(false);
    }
  }

  // ✅ filter by name/email/role
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      const name = String(u.fullName || "").toLowerCase();
      const email = String(u.email || "").toLowerCase();
      const role = String(u.role || "").toLowerCase();
      return name.includes(q) || email.includes(q) || role.includes(q);
    });
  }, [users, search]);

  return (
    <div className="auPage adminUsers">
      <style>{css}</style>

      <motion.div className="auShell" initial="hidden" animate="show">
        {/* Header */}
        <motion.div className="auHeader" variants={fadeUp} custom={0}>
          <div className="auHeaderLeft">
            <motion.button
              onClick={() => navigate(-1)}
              className="btnGhost"
              whileHover={pop.hover}
              whileTap={pop.tap}
              disabled={busy}
            >
              ← Back
            </motion.button>

            <div className="auTopText">
              <div className="auTitle">Manage Accounts</div>
              <div className="auSub">Create users + assign roles (admin only)</div>
            </div>
          </div>

          <div className="auHeaderRight">
            <span className="pill pillWide">
              Users: <b>{users.length}</b>
            </span>
            {busy ? <span className="pill pillSoft">Working…</span> : null}
          </div>
        </motion.div>

        {/* Create */}
        <motion.div className="card" variants={fadeUp} custom={0.05}>
          <div className="cardHead">
            <div>
              <div className="cardTitle">Create Account</div>
              <div className="cardHint">
                Create a user and assign a role. Password must be at least 6 characters.
              </div>
            </div>
          </div>

          <form onSubmit={handleCreate} className="formGrid">
            <div className="field">
              <label className="label">Full name</label>
              <input
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                className="control"
                placeholder="Juan Dela Cruz"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="control"
                placeholder="user@email.com"
                disabled={busy}
                inputMode="email"
              />
            </div>

            <div className="field">
              <label className="label">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="control"
                placeholder="min 6 chars"
                disabled={busy}
              />
            </div>

            <div className="field">
              <label className="label">Role</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="control"
                disabled={busy}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <motion.button
              type="submit"
              className="btnPrimary"
              disabled={busy}
              whileHover={pop.hover}
              whileTap={pop.tap}
            >
              {busy ? "Working..." : "Create Account"}
            </motion.button>

            <AnimatePresence>
              {msg ? (
                <motion.div
                  key={msg}
                  className={isBadMsg ? "toast bad" : "toast ok"}
                  initial={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: reduce ? 0 : 8, scale: reduce ? 1 : 0.98 }}
                  transition={reduce ? { duration: 0 } : { duration: 0.18, ease: "easeOut" }}
                >
                  {msg}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </form>
        </motion.div>

        {/* Users list */}
        <motion.div className="card" variants={fadeUp} custom={0.09}>
          <div className="cardHead">
            <div>
              <div className="cardTitle">Users</div>
              <div className="cardHint">Search, change role, or enable/disable an account.</div>
            </div>

            <div className="usersHeadRight">
              <div className="searchWrap">
                <input
                  className="searchInput"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name / email / role…"
                />
                {search ? (
                  <button
                    type="button"
                    className="clearBtn"
                    onClick={() => setSearch("")}
                    title="Clear"
                  >
                    ✕
                  </button>
                ) : null}
              </div>

              <span className="chip" title="Shown / Total">
                {filteredUsers.length} / {users.length}
              </span>
            </div>
          </div>

          <div className="table">
            <div className="tHead">
              <div>User</div>
              <div>Role</div>
              <div>Status</div>
              <div className="right">Actions</div>
            </div>

            <div className="tBody">
              <AnimatePresence initial={false}>
                {filteredUsers.map((u, idx) => (
                  <motion.div
                    key={u.id}
                    className="tRow"
                    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : 10 }}
                    transition={
                      reduce
                        ? { duration: 0 }
                        : {
                            duration: 0.18,
                            ease: "easeOut",
                            delay: Math.min(idx * 0.015, 0.18),
                          }
                    }
                  >
                    <div className="userCell">
                      <div className="userName">{u.fullName || "—"}</div>
                      <div className="userEmail">{u.email || u.id}</div>
                    </div>

                    <div className="roleCell">
                      <select
                        value={u.role || "customer"}
                        onChange={(e) => changeRole(u.id, e.target.value)}
                        className="selectSmall"
                        disabled={busy}
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="statusCell">
                      <span className={u.disabled ? "badge bad" : "badge ok"}>
                        {u.disabled ? "disabled" : "active"}
                      </span>
                    </div>

                    <div className="actions">
                      <motion.button
                        onClick={() => toggleDisabled(u.id, !u.disabled)}
                        disabled={busy}
                        className={u.disabled ? "btnSoftOk" : "btnSoftDanger"}
                        whileHover={pop.hover}
                        whileTap={pop.tap}
                      >
                        {u.disabled ? "Enable" : "Disable"}
                      </motion.button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {!filteredUsers.length ? (
                <div className="empty">
                  {search ? (
                    <>
                      No users match <b>{search}</b>.
                    </>
                  ) : (
                    "No users found."
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}

const css = `
/* =========================
   Scoped Theme Tokens
========================= */
.adminUsers{
  --bg0:#ffffff;
  --bg1:#f8fafc;

  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.88);
  --surface: rgba(255,255,255,.96);
  --surface2: rgba(248,250,252,.95);

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --divider: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);

  --ok-bg:#ecfdf5;
  --ok-stroke:#a7f3d0;
  --ok-ink:#065f46;

  --bad-bg:#fef2f2;
  --bad-stroke:#fecaca;
  --bad-ink:#991b1b;

  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);
}

html.dark .adminUsers,
[data-theme="dark"] .adminUsers{
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

  --ok-bg: rgba(16,185,129,.12);
  --ok-stroke: rgba(16,185,129,.35);
  --ok-ink:#6ee7b7;

  --bad-bg: rgba(239,68,68,.12);
  --bad-stroke: rgba(239,68,68,.35);
  --bad-ink:#fca5a5;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);
}

.adminUsers,
.adminUsers *{ box-sizing:border-box; }

/* =========================
   Page
========================= */
.adminUsers.auPage{
  min-height:100vh;
  padding: clamp(16px, 3vw, 28px);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  color: var(--ink);

  background:
    radial-gradient(1200px 600px at 20% 10%, #eef2ff 0%, rgba(238,242,255,0) 52%),
    radial-gradient(900px 520px at 90% 18%, #eff6ff 0%, rgba(239,246,255,0) 58%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

html.dark .adminUsers.auPage,
[data-theme="dark"] .adminUsers.auPage{
  background:
    radial-gradient(900px 520px at 20% 10%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%),
    radial-gradient(900px 520px at 90% 18%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%),
    linear-gradient(180deg, var(--bg1), var(--bg0));
}

.adminUsers .auShell{
  max-width: 1100px;
  margin: 0 auto;
  display:grid;
  gap: 16px;
}

/* =========================
   Header
========================= */
.adminUsers .auHeader{
  display:flex;
  gap: 12px;
  justify-content:space-between;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--divider);
}
.adminUsers .auHeaderLeft{
  display:flex;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
  min-width: 0;
  flex: 1 1 auto;
}
.adminUsers .auTopText{ display:grid; gap: 2px; min-width: 0; }
.adminUsers .auTitle{ font-size: 24px; font-weight: 950; letter-spacing: -0.25px; }
.adminUsers .auSub{ font-size: 13px; color: var(--muted2); font-weight: 750; line-height: 1.45; }

.adminUsers .auHeaderRight{
  display:flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items:center;
  justify-content:flex-end;
  margin-left:auto;
  min-width: 0;
}

.adminUsers .pill{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius: 999px;
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  white-space: nowrap;
  display:inline-flex;
  align-items:center;
  justify-content:space-between;
  gap: 8px;
  box-shadow: var(--shadow-sm);
}
.adminUsers .pill b{
  display:inline-block;
  min-width: 0;
  overflow:hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 18ch;
}
.adminUsers .pillSoft{
  background: var(--surface2);
  color: var(--muted2);
}
.adminUsers .pillWide{ max-width: 100%; }

/* mobile header */
@media (max-width: 520px){
  .adminUsers.auPage{ padding: 14px; }
  .adminUsers .auTitle{ font-size: 20px; }
  .adminUsers .auSub{ font-size: 12px; }
  .adminUsers .auHeaderLeft{ width: 100%; }
  .adminUsers .auHeaderRight{ width: 100%; justify-content: flex-start; }
  .adminUsers .pillWide{ width: 100%; }
  .adminUsers .pillWide b{ max-width: 14ch; text-align:right; }
}

/* =========================
   Cards
========================= */
.adminUsers .card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: 18px;
  padding: 16px;
  box-shadow: var(--shadow-sm);
  backdrop-filter: blur(6px);
}
.adminUsers .cardHead{
  display:flex;
  justify-content:space-between;
  align-items:baseline;
  gap: 12px;
  flex-wrap:wrap;
  margin-bottom: 10px;
}
.adminUsers .cardTitle{ font-size: 16px; font-weight: 950; }
.adminUsers .cardHint{ font-size: 12px; color: var(--muted); font-weight: 750; }

.adminUsers .chip{
  font-size:12px;
  font-weight:950;
  padding:6px 10px;
  border-radius:999px;
  border:1px solid var(--stroke);
  background: var(--surface2);
  color: var(--muted2);
  white-space: nowrap;
  display:inline-flex;
  align-items:center;
}

/* users head right (search + count) */
.adminUsers .usersHeadRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
  justify-content:flex-end;
}
@media (max-width: 520px){
  .adminUsers .usersHeadRight{ width: 100%; justify-content: flex-start; }
}

.adminUsers .searchWrap{ position:relative; }
.adminUsers .searchInput{
  height: 36px;
  width: min(340px, 72vw);
  padding: 0 36px 0 10px;
  border-radius: 12px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  color: var(--ink);
  font-weight: 850;
  font-size: 13px;
}
.adminUsers .searchInput:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 3px var(--primary-weak);
}
.adminUsers .searchInput::placeholder{ font-weight: 800; color: var(--muted); }

.adminUsers .clearBtn{
  position:absolute;
  right: 6px;
  top: 50%;
  transform: translateY(-50%);
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  padding: 0;
  line-height: 1;
  border-radius: 10px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  cursor:pointer;
  font-weight: 950;
  font-size: 14px;
  color: var(--muted2);
}
.adminUsers .clearBtn:hover{ background: var(--surface2); }

/* =========================
   Form
========================= */
.adminUsers .formGrid{
  display:grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  align-items:end;
}
.adminUsers .field{ display:grid; gap: 6px; min-width: 0; }
.adminUsers .label{ font-size: 12px; color: var(--muted2); font-weight: 900; }

.adminUsers .control{
  height: 42px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--surface);
  color: var(--ink);
  font-size: 14px;
  font-weight: 750;
  min-width: 0;
}
.adminUsers .control:focus{
  border-color:#93c5fd;
  box-shadow: 0 0 0 3px var(--primary-weak);
}

.adminUsers .btnPrimary{
  grid-column: 1 / -1;
  border: 0;
  background: var(--primary);
  color: #fff;
  padding: 12px 14px;
  border-radius: 14px;
  cursor: pointer;
  font-weight: 950;
  box-shadow: 0 10px 18px rgba(37,99,235,.16);
}
html.dark .adminUsers .btnPrimary,
[data-theme="dark"] .adminUsers .btnPrimary{
  box-shadow: 0 16px 30px rgba(59,130,246,.16);
}
.adminUsers .btnPrimary:disabled{ opacity:.7; cursor:not-allowed; }

.adminUsers .btnGhost{
  border:1px solid var(--stroke);
  background: var(--surface);
  color: var(--ink);
  padding:10px 12px;
  border-radius:14px;
  cursor:pointer;
  font-weight:950;
  box-shadow: var(--shadow-sm);
  white-space: nowrap;
}
.adminUsers .btnGhost:hover{ background: var(--surface2); }
.adminUsers .btnGhost:disabled{ opacity:.7; cursor:not-allowed; }

.adminUsers .toast{
  grid-column: 1 / -1;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-size: 13px;
  font-weight: 950;
}
.adminUsers .toast.ok{ background: var(--ok-bg); border-color: var(--ok-stroke); color: var(--ok-ink); }
.adminUsers .toast.bad{ background: var(--bad-bg); border-color: var(--bad-stroke); color: var(--bad-ink); }

/* =========================
   Table
========================= */
.adminUsers .table{
  border: 1px solid var(--stroke);
  border-radius: 16px;
  overflow: hidden;
  background: var(--surface);
}
.adminUsers .tHead{
  display:grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr 0.9fr;
  gap: 10px;
  padding: 12px;
  background: var(--surface2);
  color: var(--muted2);
  font-weight: 950;
  font-size: 12px;
}
.adminUsers .tBody{ display:grid; }
.adminUsers .tRow{
  display:grid;
  grid-template-columns: 1.3fr 0.7fr 0.6fr 0.9fr;
  gap: 10px;
  padding: 12px;
  border-top: 1px solid var(--divider);
  align-items:center;
}
.adminUsers .tRow:hover{ background: var(--surface2); }

.adminUsers .userCell{ min-width:0; display:grid; gap: 2px; }
.adminUsers .userName{
  font-weight: 950;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}
.adminUsers .userEmail{
  font-size: 12px;
  color: var(--muted);
  font-weight: 800;
  overflow:hidden;
  text-overflow:ellipsis;
  white-space:nowrap;
}

.adminUsers .roleCell,
.adminUsers .statusCell{
  display:flex;
  align-items:center;
  min-width:0;
}
.adminUsers .roleCell{ justify-content:flex-start; }
.adminUsers .statusCell{ justify-content:flex-start; }

.adminUsers .selectSmall{
  height: 38px;
  min-height: 38px;
  border-radius: 12px;
  border: 1px solid var(--stroke);
  padding: 0 10px;
  font-weight: 900;
  background: var(--surface);
  color: var(--ink);
  width: 100%;
  max-width: 260px;
  line-height: 1.1;
}
.adminUsers .selectSmall:focus{
  outline: none;
  border-color:#93c5fd;
  box-shadow: 0 0 0 3px var(--primary-weak);
}

/* ✅ PROFESSIONAL BADGE (modern, padded, perfectly centered) */
.adminUsers .badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-height: 32px;
  padding: 7px 14px;
  border-radius: 999px;
  border: 1px solid;
  font-size: 12px;
  font-weight: 950;
  line-height: 1;
  letter-spacing: 0.2px;
  box-shadow: var(--shadow-sm);
  -webkit-font-smoothing: antialiased;
  text-rendering: geometricPrecision;
  white-space: nowrap;
}
.adminUsers .badge.ok{
  background: var(--ok-bg);
  color: var(--ok-ink);
  border-color: var(--ok-stroke);
}
.adminUsers .badge.bad{
  background: var(--bad-bg);
  color: var(--bad-ink);
  border-color: var(--bad-stroke);
}

/* actions */
.adminUsers .actions{
  display:flex;
  justify-content:flex-end;
  gap: 8px;
  flex-wrap:wrap;
  align-items:center;
}
.adminUsers .right{ text-align:right; }

.adminUsers .btnSoftDanger,
.adminUsers .btnSoftOk{
  min-height: 38px;
  border-radius: 12px;
  cursor:pointer;
  font-weight: 950;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  line-height: 1;
  padding: 8px 12px;
  background: var(--surface);
}
.adminUsers .btnSoftDanger{
  border: 1px solid var(--bad-stroke);
  color: var(--bad-ink);
}
.adminUsers .btnSoftOk{
  border: 1px solid var(--ok-stroke);
  background: var(--ok-bg);
  color: var(--ok-ink);
}
.adminUsers .btnSoftDanger:disabled,
.adminUsers .btnSoftOk:disabled{ opacity:.7; cursor:not-allowed; }

/* ✅ Mobile layout */
@media (max-width: 860px){
  .adminUsers .tHead{ display:none; }

  .adminUsers .tRow{
    grid-template-columns: 1fr;
    gap: 10px;
    align-items: stretch;
  }

  .adminUsers .roleCell,
  .adminUsers .statusCell{
    justify-content:center;
  }

  .adminUsers .selectSmall{
    max-width: 520px;
    width: 100%;
    height: 44px;
    min-height: 44px;
    border-radius: 14px;
    padding: 0 12px;
    font-size: 16px; /* iOS Safari prevents zoom */
  }

  .adminUsers .badge{
    width: 100%;
    max-width: 520px;
    min-height: 34px;
    padding: 8px 16px;
    border-radius: 999px;
  }

  .adminUsers .actions{
    width: 100%;
    justify-content:center;
  }

  .adminUsers .btnSoftDanger,
  .adminUsers .btnSoftOk{
    width: 100%;
    max-width: 520px;
    min-height: 44px;
    border-radius: 14px;
    font-size: 15px;
  }
}

.adminUsers .empty{
  padding: 14px;
  color: var(--muted);
  font-weight: 950;
}
`;
