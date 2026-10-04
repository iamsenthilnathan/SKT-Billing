import React, { useState } from 'react';
import { Lock, User, Eye, EyeOff, Loader2, AlertCircle, Layers } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: { username: string }) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage('Please enter both username and password.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: trimmedUser,
          password: password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid credentials. Please try again.');
        setIsLoading(false);
        return;
      }

      if (data.success && data.user) {
        onLoginSuccess(data.user);
      } else {
        setErrorMessage('Unexpected response from server.');
        setIsLoading(false);
      }
    } catch {
      setErrorMessage('Unable to reach billing server. Please check your network connection.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-3 sm:p-5 lg:p-4 font-sans selection:bg-indigo-500 selection:text-white">
      {/* Outer Split-Screen Card */}
      <div className="w-full max-w-6xl bg-white rounded-3xl shadow-xl shadow-slate-200/70 border border-slate-200/80 p-3.5 sm:p-4 lg:p-5 flex flex-col lg:flex-row gap-6 lg:gap-8">
        {/* ============================================================== */}
        {/* LEFT / BRAND & TACTILE TEXTILE VISUAL SIDE (Desktop Panel)     */}
        {/* ============================================================== */}
        <div className="hidden lg:flex lg:w-5/12 bg-[#070b14] text-white rounded-2xl lg:rounded-3xl p-6 lg:p-8 flex-col justify-between relative overflow-hidden select-none border border-slate-900/80 shadow-inner">
          {/* Subtle Physical Woven Fabric Texture (Warp & Weft Twill) */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="wovenFabricPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                  {/* Warp threads */}
                  <line x1="3" y1="0" x2="3" y2="12" stroke="#6366f1" strokeWidth="0.75" strokeOpacity="0.4" />
                  <line x1="9" y1="0" x2="9" y2="12" stroke="#6366f1" strokeWidth="0.75" strokeOpacity="0.4" />
                  {/* Weft threads */}
                  <line x1="0" y1="3" x2="12" y2="3" stroke="#818cf8" strokeWidth="0.75" strokeOpacity="0.4" />
                  <line x1="0" y1="9" x2="12" y2="9" stroke="#818cf8" strokeWidth="0.75" strokeOpacity="0.4" />
                  {/* Diagonal twill binding */}
                  <rect x="2" y="2" width="2" height="2" fill="#93c5fd" fillOpacity="0.2" />
                  <rect x="8" y="8" width="2" height="2" fill="#93c5fd" fillOpacity="0.2" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#wovenFabricPattern)" />
            </svg>
          </div>

          {/* Draped Dyed Textile & Layered Cloth Folds (Indigo Vat Palette) */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              className="w-full h-full"
              viewBox="0 0 420 620"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                {/* Textile Dye Gradients */}
                <linearGradient id="clothFoldLayer1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#080e1c" />
                  <stop offset="50%" stopColor="#0f172a" />
                  <stop offset="100%" stopColor="#1e3a8a" />
                </linearGradient>

                <linearGradient id="clothFoldLayer2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#111c38" />
                  <stop offset="55%" stopColor="#1e3a8a" />
                  <stop offset="100%" stopColor="#312e81" />
                </linearGradient>

                <linearGradient id="clothFoldLayer3" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e293b" />
                  <stop offset="40%" stopColor="#1d4ed8" />
                  <stop offset="80%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#1e40af" />
                </linearGradient>

                <linearGradient id="clothFoldLayer4" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1e3a8a" />
                  <stop offset="45%" stopColor="#3b82f6" />
                  <stop offset="85%" stopColor="#60a5fa" />
                  <stop offset="100%" stopColor="#93c5fd" />
                </linearGradient>

                {/* Tactile Yarn Fiber Grain Pattern */}
                <pattern id="fiberGrain" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(20)">
                  <line x1="0" y1="2" x2="8" y2="2" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />
                  <line x1="0" y1="6" x2="8" y2="6" stroke="#ffffff" strokeWidth="0.5" strokeOpacity="0.04" />
                </pattern>

                {/* Drop shadow underneath cloth fold creases */}
                <linearGradient id="creaseShadow" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#000000" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#000000" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Layer 1: Deep Back Cloth Drape */}
              <path
                d="M-40 190 C110 215 270 240 460 265 V640 H-40 Z"
                fill="url(#clothFoldLayer1)"
              />
              <path
                d="M-40 190 C110 215 270 240 460 265"
                stroke="#38bdf8"
                strokeWidth="1"
                strokeOpacity="0.3"
                fill="none"
              />

              {/* Layer 2: Mid Draped Fabric Fold */}
              <path
                d="M-40 270 C100 295 260 325 460 350 V640 H-40 Z"
                fill="url(#clothFoldLayer2)"
              />
              {/* Crease shadow under fold 1 */}
              <path
                d="M-40 190 C110 215 270 240 460 265 L460 280 C270 255 110 230 -40 205 Z"
                fill="url(#creaseShadow)"
              />
              <path
                d="M-40 270 C100 295 260 325 460 350"
                stroke="#818cf8"
                strokeWidth="1.2"
                strokeOpacity="0.4"
                fill="none"
              />

              {/* Layer 3: Prominent Dyed Cloth Fold */}
              <path
                d="M-40 355 C110 385 270 415 460 440 V640 H-40 Z"
                fill="url(#clothFoldLayer3)"
                opacity="0.95"
              />
              {/* Crease shadow under fold 2 */}
              <path
                d="M-40 270 C100 295 260 325 460 350 L460 365 C260 340 100 310 -40 285 Z"
                fill="url(#creaseShadow)"
              />
              <path
                d="M-40 355 C110 385 270 415 460 440"
                stroke="#93c5fd"
                strokeWidth="1.5"
                strokeOpacity="0.6"
                fill="none"
              />

              {/* Layer 4: Foreground Folded Cloth Swath with Soft Hem */}
              <path
                d="M-40 445 C100 480 260 505 460 530 V640 H-40 Z"
                fill="url(#clothFoldLayer4)"
                opacity="0.85"
              />
              {/* Crease shadow under fold 3 */}
              <path
                d="M-40 355 C110 385 270 415 460 440 L460 458 C270 433 110 403 -40 373 Z"
                fill="url(#creaseShadow)"
              />
              <path
                d="M-40 445 C100 480 260 505 460 530"
                stroke="#dbeafe"
                strokeWidth="1.8"
                strokeOpacity="0.75"
                fill="none"
              />

              {/* Layer 5: Bottom Fold Ground */}
              <path
                d="M-40 535 C120 565 280 588 460 608 V640 H-40 Z"
                fill="#070b14"
                opacity="0.95"
              />
              <path
                d="M-40 535 C120 565 280 588 460 608"
                stroke="#60a5fa"
                strokeWidth="1"
                strokeOpacity="0.35"
                fill="none"
              />

              {/* Vertical Loom Warp Yarn Fibers (Subtle Textile Grain) */}
              <g stroke="#ffffff" strokeWidth="0.75" strokeOpacity="0.04" strokeDasharray="8 4">
                <line x1="50" y1="160" x2="50" y2="620" />
                <line x1="100" y1="180" x2="100" y2="620" />
                <line x1="150" y1="190" x2="150" y2="620" />
                <line x1="200" y1="210" x2="200" y2="620" />
                <line x1="250" y1="230" x2="250" y2="620" />
                <line x1="300" y1="240" x2="300" y2="620" />
                <line x1="350" y1="250" x2="350" y2="620" />
              </g>

              {/* Overlay Fabric Yarn Grain */}
              <rect width="100%" height="100%" fill="url(#fiberGrain)" />
            </svg>
          </div>

          {/* Top Brand Block: Clean, Quiet, Dominant */}
          <div className="relative z-10 space-y-2">
            <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white leading-tight">
              Sri Krishna Textile
            </h1>
            <p className="text-sm font-medium text-slate-300">
              Billing Workspace & Challan Reconciler
            </p>
          </div>

          {/* Ample Breathing Room */}
          <div className="relative z-10" />
        </div>

        {/* ============================================================== */}
        {/* RIGHT / LOGIN FORM SIDE                                        */}
        {/* ============================================================== */}
        <div className="w-full lg:w-7/12 flex flex-col justify-center px-4 sm:px-8 lg:px-10 py-5 sm:py-7">
          <div className="max-w-md w-full mx-auto space-y-6">
            {/* Mobile Header (Only visible on small screens < lg) */}
            <div className="lg:hidden flex items-center gap-3 pb-5 border-b border-slate-100">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Sri Krishna Textile</h2>
                <p className="text-xs text-slate-500">Billing Workspace & Challan Reconciler</p>
              </div>
            </div>

            {/* Desktop Brand Mark */}
            <div className="hidden lg:block">
              <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                <Layers className="w-5 h-5" />
              </div>
            </div>

            {/* Title & Subtitle with Clean Divider */}
            <div className="space-y-1.5 border-b border-slate-100 pb-3 mb-3">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                Welcome back
              </h2>
              <p className="text-sm text-slate-500 leading-normal">
                Sign in to continue to your billing workspace.
              </p>
            </div>

            {/* Dedicated Error Slot (Reserved space to ensure 100% stable layout between normal and error states) */}
            <div className="min-h-[50px] flex items-center mb-3">
              {errorMessage && (
                <div
                  role="alert"
                  className="w-full p-3.5 rounded-xl bg-red-50 border border-red-200/80 text-red-700 text-xs sm:text-sm font-medium flex items-start gap-2.5 animate-in fade-in duration-200"
                >
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              {/* Username Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-slate-700"
                >
                  Username
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    id="username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck="false"
                    required
                    disabled={isLoading}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 focus:border-indigo-600 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-slate-700"
                >
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full pl-10 pr-11 py-3 bg-white border border-slate-300 focus:border-indigo-600 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors focus:outline-none cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3.5 px-4 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-semibold text-sm rounded-xl shadow-sm hover:shadow transition-all focus:outline-none focus:ring-4 focus:ring-indigo-500/20 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
