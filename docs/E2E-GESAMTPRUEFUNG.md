# End-to-End-Prüfung aller Funktionsbereiche

Prüfdatum: 28. Oktober 2026.

## Umfang und Ausführung

Die Prüfung gleicht die sichtbaren Funktionen aus Anwendung und Anleitung mit den Browserfällen ab. Die Sammlung wurde von 51 auf 67 unterschiedliche Fälle erweitert. Jeder Fall wird in Chromium und WebKit ausgeführt. Die Tests verwenden getrennte Browserkontexte, synthetische Räume und die mitgelieferte Prüf-PDF.

Das Testziel ist der fertige Produktionsbuild auf einer eigenen lokalen Adresse. Die Browser laden die gebündelte Anwendung, den Geometrie-Worker, PDF.js, Schriften und PDF-Decoder. Raumpläne und PDF-Vorschauen werden tatsächlich berechnet und gezeichnet. Die Prüfungen vergleichen zusätzlich gespeicherte Daten und heruntergeladene Dateien.

| Prüfung | Ergebnis |
| --- | --- |
| Fachtests | 225 Tests in 7 Dateien bestanden. |
| TypeScript und Produktionsbuild | Erfolgreich. |
| Chromium | 67 von 67 Fällen bestanden. |
| WebKit | 67 von 67 Fällen bestanden. |
| Gesamt | 134 von 134 Fällen bestanden, ohne Wiederholung oder übersprungene Fälle. Laufzeit: rund 3 Minuten. |

Ausgeführt mit Playwright 1.64.1, Chromium 156.0.8078.4 und WebKit 27.2. Die maschinenlesbaren Ergebnisse melden 0 fehlgeschlagene, 0 übersprungene und 0 instabile Fälle.

## Geprüfte Funktionen

