# An Fugenplan arbeiten

Coding-Agenten finden die zuständigen Quelldateien und passende Prüfdaten in der [Arbeitsanleitung für Agenten](AGENTS.md).

## Lokal starten

Verwende Node.js 24 und npm. Führe diese Befehle im Projektordner aus. [Node-Version](.nvmrc) · [npm-Skripte](package.json)

```sh
npm ci
npm run dev
```

## Fehler melden

Beschreibe die Schritte, das erwartete und das tatsächliche Ergebnis. Nenne Browser, Bildschirmgröße und die verwendete Version oder Webadresse. Verwende einen synthetischen Grundriss. Melde Sicherheitsprobleme privat an den Inhaber. [Fehlerformular](.github/ISSUE_TEMPLATE/fehler.yml) · [Umgang mit privaten Daten](SECURITY.md)

## Pull Request einreichen

1. Besprich größere Änderungen vorab mit dem Inhaber. Arbeite auf einem eigenen Branch. Externe Beiträge kommen über einen Fork. [GitHub-Anleitung für Beiträge aus einem Fork](https://docs.github.com/en/get-started/exploring-projects-on-github/contributing-to-a-project)
2. Öffne einen Pull Request mit Ziel `dYn36/fugenplan:main`. Beschreibe das Problem und die Wirkung der Änderung. Verlinke das zugehörige Issue, falls es eines gibt. Zeige Änderungen an der Oberfläche bei Bedarf mit synthetischen Beispieldaten.
3. Nenne die ausgeführten Prüfungen und ihre Ergebnisse. Kennzeichne offene Prüfungen und Auswirkungen auf vorhandene Projekte. Für Beiträge mit Coding-Agenten gelten dieselben Kriterien.

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
