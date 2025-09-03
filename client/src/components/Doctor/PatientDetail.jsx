// src/pages/PatientDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import {
  getPatient,
  getMedicalHistory,
  upsertMedicalHistory,
  listVisitsByPatient,
  updatePatientSmart,
  deletePatient,
} from "../../utils/api";

/* ---------- constants ---------- */
const RELATION_OPTS = [
  { value: "Parent", label: "Parent" },
  { value: "Spouse", label: "Spouse" },
  { value: "Sibling", label: "Sibling" },
  { value: "Friend", label: "Friend" },
  { value: "Guardian", label: "Guardian" },
  { value: "Child", label: "Child" },
  { value: "Other", label: "Other" },
];

const GENDER_OPTS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
];

const YN_OPTS = [
  { value: "", label: "—" },
  { value: "Yes", label: "Yes" },
  { value: "No", label: "No" },
];

/* ---------- helpers ---------- */
const formatDate = (v) => {
  if (!v) return "Not specified";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "Not specified"
    : d.toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
};

const formatDateTime = (v) => {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const inr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(Number(value || 0))
    .replace("₹", "₹ ");

const calcAge = (dob) => {
  if (!dob) return "";
  const d = new Date(dob);
  if (isNaN(d.getTime())) return "";
  const today = new Date();
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
  return a >= 0 ? String(a) : "";
};

const displayText = (v) => {
  if (v === null || v === undefined) return "—";
  const s = String(v).trim();
  if (!s) return "—";
  if (s.toLowerCase() === "null") return "—";
  return s;
};

const displayYesNo = (v) => (v === "Yes" || v === "No" ? v : "—");

/* Map DB row -> edit form (camelCase keys expected by API) */
const patientToForm = (p) => ({
  firstName: p.first_name || "",
  lastName: p.last_name || "",
  dob: p.dob ? p.dob.slice(0, 10) : "", // YYYY-MM-DD
  gender: p.gender || "",
  phone: p.phone || "",
  email: p.email || "",
  addressLine1: p.address_line1 || "",
  addressLine2: p.address_line2 || "",
  city: p.city || "",
  state: p.state || "",
  pincode: p.pincode || "",
  occupation: p.occupation || "",
  emergencyContact: {
    name: p.emergency_contact?.name || "",
    phone: p.emergency_contact?.phone || "",
    relation: p.emergency_contact?.relation || "",
  },
  // Keep current (signed or public) URL for display; real update happens via updatePatientSmart
  photoUrl: p.photo_url || "",
  // internal only (File). Not sent verbatim to API. updatePatientSmart consumes it.
  _photoFile: null,
});

/* ---------------- Medical History form mapping ---------------- */
const emptyMhForm = () => ({
  surgeryOrHospitalized: "",
  surgeryDetails: "",
  feverColdCough: "",
  feverDetails: "",
  abnormalBleedingHistory: "",
  abnormalBleedingDetails: "",
  takingMedicine: "",
  medicineDetails: "",
  medicationAllergy: "",
  medicationAllergyDetails: "",
  pastDentalHistory: "",
  problems: {
    artificialValvesPacemaker: false,
    asthma: false,
    allergy: false,
    bleedingTendency: false,
    epilepsySeizure: false,
    heartDisease: false,
    hypHypertension: false,
    hormoneDisorder: false,
    jaundiceLiver: false,
    stomachUlcer: false,
    lowHighPressure: false,
    arthritisJoint: false,
    kidneyProblems: false,
    thyroidProblems: false,
    otherProblem: false,
    otherProblemText: "",
  },
});

const mhRowToForm = (row) => {
  if (!row) return emptyMhForm();
  return {
    surgeryOrHospitalized: row.surgery_or_hospitalized ?? "",
    surgeryDetails: row.surgery_details ?? "",
    feverColdCough: row.fever_cold_cough ?? "",
    feverDetails: row.fever_details ?? "",
    abnormalBleedingHistory: row.abnormal_bleeding_history ?? "",
    abnormalBleedingDetails: row.abnormal_bleeding_details ?? "",
    takingMedicine: row.taking_medicine ?? "",
    medicineDetails: row.medicine_details ?? "",
    medicationAllergy: row.medication_allergy ?? "",
    medicationAllergyDetails: row.medication_allergy_details ?? "",
    pastDentalHistory: row.past_dental_history ?? "",
    problems: {
      artificialValvesPacemaker: !!row.artificial_valves_pacemaker,
      asthma: !!row.asthma,
      allergy: !!row.allergy,
      bleedingTendency: !!row.bleeding_tendency,
      epilepsySeizure: !!row.epilepsy_seizure,
      heartDisease: !!row.heart_disease,
      hypHypertension: !!row.hyp_hypertension,
      hormoneDisorder: !!row.hormone_disorder,
      jaundiceLiver: !!row.jaundice_liver,
      stomachUlcer: !!row.stomach_ulcer,
      lowHighPressure: !!row.low_high_pressure,
      arthritisJoint: !!row.arthritis_joint,
      kidneyProblems: !!row.kidney_problems,
      thyroidProblems: !!row.thyroid_problems,
      otherProblem: !!row.other_problem,
      otherProblemText: row.other_problem_text ?? "",
    },
  };
};

/* ---------- page ---------- */
const PatientDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [mh, setMh] = useState(null);
  const [mhEditMode, setMhEditMode] = useState(false);
  const [mhForm, setMhForm] = useState(emptyMhForm());
  const [mhSaving, setMhSaving] = useState(false);
  const [mhErr, setMhErr] = useState("");

  const [visits, setVisits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("profile");

  // Inline edit inside Profile tab
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(patientToForm({}));
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // Delete
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // NEW: forbidden delete modal state
  const [forbiddenModal, setForbiddenModal] = useState({ open: false, message: "" });

  // Photo edit
  const fileInputRef = useRef(null);
  const [photoErr, setPhotoErr] = useState("");
  const previewUrlRef = useRef(null); // to revoke blob URLs

  const profileRef = useRef(null);

  // Helper: try to extract an HTTP status from different error shapes
  const getHttpStatus = (error) =>
    error?.status ??
    error?.response?.status ??
    error?.cause?.status ??
    error?.statusCode ??
    null;

  // Helper: detect forbidden delete errors (403 or a specific message)
  const isForbiddenDeleteError = (error) => {
    const status = Number(getHttpStatus(error));
    const msg = String(error?.message || "").toLowerCase();
    return status === 403 || msg.includes("only the creator can delete");
  };

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setErr("Missing patient id");
      setLoading(false);
      return;
    }
    (async () => {
      try {
        setLoading(true);
        setErr("");
        const [{ patient: p }, mhRowOrNull, vRows] = await Promise.all([
          getPatient(id),
          getMedicalHistory(id).catch(() => null),
          listVisitsByPatient(id, { limit: 200 }).catch(() => []),
        ]);
        if (!mounted) return;
        setPatient(p || null);
        setForm(p ? patientToForm(p) : patientToForm({}));
        setMh(mhRowOrNull || null);
        setMhForm(mhRowToForm(mhRowOrNull));
        setVisits(Array.isArray(vRows) ? vRows : []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.message || "Failed to load patient detail");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
      // cleanup preview URL on unmount
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [id]);

  const address = useMemo(() => {
    if (!patient) return "";
    const parts = [
      patient.address_line1,
      patient.address_line2,
      patient.city,
      patient.state,
    ].filter(Boolean);
    const line = parts.join(", ");
    return patient.pincode ? `${line}${line ? " - " : ""}${patient.pincode}` : line;
  }, [patient]);

  const visitsSorted = useMemo(() => {
    const arr = Array.isArray(visits) ? [...visits] : [];
    return arr.sort((a, b) => {
      const da = new Date(a.visit_at || 0).getTime();
      const db = new Date(b.visit_at || 0).getTime();
      return db - da; // newest first
    });
  }, [visits]);

  const problemChips = useMemo(() => {
    if (!mh) return [];
    const chips = [];
    const add = (ok, label) => ok && chips.push(label);

    add(!!mh.artificial_valves_pacemaker, "Artificial Valves/Pacemakers");
    add(!!mh.asthma, "Asthma");
    add(!!mh.allergy, "Allergy");
    add(!!mh.bleeding_tendency, "Bleeding Disorder");
    add(!!mh.epilepsy_seizure, "Epilepsy/Seizure");
    add(!!mh.heart_disease, "Heart Disease");
    add(!!mh.hyp_hypertension, "Hypertension/Hypotension");
    add(!!mh.hormone_disorder, "Hormone Disorder");
    add(!!mh.jaundice_liver, "Jaundice/Liver Disease");
    add(!!mh.stomach_ulcer, "Stomach Ulcer");
    add(!!mh.low_high_pressure, "Low/High Pressure");
    add(!!mh.arthritis_joint, "Arthritis/Joint Problem");
    add(!!mh.kidney_problems, "Kidney Problems");
    add(!!mh.thyroid_problems, "Thyroid Problems");
    if (mh.other_problem) {
      chips.push(`Other: ${displayText(mh.other_problem_text)}`);
    }
    return chips;
  }, [mh]);

  // Calculate financial summary (align with DB trigger that ensures due >= 0)
  const financialSummary = useMemo(() => {
    let totalAmount = 0;
    let totalPaid = 0;
    let totalDue = 0;

    visits.forEach((visit) => {
      const arr = Array.isArray(visit.procedures) ? visit.procedures : [];
      arr.forEach((proc) => {
        const amount = Number(proc?.total ?? 0);
        const paid = Number(proc?.paid ?? 0);
        // Prefer DB-computed due; fallback to capped difference
        const due = Number(proc?.due ?? Math.max(amount - paid, 0));

        totalAmount += amount;
        totalPaid += paid;
        totalDue += due;
      });
    });

    return { totalAmount, totalPaid, totalDue };
  }, [visits]);

  /* -------------------- react-select helpers -------------------- */
  const genderSelected = useMemo(
    () => GENDER_OPTS.find((o) => o.value === (form.gender || "")) || null,
    [form.gender]
  );

  const relationSelected = useMemo(
    () =>
      RELATION_OPTS.find(
        (o) => o.value === (form.emergencyContact?.relation || "")
      ) || null,
    [form.emergencyContact?.relation]
  );

  // Tailwind-friendly react-select base styles
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: 40,
      borderColor: state.isFocused ? "#6366f1" : "#d1d5db",
      boxShadow: state.isFocused ? "0 0 0 1px #6366f1" : "none",
      "&:hover": { borderColor: state.isFocused ? "#6366f1" : "#9ca3af" },
      borderRadius: 8,
      cursor: "pointer",
    }),
    valueContainer: (base) => ({ ...base, padding: "0 0.5rem" }),
    placeholder: (base) => ({ ...base, color: "#9ca3af" }),
    input: (base) => ({ ...base, margin: 0, padding: 0 }),
    singleValue: (base) => ({ ...base, margin: 0 }),
    indicatorsContainer: (base) => ({ ...base, paddingRight: 6 }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  /* -------------------- profile edit / photo / delete handlers -------------------- */
  const startInlineEdit = () => {
    if (patient) setForm(patientToForm(patient));
    setSaveErr("");
    setPhotoErr("");
    setActiveTab("profile");
    setEditMode(true);
    setTimeout(() => {
      profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  const cancelInlineEdit = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (patient) setForm(patientToForm(patient));
    setEditMode(false);
    setSaveErr("");
    setPhotoErr("");
  };

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name.startsWith("emergencyContact.")) {
      const key = name.split(".")[1];
      setForm((f) => ({
        ...f,
        emergencyContact: { ...(f.emergencyContact || {}), [key]: value },
      }));
    } else {
      setForm((f) => ({ ...f, [name]: value }));
    }
  };

  const onClickEditPhoto = () => fileInputRef.current?.click();

  const onPhotoFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setPhotoErr("");
      if (!file.type.startsWith("image/")) {
        setPhotoErr("Please choose an image file.");
        e.target.value = "";
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        setPhotoErr("Image must be under 4 MB.");
        e.target.value = "";
        return;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      const previewUrl = URL.createObjectURL(file);
      previewUrlRef.current = previewUrl;
      setForm((f) => ({ ...f, photoUrl: previewUrl, _photoFile: file }));
    } catch {
      setPhotoErr("Failed to load image. Try another file.");
    } finally {
      e.target.value = "";
    }
  };

  const saveInlineEdit = async (e) => {
    e?.preventDefault?.();
    if (!id) return;
    try {
      setSaving(true);
      setSaveErr("");
      const updated = await updatePatientSmart(id, { ...form, photoFile: form._photoFile });
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
      setPatient(updated);
      setForm(patientToForm(updated));
      setEditMode(false);
    } catch (error) {
      setSaveErr(error?.message || "Failed to update patient");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await deletePatient(id);
      navigate("/patients");
    } catch (error) {
      // Show a friendly modal if the user is not allowed to delete
      if (isForbiddenDeleteError(error)) {
        setForbiddenModal({
          open: true,
          message: error?.message || "Only the creator can delete this patient.",
        });
      } else {
        setErr(error?.message || "Failed to delete patient");
      }
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  // Which photo to show
  const currentPhotoSrc = useMemo(() => {
    if (editMode) return form.photoUrl || patient?.photo_url || "";
    return patient?.photo_url || "";
  }, [editMode, form.photoUrl, patient?.photo_url]);

  /* -------------------- Medical History handlers -------------------- */
  const startMhEdit = () => {
    setMhErr("");
    setMhForm(mhRowToForm(mh));
    setMhEditMode(true);
    setActiveTab("medical");
  };

  const cancelMhEdit = () => {
    setMhErr("");
    setMhForm(mhRowToForm(mh));
    setMhEditMode(false);
  };

  const setMhField = (name, value) => setMhForm((f) => ({ ...f, [name]: value }));

  const setMhProblem = (key, value) =>
    setMhForm((f) => ({ ...f, problems: { ...(f.problems || {}), [key]: !!value } }));

  const saveMh = async () => {
    if (!id) return;
    try {
      setMhSaving(true);
      setMhErr("");
      const saved = await upsertMedicalHistory(id, mhForm);
      setMh(saved); // server row (snake_case)
      setMhForm(mhRowToForm(saved));
      setMhEditMode(false);
    } catch (e) {
      setMhErr(e?.message || "Failed to save medical history");
    } finally {
      setMhSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
          <div className="mb-4 sm:mb-0">
            <button
              onClick={() => navigate("/patients")}
              className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 transition-colors duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Patients
            </button>
            <h1 className="text-3xl font-bold text-gray-900">Patient Details</h1>
            {patient && (
              <p className="text-sm text-gray-600 mt-2">
                {patient.first_name} {patient.last_name}
              </p>
            )}
          </div>

          {patient && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setConfirmDelete(true)}
                className="px-4 py-2.5 border border-red-200 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>

              <button className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Visit
              </button>
            </div>
          )}
        </div>

        {loading && (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
            <div className="flex flex-col items-center justify-center py-10">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-gray-600">Loading patient details...</p>
            </div>
          </div>
        )}

        {err && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="rounded-full bg-red-100 p-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Failed to load patient</h3>
              <p className="text-gray-600 mb-4 max-w-md">{err}</p>
              <button
                onClick={() => window.location.reload()}
                className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Try again
              </button>
            </div>
          </div>
        )}

        {!loading && !err && !patient && (
          <div className="bg-white rounded-xl shadow-sm p-8 border border-gray-100">
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="rounded-full bg-gray-100 p-3 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Patient not found</h3>
              <p className="text-gray-600 mb-4">The patient you're looking for doesn't exist.</p>
              <button
                onClick={() => navigate("/patients")}
                className="text-indigo-600 hover:text-indigo-800 font-medium flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to patients list
              </button>
            </div>
          </div>
        )}

        {patient && (
          <div className="space-y-6">
            {/* Patient Summary Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
              <div className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="flex-shrink-0 relative">
                  {currentPhotoSrc ? (
                    <img
                      src={currentPhotoSrc}
                      alt={`${patient.first_name} ${patient.last_name}`}
                      className="h-20 w-20 rounded-full object-cover border border-gray-200"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = "/fallback-avatar.png";
                      }}
                    />
                  ) : (
                    <div className="h-20 w-20 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-2xl">
                      {patient.first_name?.[0]}
                      {patient.last_name?.[0]}
                    </div>
                  )}

                  {/* Hidden file input for photo upload */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={onPhotoFileChange}
                  />

                  {/* Show edit icon only in edit mode */}
                  {editMode && (
                    <button
                      type="button"
                      onClick={onClickEditPhoto}
                      title="Change photo"
                      aria-label="Change photo"
                      className="absolute -bottom-1 -right-1 p-2 rounded-full bg-white border border-gray-200 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5h2m2 0h.01M4 21v-3.586a1 1 0 01.293-.707l10.5-10.5a1 1 0 011.414 0l2.586 2.586a1 1 0 010 1.414l-10.5 10.5a1 1 0 01-.707.293H4z" />
                      </svg>
                    </button>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold text-gray-900 truncate">
                    {patient.first_name} {patient.last_name}
                  </h2>
                  <div className="flex flex-wrap items-center gap-3 mt-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {displayText(patient.gender)}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      {calcAge(patient.dob) || "—"} years
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      {displayText(patient.phone)}
                    </span>
                  </div>
                  <p className="text-gray-600 mt-2 truncate">{displayText(patient.email)}</p>
                </div>

                <div className="flex flex-col items-end">
                  <div className="text-sm text-gray-500">Last visit</div>
                  <div className="text-sm font-medium text-gray-900">
                    {visitsSorted.length > 0 ? formatDateTime(visitsSorted[0].visit_at) : "No visits"}
                  </div>
                  <div className="mt-4 flex items-center">
                    <span className="text-sm font-medium text-gray-700 mr-2">Status:</span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Active
                    </span>
                  </div>
                </div>
              </div>

              {/* Photo messages */}
              {photoErr && <div className="mt-3 text-sm text-red-600">{photoErr}</div>}
            </div>

            {/* Financial Summary Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center">
                  <div className="rounded-lg bg-indigo-100 p-3 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Amount</p>
                    <p className="text-2xl font-bold text-gray-900">{inr(financialSummary.totalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center">
                  <div className="rounded-lg bg-green-100 p-3 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Paid</p>
                    <p className="text-2xl font-bold text-green-600">{inr(financialSummary.totalPaid)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
                <div className="flex items-center">
                  <div className="rounded-lg bg-red-100 p-3 mr-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Due</p>
                    <p className="text-2xl font-bold text-red-600">{inr(financialSummary.totalDue)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="border-b border-gray-200">
                <nav className="flex -mb-px">
                  <button
                    onClick={() => setActiveTab("profile")}
                    className={`py-4 px-6 text-sm font-medium border-b-2 ${
                      activeTab === "profile"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Profile
                  </button>
                  <button
                    onClick={() => setActiveTab("medical")}
                    className={`py-4 px-6 text-sm font-medium border-b-2 ${
                      activeTab === "medical"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Medical History
                  </button>
                  <button
                    onClick={() => setActiveTab("visits")}
                    className={`py-4 px-6 text-sm font-medium border-b-2 ${
                      activeTab === "visits"
                        ? "border-indigo-500 text-indigo-600"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    Visits ({visits.length})
                  </button>
                </nav>
              </div>

              <div className="p-6">
                {/* Profile Tab */}
                {activeTab === "profile" && (
                  <div ref={profileRef} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
                      {!editMode ? (
                        <button
                          onClick={startInlineEdit}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                          Edit Profile
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelInlineEdit}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                            disabled={saving}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveInlineEdit}
                            className={`px-3 py-1.5 rounded-lg text-sm text-white ${
                              saving ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                            disabled={saving}
                          >
                            {saving ? "Saving..." : "Save Changes"}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Read mode */}
                    {!editMode && (
                      <>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Full Name</p>
                          <p className="font-medium text-gray-900">
                            {patient.first_name} {patient.last_name}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Date of Birth</p>
                          <p className="font-medium text-gray-900">{formatDate(patient.dob)}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Age</p>
                          <p className="font-medium text-gray-900">
                            {calcAge(patient.dob) || "—"}
                            {calcAge(patient.dob) ? " years" : ""}
                          </p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Gender</p>
                          <p className="font-medium text-gray-900">{displayText(patient.gender)}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                          <p className="font-medium text-gray-900">{displayText(patient.phone)}</p>
                        </div>

                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Email</p>
                          <p className="font-medium text-gray-900">{displayText(patient.email)}</p>
                        </div>

                        <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Address</p>
                          <p className="font-medium text-gray-900">{address || "—"}</p>
                        </div>

                        <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Occupation</p>
                          <p className="font-medium text-gray-900">{displayText(patient.occupation)}</p>
                        </div>

                        <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-500 mb-1">Emergency Contact</p>
                          <p className="font-medium text-gray-900">
                            {displayText(patient.emergency_contact?.name)}
                            {patient.emergency_contact?.relation ? ` (${patient.emergency_contact.relation})` : ""}
                            {patient.emergency_contact?.phone ? ` — ${patient.emergency_contact.phone}` : ""}
                          </p>
                        </div>
                      </>
                    )}

                    {/* Edit mode form */}
                    {editMode && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">First Name</label>
                          <input
                            name="firstName"
                            value={form.firstName}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Last Name</label>
                          <input
                            name="lastName"
                            value={form.lastName}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">DOB</label>
                          <input
                            type="date"
                            name="dob"
                            value={form.dob}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Gender</label>
                          <Select
                            inputId="gender"
                            name="gender"
                            className="w-full"
                            options={GENDER_OPTS}
                            value={genderSelected}
                            onChange={(opt) =>
                              setForm((f) => ({
                                ...f,
                                gender: opt?.value || "",
                              }))
                            }
                            placeholder="Select…"
                            isClearable
                            styles={selectStyles}
                            menuPortalTarget={
                              typeof document !== "undefined" ? document.body : null
                            }
                            menuPosition="fixed"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Phone</label>
                          <input
                            name="phone"
                            value={form.phone}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Email</label>
                          <input
                            type="email"
                            name="email"
                            value={form.email}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Address Line 1</label>
                          <input
                            name="addressLine1"
                            value={form.addressLine1}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Address Line 2</label>
                          <input
                            name="addressLine2"
                            value={form.addressLine2}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">City</label>
                          <input
                            name="city"
                            value={form.city}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">State</label>
                          <input
                            name="state"
                            value={form.state}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Pincode</label>
                          <input
                            name="pincode"
                            value={form.pincode}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Occupation</label>
                          <input
                            name="occupation"
                            value={form.occupation}
                            onChange={onChange}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-2">Emergency Contact</label>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <input
                              name="emergencyContact.name"
                              placeholder="Name"
                              value={form.emergencyContact?.name || ""}
                              onChange={onChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                            <Select
                              inputId="emergencyContactRelation"
                              name="emergencyContact.relation"
                              className="w-full"
                              options={RELATION_OPTS}
                              value={relationSelected}
                              onChange={(opt) =>
                                setForm((f) => ({
                                  ...f,
                                  emergencyContact: {
                                    ...(f.emergencyContact || {}),
                                    relation: opt?.value || "",
                                  },
                                }))
                              }
                              placeholder="Relation…"
                              isClearable
                              styles={selectStyles}
                              menuPortalTarget={
                                typeof document !== "undefined" ? document.body : null
                              }
                              menuPosition="fixed"
                            />
                            <input
                              name="emergencyContact.phone"
                              placeholder="Phone"
                              value={form.emergencyContact?.phone || ""}
                              onChange={onChange}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            />
                          </div>
                        </div>

                        {saveErr && (
                          <div className="md:col-span-2 text-sm text-red-600">{saveErr}</div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Medical History Tab */}
                {activeTab === "medical" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium text-gray-900">Medical History</h3>
                      {!mhEditMode ? (
                        <button
                          onClick={startMhEdit}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                        >
                          {mh ? "Edit Medical History" : "Add Medical History"}
                        </button>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={cancelMhEdit}
                            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
                            disabled={mhSaving}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={saveMh}
                            className={`px-3 py-1.5 rounded-lg text-sm text-white ${
                              mhSaving ? "bg-indigo-400" : "bg-indigo-600 hover:bg-indigo-700"
                            }`}
                            disabled={mhSaving}
                          >
                            {mhSaving ? "Saving..." : "Save Medical History"}
                          </button>
                        </div>
                      )}
                    </div>

                    {!mhEditMode ? (
                      !mh ? (
                        <div className="text-center py-10">
                          <div className="rounded-full bg-gray-100 p-4 inline-flex mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-medium text-gray-900 mb-2">No medical history on file</h4>
                          <p className="text-gray-600">Click “Add Medical History” to create one.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Surgery/Hospitalization (last 5y)</p>
                            <p className="font-medium text-gray-900">
                              {displayYesNo(mh.surgery_or_hospitalized)}
                              {mh.surgery_or_hospitalized === "Yes" && mh.surgery_details
                                ? ` — ${displayText(mh.surgery_details)}`
                                : ""}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Fever/Cold/Cough (current)</p>
                            <p className="font-medium text-gray-900">
                              {displayYesNo(mh.fever_cold_cough)}
                              {mh.fever_cold_cough === "Yes" && mh.fever_details
                                ? ` — ${displayText(mh.fever_details)}`
                                : ""}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Abnormal Bleeding</p>
                            <p className="font-medium text-gray-900">
                              {displayYesNo(mh.abnormal_bleeding_history)}
                              {mh.abnormal_bleeding_history === "Yes" && mh.abnormal_bleeding_details
                                ? ` — ${displayText(mh.abnormal_bleeding_details)}`
                                : ""}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Taking Medicine</p>
                            <p className="font-medium text-gray-900">
                              {displayYesNo(mh.taking_medicine)}
                              {mh.taking_medicine === "Yes" && mh.medicine_details
                                ? ` — ${displayText(mh.medicine_details)}`
                                : ""}
                            </p>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Medication Allergy</p>
                            <p className="font-medium text-gray-900">
                              {displayYesNo(mh.medication_allergy)}
                              {mh.medication_allergy === "Yes" && mh.medication_allergy_details
                                ? ` — ${displayText(mh.medication_allergy_details)}`
                                : ""}
                            </p>
                          </div>

                          <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-1">Past Dental History</p>
                            <p className="font-medium text-gray-900">{displayText(mh.past_dental_history)}</p>
                          </div>

                          <div className="md:col-span-2 bg-gray-50 rounded-lg p-4">
                            <p className="text-sm font-medium text-gray-500 mb-2">Medical Problems</p>
                            <div className="flex flex-wrap gap-2">
                              {problemChips.length ? (
                                problemChips.map((label, i) => (
                                  <span
                                    key={i}
                                    className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-full font-medium"
                                  >
                                    {label}
                                  </span>
                                ))
                              ) : (
                                <span className="text-gray-500">None reported</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      /* ----------- Medical History EDIT MODE ----------- */
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Tri-state rows */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Surgery/Hospitalization (last 5y)
                          </label>
                          <Select
                            options={YN_OPTS}
                            value={YN_OPTS.find(o => o.value === mhForm.surgeryOrHospitalized)}
                            onChange={(opt) => setMhField("surgeryOrHospitalized", opt?.value ?? "")}
                            isClearable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                          {mhForm.surgeryOrHospitalized === "Yes" && (
                            <input
                              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Details"
                              value={mhForm.surgeryDetails}
                              onChange={(e) => setMhField("surgeryDetails", e.target.value)}
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Fever/Cold/Cough (current)
                          </label>
                          <Select
                            options={YN_OPTS}
                            value={YN_OPTS.find(o => o.value === mhForm.feverColdCough)}
                            onChange={(opt) => setMhField("feverColdCough", opt?.value ?? "")}
                            isClearable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                          {mhForm.feverColdCough === "Yes" && (
                            <input
                              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Details"
                              value={mhForm.feverDetails}
                              onChange={(e) => setMhField("feverDetails", e.target.value)}
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Abnormal Bleeding
                          </label>
                          <Select
                            options={YN_OPTS}
                            value={YN_OPTS.find(o => o.value === mhForm.abnormalBleedingHistory)}
                            onChange={(opt) => setMhField("abnormalBleedingHistory", opt?.value ?? "")}
                            isClearable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                          {mhForm.abnormalBleedingHistory === "Yes" && (
                            <input
                              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Details"
                              value={mhForm.abnormalBleedingDetails}
                              onChange={(e) => setMhField("abnormalBleedingDetails", e.target.value)}
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Taking Medicine
                          </label>
                          <Select
                            options={YN_OPTS}
                            value={YN_OPTS.find(o => o.value === mhForm.takingMedicine)}
                            onChange={(opt) => setMhField("takingMedicine", opt?.value ?? "")}
                            isClearable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                          {mhForm.takingMedicine === "Yes" && (
                            <input
                              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Details"
                              value={mhForm.medicineDetails}
                              onChange={(e) => setMhField("medicineDetails", e.target.value)}
                            />
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Medication Allergy
                          </label>
                          <Select
                            options={YN_OPTS}
                            value={YN_OPTS.find(o => o.value === mhForm.medicationAllergy)}
                            onChange={(opt) => setMhField("medicationAllergy", opt?.value ?? "")}
                            isClearable={false}
                            styles={selectStyles}
                            menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                            menuPosition="fixed"
                          />
                          {mhForm.medicationAllergy === "Yes" && (
                            <input
                              className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2"
                              placeholder="Details"
                              value={mhForm.medicationAllergyDetails}
                              onChange={(e) => setMhField("medicationAllergyDetails", e.target.value)}
                            />
                          )}
                        </div>

                        {/* Past Dental History */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Past Dental History
                          </label>
                          <textarea
                            className="w-full border border-gray-300 rounded-lg px-3 py-2"
                            rows={3}
                            placeholder="Notes..."
                            value={mhForm.pastDentalHistory}
                            onChange={(e) => setMhField("pastDentalHistory", e.target.value)}
                          />
                        </div>

                        {/* Problems checklist */}
                        <div className="md:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Medical Problems
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                            {[
                              ["artificialValvesPacemaker", "Artificial Valves/Pacemaker"],
                              ["asthma", "Asthma"],
                              ["allergy", "Allergy"],
                              ["bleedingTendency", "Bleeding Disorder"],
                              ["epilepsySeizure", "Epilepsy/Seizure"],
                              ["heartDisease", "Heart Disease"],
                              ["hypHypertension", "Hypo/Hypertension"],
                              ["hormoneDisorder", "Hormone Disorder"],
                              ["jaundiceLiver", "Jaundice/Liver"],
                              ["stomachUlcer", "Stomach Ulcer"],
                              ["lowHighPressure", "Low/High Pressure"],
                              ["arthritisJoint", "Arthritis/Joint"],
                              ["kidneyProblems", "Kidney Problems"],
                              ["thyroidProblems", "Thyroid Problems"],
                            ].map(([key, label]) => (
                              <label key={key} className="inline-flex items-center gap-2 text-sm text-gray-700">
                                <input
                                  type="checkbox"
                                  className="rounded border-gray-300"
                                  checked={!!mhForm.problems[key]}
                                  onChange={(e) => setMhProblem(key, e.target.checked)}
                                />
                                {label}
                              </label>
                            ))}
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                checked={!!mhForm.problems.otherProblem}
                                onChange={(e) => setMhProblem("otherProblem", e.target.checked)}
                              />
                              Other Problem
                            </label>
                            {mhForm.problems.otherProblem && (
                              <input
                                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                                placeholder="Other problem details"
                                value={mhForm.problems.otherProblemText || ""}
                                onChange={(e) =>
                                  setMhForm((f) => ({
                                    ...f,
                                    problems: { ...(f.problems || {}), otherProblemText: e.target.value },
                                  }))
                                }
                              />
                            )}
                          </div>
                        </div>

                        {mhErr && <div className="md:col-span-2 text-sm text-red-600">{mhErr}</div>}
                      </div>
                    )}
                  </div>
                )}

                {/* Visits Tab */}
                {activeTab === "visits" && (
                  <div>
                    {visitsSorted.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="rounded-full bg-gray-100 p-4 inline-flex mb-4">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No visits recorded</h3>
                        <p className="text-gray-600">This patient hasn't had any visits yet.</p>
                        <button className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors duration-200 inline-flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Schedule First Visit
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {visitsSorted.map((v) => {
                          const procs = Array.isArray(v.procedures) ? v.procedures : [];
                          const sum = procs.reduce(
                            (acc, r) => {
                              const t = Number(r?.total ?? 0);
                              const p = Number(r?.paid ?? 0);
                              const d = Number(r?.due ?? Math.max(t - p, 0));
                              return {
                                total: acc.total + t,
                                paid: acc.paid + p,
                                due: acc.due + d,
                              };
                            },
                            { total: 0, paid: 0, due: 0 }
                          );
                          return (
                            <div key={v.id} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                                <div>
                                  <h4 className="font-semibold text-gray-900">{formatDateTime(v.visit_at)}</h4>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      sum.due > 0
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-green-100 text-green-800"
                                    }`}
                                  >
                                    {sum.due > 0 ? "Pending Payment" : "Paid"}
                                  </span>
                                  <button
                                    onClick={() => navigate(`/visits/${v.id}`)}
                                    className="px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors duration-200 flex items-center"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    View Details
                                  </button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                <div>
                                  <p className="text-sm font-medium text-gray-500">Chief Complaint</p>
                                  <p className="text-gray-900">{displayText(v.chief_complaint)}</p>
                                </div>
                                <div>
                                  <p className="text-sm font-medium text-gray-500">Duration & Onset</p>
                                  <p className="text-gray-900">{displayText(v.duration_onset)}</p>
                                </div>
                                <div className="md:col-span-2">
                                  <p className="text-sm font-medium text-gray-500 mb-1">Trigger Factors</p>
                                  <div className="flex flex-wrap gap-2">
                                    {Array.isArray(v.trigger_factors) && v.trigger_factors.length ? (
                                      v.trigger_factors.map((t, i) => (
                                        <span
                                          key={i}
                                          className="px-2.5 py-0.5 bg-green-100 text-green-800 text-xs rounded-full font-medium"
                                        >
                                          {t}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-gray-500 text-sm">None reported</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {procs.length > 0 && (
                                <div className="border rounded-lg overflow-hidden">
                                  <div className="bg-gray-100 px-4 py-2.5 border-b">
                                    <h5 className="text-sm font-medium text-gray-700">Procedures</h5>
                                  </div>
                                  <div className="divide-y divide-gray-200">
                                    {procs.map((r, i) => (
                                      <div key={i} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-12 gap-2">
                                        <div className="sm:col-span-5">
                                          <p className="font-medium text-gray-900 text-sm">{displayText(r.procedure)}</p>
                                          <p className="text-xs text-gray-500">
                                            {formatDate(r.visitDate || r.visit_date)}
                                          </p>
                                        </div>
                                        <div className="sm:col-span-3">
                                          <p className="text-xs text-gray-500">Next Appt</p>
                                          <p className="text-sm text-gray-900">
                                            {formatDate(r.nextApptDate || r.next_appt_date)}
                                          </p>
                                        </div>
                                        <div className="sm:col-span-4 grid grid-cols-3 gap-2">
                                          <div>
                                            <p className="text-xs text-gray-500">Total</p>
                                            <p className="text-sm font-medium">{inr(r.total)}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Paid</p>
                                            <p className="text-sm font-medium text-green-600">{inr(r.paid)}</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-gray-500">Due</p>
                                            <p
                                              className={`text-sm font-medium ${
                                                Number(r?.due ?? 0) > 0 ? "text-red-600" : "text-green-600"
                                              }`}
                                            >
                                              {inr(r?.due ?? Math.max(Number(r?.total ?? 0) - Number(r?.paid ?? 0), 0))}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="bg-gray-50 px-4 py-3 border-t grid grid-cols-1 sm:grid-cols-12 gap-2">
                                    <div className="sm:col-span-8 font-medium text-sm text-gray-700">Visit Totals</div>
                                    <div className="sm:col-span-4 grid grid-cols-3 gap-2">
                                      <div className="font-medium text-sm">{inr(sum.total)}</div>
                                      <div className="font-medium text-sm text-green-600">{inr(sum.paid)}</div>
                                      <div
                                        className={`font-medium text-sm ${
                                          sum.due > 0 ? "text-red-600" : "text-green-600"
                                        }`}
                                      >
                                        {inr(sum.due)}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Delete Confirm Modal ---------- */}
      {confirmDelete && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => !deleting && setConfirmDelete(false)}
          />
          <div className="relative z-50 bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-red-100 p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">Delete this patient?</h3>
                <p className="text-sm text-gray-600">
                  This action cannot be undone. All related data may be affected.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => !deleting && setConfirmDelete(false)}
                className="px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={onDelete}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium text-white ${
                  deleting ? "bg-red-400" : "bg-red-600 hover:bg-red-700"
                }`}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Forbidden (Not Allowed) Modal ---------- */}
      {forbiddenModal.open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setForbiddenModal({ open: false, message: "" })}
          />
          <div className="relative z-50 bg-white w-full max-w-md rounded-xl shadow-lg border border-gray-100 p-6">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-yellow-100 p-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-yellow-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M12 9v2m0 4h.01M9 2l.867 1.8a2 2 0 001.79 1.2h2.686a2 2 0 001.79-1.2L17 2m4 7a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-1">You can’t delete this patient</h3>
                <p className="text-sm text-gray-600">
                  {forbiddenModal.message || "Only the creator can delete this patient."}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setForbiddenModal({ open: false, message: "" })}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientDetail;