| Bereich | Ausgeführte Aktionen und geprüfte Ergebnisse | Browserfälle |
| --- | --- | --- |
| Projekte und Etagen | Anlegen, wechseln, umbenennen, entfernen, abbrechen und rückgängig machen. Leere Projekte und Etagen bleiben bedienbar. 20 Projekte und 50 Etagen sind als Grenzen geprüft. | library, workflows |
| Räume | Anlegen, benennen, wechseln, entfernen und wiederherstellen. Verschieben in eine andere Etage löst die alte Position. Der fünfzigste Raum bleibt erreichbar; Entfernen gibt wieder Platz frei. | library, project, workflows |
| Raumformen | Rechteck, L-Form und freie Kontur. Maße, Aussparung und Eckpunkte ändern. Punkte hinzufügen und entfernen, Dreiecksgrenze und 32-Punkte-Grenze. | e2e, features, workflows |
| Zeichnen | Kontur durch Anklicken erfassen, letzten Punkt entfernen, abbrechen und durch den ersten Punkt schließen. Übernahme ändert die Raumkontur. | e2e, features |
| Hindernisse | Hinzufügen, Position und Maße ändern, entfernen und die Grenze von 24 Hindernissen prüfen. In der Vorschau bleiben die Flächen frei. | e2e, workflows |
| Eingabefelder | Dezimalkomma, Enter, Tab, Escape und Pfeiltasten. Ungültige Zahlen, leere Namen, nicht ganzzahliger Paketinhalt und ungültige Positionen erhalten die gespeicherten Werte. | e2e, features, workflows |
| Belag | Fliese und Diele, alle elf Formatvorgaben, eigene Maße, Fuge und Randfuge. Alle vier Oberflächen ändern die Darstellung und bleiben gespeichert. Maße werden am gezeichneten SVG geprüft. | e2e, features, project |
| Mengen und Zuschnitte | Reserve und Paketinhalt ändern. Ein unabhängiges 3×3-Raster ergibt bei 25 % Reserve zwölf Elemente und drei Pakete à fünf Stück. Warnschwelle ändern und den betroffenen Zuschnitt öffnen. | features |
| Verlegung | Alle sieben Muster, freie Drehung, Schalter für 0°, 45° und 90°, Versatz in beide Richtungen, Zentrieren und Ziehen des Verbands. | e2e, features |
| Startfliese | Alle vier Ecken und Wandmitten direkt wählen, auf Desktop und bei 390 px. Auswahl per Liste, Enter und Leertaste, sechs Ziele in einer L-Form. Abbruch, Pan und Zoom ändern keinen Start. Ausrichten, Aufheben, Zentrieren, Rückgängig und Neuladen sind geprüft. | e2e, features |
| Einzelplan | Maße, Achsen und Zuschnitte ein- und ausblenden. Element per Maus, Pfeiltasten, Pos1 und Ende auswählen. Details öffnen und schließen. Ansicht verschieben, vergrößern, verkleinern und einpassen. Zoomgrenzen verändern keine Raumdaten. | e2e, features |
| PDF öffnen | Dateiauswahl und Drag-and-drop. Echte Vektor-, Raster- und gedrehte Seiten werden gerendert. Leere, falsche, beschädigte und zu große Dateien sowie mehrere Dateien in einem Drop werden zurückgewiesen. | floorplan, workflows |
| PDF-Maßstab | Zwei Wandpunkte per Zeiger oder Tastatur setzen, bekannte Länge speichern und neu kalibrieren. Ungültige Längen und gleiche Punkte werden zurückgewiesen. Jede Etage behält ihren Seitenbezug. | floorplan, library, workflows |
| PDF-Räume | Mehrere Räume markieren, benennen, übernehmen, prüfen und entfernen. Tastaturzeiger, Umschalt-Schritte, Punktkorrektur und Konturschluss sind geprüft. Auch der letzte PDF-Raum kann entfernt werden. | floorplan, project, workflows |
| PDF-Entwürfe und Ersatz | Seiten-, Etagen-, Projekt- und Ansichtswechsel schützen offene Markierungen. Rückfragen lassen sich abbrechen. Ein bestätigter Seitenwechsel fragt einmal. PDF-Ersatz erhält die Raumpläne und löst deren alte Zuordnung. | library, project, e2e |
| Gemeinsame Etagenzeichnung | Tatsächliche PDF-Positionen und gemeinsamer Maßstab, eigene Pläne je Raum, Vorlage ein-/ausblenden, Zoom, Pan und Einpassen. Die zweite Etage und ihre Quelle bleiben getrennt. | library, project, workflows |
| Manuelle Raumposition | X/Y speichern und aufheben. Direktes Ziehen zeigt eine Vorschau und speichert beim Loslassen einmal. Escape und Pointercancel verwerfen die Vorschau. PDF-Räume bleiben fest. Der Positionsdialog ist bei 320 px bedienbar. | arrangement, workflows |
| Varianten | Vollständigen Stand speichern, benennen, nach Neuladen laden, Ladebestätigung abbrechen und löschen. Andere Räume bleiben erhalten. Die Grenze von zwölf Varianten und freier Platz nach dem Löschen sind geprüft. | e2e, features |
| Projektdateien | Leere und gefüllte Projekte exportieren und erneut importieren. Alle Etagen, Räume, Positionen, Maßstäbe und PDF-Bytes bleiben erhalten. Gemeinsame PDFs sind einmal enthalten. Version 1 und 2 werden über die Oberfläche migriert; Version 3 ergänzt ein Projekt mit neuen IDs. | e2e, floorplan, library, workflows |
| SVG und CSV | Sichtbare Geometrie, Materialmaße, Konturen, Elementzahl und Startfliese vergleichen. Alle sieben SVG-Maßstäbe werden heruntergeladen und anhand der mm-Abmessungen geprüft. | e2e, features |
| Druck / PDF | A4-Grenze und Maßstabswahl, Druckaufruf und Druckdarstellung prüfen. Chromium erzeugt eine echte einseitige A4-PDF mit passendem Papiermaß. Startfliese, Mengen und 50-mm-Kontrollmaß stehen im Bericht. | e2e, features |
| Lokale Speicherung | Neuladen, Rückgängig und Wiederholen. Beschädigte Daten bleiben als Sicherung erhalten. Bei simuliert vollem Speicher kann das Projekt weiterbearbeitet, exportiert und in einem neuen Browserkontext wiederhergestellt werden. | e2e, workflows |
| PDF-Speicher | Original-Bytes in IndexedDB mit der Prüfdatei vergleichen. Fehlende PDF wiederherstellen. Unvollständiger Export zeigt einen Fehler. Defekte Importe erhalten die vorhandenen Projekte. | floorplan |
| Mehrere Tabs | Reine Navigation erzeugt keine Warnung. Echte Änderungen lösen den Konflikthinweis aus. Beide Fassungen bleiben beim Zusammenführen erhalten. Das Laden des anderen Stands sichert zuvor die lokale Fassung. | conflict |
| Bedienung und Hilfe | Desktop, 390 und 320 px, mobile Rückwege, Dialoge, Fokus und Tastaturbedienung. Hilfe über beide Einstiege öffnen und schließen. Axe-Prüfungen und Überlaufmessung sind enthalten. | e2e, features, library, arrangement |
| Lokaler Betrieb | HTTP- und WebSocket-Anfragen einschließlich PDF-Renderer, Worker und Schriften beobachten. Die geprüften Abläufe verwenden lokale Ziele. Ein fehlerhafter Raum blockiert andere Räume nicht. | e2e, floorplan, library |

