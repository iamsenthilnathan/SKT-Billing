import React, { useState, useRef, useEffect } from 'react';
import {
  FileText,
  Clock,
  Users,
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  Layers,
  LogOut,
  ChevronDown,
} from 'lucide-react';
import type { SyncStatus } from '../services/syncService';

export type NavTab = 'workspace' | 'drafts' | 'invoices' | 'parties' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  autosaveStatus: 'saved' | 'saving' | 'idle';
  lastSavedTime?: string;
  syncStatus?: SyncStatus;
  currentUser?: string | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  autosaveStatus,
  lastSavedTime,
  syncStatus = 'synced',
  currentUser,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on click outside or escape key
  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  const initial = (currentUser ? currentUser.trim().charAt(0) : 'S').toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-2.5 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-1 sm:gap-4">
          {/* Brand & Identity (Simplified: No SK logo, no Dyeing Process pill) */}
          <div
            className="flex flex-col justify-center cursor-pointer shrink min-w-0"
            onClick={() => setActiveTab('workspace')}
          >
            <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base md:text-lg truncate">
              Sri Krishna Textile
            </span>
            <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block truncate">
              Billing Workspace & Challan Reconciler
            </p>
          </div>

          {/* Sync & Autosave Telemetry Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200 text-xs text-slate-600 shrink-0">
            {syncStatus === 'offline' ? (
              <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                <CloudOff className="w-3.5 h-3.5 text-amber-600" />
                <span>Offline (Local Cache)</span>
              </span>
            ) : syncStatus === 'syncing' || autosaveStatus === 'saving' ? (
              <span className="flex items-center gap-1.5 text-indigo-700 font-medium">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Synchronizing...</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-800 font-medium">
                <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Synced {lastSavedTime ? `at ${lastSavedTime}` : ''}</span>
              </span>
            )}
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1 shrink-0">
            {/* Mobile Sync Indicator Dot */}
            <div
              className="lg:hidden p-1.5 rounded-lg flex items-center justify-center text-slate-500"
              title={syncStatus === 'offline' ? 'Offline' : syncStatus === 'syncing' ? 'Syncing...' : 'Synced'}
            >
              {syncStatus === 'offline' ? (
                <CloudOff className="w-4 h-4 text-amber-500" />
              ) : syncStatus === 'syncing' ? (
                <RefreshCw className="w-4 h-4 text-indigo-500 animate-spin" />
              ) : (
                <Cloud className="w-4 h-4 text-emerald-500" />
              )}
            </div>

            {/* 1. Workspace Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('workspace')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'workspace'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Billing Workspace"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Workspace</span>
            </button>

            {/* 2. Drafts Tab (Dedicated Top-Level Route) */}
            <button
              type="button"
              onClick={() => setActiveTab('drafts')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'drafts'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Draft Bills"
            >
              <Layers className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Drafts</span>
            </button>

            {/* 3. History Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('invoices')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'invoices'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Invoice History"
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">History</span>
            </button>

            {/* 4. Parties Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('parties')}
              className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'parties'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Customer Directory"
            >
              <Users className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">Parties</span>
            </button>

            {/* 5. Settings Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center ${
                activeTab === 'settings'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
              title="Settings & Synchronize"
            >
              <SettingsIcon className="w-4 h-4 shrink-0" />
            </button>

            {/* 6. Authenticated Operator Identity & Dropdown Menu */}
            {onLogout && (
              <div className="relative ml-1 pl-1 sm:ml-2 sm:pl-2 border-l border-slate-200" ref={menuRef}>
                {/* Unified Operator Control */}
                <button
                  type="button"
                  onClick={() => setIsMenuOpen((prev) => !prev)}
                  aria-expanded={isMenuOpen}
                  aria-haspopup="true"
                  aria-label={currentUser ? `Operator account: ${currentUser}` : 'Operator account'}
                  className={`flex items-center gap-1.5 p-1 sm:px-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${
                    isMenuOpen
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {/* Avatar Circle */}
                  <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 select-none shadow-2xs">
                    {initial}
                  </span>

                  {/* Username (hidden on narrow mobile < 640px to prevent overflow, visible on tablet/desktop) */}
                  <span className="hidden sm:inline-block max-w-[100px] md:max-w-[130px] truncate font-medium text-xs sm:text-sm text-slate-700">
                    {currentUser || 'Operator'}
                  </span>

                  {/* Subtle Chevron */}
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
                      isMenuOpen ? 'rotate-180 text-slate-600' : ''
                    }`}
                  />
                </button>

                {/* Operator Dropdown Card */}
                {isMenuOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute right-0 mt-1.5 w-52 sm:w-56 bg-white rounded-xl shadow-lg shadow-slate-200/70 border border-slate-200/90 py-1.5 z-50 text-slate-800 animate-in fade-in duration-100"
                  >
                    {/* Operator Header Card */}
                    <div className="px-3.5 py-2.5 border-b border-slate-100 flex items-center gap-2.5">
                      <span className="w-8 h-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 select-none">
                        {initial}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate leading-snug">
                          {currentUser || 'Operator'}
                        </p>
                        <p className="text-[11px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                          <span>Active session</span>
                        </p>
                      </div>
                    </div>

                    {/* Actions Section */}
                    <div className="p-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsMenuOpen(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs sm:text-sm font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2.5 cursor-pointer"
                      >
                        <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
};
