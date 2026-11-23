# An Fugenplan arbeiten

Coding-Agenten finden die zuständigen Quelldateien und passende Prüfdaten in der [Arbeitsanleitung für Agenten](AGENTS.md).

## Lokal starten

Verwende Node.js 24 und npm. Führe diese Befehle im Projektordner aus. [Node-Version](.nvmrc) · [npm-Skripte](package.json)

```sh
npm ci
npm run dev
```

## Issues eröffnen

Beim Absenden vergibt GitHub das Label passend zum Formular. Fehlermeldungen erhalten `bug`, Verbesserungsvorschläge `enhancement` und Fragen `question`. [Formular auswählen](https://github.com/dYn36/fugenplan/issues/new/choose)

### Fehler melden

Beschreibe die Schritte, das erwartete und das tatsächliche Ergebnis. Nenne Browser, Bildschirmgröße und die verwendete Version oder Webadresse. Verwende einen synthetischen Grundriss. Melde Sicherheitsprobleme privat an den Inhaber. [Fehlerformular](.github/ISSUE_TEMPLATE/fehler.yml) · [Umgang mit privaten Daten](SECURITY.md)

## Pull Request einreichen

1. Besprich größere Änderungen vorab mit dem Inhaber. Arbeite auf einem eigenen Branch. Externe Beiträge kommen über einen Fork. [GitHub-Anleitung für Beiträge aus einem Fork](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)
2. Öffne einen Pull Request mit Ziel `dYn36/fugenplan:main`. Beschreibe in der [PR-Vorlage](.github/pull_request_template.md) das Problem und die Wirkung der Änderung. Verlinke das zugehörige Issue, falls es eines gibt. Zeige Änderungen an der Oberfläche bei Bedarf mit synthetischen Beispieldaten.
3. Nenne die ausgeführten Prüfungen und ihre Ergebnisse. Kennzeichne offene Prüfungen und Auswirkungen auf vorhandene Projekte. Für Beiträge mit Coding-Agenten gelten dieselben Kriterien.

Der Workflow prüft die drei Abschnitte der Beschreibung, sobald dein Pull Request zur Prüfung bereit ist. Du kannst fehlende Angaben direkt im PR-Text ergänzen. Jede Bearbeitung löst die Prüfung erneut aus. Für reine Dokumentation genügt zum Beispiel der Hinweis, welchen Link du geöffnet hast und ob das Ziel stimmt. Dependabot verwendet seine eigene Beschreibung. [Workflow für die PR-Beschreibung](.github/workflows/pr-beschreibung.yml)

Für die folgenden Dateien prüft GitHub zusätzlich, ob die passende Zwischenüberschrift einen Eintrag enthält. Betrifft deine Änderung in diesen Dateien weder Rechenweg noch Bestandsdaten, genügt darunter eine kurze Begründung.

- Bei Änderungen an Geometrieberechnung oder PDF-Kalibrierung gehört unter `### Rechenbeispiel` ein Vergleich mit Einheiten. Fünf Fliesen zu je 600 mm und vier Fugen zu je 3 mm ergeben beispielsweise 3.012 mm. Vergleiche deinen Sollwert mit dem Ergebnis der Anwendung. [Geometrie](src/lib/geometry.ts) · [Kalibrierung](src/lib/calibration.ts)
- Bei Änderungen an Projektdateien oder am PDF-Speicher beschreibe unter `### Bestandsdaten`, welchen älteren, synthetischen Projektstand du geprüft hast und was erhalten blieb. Bei einem geänderten Import beschreibe auch, was nach einer fehlerhaften Datei mit dem geöffneten Projekt passiert. [Gebäudedateien](src/lib/library-file.ts) · [Raumprojekte](src/lib/workspace-file.ts) · [PDF-Speicher](src/lib/pdf-storage.ts)

Der Repository-Inhaber `@dYn36` prüft Beiträge und führt den Merge nach `main` durch. Die technischen Einstellungen dazu stehen in der [Vorbereitung für die öffentliche Freigabe](docs/OEFFENTLICHE-FREIGABE.md#merge-rechte-für-main).

## Änderungen prüfen

Für reine Dokumentation prüfe die relativen Links, Sprungziele und die Darstellung geänderter Bilder. Gleiche Aussagen zu Befehlen mit den [npm-Skripten](package.json) ab. Für Änderungen am Anwendungscode verwende die folgenden Befehle.

```sh
npm run check
npx playwright install --only-shell chromium
npm run test:e2e:smoke
```

Der [automatische GitHub-Workflow](.github/workflows/checks.yml) führt `npm audit --audit-level=moderate`, Fachtests, TypeScript-Prüfung, Produktionsbuild und acht wichtige Browserabläufe in Chromium aus. Diese prüfen Maße, PDF-Import und Maßstab, neue Etagen, dauerhafte PDF-Speicherung, Export und mobile Bedienung. Die Kennzeichnung `@smoke` wählt bestehende Tests aus. Ergänze sie nur für einen wichtigen Ablauf oder einen belegten Fehler, der in dieser Auswahl noch nicht abgedeckt ist.

Die Prüfung läuft bei Pushes auf `main` und bei Pull Requests nach `main`. Der Workflow überspringt reine Dokumentations- und Screenshotänderungen. Ein Push auf `netlify-preview` löst keinen zusätzlichen Push-Lauf aus. Ein neuer Lauf für denselben Git-Ref bricht den vorigen ab. Für automatische Testwiederholungen ist `retries: 0` gesetzt. GitHub bewahrt Fehlerberichte sieben Tage auf. [Playwright-Konfiguration](playwright.config.ts)

Bei jedem Push auf `main` und jedem Pull Request nach `main` prüft Lychee die lokalen Links, Sprungziele und Bildpfade in den versionierten `.md`-Dateien. So fällt auch auf, wenn ein Screenshot oder eine verlinkte Quelldatei verschoben wird. Gitleaks prüft im selben Lauf die Git-Historie des getesteten Stands auf Zugangsdaten. Für ein Update eines der beiden Werkzeuge ändere die Versionsnummer und den SHA-256-Digest seines Container-Images. [Workflow für Zugangsdaten und Doku-Links](.github/workflows/repository.yml)

Für Änderungen an PDF-Verarbeitung, Speicherung, Browserkompatibilität oder größeren Bedienabläufen prüfe zusätzlich die betroffenen Tests in Chromium und WebKit. Vor einer Veröffentlichung läuft die vollständige Sammlung gegen die Netlify-Vorschau. Mit diesen Befehlen führst du sie lokal aus. [Deployment und Betrieb](docs/DEPLOYMENT.md)

```sh
npx playwright install --only-shell chromium webkit
npm run test:e2e:all
```

Auf GitHub startet **Actions → Vollständige Browserprüfung (manuell) → Run workflow** die gesamte Browserprüfung in Chromium und WebKit. [Manueller Workflow](.github/workflows/browser-full.yml)

Die Browser-Tests verwenden eigene Kontexte. Die Tests zur PDF-Speicherung starten außerdem einen eigenen Browserprozess mit einem temporären Profil. Verwende dafür niemals dein persönliches Browserprofil.

Bei Änderungen an Import, Speicherung oder Export ergänze einen Test, der bestehende Projektdaten prüft. Neue Geometrieregeln brauchen einen unabhängig nachvollziehbaren Erwartungswert. Eine erfolgreiche Bildschirmaufnahme allein belegt keine korrekte Berechnung.

Automatisch erzeugte Testbilder sind keine geplanten Änderungen der Dokumentation. Prüfe vor einem Commit `git diff` und `git status`. Aktualisiere README-Bilder nur mit geprüften Beispieldaten.

## Änderungen veröffentlichen

Für eine geplante Veröffentlichung prüfe zuerst die Netlify-Vorschau. Der Produktions-Deploy übernimmt denselben geprüften Build in einem eigenen Schritt. [Deployment und Betrieb](docs/DEPLOYMENT.md)

Der eigene Quellcode trägt in `package.json` den Lizenzstatus `UNLICENSED`. [Projektstatus und Lizenz](README.md#projektstatus-und-lizenz)
