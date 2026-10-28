# Prüfung: Projekte, Etagen und räumliche Übersicht

Prüfdatum: 28. Oktober 2026.

Die Erweiterung verwaltet getrennte Projekte mit Etagen und Räumen. Die aktive Etage zeigt die Verlegepläne in einem gemeinsamen Koordinatensystem. PDF-Räume verwenden ihre Quellposition. Manuelle Räume brauchen eine ausdrücklich gesetzte Position.

## Automatische Prüfung

| Prüfung | Ergebnis |
| --- | --- |
| `npm run check` | 225 Tests in 7 Dateien bestanden; TypeScript und Produktionsbuild erfolgreich. |
| Vollständiger Lauf `npm run test:e2e` | 51 von 51 Browserfällen bestanden, Chromium, zwei Worker, 2,0 Minuten. Enthalten sind Raumfehler, schmale Positionsdialoge und Navigation in mehreren Tabs. |

Die Tests verwenden synthetische Räume und `tests/fixtures/grundriss-drei-seiten.pdf`. Die Datei enthält eine Vektorseite, eine gedrehte Seite und eine Rasterseite. Die Prüfung importiert echte PDF-Bytes und vergleicht Raumkoordinaten, Maßstäbe und Dateiinhalte.

## Abgleich mit dem Gestaltungsvertrag

Die IDs beziehen sich auf [PROJEKTE-ETAGEN-UX.md](PROJEKTE-ETAGEN-UX.md).

| Prüffälle | Nachweis |
| --- | --- |
| P1, P2: getrennte Projekte und Etagen | `library.e2e.spec.ts` legt mehrere Projekte und Etagen an, wechselt den Kontext und lädt den Browser neu. Leere Einträge bleiben bedienbar. `library.test.ts` prüft die Trennung im Datenmodell. |
| P3: echte Raumlage | `floor-layout.test.ts` prüft Ursprung, Maßstab, Abstand, Konturversatz und Seitenzuordnung. `library.e2e.spec.ts` vergleicht die sichtbaren SVG-Ursprünge mit den PDF-Punkten. |
| P4: eigener Verlegeplan je Raum | Änderungen von Belag und Verlegung erscheinen in der gemeinsamen Zeichnung. Der Browservergleich erhält die Raumposition und die Einstellungen des anderen Raums. |
| P5: weitere PDF-Seite | Erdgeschoss und Obergeschoss verwenden unterschiedliche Seiten derselben PDF. Die erste Etage bleibt erhalten. Der Seitenwechsel schützt den Entwurf mit genau einer Rückfrage. |
| P6: manuelle Position | X/Y, direktes Ziehen, Vorschau, einmaliger Commit, Rückgängig, Neuladen, Escape und Pointercancel sind geprüft. Unplatzierte Räume erhalten keine erfundene Position. PDF-Räume bleiben fest. |
| P7: Namen | Projekt-, Etagen- und Raumnamen werden geändert. Die Zuordnung und die übrigen Raumdaten bleiben erhalten. |
| P8: Migration | Alte Einzelraum- und Workspace-Dateien bleiben lesbar. Bis zu 50 bisherige PDF-Seiten werden ohne verlorene Räume in Etagen übernommen. Beschädigte gespeicherte Daten bleiben als Sicherung erhalten. |
| P9: vollständige Projektdatei | Export und erneuter Import erhalten Etagen, Räume, Positionen, Maßstäbe und PDF-Bytes. Gemeinsam verwendete PDFs sind einmal eingebettet. Der Import ergänzt ein Projekt mit neuen IDs. |
| P10: offene Entwürfe | Abgebrochene Projekt-, Etagen- und Seitenwechsel erhalten die Markierung. Bestätigtes Verwerfen löscht nur den Entwurf. |
| P11: Entfernen und Wiederherstellen | Raum, Etage und Projekt können entfernt und während der Sitzung wiederhergestellt werden. Aktive IDs bleiben gültig. |
| P12, P13: Ansichtsgrößen und Tastatur | Browserprüfungen und unabhängige Sichtprüfung umfassen Desktop, 390 und 320 px. Etagenwahl, Raumöffnung, benannte Dialoge und Fokuswechsel sind geprüft. |
| P14: Fehler und fehlende PDF | Ein Raum mit 50 × 50 m und 10 × 10 cm Belag überschreitet die Rastergrenze. Beide Raumkonturen bleiben sichtbar. Der andere Raum lässt sich weiter bearbeiten; der fehlerhafte Raum lässt sich korrigieren. Eine fehlende PDF kann ohne verlorene Räume oder Maßstäbe erneut geladen werden. |
| P15: unabhängige UI-Prüfung | Befunde, Korrekturen, Bildschirmbelege und Nachweisgrenzen stehen in [PROJEKTE-ETAGEN-REVIEW.md](PROJEKTE-ETAGEN-REVIEW.md). |

## Speichern in mehreren Tabs

`library-conflict.test.ts` prüft den Inhaltsvergleich und die Zusammenführung mit 19 Fällen. `conflict.e2e.spec.ts` verwendet jeweils zwei Tabs mit gemeinsamem Browserspeicher:

- Ein älterer Tab überschreibt keine neu angelegten Projekte.
- Reine Navigation erzeugt keine zusätzliche Projektfassung.
- Projekt-, Etagen- und Raumwechsel erzeugen keinen Konflikthinweis. Echte Inhaltsänderungen bleiben erkennbar. Die gewählte PDF-Seite zählt zum Inhalt.
- Unterschiedliche Änderungen desselben Projekts bleiben als vollständige Fassungen erhalten, auch nach dem Neuladen.
- Vor „Aktuellen Stand laden“ wird der lokale Stand gesichert. Das gilt auch vor Ablauf des verzögerten Speicherns.

Der Schreibzugriff vergleicht den zuletzt gelesenen Speicherstand. Wo verfügbar, schützt zusätzlich ein Web Lock den Vergleich und das Schreiben. Eine fehlgeschlagene Zusammenführung am Projektlimit verändert keine Eingabedaten.

## Zusätzlicher Browsernachweis

Der manuelle Ablauf verwendet eine getrennte lokale Adresse. Er legt „Haus am Garten“ mit „Erdgeschoss“ und „Obergeschoss“ an. Im Erdgeschoss liegen „Wohnen“ und „Essen“ mit je 24,96 m². Das Obergeschoss enthält „Bad“ mit 2,4 m² auf der gedrehten zweiten PDF-Seite. Die heruntergeladene Projektdatei enthält Version 3, zwei Etagen, drei Räume und eine eingebettete Original-PDF.

- [Erdgeschoss mit beiden Verlegeplänen](../screenshots/hierarchy/etagenprojekt-desktop.jpg)
- [Obergeschoss auf der zweiten PDF-Seite](../screenshots/hierarchy/obergeschoss-desktop.jpg)
- [Manuelle Räume direkt anordnen](../screenshots/hierarchy/arrangement-desktop.jpg)
- [Anordnen bei 390 px](../screenshots/hierarchy/arrangement-mobile.jpg)

## Grenzen des Nachweises

Die mobilen Ansichten wurden im Browser mit entsprechenden Größen geprüft. Ein physisches iPhone und eine manuelle Screenreader-Prüfung sind nicht enthalten. Axe-Prüfungen ersetzen diese Tests nicht. Der Build meldet weiterhin einen JavaScript-Block über 500 kB; der Build ist erfolgreich. Die technischen Obergrenzen sind keine Zusage für die Speicherkapazität jedes Geräts.
