# UX-Audit: Projekt, Räume und eigener Grundriss

Stand: 26. Oktober 2026. Geprüfte Ausgangsversion: `4d5e783c92188fae302daec43ddeb3ea2bd29a14`.

Dieser Bericht dokumentiert die Ausgangsversion vor dem Umbau. Dateizeilen beziehen sich auf diese Version. Spätere Änderungen müssen mit den Abnahmekriterien unten geprüft werden.

## Methode und Grenzen

Die Prüfung beantwortet drei Fragen:

1. Kann man mehrere Räume finden, gemeinsam sehen und gezielt bearbeiten?
2. Führt der PDF-Ablauf ohne unnötigen Rücksprung vom Upload bis zum Verlegeplan?
3. Bleiben Aktionen, Fehler und Korrekturen auf Desktop, Smartphone und mit Tastatur verständlich?

Methode: Prüfung der Komponenten, Zustandswechsel, vorhandenen Testfälle und gespeicherten Bildschirmbilder. Es gab keine Befragung, keine Testpersonen und in diesem Audit keinen neuen Browserlauf. Die Befunde sind deshalb technische und visuelle Beobachtungen. Sie sind keine Messung von Zufriedenheit, Zeitersparnis oder Erfolgsquoten. Vorhandene Testfälle belegen hier nur den vorgesehenen Prüfumfang, keinen neuen erfolgreichen Testlauf.

Gelesen wurden `App`, `Controls`, `FloorPlanEditor`, `PlanCanvas`, `StartPicker`, `StartControls`, `Dialog`, die Raumverwaltung und die Import-/Export-Schnittstellen. Die Testdateien `e2e.spec.ts` und `floorplan.e2e.spec.ts` wurden auf abgedeckte Abläufe geprüft.

Visuell geprüft wurden diese vorhandenen Bilder:

- [Einzelplan auf Desktop](../screenshots/01-verlegeplan.jpg)
- [PDF mit zwei Raumkonturen](../screenshots/03-pdf-grundriss.jpg)
- [Startwahl auf Smartphone](../screenshots/startwahl-direkt-mobil.jpg)
- [Einstieg auf Smartphone](../tests/screenshots/mobile-390x844.png)
- [PDF-Ansicht auf Smartphone](../tests/screenshots/pdf-mobile.png)

## Befunde und Korrekturen

**P1** bedeutet: Für die verlangte Projektansicht oder den PDF-Ablauf vor der Abnahme korrigieren. **P2** bedeutet: Im vollständigen Durchgang prüfen und bei der Überarbeitung berücksichtigen. Die Einstufung ist eine fachliche Priorisierung, keine gemessene Häufigkeit.

