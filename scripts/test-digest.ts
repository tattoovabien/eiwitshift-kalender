// Tests the monthly digest: when it leaves by itself, the greeting, and that no moment is listed twice.
// Run: npx tsx scripts/test-digest.ts
import { autoDigestDue, brusselsNow, firstWorkday, nextAutoDigest } from '../src/lib/digestSchedule';
import { applyDigestEdits, digestEditsFrom, digestEmail, emailToText, fillGreeting, sanitizeEmail } from '../src/lib/emails';
import { emailToHtml } from '../src/lib/emailHtml';
import { isPast } from '../src/lib/moments';
import { seedState } from '../src/seed';
import type { AppState } from '../src/types';

let fails = 0;
let passes = 0;
function eq(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passes++;
  else {
    fails++;
    console.log(`✘ ${name}\n   verwacht: ${JSON.stringify(expected)}\n   kreeg:    ${JSON.stringify(actual)}`);
  }
}

// 1. First working day: weekends and 1 January / 1 May / 1 November don't count
eq('oktober 2026 (do 1/10)', firstWorkday('2026-10'), '2026-10-01');
eq('november 2026 (zo 1/11)', firstWorkday('2026-11'), '2026-11-02');
eq('januari 2027 (vr 1/1 = feestdag)', firstWorkday('2027-01'), '2027-01-04');
eq('mei 2026 (vr 1/5 = feestdag)', firstWorkday('2026-05'), '2026-05-04');
eq('augustus 2026 (za 1/8)', firstWorkday('2026-08'), '2026-08-03');

// 2. Is it time?
eq('eerste werkdag, 8 uur', autoDigestDue({ date: '2026-10-01', hour: 8 }, null), true);
eq('eerste werkdag, 7 uur: te vroeg', autoDigestDue({ date: '2026-10-01', hour: 7 }, null), false);
eq('dag vóór de eerste werkdag', autoDigestDue({ date: '2026-11-01', hour: 12 }, null), false);
eq('inhalen op de 5de', autoDigestDue({ date: '2026-10-05', hour: 3 }, null), true);
eq('na de 7de niet meer', autoDigestDue({ date: '2026-10-08', hour: 9 }, null), false);
eq('overgeslagen na een digest op 30/9', autoDigestDue({ date: '2026-10-01', hour: 9 }, '2026-09-30'), false);
eq('een digest op 20/9 telt niet voor oktober', autoDigestDue({ date: '2026-10-01', hour: 9 }, '2026-09-20'), true);
eq('al verstuurd deze maand', autoDigestDue({ date: '2026-10-02', hour: 9 }, '2026-10-01'), false);

// 3. Next date shown on screen
eq('vandaag 30/9 → donderdag 1/10', nextAutoDigest({ date: '2026-09-30', hour: 15 }, null), '2026-10-01');
eq('met de hand verstuurd op 30/9 → oktober overgeslagen', nextAutoDigest({ date: '2026-09-30', hour: 15 }, '2026-09-30'), '2026-11-02');
eq('1/10 om 7 uur → vandaag nog', nextAutoDigest({ date: '2026-10-01', hour: 7 }, null), '2026-10-01');
eq('1/10 net verstuurd → november', nextAutoDigest({ date: '2026-10-01', hour: 9 }, '2026-10-01'), '2026-11-02');
eq('inhalen nodig → vandaag', nextAutoDigest({ date: '2026-10-03', hour: 10 }, null), '2026-10-03');
eq('15/10 → november', nextAutoDigest({ date: '2026-10-15', hour: 10 }, '2026-10-01'), '2026-11-02');

// 4. Belgian time, also when the server runs in UTC
eq('zomertijd: 06:05 UTC = 8 uur', brusselsNow(new Date('2026-10-01T06:05:00Z')), { date: '2026-10-01', hour: 8 });
eq('wintertijd: 07:05 UTC = 8 uur', brusselsNow(new Date('2026-12-01T07:05:00Z')), { date: '2026-12-01', hour: 8 });
eq('middernacht in Brussel is nog de vorige dag in UTC', brusselsNow(new Date('2026-09-30T22:30:00Z')).date, '2026-10-01');

