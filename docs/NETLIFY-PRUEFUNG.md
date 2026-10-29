# Veröffentlichung und Prüfung auf Netlify

Prüfdatum: 29. Oktober 2026.

## Veröffentlichter Stand

- Anwendung: [fugenplan.netlify.app](https://fugenplan.netlify.app).
- Quellstand der Anwendung: `3517443a1cdc354f83db54fe58cac9bd314e2330`.
- Produktions-Deploy: `6ae3a35c71fc1eacbf6f3c7f`, Status `ready`.
- Netlify-Cloud-Build: `6ae3a35c71fc1eacbf6f3c7d`, erfolgreich mit Node.js 24.22.2.
- Geprüfte Vorschau: `6ae3a1b7a80ce933fa7e67c4` unter `candidate-final--fugenplan.netlify.app`.

HTML, Hauptskript, React, Geometrie und Hauptstylesheet der Live-Adresse wurden heruntergeladen und Byte für Byte mit dem Vorschau-Build verglichen. Alle fünf Dateien und das HTML stimmen überein. Die späteren Testkorrekturen ändern den Anwendungscode nicht.

Beim Verbinden des privaten Repositorys führte Netlify den ersten Cloud-Build aus. Er veröffentlichte die bereits bereitgestellte Anwendung. Es wurde kein weiterer erfolgreicher Produktions-Deploy zum Ausprobieren erzeugt. Der folgende Push wurde mit der protokollierten Meldung „Automatischer Produktionsbuild übersprungen“ vor der Installation beendet.

## Ergebnisse

Die vollständige Browserprüfung lief gegen die Live-Adresse mit dem Teststand `52ffe808cf85cc658600cd264631e8e862161875`. Alle 144 Prüfungen bestanden in 263,3 Sekunden. Der Bericht meldet keine fehlgeschlagenen, übersprungenen oder instabilen Fälle und keine automatischen Wiederholungsversuche.

| Prüfung | Belegter Stand |
| --- | --- |
| Fachtests im Netlify-Cloud-Build | 234 von 234 bestanden, neun Testdateien. |
| TypeScript und Vite | Erfolgreich, kein Hinweis auf einen Hauptblock über 500 kB. |
| Vollständige Browsersammlung auf der Live-Adresse | 144 von 144 bestanden in Chromium und WebKit. |
| Hosting-Prüfung der Vorschau | 6 von 6 bestanden in Chromium und WebKit. |
| Hosting-Prüfung der Live-Adresse | 6 von 6 bestanden in Chromium und WebKit. |
| PDF-Speicherung auf der Live-Adresse in Microsoft Edge | 3 von 3 bestanden, einschließlich Browser-Neustart. |
| Wiederholung der Zeichenprüfung | 6 von 6 bestanden nach Korrektur der Speicher-Wartebedingung. |
| Wiederholung der Netzprüfungen | 12 von 12 bestanden nach Korrektur der Wartebedingung. |

Die Hosting-Prüfung kontrolliert die ausgelieferten Sicherheitsheader und Cache-Regeln. Sie prüft echte 404-Antworten für fehlende Dateien und den PDF-Import unter CSP. Ein importierter HTML-Angriffstext bleibt in Oberfläche, Druckdarstellung und SVG-Export Text. Der Versuch, über `__proto__` globale Objekte zu verändern, blieb ohne Wirkung.

Ein Aufruf über HTTP wird mit Status 301 auf HTTPS umgeleitet. Die Live-Startseite wurde zusätzlich im vorhandenen Microsoft Edge geöffnet und als Screenshot gesichert. Das vorhandene lokale Nutzerprojekt wurde bei diesen Prüfungen nicht verändert.

Die vollständige Browsersammlung umfasst PDF-Import, Maßstab, mehrere Etagen und Originaldateien, Raumkonturen, Verlegemuster, Zuschnitte, Export, Tastaturbedienung und mobile Ansichten. Die Speicherfälle beenden den Browserprozess und öffnen dasselbe getrennte Testprofil erneut. Die [PDF-Speicherprüfung](PDF-SPEICHER-PRUEFUNG.md) beschreibt den früheren Datenverlust und die weiterhin unbekannte historische Ursache.

## Gefundene Probleme und Änderungen

1. Eine kleine Schriftdatei war als Daten-URL eingebettet und wurde von der CSP blockiert. Vite schreibt jetzt alle Schriftdateien als eigene Assets. Die Schutzregel muss dafür keine Daten-URLs für Schriften erlauben.
2. WebKit blockierte berechnete Style-Attribute für Größen und Positionen. Die CSP erlaubt diese Attribute gezielt. Inline-Skripte und Inline-Stylesheets bleiben gesperrt. Die Ausnahme und ihre spätere Prüfung sind in [Deployment und Betrieb](DEPLOYMENT.md) beschrieben.
3. Ein Zeichentest las direkt nach dem Wechsel zu „Frei“ noch den vorherigen gespeicherten Modus. Er wartet jetzt auf den tatsächlichen Speicherinhalt, bevor er den Zustand für den Abbruchvergleich erfasst.
4. Zwei Netztests warteten trotz fertiger Darstellung auf `networkidle`. Die Traces zeigten einen noch offenen Eintrag für einen ersetzten Geometrie-Worker. Die Tests prüfen jetzt den berechneten Plan bzw. echte PDF-Pixel und warten auf die Schriften. Die Prüfung aller beobachteten Zieladressen bleibt bestehen. Dies entspricht der [Playwright-Empfehlung für Bereitschaftsprüfungen](https://playwright.dev/docs/api/class-page#page-wait-for-load-state).
5. Der Linux-Lauf zeigte denselben verfrühten Speicherzugriff beim Raumnamen, beim Paketinhalt und beim Startpunkt einer Variante. Die Tests warten nun auf diese konkreten Werte, bevor sie den Vergleichsstand erfassen oder eine ungültige Folgeeingabe prüfen. Chromium und WebKit laufen in GitHub als getrennte Jobs mit jeweils allen 72 Fällen.

Die Punkte 3 bis 5 waren Fehler in den Test-Wartebedingungen. Es wurden keine Wiederholungsversuche oder übersprungenen Fälle eingerichtet, um fehlgeschlagene Prüfungen zu verdecken.

## Sicherheitsprüfung und Repository

Die Prüfung umfasst Importgrenzen und Modellvalidierung, PDF-Verarbeitung, lokale Speicherung, Worker, SVG-Erzeugung und die HTML-Einbindung der Druckgrafik. Es gibt keinen Anwendungsserver und keine Anmeldung. Die PDF-Verarbeitung rendert Seiten; sie führt keine PDF-Skripte aus. Die Netztests beobachten HTTP- und WebSocket-Ziele während der geprüften Abläufe.

Gitleaks hat Git-Historie und fertigen Ausgabeordner getrennt geprüft und keine Zugangsdaten gemeldet. `npm audit` meldet null bekannte Schwachstellen. Der veröffentlichte Ordner enthält 225 Dateien mit zusammen 6.174.627 Bytes. Er enthält keine Quellkarten, privaten PDFs, Testordner, Git-Daten oder lokalen Sicherungen. Die dokumentierten Prüfungen belegen keine vollständige Fehlerfreiheit und keinen vollständigen Schutz vor unbekannten Angriffen.

Das GitHub-Repository bleibt privat. Die [Vorbereitung für eine öffentliche Freigabe](OEFFENTLICHE-FREIGABE.md) dokumentiert die Prüfung versionierter Texte, Historie und Beispielbilder. Eine Nutzungslizenz für den eigenen Code wurde nicht vergeben.

## README und Betrieb

Die README wurde mit `humanizer-de` im sachlichen Modus überarbeitet. Wiederholte Werbeslogans und pauschale Aussagen wurden durch konkrete Funktionen, Grenzen und Bedienhinweise ersetzt. Das Demo-GIF bleibt am Anfang. Die Funktionsübersicht nennt PDF-Grundriss, Raumkonturen, Etagen, Muster, Startpunkt, Zuschnitte, Materialbedarf und Varianten.

Der abschließende Stilbericht meldet vor allem kurze, ähnlich lange Sätze. Diese bleiben für die technische Anleitung erhalten. Hunspell und LanguageTool waren nicht verfügbar; eine bestandene automatische Rechtschreibprüfung wird deshalb nicht behauptet.

React und Geometriebibliotheken liegen in getrennten Dateien. Der Hauptblock sank von etwa 628 kB auf 242 kB; das ist keine entsprechende Verringerung der gesamten Downloadmenge. Der PDF-Editor wird bei Bedarf geladen. Statische Dateien mit Inhalts-Hash und versionierte PDF.js-Dateien erhalten lange Cache-Zeiten. HTML wird erneut validiert.

Die stündliche Build-Prüfung in Codex ist eingerichtet. Git-Pushes veröffentlichen keine neue Produktion. Die genaue Bedienung, der Umgang mit übersprungenen Builds und die getrennten Browserspeicher für lokale und gehostete Nutzung stehen in [DEPLOYMENT.md](DEPLOYMENT.md).

Lokale Rohberichte liegen unter `test-results/public-release/` und bleiben aus Git ausgeschlossen. Die GitHub-Prüfung bewahrt Browserberichte als `browser-pruefung-chromium` und `browser-pruefung-webkit` auf. Alle Browserfälle verwenden synthetische Daten und getrennte Testprofile.
