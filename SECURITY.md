# Zugangsdaten und private Pläne

Fugenplan benötigt keine Zugangsdaten, API-Schlüssel oder `.env`-Datei. Die Anmeldung für GitHub gehört in den Credential Manager oder in die GitHub CLI, nicht in Quellcode oder Remote-URLs.

- Eigene PDF-Grundrisse und exportierte Projektdateien außerhalb des Repositorys aufbewahren.
- Keine Tokens, Passwörter, privaten Schlüssel, Sitzungsdaten oder persönlichen Pläne in Issues, Screenshots oder Logs veröffentlichen.
- Vor einem Push `git diff --cached` und `git status --short` prüfen. `.gitignore` verhindert nicht das Hochladen bereits versionierter Dateien oder ein erzwungenes `git add -f`.
- Prüfe vor einem Push bei Bedarf alle lokalen Git-Referenzen mit `gitleaks git --log-opts="--all --full-history --diff-merges=first-parent" --redact --ignore-gitleaks-allow --no-banner .`. [Gitleaks](https://github.com/gitleaks/gitleaks)
- Bei einem möglichen Leak den Push stoppen. Betroffene Zugangsdaten widerrufen oder ersetzen. Das Entfernen aus der aktuellen Datei entfernt sie nicht aus der Git-Historie.

Die mitgelieferte Prüf-PDF wird durch `tests/fixtures/create-floorplan-fixture.mjs` erzeugt. Sie enthält ausschließlich synthetische Räume. Nur geprüfte Beispielbilder gehören in die Dokumentation.

Die Gitleaks-Konfiguration verwendet die Standardregeln. Eine eng begrenzte Ausnahme betrifft ausschließlich den festen localStorage-Namen für Varianten in `src/lib/project.ts`. Dieser Name ist kein Zugangsschlüssel. Die Ausnahme gilt nicht für andere Werte oder Dateien. Das Format folgt der [Gitleaks-Dokumentation](https://github.com/gitleaks/gitleaks#configuration).

GitHub Actions prüft bei Pushes auf `main` und Pull Requests nach `main` alle vom getesteten Commit erreichbaren Commits. Das erfasst auch Zugangsdaten, die ein späterer Commit wieder entfernt hat. Bei einem Treffer schlägt die Prüfung fehl. Das Protokoll zeigt die Anzahl der Treffer. [Workflow für die Git-Historie](.github/workflows/repository.yml)

Ein möglicher Sicherheitsfehler kann dem Repository-Eigentümer zunächst privat gemeldet werden. Keine echten Zugangsdaten oder privaten Grundrisse als Fehlerbeispiel übermitteln.

## Gehostete Anwendung

Netlify veröffentlicht nur `dist/`. Quellcode, Testdaten, lokale Sicherungen und Git-Metadaten gehören nicht in diesen Ordner. Sicherheitsheader und Cache-Regeln stehen in `netlify.toml`; die Tests unter `tests/hosting.e2e.spec.ts` prüfen ihre Wirkung auf einem echten HTTPS-Deploy.

Importe werden gegen ein begrenztes Datenmodell geprüft. Projektdateien dürfen höchstens 128 MiB enthalten, eingebettete PDFs zusammen 80 MiB und einzelne PDFs 20 MiB. Dateiinhalte und Namen gelten als nicht vertrauenswürdig. PDF.js begrenzt einzelne Rasterbilder bei der Anzeige auf 64 Megapixel. Fugenplan prüft eingebettete PDFs vor dem Speichern und schreibt alle Originale eines Projektimports in einer IndexedDB-Transaktion. React rendert Namen als Text; der SVG-Export maskiert Sonderzeichen. Die Anwendung führt kein JavaScript aus PDF-Dateien aus.

`npm audit` prüft bekannte Meldungen zu Abhängigkeiten. Dependabot ist für npm und GitHub Actions eingerichtet. Diese Prüfungen ersetzen keine Codeprüfung und belegen keine vollständige Fehlerfreiheit.

Für Veröffentlichungen gilt der Ablauf in [Deployment und Betrieb](docs/DEPLOYMENT.md). Produktions-Deploys werden ausdrücklich gestartet; die Vorschau muss zuvor geprüft sein.
