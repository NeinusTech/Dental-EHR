// src/components/ProcedureTrackingForm.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
/* =========================================================
   ProcedureTrackingForm (NO backend writes on this step)
   - Local draft autosave (localStorage)
   - Inline per-row validation
   - Cleaned payload passed to onSave/onNext
   - Review step should POST/PUT to your API
   ========================================================= */

const DRAFT_KEY_BASE = "dental:procedureTracking";

const emptyRow = () => ({
  visitDate: "",
  procedure: "",
  nextApptDate: "",
  total: "",
  paid: "",
  due: 0,
});

const clampNum = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
const parseNum = (v) => {
  const n = parseFloat(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const hasValue = (v) => String(v ?? "").trim() !== "";

const inr = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(value)
    .replace("₹", "₹ ");

const ProcedureTrackingForm = ({
  initial = {}, // may contain { rows: [...] } from an existing visit
  patientId,    // used only to scope local draft key
  visitId,      // used only to scope local draft key
  onBack,
  onNext,
  onSave,
}) => {
  // Per-visit draft key so forms don’t collide between patients/visits
  const DRAFT_KEY = useMemo(
    () => `${DRAFT_KEY_BASE}:${visitId || patientId || "new"}:draft`,
    [visitId, patientId]
  );

  const [rows, setRows] = useState(
    initial.rows?.length
      ? initial.rows.map((r) => ({
          ...r,
          due: clampNum(parseNum(r.total) - parseNum(r.paid)),
        }))
      : [emptyRow()]
  );
  const [errors, setErrors] = useState([]); // per-row error maps
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const lastAddedRef = useRef(null);

  const recomputeDue = (r) => {
    const total = parseNum(r.total);
    const paid = parseNum(r.paid);
    return clampNum(total - paid);
  };

  const rowIsMeaningful = (r) => {
    const anyMoney = hasValue(r.total) || hasValue(r.paid);
    return (
      anyMoney ||
      hasValue(r.procedure) ||
      hasValue(r.visitDate) ||
      hasValue(r.nextApptDate)
    );
  };

  const validateRow = (r) => {
    const e = {};
    const total = parseNum(r.total);
    const paid = parseNum(r.paid);
    const anyContent = rowIsMeaningful(r);

    if (anyContent && !hasValue(r.visitDate)) e.visitDate = "Visit date is required";
    if (hasValue(r.total) && total < 0) e.total = "Total must be ≥ 0";
    if (hasValue(r.paid) && paid < 0) e.paid = "Paid must be ≥ 0";
    if (paid > total) e.paid = "Paid exceeds Total";
    if (r.nextApptDate && r.visitDate && r.nextApptDate < r.visitDate)
      e.nextApptDate = "Next appointment can’t be before visit";
    return e;
  };

  const validateAll = (rs = rows) => rs.map(validateRow);

  useEffect(() => {
    setErrors(validateAll());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  const updateRow = (idx, field, value) => {
    setRows((prev) => {
      const copy = prev.map((r) => ({ ...r }));
      copy[idx][field] = value;
      if (field === "total" || field === "paid") {
        copy[idx].due = recomputeDue(copy[idx]);
      }
      return copy;
    });
  };

  const addRow = () => {
    setRows((r) => [...r, emptyRow()]);
    // focus the new Visit Date
    setTimeout(() => lastAddedRef.current?.focus(), 0);
  };

  const removeRow = (idx) =>
    setRows((r) => (r.length === 1 ? r : r.filter((_, i) => i !== idx)));

  const clearAll = () => setRows([emptyRow()]);

  const summary = useMemo(() => {
    const total = rows.reduce((s, r) => s + parseNum(r.total), 0);
    const paid = rows.reduce((s, r) => s + parseNum(r.paid), 0);
    const due = clampNum(total - paid);
    return { total, paid, due };
  }, [rows]);

  const payload = useMemo(() => ({ rows, summary }), [rows, summary]);

  // ---- Autosave (debounced) ----
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(DRAFT_KEY, JSON.stringify(payload));
        }
      } catch {}
    }, 800);
    return () => clearTimeout(id);
  }, [payload, DRAFT_KEY]);

  // ---- Restore on mount (and when draft key changes) ----
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (Array.isArray(draft?.rows) && draft.rows.length) {
        const restored = draft.rows.map((r) => ({
          visitDate: r.visitDate ?? "",
          procedure: r.procedure ?? "",
          nextApptDate: r.nextApptDate ?? "",
          total: r.total ?? "",
          paid: r.paid ?? "",
          due: recomputeDue(r),
        }));
        setRows(restored);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [DRAFT_KEY]);

  const handleSaveDraft = () => onSave?.(payload);

  // Build clean rows for the final submit (filter out empty ones, coerce numbers)
  const buildCleanRows = (rs) =>
    rs
      .filter(rowIsMeaningful)
      .map((r) => {
        const total = parseNum(r.total);
        const paid = parseNum(r.paid);
        return {
          visitDate: r.visitDate || null, // "YYYY-MM-DD"
          procedure: String(r.procedure || "").trim(),
          nextApptDate: r.nextApptDate || null, // "YYYY-MM-DD" or null
          total,
          paid,
          due: clampNum(total - paid),
        };
      });

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitError("");

    // Full validation
    const emap = validateAll();
    setErrors(emap);
    const hasAnyError = emap.some((m) => Object.keys(m).length);
    if (hasAnyError) return;

    // Require at least one meaningful row
    const cleaned = buildCleanRows(rows);
    if (!cleaned.length) {
      setSubmitError("Please add at least one procedure or payment row.");
      return;
    }

    // Build the network-shaped payload but DON'T send; give it to Review
    const totalSum = cleaned.reduce((s, r) => s + r.total, 0);
    const paidSum = cleaned.reduce((s, r) => s + r.paid, 0);
    const networkPayload = {
      procedures: cleaned,
      summary: {
        total: totalSum,
        paid: paidSum,
        due: clampNum(totalSum - paidSum),
      },
    };

    setSaving(true);
    try {
      // Clear draft now that we're moving on
      try {
        if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY);
      } catch {}

      onSave?.(networkPayload);
      // Keep the raw UI payload as second arg if your parent expects it
      onNext?.(networkPayload, payload);
    } catch (err) {
      setSubmitError(err?.message || "Failed to continue");
    } finally {
      setSaving(false);
    }
  };

  const hasErrors = errors.some((m) => Object.keys(m).length);
  const hasAnyMeaningfulRow = rows.some(rowIsMeaningful);
  const canProceed = !hasErrors && hasAnyMeaningfulRow && !saving;

  // Normalize money on blur while keeping free typing on change
  const normalizeMoney = (idx, field) => {
    setRows((prev) => {
      const copy = prev.map((r) => ({ ...r }));
      const v = copy[idx][field];
      if (!hasValue(v)) return copy; // keep empty if empty
      const fixed = parseNum(v).toFixed(2);
      copy[idx][field] = fixed;
      copy[idx].due = recomputeDue(copy[idx]);
      return copy;
    });
  };
