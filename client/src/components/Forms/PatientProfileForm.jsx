// src/components/PatientProfileForm.jsx
import React, { useEffect, useMemo, useState } from "react";
import Select from "react-select";
import {
  FaUser,
  FaBirthdayCake,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaBriefcase,
  FaUserShield,
  FaCamera,
  FaUpload,
  FaTrash,
} from "react-icons/fa";
import { MdOutlineHome, MdOutlineLocationCity } from "react-icons/md";
import { IKUpload, IKImage } from "imagekitio-react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
// ---------- Constants ----------
const EMAIL_RE = /^\S+@\S+\.\S+$/;
const MOBILE_RE = /^[6-9][0-9]{9}$/;
const PIN_RE = /^[0-9]{6}$/;

const MAX_PHOTO_MB = 5;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

const GENDER_OPTS = [
  { value: "Male", label: "Male" },
  { value: "Female", label: "Female" },
  { value: "Other", label: "Other" },
  { value: "Prefer not to say", label: "Prefer not to say" },
];

const RELATION_OPTS = [
  { value: "Parent", label: "Parent" },
  { value: "Spouse", label: "Spouse" },
  { value: "Sibling", label: "Sibling" },
  { value: "Friend", label: "Friend" },
  { value: "Guardian", label: "Guardian" },
  { value: "Child", label: "Child" },
  { value: "Other", label: "Other" },
];

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderRadius: "8px",
    minHeight: "48px",
    borderWidth: "1px",
    borderColor: state.isFocused ? "#6366f1" : "#e2e8f0",
    boxShadow: state.isFocused ? "0 0 0 2px rgba(99, 102, 241, 0.2)" : "none",
    ":hover": { borderColor: "#6366f1" },
    backgroundColor: state.isDisabled ? "#f8fafc" : "#fff",
    transition: "all 0.2s ease",
  }),
  valueContainer: (b) => ({ ...b, padding: "0 12px" }),
  input: (b) => ({ ...b, margin: 0, padding: 0 }),
  placeholder: (b) => ({ ...b, color: "#94a3b8", fontSize: "14px" }),
  singleValue: (b) => ({ ...b, fontSize: "14px", color: "#1e293b" }),
  menu: (b) => ({
    ...b,
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow:
      "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
    border: "1px solid #e2e8f0",
    zIndex: 40,
  }),
  option: (b, state) => ({
    ...b,
    fontSize: "14px",
    backgroundColor: state.isSelected
      ? "#6366f1"
      : state.isFocused
      ? "#f1f5f9"
      : "#fff",
    color: state.isSelected ? "#fff" : "#1e293b",
    ":active": { backgroundColor: state.isSelected ? "#6366f1" : "#e2e8f0" },
  }),
};

// ---------- Helpers ----------
const Label = ({ htmlFor, children, required }) => (
  <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1">
    {children} {required && <span className="text-red-500">*</span>}
  </label>
);

const FieldError = ({ id, msg }) =>
  msg ? (
    <p id={id} className="mt-1 text-xs text-red-600" role="alert">
      {msg}
    </p>
  ) : null;

const InputIconWrap = ({ icon: Icon, children }) => (
  <div className="relative">
    {Icon && (
      <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
    )}
    {children}
  </div>
);

const DRAFT_KEY = "dental:patientProfile:draft";
const IK_DELETE_ENDPOINT = "/api/imagekit/delete"; // <-- implement on your server

const fmtDate = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const today = new Date();
const MAX_DOB = fmtDate(today);
const MIN_DOB = fmtDate(new Date(today.getFullYear() - 120, today.getMonth(), today.getDate()));

const safeName = (first, last) => {
  const core = [first, last].filter(Boolean).join("-") || "patient";
  return core
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
};

const randomSuffix = () => Math.random().toString(36).slice(2);

