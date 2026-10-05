import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { Navbar } from '../Navbar';

describe('Navbar Component Unit Tests', () => {
  const defaultProps = {
    activeTab: 'home' as const,
    setActiveTab: vi.fn(),
    autosaveStatus: 'saved' as const,
    lastSavedTime: '10:00 AM',
    syncStatus: 'synced' as const,
    currentUser: 'test_operator',
    onLogout: vi.fn(),
    draftsCount: 2,
  };

  it('renders brand identity, desktop navigation items, and mobile hamburger button', () => {
    const html = renderToString(<Navbar {...defaultProps} />);

    // Brand Identity
    expect(html).toContain('Sri Krishna Textile');
    expect(html).toContain('Billing Workspace');

    // Desktop nav items
    expect(html).toContain('Home');
    expect(html).toContain('Workspace');
    expect(html).toContain('Drafts');
    expect(html).toContain('History');
    expect(html).toContain('Parties');
    expect(html).toContain('Settings');

    // Draft count badge
    expect(html).toContain('2');

    // Operator username
    expect(html).toContain('test_operator');

    // Mobile Hamburger button with aria-label
    expect(html).toContain('aria-label="Open navigation menu"');
  });

  it('highlights the active tab properly', () => {
    const htmlHome = renderToString(<Navbar {...defaultProps} activeTab="home" />);
    expect(htmlHome).toContain('bg-indigo-600 text-white');

    const htmlWorkspace = renderToString(<Navbar {...defaultProps} activeTab="workspace" />);
    expect(htmlWorkspace).toContain('bg-indigo-600 text-white');
  });

  it('shows cloud sync status indicator', () => {
    const html = renderToString(<Navbar {...defaultProps} syncStatus="synced" />);
    expect(html).toContain('Cloud Synced');
  });
});
