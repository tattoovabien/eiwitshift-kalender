# Eiwitshift-kalender – prototype

Klikbaar prototype van een gedeelde communicatiekalender voor de partners van de Green Deal Eiwitshift.
Het vervangt (in gedachten) de gedeelde Google Sheet. **Alles is demodata en er wordt niets echt verstuurd**:
geen login, geen database, geen e-mails, geen AI. Dat wordt allemaal gesimuleerd.

## Openen

1. Dubbelklik op **`Eiwitshift-kalender-prototype.html`** (in deze map). Het opent in je browser (Chrome, Edge, Firefox of Safari).
2. Er is geen internet of installatie nodig. Je kan het bestand ook mailen of op eender welke website zetten.
3. Wijzigingen blijven bewaard in **jouw** browser (ook na herladen). Iemand anders die het bestand opent, begint met de originele demodata.
4. Met **Reset demo** (rechtsboven in de gele balk) zet je alles terug naar de originele demodata. Doe dat vlak vóór een demo.

Wissel bovenaan via **Demo-rol** tussen *Coördinator (Omgeving)*, *Partner: Lidl*, *Partner: ProVeg*, *Partner: Plant-Based Universities* en *Niet ingelogd*.

## Demoscript (5 minuten) voor Enya en Kristof

**Voorbereiding:** open het bestand, klik op *Reset demo*, en kies de rol *Coördinator (Omgeving)*.

1. **Coördinator-overzicht (1 min)**
   - *Overzicht*: kaarten per maand. Bovenaan staan de doorlopende campagnes. Campagnes over meerdere maanden komen in elke maand terug met “loopt nog tot …”.
   - Klik op *Nu bezig*, daarna op *Toon voorbije*. Open *Filters* (type, doelgroep, regio, organisator, …).
   - *Tijdlijn*: lange balken tonen meteen waar campagnes overlappen (bv. ‘Smos alles’ en de Aardappelcampagne, of twee events op 15 december).
2. **Een partner voegt een moment toe via “plak een link” (1 min)**
   - Demo-rol → *Partner: ProVeg* → **Moment toevoegen**.
   - Klik op *Probeer met een voorbeeldlink* (of plak zelf een link). Na “AI leest de pagina…” zijn titel, type en datum ingevuld.
   - Extra: typ als titel “Week van de peulvrucht” en toon de waarschuwing voor een dubbel moment. Zet daarna de titel terug.
   - Klik op **Moment toevoegen**.
3. **Een andere partner haakt aan (1 min)**
   - Demo-rol → *Partner: Plant-Based Universities*.
   - Open het nieuwe moment ‘Kookworkshop Plantaardig op kot’ (maart 2027) en klik op **Ik haak aan**. Voeg eventueel een korte toelichting toe.
4. **De organisator krijgt een melding (1 min)**
   - Demo-rol → *Partner: ProVeg*. Het belletje heeft een rood bolletje.
   - Klik op het belletje en dan op de melding “Nieuwe reactie op jouw moment…”. Het moment opent en de nieuwe reactie licht even op.
   - Klik in de meldingenlijst op het envelopje naast de melding: zo ziet de e-mail eruit die ProVeg zou krijgen.
5. **Coördinator: matches en digest (1 min)**
   - Demo-rol → *Coördinator (Omgeving)* → **Dashboard**.
   - *Matches*: momenten waar minstens één partner op reageerde, de drukste bovenaan, met wie al in contact is. Toon *Breng in contact*.
   - *Digest-preview*: de maandelijkse nudge-mail met “komende 2 maanden” (momenten die partners zoeken krijgen het label 🤝), “populairste momenten” en “vul de agenda aan”. Pas links het onderwerp, de aanspreking of de inleiding aan, of vink een moment uit, en zie de preview meteen veranderen. Toon de schakelaar *Elke maand automatisch versturen* met de volgende verzenddatum. Klik op *Kopieer als tekst*.
   - Als er tijd over is: *Signalen* (bezorgdheden die enkel coördinatoren zien), *Velden beheren* (een nieuw veld verschijnt meteen in het formulier en de filters), *Export* (Excel of CSV) en het rss-icoon voor de agenda-feed.

## Wat zit erin

