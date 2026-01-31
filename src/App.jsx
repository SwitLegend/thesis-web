// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./guards/ProtectedRoute";
import AppShell from "./components/AppShell";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import PharmacistDashboard from "./pages/PharmacistDashboard";
import Unauthorized from "./pages/Unauthorized";

import AdminBranches from "./pages/AdminBranches";
import AdminMedicines from "./pages/AdminMedicines";
import Inventory from "./pages/Inventory";
import BuilderPage from "./pages/BuilderPage";

import QueueKiosk from "./pages/QueueKiosk";
import QueueDashboard from "./pages/QueueDashboard";
import QueueDisplay from "./pages/QueueDisplay";

import ReserveMeds from "./pages/ReserveMeds";
import VerifyReservation from "./pages/VerifyReservation";
import ReservationsHub from "./pages/ReservationsHub";

import AdminUsers from "./pages/AdminUsers";
import CustomerInventory from "./pages/CustomerInventory";
import CustomerDashboard from "./pages/CustomerDashboard";

import Profile from "./pages/Profile";

/** Smart dashboard redirect by role */
function RoleDashboard() {
  return (
    <ProtectedRoute allowedRoles={["admin", "pharmacist", "kiosk", "display", "customer"]}>
      <Dashboard />
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />

      <Route path="/dashboard" element={<RoleDashboard />} />

      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist", "kiosk", "display", "customer"]}>
            <AppShell>
              <Profile />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Admin */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppShell>
              <AdminDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reservations-hub"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
            <AppShell>
              <ReservationsHub />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/branches"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppShell>
              <AdminBranches />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/medicines"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppShell>
              <AdminMedicines />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <AppShell>
              <AdminUsers />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Pharmacist */}
      <Route
        path="/pharmacist"
        element={
          <ProtectedRoute allowedRoles={["pharmacist"]}>
            <AppShell>
              <PharmacistDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Inventory (admin + pharmacist) */}
      <Route
        path="/inventory"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
            <AppShell>
              <Inventory />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Queue */}
      <Route
        path="/kiosk"
        element={
          <ProtectedRoute allowedRoles={["admin", "kiosk"]}>
            <AppShell topbarProps={{ showNav: false }}>
              <QueueKiosk />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/queue-dashboard"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
            <AppShell>
              <QueueDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/queue-display"
        element={
          <ProtectedRoute allowedRoles={["display", "kiosk", "admin", "pharmacist"]}>
            <AppShell topbarProps={{ showNav: false }}>
              <QueueDisplay />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Customer */}
      <Route
        path="/customer"
        element={
          <ProtectedRoute allowedRoles={["customer"]}>
            <AppShell>
              <CustomerDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reserve"
        element={
          <ProtectedRoute allowedRoles={["customer", "kiosk", "admin", "pharmacist"]}>
            <AppShell>
              <ReserveMeds />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/verify-reservation"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
            <AppShell>
              <VerifyReservation />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/stock"
        element={
          <ProtectedRoute allowedRoles={["customer", "kiosk", "admin", "pharmacist"]}>
            <AppShell>
              <CustomerInventory />
            </AppShell>
          </ProtectedRoute>
        }
      />

      {/* Builder */}
      <Route
        path="/builder/*"
        element={
          <ProtectedRoute allowedRoles={["admin", "pharmacist"]}>
            <AppShell>
              <BuilderPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
    </Routes>
  );
}
