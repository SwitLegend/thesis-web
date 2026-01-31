// src/pages/Dashboard.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function Dashboard() {
  const { profile, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;

  const role = profile?.role;

  if (role === "admin") return <Navigate to="/admin" replace />;
  if (role === "pharmacist") return <Navigate to="/pharmacist" replace />;

  // kiosk auto goes to kiosk page
  if (role === "kiosk") return <Navigate to="/kiosk" replace />;

  // display auto goes to display page ONLY
  if (role === "display") return <Navigate to="/queue-display" replace />;

  // ✅ customer goes to customer dashboard
  if (role === "customer") return <Navigate to="/customer" replace />;

  return <Navigate to="/unauthorized" replace />;
}