// ---------- Component ----------
const PatientProfileForm = ({ initial = {}, onNext, onSave }) => {
  // --- Base state from props (overridden by saved draft after mount) ---
  const [firstName, setFirstName] = useState(initial.firstName || "");
  const [lastName, setLastName] = useState(initial.lastName || "");
  const [dob, setDob] = useState(initial.dob || "");
  const [gender, setGender] = useState(
    initial.gender ? GENDER_OPTS.find((g) => g.value === initial.gender) : null
  );
  const [phone, setPhone] = useState(initial.phone || "");
  const [email, setEmail] = useState(initial.email || "");
  const [addressLine1, setAddressLine1] = useState(initial.addressLine1 || "");
  const [addressLine2, setAddressLine2] = useState(initial.addressLine2 || "");
  const [city, setCity] = useState(initial.city || "");
  const [state, setState] = useState(initial.state || "");
  const [pincode, setPincode] = useState(initial.pincode || "");
  const [occupation, setOccupation] = useState(initial.occupation || "");

  const [emgName, setEmgName] = useState(initial.emgName || "");
  const [emgRelation, setEmgRelation] = useState(
    initial.emgRelation
      ? RELATION_OPTS.find((r) => r.value === initial.emgRelation)
      : null
  );
  const [emgPhone, setEmgPhone] = useState(initial.emgPhone || "");

  // Photo states (ImageKit-driven)
  const [photoIK, setPhotoIK] = useState(initial.photoIK || null); // { fileId, filePath, url, ... }
  const [photoPreview, setPhotoPreview] = useState(initial.photoPreview || ""); // keep for payload/UI
  const [photoError, setPhotoError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [folderLocked, setFolderLocked] = useState(null); // lock after first upload

  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // --- Age derived from dob ---
  const age = useMemo(() => {
    if (!dob) return "";
    const birth = new Date(dob);
    if (Number.isNaN(birth.getTime())) return "";
    const t = new Date();
    let a = t.getFullYear() - birth.getFullYear();
    const m = t.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < birth.getDate())) a--;
    return a >= 0 && a <= 150 ? String(a) : "";
  }, [dob]);

  // --- Build payload ---
  const payload = useMemo(
    () => ({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      age,
      gender: gender?.value || "",
      phone,
      email: email.trim(),
      addressLine1: addressLine1.trim(),
      addressLine2: addressLine2.trim(),
      city: city.trim(),
      state: state.trim(),
      pincode,
      occupation: occupation.trim(),
      emergencyContact: {
        name: emgName.trim(),
        relation: emgRelation?.value || "",
        phone: emgPhone,
      },
      photoPreview,             // for UI
      photoUrl: photoIK?.url || "", // prefer CDN URL
      photoIK: photoIK || null,     // keep lightweight IK object
    }),
    [
      firstName, lastName, dob, age, gender, phone, email,
      addressLine1, addressLine2, city, state, pincode, occupation,
      emgName, emgRelation, emgPhone, photoPreview, photoIK,
    ]
  );

  // --- Auto-save to localStorage (debounced 2s) ---
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        }
      } catch {}
    }, 2000);
    return () => clearTimeout(id);
  }, [payload]);

  // --- Restore from localStorage on mount ---
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);

      setFirstName(draft.firstName ?? initial.firstName ?? "");
      setLastName(draft.lastName ?? initial.lastName ?? "");
      setDob(draft.dob ?? initial.dob ?? "");
      setGender(
        (draft.gender && GENDER_OPTS.find((g) => g.value === draft.gender)) ||
          (initial.gender && GENDER_OPTS.find((g) => g.value === initial.gender)) ||
          null
      );
      setPhone(draft.phone ?? initial.phone ?? "");
      setEmail(draft.email ?? initial.email ?? "");
      setAddressLine1(draft.addressLine1 ?? initial.addressLine1 ?? "");
      setAddressLine2(draft.addressLine2 ?? initial.addressLine2 ?? "");
      setCity(draft.city ?? initial.city ?? "");
      setState(draft.state ?? initial.state ?? "");
      setPincode(draft.pincode ?? initial.pincode ?? "");
      setOccupation(draft.occupation ?? initial.occupation ?? "");

      const emg = draft.emergencyContact || {};
      setEmgName(emg.name ?? initial.emgName ?? "");
      setEmgRelation(
        (emg.relation && RELATION_OPTS.find((r) => r.value === emg.relation)) ||
          (initial.emgRelation && RELATION_OPTS.find((r) => r.value === initial.emgRelation)) ||
          null
      );
      setEmgPhone(emg.phone ?? initial.emgPhone ?? "");

      setPhotoPreview(draft.photoPreview ?? initial.photoPreview ?? "");
      setPhotoIK(draft.photoIK ?? initial.photoIK ?? null);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Validation ---
  const validate = (data = payload) => {
    const e = {};
    if (!data.firstName) e.firstName = "First name is required";
    if (!data.lastName) e.lastName = "Last name is required";
    if (data.dob) {
      const d = new Date(data.dob);
      const now = new Date();
      if (Number.isNaN(d.getTime())) e.dob = "Enter a valid date";
      else if (d > now) e.dob = "DOB cannot be in the future";
      else if (now.getFullYear() - d.getFullYear() > 120) e.dob = "DOB seems implausible";
    }
    if (!data.gender) e.gender = "Please select gender";
    if (!MOBILE_RE.test(String(data.phone || "")))
      e.phone = "Enter a valid 10-digit mobile (starts 6–9)";
    if (data.email && !EMAIL_RE.test(data.email))
      e.email = "Enter a valid email";
    if (data.pincode && !PIN_RE.test(String(data.pincode)))
      e.pincode = "Pincode must be 6 digits";
    if (data.emergencyContact?.phone && !MOBILE_RE.test(String(data.emergencyContact.phone)))
      e.emgPhone = "Emergency phone must be 10 digits (starts 6–9)";
    if (photoError) e.photo = photoError;
    return e;
  };

  useEffect(() => {
    setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload, photoError]);

  const setFieldTouched = (name) => setTouched((t) => ({ ...t, [name]: true }));
  const isFormValid = Object.keys(validate()).length === 0;

  // ---------- ImageKit methods (client -> server) ----------
  const apiDeleteImageKitFile = async (fileId) => {
    try {
      if (!fileId) return false;
      const res = await fetch(IK_DELETE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      if (!res.ok) throw new Error("Delete failed");
      const json = await res.json().catch(() => ({}));
      return json?.success !== false;
    } catch (err) {
      console.error("[ImageKit Delete Error]", err);
      return false;
    }
  };

  const removePhoto = async () => {
    // optimistic UI: clear immediately, try to delete in background
    const old = photoIK;
    setDeleting(true);
    setPhotoIK(null);
    setPhotoPreview("");
    setPhotoError("");

    try {
      if (old?.fileId) await apiDeleteImageKitFile(old.fileId);
    } finally {
      setDeleting(false);
    }
  };

  // --- Submit: pass data up ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError("");

    const emap = validate();
    setErrors(emap);
    setTouched({
      firstName: true,
      lastName: true,
      dob: touched.dob || false,
      gender: true,
      phone: true,
      email: touched.email || false,
      pincode: touched.pincode || false,
      emgPhone: touched.emgPhone || false,
      photo: touched.photo || false,
    });
    if (Object.keys(emap).length) return;

    setSaving(true);
    try {
      onSave?.(payload);
      // No raw file anymore (ImageKit handles storage). Keep API backward-compat.
      onNext?.(payload, { ...payload, _photoFile: null });
    } catch (err) {
      setSubmitError(err?.message || "Failed to continue");
    } finally {
      setSaving(false);
    }
  };

  // ---- ImageKit upload handlers ----
  const uploadFolder = useMemo(() => {
    // Avoid leading slash for ImageKit folders; lock folder after first upload
    if (folderLocked) return folderLocked;
    const base = safeName(firstName, lastName) || "patient";
    return `patients/${base}`;
  }, [firstName, lastName, folderLocked]);

  const validateFile = (file) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      throw new Error("Only JPG/PNG/WEBP allowed");
    }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
      throw new Error(`Max file size ${MAX_PHOTO_MB}MB`);
    }
  };

  const onUploadStart = () => {
    setUploading(true);
    setPhotoError("");
    setFieldTouched("photo");
    if (!folderLocked) {
      const base = safeName(firstName, lastName) || "patient";
      setFolderLocked(`patients/${base}`);
    }
    // If replacing, remember the old file to delete AFTER success
    if (photoIK?.fileId) setPendingDeleteId(photoIK.fileId);
  };

  const onUploadError = (err) => {
    console.error("[ImageKit Upload Error]", err);
    setUploading(false);
    setPhotoError(err?.message || "Image upload failed");
    setPendingDeleteId(null); // keep old image
  };

  const onUploadSuccess = async (res) => {
    setUploading(false);
    setPhotoError("");
    const { fileId, filePath, url, thumbnailUrl, name, size, width, height } = res || {};
    setPhotoIK({ fileId, filePath, url, thumbnailUrl, name, size, width, height });
    setPhotoPreview(url || "");
    // delete the old one (if any) in background
    const oldId = pendingDeleteId;
    setPendingDeleteId(null);
    if (oldId && oldId !== fileId) {
      // Best-effort cleanup; UI already updated to the new image
      await apiDeleteImageKitFile(oldId);
    }
  };

  // --- UI ---
  const uploadDisabled = uploading || deleting;

  return (
    <form
      className="mx-auto w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-white px-6 py-6 border-b border-gray-100">
        <h2 className="text-2xl font-semibold text-gray-800">Patient Profile</h2>
        <p className="mt-1 text-sm text-gray-500">
          Basic patient details for registration and dental records.
        </p>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="px-6 pt-4">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      <div className="px-6 py-6 space-y-6">
        {/* Photo (ImageKit-backed) */}
        <section className="space-y-2">
          <Label htmlFor="photo">Patient Photo</Label>

          <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-6">
            {/* Preview */}
            <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 relative">
              {photoIK?.filePath ? (
                <IKImage
                  path={photoIK.filePath}
                  transformation={[
                    { width: 320, height: 320, crop: "fo-auto", quality: 80, format: "auto" },
                  ]}
                  lqip={{ active: true, quality: 15 }}
                  loading="lazy"
                  alt="Selected patient"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="text-center p-4">
                  <FaCamera className="mx-auto text-gray-400 text-3xl mb-2" />
                  <span className="text-xs text-gray-500">
                    {uploading ? "Uploading…" : "No photo selected"}
                  </span>
                </div>
              )}
            </div>

            {/* Buttons + hidden IKUpload input */}
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              {/* Hidden IKUpload file input triggered by label/button */}
              <IKUpload
                id="ik-upload-photo"
                className="hidden"
                folder={uploadFolder} // no leading slash
                fileName={`patient_${Date.now()}_${randomSuffix()}.jpg`}
                useUniqueFileName={true}
                accept="image/jpeg,image/png,image/webp"
                validateFile={validateFile}
                onUploadStart={onUploadStart}
                onError={onUploadError}
                onSuccess={onUploadSuccess}
                disabled={uploadDisabled}
              />

              <label
                htmlFor="ik-upload-photo"
                aria-disabled={uploadDisabled}
                className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors cursor-pointer
                  ${
                    uploadDisabled
                      ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                  }`}
              >
                <FaUpload className="mr-2" />
                {uploading ? "Uploading…" : "Upload Photo"}
              </label>

              {photoIK?.filePath && (
                <button
                  type="button"
                  onClick={removePhoto}
                  disabled={uploadDisabled}
                  className={`inline-flex items-center justify-center rounded-md border px-4 py-2 text-sm font-medium shadow-sm transition-colors
                    ${
                      uploadDisabled
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                    }`}
                >
                  <FaTrash className="mr-2" />
                  {deleting ? "Removing…" : "Remove"}
                </button>
              )}
            </div>
          </div>

          <FieldError id="photo-error" msg={touched.photo ? (errors.photo || "") : ""} />
          <p className="text-xs text-gray-500">JPG/PNG/WEBP, up to {MAX_PHOTO_MB} MB.</p>
        </section>

        {/* Name */}
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="firstName" required>First Name</Label>
            <InputIconWrap icon={FaUser}>
              <input
                id="firstName"
                name="firstName"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                onBlur={() => setFieldTouched("firstName")}
                aria-invalid={!!(touched.firstName && errors.firstName)}
                aria-describedby={touched.firstName && errors.firstName ? "firstName-error" : undefined}
                className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.firstName && errors.firstName ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="e.g., Priya"
                autoComplete="given-name"
              />
            </InputIconWrap>
            <FieldError id="firstName-error" msg={touched.firstName ? errors.firstName : ""} />
          </div>

          <div>
            <Label htmlFor="lastName" required>Last Name</Label>
            <InputIconWrap icon={FaUser}>
              <input
                id="lastName"
                name="lastName"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                onBlur={() => setFieldTouched("lastName")}
                aria-invalid={!!(touched.lastName && errors.lastName)}
                aria-describedby={touched.lastName && errors.lastName ? "lastName-error" : undefined}
                className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.lastName && errors.lastName ? "border-red-500" : "border-gray-300"
                }`}
                placeholder="e.g., Kumar"
                autoComplete="family-name"
              />
            </InputIconWrap>
            <FieldError id="lastName-error" msg={touched.lastName ? errors.lastName : ""} />
          </div>
        </section>

        {/* DOB + Age + Gender */}
        <section className="grid gap-6 md:grid-cols-3">
          <div>
            <Label htmlFor="dob" >Date of Birth</Label>
          

            <InputIconWrap icon={FaBirthdayCake}>
              <DatePicker
                 name="dob"
    id="dob"
    selected={dob ? new Date(dob) : null}
    onChange={(date) => setDob(date ? date.toISOString().split("T")[0] : "")}
    onBlur={() => setFieldTouched("dob")}
    maxDate={new Date()}
    minDate={new Date(new Date().getFullYear() - 120, 0, 1)}
    placeholderText="Select date of birth"
    showMonthDropdown
    showYearDropdown
    dropdownMode="select"
    className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
      touched.dob && errors.dob ? "border-red-500" : "border-gray-300"
    }`}
  />
</InputIconWrap>

            <FieldError id="dob-error" msg={touched.dob ? errors.dob : ""} />
            <div className="mt-2 text-sm text-gray-600">
              Age:{" "}
              {age ? (
                <span className="inline-flex items-center rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                  {age} years
                </span>
              ) : (
                "—"
              )}
            </div>
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="gender" required>Gender</Label>
            <div className="mt-1">
              <Select
                inputId="gender"
                instanceId="gender-select"
                value={gender}
                onChange={setGender}
                options={GENDER_OPTS}
                placeholder="Select gender"
                styles={selectStyles}
                onBlur={() => setFieldTouched("gender")}
                classNamePrefix="react-select"
                aria-invalid={!!(touched.gender && errors.gender)}
                aria-describedby={touched.gender && errors.gender ? "gender-error" : undefined}
              />
            </div>
            <FieldError id="gender-error" msg={touched.gender ? errors.gender : ""} />
          </div>
        </section>

        {/* Contact */}
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="phone" required>Mobile (10-digit)</Label>
            <InputIconWrap icon={FaPhoneAlt}>
              <input
                id="phone"
                name="phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D+/g, "").slice(0, 10))}
                onBlur={() => setFieldTouched("phone")}
                aria-invalid={!!(touched.phone && errors.phone)}
                aria-describedby={touched.phone && errors.phone ? "phone-error" : undefined}
                className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.phone && errors.phone ? "border-red-500" : "border-gray-300"
                }`}
                inputMode="numeric"
                pattern="[6-9][0-9]{9}"
                placeholder="98XXXXXXXX"
                autoComplete="tel-national"
              />
            </InputIconWrap>
            <FieldError id="phone-error" msg={touched.phone ? errors.phone : ""} />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <InputIconWrap icon={FaEnvelope}>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setFieldTouched("email")}
                aria-invalid={!!(touched.email && errors.email)}
                aria-describedby={touched.email && errors.email ? "email-error" : undefined}
                className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.email && errors.email ? "border-red-500" : "border-gray-300"
                }`}
                inputMode="email"
                autoComplete="email"
                placeholder="name@example.com"
              />
            </InputIconWrap>
            <FieldError id="email-error" msg={touched.email ? errors.email : ""} />
          </div>
        </section>

        {/* Address */}
        <section className="grid gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="addr1">Address Line 1</Label>
            <InputIconWrap icon={MdOutlineHome}>
              <input
                id="addr1"
                name="addressLine1"
                value={addressLine1}
                onChange={(e) => setAddressLine1(e.target.value)}
                className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="address-line1"
                placeholder="House/Flat, Street"
              />
            </InputIconWrap>
          </div>

          <div>
            <Label htmlFor="addr2">Address Line 2</Label>
            <InputIconWrap icon={MdOutlineHome}>
              <input
                id="addr2"
                name="addressLine2"
                value={addressLine2}
                onChange={(e) => setAddressLine2(e.target.value)}
                className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="address-line2"
                placeholder="Area, Landmark"
              />
            </InputIconWrap>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div>
            <Label htmlFor="city">City</Label>
            <InputIconWrap icon={MdOutlineLocationCity}>
              <input
                id="city"
                name="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="address-level2"
              />
            </InputIconWrap>
          </div>

          <div>
            <Label htmlFor="state">State</Label>
            <InputIconWrap icon={FaMapMarkerAlt}>
              <input
                id="state"
                name="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoComplete="address-level1"
              />
            </InputIconWrap>
          </div>

          <div>
            <Label htmlFor="pincode">Pincode</Label>
            <InputIconWrap icon={FaMapMarkerAlt}>
              <input
                id="pincode"
                name="pincode"
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D+/g, "").slice(0, 6))}
                onBlur={() => setFieldTouched("pincode")}
                aria-invalid={!!(touched.pincode && errors.pincode)}
                aria-describedby={touched.pincode && errors.pincode ? "pincode-error" : undefined}
                className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.pincode && errors.pincode ? "border-red-500" : "border-gray-300"
                }`}
                inputMode="numeric"
                pattern="[0-9]{6}"
                autoComplete="postal-code"
                placeholder="6-digit"
              />
            </InputIconWrap>
            <FieldError id="pincode-error" msg={touched.pincode ? errors.pincode : ""} />
          </div>
        </section>

        {/* Occupation */}
        <section>
          <Label htmlFor="occupation">Occupation</Label>
          <InputIconWrap icon={FaBriefcase}>
            <input
              id="occupation"
              name="occupation"
              value={occupation}
              onChange={(e) => setOccupation(e.target.value)}
              className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              placeholder="e.g., Software Engineer"
              autoComplete="organization-title"
            />
          </InputIconWrap>
        </section>

        {/* Emergency Contact */}
        <section className="pt-2">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Emergency Contact</h3>
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <Label htmlFor="emgName">Name</Label>
              <InputIconWrap icon={FaUserShield}>
                <input
                  id="emgName"
                  name="emgName"
                  value={emgName}
                  onChange={(e) => setEmgName(e.target.value)}
                  className="mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  autoComplete="name"
                />
              </InputIconWrap>
            </div>

            <div>
              <Label htmlFor="emgRelation">Relationship</Label>
              <div className="mt-1">
                <Select
                  inputId="emgRelation"
                  instanceId="relation-select"
                  value={emgRelation}
                  onChange={setEmgRelation}
                  options={RELATION_OPTS}
                  placeholder="Select relation"
                  styles={{
                    ...selectStyles,
                    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                    menu: (provided) => ({ ...provided, zIndex: 9999, position: "absolute" }),
                  }}
                  menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                  menuPosition="fixed"
                  onBlur={() => setFieldTouched("emgRelation")}
                  classNamePrefix="react-select"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="emgPhone">Phone</Label>
              <InputIconWrap icon={FaPhoneAlt}>
                <input
                  id="emgPhone"
                  name="emgPhone"
                  value={emgPhone}
                  onChange={(e) => setEmgPhone(e.target.value.replace(/\D+/g, "").slice(0, 10))}
                  onBlur={() => setFieldTouched("emgPhone")}
                  aria-invalid={!!(touched.emgPhone && errors.emgPhone)}
                  aria-describedby={touched.emgPhone && errors.emgPhone ? "emgPhone-error" : undefined}
                  className={`mt-1 w-full rounded-lg border pl-10 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                    touched.emgPhone && errors.emgPhone ? "border-red-500" : "border-gray-300"
                  }`}
                  inputMode="numeric"
                  pattern="[6-9][0-9]{9}"
                  placeholder="98XXXXXXXX"
                  autoComplete="tel"
                />
              </InputIconWrap>
              <FieldError id="emgPhone-error" msg={touched.emgPhone ? errors.emgPhone : ""} />
            </div>
          </div>
        </section>
      </div>

      {/* Sticky bottom action bar */}
      <div className="sticky bottom-0 z-10 w-full border-t border-gray-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              // quick clear (local only)
              setFirstName("");
              setLastName("");
              setDob("");
              setGender(null);
              setPhone("");
              setEmail("");
              setAddressLine1("");
              setAddressLine2("");
              setCity("");
              setState("");
              setPincode("");
              setOccupation("");
              setEmgName("");
              setEmgRelation(null);
              setEmgPhone("");
              setPhotoIK(null);
              setPhotoPreview("");
              setPhotoError("");
              setTouched({});
              setErrors({});
              setFolderLocked(null);
              setPendingDeleteId(null);
              try {
                localStorage.removeItem(DRAFT_KEY);
              } catch {}
            }}
            className="rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Reset
          </button>

          <button
            type="submit"
            className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
              isFormValid && !saving ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-400 cursor-not-allowed"
            }`}
            disabled={!isFormValid || saving}
          >
            {saving ? "Saving…" : "Next"}
          </button>
        </div>
      </div>
    </form>
  );
};

export default PatientProfileForm;
