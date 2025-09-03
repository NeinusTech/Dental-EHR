import React, { useEffect, useMemo, useState } from "react";

/** Modern toggle chip with better accessibility */
const ToggleChip = ({ label, active, onClick, id }) => (
  <button
    id={id}
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={`px-4 py-2 rounded-full border text-sm font-medium transition-all duration-200 flex items-center focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
      ${
        active
          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
          : "bg-white text-gray-700 border-gray-300 hover:border-gray-400 hover:bg-gray-50"
      }`}
  >
    {active && (
      <svg
        className="w-4 h-4 mr-1.5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    )}
    {label}
  </button>
);

/** Radio option with sr-only input but announced label */
const RadioOption = ({ label, name, value, checked, onChange, describedBy }) => (
  <label className="inline-flex items-center cursor-pointer group">
    <input
      type="radio"
      name={name}
      value={value}
      checked={checked}
      onChange={onChange}
      className="sr-only"
      aria-label={label}
      aria-describedby={describedBy}
    />
    <span
      className={`w-5 h-5 rounded-full border flex items-center justify-center mr-2 transition-colors group-focus-within:ring-2 group-focus-within:ring-indigo-500
        ${checked ? "border-indigo-600 bg-indigo-600" : "border-gray-300"}`}
    >
      {checked && <span className="w-2.5 h-2.5 rounded-full bg-white"></span>}
    </span>
    <span className="text-gray-700">{label}</span>
  </label>
);

const FieldError = ({ id, msg }) =>
  msg ? (
    <p id={id} role="alert" className="mt-1 text-xs text-red-600">
      {msg}
    </p>
  ) : null;

const Helper = ({ id, children }) =>
  children ? (
    <p id={id} className="mt-1 text-xs text-gray-500">
      {children}
    </p>
  ) : null;

const MAX_NOTES = 500;

/**
 * MedicalHistoryForm
 * - No backend writes here. Only validate, draft locally, and pass data up.
 * - Parent (Review step) will persist via API.
 */
const MedicalHistoryForm = ({ patientId, initial = {}, onBack, onNext, onSave }) => {
  // ---- draft key is per patient so drafts don't collide
  const DRAFT_KEY = useMemo(
    () => `dental:medicalHistory:${patientId || "new"}:draft`,
    [patientId]
  );

  // --- Base state from props (will be overridden by saved draft on mount) ---
  const [surgeryOrHospitalized, setSurgeryOrHospitalized] = useState(
    initial.surgeryOrHospitalized ?? ""
  );
  const [surgeryDetails, setSurgeryDetails] = useState(initial.surgeryDetails || "");
  const [feverColdCough, setFeverColdCough] = useState(initial.feverColdCough ?? "");
  const [feverDetails, setFeverDetails] = useState(initial.feverDetails || "");
  const [artificialValvesPacemaker, setArtificialValvesPacemaker] = useState(
    initial.artificialValvesPacemaker || false
  );
  const [asthma, setAsthma] = useState(initial.asthma || false);
  const [allergy, setAllergy] = useState(initial.allergy || false);
  const [bleedingTendency, setBleedingTendency] = useState(initial.bleedingTendency || false);
  const [epilepsySeizure, setEpilepsySeizure] = useState(initial.epilepsySeizure || false);
  const [heartDisease, setHeartDisease] = useState(initial.heartDisease || false);
  const [hypHypertension, setHypHypertension] = useState(initial.hypHypertension || false);
  const [hormoneDisorder, setHormoneDisorder] = useState(initial.hormoneDisorder || false);
  const [jaundiceLiver, setJaundiceLiver] = useState(initial.jaundiceLiver || false);
  const [stomachUlcer, setStomachUlcer] = useState(initial.stomachUlcer || false);
  const [lowHighPressure, setLowHighPressure] = useState(initial.lowHighPressure || false);
  const [arthritisJoint, setArthritisJoint] = useState(initial.arthritisJoint || false);
  const [kidneyProblems, setKidneyProblems] = useState(initial.kidneyProblems || false);
  const [thyroidProblems, setThyroidProblems] = useState(initial.thyroidProblems || false);
  const [otherProblem, setOtherProblem] = useState(initial.otherProblem || false);
  const [otherProblemText, setOtherProblemText] = useState(initial.otherProblemText || "");
  const [abnormalBleedingHistory, setAbnormalBleedingHistory] = useState(
    initial.abnormalBleedingHistory ?? ""
  );
  const [abnormalBleedingDetails, setAbnormalBleedingDetails] = useState(
    initial.abnormalBleedingDetails || ""
  );
  const [takingMedicine, setTakingMedicine] = useState(initial.takingMedicine ?? "");
  const [medicineDetails, setMedicineDetails] = useState(initial.medicineDetails || "");
  const [medicationAllergy, setMedicationAllergy] = useState(initial.medicationAllergy ?? "");
  const [medicationAllergyDetails, setMedicationAllergyDetails] = useState(
    initial.medicationAllergyDetails || ""
  );
  const [pastDentalHistory, setPastDentalHistory] = useState(initial.pastDentalHistory || "");

  // --- Touched + errors + submit state ---
  const [touched, setTouched] = useState({});
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const problems = useMemo(
    () => ({
      artificialValvesPacemaker,
      asthma,
      allergy,
      bleedingTendency,
      epilepsySeizure,
      heartDisease,
      hypHypertension,
      hormoneDisorder,
      jaundiceLiver,
      stomachUlcer,
      lowHighPressure,
      arthritisJoint,
      kidneyProblems,
      thyroidProblems,
      otherProblem,
      otherProblemText: otherProblemText.trim(),
    }),
    [
      artificialValvesPacemaker,
      asthma,
      allergy,
      bleedingTendency,
      epilepsySeizure,
      heartDisease,
      hypHypertension,
      hormoneDisorder,
      jaundiceLiver,
      stomachUlcer,
      lowHighPressure,
      arthritisJoint,
      kidneyProblems,
      thyroidProblems,
      otherProblem,
      otherProblemText,
    ]
  );

  // --- Memoized payload for saving ---
  const payload = useMemo(
    () => ({
      surgeryOrHospitalized,
      surgeryDetails: surgeryDetails.trim(),
      feverColdCough,
      feverDetails: feverDetails.trim(),
      problems,
      abnormalBleedingHistory,
      abnormalBleedingDetails: abnormalBleedingDetails.trim(),
      takingMedicine,
      medicineDetails: medicineDetails.trim(),
      medicationAllergy,
      medicationAllergyDetails: medicationAllergyDetails.trim(),
      pastDentalHistory: pastDentalHistory.trim(),
    }),
    [
      surgeryOrHospitalized,
      surgeryDetails,
      feverColdCough,
      feverDetails,
      problems,
      abnormalBleedingHistory,
      abnormalBleedingDetails,
      takingMedicine,
      medicineDetails,
      medicationAllergy,
      medicationAllergyDetails,
      pastDentalHistory,
    ]
  );

  // --- Validation ---
  const validate = (data = payload) => {
    const e = {};
    if (!data.surgeryOrHospitalized) e.surgeryOrHospitalized = "Please select Yes or No";
    if (data.surgeryOrHospitalized === "Yes" && !data.surgeryDetails)
      e.surgeryDetails = "Please provide details";

    if (!data.feverColdCough) e.feverColdCough = "Please select Yes or No";
    if (data.feverColdCough === "Yes" && !data.feverDetails)
      e.feverDetails = "Please describe your symptoms";

    if (!data.abnormalBleedingHistory) e.abnormalBleedingHistory = "Please select Yes or No";
    if (data.abnormalBleedingHistory === "Yes" && !data.abnormalBleedingDetails)
      e.abnormalBleedingDetails = "Please provide details";

    if (!data.takingMedicine) e.takingMedicine = "Please select Yes or No";
    if (data.takingMedicine === "Yes" && !data.medicineDetails)
      e.medicineDetails = "Please list medicines";

    if (!data.medicationAllergy) e.medicationAllergy = "Please select Yes or No";
    if (data.medicationAllergy === "Yes" && !data.medicationAllergyDetails)
      e.medicationAllergyDetails = "Please specify medications and reactions";

    if (data.problems.otherProblem && !data.problems.otherProblemText)
      e.otherProblemText = "Please specify other problems";

    const long = (s) => s && s.length > MAX_NOTES;
    if (long(data.surgeryDetails)) e.surgeryDetails = `Keep under ${MAX_NOTES} chars`;
    if (long(data.feverDetails)) e.feverDetails = `Keep under ${MAX_NOTES} chars`;
    if (long(data.abnormalBleedingDetails))
      e.abnormalBleedingDetails = `Keep under ${MAX_NOTES} chars`;
    if (long(data.medicineDetails)) e.medicineDetails = `Keep under ${MAX_NOTES} chars`;
    if (long(data.medicationAllergyDetails))
      e.medicationAllergyDetails = `Keep under ${MAX_NOTES} chars`;
    if (long(data.pastDentalHistory)) e.pastDentalHistory = `Keep under ${MAX_NOTES} chars`;

    return e;
  };

  useEffect(() => {
    setErrors(validate());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payload]);

  const setFieldTouched = (name) => setTouched((t) => ({ ...t, [name]: true }));
  const isFormValid = Object.keys(validate()).length === 0;

  // --- Auto-save to localStorage (debounced) ---
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        }
      } catch {}
    }, 1500);
    return () => clearTimeout(id);
  }, [payload, DRAFT_KEY]);

  // --- Restore from localStorage; re-run when patientId (key) or initial change ---
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(DRAFT_KEY);
      const draft = raw ? JSON.parse(raw) : {};

      setSurgeryOrHospitalized(draft.surgeryOrHospitalized ?? initial.surgeryOrHospitalized ?? "");
      setSurgeryDetails(draft.surgeryDetails ?? initial.surgeryDetails ?? "");
      setFeverColdCough(draft.feverColdCough ?? initial.feverColdCough ?? "");
      setFeverDetails(draft.feverDetails ?? initial.feverDetails ?? "");

      const dp = draft.problems || {};
      setArtificialValvesPacemaker(
        dp.artificialValvesPacemaker ?? initial.artificialValvesPacemaker ?? false
      );
      setAsthma(dp.asthma ?? initial.asthma ?? false);
      setAllergy(dp.allergy ?? initial.allergy ?? false);
      setBleedingTendency(dp.bleedingTendency ?? initial.bleedingTendency ?? false);
      setEpilepsySeizure(dp.epilepsySeizure ?? initial.epilepsySeizure ?? false);
      setHeartDisease(dp.heartDisease ?? initial.heartDisease ?? false);
      setHypHypertension(dp.hypHypertension ?? initial.hypHypertension ?? false);
      setHormoneDisorder(dp.hormoneDisorder ?? initial.hormoneDisorder ?? false);
      setJaundiceLiver(dp.jaundiceLiver ?? initial.jaundiceLiver ?? false);
      setStomachUlcer(dp.stomachUlcer ?? initial.stomachUlcer ?? false);
      setLowHighPressure(dp.lowHighPressure ?? initial.lowHighPressure ?? false);
      setArthritisJoint(dp.arthritisJoint ?? initial.arthritisJoint ?? false);
      setKidneyProblems(dp.kidneyProblems ?? initial.kidneyProblems ?? false);
      setThyroidProblems(dp.thyroidProblems ?? initial.thyroidProblems ?? false);
      setOtherProblem(dp.otherProblem ?? initial.otherProblem ?? false);
      setOtherProblemText(dp.otherProblemText ?? initial.otherProblemText ?? "");

      setAbnormalBleedingHistory(
        draft.abnormalBleedingHistory ?? initial.abnormalBleedingHistory ?? ""
      );
      setAbnormalBleedingDetails(
        draft.abnormalBleedingDetails ?? initial.abnormalBleedingDetails ?? ""
      );
      setTakingMedicine(draft.takingMedicine ?? initial.takingMedicine ?? "");
      setMedicineDetails(draft.medicineDetails ?? initial.medicineDetails ?? "");
      setMedicationAllergy(draft.medicationAllergy ?? initial.medicationAllergy ?? "");
      setMedicationAllergyDetails(
        draft.medicationAllergyDetails ?? initial.medicationAllergyDetails ?? ""
      );
      setPastDentalHistory(draft.pastDentalHistory ?? initial.pastDentalHistory ?? "");
    } catch {}
  }, [DRAFT_KEY, initial]);

  // Keep otherProblemText in sync if the toggle becomes false from any source
  useEffect(() => {
    if (!otherProblem && otherProblemText) setOtherProblemText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherProblem]);

  // ---- Handlers ----
  const handleSaveDraft = () => onSave?.(payload);

  // IMPORTANT: no backend write here; just validate and pass up.
  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");

    const emap = validate();
    setErrors(emap);
    setTouched({
      surgeryOrHospitalized: true,
      surgeryDetails: true,
      feverColdCough: true,
      feverDetails: true,
      abnormalBleedingHistory: true,
      abnormalBleedingDetails: true,
      takingMedicine: true,
      medicineDetails: true,
      medicationAllergy: true,
      medicationAllergyDetails: true,
      otherProblemText: true,
      pastDentalHistory: true,
    });
    if (Object.keys(emap).length) return;

    setSaving(true);
    try {
      onSave?.(payload);          // lets parent persist draft UI/time if desired
      onNext?.(payload, payload); // move forward with complete data
    } catch (err) {
      setSubmitError(err?.message || "Failed to continue");
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setSurgeryOrHospitalized("");
    setSurgeryDetails("");
    setFeverColdCough("");
    setFeverDetails("");
    setArtificialValvesPacemaker(false);
    setAsthma(false);
    setAllergy(false);
    setBleedingTendency(false);
    setEpilepsySeizure(false);
    setHeartDisease(false);
    setHypHypertension(false);
    setHormoneDisorder(false);
    setJaundiceLiver(false);
    setStomachUlcer(false);
    setLowHighPressure(false);
    setArthritisJoint(false);
    setKidneyProblems(false);
    setThyroidProblems(false);
    setOtherProblem(false);
    setOtherProblemText("");
    setAbnormalBleedingHistory("");
    setAbnormalBleedingDetails("");
    setTakingMedicine("");
    setMedicineDetails("");
    setMedicationAllergy("");
    setMedicationAllergyDetails("");
    setPastDentalHistory("");
    setErrors({});
    setTouched({});
    try {
      if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
    } catch {}
  };

  const count = (s) => (s ? s.length : 0);

  return (
    <form
      className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-white px-6 py-6 border-b border-gray-100">
        <h1 className="text-2xl font-semibold text-gray-800">Medical History</h1>
        <p className="mt-1 text-sm text-gray-500">
          Please provide your complete medical history for safe treatment planning.
        </p>
      </div>

      {/* Submit error */}
      {submitError && (
        <div className="px-6 pt-4">
          <p className="text-sm text-red-600">{submitError}</p>
        </div>
      )}

      <div className="px-6 py-6 space-y-8">
        {/* Q1 */}
        <fieldset className="space-y-3" aria-describedby="q1-help q1-error">
          <legend className="block text-sm font-medium text-gray-700">
            1. Surgery or hospitalized in the past 5 years?
          </legend>
          <Helper id="q1-help">If yes, specify procedure, month/year, and reason.</Helper>
          <div className="flex gap-6">
            <RadioOption
              label="Yes"
              name="surgeryOrHospitalized"
              value="Yes"
              checked={surgeryOrHospitalized === "Yes"}
              onChange={() => {
                setSurgeryOrHospitalized("Yes");
                setFieldTouched("surgeryOrHospitalized");
              }}
              describedBy="q1-help"
            />
            <RadioOption
              label="No"
              name="surgeryOrHospitalized"
              value="No"
              checked={surgeryOrHospitalized === "No"}
              onChange={() => {
                setSurgeryOrHospitalized("No");
                setFieldTouched("surgeryOrHospitalized");
                setSurgeryDetails("");
              }}
              describedBy="q1-help"
            />
          </div>
          {touched.surgeryOrHospitalized && (
            <FieldError id="q1-error" msg={errors.surgeryOrHospitalized} />
          )}
          {surgeryOrHospitalized === "Yes" && (
            <div className="mt-3">
              <label htmlFor="surgeryDetails" className="sr-only">
                Surgery/hospitalization details
              </label>
              <textarea
                id="surgeryDetails"
                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.surgeryDetails && errors.surgeryDetails
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Please specify surgery/hospitalization details"
                rows={3}
                value={surgeryDetails}
                onChange={(e) => setSurgeryDetails(e.target.value.slice(0, MAX_NOTES))}
                onBlur={() => setFieldTouched("surgeryDetails")}
                aria-invalid={!!(touched.surgeryDetails && errors.surgeryDetails)}
                aria-describedby="surgeryDetails-help surgeryDetails-error"
              />
              <Helper id="surgeryDetails-help">
                {count(surgeryDetails)}/{MAX_NOTES}
              </Helper>
              <FieldError
                id="surgeryDetails-error"
                msg={touched.surgeryDetails ? errors.surgeryDetails : ""}
              />
            </div>
          )}
        </fieldset>

        {/* Q2 */}
        <fieldset className="space-y-3" aria-describedby="q2-error">
          <legend className="block text-sm font-medium text-gray-700">
            2. Are you suffering from fever/cold/cough?
          </legend>
          <div className="flex gap-6">
            <RadioOption
              label="Yes"
              name="feverColdCough"
              value="Yes"
              checked={feverColdCough === "Yes"}
              onChange={() => {
                setFeverColdCough("Yes");
                setFieldTouched("feverColdCough");
              }}
            />
            <RadioOption
              label="No"
              name="feverColdCough"
              value="No"
              checked={feverColdCough === "No"}
              onChange={() => {
                setFeverColdCough("No");
                setFieldTouched("feverColdCough");
                setFeverDetails("");
              }}
            />
          </div>
          {touched.feverColdCough && <FieldError id="q2-error" msg={errors.feverColdCough} />}
          {feverColdCough === "Yes" && (
            <div className="mt-3">
              <label htmlFor="feverDetails" className="sr-only">
                Symptoms details
              </label>
              <textarea
                id="feverDetails"
                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.feverDetails && errors.feverDetails
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Symptoms, duration, medications taken"
                rows={3}
                value={feverDetails}
                onChange={(e) => setFeverDetails(e.target.value.slice(0, MAX_NOTES))}
                onBlur={() => setFieldTouched("feverDetails")}
                aria-invalid={!!(touched.feverDetails && errors.feverDetails)}
                aria-describedby="feverDetails-help feverDetails-error"
              />
              <Helper id="feverDetails-help">
                {count(feverDetails)}/{MAX_NOTES}
              </Helper>
              <FieldError
                id="feverDetails-error"
                msg={touched.feverDetails ? errors.feverDetails : ""}
              />
            </div>
          )}
        </fieldset>

        {/* Q3 */}
        <div className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            3. Do you have any of the following problems? (select all that apply)
          </label>
          <div className="flex flex-wrap gap-3" role="group" aria-label="Health problems">
            <ToggleChip
              id="p1"
              label="Artificial Valves / Pacemakers"
              active={artificialValvesPacemaker}
              onClick={() => setArtificialValvesPacemaker((v) => !v)}
            />
            <ToggleChip id="p2" label="Asthma" active={asthma} onClick={() => setAsthma((v) => !v)} />
            <ToggleChip id="p3" label="Allergy" active={allergy} onClick={() => setAllergy((v) => !v)} />
            <ToggleChip
              id="p4"
              label="Bleeding Disorder"
              active={bleedingTendency}
              onClick={() => setBleedingTendency((v) => !v)}
            />
            <ToggleChip
              id="p5"
              label="Epilepsy / Seizure"
              active={epilepsySeizure}
              onClick={() => setEpilepsySeizure((v) => !v)}
            />
            <ToggleChip
              id="p6"
              label="Heart Disease"
              active={heartDisease}
              onClick={() => setHeartDisease((v) => !v)}
            />
            <ToggleChip
              id="p7"
              label="Hypertension / Hypotension"
              active={hypHypertension}
              onClick={() => setHypHypertension((v) => !v)}
            />
            <ToggleChip
              id="p8"
              label="Hormone Disorder"
              active={hormoneDisorder}
              onClick={() => setHormoneDisorder((v) => !v)}
            />
            <ToggleChip
              id="p9"
              label="Jaundice / Liver Disease"
              active={jaundiceLiver}
              onClick={() => setJaundiceLiver((v) => !v)}
            />
            <ToggleChip
              id="p10"
              label="Stomach Ulcer"
              active={stomachUlcer}
              onClick={() => setStomachUlcer((v) => !v)}
            />
            <ToggleChip
              id="p11"
              label="Low / High Pressure"
              active={lowHighPressure}
              onClick={() => setLowHighPressure((v) => !v)}
            />
            <ToggleChip
              id="p12"
              label="Arthritis / Joint Problem"
              active={arthritisJoint}
              onClick={() => setArthritisJoint((v) => !v)}
            />
            <ToggleChip
              id="p13"
              label="Kidney Problems"
              active={kidneyProblems}
              onClick={() => setKidneyProblems((v) => !v)}
            />
            <ToggleChip
              id="p14"
              label="Thyroid Problems"
              active={thyroidProblems}
              onClick={() => setThyroidProblems((v) => !v)}
            />
            <ToggleChip
              id="p15"
              label="Others"
              active={otherProblem}
              onClick={() => {
                setOtherProblem((v) => !v);
                setFieldTouched("otherProblemText");
                if (otherProblem) setOtherProblemText("");
              }}
            />
          </div>
          {otherProblem && (
            <div className="mt-3">
              <label htmlFor="otherProblemText" className="sr-only">
                Other problems details
              </label>
              <input
                id="otherProblemText"
                className={`w-full rounded-lg border px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.otherProblemText && errors.otherProblemText
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Please specify other problems"
                value={otherProblemText}
                onChange={(e) => setOtherProblemText(e.target.value.slice(0, 120))}
                onBlur={() => setFieldTouched("otherProblemText")}
                aria-invalid={!!(touched.otherProblemText && errors.otherProblemText)}
                aria-describedby="otherProblemText-error"
              />
              <FieldError
                id="otherProblemText-error"
                msg={touched.otherProblemText ? errors.otherProblemText : ""}
              />
            </div>
          )}
        </div>

        {/* Q4 */}
        <fieldset className="space-y-3" aria-describedby="q4-error">
          <legend className="block text-sm font-medium text-gray-700">
            4. Any history of abnormal bleeding following injury or operation?
          </legend>
          <div className="flex gap-6">
            <RadioOption
              label="Yes"
              name="abnormalBleedingHistory"
              value="Yes"
              checked={abnormalBleedingHistory === "Yes"}
              onChange={() => {
                setAbnormalBleedingHistory("Yes");
                setFieldTouched("abnormalBleedingHistory");
              }}
            />
            <RadioOption
              label="No"
              name="abnormalBleedingHistory"
              value="No"
              checked={abnormalBleedingHistory === "No"}
              onChange={() => {
                setAbnormalBleedingHistory("No");
                setFieldTouched("abnormalBleedingHistory");
                setAbnormalBleedingDetails("");
              }}
            />
          </div>
          {touched.abnormalBleedingHistory && (
            <FieldError id="q4-error" msg={errors.abnormalBleedingHistory} />
          )}
          {abnormalBleedingHistory === "Yes" && (
            <div className="mt-3">
              <label htmlFor="abnormalBleedingDetails" className="sr-only">
                Abnormal bleeding details
              </label>
              <textarea
                id="abnormalBleedingDetails"
                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.abnormalBleedingDetails && errors.abnormalBleedingDetails
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Please provide details"
                rows={3}
                value={abnormalBleedingDetails}
                onChange={(e) =>
                  setAbnormalBleedingDetails(e.target.value.slice(0, MAX_NOTES))
                }
                onBlur={() => setFieldTouched("abnormalBleedingDetails")}
                aria-invalid={!!(
                  touched.abnormalBleedingDetails && errors.abnormalBleedingDetails
                )}
                aria-describedby="abnormalBleedingDetails-help abnormalBleedingDetails-error"
              />
              <Helper id="abnormalBleedingDetails-help">
                {count(abnormalBleedingDetails)}/{MAX_NOTES}
              </Helper>
              <FieldError
                id="abnormalBleedingDetails-error"
                msg={
                  touched.abnormalBleedingDetails ? errors.abnormalBleedingDetails : ""
                }
              />
            </div>
          )}
        </fieldset>

        {/* Q5 */}
        <fieldset className="space-y-3" aria-describedby="q5-error">
          <legend className="block text-sm font-medium text-gray-700">
            5. Are you taking any medicine?
          </legend>
          <div className="flex gap-6">
            <RadioOption
              label="Yes"
              name="takingMedicine"
              value="Yes"
              checked={takingMedicine === "Yes"}
              onChange={() => {
                setTakingMedicine("Yes");
                setFieldTouched("takingMedicine");
              }}
            />
            <RadioOption
              label="No"
              name="takingMedicine"
              value="No"
              checked={takingMedicine === "No"}
              onChange={() => {
                setTakingMedicine("No");
                setFieldTouched("takingMedicine");
                setMedicineDetails("");
              }}
            />
          </div>
          {touched.takingMedicine && (
            <FieldError id="q5-error" msg={errors.takingMedicine} />
          )}
          {takingMedicine === "Yes" && (
            <div className="mt-3">
              <label htmlFor="medicineDetails" className="sr-only">
                Medicine details
              </label>
              <textarea
                id="medicineDetails"
                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.medicineDetails && errors.medicineDetails
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="List medicine names, dosage, frequency"
                rows={3}
                value={medicineDetails}
                onChange={(e) => setMedicineDetails(e.target.value.slice(0, MAX_NOTES))}
                onBlur={() => setFieldTouched("medicineDetails")}
                aria-invalid={!!(touched.medicineDetails && errors.medicineDetails)}
                aria-describedby="medicineDetails-help medicineDetails-error"
              />
              <Helper id="medicineDetails-help">
                {count(medicineDetails)}/{MAX_NOTES}
              </Helper>
              <FieldError
                id="medicineDetails-error"
                msg={touched.medicineDetails ? errors.medicineDetails : ""}
              />
            </div>
          )}
        </fieldset>

        {/* Q6 */}
        <fieldset className="space-y-3" aria-describedby="q6-error">
          <legend className="block text-sm font-medium text-gray-700">
            6. Allergic to any medication?
          </legend>
          <div className="flex gap-6">
            <RadioOption
              label="Yes"
              name="medicationAllergy"
              value="Yes"
              checked={medicationAllergy === "Yes"}
              onChange={() => {
                setMedicationAllergy("Yes");
                setFieldTouched("medicationAllergy");
              }}
            />
            <RadioOption
              label="No"
              name="medicationAllergy"
              value="No"
              checked={medicationAllergy === "No"}
              onChange={() => {
                setMedicationAllergy("No");
                setFieldTouched("medicationAllergy");
                setMedicationAllergyDetails("");
              }}
            />
          </div>
          {touched.medicationAllergy && (
            <FieldError id="q6-error" msg={errors.medicationAllergy} />
          )}
          {medicationAllergy === "Yes" && (
            <div className="mt-3">
              <label htmlFor="medicationAllergyDetails" className="sr-only">
                Medication allergy details
              </label>
              <textarea
                id="medicationAllergyDetails"
                className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                  touched.medicationAllergyDetails && errors.medicationAllergyDetails
                    ? "border-red-500"
                    : "border-gray-300"
                }`}
                placeholder="Which medications? What reaction?"
                rows={3}
                value={medicationAllergyDetails}
                onChange={(e) =>
                  setMedicationAllergyDetails(e.target.value.slice(0, MAX_NOTES))
                }
                onBlur={() => setFieldTouched("medicationAllergyDetails")}
                aria-invalid={!!(
                  touched.medicationAllergyDetails && errors.medicationAllergyDetails
                )}
                aria-describedby="medicationAllergyDetails-help medicationAllergyDetails-error"
              />
              <Helper id="medicationAllergyDetails-help">
                {count(medicationAllergyDetails)}/{MAX_NOTES}
              </Helper>
              <FieldError
                id="medicationAllergyDetails-error"
                msg={
                  touched.medicationAllergyDetails ? errors.medicationAllergyDetails : ""
                }
              />
            </div>
          )}
        </fieldset>

        {/* Q7 */}
        <div className="space-y-3">
          <label htmlFor="pastDentalHistory" className="block text-sm font-medium text-gray-700">
            7. Past dental history
          </label>
          <textarea
            id="pastDentalHistory"
            className={`w-full rounded-lg border px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
              touched.pastDentalHistory && errors.pastDentalHistory
                ? "border-red-500"
                : "border-gray-300"
            }`}
            placeholder="Previous treatments, frequency of visits, any complications"
            rows={4}
            value={pastDentalHistory}
            onChange={(e) => setPastDentalHistory(e.target.value.slice(0, MAX_NOTES))}
            onBlur={() => setTouched((t) => ({ ...t, pastDentalHistory: true }))}
            aria-invalid={!!(touched.pastDentalHistory && errors.pastDentalHistory)}
            aria-describedby="pastDentalHistory-help pastDentalHistory-error"
          />
          <Helper id="pastDentalHistory-help">
            {count(pastDentalHistory)}/{MAX_NOTES}
          </Helper>
          <FieldError
            id="pastDentalHistory-error"
            msg={touched.pastDentalHistory ? errors.pastDentalHistory : ""}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-0 border-t border-gray-200 bg-white/90 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => onBack?.(payload)}
            className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
          >
            Back
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSaveDraft}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Save Draft
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
            >
              Reset
            </button>
            <button
              type="submit"
              className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
                isFormValid && !saving
                  ? "bg-indigo-600 hover:bg-indigo-700"
                  : "bg-indigo-400 cursor-not-allowed"
              }`}
              disabled={!isFormValid || saving}
            >
              {saving ? "Continuing…" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default MedicalHistoryForm;
