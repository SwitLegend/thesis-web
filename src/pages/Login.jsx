// src/pages/Login.jsx
import { useMemo, useState } from "react";
import { login, registerUser } from "../services/auth";
import { useAuth } from "../hooks/useAuth";
import { Navigate } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import AppShell from "../components/AppShell";

const makeMotion = (reduce) => {
  const easeOut = [0.16, 1, 0.3, 1];

  return {
    shell: {
      hidden: { opacity: 0, y: reduce ? 0 : 12 },
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
    soft: {
      hidden: { opacity: 0, y: reduce ? 0 : 10 },
      show: {
        opacity: 1,
        y: 0,
        transition: reduce ? { duration: 0 } : { duration: 0.35, ease: easeOut },
      },
    },
    pop: {
      hover: reduce ? {} : { scale: 1.02 },
      tap: reduce ? {} : { scale: 0.985 },
    },
  };
};

export default function Login() {
  const { user, loading } = useAuth();
  const reduce = useReducedMotion();
  const m = useMemo(() => makeMotion(!!reduce), [reduce]);

  // auth mode
  const [mode, setMode] = useState("login"); // "login" | "signup"

  // login + signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup (customer only)
  const [fullName, setFullName] = useState("");

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const isBad = useMemo(() => {
    const t = String(err || "").toLowerCase();
    return t.includes("fail") || t.includes("error") || t.includes("invalid");
  }, [err]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErr("");
    setOk("");

    const em = email.trim();
    if (!em) return setErr("Please enter your email.");
    if (!password) return setErr("Please enter your password.");

    if (mode === "signup") {
      if (!fullName.trim()) return setErr("Please enter your full name.");
      if (String(password).length < 6) return setErr("Password must be at least 6 characters.");
    }

    try {
      setBusy(true);

      if (mode === "login") {
        await login({ email: em, password });
        setOk("Logged in ✅");
      } else {
        // ✅ Customer-only sign up (role is set in registerUser -> "customer")
        await registerUser({ fullName, email: em, password });
        setOk("Account created ✅ Logging you in...");
        // createUserWithEmailAndPassword auto signs in user
      }
    } catch (e2) {
      setErr(e2?.message || (mode === "login" ? "Login failed." : "Sign up failed."));
    } finally {
      setBusy(false);
    }
  }

  // Already signed in
  if (!loading && user) return <Navigate to="/dashboard" replace />;

  return (
    <AppShell
      topbarProps={{
        showNav: false,
        brand: "Pharmacy System",
        showUserMenu: false, // ✅ REMOVE user menu on Login only
      }}
    >
      <div className="authPage">
        <style>{css}</style>

        <motion.div className="authShell" variants={m.shell} initial="hidden" animate="show">
          {/* Left / Brand */}
          <motion.aside className="card brandCard" variants={m.card}>
            <div className="brandHeader">
              <motion.div
                className="logo"
                initial={{ scale: 0.96, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 30 }}
              >
                💊
              </motion.div>

              <div className="brandText">
                <div className="brandTitle">Pharmacy System</div>
                <div className="brandSub">
                  Sign in for <b>Admin</b>, <b>Pharmacist</b>, and <b>Customer</b> access.
                </div>
              </div>
            </div>

            <motion.div className="chips" variants={m.soft}>
              <span className="chip chipBlue">Admin</span>
              <span className="chip chipIndigo">Pharmacist</span>
              <span className="chip chipGreen">Customer</span>
            </motion.div>

            <motion.div className="bullets" variants={m.soft}>
              <div className="bullet">
                <span className="dot ok">✓</span> Manage medicines per branch
              </div>
              <div className="bullet">
                <span className="dot ok">✓</span> Track stock in real-time
              </div>
              <div className="bullet">
                <span className="dot ok">✓</span> Role-based dashboards after login
              </div>
            </motion.div>

            <motion.div className="tip" variants={m.soft}>
              <div className="tipTitle">Phone testing tip</div>
              <div className="tipBody">
                If your PC and phone are on the same Wi-Fi, open the site using your PC IP:
                <div className="tipCode">http://192.168.x.x:5173</div>
              </div>
            </motion.div>
          </motion.aside>

          {/* Right / Auth */}
          <motion.main className="card formCard" variants={m.card} layout>
            {/* Standardized header area */}
            <div className="pageHeader">
              <div className="pageHeaderText">
                <div className="pageTitle">{mode === "login" ? "Welcome back" : "Create Customer Account"}</div>
                <div className="pageSubtitle">
                  {mode === "login"
                    ? "Enter your email and password. You’ll be redirected based on your role."
                    : "This creates a Customer account only. Staff accounts are created by Admin."}
                </div>
              </div>

              <div className="pageHeaderRight">
                <AnimatePresence initial={false}>
                  {loading ? (
                    <motion.div
                      key="checking"
                      className="statusPill"
                      initial={{ opacity: 0, y: reduce ? 0 : 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: reduce ? 0 : 8 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    >
                      Checking session…
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>

            {/* Mode Switch */}
            <div className="segmented" role="tablist" aria-label="Authentication mode">
              <motion.button
                type="button"
                className={mode === "login" ? "segBtn active" : "segBtn"}
                onClick={() => {
                  setMode("login");
                  setErr("");
                  setOk("");
                }}
                disabled={busy}
                whileHover={busy ? undefined : m.pop.hover}
                whileTap={busy ? undefined : m.pop.tap}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 35 }}
                role="tab"
                aria-selected={mode === "login"}
              >
                Sign In
              </motion.button>

              <motion.button
                type="button"
                className={mode === "signup" ? "segBtn active" : "segBtn"}
                onClick={() => {
                  setMode("signup");
                  setErr("");
                  setOk("");
                }}
                disabled={busy}
                whileHover={busy ? undefined : m.pop.hover}
                whileTap={busy ? undefined : m.pop.tap}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 35 }}
                role="tab"
                aria-selected={mode === "signup"}
              >
                Sign Up
              </motion.button>
            </div>

            <form onSubmit={handleSubmit} className="form" aria-busy={busy || loading}>
              {/* Signup-only: Full Name */}
              <AnimatePresence initial={false} mode="popLayout">
                {mode === "signup" ? (
                  <motion.div
                    key="fullname"
                    className="field"
                    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: reduce ? 0 : 10 }}
                    transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                    layout
                  >
                    <label className="label">Full Name</label>
                    <input
                      className="control"
                      placeholder="Juan Dela Cruz"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={busy}
                      autoComplete="name"
                    />
                  </motion.div>
                ) : null}
              </AnimatePresence>

              <div className="field">
                <label className="label">Email</label>
                <input
                  className="control"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  inputMode="email"
                  disabled={busy}
                />
              </div>

              <div className="field">
                <label className="label">Password</label>

                {/* aligned row: input + button */}
                <div className="passRow">
                  <input
                    className="control"
                    placeholder="••••••••"
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    disabled={busy}
                  />

                  <motion.button
                    type="button"
                    className="toggleBtn"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? "Hide password" : "Show password"}
                    title={showPass ? "Hide password" : "Show password"}
                    whileHover={busy ? undefined : { scale: reduce ? 1 : 1.03 }}
                    whileTap={busy ? undefined : { scale: reduce ? 1 : 0.97 }}
                    transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 35 }}
                    disabled={busy}
                  >
                    {showPass ? "Hide" : "Show"}
                  </motion.button>
                </div>

                {mode === "signup" ? <div className="tinyHint">Password must be at least 6 characters.</div> : null}
              </div>

              <motion.button
                type="submit"
                className="btnPrimary"
                disabled={busy || loading}
                whileHover={busy || loading ? undefined : m.pop.hover}
                whileTap={busy || loading ? undefined : m.pop.tap}
                transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 700, damping: 38 }}
              >
                {busy ? (mode === "login" ? "Logging in..." : "Creating...") : mode === "login" ? "Login" : "Create Account"}
              </motion.button>

              <div className="notices" aria-live="polite">
                <AnimatePresence mode="popLayout" initial={false}>
                  {err ? (
                    <motion.div
                      key={`err-${err}`}
                      className={isBad ? "alert bad" : "alert"}
                      initial={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      layout
                    >
                      {err}
                    </motion.div>
                  ) : null}

                  {ok ? (
                    <motion.div
                      key={`ok-${ok}`}
                      className="alert ok"
                      initial={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: reduce ? 0 : 10, scale: reduce ? 1 : 0.99 }}
                      transition={reduce ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      layout
                    >
                      {ok}
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>

              <div className="help">
                <div className="helpTitle">Notes</div>
                <ul className="helpList">
                  <li>Customers can create their own account here.</li>
                  <li>Admin/Pharmacist/Kiosk/Display accounts should be created by Admin.</li>
                  <li>If signup fails, check Firebase Auth + Firestore rules.</li>
                </ul>
              </div>
            </form>
          </motion.main>
        </motion.div>
      </div>
    </AppShell>
  );
}

const css = `
/* =========================
   Theme Tokens
========================= */
:root{
  color-scheme: light;

  --bg0:#ffffff;
  --bg1:#f8fafc;
  --ink:#0f172a;
  --muted:#64748b;
  --muted2:#475569;

  --card: rgba(255,255,255,.86);
  --surface: rgba(255,255,255,.92);
  --surface2: rgba(248,250,252,.85);
  --surfaceSolid: #ffffff;

  --stroke:#e2e8f0;
  --stroke2:#cbd5e1;
  --hairline: rgba(226,232,240,.85);

  --primary:#2563eb;
  --primary-weak: rgba(37,99,235,.12);
  --primary-ink:#1d4ed8;
  --primary-soft:#eff6ff;
  --primary-stroke:#bfdbfe;

  --success-bg:#ecfdf5;
  --success-stroke:#a7f3d0;
  --success-ink:#065f46;

  --danger-bg:#fef2f2;
  --danger-stroke:#fecaca;
  --danger-ink:#991b1b;

  --radius: 18px;
  --radius-sm: 14px;
  --shadow: 0 18px 40px rgba(15,23,42,.08);
  --shadow-sm: 0 10px 20px rgba(15,23,42,.06);

  --logo-bg: var(--primary-soft);
  --logo-stroke: #dbeafe;
  --logo-ink: var(--primary-ink);

  --chip-bg: var(--surfaceSolid);
  --chip-text: var(--ink);

  --chipBlue-bg: #eff6ff;
  --chipBlue-stroke:#bfdbfe;
  --chipBlue-ink:#1d4ed8;

  --chipIndigo-bg:#eef2ff;
  --chipIndigo-stroke:#c7d2fe;
  --chipIndigo-ink:#3730a3;

  --chipGreen-bg:#ecfdf5;
  --chipGreen-stroke:#a7f3d0;
  --chipGreen-ink:#065f46;

  --panel-bg: rgba(248,250,252,.9);

  --input-bg: rgba(255,255,255,.96);
  --placeholder: rgba(100,116,139,.85);

  --btn-ghost-bg: rgba(248,250,252,.95);

  --bg-grad-a: radial-gradient(1100px 520px at 14% 8%, #eef2ff 0%, rgba(238,242,255,0) 60%);
  --bg-grad-b: radial-gradient(900px 520px at 90% 20%, #eff6ff 0%, rgba(239,246,255,0) 60%);
  --bg-grad-c: linear-gradient(180deg, var(--bg1), var(--bg0));
}

[data-theme="dark"]{
  color-scheme: dark;

  --bg0:#050814;
  --bg1:#0b1022;
  --ink:#e5e7eb;
  --muted:#9ca3af;
  --muted2:#cbd5e1;

  --card: rgba(15,23,42,.78);
  --surface: rgba(17,24,39,.72);
  --surface2: rgba(2,6,23,.35);
  --surfaceSolid: #0b1220;

  --stroke:#1f2937;
  --stroke2:#334155;
  --hairline: rgba(51,65,85,.6);

  --primary:#3b82f6;
  --primary-weak: rgba(59,130,246,.20);
  --primary-ink:#93c5fd;
  --primary-soft: rgba(59,130,246,.14);
  --primary-stroke: rgba(59,130,246,.38);

  --success-bg: rgba(16,185,129,.12);
  --success-stroke: rgba(16,185,129,.35);
  --success-ink:#6ee7b7;

  --danger-bg: rgba(239,68,68,.12);
  --danger-stroke: rgba(239,68,68,.35);
  --danger-ink:#fca5a5;

  --shadow: 0 18px 40px rgba(0,0,0,.38);
  --shadow-sm: 0 10px 20px rgba(0,0,0,.28);

  --logo-bg: rgba(59,130,246,.14);
  --logo-stroke: rgba(59,130,246,.35);
  --logo-ink: #93c5fd;

  --chip-bg: rgba(2,6,23,.35);
  --chip-text: var(--ink);

  --chipBlue-bg: rgba(59,130,246,.14);
  --chipBlue-stroke: rgba(59,130,246,.35);
  --chipBlue-ink: #93c5fd;

  --chipIndigo-bg: rgba(99,102,241,.14);
  --chipIndigo-stroke: rgba(99,102,241,.35);
  --chipIndigo-ink: #c7d2fe;

  --chipGreen-bg: rgba(16,185,129,.12);
  --chipGreen-stroke: rgba(16,185,129,.30);
  --chipGreen-ink: #6ee7b7;

  --panel-bg: rgba(2,6,23,.32);

  --input-bg: rgba(2,6,23,.42);
  --placeholder: rgba(148,163,184,.78);

  --btn-ghost-bg: rgba(2,6,23,.34);

  --bg-grad-a: radial-gradient(900px 520px at 14% 8%, rgba(59,130,246,.18) 0%, rgba(59,130,246,0) 60%);
  --bg-grad-b: radial-gradient(900px 520px at 90% 20%, rgba(168,85,247,.16) 0%, rgba(168,85,247,0) 60%);
  --bg-grad-c: linear-gradient(180deg, var(--bg1), var(--bg0));
}

*{ box-sizing:border-box; }
@media (prefers-reduced-motion: reduce){
  *{ scroll-behavior:auto !important; }
}

/* =========================
   Page Layout
========================= */
.authPage{
  min-height: calc(100vh - var(--topbar-h, 64px)); /* ✅ so it fits under Topbar */
  padding: clamp(16px, 3vw, 28px);
  display: grid;
  place-items: center;
  color: var(--ink);
  font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
  background: var(--bg-grad-a), var(--bg-grad-b), var(--bg-grad-c);
}

.authShell{
  width: min(1060px, 100%);
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
  align-items: stretch;
}

/* =========================
   Card
========================= */
.card{
  background: var(--card);
  border: 1px solid var(--stroke);
  border-radius: var(--radius);
  padding: 18px;
  box-shadow: var(--shadow);
  backdrop-filter: blur(10px);
}

/* =========================
   Brand Card
========================= */
.brandHeader{
  display:flex;
  align-items:center;
  gap: 12px;
}

.logo{
  width: 52px;
  height: 52px;
  border-radius: 16px;
  display:grid;
  place-items:center;
  border: 1px solid var(--logo-stroke);
  background: var(--logo-bg);
  color: var(--logo-ink);
  font-size: 22px;
  box-shadow: 0 10px 16px rgba(59,130,246,.10);
}

.brandTitle{
  font-size: 22px;
  font-weight: 950;
  letter-spacing: -0.3px;
}

.brandSub{
  font-size: 13px;
  color: var(--muted2);
  font-weight: 750;
  margin-top: 2px;
  line-height: 1.35;
}

.chips{
  display:flex;
  gap: 8px;
  flex-wrap:wrap;
  margin-top: 12px;
}

.chip{
  font-size: 12px;
  font-weight: 950;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--chip-bg);
  color: var(--chip-text);
}

.chipBlue{ border-color: var(--chipBlue-stroke); background: var(--chipBlue-bg); color: var(--chipBlue-ink); }
.chipIndigo{ border-color: var(--chipIndigo-stroke); background: var(--chipIndigo-bg); color: var(--chipIndigo-ink); }
.chipGreen{ border-color: var(--chipGreen-stroke); background: var(--chipGreen-bg); color: var(--chipGreen-ink); }

.bullets{
  display:grid;
  gap: 10px;
  padding: 12px;
  border-radius: 16px;
  border: 1px dashed var(--stroke2);
  background: var(--panel-bg);
  margin-top: 12px;
}

.bullet{
  display:flex;
  align-items:center;
  gap: 10px;
  font-weight: 850;
  color: var(--ink);
}

.dot{
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display:grid;
  place-items:center;
  font-size: 12px;
  border: 1px solid var(--stroke);
  background: var(--surfaceSolid);
}

.dot.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}

.tip{
  margin-top: 12px;
  border: 1px dashed var(--stroke2);
  background: var(--panel-bg);
  padding: 12px;
  border-radius: var(--radius-sm);
}

.tipTitle{
  font-size: 12px;
  font-weight: 950;
  color: var(--muted2);
}

.tipBody{
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
  margin-top: 6px;
  line-height: 1.55;
}

.tipCode{
  margin-top: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  font-weight: 900;
  color: var(--ink);
  background: var(--surfaceSolid);
  border: 1px solid var(--stroke);
  border-radius: 12px;
  padding: 8px 10px;
  overflow:auto;
  box-shadow: var(--shadow-sm);
}

/* =========================
   Form Card (Standard Header)
========================= */
.formCard{
  display:flex;
  flex-direction:column;
  gap: 12px;
}

.pageHeader{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  align-items:flex-start;
  flex-wrap:wrap;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--hairline);
}

.pageHeaderText{ min-width: 240px; }

.pageTitle{
  font-size: 18px;
  font-weight: 950;
  letter-spacing: -0.2px;
}

.pageSubtitle{
  margin-top: 4px;
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
  line-height: 1.45;
}

.pageHeaderRight{
  display:flex;
  align-items:center;
  gap: 10px;
  flex-wrap: wrap;
}

.statusPill{
  font-size: 12px;
  font-weight: 950;
  padding: 7px 10px;
  border-radius: 999px;
  border: 1px solid var(--stroke);
  background: var(--surfaceSolid);
  color: var(--muted2);
  box-shadow: var(--shadow-sm);
}

/* =========================
   Segmented Control
========================= */
.segmented{
  display:flex;
  gap: 10px;
  padding: 10px;
  border-radius: 16px;
  background: var(--surface2);
  border: 1px solid var(--hairline);
}

.segBtn{
  flex:1;
  height: 40px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surface);
  font-weight: 950;
  cursor:pointer;
  color: var(--ink);
  transition: box-shadow .15s ease, transform .15s ease;
}

.segBtn:hover{
  box-shadow: 0 10px 18px rgba(15,23,42,.06);
}

.segBtn.active{
  border-color: var(--primary-stroke);
  background: var(--primary-soft);
  color: var(--primary-ink);
  box-shadow: 0 12px 22px rgba(37,99,235,.14);
}

.segBtn:disabled{
  opacity: .7;
  cursor: not-allowed;
}

/* =========================
   Form / Inputs
========================= */
.form{
  display:grid;
  gap: 12px;
  margin-top: 2px;
}

.field{
  display:grid;
  gap: 6px;
}

.label{
  font-size: 12px;
  color: var(--muted2);
  font-weight: 900;
}

.control{
  height: 44px;
  padding: 0 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  outline: none;
  background: var(--input-bg);
  font-size: 14px;
  font-weight: 750;
  color: var(--ink);
}

.control::placeholder{
  color: var(--placeholder);
  font-weight: 700;
}

.control:focus{
  border-color: rgba(147,197,253,.9);
  box-shadow: 0 0 0 4px var(--primary-weak);
}

/* password row alignment */
.passRow{
  display:flex;
  gap: 10px;
  align-items: stretch;
}

.passRow .control{
  flex: 1;
  min-width: 0;
}

/* toggle button same height as input */
.toggleBtn{
  height: 44px;
  padding: 0 14px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--btn-ghost-bg);
  color: var(--ink);
  font-weight: 950;
  cursor: pointer;
  white-space: nowrap;
  display:flex;
  align-items:center;
  justify-content:center;
}

.toggleBtn:hover{
  box-shadow: 0 10px 18px rgba(15,23,42,.06);
}

.toggleBtn:disabled{
  opacity:.7;
  cursor:not-allowed;
}

.tinyHint{
  font-size: 12px;
  color: var(--muted);
  font-weight: 750;
  margin-top: 6px;
}

/* =========================
   Primary Button
========================= */
.btnPrimary{
  border: 1px solid rgba(37,99,235,.18);
  background: linear-gradient(180deg, rgba(59,130,246,.98), var(--primary));
  color:#fff;
  padding: 12px 14px;
  border-radius: 14px;
  cursor:pointer;
  font-weight: 950;
  box-shadow: 0 14px 26px rgba(37,99,235,.18);
}

.btnPrimary:disabled{
  opacity:.7;
  cursor:not-allowed;
}

/* =========================
   Notices / Alerts
========================= */
.notices{
  display:grid;
  gap: 10px;
}

.alert{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid var(--stroke);
  background: var(--surfaceSolid);
  font-size: 13px;
  font-weight: 950;
  box-shadow: var(--shadow-sm);
  color: var(--ink);
}

.alert.bad{
  background: var(--danger-bg);
  border-color: var(--danger-stroke);
  color: var(--danger-ink);
}

.alert.ok{
  background: var(--success-bg);
  border-color: var(--success-stroke);
  color: var(--success-ink);
}

/* =========================
   Help Box
========================= */
.help{
  border: 1px dashed var(--stroke2);
  background: var(--panel-bg);
  padding: 12px;
  border-radius: 14px;
}

.helpTitle{
  font-size: 12px;
  font-weight: 950;
  color: var(--muted2);
}

.helpList{
  margin: 8px 0 0;
  padding-left: 18px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 750;
  line-height: 1.6;
}
`;