| ID | Priorität | Belegter Befund | Korrektur und Abnahmekriterium |
| --- | --- | --- | --- |
| U1 | P1 | Die Ansichten sind `plan`, `floorplan` und `variants`. Der Einzelplan berechnet nur `currentRoom(workspace)`. Die Raumwahl erfolgt über ein Select. Die PDF-Ansicht zeigt zwar mehrere Konturen, aber keine gemeinsamen Verlegepläne. Belege: [App.tsx](../src/App.tsx), Zeilen 24–28, 47, 187–201; [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeilen 406–416. | Eine Projektansicht mit sichtbaren Räumen und gemeinsamer Planvorschau anbieten. Zwei ausgewählte Räume müssen gleichzeitig mit ihrem jeweiligen Belag sichtbar sein. Die Bearbeitung eines Raums muss seine Identität klar zeigen. Ein- und Ausblenden darf Räume nicht löschen. |
| U2 | P1 | Nach `onAddRoom` setzt die App sofort `mode` auf `plan`. Für den nächsten Raum muss man erneut zum Grundriss wechseln. Beim erneuten Einbau des Editors startet dessen Ansicht mit Zoom 1. Belege: [App.tsx](../src/App.tsx), Zeile 201; [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeilen 66–68. | Den Ablauf als Folge Datei → Seite/Maßstab → Räume → Plan aufbauen. Nach dem Speichern eines Raums müssen „Weiteren Raum markieren“ und ein ausdrücklicher Abschluss erreichbar sein. Zwei Räume derselben PDF sollen ohne Verlassen des Ablaufs entstehen. |
| U3 | P1 | Ein Seitenwechsel leert Messpunkte, Wandlänge und Raumentwurf. Das Seiten-Select bleibt während einer Markierung aktiv. Auch der Wechsel der Hauptansicht baut den Editor ab. Belege: [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeilen 172–177 und 357; [App.tsx](../src/App.tsx), Zeilen 196–201. | Entwürfe beim Navigieren erhalten oder vor dem Verwerfen eine konkrete Entscheidung anbieten. Prüffall: Drei gesetzte Raumpunkte, Seitenwechsel, Zurück; kein stiller Verlust. Dasselbe für Hauptansicht, andere Datei und Abbruch prüfen. |
| U4 | P1 | „Andere PDF“ entfernt alle bisherigen PDF-Zuordnungen der Räume. Die Raumpläne bleiben erhalten. Die Aktion und die anschließende Meldung erklären den Verlust der Zuordnungen nicht. Belege: [workspace.ts](../src/lib/workspace.ts), Zeilen 130–134; [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeile 359; [App.tsx](../src/App.tsx), Zeilen 140–143. | Vor dem Ersetzen die konkrete Folge anzeigen. Die gleiche PDF muss ohne Verlust der Maßstäbe wiederherstellbar bleiben. Eine andere PDF muss bestehende Räume als eigenständige Räume erkennbar erhalten. |
| U5 | P1 | Das Feld „Projektname“ ändert nur `activeRoom.project.name`. Ein eigener Name für das Gesamtprojekt existiert im Workspace nicht. Belege: [Controls.tsx](../src/components/Controls.tsx), Zeilen 125–149 und 251; [floorplan-types.ts](../src/floorplan-types.ts), Zeilen 25–31. | Das Feld als „Raumname“ bezeichnen. Projektaktionen, Raumaktionen und Exportumfang sprachlich trennen. Falls ein Projektname ergänzt wird, muss er unabhängig vom Raumnamen gespeichert werden. |
| U6 | P1 | Der PDF-Import behält das voreingestellte Wohnzimmer. Jeder übernommene PDF-Raum wird angehängt. Ein neuer Nutzer hat nach seinem ersten markierten Raum deshalb zusätzlich den Beispielraum. Belege: [project.ts](../src/lib/project.ts), Zeilen 9–15; [workspace.ts](../src/lib/workspace.ts), Zeilen 130–134 und 149–166. | Den Beispielraum im Einstieg erkennbar machen und eine bewusste Wahl zum Behalten oder Ersetzen anbieten. Bearbeitete Räume nicht automatisch entfernen. Nach dem PDF-Abschluss muss klar sein, welche Räume zum Projekt gehören. |
| U7 | P1 | In den Fliesen-Formatvorgaben fehlt 12 × 30 cm. Beleg: [Controls.tsx](../src/components/Controls.tsx), Zeilen 203–210. | Die verlangte Vorlage hinzufügen. Auswahl, Zahlenfelder und Zeichnung müssen dasselbe Maßpaar 120/300 mm verwenden. Die Fuge bleibt ein gesonderter Wert. Bestehende eigene Maße müssen erhalten bleiben. |
| U8 | P2 | Gemerkte Varianten sind global. „Variante laden“ ersetzt im aktiven Raum auch Name und Geometrie. Die Variantenkarte nennt den Zielraum nicht. Bei einem PDF-Raum wird die neue Geometrie zudem in dessen bisherige PDF-Zuordnung zurückgerechnet. Belege: [App.tsx](../src/App.tsx), Zeilen 247 und 279–281; [workspace.ts](../src/lib/workspace.ts), Zeilen 120–127. | Vor der Übernahme Zielraum und Umfang nennen. Alternativ eine eindeutige Aktion „Als neuen Raum übernehmen“ anbieten. Prüfen: Variante aus Raum A bei aktivem Raum B laden; B darf sich nur nach einer eindeutig benannten Aktion ändern. |
| U9 | P2 | Der Papierkorb im Raum-Select löscht sofort. Die PDF-Raumliste verlangt erst eine Bestätigung. Die direkte Aktion zeigt nur eine Meldung mit Hinweis auf Rückgängig. Belege: [App.tsx](../src/App.tsx), Zeilen 50 und 189; [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeilen 395–396. | Für beide Einstiege dasselbe Verhalten verwenden. Der betroffene Raum muss genannt sein. Bei direkter Löschung sollte „Rückgängig“ unmittelbar in der Rückmeldung erreichbar sein. Das Entfernen des letzten Raums muss an allen Einstiegen nachvollziehbar behandelt werden. |
| U10 | P2 | Auf Smartphone steht die gesamte Seitenleiste vor dem Hauptinhalt. Im gespeicherten Bild mit 390 × 844 px beginnt der Planbereich erst am unteren Rand. Belege: [styles.css](../src/styles.css), Zeile 17; [mobiles Einstiegsbild](../tests/screenshots/mobile-390x844.png). | Projektwahl und Ergebnis im mobilen Einstieg sichtbar priorisieren. Die drei Einstellbereiche kompakt öffnen. Nach einer Änderung einen kurzen Weg zur Vorschau anbieten. Im Browser mit 390 × 844 px und langen Raumnamen prüfen. |
| U11 | P2 | Einige mobile Aktionen sind kleiner als die bereits eingeführten 44 × 44 px der Startwahl: Raum-Papierkorb 30 × 38 px, PDF-Zoom 35 × 39 px, allgemeine Planwerkzeuge 34 × 36 px. Belege: [styles.css](../src/styles.css), Zeilen 17, 33 und 50; [FloorPlanEditor.css](../src/components/FloorPlanEditor.css), Zeile 37. | Die neuen und betroffenen Touch-Aktionen auf mindestens 44 × 44 px auslegen. Dies ist ein vorgeschlagenes Projektziel, keine Aussage über eine bestandene oder verletzte Norm. Bedienung bei schmalem Bildschirm und geöffnetem Bildschirmkeyboard prüfen. |

## Vorhandene Stärken erhalten

- Zahlenfelder akzeptieren das Dezimalkomma. Fehler stehen am Feld. Escape verwirft die Eingabe. Beleg: [Controls.tsx](../src/components/Controls.tsx), Zeilen 34–120.
- Die Startwahl besitzt sichtbare Punkte, Tastaturbedienung und eine alternative Liste. Beleg: [StartPicker.tsx](../src/components/StartPicker.tsx).
- Der PDF-Editor bietet Punktkorrektur, Tastaturzeiger und genaue Koordinaten. Beleg: [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeilen 250–255, 310–331 und 387–391.
- Der Export erklärt bereits: Die Projektdatei enthält alle Räume; SVG, Druck und CSV gelten für den aktiven Raum. Beleg: [App.tsx](../src/App.tsx), Zeilen 256–264. Diese Unterscheidung muss in der Projektansicht erhalten bleiben.
- Der PDF-Renderer zeigt Lade- und Fehlerzustände. Das erneute Öffnen einer fehlenden PDF wird angeboten. Beleg: [FloorPlanEditor.tsx](../src/components/FloorPlanEditor.tsx), Zeile 427.
- Reduzierte Bewegung wird im CSS berücksichtigt. Belege: [styles.css](../src/styles.css), Zeile 18; [FloorPlanEditor.css](../src/components/FloorPlanEditor.css), Zeile 39.

## Inventar für den vollständigen UX-Durchgang

Die folgende Liste beschreibt den Prüfumfang. „Test vorhanden“ heißt: Der Testcode wurde gelesen. Der Test wurde in diesem Audit nicht ausgeführt.

| Bedienweg | Zu prüfendes Ergebnis | Vorhandener Test oder Quellbeleg |
| --- | --- | --- |
| Start und lokal gespeichertes Projekt | Richtiger Raum und verständlicher Speicherstatus; defekte Speicherung mit Wiederherstellungshinweis | `e2e.spec.ts`: Rückgängig/lokales Speichern, beschädigte Speicherung |
| Projektübersicht und mehrere Räume | Mehrere Pläne gleichzeitig, klare Auswahl, nur gewählten Raum bearbeiten, Rückkehr zur Übersicht | Neue Prüfung erforderlich; U1 |
| Raum hinzufügen, benennen, wechseln, entfernen | Raum eindeutig erkennbar; letzte Raumgrenze; Rückgängig | `App.tsx`: `openRoom`, `deleteRoom`, Raumwahl; neue Übersicht gesondert prüfen |
| Rechteck und L-Form | Maße und Aussparung verändern den Plan; ungültige Werte bleiben korrigierbar | `e2e.spec.ts`: Maße, L-Form, ungültige Eingaben |
| Freie Kontur zeichnen und über Felder bearbeiten | Punkte setzen, korrigieren, schließen, abbrechen; fehlerhafte Kontur erklären | `e2e.spec.ts`: eigene Raumkontur, freie Eckpunkte, Entwurfsregressionen |
| Hindernisse | Hinzufügen, Position und Maße ändern, entfernen; Auswirkung sichtbar | `e2e.spec.ts`: L-Form, freie Eckpunkte und Hindernis |
| Fliese/Diele und Format | Vorgaben, eigene Werte, 12 × 30 cm, Farbe, Fuge, Randfuge, Reserve, Paketmenge | `e2e.spec.ts`: Maße, Dielen; neue Vorlage ergänzen |
| Sieben Verlegemuster | Erkennbare Musterwahl, richtige Vorschau, Drehung und Versatz | `e2e.spec.ts`: alle sieben Muster |
| Start wählen und ändern | Ecke/Wandmitte mit Zeiger und Tastatur; Start aufheben; neu ausrichten; zentrieren | `StartPicker.tsx`, `StartControls.tsx`; vorhandene Start-Regressionsfälle |
| Ansicht bewegen | Zoom, Einpassen, Ansicht verschieben und Verband verschieben bleiben unterscheidbar | `e2e.spec.ts`: Tastatur/Zoom, Verschieben mit Maus |
| Maße, Achsen und Zuschnitte | Schalterzustand erkennbar; Elementdetails und Kantenmaße erreichbar; Details schließen | `PlanCanvas.tsx`, `e2e.spec.ts`: Tastaturbedienung |
| Mengen und Warnungen | Raumfläche, ganze Elemente, Zuschnitte, Reserve und Pakete unterscheiden; schmale Zuschnitte finden | `App.tsx`: Materialübersicht und Warnhinweis; visueller Durchgang offen |
| Varianten | Merken, benennen, laden, löschen, Grenze 12; Zielraum vor Übernahme eindeutig | `e2e.spec.ts`: Varianten; Mehrraum-Fall neu prüfen, U8 |
| PDF wählen und ersetzen | Dateiauswahl/Drop; leere, defekte und zu große Datei; bisheriges Projekt bleibt bei Fehler erhalten | `floorplan.e2e.spec.ts`: fehlerhafte PDF/JSON; U4 |
| PDF-Seite und Maßstab | Seiten getrennt kalibrieren, Punktkorrektur, Wandlänge, Zoom, neuer Maßstab passt zugeordnete Räume an | `floorplan.e2e.spec.ts`: Zeiger-Eingabe/Zoom, eigene Maßstäbe |
| PDF-Räume im Wizard | Mindestens zwei Räume, Name und Kontur prüfen, weiterer Raum, Zurück, Abbruch, Abschluss | Neuer Ablauf neu prüfen; U2 und U3 |
| PDF-Wiederherstellung | Original-PDF erneut laden, Räume und Maßstäbe behalten | `floorplan.e2e.spec.ts`: fehlende PDF in IndexedDB |
| Projektdatei exportieren/importieren | Alle Räume und Original-PDF erhalten; defekte Datei verändert das Projekt nicht | `floorplan.e2e.spec.ts`: JSON-Roundtrip; `e2e.spec.ts`: Projektdatei |
| SVG, CSV und Druck/PDF | Aktiver Raum klar benannt; Maßstab und A4-Grenze; Inhalt stimmt mit dem Plan überein | `e2e.spec.ts`: SVG/CSV, Druckausgabe |
| Hilfe und neuer Plan | Hilfe erreichbar, Umfang des Zurücksetzens klar, Abbruch und Rückgängig | `App.tsx`: Hilfe- und Reset-Dialog; Tastaturdurchgang offen |
| Rückgängig/Wiederholen | Raum, Maßstab und Planänderung nachvollziehbar; Navigation nicht versehentlich als Bearbeitung | `e2e.spec.ts`: Verlauf; Mehrraum-Wizard neu prüfen |

## Barrierearme Bedienung und noch offene Nachweise

Im Quellcode sind Labels, Statusmeldungen, Fokusmarkierungen, native Dialoge sowie Alternativen zur Zeigerbedienung vorhanden. Das beweist noch keinen vollständigen barrierefreien Ablauf.

Die vorhandenen Axe-Prüfungen filtern auf `serious` und `critical`. Sie erfassen damit nicht alle gemeldeten Befunde. Der mobile PDF-Test verwendet prozentuale Koordinatenfelder und Maus-API-Aufrufe. Er belegt keine Bedienung mit dem Finger auf einem echten iPhone. Belege: [floorplan.e2e.spec.ts](../tests/floorplan.e2e.spec.ts), Zeilen 171–175 und 330–350; [e2e.spec.ts](../tests/e2e.spec.ts), Zeilen 428–461.

Für den nächsten Durchgang sind folgende Nachweise erforderlich:

1. Den neuen PDF-Ablauf und die Projektansicht nur mit Tastatur durchlaufen. Fokus nach Schrittwechsel, Fehlermeldung, Abbruch und Dialogschluss prüfen.
2. Sichtbare und vorgelesene Namen von Raumkarten, Auswahlfeldern und Schrittaktionen vergleichen. Ausgewählte Räume müssen auch ohne Farbe erkennbar sein.
3. Den Ablauf auf 390 × 844 px sowie bei vergrößerter Textdarstellung prüfen. Bildschirmkeyboard, lange Raumnamen und Scrollwechsel berücksichtigen.
4. In jeder neuen Ansicht einen automatischen Accessibility-Scan ausführen. Alle Befunde ansehen, auch wenn die technische Testsperre nur schwere Befunde bewertet.
5. Einen manuellen Screenreader-Durchgang getrennt dokumentieren. Ohne diesen Nachweis keine vollständige Screenreader-Unterstützung behaupten.

## Abnahme des Umbaus

- Die Projektansicht zeigt mindestens zwei Räume mit getrennten Verlegeplänen zugleich. Man muss dafür kein Dropdown bedienen.
- Einzelraum-Bearbeitung und Projektübersicht besitzen einen klaren Hin- und Rückweg. Der aktive Raum ist erkennbar.
- Der Wizard führt vom PDF-Öffnen bis zum fertigen Plan. Ein zweiter Raum kann im selben Ablauf entstehen.
- Wechsel und Abbruch verwerfen keine ungespeicherten Punkte ohne erkennbare Entscheidung.
- Die Vorlage 12 × 30 cm ist auswählbar und wird korrekt berechnet.
- Die [Ablaufprüfung](UX-ABLAEUFE.md) und die [Sichtprüfung](UI-FINISH-GATE.md) dokumentieren die Ergebnisse am überarbeiteten Stand.
- Neue Testläufe und Screenshots gehören zum umgebauten Stand. Dieser Ausgangsaudit allein ist keine Freigabe.
