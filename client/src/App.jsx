// src/App.jsx
import React from "react";
import { HashRouter as Router, Routes, Route, Navigate, useParams } from "react-router-dom";

import ImageKitProvider from "./components/Forms/ImageKitProvider";
import Login from "./AuthPages/Login";
import ForgotPassword from "./AuthPages/ForgotPassword";
import ResetPassword from "./AuthPages/ResetPassword";
import Register from "./AuthPages/Register";
import VerifyOtp from "./AuthPages/VerifyOtp";
import EmailConfirmed from "./AuthPages/EmailConfirmed";

import ProtectedRoute from "./ProtectedRoute";
import DoctorLayout from "./components/Doctor/DoctorLayout";
import Patients from "./components/Doctor/Patients";
import PatientDetail from "./components/Doctor/PatientDetail";
import VisitDetail from "./components/Doctor/VisitDetail";
import Analytics from "./components/Doctor/Analytics";
import FollowUps from "./components/Doctor/FollowUps";
import AppointmentDashboard from "./components/Doctor/Appointments";
import MultiStepForm from "./components/Forms/MultiStepForm";

// 🔥 NEW: Audit Logs component
import AuditLogs from "./components/Doctor/AuditLogs";

/* --------- Legacy path redirect helpers (preserve :params) --------- */
const RedirectPatientsId = () => {
  const { id } = useParams();
  return <Navigate to={`/doctor/patients/${id}`} replace />;
};

const RedirectVisitId = () => {
  const { visitId } = useParams();
  return <Navigate to={`/doctor/visits/${visitId}`} replace />;
};

const App = () => {
  return (
    <ImageKitProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-otp" element={<VerifyOtp />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/email-confirmed" element={<EmailConfirmed />} />

          {/* Doctor area (includes its own Navbar in DoctorLayout) */}
          <Route
            path="/doctor"
            element={
              <ProtectedRoute>
                <DoctorLayout />
              </ProtectedRoute>
            }
          >
            {/* Patients is the index/start page */}
            <Route index element={<Patients />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientDetail />} />
            <Route path="visits/:visitId" element={<VisitDetail />} />
            <Route path="form" element={<MultiStepForm />} />
            <Route path="followups" element={<FollowUps />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="appointments" element={<AppointmentDashboard />} />

            {/* 🔥 NEW: Audit Logs route */}
            <Route
              path="audit"
              element={
                <AuditLogs
                  mode="recent"
                  // You can pass defaults; component can still allow changing these via UI/filters
                  tableSchema="public"
                  tableName="patients"
                  pageSize={25}
                />
              }
            />
          </Route>

          {/* ---- Backward-compatible redirects for old paths ---- */}
          <Route path="/patients/:id" element={<RedirectPatientsId />} />
          <Route path="/patients" element={<Navigate to="/doctor/patients" replace />} />
          <Route path="/visits/:visitId" element={<RedirectVisitId />} />
          <Route path="/form" element={<Navigate to="/doctor/form" replace />} />
          <Route path="/followups" element={<Navigate to="/doctor/followups" replace />} />
          <Route path="/analytics" element={<Navigate to="/doctor/analytics" replace />} />
          <Route path="/appointments" element={<Navigate to="/doctor/appointments" replace />} />

          {/* Optional: legacy redirect straight to doctor audit */}
          <Route path="/audit" element={<Navigate to="/doctor/audit" replace />} />

          {/* Optional: default redirect */}
          <Route path="*" element={<Navigate to="/doctor" replace />} />
        </Routes>
      </Router>
    </ImageKitProvider>
  );
};

export default App;