Die Kurzbezeichnungen verweisen auf die entsprechenden Dateien in [tests/](../tests/). Die neuen Fälle stehen in [features.e2e.spec.ts](../tests/features.e2e.spec.ts) und [workflows.e2e.spec.ts](../tests/workflows.e2e.spec.ts).

## Gefundener und behobener Anwendungsfehler

WebKit gab den Fokus nach dem Schließen der Hilfe, der Startauswahl und einer PDF-Rückfrage nicht zuverlässig an den betätigten Auslöser zurück. Die Anwendung fokussiert betätigte Schaltflächen jetzt vor deren Aktion. Dialoge können zusätzlich eine SVG-Raumfläche als Rücksprungziel erhalten. Die bestehenden Fokusanforderungen bleiben in den Tests erhalten.

Die Browserläufe haben außerdem bisherige Testannahmen präzisiert:

- Auf Speicherung wird anhand der tatsächlich geänderten Daten gewartet. Eine neue Kalibrierung mit derselben Wandlänge muss auch die neuen Endpunkte gespeichert haben.
- Zeigertests verwenden ganze Bildschirmpixel. Der PDF-Test erfasst die gelieferten Zeigereignisse und rechnet sie unabhängig über die SVG-Bildschirmmatrix um. Die Raummaße und Fläche werden daraus mit eigener Abstands- und Flächenrechnung geprüft. Die geometrischen Toleranzen wurden dafür nicht vergrößert.
- Die Koordinatenanzeige nach einem Drag wird gegen die gespeicherte Position und auf kompakte Dezimalwerte geprüft.
- Die Importmeldung wird über ihre sichtbare Schließen-Aktion geschlossen, bevor der letzte Raum einer langen Liste geöffnet wird.

## Erneut ausführen

Im Projektordner:

~~~sh
npm ci
npx playwright install chromium webkit
npm run check
npm run test:e2e:all
~~~

Der Standardlauf verwendet den lokalen Entwicklungsserver. Für eine Prüfung des fertigen Builds zuerst in einem Terminal:

~~~sh
npm run build
npm run preview -- --port 52501 --strictPort
~~~

Danach in einem zweiten Terminal:

~~~sh
PLAYWRIGHT_BASE_URL=http://127.0.0.1:52501 \
PLAYWRIGHT_RESULTS_DIR=test-results/all \
npm run test:e2e:all
~~~

`npm run test:e2e` führt weiterhin die Chromium-Prüfung aus. Die Konfiguration erfasst alle Dateien mit der Endung `.spec.ts`. Es gibt keine automatischen Wiederholungen, ausgeblendeten Fehler oder übersprungenen Fälle.

## Lokal erzeugte Belege

Die Ausgabedateien werden beim Test erzeugt und nicht in Git gespeichert:

- [HTML-Bericht mit einzelnen Testfällen und Anhängen](../test-results/all/report/index.html)
- [Maschinenlesbare Ergebnisse](../test-results/all/results.json)
- [Erzeugter A4-Verlegeplan](../test-results/e2e-evidence/verlegeplan-a4.pdf)
- [Druckdarstellung in Chromium](../test-results/all/screenshots/druck-chromium.png)
- [Druckdarstellung in WebKit](../test-results/all/screenshots/druck-webkit.png)

## Grenzen

Die mobilen Ansichten wurden durch Fenstergrößen im Browser geprüft. Ein physisches iPhone und manuelle Screenreader-Bedienung sind nicht Teil dieses Nachweises. Der native Druckdialog und ein Papierausdruck wurden nicht bedient; die PDF-Erzeugung erfolgte mit Chromium. Die Druckdarstellung wird in beiden Engines geprüft. Die Tests decken die aufgeführten Funktionen und Grenzfälle ab; sie prüfen nicht jede mögliche Kombination von Maßen, Materialien und Konturen. Der Produktionsbuild meldet weiterhin den vorhandenen Hinweis auf einen JavaScript-Block über 500 kB.
