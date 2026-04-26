'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Menu, Beaker } from 'lucide-react';

// Routes that should NOT show the main admin sidebar
const NO_SIDEBAR_PREFIXES = ['/login', '/contractor'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Mobile top bar — only visible below md breakpoint */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 z-40 md:hidden">
        <button
          onClick={() => setSidebarOpen(true)}
          className="text-gray-400 hover:text-white p-1.5 rounded-md transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 ml-3">
          <Beaker className="w-4 h-4 text-violet-400" />
          <span className="text-white font-bold text-sm tracking-tight">Voice AI Solutions</span>
        </div>
      </header>

      {/* Backdrop overlay for mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main content — push right on desktop, add top padding on mobile for the fixed header */}
      <main className="md:ml-56 min-h-screen pt-14 md:pt-0">
        {children}
      </main>
    </>
  );
}
