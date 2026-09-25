import { useEffect, useState } from 'react';
import { CircleAlert, Mail } from 'lucide-react';
import { useStore } from '../store';
import { sb } from '../lib/supabase';
import { Modal } from './ui';

type Step = 'email' | 'code';

/** Supabase error messages are English and technical; translate the common ones. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('rate limit') || m.includes('security purposes') || m.includes('too many'))
    return 'Er werden net te veel codes aangevraagd. Wacht een minuut en probeer opnieuw.';
  if (m.includes('expired') || m.includes('invalid') || m.includes('otp')) return 'Deze code klopt niet of is verlopen. Vraag een nieuwe code aan.';
  if (m.includes('email') && m.includes('valid')) return 'Dat e-mailadres lijkt niet te kloppen.';
  if (m.includes('fetch') || m.includes('network')) return 'Geen verbinding met de server. Controleer je internet.';
  return message;
}

export function LoginDialog() {
  const { live } = useStore();
  const profile = live?.profile ?? null;
  const needsProfile = !!profile && (!profile.name || (profile.status === 'active' && !profile.org));
  const open = !!live && (live.loginOpen || needsProfile);
  if (!live || !open) return null;
  return needsProfile ? <ProfileStep /> : <LoginSteps onClose={() => live.setLoginOpen(false)} />;
}

function LoginSteps({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await sb().auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    setStep('code');
    setCode('');
    setCooldown(60);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await sb().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Inloggen"
      subtitle={step === 'email' ? 'Zonder wachtwoord: je krijgt een code per e-mail.' : `We stuurden een code naar ${email.trim()}.`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (step === 'email') sendCode();
          else verify();
        }}
      >
        {step === 'email' ? (
          <div>
            <label htmlFor="login-email" className="field-label">
              Je e-mailadres op het werk
            </label>
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="naam@organisatie.be"
              required
              data-autofocus
            />
          </div>
        ) : (
          <div>
            <label htmlFor="login-code" className="field-label">
              Code uit de e-mail
            </label>
            <input
              id="login-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              className="input text-center font-mono text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              required
              data-autofocus
            />
            <p className="mt-2 text-sm text-gray-600">
              Niets ontvangen? Kijk ook in je spam. De e-mail komt van “Eiwitshift-kalender”.
            </p>
          </div>
        )}

        {error && (
          <p className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-200 ring-inset" role="alert">
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          {step === 'code' ? (
            <button
              type="button"
              className="min-h-11 text-sm font-semibold text-brand-800 underline-offset-2 hover:underline disabled:text-gray-500 disabled:no-underline"
              disabled={busy || cooldown > 0}
              onClick={sendCode}
            >
              {cooldown > 0 ? `Nieuwe code (${cooldown} s)` : 'Stuur een nieuwe code'}
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn-primary" disabled={busy || (step === 'email' ? !email.trim() : code.length < 6)}>
            {step === 'email' ? (
              <>
                <Mail className="size-4" aria-hidden="true" /> Stuur code
              </>
            ) : (
              'Inloggen'
            )}
          </button>
        </div>
        {step === 'code' && (
          <button type="button" className="text-sm text-gray-600 underline underline-offset-2" onClick={() => setStep('email')}>
            Ander e-mailadres gebruiken
          </button>
        )}
      </form>
    </Modal>
  );
}

/** First login: ask for a name, and which organisation you work for. */
function ProfileStep() {
  const { live } = useStore();
  const profile = live!.profile!;
  const pending = profile.status !== 'active';
  const needsOrg = pending || !profile.org;
  const [name, setName] = useState(profile.name);
  const [org, setOrg] = useState(profile.requestedOrg ?? profile.org ?? '');
  const [orgs, setOrgs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sb()
      .from('organisations')
      .select('name')
      .order('name')
      .then(({ data }) => setOrgs((data ?? []).map((o) => o.name)));
  }, []);

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await live!.saveProfile(
        pending ? { name: name.trim(), requestedOrg: org.trim() } : { name: name.trim(), ...(needsOrg ? { org: org.trim() } : {}) },
      );
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  };

  return (
    <Modal
      open
      onClose={() => live!.signOut()}
      size="sm"
      title="Welkom!"
      subtitle={`Je bent ingelogd als ${profile.email}. Nog even dit:`}
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <div>
          <label htmlFor="p-name" className="field-label">
            Je naam
          </label>
          <input id="p-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required data-autofocus />
          <p className="mt-1 text-sm text-gray-600">Andere partners zien je naam bij je reacties.</p>
        </div>
        {needsOrg && (
          <div>
            <label htmlFor="p-org" className="field-label">
              Voor welke organisatie werk je?
            </label>
            <input id="p-org" className="input" list="p-org-list" value={org} onChange={(e) => setOrg(e.target.value)} required />
            <datalist id="p-org-list">
              {orgs.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
            {pending && (
              <p className="mt-1 text-sm text-gray-600">Een coördinator bevestigt je toegang. Je krijgt daarna meteen toegang.</p>
            )}
          </div>
        )}
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={busy || !name.trim() || (needsOrg && !org.trim())}>
            {pending ? 'Vraag toegang aan' : 'Opslaan'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
