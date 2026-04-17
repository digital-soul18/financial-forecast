'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  ArrowLeftRight,
  BarChart2,
  TrendingUp,
  FlaskConical,
  Settings,
  Beaker,
  Calculator,
  Scale,
  Globe,
} from 'lucide-react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { href: '/charts', label: 'Charts', icon: BarChart2 },
  { href: '/forecast', label: 'Forecast', icon: TrendingUp },
  { href: '/voice-ai-calculator', label: 'AI Calculator', icon: Calculator },
  { href: '/cost-comparison', label: 'Cost Comparison', icon: Scale },
  { href: '/market-comparison', label: 'Market Comparison', icon: Globe },
  { href: '/reports/rd', label: 'R&D Report', icon: FlaskConical },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-gray-950 border-r border-gray-800 flex flex-col z-30">
      <div className="px-5 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Beaker className="w-5 h-5 text-violet-400" />
          <div>
            <p className="text-white font-bold text-sm leading-tight tracking-tight" style={{ fontFamily: 'var(--font-heading)' }}>Voice AI Solutions</p>
            <p className="text-gray-500 text-[11px] tracking-widest uppercase font-medium">Finance</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                active
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800',
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-gray-800">
        <p className="text-gray-600 text-xs">FY2026</p>
      </div>
    </aside>
  );
}
