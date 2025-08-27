// controllers/patientController.js
const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');

/* ---------------- Supabase client bound to incoming JWT ---------------- */
const supabaseForReq = (req) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.authorization } },
    auth: { persistSession: false },
  });

/* ---------------------------- small helpers ---------------------------- */
const sbError = (res, error, status = 400) =>
  res.status(status).json({ error: error?.message || String(error) });

const toDateOnly = (v) => {
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
};

const clampNum = (n) => (Number.isFinite(n) && n >= 0 ? n : 0);
const parseNum = (v) => {
  const n = parseFloat(String(v ?? '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : 0;
};
const hasValue = (v) => String(v ?? '').trim() !== '';

/** Coerce frontend photo input (ImageKit/etc) into a plain URL string. */
const coercePhotoUrl = (src) => {
  if (!src) return null;
  if (typeof src === 'string') return src || null;
  if (typeof src === 'object') {
    return src.url || src.thumbnailUrl || src.path || null;
  }
  return null;
};

/* ----------------------- file upload: middleware ----------------------- */
// Accept a single image in field "photo"
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 7 * 1024 * 1024 }, // 7 MB limit
  fileFilter: (_req, file, cb) => {
    if (!/^image\//i.test(file.mimetype)) {
      return cb(new Error('Only image uploads are allowed'));
    }
    cb(null, true);
  },
});
const uploadPhoto = upload.single('photo');

/* ----------------------- file upload: Supabase fn ---------------------- */
const BUCKET = process.env.PATIENT_BUCKET || 'patient-photos';

/** Escape for use in RegExp */
const reEscape = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

/** Convert any Supabase storage URL (public or signed) to an object path */
function urlToObjectPath(urlOrPath) {
  if (!urlOrPath) return null;
  const s = String(urlOrPath).trim();
  if (!s) return null;
  if (!s.startsWith('http')) return s.replace(/^\/+/, '');

  const b = BUCKET.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // escape
  const re1 = new RegExp(`/storage/v1/object/(?:public|sign)/${b}/(.+?)(?:\\?|$)`);
  const re2 = new RegExp(`/storage/v1/object/${b}/(.+?)(?:\\?|$)`);

  const m = s.match(re1);
  if (m && m[1]) return m[1];
  const m2 = s.match(re2);
  if (m2 && m2[1]) return m2[1];
  return null;
}


