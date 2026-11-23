# Deployment und Betrieb

Die Webanwendung ist unter [fugenplan.netlify.app](https://fugenplan.netlify.app) erreichbar. Netlify liefert ausschließlich `dist/` aus. PDFs und Projektdateien werden im Browser verarbeitet und gespeichert.

## Version erhöhen und GitHub-Release veröffentlichen

1. Öffne **Actions → GitHub-Release → Run workflow**. Wähle `main` und den Versionssprung. Aus `1.0.0` wird mit **patch** die Version `1.0.1`, mit **minor** die Version `1.1.0` und mit **major** die Version `2.0.0`. [Release-Workflow](../.github/workflows/release.yml)
2. Öffne den Release-PR über den Link im Workflow-Lauf. Der PR aktualisiert `package.json` und `package-lock.json` und zeigt eine Vorschau der Release-Notizen. Ein weiterer Start aktualisiert denselben offenen PR. Zeigt GitHub **Approve workflows to run**, gib die Prüfungen frei und prüfe das Ergebnis. [GitHub zum Workflow-Token](https://docs.github.com/en/actions/concepts/security/github_token#when-github_token-triggers-workflow-runs)
3. Merge den Release-PR als `@dYn36` nach `main`. GitHub setzt den Tag `vX.Y.Z` auf den Merge-Stand und veröffentlicht das Release. [GitHub-Releases](https://github.com/dYn36/fugenplan/releases)

Unter **Was ist neu?** stehen Funktionen und Fehlerkorrekturen aus `feat`- und `fix`-Commits. Die Notizen verlinken die gemergten PRs und alle Commits seit dem letzten veröffentlichten stabilen Release auf `main`. Sie nennen die Mitwirkenden einschließlich der Mitautoren. Das erste Release umfasst die gesamte Historie bis zum Merge.

Bricht die Veröffentlichung nach dem Taggen ab, starte den fehlgeschlagenen Job erneut. Er prüft den Ziel-Commit und setzt die Veröffentlichung fort. Für die Veröffentlichung der Webanwendung auf Netlify gilt der folgende Ablauf.

## Vorschau vor Produktion

`netlify.toml` legt Node.js 24, `npm run check`, den Ausgabeordner und die HTTP-Header fest. `scripts/netlify-ignore.mjs` verhindert automatische Produktionsbuilds bei Git-Pushes. Ohne Vergleichsstand wird eine Vorschau gebaut. Reine Dokumentationsänderungen lösen keinen Netlify-Build aus.

Das GitHub-Repository `dYn36/fugenplan` ist mit Netlify verbunden. `main` ist der Produktionsbranch. Für Branch-Deploys ist `netlify-preview` freigegeben. Änderungen an der Anwendung auf diesem Vorschau-Branch werden gebaut. Reine Teständerungen prüft GitHub bei Push auf `main` oder in einem Pull Request nach `main`, ohne den unveränderten Web-Build erneut zu veröffentlichen. Ein zusätzlicher Push desselben Stands auf `netlify-preview` startet keine weitere GitHub-Prüfung. Die [Testauswahl](../CONTRIBUTING.md#änderungen-prüfen) unterscheidet den kurzen Standardlauf von der manuell startbaren vollständigen Browserprüfung.

Der Produktionsschutz ist absichtlich strenger als die Dateiprüfung: Auch ein geänderter Anwendungscode auf `main` veröffentlicht noch keine neue Version. Ein ausdrücklicher CLI-Deploy oder die Veröffentlichung eines geprüften Deploys im Netlify-Dashboard ist erforderlich.

Für einen neuen Rechner:

```sh
npm ci
npx netlify-cli@27.16.0 login
npx netlify-cli@27.16.0 link
```

Zuerst lokal prüfen und eine Vorschau hochladen:

```sh
npm run check
npx netlify-cli@27.16.0 deploy --no-build --alias candidate
```

Die CLI gibt die Vorschauadresse aus. Verwende für die Prüfung möglichst die unveränderliche Adresse des konkreten Deploys, damit ein späterer Vorschau-Upload den laufenden Test nicht verändert.

```sh
PLAYWRIGHT_BASE_URL=https://candidate--fugenplan.netlify.app npm run test:e2e:all
PLAYWRIGHT_BASE_URL=https://candidate--fugenplan.netlify.app npm run test:hosting
```

`test:e2e:all` prüft die Bedienabläufe in Chromium und WebKit. `test:hosting` prüft zusätzlich die tatsächlich ausgelieferten Sicherheitsheader, Cache-Regeln, fehlende Dateien, eingeschleusten HTML-Text und den PDF-Import unter CSP. Ein lokaler Vite-Server liefert die Netlify-Header nicht aus; deshalb verlangt dieser Test eine HTTPS-Adresse.

Nach bestandener Prüfung denselben Build ausdrücklich veröffentlichen:

```sh
npx netlify-cli@27.16.0 deploy --no-build --prod
PLAYWRIGHT_BASE_URL=https://fugenplan.netlify.app npm run test:hosting
```

Zwischen Prüfung und Veröffentlichung darf `dist/` nicht neu gebaut oder geändert werden. Alternativ lässt sich der geprüfte Deploy im Netlify-Dashboard direkt veröffentlichen. Danach den Deploystatus und die Produktionsadresse prüfen.

## Credits und Cache

Bei Netlifys Credit-Tarifen kostet ein erfolgreicher Produktions-Deploy derzeit 15 Credits. Vorschau- und Branch-Deploys kosten keine Deploy-Credits. Anfragen und übertragene Daten werden trotzdem berechnet. Die [Netlify-Dokumentation](https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/how-credits-work/) enthält die aktuellen Regeln.

- Normale Git-Pushes veröffentlichen keine Produktion.
- Dokumentationsänderungen benötigen keinen neuen Anwendungsbuild.
- React und die Geometriebibliotheken liegen in eigenen Dateien. Änderungen an der Oberfläche ändern diese Dateien nicht unnötig.
- Dateien unter `assets/` tragen Inhalts-Hashes. PDF.js-Zusatzdateien tragen die Paketversion im Pfad. Beide dürfen ein Jahr im Browsercache bleiben.
- HTML muss bei erneutem Aufruf geprüft werden. So erhält der Browser die aktuelle Dateiliste.
- PDF.js wird erst beim Öffnen einer PDF geladen. Alle Schriften und Decoder kommen vom selben Host.

## Fehler und Rückkehr zur vorigen Version

Prüfe in Netlify den fehlgeschlagenen Deploy und dessen Build-Log. Korrigiere den Fehler zuerst in einer Vorschau. Veröffentliche keine Folge von Produktionsversionen zum Ausprobieren.

Ein zuvor funktionierender Produktions-Deploy lässt sich im Dashboard wieder veröffentlichen. Netlify beschreibt diese Rückkehr als kostenfrei. Lokale Projektdaten gehören weiterhin zum Browser und zur Webadresse; ein Deployment setzt sie nicht zurück.

Die Netlify-Meldung „Canceled build due to no content change“ kennzeichnet einen absichtlich übersprungenen Build.

Beim ersten Verbinden des Repositorys wurde ein Produktionsbuild ausgelöst. Die nachfolgenden Git-Pushes wurden durch den Schutzbefehl beendet. Ein manuell gestarteter Build oder Build-Hook kann die normale Änderungserkennung umgehen; die [Netlify-Dokumentation zum Überspringen von Builds](https://docs.netlify.com/build/configure-builds/ignore-builds/) beschreibt diese Grenzen. Solche Auslöser nicht für Probeänderungen verwenden.

## Daten und Schutzregeln

Der Build enthält keinen Anwendungsserver, keine Funktionen und keine Zugangsdaten. Die CSP begrenzt Skripte, Verbindungen und Worker auf denselben Ursprung. WebAssembly ist für PDF-Decoder erlaubt. JavaScript-Auswertung mit `eval`, fremde Frames und Formularübertragungen sind gesperrt.

Eine begrenzte CSP-Ausnahme erlaubt Style-Attribute für berechnete Größen und Positionen beim Zoomen und Verschieben. WebKit blockiert diese Attribute sonst. Inline-Skripte und Inline-Stylesheets bleiben gesperrt. Bei einer späteren Umstellung dieser Layoutwerte auf SVG-Attribute ist die Ausnahme erneut zu prüfen und nach bestandenen Browser-Tests zu entfernen.

Es gibt keinen URL-Router. Unbekannte Pfade und fehlende Worker müssen mit HTTP 404 antworten. Ein pauschaler SPA-Fallback auf `index.html` würde solche Fehler verdecken und ist deshalb nicht eingerichtet.

Die lokale Adresse und die Netlify-Adresse haben getrennte Speicher. Für den Umzug: auf der bisherigen Adresse eine Projektdatei exportieren, auf der neuen Adresse öffnen und die Räume sowie Original-PDFs prüfen. Wichtige Projektdateien zusätzlich außerhalb des Browsers sichern.
