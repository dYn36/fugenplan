# UI Finish-Gate — Projekt und Verlegeplan

Stand: 26. Oktober 2026. Entscheidung nach der eigenen Browserprüfung: **PASS** für den unten dokumentierten Stand.

Die geprüften Ansichten zeigen benannte Räume, deren tatsächliche Verlegepläne und die zugehörigen Bearbeitungsaktionen. Die Pflichtbefunde sind korrigiert und nachgeprüft. Der abschließende Bereinigungsdurchgang und der finale Gesamttest folgen getrennt; diese Entscheidung ersetzt sie nicht.

## Produkt und Aufgabe

Fugenplan unterstützt Personen, die einen Boden anhand eines Aufmaßes oder eines PDF-Grundrisses planen. Das Arbeitsobjekt ist der benannte Raum mit seiner Kontur und seinem Verlegeplan. Häufige Entscheidungen sind Raumwahl, Fliesenformat, Muster und Zuschnitte. Der PDF-Maßstab und das Ersetzen gespeicherter Daten benötigen eine erkennbare Folge. Die Oberfläche verwendet React, Manrope, grüne Zustandsfarben und Phosphor-Symbole. Diese Grundlage bleibt erhalten.

## Gestaltungsvertrag

Der verbindliche Umfang steht in [UX-DESIGN-VERTRAG.md](UX-DESIGN-VERTRAG.md). Für die Schlussprüfung gelten zusätzlich diese beobachtbaren Kriterien:

| Entscheidung | Begründung und Nachweis |
| --- | --- |
| Zuerst Raumname und berechneter Plan | In der Projektübersicht sollen Räume vergleichbar sein. Allgemeine Kennzahlen oder Einleitungstexte dürfen die Zeichnung nicht verdrängen. |
| Direkte Raumwahl | Sichtbare Namen und native Auswahlfelder erhalten den Zusammenhang zwischen Auswahl und Plan. Das Einblenden bleibt vom Entfernen getrennt. |
| Ausgewogene Dichte auf Desktop | Zwei Pläne stehen nebeneinander. Gleiche Vorschau-Maßstäbe zeigen Größenunterschiede. Angaben zu Format und Zuschnitten bleiben an ihrem Raum. |
| Plan vor Einstellungen auf schmalen Bildschirmen | Die Zeichnung und die Aktion zur Bearbeitung sind die Hauptaufgabe. Sprungaktionen verbinden Plan und Einstellungen. |
| Geführte PDF-Erfassung | Datei/Seite, bekannte Wand, Raumkontur und Abschluss bilden nachvollziehbare Schritte. Zurück und Abbrechen müssen den Zustand erklären. |
| Fachliche Hierarchie | Raumname → Kontur → Format/Zuschnitte → Bearbeiten. Keine dekorativen Kennzahlen, Farbverläufe oder austauschbaren Erfolgssprüche. |
| Erreichbare Bedienung | Geänderte Touch-Aktionen haben mindestens 44 × 44 px. Fokus, Auswahl, Fehler und gesperrte Aktionen sind erkennbar. |

## Vergleichsmuster

Die folgenden Herstellerquellen wurden am 26. Oktober 2026 gelesen. Sie begründen einzelne Bedienmuster. Ihre Gestaltung wird nicht kopiert.