- **Overzicht** per maand, met zoeken, filters, *Nu bezig* en voorbije momenten (standaard verborgen).
- **Tijdlijn** van september 2026 tot december 2027.
- **Detailpaneel** met *Ik haak aan* en *Ik kan mee verspreiden*, “we zijn al in contact”, opmerkingen, *Signaleer bezorgdheid*, *Voeg toe aan agenda (.ics)* (downloadt echt) en *Kopieer halfhalf-zinnetje*.
- **Formulier** met *Plak een link* (gesimuleerde AI), een waarschuwing voor dubbele momenten en rechten: partners bewerken enkel hun eigen momenten, coördinatoren alles.
- **Meldingen** per rol, met een e-mailpreview.
- **Coördinator-dashboard** met Matches, Signalen, Velden beheren, Digest-preview (aanpasbaar) en Export (Excel, CSV en .ics).
- **Opmerkingen** kan je zelf aanpassen of verwijderen; een coördinator kan elke opmerking verwijderen.
- **Meldingen** openen wat er gebeurde (het moment, met de reactie, opmerking of bezorgdheid even opgelicht); het envelopje toont de bijhorende e-mail.
- **Agenda-feed** met een voorbeeld-abonnementslink en uitleg voor Outlook en Google Agenda.
- **Niet ingelogd**: je ziet enkel titels en data.

**Over de demodata:** de momenten komen uit de huidige sheet, met enkel organisatienamen. De reacties, opmerkingen en signalen zijn verzonnen. Ook de vlag “Green Deal-partner” en de korte beschrijvingen zijn enkel ter illustratie. De voorbeeldlinks eindigen op `.example` en bestaan niet.

## Wat een echte versie nog nodig heeft

- **Echte login via een e-maillink** (zonder wachtwoord), met rollen (partner of coördinator) en een beheerde lijst van partnerorganisaties en contactpersonen.
- **Een database die in de EU gehost wordt**, met back-ups en een verwerkersovereenkomst.
- **Echte e-mails**: meldingen en de maandelijkse digest via een e-maildienst met EU-verwerking. Ook nodig: een afmeldlink, meldingsvoorkeuren per persoon en correcte afzenderinstellingen (SPF/DKIM).
- **AI om het formulier vooraf in te vullen**: de webpagina ophalen en laten uitlezen door een AI-model. Afspraken nodig over welke dienst, over de gegevensverwerking en over een mens die het resultaat altijd nakijkt.
- **Een echte agenda-feed**: een persoonlijke ICS-link die automatisch bijwerkt.
- **Een privacyverklaring (GDPR)**: welke persoonsgegevens, waarom, hoe lang ze bewaard worden, wie er toegang heeft, en hoe anonieme signalen echt anoniem blijven.
- **Een toegankelijkheidscheck**: een audit tegen WCAG 2.1 AA, met test met toetsenbord en schermlezer. Het prototype is ontworpen met voldoende contrast en grote klikvlakken, maar is niet geaudit.
- **Eigenaarschap en onderhoud**: wie is eigenaar (bv. Departement Omgeving), wie beheert partners en velden, wie modereert, wie betaalt hosting en onderhoud, wie is het aanspreekpunt bij problemen, en welke domeinnaam en huisstijl gebruikt worden.
- **Migratie**: een eenmalige import van de huidige Google Sheet.

## Testversie online (functioneel, gratis)

Naast het prototype bestaat er een **werkende testversie** op **https://tattoovabien.github.io/eiwitshift-kalender/**. Die gebruikt dezelfde schermen, maar met echte gegevens:

- **Inloggen met een code per e-mail**, zonder wachtwoord. Wie op de toegangslijst staat, komt meteen binnen. Anderen vragen toegang aan en een coördinator keurt goed (*Dashboard → Toegang*).
- **Iedereen ziet dezelfde gegevens, live bijgewerkt.**
- **Echte e-mails**: bij een reactie of opmerking, bij een nieuwe toegangsaanvraag, en de digest via *Verstuur digest nu* of automatisch elke maand.
- **Een echte, persoonlijke agenda-feed** voor Outlook en Google Agenda.
- **Plak een link leest de webpagina echt.** Zonder AI worden de gestructureerde eventgegevens (schema.org), de metatags en Nederlandse datums in de tekst gebruikt. Met een AI-sleutel leest ook AI mee (zie *AI koppelen*). Kan een pagina niet gelezen worden (bv. een website die robots weigert), dan wordt enkel de titel uit de link afgeleid.
- **Nog niet automatisch**: de kennismakingsmail bij Matches kopieer je en verstuur je zelf.

