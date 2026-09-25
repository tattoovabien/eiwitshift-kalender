// Dashboard → Toegang (live version, coordinators only): approve new people, manage the
// list of addresses/domains that get access automatically, and manage coordinators.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Plus, RefreshCw, Trash, UserX } from 'lucide-react';
import type { Profile } from '../types';
import { useStore } from '../store';
import { fmtRelative } from '../lib/dates';
import {
  addAccessRule,
  fetchAccessData,
  removeAccessRule,
  updateProfileAsCoordinator,
  type AccessRule,
} from '../data/live';
import { SectionTitle, Switch, useToast } from './ui';

// Domains shared by many unrelated people: never grant access to a whole domain like this.
const PUBLIC_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.be', 'outlook.com', 'outlook.be', 'live.com', 'live.be',
  'yahoo.com', 'icloud.com', 'me.com', 'telenet.be', 'skynet.be', 'proximus.be', 'scarlet.be', 'protonmail.com', 'proton.me',
]);

const domainOf = (email: string) => email.split('@')[1]?.toLowerCase() ?? '';

export function AccessManager() {
  const { state, live } = useStore();
  const toast = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [rules, setRules] = useState<AccessRule[]>([]);
  const [orgs, setOrgs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await fetchAccessData();
      setProfiles(d.profiles);
      setRules(d.rules);
      setOrgs(d.organisations);
    } catch (e) {
      toast(`Laden mislukt: ${(e as Error).message}`, 'warning');
    }
    setLoading(false);
  }, [toast]);

  // Reload when a new access request comes in.
  const requestCount = state.notifications.filter((n) => n.kind === 'access_request').length;
  useEffect(() => {
    load();
  }, [load, requestCount]);

  const run = async (fn: () => Promise<void>, done: string) => {
    try {
      await fn();
      toast(done);
    } catch (e) {
      toast((e as Error).message, 'warning');
    }
    await load();
  };

  const pending = profiles.filter((p) => p.status === 'pending');
  const others = profiles.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-8">
      <datalist id="org-list">
        {orgs.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-3xl text-gray-700">
          Wie mag inloggen? Mensen op de toegangslijst komen meteen binnen. Anderen vragen toegang aan en verschijnen hieronder.
        </p>
        <button type="button" className="btn-secondary" onClick={load}>
          <RefreshCw className="size-4" aria-hidden="true" /> Vernieuwen
        </button>
      </div>

      <section>
        <SectionTitle>
          Aanvragen <span className="font-normal text-gray-600">({pending.length})</span>
        </SectionTitle>
        {loading ? (
          <p className="text-gray-600">Laden…</p>
        ) : pending.length === 0 ? (
          <p className="card p-4 text-gray-600">Geen openstaande aanvragen.</p>
        ) : (
          <ul className="grid gap-3">
            {pending.map((p) => (
              <PendingRow
                key={p.userId}
                p={p}
                onApprove={(org, wholeDomain) =>
                  run(async () => {
                    await updateProfileAsCoordinator(p.userId, { status: 'active', org });
                    if (wholeDomain) await addAccessRule({ pattern: `@${domainOf(p.email)}`, org, isCoordinator: false });
                  }, `${p.email} heeft nu toegang als ${org}`)
                }
                onReject={() => run(() => updateProfileAsCoordinator(p.userId, { status: 'blocked' }), 'Aanvraag geweigerd')}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>Toegangslijst</SectionTitle>
        <p className="mb-3 text-sm text-gray-700">
          Zet hier vooraf de e-mailadressen van Enya en Kristof, als coördinator van Departement Omgeving. Voor een partner kan je
          ook een heel domein toevoegen (bv. <code className="rounded bg-gray-100 px-1">@proveg.com</code>).
        </p>
        <RuleForm onAdd={(rule) => run(() => addAccessRule(rule), `${rule.pattern} toegevoegd aan de toegangslijst`)} />
        {rules.length > 0 && (
          <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200">
            {rules.map((r) => (
              <li key={r.pattern} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span className="text-sm">
                  <strong className="break-all text-gray-900">{r.pattern}</strong>
                  <span className="text-gray-600">
                    {' '}
                    → {r.org}
                    {r.isCoordinator && ' · coördinator'}
                  </span>
                </span>
                <button
                  type="button"
                  className="icon-btn text-red-700 hover:bg-red-50"
                  aria-label={`Verwijder ${r.pattern} van de toegangslijst`}
                  onClick={() => run(() => removeAccessRule(r.pattern), `${r.pattern} verwijderd`)}
                >
                  <Trash className="size-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <SectionTitle>
          Gebruikers <span className="font-normal text-gray-600">({others.length})</span>
        </SectionTitle>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {others.map((p) => {
            const me = p.userId === live?.profile?.userId;
            return (
              <li key={p.userId} className={`px-4 py-3 ${p.status === 'blocked' ? 'bg-gray-50' : ''}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p>
                    <strong className="text-gray-900">{p.name || 'Zonder naam'}</strong>
                    {me && <span className="text-gray-600"> (jij)</span>}
                    <span className="block text-sm break-all text-gray-600">{p.email}</span>
                  </p>
                  <span className="text-sm text-gray-700">
                    {p.status === 'blocked' ? 'geen toegang' : (p.org ?? '—')}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                  <Switch
                    size="sm"
                    checked={p.isCoordinator}
                    disabled={me || p.status !== 'active'}
                    onChange={(v) =>
                      run(
                        () => updateProfileAsCoordinator(p.userId, { isCoordinator: v }),
                        v ? `${p.name || p.email} is nu coördinator` : `${p.name || p.email} is geen coördinator meer`,
                      )
                    }
                    label="Coördinator"
                  />
                  {!me &&
                    (p.status === 'active' ? (
                      <button
                        type="button"
                        className="btn-ghost text-red-700"
                        onClick={() => run(() => updateProfileAsCoordinator(p.userId, { status: 'blocked' }), 'Toegang ingetrokken')}
                      >
                        <UserX className="size-4" aria-hidden="true" /> Toegang intrekken
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!p.org && !p.requestedOrg}
                        onClick={() =>
                          run(
                            () => updateProfileAsCoordinator(p.userId, { status: 'active', org: p.org ?? p.requestedOrg ?? undefined }),
                            'Toegang hersteld',
                          )
                        }
                      >
                        <Check className="size-4" aria-hidden="true" /> Opnieuw toegang geven
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

function PendingRow({
  p,
  onApprove,
  onReject,
}: {
  p: Profile;
  onApprove: (org: string, wholeDomain: boolean) => void;
  onReject: () => void;
}) {
  const [org, setOrg] = useState(p.requestedOrg ?? '');
  const domain = domainOf(p.email);
  const canUseDomain = useMemo(() => domain && !PUBLIC_DOMAINS.has(domain), [domain]);
  const [wholeDomain, setWholeDomain] = useState(false);
  const id = `org-${p.userId}`;
  return (
    <li className="card border-amber-300 p-4">
      <p className="font-semibold break-all text-gray-900">{p.email}</p>
      <p className="text-sm text-gray-600">
        {p.name || 'Nog geen naam'} · zegt te werken voor <strong>{p.requestedOrg || '—'}</strong> · {fmtRelative(p.createdAt)}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="min-w-56 flex-1">
          <label htmlFor={id} className="field-label">
            Organisatie
          </label>
          <input id={id} className="input" list="org-list" value={org} onChange={(e) => setOrg(e.target.value)} />
        </div>
        <button type="button" className="btn-primary" disabled={!org.trim()} onClick={() => onApprove(org.trim(), wholeDomain && !!canUseDomain)}>
          <Check className="size-4" aria-hidden="true" /> Goedkeuren
        </button>
        <button type="button" className="btn-ghost text-red-700" onClick={onReject}>
          Weigeren
        </button>
      </div>
      {canUseDomain && (
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800">
          <input type="checkbox" className="size-5 accent-brand-700" checked={wholeDomain} onChange={(e) => setWholeDomain(e.target.checked)} />
          Ook iedereen met een @{domain}-adres voortaan meteen toelaten
        </label>
      )}
    </li>
  );
}

function RuleForm({ onAdd }: { onAdd: (rule: AccessRule) => void }) {
  const [pattern, setPattern] = useState('');
  const [org, setOrg] = useState('');
  const [coordinator, setCoordinator] = useState(false);
  const clean = pattern.trim().toLowerCase();
  const valid = /^[^@\s]*@[^@\s]+\.[^@\s]+$/.test(clean) && !(clean.startsWith('@') && PUBLIC_DOMAINS.has(clean.slice(1)));
  return (
    <form
      className="card grid gap-3 bg-gray-50 p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid || !org.trim()) return;
        onAdd({ pattern: clean, org: org.trim(), isCoordinator: coordinator && !clean.startsWith('@') });
        setPattern('');
        setCoordinator(false);
      }}
    >
      <div>
        <label htmlFor="rule-pattern" className="field-label">
          E-mailadres of @domein
        </label>
        <input
          id="rule-pattern"
          className="input"
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="naam@vlaanderen.be of @proveg.com"
        />
      </div>
      <div>
        <label htmlFor="rule-org" className="field-label">
          Organisatie
        </label>
        <input id="rule-org" className="input" list="org-list" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="bv. Departement Omgeving" />
      </div>
      <button type="submit" className="btn-primary" disabled={!valid || !org.trim()}>
        <Plus className="size-4" aria-hidden="true" /> Toevoegen
      </button>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-gray-800 sm:col-span-3">
        <input
          type="checkbox"
          className="size-5 accent-brand-700"
          checked={coordinator}
          disabled={clean.startsWith('@')}
          onChange={(e) => setCoordinator(e.target.checked)}
        />
        Coördinator (enkel voor een exact e-mailadres)
      </label>
      {clean.startsWith('@') && PUBLIC_DOMAINS.has(clean.slice(1)) && (
        <p className="text-sm text-red-700 sm:col-span-3">Een publiek domein zoals {clean} kan je niet in zijn geheel toelaten.</p>
      )}
    </form>
  );
}