/** Always create a signed URL (private bucket) for a known object path */
async function createSignedUrlSafe(supabase, objectPath, expiresIn = 3600) {
  const { data, error } = await supabase
    .storage
    .from(BUCKET)
    .createSignedUrl(objectPath, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Upload to Storage and return { path, signedUrl } */
async function uploadImageToSupabase({ supabase, file, userId, patientId }) {
  if (!file) return null;

  const ext = mime.extension(file.mimetype) || 'bin';
  const filename = `${uuidv4()}.${ext}`;
  const folder = patientId ? `patients/${patientId}` : 'patients';
  const objectPath = `${userId}/${folder}/${filename}`;

  const { error: upErr } = await supabase
    .storage
    .from(BUCKET)
    .upload(objectPath, file.buffer, {
      contentType: file.mimetype,
      cacheControl: '3600',
      upsert: false,
    });
  if (upErr) throw upErr;

  const signedUrl = await createSignedUrlSafe(supabase, objectPath, 3600);
  return { path: objectPath, signedUrl };
}

/* -------------------- get current user id (from JWT) ------------------- */
async function getUserIdFromReq(supabase) {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
}

/* --------------- body -> table row (used by UPDATE only) --------------- */
// replace the photo block inside mapPatientBodyToRow()
const mapPatientBodyToRow = (body = {}, { forUpdate = false } = {}) => {
  const row = {};
  const set = (k, v) => { if (v !== undefined) row[k] = v; };

  if (!forUpdate) set('created_by', body.created_by || body.createdBy);

  set('first_name', body.firstName);
  set('last_name', body.lastName);
  set('dob', toDateOnly(body.dob));
  set('gender', body.gender);
  set('phone', body.phone);
  set('email', body.email?.toLowerCase?.());
  set('address_line1', body.addressLine1);
  set('address_line2', body.addressLine2);
  set('city', body.city);
  set('state', body.state);
  set('pincode', body.pincode);
  set('occupation', body.occupation);
  set('emergency_contact', body.emergencyContact ?? null);

  // ✅ Only touch photo_url if the client sent a photo field
  let rawPhoto;
  let hasPhotoField = false;
  if (Object.prototype.hasOwnProperty.call(body, 'photoUrl')) {
    rawPhoto = body.photoUrl;
    hasPhotoField = true;
  } else if (Object.prototype.hasOwnProperty.call(body, 'photo')) {
    rawPhoto = coercePhotoUrl(body.photo);
    hasPhotoField = true;
  }

  if (hasPhotoField) {
    const asPath = urlToObjectPath(rawPhoto);
    set('photo_url', asPath ?? rawPhoto ?? null); // null here means "explicitly clear"
  }

  return row;
};


/* ---------------- RPC mappers for atomic initial create ---------------- */
// replace the photo block inside mapPatientRPC()
const mapPatientRPC = (body = {}) => {
  let rawPhoto;
  if (Object.prototype.hasOwnProperty.call(body, 'photoUrl')) {
    rawPhoto = body.photoUrl;
  } else if (Object.prototype.hasOwnProperty.call(body, 'photo')) {
    rawPhoto = coercePhotoUrl(body.photo);
  }
  const asPath = urlToObjectPath(rawPhoto);

  return {
    first_name: body.firstName,
    last_name: body.lastName,
    dob: toDateOnly(body.dob),
    gender: body.gender,
    phone: body.phone,
    email: body.email?.toLowerCase?.(),
    address_line1: body.addressLine1,
    address_line2: body.addressLine2,
    city: body.city,
    state: body.state,
    pincode: body.pincode,
    occupation: body.occupation,
    emergency_contact: body.emergencyContact ?? null,
    photo_url: (rawPhoto === undefined) ? null : (asPath ?? rawPhoto ?? null),
  };
};


const mapMedHistRPC = (mh = {}) => ({
  surgery_or_hospitalized: mh.surgeryOrHospitalized ?? '',
  surgery_details: mh.surgeryDetails ?? null,

  fever_cold_cough: mh.feverColdCough ?? '',
  fever_details: mh.feverDetails ?? null,

  artificial_valves_pacemaker: !!mh.artificialValvesPacemaker,
  asthma: !!mh.asthma,
  allergy: !!mh.allergy,
  bleeding_tendency: !!mh.bleedingTendency,
  epilepsy_seizure: !!mh.epilepsySeizure,
  heart_disease: !!mh.heartDisease,
  hyp_hypertension: !!mh.hypHypertension,
  hormone_disorder: !!mh.hormoneDisorder,
  jaundice_liver: !!mh.jaundiceLiver,
  stomach_ulcer: !!mh.stomachUlcer,
  low_high_pressure: !!mh.lowHighPressure,
  arthritis_joint: !!mh.arthritisJoint,
  kidney_problems: !!mh.kidneyProblems,
  thyroid_problems: !!mh.thyroidProblems,
  other_problem: !!mh.otherProblem,
  other_problem_text: mh.otherProblemText ?? null,

  abnormal_bleeding_history: mh.abnormalBleedingHistory ?? '',
  abnormal_bleeding_details: mh.abnormalBleedingDetails ?? null,

  taking_medicine: mh.takingMedicine ?? '',
  medicine_details: mh.medicineDetails ?? null,

  medication_allergy: mh.medicationAllergy ?? '',
  medication_allergy_details: mh.medicationAllergyDetails ?? null,

  past_dental_history: mh.pastDentalHistory ?? null,
});

/* -------------------- Normalizers for visit payload -------------------- */
const TEETH = [8,7,6,5,4,3,2,1, 1,2,3,4,5,6,7,8];
const buildFindingsFromGrids = (upperGrades = [], lowerGrades = [], upperStatus = [], lowerStatus = []) => {
  const upper = Array.from({ length: 16 }).map((_, i) => ({
    tooth: TEETH[i],
    grade: upperGrades?.[i] || '',
    status: upperStatus?.[i] || '',
  }));
  const lower = Array.from({ length: 16 }).map((_, i) => ({
    tooth: TEETH[i],
    grade: lowerGrades?.[i] || '',
    status: lowerStatus?.[i] || '',
  }));
  return { upper, lower };
};

const normalizeFindings = (v = {}) => {
  if (v.findings && typeof v.findings === 'object') return v.findings;
  if (Array.isArray(v.upperGrades) || Array.isArray(v.lowerGrades)) {
    return buildFindingsFromGrids(v.upperGrades, v.lowerGrades, v.upperStatus, v.lowerStatus);
  }
  return null;
};

const normalizeProcedures = (root = {}) => {
  if (Array.isArray(root.procedures)) {
    return root.procedures.map((r) => {
      const total = parseNum(r.total);
      const paid = parseNum(r.paid);
      return {
        visitDate: r.visitDate ? toDateOnly(r.visitDate) : null,
        procedure: String(r.procedure || '').trim(),
        nextApptDate: r.nextApptDate ? toDateOnly(r.nextApptDate) : null,
        total,
        paid,
        due: clampNum(total - paid),
      };
    });
  }
  const procs = root.procedures && Array.isArray(root.procedures.rows)
    ? root.procedures.rows
    : (Array.isArray(root.rows) ? root.rows : null);

  if (!procs) return null;

  const cleaned = procs
    .filter((r) => {
      const anyMoney = hasValue(r.total) || hasValue(r.paid);
      const anyContent =
        anyMoney ||
        hasValue(r.procedure) ||
        hasValue(r.visitDate) ||
        hasValue(r.nextApptDate);
      return anyContent;
    })
    .map((r) => {
      const total = parseNum(r.total);
      const paid  = parseNum(r.paid);
      return {
        visitDate: r.visitDate ? toDateOnly(r.visitDate) : null,
        procedure: String(r.procedure || '').trim(),
        nextApptDate: r.nextApptDate ? toDateOnly(r.nextApptDate) : null,
        total,
        paid,
        due: clampNum(total - paid),
      };
    });

  return cleaned.length ? cleaned : null;
};

const mapVisitRPC = (v = {}) => {
  const findings = normalizeFindings(v);
  const procedures = normalizeProcedures(v);
  const triggers =
    Array.isArray(v.triggerFactors)
      ? v.triggerFactors
      : (v.triggerFactors ? [String(v.triggerFactors)] : []);

  return {
    chief_complaint: (v.chiefComplaint ?? null)?.trim() || null,
    duration_onset: v.durationOnset ?? null,
    trigger_factors: triggers,
    diagnosis_notes: v.diagnosisNotes ?? null,
    treatment_plan_notes: v.treatmentPlanNotes ?? null,
    findings: findings ?? null,
    procedures: procedures ?? null,
    visit_at: v.visitAt ? new Date(v.visitAt).toISOString() : null,
  };
};

/* ---------------------------- Controllers ---------------------------- */

const createPatient = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);

    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = await getUserIdFromReq(supabase);
    if (!userId) return res.status(401).json({ error: 'Invalid user' });

    const body = req.body || {};

    // Merge patientProfile if present
    const rootProfile = body.patientProfile && typeof body.patientProfile === 'object'
      ? { ...body, ...body.patientProfile }
      : { ...body };

    // Coerce ImageKit/etc if provided
    if (!rootProfile.photoUrl) {
      const viaPhoto = coercePhotoUrl(rootProfile.photo);
      if (viaPhoto) rootProfile.photoUrl = viaPhoto;
    }

    // If a file was uploaded, push to storage first; store PATH in DB
    if (req.file) {
      const uploaded = await uploadImageToSupabase({
        supabase,
        file: req.file,
        userId,
        patientId: null, // id unknown yet
      });
      if (uploaded?.path) {
        rootProfile.photoUrl = uploaded.path; // store path in DB
      }
    }

    const p_patient = mapPatientRPC(rootProfile);
    const mhSrc = body.medicalHistory || rootProfile.medicalHistory || {};
    const p_medhist = mapMedHistRPC(mhSrc);

    const visitSrc = body.initialVisit
      ? body.initialVisit
      : {
          ...(body.dentalExam || {}),
          procedures: normalizeProcedures(body) || (body.dentalExam ? normalizeProcedures(body.dentalExam) : null),
        };
    if (!visitSrc.procedures) {
      const p = normalizeProcedures(visitSrc);
      if (p) visitSrc.procedures = p;
    }
    if (!visitSrc.findings) {
      visitSrc.findings = normalizeFindings(visitSrc);
    }
    const p_visit = mapVisitRPC(visitSrc);

    if (!p_patient.first_name || !p_patient.last_name || !p_patient.dob || !p_patient.gender || !p_patient.phone) {
      return res.status(400).json({ error: 'Missing required patient fields (firstName, lastName, dob, gender, phone)' });
    }
    if (!p_visit.chief_complaint) {
      return res.status(400).json({ error: 'Missing chief complaint for initial visit' });
    }

    const { data, error } = await supabase.rpc('create_patient_with_initials', {
      p_patient,
      p_medhist,
      p_visit,
    });
    if (error) return sbError(res, error);

    const row = Array.isArray(data) ? data[0] : data;

    // Sign on the way out if we stored a Supabase path
    const pathMaybe = urlToObjectPath(row?.photo_url);
    if (pathMaybe) {
      const signed = await createSignedUrlSafe(supabase, pathMaybe, 3600);
      row.photo_url = signed || null;
    }
    return res.status(201).json(row);
  } catch (err) {
    return sbError(res, err);
  }
};

