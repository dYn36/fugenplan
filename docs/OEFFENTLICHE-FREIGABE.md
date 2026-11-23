# Vorbereitung für ein öffentliches Repository

Die Inhaltsprüfung stammt vom 29. Oktober 2026. Die Prüfung der Merge-Rechte stammt vom 23. November 2026.

## Geprüfte Inhalte

- Gitleaks hat die gesamte vorhandene Git-Historie geprüft, nicht nur den aktuellen Stand. Die Prüfung meldete keine Zugangsdaten.
- Die versionierten Textdateien und historischen Textobjekte wurden auf persönliche Dateipfade, private Grundrissnamen und die im Arbeitskontext bekannten privaten Angaben geprüft. Es gab keine Treffer.
- Die 92 versionierten Bilder und zwölf ältere Bildfassungen aus der Historie wurden als Kontaktbögen gesichtet. Bei der älteren GIF-Fassung wurden Anfang, Mitte und Ende geprüft. Die Bilder zeigen Beispielräume und synthetische Grundrisse. Die einzige versionierte PDF wird aus `tests/fixtures/create-floorplan-fixture.mjs` erzeugt; auch die Historie enthält nur diesen PDF-Inhalt. Die Historie enthält keine inzwischen entfernten PDF- oder Bildpfade.
- Git-Commits verwenden die GitHub-Noreply-Adresse des Repository-Eigentümers.
- Persönliche Projektdateien, PDFs, lokale Diagnoseberichte, `.env`-Dateien und `.netlify/` sind ausgeschlossen. Die lokalen Wiederherstellungsdateien sind nicht Teil des Repositorys und nicht Teil von `dist/`.
- README, Anleitung, Sicherheitsregeln, Hinweise zur Mitarbeit und ein Fehlerformular sind vorhanden. Dependabot prüft npm und GitHub Actions.
- Lizenztexte der ausgelieferten Bibliotheken werden mit dem Build veröffentlicht. Ergänzende Texte stehen in `public/licenses/`.

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

Prüfe vor der Veröffentlichung die Dateien und Commits, die seit der Inhaltsprüfung vom 29. Oktober 2026 hinzugekommen sind.

```sh
git status --short
git diff --cached
gitleaks git --redact --no-banner .
npm audit
npm run check
```

Neue Screenshots vollständig ansehen. Ein Dateiname oder ein bestandener Secret-Scan allein belegt nicht, dass ein Bild keine persönlichen Angaben enthält. Ein vollständiger Ausschluss unbekannter Geheimnisse lässt sich aus automatischen Suchregeln nicht ableiten.

Build- und Testberichte stehen unter `test-results/` und bleiben lokal. Der zuletzt geprüfte Veröffentlichungsstand wird in [NETLIFY-PRUEFUNG.md](NETLIFY-PRUEFUNG.md) dokumentiert.
