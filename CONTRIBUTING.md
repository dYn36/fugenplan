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
npx playwright install chromium webkit
npm run test:e2e:all
```

Die Browser-Tests verwenden eigene Kontexte. Die Tests zur PDF-Speicherung starten außerdem einen eigenen Browserprozess mit einem temporären Profil. Verwende dafür niemals dein persönliches Browserprofil.

Bei Änderungen an Import, Speicherung oder Export ergänze einen Test, der bestehende Projektdaten prüft. Neue Geometrieregeln brauchen einen unabhängig nachvollziehbaren Erwartungswert. Eine erfolgreiche Bildschirmaufnahme allein belegt keine korrekte Berechnung.

Automatisch erzeugte Testbilder sind keine geplanten Änderungen der Dokumentation. Prüfe vor einem Commit `git diff` und `git status`. Aktualisiere README-Bilder nur mit geprüften Beispieldaten.

## Änderungen veröffentlichen

Netlify-Vorschauen dienen zur Prüfung. Produktionsversionen werden ausdrücklich veröffentlicht; ein gewöhnlicher Push auf `main` reicht dafür nicht. Siehe [Deployment und Betrieb](docs/DEPLOYMENT.md).

Sicherheitsprobleme sind in [SECURITY.md](SECURITY.md) beschrieben. Für den eigenen Quellcode besteht noch keine Open-Source-Lizenz. Kläre größere Beiträge mit dem Repository-Eigentümer, bevor du sie vorbereitest.