// List patients (RLS filters to owner) — always return fresh signed URLs
const getAllPatients = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    const { limit = 100, offset = 0 } = req.query;

    const { data, error } = await supabase
      .from('patients')
      .select('*')
      .order('created_at', { ascending: false })
      .range(Number(offset), Number(offset) + Number(limit) - 1);

    if (error) return sbError(res, error);

    const signedRows = await Promise.all(
      (data ?? []).map(async (p) => {
        const pathMaybe = urlToObjectPath(p.photo_url);
        // External URLs or null => return as is
        if (!pathMaybe) return p;

        const signed = await createSignedUrlSafe(supabase, pathMaybe, 3600);
        return { ...p, photo_url: signed || null };
      })
    );

    return res.json(signedRows);
  } catch (err) {
    return sbError(res, err);
  }
};

// Fetch one + quick meta — return fresh signed URL
const getPatient = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    const { id } = req.params;

    const { data: patient, error: pErr } = await supabase
      .from('patients')
      .select('*')
      .eq('id', id)
      .single();

    if (pErr?.code === 'PGRST116' || (!patient && !pErr)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (pErr) return sbError(res, pErr);

    const { data: mhRows, error: mhErr } = await supabase
      .from('medical_histories')
      .select('id')
      .eq('patient_id', id)
      .limit(1);
    if (mhErr) return sbError(res, mhErr);

    const { data: vRows, error: vErr } = await supabase
      .from('visits')
      .select('visit_at')
      .eq('patient_id', id)
      .order('visit_at', { ascending: false })
      .limit(1);
    if (vErr) return sbError(res, vErr);

    const out = { ...patient };
    const pathMaybe = urlToObjectPath(out.photo_url);
    if (pathMaybe) {
      const signed = await createSignedUrlSafe(supabase, pathMaybe, 3600);
      out.photo_url = signed || null;
    }

    return res.json({
      patient: out,
      meta: {
        hasMedicalHistory: Array.isArray(mhRows) && mhRows.length > 0,
        lastVisitAt:
          Array.isArray(vRows) && vRows.length > 0 ? vRows[0].visit_at : null,
      },
    });
  } catch (err) {
    return sbError(res, err);
  }
};

