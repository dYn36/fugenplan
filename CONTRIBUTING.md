# An Fugenplan arbeiten

Installiere Node.js 24 und die festgeschriebenen Abhängigkeiten:

```sh
npm ci
npm run dev
```

Beschreibe bei einem Fehler den Ablauf, das erwartete Ergebnis, den Browser und die Bildschirmgröße. Verwende einen synthetischen Grundriss. Persönliche Pläne, Projektdateien und Zugangsdaten gehören nicht in Issues, Pull Requests oder Testberichte.

## Änderungen prüfen

```sh
npm run check
npx playwright install --only-shell chromium
npm run test:e2e:smoke
```

Die automatische GitHub-Prüfung nutzt einen Job: Abhängigkeiten auf bekannte Schwachstellen prüfen, Fachtests, TypeScript, Produktionsbuild und acht wichtige Browserabläufe in Chromium. Diese prüfen Maße, PDF-Import und Maßstab, neue Etagen, dauerhafte PDF-Speicherung, Export und mobile Bedienung. Die Kennzeichnung `@smoke` wählt bestehende Tests aus. Ergänze sie nur für einen wichtigen Ablauf oder einen belegten Fehler, der in dieser Auswahl noch nicht abgedeckt ist.

Die Prüfung läuft bei Push auf `main` und bei Pull Requests nach `main`. Reine Dokumentations- und Screenshotänderungen sowie zusätzliche Pushes auf `netlify-preview` starten keine zweite Prüfung. Ein neuer Lauf desselben Branches bricht den überholten Lauf ab. Fehler bleiben Fehler; automatische Wiederholungen sind ausgeschaltet. Fehlerberichte bleiben sieben Tage verfügbar.

Für Änderungen an PDF-Verarbeitung, Speicherung, Browserkompatibilität oder größeren Bedienabläufen prüfe zusätzlich die betroffenen Tests in Chromium und WebKit. Vor einer Veröffentlichung läuft die vollständige Sammlung gegen die Netlify-Vorschau gemäß [Deployment und Betrieb](docs/DEPLOYMENT.md). Lokal:

```sh
npx playwright install --only-shell chromium webkit
npm run test:e2e:all
```

In GitHub lässt sich dafür unter **Actions → Vollständige Browserprüfung (manuell) → Run workflow** ein eigener Lauf starten. Dieser Workflow hat keinen Zeitplan und keinen automatischen Push-Auslöser. Die vollständige Sammlung bleibt erhalten.

Die Browser-Tests verwenden eigene Kontexte. Die Tests zur PDF-Speicherung starten außerdem einen eigenen Browserprozess mit einem temporären Profil. Verwende dafür niemals dein persönliches Browserprofil.

Bei Änderungen an Import, Speicherung oder Export ergänze einen Test, der bestehende Projektdaten prüft. Neue Geometrieregeln brauchen einen unabhängig nachvollziehbaren Erwartungswert. Eine erfolgreiche Bildschirmaufnahme allein belegt keine korrekte Berechnung.

Automatisch erzeugte Testbilder sind keine geplanten Änderungen der Dokumentation. Prüfe vor einem Commit `git diff` und `git status`. Aktualisiere README-Bilder nur mit geprüften Beispieldaten.

## Änderungen veröffentlichen

Netlify-Vorschauen dienen zur Prüfung. Produktionsversionen werden ausdrücklich veröffentlicht; ein gewöhnlicher Push auf `main` reicht dafür nicht. Siehe [Deployment und Betrieb](docs/DEPLOYMENT.md).

Sicherheitsprobleme sind in [SECURITY.md](SECURITY.md) beschrieben. Für den eigenen Quellcode besteht noch keine Open-Source-Lizenz. Kläre größere Beiträge mit dem Repository-Eigentümer, bevor du sie vorbereitest.
