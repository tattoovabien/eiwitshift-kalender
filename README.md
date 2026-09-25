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
   - Klik op het belletje en dan op de melding “Nieuwe reactie op jouw moment…”. Zo ziet de e-mail eruit die ProVeg zou krijgen.
5. **Coördinator: matches en digest (1 min)**
   - Demo-rol → *Coördinator (Omgeving)* → **Dashboard**.
   - *Matches*: momenten met 2 of meer reacties, met wie al in contact is. Toon *Breng in contact*.
   - *Digest-preview*: de maandelijkse nudge-mail met onderwerp, “komende 2 maanden”, “zoekt partners”, “populairste momenten” en “vul de agenda aan”. Klik op *Kopieer als tekst*.
   - Als er tijd over is: *Signalen* (bezorgdheden die enkel coördinatoren zien), *Velden beheren* (een nieuw veld verschijnt meteen in het formulier en de filters), *Export* (CSV) en het rss-icoon voor de agenda-feed.

## Wat zit erin

- **Overzicht** per maand, met zoeken, filters, *Nu bezig* en voorbije momenten (standaard verborgen).
- **Tijdlijn** van september 2026 tot december 2027.
- **Detailpaneel** met *Ik haak aan* en *Ik kan mee verspreiden*, “we zijn al in contact”, opmerkingen, *Signaleer bezorgdheid*, *Voeg toe aan agenda (.ics)* (downloadt echt) en *Kopieer halfhalf-zinnetje*.
- **Formulier** met *Plak een link* (gesimuleerde AI), een waarschuwing voor dubbele momenten en rechten: partners bewerken enkel hun eigen momenten, coördinatoren alles.
- **Meldingen** per rol, met een e-mailpreview.
- **Coördinator-dashboard** met Matches, Signalen, Velden beheren, Digest-preview en Export (CSV en .ics).
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
- **Echte e-mails**: bij een reactie of opmerking, bij een nieuwe toegangsaanvraag, en de digest via *Verstuur digest nu*.
- **Een echte, persoonlijke agenda-feed** voor Outlook en Google Agenda.
- **Nog gesimuleerd**: *Plak een link* (echte AI kost geld). De kennismakingsmail bij Matches kopieer je en verstuur je zelf.

### Waar draait wat (alles gratis)

| Onderdeel | Dienst | Opmerking |
|---|---|---|
| Database + login | Supabase, regio Frankfurt (EU) | Gratis project **pauzeert na 1 week zonder gebruik**: open dan het Supabase-dashboard en klik op *Restore*. |
| E-mails | Brevo (gratis, 300 per dag) | Vertrekt vanaf je Gmail-adres via Brevo (@brevosend.com). Test vooraf of mails niet in de spam belanden. In Brevo moet *Security → Authorized IPs → blokkeren van onbekende IP-adressen* uit staan, anders weigert Brevo de mails van Supabase. |
| Website | GitHub Pages | Publieke repository. Er staan geen geheimen in: de "anon key" is bedoeld om publiek te zijn, de toegangsregels zitten in de database. |

### Beheer

- **Voor een demo**: open het Supabase-dashboard (zodat het project niet gepauzeerd is) en zet de adressen van de gasten op de toegangslijst.
- **Iemand toegang geven**: *Dashboard → Toegang*. Dat kan met een exact adres of met een heel domein (bv. `@proveg.com`).
- **Na de test**: verwijder de testgebruikers in Supabase → *Authentication → Users*, of verwijder het hele project.

### Voor een ontwikkelaar

```bash
npm run test:db           # alle toegangsregels testen in een lokale Postgres (PGlite)
npm run dev:live          # ontwikkelserver tegen de echte database (.env.live nodig)
npm run functions:deploy  # e-mail-, digest- en feedfuncties naar Supabase
npm run deploy:site       # live-versie bouwen en op GitHub Pages zetten
```

- `supabase/migrations/`: tabellen, toegangsregels (Row Level Security), triggers voor meldingen, seed met de 25 momenten (`npm run seed:sql` maakt die opnieuw uit `src/seed.ts`).
- `supabase/functions/`: `notify` (meldingen mailen), `digest` (digest versturen) en `feed` (agenda-feed). Ze hergebruiken de e-mail- en ICS-code uit `src/lib/` via `scripts/sync-shared.mjs`.
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
