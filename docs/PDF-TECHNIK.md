# PDF-Grundrisse: Technik und Prüfnachweise

Stand: 25. Oktober 2026. Verwendet wird `pdfjs-dist` 6.4.299, siehe [package-lock.json](../package-lock.json). PDF.js steht unter Apache-2.0; seine Lizenz wird mit den lokalen Zusatzdateien kopiert.

## Koordinaten und Maßstab

Alle gespeicherten PDF-Punkte gehören zum natürlichen Seiten-Viewport aus `page.getViewport({ scale: 1 })`. Er berücksichtigt die Seitendrehung. Canvas und Kontur verwenden diesen gemeinsamen Bezug. Die PDF.js-Dokumentation beschreibt diese Transformation einschließlich des Ursprungs oben links im Canvas. [PDF.js-Beispiel](https://mozilla.github.io/pdf.js/examples/)

Die bekannte Wandlänge bestimmt den Faktor:

```text
mm je Viewport-Einheit = bekannte Länge in mm / Abstand der beiden Messpunkte
Raumpunkt in mm = (PDF-Punkt − PDF-Ursprung) × Faktor
PDF-Punkt = Raumpunkt in mm / Faktor + PDF-Ursprung
```

Der Ursprung ist zunächst die linke obere Grenze der markierten Raumkontur. Er bleibt bei späteren Änderungen erhalten. Die Wandmessung dreht den Raum nicht. Eine erneute Kalibrierung berechnet die Raumkontur aus ihren PDF-Punkten neu. Hindernisse werden mit dem Verhältnis der Faktoren skaliert. Produktmaße, Fugen, Reserve und Verlegeversatz bleiben unverändert. Ungültige oder nicht erneut importierbare Raummaße werden abgewiesen. Es gibt keine stille Begrenzung. Umsetzung: [calibration.ts](../src/lib/calibration.ts).

Ein Faktor gilt gleichmäßig für beide Achsen. Er korrigiert keine Verzerrung eines Scans.

## PDF-Verarbeitung und Speicherung

[pdf.ts](../src/lib/pdf.ts) prüft den PDF-Kopf und höchstens 20 MiB sowie 200 Seiten. Verschlüsselte Dateien werden auch bei leerem Benutzerpasswort abgewiesen. Defekte Dateien erhalten eine deutsche Fehlermeldung. `preparePdf` ermittelt eine SHA-256-Kennung aus den Originalbytes und liest alle Seitenmaße und Drehungen.

PDF.js erhält eine eigene Kopie der Bytes. Dies ist notwendig, weil es übergebene TypedArrays an seinen Worker übertragen kann. [PDF.js-API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html)

Worker, CMaps, Standardfonts, ICC-Profile und WebAssembly-Dateien werden lokal ausgeliefert. `scripts/copy-pdf-assets.mjs` kopiert die Zusatzdateien vor Start und Build sowie nach der Installation. PDF.js erhält keine PDF-URL; XFA ist deaktiviert. Die Anwendung verwendet keine PDF-Scripting-Sandbox. Die installierte Version enthält keine Option `isEvalSupported` in `DocumentInitParameters`; eine solche Option wird deshalb nicht gesetzt. Ein geöffnetes Dokument wird über `pdf.loadingTask.destroy()` beendet. Versionsbeleg: [installierte API-Typen](../node_modules/pdfjs-dist/types/src/display/api.d.ts).

[pdf-storage.ts](../src/lib/pdf-storage.ts) speichert die Originalbytes in IndexedDB. Eine Schreiboperation gilt erst nach Abschluss ihrer Transaktion als erfolgreich. Fehlende Dateien liefern `null`; Zugriffs-, Daten- und Speicherfehler werden als Fehler zurückgegeben. IndexedDB unterstützt strukturierte Daten und Binärdateien im Browser. [MDN](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)

## Ausgeführte Prüfungen

- **24 Kalibrierungstests bestanden:** Einheiten, schräge und senkrechte Messungen, Rücktransformation, Dezimalwerte, große Quellkoordinaten, Hindernisse, Materialerhalt sowie ungültige Maße. Befehl: `npx vitest run tests/calibration.test.ts`.
- **Mehrseitige PDF im Chromium-Browser:** Seite 1 hatte 600 × 400 Einheiten. Seite 2 hatte vor Drehung 300 × 500; der natürliche Viewport nach 90° Drehung hatte korrekt 500 × 300.
- **Identität und Speicherung:** SHA-256 stimmte mit einer unabhängigen Berechnung durch Node.js überein. Die Eingabebytes blieben nach Worker-Nutzung erhalten. Die IndexedDB-Rundreise war bytegenau; eine fehlende Kennung lieferte `null`.
- **Fehlerfälle:** Passwortschutz, Verschlüsselung mit leerem Benutzerpasswort, 201 Seiten, falscher PDF-Kopf, defekte Struktur und mehr als 20 MiB wurden mit deutschen Meldungen abgewiesen.
- **Lokale Ressourcen:** Die Prüf-PDF enthielt eine externe URI-Annotation. Beim Öffnen und Rendern wurden keine externen Requests gemessen. Der Standardfont wurde lokal geladen.
- **Produktionsbuild:** `npm run build` war erfolgreich. Der PDF-Import über die gebaute Oberfläche wurde zusätzlich geprüft. Worker und Standardfont lieferten HTTP 200; es gab keine fehlgeschlagenen oder externen Requests.