// Update patient — store PATH; return fresh signed URL
const updatePatient = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    const { id } = req.params;

    let baseRow = mapPatientBodyToRow(req.body || {}, { forUpdate: true });

    // If a new file is uploaded, push to storage and set row.photo_url to PATH
    if (req.file) {
      const userId = await getUserIdFromReq(supabase);
      if (!userId) return res.status(401).json({ error: 'Invalid user' });
      const uploaded = await uploadImageToSupabase({
        supabase,
        file: req.file,
        userId,
        patientId: id,
      });
      if (uploaded?.path) {
        baseRow.photo_url = uploaded.path; // store path
      }
    }

    if (Object.keys(baseRow).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    const { data, error } = await supabase
      .from('patients')
      .update(baseRow)
      .eq('id', id)
      .select('*')
      .single();

    if (error?.code === 'PGRST116' || (!data && !error)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (error) return sbError(res, error);

    // Sign on the way out
    const pathMaybe = urlToObjectPath(data.photo_url);
    const signed = pathMaybe ? await createSignedUrlSafe(supabase, pathMaybe, 3600) : null;

    return res.json({
      ...data,
      photo_url: signed || (urlToObjectPath(data.photo_url) ? null : data.photo_url), // keep external URL
    });
  } catch (err) {
    return sbError(res, err);
  }
};

