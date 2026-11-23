# Arbeitsanleitung für Coding-Agenten

Diese Anleitung gilt für das gesamte Fugenplan-Repository. Fugenplan ist eine React-Anwendung in TypeScript. Sie berechnet Verlegepläne im Browser. Die Oberfläche ist auf Deutsch. [Bedienungsanleitung](docs/ANLEITUNG.md)

Prüfe zuerst den Branch und vorhandene Änderungen mit `git status --short --branch`. Baue auf vorhandenen Änderungen auf. Nutze Node.js 24 und npm. Im Projektordner installiert `npm ci` die festgeschriebenen Pakete. `npm run dev` startet die lokale Anwendung. [Node-Version](.nvmrc) · [npm-Skripte](package.json)

## Wo du eine Änderung beginnst

| Bereich | Einstieg im Code | Woran du das Ergebnis prüfst |
| --- | --- | --- |
| Geometrie und Mengen | [Geometrie](src/lib/geometry.ts), [SVG- und CSV-Export](src/lib/export.ts) | Rechne intern in Millimetern. Leite den Sollwert unabhängig vom Code her. Eine Reihe aus fünf Elementen zu 600 mm und vier Fugen zu 3 mm misst 3.012 mm. [Fachliche Rechenregeln](docs/RECHERCHE.md#verbindliche-rechenregeln-der-umsetzung) · [Geometrietests](tests/geometry.test.ts) |
| PDF und Maßstab | [Grundriss-Assistent](src/components/FloorPlanEditor.tsx), [Kalibrierung](src/lib/calibration.ts) | Verwende die synthetische [Prüf-PDF](tests/fixtures/grundriss-drei-seiten.pdf) und vergleiche das Ergebnis mit den [Sollmaßen je Seite](tests/fixtures/grundriss-erwartungen.json). |
| Projekte und Speicherung | [Projektsammlung](src/lib/library.ts), [Projektdatei](src/lib/library-file.ts), [PDF-Speicher](src/lib/pdf-storage.ts) | Projekte liegen im lokalen Browserspeicher, Original-PDFs in IndexedDB. Prüfe bei Änderungen ältere Projektstände und den Erhalt vorhandener Daten nach einem fehlerhaften Import. [Speichertests](tests/pdf-storage.e2e.spec.ts) · [Importtests](tests/library.test.ts) |
| Oberfläche | [Anwendung](src/App.tsx), [Komponenten](src/components/) | Prüfe den geänderten Ablauf mit Tastatur und auf schmalem Bildschirm. [Bedienung](docs/ANLEITUNG.md#einen-boden-planen) · [Browserprüfungen](tests/project.e2e.spec.ts) |

## Prüfen und übergeben

- Wähle die Prüfungen passend zur Änderung. Für Anwendungscode sind `npm run check` und `npm run test:e2e:smoke` der Standard. Für reine Dokumentation prüfe die beschriebenen Befehle, Links und gegebenenfalls Bilder. [Testauswahl und Browserinstallation](CONTRIBUTING.md#änderungen-prüfen)
- Nutze synthetische Beispieldaten für Tests, Bilder und Fehlerberichte. Behalte persönliche Grundrisse, exportierte Projekte und Zugangsdaten außerhalb des Repositorys. [Sicherheitsregeln](SECURITY.md)
- Prüfe vor dem Commit den Diff. Erzeugte PDF.js-Dateien, Build-Ausgaben und lokale Testberichte bleiben außerhalb von Git. [Generierte Dateien](.gitignore) · [PDF.js-Buildskript](scripts/copy-pdf-assets.mjs)
- Pushe kleine Änderungen im Auftrag von `@dYn36` direkt auf `main`, solange das Repository privat ist. Das gilt zum Beispiel für Dokumentation und Vorlagen.
- Nenne im Pull Request die betroffenen Dateien oder Fachregeln, die ausgeführten Prüfungen mit Ergebnis und etwaige offene Punkte. Den Merge eines Pull Requests nach `main` führt `@dYn36` persönlich aus. Das gilt auch, wenn der Agent mit dem Konto des Inhabers arbeitet. [Ablauf für Beiträge](CONTRIBUTING.md#pull-request-einreichen)
