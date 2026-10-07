import React, { useState, useRef, useEffect } from 'react';
import {
  Home as HomeIcon,
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
  Menu,
  X,
} from 'lucide-react';
import type { SyncStatus } from '../services/syncService';

export type NavTab = 'home' | 'workspace' | 'drafts' | 'invoices' | 'parties' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  autosaveStatus: 'saved' | 'saving' | 'idle';
  lastSavedTime?: string;
  syncStatus?: SyncStatus;
  currentUser?: string | null;
  onLogout?: () => void;
  draftsCount?: number;
}

interface NavItemConfig {
  id: NavTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  badge?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  autosaveStatus,
  lastSavedTime,
  syncStatus = 'synced',
  currentUser,
  onLogout,
  draftsCount,
}) => {
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const profileMenuRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  // Unified Navigation Items Specification
  const navItems: NavItemConfig[] = [
    { id: 'home', label: 'Home', icon: HomeIcon, title: 'Business Overview' },
    { id: 'workspace', label: 'Workspace', icon: FileText, title: 'Billing Workspace' },
    { id: 'drafts', label: 'Drafts', icon: Layers, title: 'Draft Bills', badge: draftsCount },
    { id: 'invoices', label: 'History', icon: Clock, title: 'Invoice History' },
    { id: 'parties', label: 'Parties', icon: Users, title: 'Customer Directory' },
    { id: 'settings', label: 'Settings', icon: SettingsIcon, title: 'Settings & Synchronize' },
  ];

  // Close menus on outside click, escape key, or resize across breakpoint
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (isProfileMenuOpen && profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileMenuOpen(false);
      }
      if (
        isMobileMenuOpen &&
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(target) &&
        mobileToggleRef.current &&
        !mobileToggleRef.current.contains(target)
      ) {
        setIsMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProfileMenuOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [isProfileMenuOpen, isMobileMenuOpen]);

  const initial = (currentUser ? currentUser.trim().charAt(0) : 'S').toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
          {/* Brand & Identity */}
          <div
            className="flex flex-col justify-center cursor-pointer shrink min-w-0"
            onClick={() => {
              setActiveTab('home');
              setIsMobileMenuOpen(false);
            }}
          >
            <span className="font-extrabold text-slate-900 tracking-tight text-sm sm:text-base md:text-lg truncate">
              Sri Krishna Textile
            </span>
            <p className="text-[10px] sm:text-xs text-slate-500 hidden sm:block truncate">
              Billing Workspace & Challan Reconciler
            </p>
          </div>

          {/* Sync & Autosave Telemetry Badge (Desktop only) */}
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

          {/* DESKTOP NAVIGATION CONTROLS (Horizontal navbar, hidden on mobile < md) */}
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              const isSettings = item.id === 'settings';

              if (isSettings) {
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`p-1.5 sm:p-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center justify-center ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                    }`}
                    title={item.title}
                  >
                    <IconComponent className="w-4 h-4 shrink-0" />
                  </button>
                );
              }

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={item.title}
                >
                  <IconComponent className="w-4 h-4 shrink-0" />
                  <span className={item.id === 'parties' ? 'hidden lg:inline' : 'hidden sm:inline'}>
                    {item.label}
                  </span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}

            {/* Desktop Authenticated Operator Identity & Dropdown Menu */}
            {onLogout && (
              <div className="relative ml-1 pl-1 sm:ml-2 sm:pl-2 border-l border-slate-200" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                  aria-label={currentUser ? `Operator account: ${currentUser}` : 'Operator account'}
                  className={`flex items-center gap-1.5 p-1 sm:px-2 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer ${
                    isProfileMenuOpen
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 select-none shadow-2xs">
                    {initial}
                  </span>
                  <span className="hidden sm:inline-block max-w-[100px] md:max-w-[130px] truncate font-medium text-xs sm:text-sm text-slate-700">
                    {currentUser || 'Operator'}
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-150 shrink-0 ${
                      isProfileMenuOpen ? 'rotate-180 text-slate-600' : ''
                    }`}
                  />
                </button>

                {isProfileMenuOpen && (
                  <div
                    role="menu"
                    aria-orientation="vertical"
                    className="absolute right-0 mt-1.5 w-52 sm:w-56 bg-white rounded-xl shadow-lg shadow-slate-200/70 border border-slate-200/90 py-1.5 z-50 text-slate-800 animate-in fade-in duration-100"
                  >
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

                    <div className="p-1">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsProfileMenuOpen(false);
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

          {/* MOBILE RIGHT CONTROLS: Sync Dot + Hamburger Toggle (Mobile only < md) */}
          <div className="md:hidden flex items-center gap-1.5 shrink-0">
            {/* Mobile Sync Indicator Dot */}
            <div
              className="p-1.5 rounded-lg flex items-center justify-center text-slate-500"
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

            {/* Hamburger Button */}
            <button
              ref={mobileToggleRef}
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-expanded={isMobileMenuOpen}
              aria-label={isMobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="p-2 rounded-xl text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
            >
              {isMobileMenuOpen ? (
                <X className="w-5 h-5 text-slate-700" />
              ) : (
                <Menu className="w-5 h-5 text-slate-700" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* MOBILE HAMBURGER MENU DRAWER (Mobile only < md) */}
      {isMobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="md:hidden border-t border-slate-200 bg-white/98 backdrop-blur-md px-3 pt-2.5 pb-3.5 shadow-lg animate-in slide-in-from-top-1 duration-150"
        >
          {/* Navigation Items (Home, Workspace, Drafts, History, Parties, Settings) */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const IconComponent = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                  title={item.title}
                >
                  <div className="flex items-center gap-3">
                    <IconComponent
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-white' : 'text-slate-500'
                      }`}
                    />
                    <span>{item.label}</span>
                  </div>

                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Secondary Section: Operator Info & Sign Out */}
          <div className="pt-2.5 mt-2 border-t border-slate-100 space-y-1">
            <div className="px-3.5 py-2 flex items-center gap-2.5 text-slate-700">
              <span className="w-7 h-7 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs flex items-center justify-center shrink-0 select-none shadow-2xs">
                {initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {currentUser || 'Operator'}
                </p>
                <p className="text-[10px] font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
                  <span>Active session</span>
                </p>
              </div>
            </div>

            {onLogout && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLogout();
                }}
                className="w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 hover:text-rose-600 hover:bg-rose-50 transition-colors flex items-center gap-2.5 cursor-pointer"
              >
                <LogOut className="w-4 h-4 shrink-0 text-slate-400" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