// Delete patient
const deletePatient = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    const { id } = req.params;

    const { data, error } = await supabase
      .from('patients')
      .delete()
      .eq('id', id)
      .select('*')
      .single();

    if (error?.code === 'PGRST116' || (!data && !error)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (error) return sbError(res, error);

    return res.json({ message: 'Patient deleted successfully' });
  } catch (err) {
    return sbError(res, err);
  }
};


// Update ONLY the photo (accepts JSON { photoUrl } OR multipart file under "photo")
const updatePhoto = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { id } = req.params;
    let { photoUrl } = req.body;

    // If a file was uploaded, push to storage and prefer its path
    if (req.file) {
      const userId = await getUserIdFromReq(supabase);
      if (!userId) return res.status(401).json({ error: 'Invalid user' });

      const uploaded = await uploadImageToSupabase({
        supabase,
        file: req.file,
        userId,
        patientId: id, // put it under /{userId}/patients/{id}/...
      });
      photoUrl = uploaded?.path || null; // store the STORAGE PATH when we uploaded a file
    }

    if (photoUrl === undefined || photoUrl === null) {
      // if neither JSON photoUrl nor file provided
      return res.status(400).json({ error: 'photoUrl or photo file is required' });
    }

    // If photoUrl looks like a Supabase signed/public URL, convert to object path; otherwise keep external URL
    const asPath = urlToObjectPath(photoUrl);
    const rowUpdate = { photo_url: asPath ?? photoUrl };

    const { data, error } = await supabase
      .from('patients')
      .update(rowUpdate)
      .eq('id', id)
      .select('*')
      .single();

    if (error?.code === 'PGRST116' || (!data && !error)) {
      return res.status(404).json({ error: 'Patient not found' });
    }
    if (error) return sbError(res, error);

    // Return a fresh signed URL if we stored a storage path
    const pathMaybe = urlToObjectPath(data.photo_url);
    const signed = pathMaybe ? await createSignedUrlSafe(supabase, pathMaybe, 3600) : null;

    return res.json({
      ...data,
      photo_url: signed || (pathMaybe ? null : data.photo_url), // keep external URLs as-is, sign storage paths
    });
  } catch (err) {
    return sbError(res, err);
  }
};


module.exports = {
  // middleware to use in routes:
  uploadPhoto,

  // controllers:
  createPatient,
  getAllPatients,
  getPatient,
  updatePatient,
  deletePatient,
  updatePhoto
};
