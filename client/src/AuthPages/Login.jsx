import { useState, useEffect } from 'react';
import { supabase } from '../CreateClient';
import { motion } from 'framer-motion';
import { FaUser, FaLock, FaArrowRight } from 'react-icons/fa';
import { Link, useNavigate } from 'react-router-dom';
import CreatableSelect from 'react-select/creatable';
import 'aos/dist/aos.css';
import GDC from "../assets/gdc1.png";

const isEmail = (v = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
const API_BASE =
  (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) ||
  (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) ||
  '';

const USERNAMES = [
  "Natarajan@gdc.com","Kaviyaa@gdc.com","Swetha@gdc.com","Mythili@gdc.com","Premkumar@gdc.com","Vignesh@gdc.com",
  "Srinath@gdc.com","Venkatesh@gdc.com","Kesavaraj@gdc.com","Yokesh@gdc.com",
];
const USER_OPTIONS = USERNAMES.map(n => ({ value: n, label: n }));

const selectStyles = {
  control: (base, state) => ({
    ...base,
    borderColor: state.isFocused ? '#14b8a6' : '#d1d5db',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(20,184,166,0.2)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#14b8a6' : '#9ca3af' },
    minHeight: 48,
    paddingLeft: 36,
    borderRadius: 8,
  }),
  valueContainer: (base) => ({ ...base, padding: '0 8px' }),
  input: (base) => ({ ...base, margin: 0, padding: 0 }),
  placeholder: (base) => ({ ...base, color: '#9ca3af' }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? '#ecfeff' : 'white',
    color: '#111827',
  }),
  menu: (base) => ({ ...base, zIndex: 50 }),
};

// 🔐 Safe JSON reader: never throws if the body is empty or not JSON
async function readJsonSafe(res) {
  const text = await res.text().catch(() => '');
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const Login = () => {
  const [form, setForm] = useState({ identifier: '', password: '' });
  const [msg, setMsg] = useState({ text: '', type: '' });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) navigate('/doctor/appointments');
    })();
  }, [navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMsg({ text: '', type: '' });

    const identifier = form.identifier.trim();
    const password = form.password.trim();

    if (!identifier || !password) {
      setMsg({ text: 'Please enter username/email and password.', type: 'error' });
      setIsLoading(false);
      return;
    }

    try {
      if (isEmail(identifier)) {
        // Email path uses Supabase directly
        const { error } = await supabase.auth.signInWithPassword({
          email: identifier.toLowerCase(),
          password
        });
        if (error) throw error;
      } else {
        // Username path hits your backend and parses response safely
        const res = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify({ username: identifier, password })
        });

        const payload = await readJsonSafe(res); // ← safe parse (no JSON error)
        if (!res.ok) {
          const errMsg =
            payload.msg ||
            payload.error ||
            payload.message ||
            payload.raw ||
            `Login failed (HTTP ${res.status})`;
          throw new Error(errMsg);
        }

        const { token, refresh_token } = payload;
        if (!token || !refresh_token) {
          console.error('Login response payload:', payload);
          throw new Error('Invalid auth response from server.');
        }

        const { error: setErr } = await supabase.auth.setSession({
          access_token: token,
          refresh_token
        });
        if (setErr) throw setErr;
      }

      navigate('/doctor/appointments');
    } catch (error) {
      setMsg({ text: error.message || 'Login failed. Please try again.', type: 'error' });
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1, delayChildren: 0.2 } },
  };
  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } },
  };

  return (
   <motion.div
  initial="hidden"
  animate="visible"
  variants={containerVariants}
  className="min-h-screen bg-gray-900 flex flex-col items-center justify-center"
>
  {/* Logo at the top, no top margin */}
  <img
    src={GDC}
    alt="Logo"
    className="w-64 sm:w-80 md:w-96 lg:w-[28rem] h-auto"
  />
  <motion.form
    onSubmit={onSubmit}
    variants={itemVariants}
    data-aos="fade-up"
    className="bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-gray-100"
  >
    <div className="flex flex-col items-center mb-6">
     
      <h2 className="text-2xl font-bold text-gray-100">Welcome Back</h2>
      <p className="text-gray-400 mt-1">Sign in to your dental account</p>
    </div>

    <div className="space-y-4">
     <motion.div variants={itemVariants}>
  <label htmlFor="identifier" className="block text-gray-300 mb-2">
    Username or Email
  </label>
  <div className="relative">
    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-100">
      <FaUser className="text-gray-100" />
    </div>
    <CreatableSelect
      inputId="identifier"
      classNamePrefix="rs"
      styles={{
        ...selectStyles,
        control: (base, state) => ({
          ...base,
          backgroundColor: '#2d2d2d',
          borderColor: state.isFocused ? '#14b8a6' : '#4b5563',
          color: '#f9fafb',
        }),
        singleValue: (base) => ({
          ...base,
          color: '#ffffff', // ✅ selected username text color = white
        }),
        option: (base, state) => ({
          ...base,
          backgroundColor: state.isFocused ? '#374151' : '#2d2d2d',
          color: '#f9fafb',
        }),
        placeholder: (base) => ({ ...base, color: '#9ca3af' }), // dim placeholder
      }}
      isClearable
      isSearchable
      options={USER_OPTIONS}
      placeholder="Select a username or type email"
      value={form.identifier ? { value: form.identifier, label: form.identifier } : null}
      onChange={(opt) => setForm({ ...form, identifier: opt?.value || '' })}
      onInputChange={(inputVal, action) => {
        if (action.action === 'input-change') {
          setForm((f) => ({ ...f, identifier: inputVal }));
        }
      }}
      menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
    />
  </div>
</motion.div>


      <motion.div variants={itemVariants}>
        <label className="block text-gray-300 mb-2">Password</label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaLock className="text-gray-400" />
          </div>
          <input
            placeholder="Enter your password"
            type="password"
            required
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            className="w-full pl-10 p-3 border border-gray-600 rounded-lg bg-gray-700 text-gray-100 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none transition"
            autoComplete="current-password"
          />
        </div>
      </motion.div>
    </div>

    <motion.button
      variants={itemVariants}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      type="submit"
      disabled={isLoading}
      className={`w-full mt-6 py-3 rounded-lg font-semibold text-white transition-colors shadow-md flex items-center justify-center ${
        isLoading ? 'bg-yellow-500' : 'bg-yellow-600 hover:bg-yellow-700'
      }`}
    >
      {isLoading ? (
        <span className="flex items-center">
          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Signing In...
        </span>
      ) : (
        <span className="flex items-center">
          Sign In <FaArrowRight className="ml-2" />
        </span>
      )}
    </motion.button>

    <motion.div variants={itemVariants} className="mt-4 text-center">
      <Link to="/forgot-password" className="text-grey-400 hover:text-yellow-300 text-sm font-medium">
        Forgot your password?
      </Link>
    </motion.div>

    {msg.text && (
      <motion.div
        variants={itemVariants}
        className={`mt-4 p-3 rounded-lg text-center ${
          msg.type === 'error' ? 'bg-red-700 text-red-100' : 'bg-teal-700 text-teal-100'
        }`}
      >
        {msg.text}
      </motion.div>
    )}
  </motion.form>
</motion.div>

  );
};

export default Login;
