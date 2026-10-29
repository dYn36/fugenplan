# Vorbereitung für ein öffentliches Repository

Stand: 29. Oktober 2026. Die Sichtbarkeit des GitHub-Repositorys bleibt privat. Die Veröffentlichung der Webanwendung auf Netlify ändert diese Einstellung nicht.

## Geprüfte Inhalte

- Gitleaks hat die gesamte vorhandene Git-Historie geprüft, nicht nur den aktuellen Stand. Die Prüfung meldete keine Zugangsdaten.
- Die versionierten Textdateien und historischen Textobjekte wurden auf persönliche Dateipfade, private Grundrissnamen und die im Arbeitskontext bekannten privaten Angaben geprüft. Es gab keine Treffer.
- Die 92 versionierten Bilder wurden als Kontaktbögen gesichtet. Sie zeigen Beispielräume und synthetische Grundrisse. Die einzige versionierte PDF wird aus `tests/fixtures/create-floorplan-fixture.mjs` erzeugt. Die Historie enthält keine inzwischen entfernten PDF- oder Bildpfade.
- Git-Commits verwenden die GitHub-Noreply-Adresse des Repository-Eigentümers.
- Persönliche Projektdateien, PDFs, lokale Diagnoseberichte, `.env`-Dateien und `.netlify/` sind ausgeschlossen. Die lokalen Wiederherstellungsdateien sind nicht Teil des Repositorys und nicht Teil von `dist/`.
- README, Anleitung, Sicherheitsregeln, Hinweise zur Mitarbeit und ein Fehlerformular sind vorhanden. Dependabot prüft npm und GitHub Actions.
- Lizenztexte der ausgelieferten Bibliotheken werden mit dem Build veröffentlicht. Ergänzende Texte stehen in `public/licenses/`.

## Lizenz des eigenen Codes

Es wurde keine neue Nutzungslizenz vergeben. `package.json` bleibt bei `UNLICENSED` und `private: true`. Der Eigentümer kann die Sichtbarkeit selbst ändern und unabhängig davon über eine Open-Source-Lizenz entscheiden. Die [GitHub-Dokumentation zur Lizenzierung](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository) erläutert diese Unterscheidung.

`private: true` verhindert eine versehentliche npm-Veröffentlichung. Es verhindert keine Änderung der GitHub-Sichtbarkeit.

## Prüfung vor einer späteren Freigabe

Seit diesem Stand neu hinzugefügte Dateien und Commits erneut prüfen:

```sh
git status --short
git diff --cached
gitleaks git --redact --no-banner .
npm audit
npm run check
```

Neue Screenshots vollständig ansehen. Ein Dateiname oder ein bestandener Secret-Scan allein belegt nicht, dass ein Bild keine persönlichen Angaben enthält. Ein vollständiger Ausschluss unbekannter Geheimnisse lässt sich aus automatischen Suchregeln nicht ableiten.

Build- und Testberichte stehen unter `test-results/` und bleiben lokal. Der zuletzt geprüfte Veröffentlichungsstand wird in [NETLIFY-PRUEFUNG.md](NETLIFY-PRUEFUNG.md) dokumentiert.
