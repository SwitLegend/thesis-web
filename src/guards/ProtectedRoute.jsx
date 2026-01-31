// src/guards/ProtectedRoute.jsx
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;

  // profile missing (user exists in Auth but no Firestore user doc)
  if (!profile) return <Navigate to="/unauthorized" replace />;

  if (profile.disabled) {
    return (
      <div style={{ padding: 24 }}>
        <h3>Account Disabled</h3>
        <p>Please contact the administrator.</p>
      </div>
    );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
