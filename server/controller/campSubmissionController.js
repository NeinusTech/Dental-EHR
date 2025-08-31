// controllers/campSubmissionController.js
require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

/** ⬇️ Change this if you renamed the table in Postgres */
const TABLE = "user_submissions"; // or "camp_submissions" if you renamed it

/** Bind Supabase to the caller's JWT (Authorization header from the app). */
const supabaseForReq = (req) =>
  createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.authorization || "" } },
    auth: { persistSession: false },
  });

const sbError = (res, error, status = 400) => {
  const msg = error?.message || String(error);
  return res.status(status).json({ error: msg });
};

const getLimitOffset = (req, defLimit = 25, maxLimit = 200) => {
  const limit = Math.max(1, Math.min(Number(req.query.limit || defLimit), maxLimit));
  const offset = Math.max(0, Number(req.query.offset || 0));
  return { limit, offset, range: [offset, offset + limit - 1] };
};

/** Normalize + light-validate body */
const pickBody = (body = {}) => {
  const out = {
    name: (body.name || "").toString().trim(),
    dob: body.dob ? String(body.dob) : null, // YYYY-MM-DD
    email: body.email ? String(body.email).trim() : null,
    phone: body.phone ? String(body.phone).trim() : null,
    comments: body.comments ? String(body.comments) : null,
    institution: body.institution ? String(body.institution).trim() : null,
    institution_type: body.institutionType || body.institution_type || "Other",
  };
  if (!out.name) throw new Error("Name is required");
  return out;
};

/** GET /camp-submissions?limit=&offset=&q=&sort=created_at.desc */
const listCampSubmissions = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) return res.status(401).json({ error: "Unauthorized" });

    const { limit, range } = getLimitOffset(req);
    const q = (req.query.q || "").toString().trim();
    const sort = (req.query.sort || "created_at.desc").toString();
    const [sortCol, sortDir] = sort.split(".");

    let query = supabase
      .from(TABLE)
      .select("*", { count: "exact" })
      .order(sortCol || "created_at", { ascending: (sortDir || "desc") === "asc" })
      .range(range[0], range[1]);

    if (q) {
      query = query.or(
        `name.ilike.%${q}%,email.ilike.%${q}%,institution.ilike.%${q}%`
      );
    }

    const { data, error, count } = await query;
    if (error) return sbError(res, error);
    return res.json({ limit, offset: range[0], total: count ?? null, items: data || [] });
  } catch (err) {
    return sbError(res, err, 500);
  }
};

/** GET /camp-submissions/:id */
const getCampSubmission = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    if (error) return sbError(res, error, 404);
    return res.json(data);
  } catch (err) {
    return sbError(res, err, 500);
  }
};

/** POST /camp-submissions */
const createCampSubmission = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) return res.status(401).json({ error: "Unauthorized" });

    const payload = pickBody(req.body);
    const { data, error } = await supabase
      .from(TABLE)
      .insert([payload])
      .select()
      .single();

    if (error) return sbError(res, error);
    return res.status(201).json(data);
  } catch (err) {
    return sbError(res, err, 400);
  }
};

/** PATCH /camp-submissions/:id */
const updateCampSubmission = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const body = req.body || {};
    const patch = {};
    const keys = ["name", "dob", "email", "phone", "comments", "institution", "institutionType", "institution_type"];
    keys.forEach((k) => {
      if (body[k] !== undefined) {
        if (k === "institutionType") patch.institution_type = body[k];
        else patch[k] = body[k];
      }
    });
    if (patch.name !== undefined && !String(patch.name).trim()) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("id", id)
      .select()
      .single();

    if (error) return sbError(res, error);
    return res.json(data);
  } catch (err) {
    return sbError(res, err, 400);
  }
};

/** DELETE /camp-submissions/:id  (RLS: only creator can delete) */
const deleteCampSubmission = async (req, res) => {
  try {
    const supabase = supabaseForReq(req);
    if (!req.headers.authorization) return res.status(401).json({ error: "Unauthorized" });

    const { id } = req.params;
    const { data, error } = await supabase
      .from(TABLE)
      .delete()
      .eq("id", id)
      .select()
      .single();

    if (error) return sbError(res, error, 403);
    return res.json({ ok: true, deleted: data });
  } catch (err) {
    return sbError(res, err, 500);
  }
};

module.exports = {
  listCampSubmissions,
  getCampSubmission,
  createCampSubmission,
  updateCampSubmission,
  deleteCampSubmission,
};