| Quelle | Beobachtetes Muster | Übertragbare Entscheidung |
| --- | --- | --- |
| [magicplan: Import and Digitalize](https://help.magicplan.app/import-and-digitalize-an-existing-floor-plan) | Eine Vorlage wird zuerst an einer bekannten Strecke kalibriert. Danach werden Räume ergänzt. | Maßstab und Raumkontur sind getrennte Schritte. Ein zweiter Raum benötigt keinen neuen Dateiimport. |
| [SketchUp: Scaling Your Model](https://help.sketchup.com/en/sketchup/scaling-your-model-or-parts-your-model) | Zwei Punkte bilden die Referenz. Ein Zahlenwert bestimmt die neue Größe. Vor der Änderung folgt eine Bestätigung. | Die markierte Strecke, die Einheit und die Wirkung einer erneuten Kalibrierung müssen sichtbar sein. |
| [RoomSketcher: Trace a Floor Plan](https://www.roomsketcher.com/features/pro-features/draw-from-a-blueprint/) | Die bekannte Wand setzt den Maßstab. Die Vorlage bleibt beim Nachzeichnen als räumlicher Bezug erhalten. | Die PDF und ihre Raumkonturen bleiben im selben Arbeitsbereich. Text erklärt den nächsten Schritt, ersetzt aber nicht die Zeichnung. |

## Vorprüfung

Gelesen wurden die drei UX-Dokumente sowie `ProjectOverview`, `FloorPlanEditor`, `App`, `Dialog`, `useRoomPlans` und die zugehörigen Stile. Die folgenden Bilder zeigen einen Zwischenstand, keine Endabnahme:

- [Projekt auf Desktop](../screenshots/ux/projekt-desktop.jpg)
- [Projekt bei 390 × 844 px](../screenshots/ux/projekt-mobil.jpg)
- [PDF-Abschluss](../screenshots/ux/03-pdf-abschluss.jpg)
- [Weitere PDF-Seite](../screenshots/ux/04-pdf-mehrseitig.jpg)

| ID | Befund | Erforderliche Prüfung oder Änderung |
| --- | --- | --- |
| F1 | Im mobilen Zwischenbild beginnt die erste Zeichnung bei etwa y = 670 px. Einleitung, getrennte Aktionszeilen und Raumwahl belegen den größten Teil des Einstiegs. | Den oberen Bereich kürzen. Bei 390 × 844 px und zwei normal benannten Räumen muss die erste Planvorschau vollständig im ersten Bildschirm sichtbar sein. Die direkte Raumwahl bleibt erhalten. |
| F2 | Das mobile CSS setzt Hauptkopf- und normale Planwerkzeuge auf 31–36 px. Der PDF-Wizard verwendet bereits 44 px. | Die betroffenen Aktionen auf mindestens 44 × 44 px bringen und auf 390 sowie 320 px ohne horizontalen Überlauf prüfen. |
| F3 | Der PDF-Zoom lag zuvor über einer markierbaren Ecke. Der aktuelle Quellstand setzt die Leiste außerhalb der Zeichenfläche. | Den aktuellen Zustand im Browser prüfen. Eine Markierung an der unteren Raumkante darf kein Zoom-Werkzeug treffen. |

Die übergreifenden Korrekturen für Entwurfsschutz bei Rückgängig/Wiederholen, Beispielraum-Erkennung nach dem Neuladen und Varianten-Bestätigung bearbeitet der Hauptagent. Sie werden hier nach der Integration geprüft.

## Bereits passende Entscheidungen

- Die Übersicht zeigt tatsächliche Raumkonturen und Verlegepläne. Ihre Karten enthalten fachliche Daten und eine konkrete Bearbeitungsaktion.
- Ausblenden verändert die Vorschau, nicht die Raumdaten. Entfernen bleibt eine getrennte Aktion.
- Die Vorschauen verwenden denselben Maßstab innerhalb der Übersicht.
- Der Wizard bietet nach der Übernahme einen weiteren Raum sowie einen ausdrücklichen Weg zum Plan und zur Übersicht.
- Lade- und Berechnungsfehler werden an der betroffenen Vorschau angezeigt.

## Umgesetzte Korrekturen und Nachprüfung

| Befund | Korrektur | Eigenständig beobachtetes Ergebnis |
| --- | --- | --- |
| F1: Mobile Vorschau zu weit unten | Den wiederholten Einleitungstext nur auf schmalen Bildschirmen ausblenden und den Abstand vor der Raumwahl verkürzen. Beide Aktionen und die direkte Raumwahl bleiben sichtbar. | Bei 390 × 844 px liegt die erste Vorschau zwischen y = 604,05 und 794,05 px. Ihre Höhe beträgt 190 px. Sie ist vollständig im ersten Bildschirm sichtbar. |
| F2: Kleine Kopf- und Planaktionen | Mobile Schaltflächen auf 44 px vergrößern. Unter 361 px die Planwerkzeuge zwischen Auswahl/Verschieben und Zoom umbrechen. | Alle vier sichtbaren Kopfaktionen und alle sechs Planwerkzeuge messen bei 390 und 320 px jeweils 44 × 44 px. Kein horizontaler Dokumentüberlauf. Bei 320 px liegen die Werkzeuge in zwei Zeilen. |
| F3: Werkzeugleiste über der PDF | Der UX Architect hat die Leiste unter die Zeichenfläche verschoben. | Gemessen: Unterkante der Zeichenfläche und Oberkante der Werkzeugzeile liegen beide bei y = 912,38 px. Die Zeile überdeckt keine Zeichenfläche. |
| F4: Fokusverlust nach Sammelauswahl | „Alle anzeigen“, „Auswahl aufheben“ und die Wiederherstellung der leeren Auswahl fokussieren das erste Raumauswahlfeld. | Nach „Auswahl aufheben“ bleibt der Fokus beim Eingabefeld „Wohnzimmer“. Die leere Auswahl bietet einen sichtbaren Rückweg. |
| F5: Raumwechsel behält alten Scrollstand | Der Hauptagent fokussiert nach dem Öffnen eines Raums den Hauptbereich und scrollt zu dessen Anfang. | Vorher: Beim zweiten Raum stand die Überschrift bei y = −293,5 px, Fokus auf `BODY`. Nachher: Fokus auf `workspace-main`, Überschrift „Küche“ bei y = 36,5 px. |
| F6: Zweiter präziser Wandpunkt verliert den Fokus | Der Hauptagent setzt nach dem zweiten Punkt aus den Prozentfeldern den Fokus auf die neu verfügbare Wandlänge. Direkte Zeigereingaben bleiben unverändert. | Nach der Korrektur ist `INPUT` mit dem Namen „Länge der Wand“ fokussiert. 480 cm lassen sich direkt eingeben. |

Die Korrekturen F1, F2 und F4 liegen in `ProjectOverview.tsx`, `ProjectOverview.css` und `styles.css`. Die mit dem Hauptagenten abgestimmten Korrekturen F5/F6 liegen in dessen App-/Wizard-Bereich.

## Eigener Laufzeitnachweis

Bedienung über CUA im eingebetteten Chromium-Browser auf `http://localhost:5173/`. Geprüft wurden 1440 × 1000, 390 × 844 und 320 × 844 px. Die Messwerte stammen aus den tatsächlich gerenderten DOM-Rechtecken. Die verwendeten Räume und die PDF waren synthetische Testdaten. Der temporäre Viewport wurde zurückgesetzt und der Prüftab geschlossen.

| Prüffall | Ergebnis |
| --- | --- |
| Zwei Räume mit getrennten Belägen | Wohnzimmer 420 × 360 cm und Küche 270 × 220 cm stehen auf Desktop nebeneinander. Beide Flächen ergeben zusammen 21,06 m². Die Küche zeigt 12 × 30 cm, das Wohnzimmer weiterhin 60 × 30 cm. |
| Zuschnitte | Der gemeinsame Schalter markiert die zugeschnittenen Elemente in beiden Vorschauen. Sein aktiver Zustand bleibt lesbar. |
| Direkte Auswahl und leerer Zustand | Leertaste blendet das gewählte Zimmer aus. Die Anzeige wechselt zu „1 von 2 Räumen“. „Auswahl aufheben“ zeigt den leeren Zustand. Die Wiederherstellung zeigt beide Räume erneut. |
| Langer Raumname | „Küche mit angrenzendem Essbereich und sehr langem Namen“ bleibt in der Karte lesbar. Die Überschrift umbricht innerhalb von 260 px. Dokumentbreite minus Ansichtsbreite: 0 px bei 390 px. |
| Mobile Einzelansicht | Raumname, Reiter und Sprung zu den Einstellungen sind nach dem Öffnen sichtbar. Die sechs Werkzeuge passen bei 320 px in zwei Zeilen. |
| PDF-Maßstab und zwei Räume | PDF ausgewählt, Seite verwendet, Wand von 480 cm gesetzt, zwei Räume auf derselben Seite nacheinander übernommen. Beide Abschlüsse zeigen 480 × 520 cm. Der Wizard bleibt bis zur ausdrücklichen Navigation geöffnet. |
| Schrittfokus | „Seite verwenden“ fokussiert „Maßstab festlegen“. „Maßstab speichern“ fokussiert „Raum markieren“. Eine erfolgreiche Raumübernahme fokussiert „Raum übernommen“. |
| Verlauf und Entwurf | `Ctrl+Shift+Z` im PDF-Zeiger erhält drei Punkte, wenn kein Wiederholen möglich ist. Kopfaktion „Rückgängig“ öffnet bei diesem Entwurf die Rückfrage. „Weiter markieren“ erhält drei Punkte und den Namen „Bad PDF“. |
| Zielraum einer Variante | Die Bestätigung nennt „Wohnzimmer“ sowie Name, Kontur, Belag und Verlegung als ersetzte Daten. Escape schließt den Dialog und fokussiert die auslösende Schaltfläche „Variante laden“. |
| Berechnungsfehler | Ein auf 5000 × 5000 cm vergrößerter Raum erreicht die Grenze von 12.000 Elementen. Die betreffende Vorschau zeigt den Grund und eine Korrektur. Die übrigen drei Pläne bleiben sichtbar; die Flächensumme wird als „berechnet“ gekennzeichnet. Zweimal Rückgängig stellt den gültigen Ausgangsraum wieder her. |
| Ladezustand | Beim PDF-Import zeigt die Oberfläche „Datei wird geladen …“ und sperrt die Importaktion. Danach erscheint die geladene Seite. |

### Bilder des geprüften Stands

- [Mehrraumübersicht, Desktop](../screenshots/ux/finish-projekt-desktop.jpg)
- [Mehrraumübersicht, 390 × 844 px](../screenshots/ux/finish-projekt-mobil.jpg)
- [Leere Auswahl mit Tastaturfokus](../screenshots/ux/finish-leere-auswahl.jpg)
- [Einzelplan nach korrigiertem Raumwechsel](../screenshots/ux/finish-plan-mobil.jpg)
- [Planwerkzeuge bei 320 px](../screenshots/ux/finish-plan-320.jpg)
- [Wandmaß mit fokussiertem Längenfeld](../screenshots/ux/finish-pdf-massstab.jpg)
- [Zwei PDF-Räume und freie Zeichenfläche](../screenshots/ux/finish-pdf-abschluss.jpg)
- [PDF-Abschluss auf schmalem Bildschirm](../screenshots/ux/finish-pdf-mobil.jpg)
- [Benannter Zielraum der Variante](../screenshots/ux/finish-variante-zielraum.jpg)
- [Berechnungsfehler eines einzelnen Raums](../screenshots/ux/finish-raumfehler.jpg)

## Grenzen und weitere Freigabe

Der Hauptagent hat 167 bestandene Unit-Tests und fünf bestandene gezielte Browserregressionen für die zuletzt korrigierten Fokus-, Mobil- und Verlaufsfälle gemeldet. Diese Angaben sind ergänzende Testnachweise. Sie sind von der eigenen manuellen Sichtprüfung oben getrennt. Der vollständige finale Testlauf und Build stehen im Abschlussbericht des Hauptagenten.

Ein echter iPhone-Test, ein Bildschirmkeyboard, vergrößerte Betriebssystemschrift, ein manueller Screenreader-Durchgang und ein physischer Ausdruck wurden hier nicht geprüft. Es gibt keine Aussage über vollständige Barrierefreiheit oder physisch maßhaltigen Druck.

Für die dokumentierten Desktop- und Mobilansichten bleibt kein Pflichtbefund offen. Spätere Änderungen an Navigation, Dichte oder Werkzeuggrößen müssen die genannten Messwerte und Abläufe erneut erfüllen.
