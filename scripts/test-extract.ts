// Tests the page reader ("Plak een link") on sample pages. Run: npx tsx scripts/test-extract.ts
import { findDates, normalizeAiOutput, mergePrefill, parseHtml, prefillFromPage, cleanTitle } from '../src/lib/pageExtract';
import { fakeExtract, DEMO_LINK } from '../src/lib/prefill';

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

const TODAY = '2026-09-28';

// 1. A page with schema.org Event data (how most event platforms publish)
const ldPage = `<!doctype html><html><head>
<title>Kookworkshop: plantaardig op kot | ProVeg België</title>
<meta property="og:site_name" content="ProVeg België">
<meta property="og:title" content="Kookworkshop: plantaardig op kot">
<meta name="description" content="Leer snel &amp; goedkoop plantaardig koken. Voor studenten. Gratis deelname!">
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[{"@type":"WebPage","name":"x"},
{"@type":"EducationEvent","name":"Kookworkshop: plantaardig op kot","startDate":"2027-03-04T19:00:00+01:00","endDate":"2027-03-04T21:30",
"location":{"@type":"Place","name":"Campus Aula","address":{"@type":"PostalAddress","addressLocality":"Gent"}},
"organizer":{"@type":"Organization","name":"ProVeg"},"offers":{"@type":"Offer","price":"0","priceCurrency":"EUR"},
"description":"Hands-on kookworkshop voor studenten."}]}</script>
</head><body><nav>Home Agenda</nav><h1>Kookworkshop</h1><p>Donderdag 4 maart 2027, 19u.</p><footer>© 2025</footer></body></html>`;
const r1 = prefillFromPage(parseHtml(ldPage, 'https://proveg.com/be/agenda/kookworkshop'), TODAY);
eq('JSON-LD: titel', r1.title, 'Kookworkshop: plantaardig op kot');
eq('JSON-LD: type (workshop)', r1.type, 'Workshop');
eq('JSON-LD: datum', [r1.startDate, r1.endDate, r1.dateUnsure], ['2027-03-04', undefined, false]);
eq('JSON-LD: regio', r1.region, 'Gent');
eq('JSON-LD: gratis', r1.free, true);
eq('JSON-LD: organisator', r1.organiserGuess, 'ProVeg');
eq('JSON-LD: doelgroep', r1.targetGroup, 'Hoger onderwijs');
eq('JSON-LD: beschrijving', r1.description, 'Hands-on kookworkshop voor studenten.');

// 2. Only meta tags, Dutch date range in the description, site name in the title
const ogPage = `<html><head><title>Week van de Peulvrucht - Gezond Leven</title>
<meta property="og:description" content="Van 8 tot 14 februari 2027 zetten we bonen, linzen en kikkererwten in de kijker. Plantaardig en lekker.">
<meta property="og:site_name" content="Gezond Leven"></head>
<body><p>Gepubliceerd op 12/05/2025</p><p>Doe mee!</p></body></html>`;
const r2 = prefillFromPage(parseHtml(ogPage, 'https://www.gezondleven.be/week-van-de-peulvrucht'), TODAY);
eq('meta: titel zonder sitenaam', r2.title, 'Week van de Peulvrucht');
eq('meta: type campagne', r2.type, 'Campagne');
eq('meta: datumbereik uit beschrijving', [r2.startDate, r2.endDate], ['2027-02-08', '2027-02-14']);
eq('meta: organisator uit domein', r2.organiserGuess, 'Vlaams Instituut Gezond Leven');
eq('meta: focus', r2.focus, 'breder eiwitshift');

// 3. No date anywhere except an old publish date → no date found
const noDate = `<html><head><title>Over ons</title></head><body><p>Nieuws van 3 januari 2024.</p></body></html>`;
const r3 = prefillFromPage(parseHtml(noDate, 'https://example.org/over-ons'), TODAY);
eq('geen (toekomstige) datum', [r3.foundDate, r3.startDate], [false, '']);

// 3b. A news article: the publish date (just before today) is not the event date
const article = `<html><head><title>Volg een workshop &middot; ProVeg</title></head><body><p>26 september 2026</p><p>Schrijf je in voor de workshop op 15 oktober 2026.</p></body></html>`;
const r3b = prefillFromPage(parseHtml(article, 'https://proveg.org/be/nieuws/x'), TODAY);
eq('artikel: publicatiedatum overgeslagen', r3b.startDate, '2026-10-15');
eq('artikel: &middot; + sitenaam', r3b.title, 'Volg een workshop');

// 4. Date formats in running text
eq('datum: 30 november - 2 december 2026', findDates('van 30 november - 2 december 2026')[0], { start: '2026-11-30', end: '2026-12-02', unsure: false, index: 4 });
eq('datum: 4 en 5 maart 2027', findDates('op 4 en 5 maart 2027')[0].end, '2027-03-05');
eq('datum: 04/03/2027 (dag eerst)', findDates('datum: 04/03/2027')[0].start, '2027-03-04');
eq('datum: March 4, 2027', findDates('on March 4, 2027')[0].start, '2027-03-04');
eq('datum: enkel maand', findDates('ergens in mei 2027')[0], { start: '2027-05-01', unsure: true, index: 10 });
eq('datum: 31 februari is geen datum, enkel de maand blijft', findDates('31 februari 2027').map((d) => [d.start, d.unsure]), [['2027-02-01', true]]);

// 5. Title cleanup and entity decoding
eq('titel: sitenaam weg', cleanTitle('Aardappelcampagne | VLAM', 'VLAM', 'www.vlam.be'), 'Aardappelcampagne');
eq('titel: domeinnaam weg', cleanTitle('Studiedag vleesanalogen – ILVO Vlaanderen', '', 'ilvo.vlaanderen.be'), 'Studiedag vleesanalogen');
eq('entiteiten', parseHtml('<title>Smos &amp; co &#8211; test</title>', 'https://x.be').title, 'Smos & co – test');

// 6. AI answers are checked field by field
const ai = normalizeAiOutput({
  title: 'Kookworkshop', type: 'Workshop', target_group: 'Iedereen', focus: 'onbekend',
  start_date: '2027-02-30', end_date: '', unsure_month: '2027-03', unsure_note: 'begin maart', region: 'Gent',
  free: 'gratis', organiser: '', description: 'Leer koken.',
});
eq('AI: ongeldige doelgroep valt weg', ai.targetGroup, undefined);
eq('AI: ongeldige datum → maand', [ai.startDate, ai.dateUnsure, ai.unsureNote], ['2027-03-01', true, 'begin maart']);
const merged = mergePrefill(r1, ai);
eq('AI: samenvoegen houdt paginawaarden waar AI niets vond', [merged.organiserGuess, merged.targetGroup], ['ProVeg', 'Hoger onderwijs']);
eq('AI: samenvoegen neemt AI-datum over', [merged.startDate, merged.dateUnsure], ['2027-03-01', true]);

// 7. The link-only fallback still works (prototype + unreadable pages)
eq('link: demo', fakeExtract(DEMO_LINK).startDate, '2027-03-04');
eq('link: /events/ is Event', fakeExtract('https://example.org/events/grote-proeverij-12-mei-2027').type, 'Event');

console.log(`\n${fails ? '✘' : '✔'} ${passes} geslaagd, ${fails} mislukt`);
process.exit(fails ? 1 : 0);