// 5. Greeting
eq('voornaam ingevuld', fillGreeting('Dag [voornaam],', 'Lucas Temmerman'), 'Dag Lucas,');
eq('zonder naam', fillGreeting('Dag [voornaam],', ''), 'Dag,');
eq('zonder naam, midden in de zin', fillGreeting('Hallo [voornaam], welkom', null), 'Hallo, welkom');
eq('vaste aanspreking blijft', fillGreeting('Dag allemaal,', 'Lucas'), 'Dag allemaal,');

// 6. Digest content: every moment once, moments looking for partners marked
const TODAY = '2026-09-30';
const state: AppState = seedState();
const base = digestEmail(state, TODAY);
eq('standaardaanspreking', base.greeting, 'Dag [voornaam],');
const listed = base.sections
  .filter((s) => s.heading !== 'Populairste momenten')
  .flatMap((s) => (s.items ?? []).map((i) => i.title));
eq('geen moment dubbel (buiten populairste)', listed.length, new Set(listed).size);
const seekingTitles = state.moments.filter((m) => m.need?.trim() && !isPast(m, TODAY)).map((m) => m.title);
const marked = base.sections.flatMap((s) => (s.items ?? []).filter((i) => i.seeking).map((i) => i.title));
eq('er zijn zoekende momenten in de demodata', seekingTitles.length > 0, true);
eq('elk zoekend moment staat erin met label', seekingTitles.every((t) => marked.includes(t)), true);
eq('label heeft de vraag als notitie', base.sections.flatMap((s) => s.items ?? []).filter((i) => i.seeking).every((i) => i.note?.startsWith('Zoekt: ')), true);
eq('geen oude sectie "Zoekt partners"', base.sections.some((s) => s.heading === 'Zoekt partners'), false);

const noSeeking = digestEmail({ ...state, moments: state.moments.map((m) => ({ ...m, need: undefined })) }, TODAY);
eq('lege "later"-lijst verdwijnt', noSeeking.sections.some((s) => s.heading?.startsWith('Zoekt ook partners')), false);
const laterOnly = digestEmail(
  { ...state, moments: [{ ...state.moments[0], id: 'x', title: 'Ver weg', startDate: '2027-06-01', endDate: '2027-06-01', ongoing: false, dateUnsure: false, need: 'Sprekers' }] },
  TODAY,
);
eq('zoekend moment later dan 2 maanden → aparte lijst', laterOnly.sections.find((s) => s.heading?.startsWith('Zoekt ook partners'))?.items?.map((i) => i.title), ['Ver weg']);

// 7. Editing: greeting kept, "eigen bericht" gone
const edits = { ...digestEditsFrom(base), greeting: 'Dag allemaal,' };
const edited = applyDigestEdits(base, edits);
eq('aangepaste aanspreking', edited.greeting, 'Dag allemaal,');
eq('lege aanspreking → standaard', applyDigestEdits(base, { ...edits, greeting: '  ' }).greeting, 'Dag [voornaam],');
eq('geen extra blok', edited.sections.length, base.sections.length);
const clean = sanitizeEmail(JSON.parse(JSON.stringify(edited)));
eq('server neemt aanspreking over', clean?.greeting, 'Dag allemaal,');
eq('server behoudt het label', clean?.sections.flatMap((s) => s.items ?? []).filter((i) => i.seeking).length, marked.length);
eq('server: zonder aanspreking → standaard', sanitizeEmail({ subject: 'x', sections: [] })?.greeting, 'Dag [voornaam],');

// 8. The label reaches the real e-mail and the text version
if (marked.length) {
  eq('html bevat label', emailToHtml(edited).includes('🤝 Zoekt partners'), true);
  eq('tekst bevat label', emailToText(edited).includes('(🤝 Zoekt partners)'), true);
}

console.log(`\n${fails ? '✘' : '✔'} ${passes} geslaagd, ${fails} mislukt`);
process.exit(fails ? 1 : 0);
