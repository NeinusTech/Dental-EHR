import React, { useRef, useState, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";

const ConsentForm = forwardRef(({ onConsentChange }, ref) => {
  const [consentGiven, setConsentGiven] = useState(false);
  const [typedName, setTypedName] = useState("");
  const sigCanvas = useRef(null);

  const clearSignature = () => sigCanvas.current.clear();

  const handleConsentChange = (e) => {
    setConsentGiven(e.target.checked);
    onConsentChange?.(e.target.checked);
  };

  // Expose methods to parent
  useImperativeHandle(ref, () => ({
    getSignatureData: () => (sigCanvas.current.isEmpty() ? null : sigCanvas.current.toDataURL()),
    getTypedName: () => typedName,
    clearSignature,
  }));

  return (
    <div className="no-print mt-4 mb-4 p-4 flex flex-col rounded-lg border border-gray-300 bg-gray-100 space-y-4">
      <div className="flex items-center">
        <input
          type="checkbox"
          id="patient-consent"
          checked={consentGiven}
          onChange={handleConsentChange}
          className="h-4 w-4 text-indigo-600 border-gray-300 rounded"
        />
        <label htmlFor="patient-consent" className="ml-2 text-sm text-gray-700">
          I consent to submit my medical information for the patient record.
        </label>
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Type Your Name:</label>
        <input
          type="text"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          className="w-full border border-gray-300 rounded p-2 text-sm"
          placeholder="Your Name"
        />
      </div>

      <div>
        <label className="block text-sm text-gray-700 mb-1">Or Sign Below:</label>
        <SignatureCanvas
          ref={sigCanvas}
          penColor="black"
          canvasProps={{ className: "border border-gray-300 rounded w-full h-40" }}
        />
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={clearSignature}
            className="px-3 py-1 bg-gray-300 rounded hover:bg-gray-400 text-sm"
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
});

export default ConsentForm;
