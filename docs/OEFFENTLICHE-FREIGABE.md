# Vorbereitung für ein öffentliches Repository

Die Prüfung vom 23. November 2026 begann mit dem [Quellstand 932fa34](https://github.com/dYn36/fugenplan/commit/932fa34dbaa8ad7242429c5ff4b04a01062a5028). Der nächste Commit enthält die [Korrekturen am Import](https://github.com/dYn36/fugenplan/commit/d799d926a4371c0d220700d38f8e948983aa9bc3).

## Ergebnisse der Inhaltsprüfung

| Bereich | Geprüfter Umfang und Ergebnis |
| --- | --- |
| Git und Zugangsdaten | Gitleaks 8.30.1 prüfte die 28 am Anfang erreichbaren Commits aus vier GitHub-Branches und vier PR-Ständen einschließlich der Merge-Änderungen. Die ergänzende Suche in historischen Texten erfasste auch Passwortzuweisungen, persönliche Dateipfade, Adressen und URLs mit Zugangsdaten. Es gab keinen bestätigten Fund. Die Autor- und Committer-Adressen gehörten zu GitHub-Noreply-Konten. |
| GitHub-Inhalte | Geprüft wurden die vier PR-Beschreibungen, drei Kommentare, die Commit-Nachrichten und alle 33 zu diesem Zeitpunkt abrufbaren Actions-Protokolle. Gitleaks meldete keine Zugangsdaten. GitHub führte keine Release-Dateien oder Testartefakte. |
| Bilder und PDF | Die Historie enthielt 102 unterschiedliche JPG- und PNG-Dateiinhalte sowie zwei GIF-Fassungen. Alle Standbilder und fünf Ansichten je GIF wurden als Kontaktbögen gesichtet. Zusätzlich lief eine lokale Texterkennung über alle Standbilder und alle 763 GIF-Einzelbilder. Die Sichtung zeigte Beispielräume. Es gab keine Hinweise auf private Anschriften oder Zugangsdaten. Die einzige Prüf-PDF hat drei Seiten. Der [Generator](../tests/fixtures/create-floorplan-fixture.mjs) reproduzierte die Datei mit Node.js 26.9.0 bytegenau. Mit Node.js 24.22.3 stimmten Text, Seitenbilder und Sollmaße überein. |
| Abhängigkeiten | Alle 120 Paketpositionen der Lockdatei verwendeten das npm-Register und enthielten einen Integritätswert. `npm audit` meldete keine bekannten Schwachstellen. Die Dependabot-Sicherheitsmeldungen für dieses Repository sind aktiviert. |
| Anwendung und Hosting | Geprüft wurden Projekt- und PDF-Import, IndexedDB, CSV- und SVG-Ausgabe, Druckdarstellung und Workflow-Berechtigungen. Der Produktionsbuild mit Node.js 24 enthielt 227 Dateien. Die Prüfung fand darin keine Zugangsdaten, Source Maps, Testdaten oder privaten Pläne. Die Lizenzdateien lagen bei. Die öffentliche Startseite lieferte alle sechs in der [Netlify-Konfiguration](../netlify.toml) gesetzten Sicherheitsheader. |

## Korrekturen am Import

- Beim Öffnen alter Einzelraumdateien gilt dieselbe Konturprüfung wie bei neueren Projekten. Gültige ältere Dateien bleiben lesbar.
- PDF.js begrenzt jedes eingebettete Rasterbild bei der Anzeige auf 64 Megapixel. Die Vorschau verwendet einen begrenzten Zeichenpuffer.
- Vor dem Speichern der zugehörigen PDFs prüft die Anwendung, ob die Sammlung Platz für das Projekt hat. Alle PDFs eines Projektimports werden gemeinsam geschrieben und vor Abschluss der Transaktion gelesen und verglichen. Ein Schreibfehler bricht die Transaktion ab. Ein Browsertest prüft den Fehler beim zweiten Original sowie den anschließenden erfolgreichen Import.

Die 235 Fachtests, die TypeScript-Prüfung und der Produktionsbuild bestanden mit Node.js 24.22.3. Anschließend bestanden alle 148 Browserfälle in Chromium und WebKit gegen den lokalen Produktionsbuild.

## Lizenz des eigenen Codes

Es wurde keine neue Nutzungslizenz vergeben. `package.json` bleibt bei `UNLICENSED` und `private: true`. Der Eigentümer kann die Sichtbarkeit selbst ändern und unabhängig davon über eine Open-Source-Lizenz entscheiden. Die [GitHub-Dokumentation zur Lizenzierung](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) erläutert diese Unterscheidung.

`private: true` verhindert eine versehentliche npm-Veröffentlichung. Es verhindert keine Änderung der GitHub-Sichtbarkeit.

## Merge-Rechte für `main`

Am 23. November 2026 meldete GitHub für `dYn36/fugenplan` ein privates Repository im persönlichen Konto `dYn36`. Die Liste der Mitarbeitenden enthielt nur `dYn36` mit der Rolle `admin`. Der Standardbranch `main` war ungeschützt. Die Ruleset-API verwies mit HTTP 403 auf GitHub Pro oder ein öffentliches Repository. Der Inhaber kann den aktuellen Stand mit den folgenden Leseabfragen prüfen. [Verfügbarkeit von Rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)

```sh
gh api repos/dYn36/fugenplan --jq '{owner: .owner.login, visibility, default_branch}'
gh api --paginate repos/dYn36/fugenplan/collaborators --jq '.[] | {login, role_name}'
gh api repos/dYn36/fugenplan/branches/main --jq .protected
```

Nach der Umstellung auf öffentlich können Außenstehende aus einem Fork einen Pull Request stellen. Zum Mergen brauchen sie Schreibzugriff auf das Zielrepository. Eine Action mit `github.actor` prüft, wer den Workflow ausgelöst hat. Die Person, die später den Merge ausführt, steht erst beim Aktualisieren des Zielbranches fest. [GitHub-Berechtigungen](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository) · [GitHub-Actions-Kontext](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#github-context)

Nach der Aktivierung darf nur `dYn36` den Branch `main` aktualisieren. Das Konto darf Pull Requests mergen und direkt auf `main` pushen. Für andere Zielbranches gelten die jeweiligen Repository-Berechtigungen und Branchregeln. [Ruleset-Vorlage](rulesets/main-owner.json) · [Regel für Branch-Aktualisierungen](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets#restrict-updates) · [Einzelne Benutzer als Ausnahme](https://github.blog/changelog/2026-05-07-repository-rulesets-user-bypass-and-branch-renaming/)

Ein persönliches Zugriffstoken handelt mit den erteilten Rechten seines Kontos. Nutzt ein Agent ein schreibberechtigtes Token von `dYn36`, erkennt GitHub denselben Benutzer. Deshalb übergibt der Agent den Merge an den Inhaber. [Agentenanleitung](../AGENTS.md#prüfen-und-übergeben) · [Persönliche Zugriffstoken](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens)

**Bei der öffentlichen Freigabe aktivieren und prüfen**

1. Öffne die [Ruleset-Einstellungen von Fugenplan](https://github.com/dYn36/fugenplan/settings/rules). Wähle **New ruleset → Import a ruleset** und lade die JSON-Vorlage. [Anleitung zum Import](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository#importing-a-ruleset)
2. Prüfe vor **Create** das Ziel `refs/heads/main`, die Regel **Restrict updates** und den Status **Active**. Die Ausnahmeliste soll genau den Benutzer `dYn36` mit **Always allow** enthalten. Die GitHub-Benutzer-ID in der Vorlage lässt sich mit `gh api users/dYn36 --jq .id` abgleichen.
3. Prüfe nach dem Speichern, dass GitHub für `main` die Regel `update` aus diesem Ruleset nennt. Öffne das gespeicherte Ruleset und kontrolliere die Ausnahmeliste erneut. Erst mit der Aktivierung in GitHub greift der Schutz.

```sh
gh api repos/dYn36/fugenplan/rules/branches/main --jq '.[] | select(.type == "update") | {ruleset_id, ruleset_source}'
```

## Prüfung vor einer späteren Freigabe

Prüfe vor der Veröffentlichung alle Änderungen seit dem oben angegebenen Stand. Beziehe neue Branches, Tags, Pull Requests und veröffentlichte Artefakte ein.

```sh
git status --short
git diff --cached
gitleaks git --log-opts="--all --full-history --diff-merges=first-parent" --redact --no-banner .
npm audit
npm run check
```

Prüfe nach dem Sichtbarkeitswechsel auch den Status von Secret Scanning und Push Protection in GitHub. [GitHub-Dokumentation zum Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning)

Neue Screenshots vollständig ansehen. Ein Dateiname oder ein bestandener Secret-Scan allein belegt nicht, dass ein Bild keine persönlichen Angaben enthält. Ein vollständiger Ausschluss unbekannter Geheimnisse lässt sich aus automatischen Suchregeln nicht ableiten.

Build- und Testberichte stehen unter `test-results/` und bleiben lokal. Der zuletzt geprüfte Veröffentlichungsstand wird in [NETLIFY-PRUEFUNG.md](NETLIFY-PRUEFUNG.md) dokumentiert.
