import React from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/* ─── SVG Illustration (desktop left panel) ─── */
const ShoppingCartIllustration: React.FC = () => (
  <svg viewBox="0 0 220 180" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[220px]">
    <rect x="55" y="70" width="110" height="70" rx="12" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5"/>
    <path d="M30 40 L50 40 L68 100" stroke="rgba(255,255,255,0.5)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="80" cy="152" r="10" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
    <circle cx="140" cy="152" r="10" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" strokeWidth="2"/>
    <rect x="75" y="105" width="14" height="25" rx="3" fill="#6366f1"/>
    <rect x="97" y="92" width="14" height="38" rx="3" fill="#818cf8"/>
    <rect x="119" y="100" width="14" height="30" rx="3" fill="#6366f1"/>
    <rect x="141" y="83" width="14" height="47" rx="3" fill="#a5b4fc"/>
    <g transform="translate(18, 55) rotate(-15)">
      <rect width="34" height="38" rx="6" fill="#f59e0b" opacity="0.9"/>
      <path d="M10 12 Q17 4 24 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </g>
    <g transform="translate(160, 40) rotate(12)">
      <rect width="34" height="38" rx="6" fill="#3b82f6" opacity="0.85"/>
      <path d="M10 12 Q17 4 24 12" stroke="rgba(255,255,255,0.7)" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </g>
    <circle cx="50" cy="30" r="3" fill="#a5b4fc" opacity="0.7"/>
    <circle cx="170" cy="25" r="4" fill="#fbbf24" opacity="0.6"/>
    <circle cx="195" cy="90" r="2.5" fill="#34d399" opacity="0.7"/>
    <circle cx="25" cy="110" r="2" fill="#f472b6" opacity="0.6"/>
  </svg>
);

/* ─── Logo mark (shared) ─── */
const LogoMark: React.FC = () => (
  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500 shadow-lg shadow-indigo-900/40 shrink-0">
    <svg viewBox="0 0 32 32" fill="none" className="h-6 w-6">
      <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="2.5" fill="none" strokeDasharray="20 42"/>
      <path d="M16 6 A10 10 0 0 1 26 16" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none"/>
      <circle cx="16" cy="16" r="3.5" fill="white"/>
    </svg>
  </div>
);

/* ─── Desktop: left panel logo ─── */
const DesktopLogo: React.FC = () => (
  <div className="flex items-center gap-3">
    <LogoMark />
    <div>
      <div className="text-xl font-extrabold tracking-tight text-white leading-none">RetailPulse</div>
      <div className="text-xs font-medium text-indigo-300 tracking-wider mt-0.5">Analytics</div>
    </div>
  </div>
);

/* ─── Mobile: top banner logo ─── */
const MobileBanner: React.FC = () => (
  <div
    className="flex flex-col items-center justify-center gap-3 px-6 py-8"
    style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 55%, #1a1042 100%)' }}
  >
    <div className="flex items-center gap-3">
      <LogoMark />
      <div>
        <div className="text-xl font-extrabold tracking-tight text-white leading-none">RetailPulse</div>
        <div className="text-xs font-medium text-indigo-300 tracking-wider mt-0.5">Analytics</div>
      </div>
    </div>
    <p className="text-xs font-medium text-indigo-300 text-center max-w-[240px] leading-relaxed">
      Make smarter retail decisions with real-time analytics
    </p>
    {/* Decorative dots */}
    <div className="flex gap-1.5 mt-1">
      <span className="h-1 w-5 rounded-full bg-indigo-500"/>
      <span className="h-1 w-1 rounded-full bg-indigo-700"/>
      <span className="h-1 w-1 rounded-full bg-indigo-700"/>
    </div>
  </div>
);

export const AuthLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 font-sans flex flex-col md:items-center md:justify-center md:p-4">

      {/* ═══════════════════════════════════════════
          MOBILE LAYOUT  (< md)
          Top branded banner  +  form card below
      ═══════════════════════════════════════════ */}
      <div className="flex flex-col md:hidden min-h-screen">
        {/* Branded top banner */}
        <MobileBanner />

        {/* Form card — scrollable, fills remaining height */}
        <div className="flex-1 bg-white dark:bg-slate-900 px-5 py-8 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      {/* ═══════════════════════════════════════════
          DESKTOP LAYOUT  (≥ md)
          Side-by-side split panel card
      ═══════════════════════════════════════════ */}
      <div className="hidden md:flex w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl shadow-slate-900/20 dark:shadow-slate-950/60">

        {/* Left dark panel */}
        <div
          className="flex w-[42%] flex-col justify-between p-10"
          style={{ background: 'linear-gradient(145deg, #0f172a 0%, #1e1b4b 50%, #1a1042 100%)' }}
        >
          <DesktopLogo />

          <div className="flex flex-col items-center gap-6 my-4">
            <ShoppingCartIllustration />
            <p className="text-sm font-medium text-indigo-200 leading-relaxed max-w-[200px] mx-auto text-center">
              Make smarter retail decisions with real-time analytics
            </p>
          </div>

          <div className="flex gap-1.5 justify-center">
            <span className="h-1.5 w-6 rounded-full bg-indigo-500"/>
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-800"/>
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-800"/>
          </div>
        </div>

        {/* Right white form panel */}
        <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col justify-center px-10 py-10 overflow-y-auto max-h-[90vh]">
          <Outlet />
        </div>

      </div>
    </div>
  );
};
export default AuthLayout;
