# Prüfung des PDF-Grundrisses

Stand: 25.10.2026. Geprüft mit Playwright 1.64.1 und Chromium gegen die lokale Anwendung auf `127.0.0.1:5173`. PDF.js: 6.4.299.

## Reproduzierbare Testdatei

`tests/fixtures/grundriss-drei-seiten.pdf` ist eine eigens erzeugte PDF mit drei Seiten. Sie enthält keine fremden Pläne oder geschützten Assets. Der Generator verwendet nur die Node-Standardbibliothek. Es ist keine zusätzliche Abhängigkeit der Anwendung nötig.

```sh
node tests/fixtures/create-floorplan-fixture.mjs
```

Die Datei `tests/fixtures/grundriss-erwartungen.json` enthält die unabhängigen Sollwerte. Ihre Koordinaten beziehen sich auf die natürliche PDF.js-Seite bei Skalierung 1. Der Ursprung liegt links oben. Die Seitendrehung ist bereits berücksichtigt.

| Seite | Inhalt | Natürliche Seitengröße | Kalibrierstrecke | Maßstab | Erwarteter Raum |
| --- | --- | --- | --- | --- | --- |
| 1 | Vektorplan mit zwei Räumen | 600 × 400 Punkte | 240 Punkte = 4.800 mm | 20 mm/Punkt | je 4.800 × 5.200 mm; 24,96 m² |
| 2 | Vektorplan mit `/Rotate 90` | 400 × 600 Punkte | 400 Punkte = 2.000 mm | 5 mm/Punkt | 1.200 × 2.000 mm; 2,40 m² |
| 3 | Eingebettetes Graustufenbild | 600 × 400 Punkte | 200 Punkte = 3.000 mm | 15 mm/Punkt | je 3.000 × 3.600 mm; 10,80 m² |

`pdfinfo` bestätigt drei Seiten und die Drehung der zweiten Seite. `pdfimages -list` bestätigt das 600 × 400 Pixel große Bild auf Seite 3. Diese Seite enthält keinen PDF-Text und keine Vektorkonturen. PDF.js hat alle drei Seiten geladen. Gerenderte Bilder der gedrehten Seite und der Rasterseite wurden zusätzlich visuell geprüft.

## Browserprüfungen

Die Datei `tests/floorplan.e2e.spec.ts` enthält sieben Tests. Sie verwenden echte Dateiuploads, echte PDF-Renderings und normale Bedienelemente. Die Umrechnung wird unabhängig mit Punktabständen, Raumgrenzen und der Schuhbändelformel geprüft. Die Tests importieren keine Geometriefunktion der Anwendung.

