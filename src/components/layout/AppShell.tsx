'use client';

import { usePathname } from 'next/navigation';
import { Sidebar } from './Sidebar';

// Routes that should NOT show the main admin sidebar
const NO_SIDEBAR_PREFIXES = ['/login', '/contractor'];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const showSidebar = !NO_SIDEBAR_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/'));

  if (!showSidebar) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 min-h-screen">{children}</main>
    </>
  );
}
