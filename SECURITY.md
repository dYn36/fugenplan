# Zugangsdaten und private Pläne

Fugenplan benötigt keine Zugangsdaten, API-Schlüssel oder `.env`-Datei. Die Anmeldung für GitHub gehört in den Credential Manager oder in die GitHub CLI, nicht in Quellcode oder Remote-URLs.

- Eigene PDF-Grundrisse und exportierte Projektdateien außerhalb des Repositorys aufbewahren.
- Keine Tokens, Passwörter, privaten Schlüssel, Sitzungsdaten oder persönlichen Pläne in Issues, Screenshots oder Logs veröffentlichen.
- Vor einem Push `git diff --cached` und `git status --short` prüfen. `.gitignore` verhindert nicht das Hochladen bereits versionierter Dateien oder ein erzwungenes `git add -f`.
- Mit installiertem [Gitleaks](https://github.com/gitleaks/gitleaks) lässt sich die Git-Historie lokal prüfen: `gitleaks git --redact --no-banner .`.
- Bei einem möglichen Leak den Push stoppen. Betroffene Zugangsdaten widerrufen oder ersetzen. Das Entfernen aus der aktuellen Datei entfernt sie nicht aus der Git-Historie.

Die mitgelieferte Prüf-PDF wird durch `tests/fixtures/create-floorplan-fixture.mjs` erzeugt. Sie enthält ausschließlich synthetische Räume. Nur geprüfte Beispielbilder gehören in die Dokumentation.

Die Gitleaks-Konfiguration verwendet die Standardregeln. Eine eng begrenzte Ausnahme betrifft ausschließlich den festen localStorage-Namen für Varianten in `src/lib/project.ts`. Dieser Name ist kein Zugangsschlüssel. Die Ausnahme gilt nicht für andere Werte oder Dateien. Das Format folgt der [Gitleaks-Dokumentation](https://github.com/gitleaks/gitleaks#configuration).

Ein möglicher Sicherheitsfehler kann dem Repository-Eigentümer zunächst privat gemeldet werden. Keine echten Zugangsdaten oder privaten Grundrisse als Fehlerbeispiel übermitteln.

## Gehostete Anwendung

Netlify veröffentlicht nur `dist/`. Quellcode, Testdaten, lokale Sicherungen und Git-Metadaten gehören nicht in diesen Ordner. Sicherheitsheader und Cache-Regeln stehen in `netlify.toml`; die Tests unter `tests/hosting.e2e.spec.ts` prüfen ihre Wirkung auf einem echten HTTPS-Deploy.

Importe werden gegen ein begrenztes Datenmodell geprüft. Projektdateien dürfen höchstens 128 MiB enthalten, eingebettete PDFs zusammen 80 MiB und einzelne PDFs 20 MiB. Dateiinhalte und Namen sind untrusted input. React rendert Namen als Text; der SVG-Export maskiert Sonderzeichen. Die Anwendung führt kein JavaScript aus PDF-Dateien aus.

`npm audit` prüft bekannte Meldungen zu Abhängigkeiten. Dependabot ist für npm und GitHub Actions eingerichtet. Diese Prüfungen ersetzen keine Codeprüfung und belegen keine vollständige Fehlerfreiheit.

Für Veröffentlichungen gilt der Ablauf in [Deployment und Betrieb](docs/DEPLOYMENT.md). Produktions-Deploys werden ausdrücklich gestartet; die Vorschau muss zuvor geprüft sein.