// Helper: format date as dd-MM-yyyy
const formatDateDDMMYYYY = (date) => {
  if (!date) return "";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

// Helper: parse dd-MM-yyyy to Date object
const parseDDMMYYYY = (str) => {
  if (!str) return null;
  const [day, month, year] = str.split("-");
  return new Date(year, month - 1, day);
};

  return (
    <form
      className="max-w-5xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden"
      onSubmit={handleSubmit}
      noValidate
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-50 to-white px-6 py-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-800">Procedure Tracking & Payments</h2>
            <p className="mt-1 text-sm text-gray-500">Track dental procedures and payment details</p>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {submitError && (
        <div className="px-6 pt-4">
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
            {submitError}
          </div>
        </div>
      )}

      <div className="px-6 py-6">
        {/* Table header - Desktop */}
        <div className="hidden md:grid grid-cols-12 gap-4 text-sm font-medium text-gray-600 mb-3 px-2">
          <div className="col-span-3">Visit Date</div>
          <div className="col-span-3">Next Appointment</div>
          <div className="col-span-3">Procedure</div>
          <div className="col-span-1 text-right">Total</div>
          <div className="col-span-1 text-right">Paid</div>
          <div className="col-span-1 text-right">Due</div>
        </div>

        {/* Rows */}
        <div className="space-y-6">
          {rows.map((row, idx) => {
            const err = errors[idx] || {};
            const visitInputRef = idx === rows.length - 1 ? lastAddedRef : undefined;
            return (
              <div
                key={idx}
                className="space-y-4 p-4 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                {/* Date Row */}
               
<div className="grid grid-cols-1 md:grid-cols-6 gap-4">
  {/* Visit Date */}
  <div className="md:col-span-3">
    <label className="text-xs text-gray-500 block mb-1">Visit Date</label>
    <DatePicker
          selected={row.visitDate ? parseDDMMYYYY(row.visitDate) : null}
          onChange={(date) =>
            updateRow(idx, "visitDate", formatDateDDMMYYYY(date))
          }
          dateFormat="dd-MM-yyyy"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
            err.visitDate ? "border-red-500" : "border-gray-300"
          }`}
        />
        {err.visitDate && (
          <p id={`visitDate-${idx}-err`} className="mt-1 text-xs text-red-600">
            {err.visitDate}
          </p>
        )}

  </div>

  {/* Next Appointment */}
  <div className="md:col-span-3">
    <label className="text-xs text-gray-500 block mb-1">Next Appointment</label>
     <DatePicker
          selected={row.nextApptDate ? parseDDMMYYYY(row.nextApptDate) : null}
          minDate={row.visitDate ? parseDDMMYYYY(row.visitDate) : null}
          onChange={(date) =>
            updateRow(idx, "nextApptDate", formatDateDDMMYYYY(date))
          }
          dateFormat="dd-MM-yyyy"
          className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
            err.nextApptDate ? "border-red-500" : "border-gray-300"
          }`}
        />
        {err.nextApptDate && (
          <p
            id={`nextAppt-${idx}-err`}
            className="mt-1 text-xs text-red-600"
          >
            {err.nextApptDate}
          </p>
        )}
  </div>
</div>

                {/* Procedure */}
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Procedure</label>
                  <input
                    value={row.procedure}
                    onChange={(e) => updateRow(idx, "procedure", e.target.value)}
                    placeholder="e.g., Composite filling 36"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Payment Row */}
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-start">
                  {/* Total */}
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Total</label>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={row.total}
                      onChange={(e) => updateRow(idx, "total", e.target.value)}
                      onBlur={() => normalizeMoney(idx, "total")}
                      className={`w-full rounded-lg border px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        err.total ? "border-red-500" : "border-gray-300"
                      }`}
                      aria-invalid={!!err.total}
                      aria-describedby={`total-${idx}-help total-${idx}-err`}
                    />
                    <p id={`total-${idx}-help`} className="mt-1 text-[11px] text-gray-500">
                      {inr(parseNum(row.total))}
                    </p>
                    {err.total && (
                      <p id={`total-${idx}-err`} className="mt-1 text-xs text-red-600">
                        {err.total}
                      </p>
                    )}
                  </div>

                  {/* Paid */}
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Paid</label>
                    <input
                      inputMode="decimal"
                      placeholder="0"
                      value={row.paid}
                      onChange={(e) => updateRow(idx, "paid", e.target.value)}
                      onBlur={() => normalizeMoney(idx, "paid")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addRow();
                        }
                      }}
                      className={`w-full rounded-lg border px-3 py-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent ${
                        err.paid ? "border-red-500" : "border-gray-300"
                      }`}
                      aria-invalid={!!err.paid}
                      aria-describedby={`paid-${idx}-help paid-${idx}-err`}
                    />
                    <p id={`paid-${idx}-help`} className="mt-1 text-[11px] text-gray-500">
                      {inr(parseNum(row.paid))}
                    </p>
                    {err.paid && (
                      <p id={`paid-${idx}-err`} className="mt-1 text-xs text-red-600">
                        {err.paid}
                      </p>
                    )}
                  </div>

                  {/* Due (read-only) */}
                  <div className="md:col-span-2">
                    <label className="text-xs text-gray-500 block mb-1">Due</label>
                    <div
                      className={`text-right font-medium rounded-lg px-3 py-2 ${
                        row.due > 0 ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                      }`}
                      role="status"
                      aria-live="polite"
                    >
                      {inr(row.due)}
                    </div>
                  </div>
                </div>

                {/* Actions per row */}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={addRow}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-indigo-600 hover:bg-indigo-50 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v12M6 12h12" />
                    </svg>
                    Add Row
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRow(idx)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                    disabled={rows.length === 1}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-1 12a2 2 0 01-2 2H8a2 2 0 01-2-2L5 7m5 0V4a1 1 0 011-1h2a1 1 0 011 1v3M4 7h16M10 11v6m4-6v6" />
                    </svg>
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    title="Clear all rows"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-6 p-4 rounded-lg bg-indigo-50 border border-indigo-100" aria-live="polite">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="flex flex-col">
              <span className="text-gray-600 text-xs">Total Amount</span>
              <span className="font-semibold text-gray-800 text-lg">{inr(summary.total)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-600 text-xs">Amount Paid</span>
              <span className="font-semibold text-green-600 text-lg">{inr(summary.paid)}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-gray-600 text-xs">Balance Due</span>
              <span className={`font-semibold text-lg ${summary.due > 0 ? "text-red-600" : "text-green-600"}`}>
                {inr(summary.due)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
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
              type="submit"
              className={`rounded-lg px-5 py-2.5 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors ${
                canProceed ? "bg-indigo-600 hover:bg-indigo-700" : "bg-indigo-400 cursor-not-allowed"
              }`}
              disabled={!canProceed}
            >
              {saving ? "Continuing…" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};

export default ProcedureTrackingForm;