| Prüfung | Nachweis |
| --- | --- |
| Zoom und Kalibrierung | Dieselbe Wand wird bei 100 % und 125 % per Zeiger markiert. Die gespeicherten Punkte stimmen innerhalb von 0,02 PDF-Punkten überein. Der daraus gezeichnete Raum hat die erwarteten Maße. |
| Mehrere Räume und Seiten | Zwei Räume auf Seite 1 erhalten verschiedene Beläge und Verlegemuster. Die Einstellungen bleiben beim Raumwechsel getrennt. Seite 2 und Seite 3 erhalten eigene Kalibrierungen und korrekt bemessene Räume. |
| Neue Kalibrierung | Die halbierte Wandlänge auf Seite 1 halbiert nur die zugehörigen Raummaße und Hindernisse. Die Fläche beträgt danach 6,24 m² je Raum. Belag und Verlegeparameter bleiben erhalten. Räume auf Seite 2 und 3 bleiben unverändert. |
| IndexedDB und JSON | Die gespeicherten PDF-Bytes sind bytegleich zur Testdatei. Ein Reload erhält PDF und Projektdaten. Die exportierte JSON wird in einem frischen Browserkontext importiert. Erneuter Export und Reload erhalten alle Räume, Kalibrierungen, Einstellungen und PDF-Bytes. |
| Fehlerhafte Dateien | Eine beschädigte PDF, syntaktisch ungültige JSON und ungültige eingebettete PDF-Daten werden abgewiesen. Das zuvor geladene Projekt und seine PDF bleiben erhalten. |
| Mobile Ansicht und Zugänglichkeit | Upload, numerische Punkteingabe, Kalibrierung, Raumübernahme und Zoom funktionieren bei 390 × 844 Pixeln. Es gibt keinen horizontalen Überlauf. Axe meldet nach der Korrektur keine Verstöße mit Schweregrad `serious` oder `critical`. Dasselbe gilt für die geprüfte Desktop-Grundrissansicht. |
| Lokale Datenverarbeitung | HTTP- und WebSocket-Requests werden ab dem ersten Laden erfasst. Auch PDF-Worker, Darstellung, Kalibrierung und Eingaben erzeugen im geprüften Ablauf keine Requests an andere Hosts. |
| Wiederherstellung nach Speicherverlust | Die echte PDF wird aus IndexedDB gelöscht. Nach dem Reload bleiben Räume und Maßstäbe vorhanden. Ein vollständiger Projekt-Export wird mit einem sichtbaren Fehler im Dialog verhindert. Das erneute Laden derselben PDF stellt die Ansicht und den vollständigen Export ohne Änderung der Projektdaten wieder her. |

Die Pixelprüfung liest den tatsächlich bemalten Canvas. Ein leerer Platzhalter reicht zum Bestehen nicht aus. Die Rasterseite wird ebenfalls über den echten PDF-Renderer verarbeitet.

## Ergebnis und Befunde

Alle sieben PDF-Tests haben bestanden. Der abschließende gemeinsame Lauf aller **24 Browserprüfungen** war erfolgreich (45,6 Sekunden). Der mobile Test hatte zuvor einen fehlenden zugänglichen Namen am Seitenauswahlfeld gefunden. Dieser Fehler ist behoben. Der gemeinsame Lauf enthält auch die Wiederherstellung der PDF und die deutsche JSON-Fehlermeldung. Es gab keine unbehandelten JavaScript-Fehler.

Die bereits vorhandenen 17 Browser-Regressionstests bleiben in `tests/e2e.spec.ts` erhalten und sind im gemeinsamen Abschlusslauf enthalten. Zusätzlich bestanden der Produktionsbuild und alle 116 Berechnungs- und Datentests.

```sh
npx playwright test tests/floorplan.e2e.spec.ts
```

Die Screenshots liegen nach dem Testlauf unter:

- `test-results/pdf-evidence/desktop-1440x1000.png`
- `test-results/pdf-evidence/mobile-390x844.png`
- `test-results/pdf-evidence/mobile-fullpage.png`

Die dauerhaften Kopien bleiben bei weiteren Testläufen erhalten: [Desktop](../tests/screenshots/pdf-desktop.png) und [Mobil](../tests/screenshots/pdf-mobile.png). Der jeweilige PDF-Test aktualisiert diese Belege.

Die Desktopansicht und beide mobilen Aufnahmen wurden visuell geprüft. Die Bedienelemente sind lesbar. Raumkontur und Kalibrierlinie liegen auf dem PDF. Es wurde kein horizontaler Überlauf festgestellt.

## Reichweite der Prüfung

Die mobile Prüfung verwendet einen Chromium-Viewport. Sie ist kein Test auf einem physischen Mobilgerät und kein Safari-Test. Axe ersetzt keinen Screenreader-Test.

Die Kalibrierung verwendet einen gemeinsamen Maßstab für beide Achsen. Eine verzerrte Scanvorlage wird dadurch nicht entzerrt. Der Test prüft geometrisch unverzerrte Vorlagen mit bekannten Strecken. Die Test-PDF ist klein; sie belegt keine Lastgrenze für große oder sehr komplexe Baupläne.
