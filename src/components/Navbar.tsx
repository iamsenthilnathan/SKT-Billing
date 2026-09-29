import React from 'react';
import {
  FileText,
  Clock,
  Users,
  Settings as SettingsIcon,
  Cloud,
  CloudOff,
  RefreshCw,
  Layers,
} from 'lucide-react';
import type { SyncStatus } from '../services/syncService';

export type NavTab = 'workspace' | 'drafts' | 'invoices' | 'parties' | 'settings';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  autosaveStatus: 'saved' | 'saving' | 'idle';
  lastSavedTime?: string;
  syncStatus?: SyncStatus;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  autosaveStatus,
  lastSavedTime,
  syncStatus = 'synced',
}) => {
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
          </nav>
        </div>
      </div>
    </header>
  );
};