### AI koppelen voor “Plak een link” (optioneel)

Je hebt een **API-sleutel** nodig. Een gewoon abonnement (Gemini Advanced, Claude Pro, …) werkt niet: dat is enkel voor de chat-app. Zet de sleutel in Supabase → *Edge Functions → Secrets*. Opnieuw publiceren is niet nodig, de volgende link wordt meteen met AI gelezen.

| Dienst | Sleutel aanmaken | Naam van het geheim | Kosten |
|---|---|---|---|
| Gemini (Google) | [aistudio.google.com](https://aistudio.google.com) → *Get API key* | `GEMINI_API_KEY` | Gratis laag (standaardmodel `gemini-3.5-flash-lite`). In de gratis laag gebruikt Google de inhoud om zijn producten te verbeteren; er gaan enkel openbare webpagina's naartoe. |
| Claude (Anthropic) | [console.anthropic.com](https://console.anthropic.com) → *API Keys* (vooraf wat tegoed kopen) | `ANTHROPIC_API_KEY` | Betalen per gebruik: enkele eurocenten per link met het standaardmodel `claude-opus-5`. |

- Staan beide sleutels erin, kies dan met `AI_PROVIDER` (`gemini` of `anthropic`).
- Een ander model kies je met `AI_MODEL`, bv. `claude-haiku-4-5` (goedkoper) of `gemini-3.8-flash`.
- Weigert Claude een pagina om veiligheidsredenen, dan probeert Anthropic automatisch een ander model (`fallbacks: "default"`).
- Werkt de AI niet (verkeerde sleutel, quotum op), dan valt de kalender stil terug op het lezen zonder AI.

### Waar draait wat (alles gratis)

| Onderdeel | Dienst | Opmerking |
|---|---|---|
| Database + login | Supabase, regio Frankfurt (EU) | Gratis project **pauzeert na 1 week zonder gebruik**: open dan het Supabase-dashboard en klik op *Restore*. |
| E-mails | Brevo (gratis, 300 per dag) | Vertrekt vanaf je Gmail-adres via Brevo (@brevosend.com). Test vooraf of mails niet in de spam belanden. In Brevo moet *Security → Authorized IPs → blokkeren van onbekende IP-adressen* uit staan, anders weigert Brevo de mails van Supabase. |
| Website | GitHub Pages | Publieke repository. Er staan geen geheimen in: de "anon key" is bedoeld om publiek te zijn, de toegangsregels zitten in de database. |

### Beheer

- **Voor een demo**: open het Supabase-dashboard (zodat het project niet gepauzeerd is) en zet de adressen van de gasten op de toegangslijst.
- **Iemand toegang geven**: *Dashboard → Toegang*.
  - *Toegangslijst* = wie je vooraf binnenlaat (een exact adres, of een heel domein zoals `@proveg.com`). Er wordt niets aangemaakt of verstuurd; die persoon komt meteen binnen bij de eerste login.
  - *Aanvragen* = wie inlogde maar niet op de lijst stond; jij keurt goed.
  - *Gebruikers* = iedereen die al een account heeft (minstens één keer ingelogd).
- **Je naam wijzigen**: klik rechtsboven op je naam → *Naam wijzigen*. Ook je eerdere reacties tonen dan de nieuwe naam.
- **De digest**: *Dashboard → Digest-preview*.
  - In de aanspreking wordt `[voornaam]` per ontvanger vervangen door de voornaam. Haal je het weg (bv. “Dag allemaal,”), dan krijgt iedereen die tekst.
  - *Elke maand automatisch versturen*: op de eerste werkdag van de maand rond 8 uur, met het automatische overzicht (niet met aanpassingen uit de editor). Werkdag = maandag tot vrijdag, zonder 1 januari, 1 mei en 1 november.
  - Ging er in de week ervoor of die maand al een digest weg, dan wordt die maand overgeslagen. Lukt het niet op de eerste werkdag, dan probeert het systeem elk uur opnieuw, tot en met de 7de.
  - Een gepauzeerd Supabase-project verstuurt niets. Hou het project actief, of kies voor een betaald plan.
- **Mail in Gmail bij ‘Reclame’?** Sleep hem naar *Primair* en kies “Ja” voor toekomstige berichten. Brevo voegt altijd een volgpixel toe; op lange termijn helpt een eigen domein (zie hieronder).
- **Na de test**: verwijder de testgebruikers in Supabase → *Authentication → Users*, of verwijder het hele project.

### Bij de overdracht aan Omgeving (Enya en Kristof)

- [ ] **Eigen domein** (bv. `eiwitshift-kalender.be`, ± €10–15 per jaar), bij voorkeur op naam van Omgeving of PBU:
  - in Brevo → *Senders, Domains & Dedicated IPs → Domains* het domein toevoegen en de 3–4 DNS-records bij de registrar plakken;
  - daarna de afzender aanpassen in Supabase (*Authentication → Emails → SMTP*) en in het geheim `SENDER_EMAIL`;
  - optioneel: de site op `kalender.<domein>` zetten (GitHub Pages → *Custom domain*) en `APP_URL` + de *Site URL* in Supabase aanpassen.
- [ ] Wie wordt eigenaar van de Supabase-, Brevo- en GitHub-accounts? Leden toevoegen of de projecten overdragen.
- [ ] Testdata en testaccounts wissen (bv. het moment “Testevent” en `+proveg`-adressen).
- [ ] Enya en Kristof als coördinator op de toegangslijst; eventueel jezelf daarna als gewone partner.
- [ ] Beslissen over privacyverklaring, toegankelijkheidscheck en een AI-sleutel voor “Plak een link”.
- [ ] Automatische digest: aan of uit? Het gratis project pauzeert na een week zonder gebruik, en dan vertrekt er niets. Kies voor een vaste verzending eventueel het betaalde plan van Supabase.

### Voor een ontwikkelaar

```bash
npm run test:db           # alle toegangsregels testen in een lokale Postgres (PGlite)
npm run test:extract      # de paginalezer van "Plak een link" testen
npm run test:digest       # digest: planning van de automatische verzending, aanspreking, geen dubbele momenten
npm run dev:live          # ontwikkelserver tegen de echte database (.env.live nodig)
npm run functions:deploy  # e-mail-, digest- en feedfuncties naar Supabase
npm run deploy:site       # live-versie bouwen en op GitHub Pages zetten
```

- `supabase/migrations/`: tabellen, toegangsregels (Row Level Security), triggers voor meldingen, seed met de 25 momenten (`npm run seed:sql` maakt die opnieuw uit `src/seed.ts`).
- De automatische digest: een pg_cron-taak `eiwitshift-digest` draait elk uur op dag 1 tot 7. Ze roept `digest` aan met `{"auto": true}` wanneer `digest_settings.auto_send` aanstaat; de regel zelf staat in `src/lib/digestSchedule.ts`. Elke verzending komt in `digest_runs`.
- `supabase/functions/`: `notify` (meldingen mailen), `digest` (digest versturen), `feed` (agenda-feed) en `read-link` (Plak een link: pagina ophalen, lezen, optioneel AI via `_shared/ai.ts`). Ze hergebruiken de e-mail- en ICS-code uit `src/lib/` via `scripts/sync-shared.mjs`.
- `supabase/templates/login-code.html`: het e-mailsjabloon voor de inlogcode.
- `.env.live`: `VITE_SUPABASE_URL` en `VITE_SUPABASE_ANON_KEY` van het project.
- Supabase-geheimen (functies): `BREVO_API_KEY`, `SENDER_EMAIL`, `SENDER_NAME`, `APP_URL`.

## Voor wie verder wil bouwen

Gemaakt met Vite, React, TypeScript en Tailwind. De code en het commentaar zijn in het Engels.

```bash
npm install
npm run dev     # ontwikkelserver op http://localhost:5180 (prototype)
npm run build   # maakt Eiwitshift-kalender-prototype.html (één bestand, zonder Supabase-code)
```

- `src/seed.ts`: demodata
- `src/store.tsx`: status, localStorage en het maken van meldingen (prototype), gedeelde context
- `src/liveStore.tsx` + `src/data/`: dezelfde acties, maar via Supabase (testversie)
- `src/lib/`: datums, filters, controle op dubbele momenten, .ics/.csv, e-mails, gesimuleerde AI
- `src/components/`: de schermen
