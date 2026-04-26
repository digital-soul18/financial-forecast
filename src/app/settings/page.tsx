'use client';

import useSWR from 'swr';
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Users, Shield, UserCheck, UserX, ExternalLink, Send, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Rules ───────────────────────────────────────────────────────────────────

interface Rule {
  id: string;
  pattern: string;
  category: string;
  subcategory: string | null;
  learnedFrom: string | null;
  createdAt: string;
}

// ─── Users ───────────────────────────────────────────────────────────────────

interface AppUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  isActive: boolean;
  createdAt: string;
  contractorId: string | null;
  contractorName: string | null;
  dailyRate: number | null;
}

interface UsersData {
  currentUserId: string;
  users: AppUser[];
}

function initials(u: AppUser) {
  const src = u.name ?? u.email;
  return src.split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  // Rules
  const { data: rules, mutate: mutateRules } = useSWR<Rule[]>('/api/rules', fetcher);

  // Users
  const { data: usersData, mutate: mutateUsers } = useSWR<UsersData>('/api/users', fetcher);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [inviteStatus, setInviteStatus] = useState<Record<string, 'sent' | 'error'>>({});

  const currentUserId = usersData?.currentUserId ?? '';
  const users = usersData?.users ?? [];

  const admins = users.filter(u => u.role === 'admin');
  const contractors = users.filter(u => u.role === 'contractor');
  const activeCount = users.filter(u => u.isActive).length;

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function toggleActive(user: AppUser) {
    setPendingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error ?? 'Failed to update user');
      } else {
        mutateUsers();
      }
    } finally {
      setPendingId(null);
    }
  }

  async function resendInvite(user: AppUser) {
    if (!user.contractorId) return;
    setInvitingId(user.id);
    try {
      const res = await fetch(`/api/contractors/${user.contractorId}/invite`, { method: 'POST' });
      setInviteStatus(s => ({ ...s, [user.id]: res.ok ? 'sent' : 'error' }));
      setTimeout(() => setInviteStatus(s => { const n = { ...s }; delete n[user.id]; return n; }), 3000);
    } finally {
      setInvitingId(null);
    }
  }

  async function deleteRule(id: string) {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    mutateRules();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-xl font-semibold text-gray-100">Settings</h1>

      {/* ── User Management ─────────────────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">User Management</h2>
          <p className="text-xs text-gray-500 mt-0.5">All accounts that can access this platform</p>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Users',  value: users.length,       icon: Users,     color: 'text-violet-400' },
            { label: 'Active',       value: activeCount,         icon: UserCheck, color: 'text-emerald-400' },
            { label: 'Admins',       value: admins.length,       icon: Shield,    color: 'text-amber-400' },
            { label: 'Contractors',  value: contractors.length,  icon: Users,     color: 'text-blue-400' },
          ].map(({ label, value, icon: Icon, color }) => (
            <Card key={label} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className={cn('w-4 h-4 shrink-0', color)} />
                <div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={cn('text-lg font-bold tabular-nums', color)}>{value}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Users table */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400 pl-5">User</TableHead>
                  <TableHead className="text-gray-400">Role</TableHead>
                  <TableHead className="text-gray-400">Status</TableHead>
                  <TableHead className="text-gray-400">Joined</TableHead>
                  <TableHead className="text-gray-400">Rate</TableHead>
                  <TableHead className="text-gray-400 pr-5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-10">
                      Loading users…
                    </TableCell>
                  </TableRow>
                )}

                {users.map(user => {
                  const isSelf = user.id === currentUserId;
                  const isAdmin = user.role === 'admin';
                  const isPending = pendingId === user.id;
                  const isInviting = invitingId === user.id;
                  const invSt = inviteStatus[user.id];

                  return (
                    <TableRow key={user.id} className="border-gray-800 hover:bg-gray-800/40">
                      {/* Avatar + name + email */}
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 select-none',
                            isAdmin
                              ? 'bg-amber-900/60 text-amber-300'
                              : user.isActive
                                ? 'bg-violet-900/60 text-violet-300'
                                : 'bg-gray-800 text-gray-500',
                          )}>
                            {initials(user)}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm text-gray-200 font-medium truncate">
                              {user.name ?? <span className="text-gray-500 italic">No name</span>}
                              {isSelf && <span className="ml-1.5 text-xs text-gray-600">(you)</span>}
                            </p>
                            <p className="text-xs text-gray-500 truncate">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>

                      {/* Role badge */}
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          isAdmin
                            ? 'bg-amber-900/40 text-amber-300'
                            : 'bg-blue-900/40 text-blue-300',
                        )}>
                          {isAdmin ? <Shield className="w-2.5 h-2.5" /> : <Users className="w-2.5 h-2.5" />}
                          {isAdmin ? 'Admin' : 'Contractor'}
                        </span>
                      </TableCell>

                      {/* Status badge */}
                      <TableCell>
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          user.isActive
                            ? 'bg-emerald-900/40 text-emerald-300'
                            : 'bg-gray-800 text-gray-500',
                        )}>
                          {user.isActive ? <UserCheck className="w-2.5 h-2.5" /> : <UserX className="w-2.5 h-2.5" />}
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>

                      {/* Joined */}
                      <TableCell className="text-gray-400 text-sm tabular-nums">
                        {fmtDate(user.createdAt)}
                      </TableCell>

                      {/* Daily rate (contractors only) */}
                      <TableCell className="text-gray-400 text-sm tabular-nums">
                        {user.dailyRate != null
                          ? `$${user.dailyRate.toLocaleString()}/day`
                          : <span className="text-gray-700">—</span>}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="pr-5">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* View contractor detail */}
                          {user.contractorId && (
                            <Link href={`/contractors/${user.contractorId}`}>
                              <Button size="icon" variant="ghost"
                                className="w-7 h-7 text-gray-500 hover:text-violet-400"
                                title="View contractor profile">
                                <ExternalLink className="w-3.5 h-3.5" />
                              </Button>
                            </Link>
                          )}

                          {/* Resend invite (contractors only) */}
                          {user.contractorId && (
                            <Button size="icon" variant="ghost"
                              className={cn('w-7 h-7 transition-colors', invSt === 'sent'
                                ? 'text-emerald-400'
                                : invSt === 'error'
                                  ? 'text-red-400'
                                  : 'text-gray-500 hover:text-blue-400')}
                              title={invSt === 'sent' ? 'Invite sent!' : invSt === 'error' ? 'Send failed' : 'Resend invite email'}
                              disabled={isInviting}
                              onClick={() => resendInvite(user)}>
                              {isInviting
                                ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                                : <Send className="w-3.5 h-3.5" />}
                            </Button>
                          )}

                          {/* Deactivate / reactivate */}
                          <Button size="icon" variant="ghost"
                            className={cn('w-7 h-7 transition-colors',
                              isSelf ? 'opacity-20 cursor-not-allowed' :
                              user.isActive
                                ? 'text-gray-500 hover:text-red-400'
                                : 'text-gray-500 hover:text-emerald-400')}
                            title={isSelf ? 'Cannot deactivate your own account'
                              : user.isActive ? 'Deactivate account' : 'Reactivate account'}
                            disabled={isSelf || isPending}
                            onClick={() => !isSelf && toggleActive(user)}>
                            {isPending
                              ? <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                              : user.isActive
                                ? <UserX className="w-3.5 h-3.5" />
                                : <UserCheck className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      {/* ── Learned Categorisation Rules ────────────────────────────────────── */}
      <section className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-200">Categorisation Rules</h2>
          <p className="text-xs text-gray-500 mt-0.5">Rules created when you answered Claude&apos;s questions — auto-categorise matching transactions without asking again</p>
        </div>

        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-800 hover:bg-transparent">
                  <TableHead className="text-gray-400">Pattern</TableHead>
                  <TableHead className="text-gray-400">Category</TableHead>
                  <TableHead className="text-gray-400">Subcategory</TableHead>
                  <TableHead className="text-gray-400">Learned From</TableHead>
                  <TableHead className="text-gray-400 w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rules ?? []).map(r => (
                  <TableRow key={r.id} className="border-gray-800 hover:bg-gray-800/50">
                    <TableCell className="text-gray-200 text-sm font-mono">{r.pattern}</TableCell>
                    <TableCell className="text-gray-300 text-sm">{r.category}</TableCell>
                    <TableCell className="text-gray-400 text-sm">{r.subcategory ?? '—'}</TableCell>
                    <TableCell className="text-gray-500 text-sm truncate max-w-xs">{r.learnedFrom ?? '—'}</TableCell>
                    <TableCell>
                      <Button size="icon" variant="ghost"
                        className="w-7 h-7 text-gray-500 hover:text-red-400"
                        onClick={() => deleteRule(r.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(rules ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                      No rules yet. Upload transactions and answer Claude&apos;s questions to create rules.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </section>

      <div className="text-sm text-gray-500">
        <a href="/settings/rd-config" className="text-violet-400 hover:text-violet-300">Configure R&D % by subcategory →</a>
      </div>
    </div>
  );
}
