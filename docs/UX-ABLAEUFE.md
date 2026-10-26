# Abläufe und UX-Prüfung

Stand: 26. Oktober 2026. Die folgende Bestandsaufnahme basiert auf dem Quellcode. Eine Quellprüfung ist kein Nachweis für eine erfolgreiche Bedienung im Browser. Laufzeitprüfungen werden unten getrennt festgehalten.

## Prozessinventar

| Prozess | Einstieg und Ergebnis | Korrektur, Abbruch und Fehler | Quellnachweis |
| --- | --- | --- | --- |
| Projekt öffnen | „Öffnen“ liest eine Projektdatei oder PDF. Projektdateien enthalten Räume und gegebenenfalls die PDF. | Fehlerhafte Dateien erhalten das aktuelle Projekt. Dateigröße und Schema werden geprüft. | `src/App.tsx`, `src/lib/workspace-file.ts` |
| Projekt sichern | „Exportieren“ → „Projektdatei“ sichert alle Räume, Maßstäbe und die Original-PDF. | Fehlende PDF-Daten werden als Exportfehler angezeigt. Varianten gehören nicht zur Projektdatei. | `src/App.tsx`, `src/lib/workspace-file.ts` |
| Projekt neu beginnen | „Neuer Plan“ öffnet einen Bestätigungsdialog. | Abbrechen erhält das Projekt; Rückgängig stellt das ersetzte Projekt wieder her. Varianten bleiben erhalten. | `src/App.tsx` |
| Räume verwalten | Raum auswählen, hinzufügen, benennen und entfernen. Jeder Raum hält eigene Belag- und Verlegeeinstellungen. | Entfernen ist rückgängig. Das Projekt behält mindestens einen Raum. | `src/App.tsx`, `src/lib/workspace.ts` |
| Rechteck und L-Form | Unter „Raum“ Form und Innenmaße eingeben. | Eingabefelder prüfen Werte. Enter oder Fokuswechsel übernimmt, Escape verwirft die Feldeingabe. | `src/components/Controls.tsx` |
| Freie Raumkontur | „Kontur zeichnen“ setzt Eckpunkte im Plan; Eckpunktfelder erlauben genaue Koordinaten. | Letzten Punkt entfernen, Zeichnen abbrechen, Fehler bei ungültiger Kontur. Eine neue Kontur hebt den bisherigen Start auf. | `src/components/Controls.tsx`, `src/components/PlanCanvas.tsx` |
| Hindernisse | Rechteckige Hindernisse hinzufügen und ihre Lage und Größe eingeben. | Entfernen und Rückgängig; ungültige Geometrie wird im Plan gemeldet. | `src/components/Controls.tsx`, `src/lib/geometry.ts` |
| PDF öffnen | „Grundriss“ → Datei wählen oder ablegen; PDF-Seite wählen. | Leere, falsche, zu große oder nicht lesbare Dateien erzeugen einen Fehler. Die bisherige Planung bleibt erhalten. | `src/components/FloorPlanEditor.tsx`, `src/lib/pdf.ts` |
| PDF kalibrieren | Zwei Endpunkte einer bekannten Wand setzen und die reale Länge in cm speichern. | Letzten Punkt entfernen, abbrechen oder Maßstab neu setzen. Eine neue Kalibrierung ändert die zugeordneten Raummaße derselben Seite. | `src/components/FloorPlanEditor.tsx`, `src/lib/calibration.ts` |
| PDF-Raum übernehmen | Innere Raumecken markieren, Namen eingeben und Kontur übernehmen. | Punktkorrektur, Abbruch, Prüfung von Kontur und Größe. Mindestens drei und höchstens 32 Punkte. | `src/components/FloorPlanEditor.tsx`, `src/lib/workspace.ts` |
| PDF-Ansicht bedienen | Zoomen, Seite einpassen und Ziehen verschieben die Ansicht. Markierungen bleiben in PDF-Koordinaten. | Tastaturzeiger und Prozentfelder bieten zusätzliche Eingaben. | `src/components/FloorPlanEditor.tsx` |
| PDF wiederherstellen | Dieselbe PDF erneut öffnen, wenn der Browserspeicher fehlt. | Die Dateikennung erhält die Raumzuordnung. Eine andere PDF löst alte Zuordnungen, erhält aber Raumpläne. | `src/App.tsx`, `src/lib/workspace.ts`, `src/lib/pdf-storage.ts` |
| Belag wählen | „Belag“ → Fliese oder Diele, Formatvorgabe oder eigene Maße, Fuge, Randfuge und Darstellung. | Numerische Grenzen und Rückgängig. Produktmaße werden unabhängig von der Fuge gespeichert. | `src/components/Controls.tsx` |
| Bedarf einstellen | Stück je Paket, Reserve und Grenzwert für schmale Zuschnitte bestimmen. | Mengen werden nach einer gültigen Änderung neu berechnet. | `src/components/Controls.tsx`, `src/lib/geometry.ts` |
| Verlegemuster einstellen | Sieben Muster, Winkel und X/Y-Versatz unter „Verlegung“. | Rückgängig; ungültige oder zu aufwendige Pläne zeigen einen Fehler. | `src/components/Controls.tsx`, `src/lib/usePlan.ts` |
| Startfliese setzen | „Start wählen“ → Ecke oder Wandmitte → Punkt im Plan oder in der Liste. | Escape und Abbrechen erhalten den alten Start. Neu ausrichten, Start aufheben und Zentrieren sind eigene Aktionen. | `src/components/StartPicker.tsx`, `src/components/StartControls.tsx` |
| Planansicht einstellen | Maße, Zuschnitte und Achsen umschalten; zoomen, einpassen oder Ansicht verschieben. | Ansichtsänderungen ändern keine Raum- oder Produktmaße. | `src/App.tsx`, `src/components/PlanCanvas.tsx` |
| Verband verschieben | Zeichenwerkzeug „Verband verschieben“ ziehen. | Vorschau zeigt X/Y; Loslassen übernimmt. Rückgängig stellt den alten Versatz wieder her. | `src/components/PlanCanvas.tsx` |
| Elemente prüfen | Element anklicken oder per Tastatur wählen. Details zeigen Kontur, Hüllmaß und Kantenlängen. | Details schließen oder Escape. Schmale Zuschnitte lassen sich über den Hinweis öffnen. | `src/components/PlanCanvas.tsx`, `src/App.tsx` |
| Varianten vergleichen | Variante benennen und merken; Variantenansicht öffnet, lädt oder löscht gespeicherte Stände. | Speichern prüft das Limit von zwölf Varianten und meldet Speicherfehler. | `src/App.tsx`, `src/lib/project.ts` |
| SVG und CSV exportieren | „Exportieren“ sichert Plan und Elementliste für den aktiven Raum. | SVG verwendet den gewählten Maßstab. CSV enthält die einzelnen Schnittkonturen. | `src/App.tsx`, `src/lib/export.ts` |
| Drucken oder PDF erzeugen | Maßstab wählen und „Drucken / PDF“ öffnen. | A4-Übergröße sperrt den Druckaufruf und erklärt den erforderlichen kleineren Maßstab. | `src/App.tsx`, `src/lib/export.ts` |
| Hilfe lesen | Hilfeschaltfläche erklärt Ablauf, Genauigkeit und Speicherung. | Dialog lässt sich per Schließen, Escape oder Klick auf den Hintergrund schließen. | `src/App.tsx`, `src/components/Dialog.tsx` |
| Änderungen zurücknehmen | Rückgängig / Wiederholen in der Kopfzeile oder mit Strg/⌘ Z und Umschalt. | Felder behalten ihre eigene Eingabekorrektur; PDF-Zeiger kann einzelne Punkte zurücknehmen. | `src/App.tsx`, `src/components/Controls.tsx`, `src/components/FloorPlanEditor.tsx` |
| Lokale Wiederaufnahme | Browser speichert Projektdaten und PDF getrennt. Neu laden stellt den gespeicherten Stand wieder her. | Fehler und fehlende PDF werden sichtbar gemeldet. Projektdateien dienen als unabhängige Sicherung. | `src/App.tsx`, `src/lib/workspace.ts`, `src/lib/pdf-storage.ts` |

## Struktur des PDF-Assistenten

1. **PDF und Seite wählen:** Datei öffnen, Seite prüfen, dann „Seite verwenden“.
2. **Maßstab festlegen:** Bekannte Wand markieren, Länge in cm eingeben und speichern. Bereits gespeicherte Maßstäbe können übernommen oder neu gesetzt werden.
3. **Raum markieren:** Innenecken und Name eingeben. Punktkorrektur bleibt im aktuellen Schritt erreichbar. Die letzte Kante wird beim Übernehmen geschlossen.
4. **Raum übernommen:** Raumplan prüfen, weiteren Raum auf derselben Seite markieren oder die Projektansicht öffnen.

Die Schrittnavigation zeigt den aktuellen Schritt. Vorhandene Voraussetzungen erlauben den Rückweg. Ein Rückweg innerhalb derselben Seite erhält den Entwurf. Ein Seiten- oder Dateiwechsel warnt vor einem ungespeicherten Entwurf. Die Anwendung erhält über `onDraftChange` denselben Zustand für Ansichtswechsel.

Layout: vorhandene Schrift, Farben und Schaltflächen bleiben bestehen. Desktop zeigt das aktuelle Formular links und die PDF rechts. Auf kleinen Bildschirmen steht das aktuelle Formular vor der PDF. Beim Markieren direkt auf der PDF wird der Fokus nicht automatisch verschoben. Nach dem zweiten Wandpunkt über die Prozentfelder folgt die Eingabe der Wandlänge. Die Schaltfläche unter der PDF führt auf Wunsch zum nächsten Eingabefeld. Auch die Zoomleiste steht außerhalb der Zeichenfläche. Ein bestätigter Schrittwechsel setzt den Fokus auf die neue Schrittüberschrift.

## Laufzeitprüfung

Durchgeführt am 26. Oktober 2026 durch den UX Architect. Browser: eingebetteter Chromium-Browser, `http://localhost:5173/`, Desktop mit 1280 × 720 px und schmale Ansicht mit 390 × 844 px. Die Bedienung erfolgte über echte Browseraktionen mit Maus, Tastatur und Dateiauswahl. Die Testdaten waren ausdrücklich für diesen Durchgang freigegeben. Es wurden keine echten Baupläne verwendet.

PDF-Testdatei: `tests/fixtures/grundriss-drei-seiten.pdf`. Seite 1 enthält Vektorgrafik, Seite 2 ist um 90 Grad gedreht, Seite 3 enthält ein Rasterbild. Für Fehlerfälle wurden eine leere PDF und eine syntaktisch ungültige JSON-Datei verwendet. Eine Kopie der PDF mit anderem Dateiinhalt diente dem Ersetzungsdialog.

| Prozessgruppe | Durchgeführte Bedienung | Beobachtetes Ergebnis |
| --- | --- | --- |
| Projektübersicht | Zwei Räume gemeinsam anzeigen; Auswahl aufheben und wiederherstellen; fünf PDF-/manuelle Räume anzeigen; einen Raum öffnen | Mehrere Pläne sind gleichzeitig sichtbar. Leere Auswahl wird erklärt. Einzelbearbeitung und Rückweg sind erreichbar. Die Auswahl entfernt keinen Raum. |
| Raumverwaltung | Raum hinzufügen, langen Namen eingeben, wechseln; Entfernen abbrechen, bestätigen, rückgängig machen und wiederholen | Der Name erscheint in Auswahl und Plan. Der Löschdialog nennt den Raum. Der Verlauf stellt ihn wieder her. |
| Rechteck und L-Form | Maße ändern; negative Breite eingeben, mit Escape zurücknehmen; L-Form wählen | Ungültige Eingabe zeigt „Erlaubt: 10 bis 5000 cm.“ Der gültige Wert bleibt erhalten. Die L-Form ändert die Vorschau. |
| Freie Kontur | Eckpunktfeld ändern; Undo/Redo; vier Punkte im Plan setzen; letzten Punkt entfernen und neu setzen; Kontur übernehmen | Die neue Kontur erscheint im Plan und in den Feldern. Korrektur und Übernahme funktionieren. |
| Hindernisse | Rechteck hinzufügen, Breite ändern und entfernen | Die freie Fläche und die Zuschnitte ändern sich. Entfernen stellt die unbeschnittene Raumfläche wieder her. |
| Belag und Bedarf | Fliese/Diele wechseln; 12 × 30 cm wählen; eigenes Maß 13 cm eingeben; Darstellung, Reserve und Paketmenge ändern | Vorgabe und Felder stimmen überein. Der Plan zeigt das gewählte Format. Die Mengenberechnung reagiert auf die Eingaben. |
| Muster und Lage | Alle sieben Muster wählen; Drehung 45°; Versatz eingeben; Verband mit Maus verschieben; zentrieren | Auswahl und Vorschau wechseln. Ziehen aktualisiert X/Y. Zentrieren setzt einen gewählten Start zurück. |
| Startwahl | Wandmitte per Tastatur wählen; abbrechen; Ecke über Liste wählen; Startfliese prüfen; Versatz ändern; neu ausrichten; Start aufheben | Auswahl und Startmarkierung stimmen überein. Abbruch erhält den bisherigen Start. Die Detailansicht nennt das Elementmaß. |
| Ansicht und Elemente | Maße, Achsen und Zuschnitte schalten; zoomen, einpassen, Ansicht verschieben; Pos1 und Elementdetails mit Kantenmaßen | Ansichtsaktionen ändern nicht die Raummaße. Elementdetails bleiben über Tastatur erreichbar. |
| Varianten | Zwei Varianten merken; Muster ändern; Variante mit Zielraumdialog laden; gespeicherte Varianten löschen | Laden stellt den gemerkten Stand her. Die übrigen Raumpläne bleiben erhalten. Löschen entfernt die Variante aus der Liste. |
| Projektdatei | Projekt mit zwei manuellen Räumen exportieren; später fünf Räume mit Original-PDF exportieren und wieder importieren | Tatsächliche Downloads wurden erzeugt. Import stellt fünf Räume mit den Zuordnungen zu den drei PDF-Seiten wieder her. |
| SVG und CSV | Maßstab 1:25 wählen; beide Dateien herunterladen | SVG- und CSV-Dateien werden heruntergeladen. Der Exportdialog nennt den aktiven Raum und unterscheidet ihn von der vollständigen Projektdatei. Die inhaltliche Exportprüfung gehört zusätzlich zu den automatischen Tests. |
| Drucken/PDF | Maßstab 1:10, dann 1:25; Druckaktion auslösen | Bei Übergröße ist Drucken gesperrt und erklärt. Bei passendem Maßstab ist es freigegeben. Der eingebettete Browser zeigte keine native Druckvorschau; deren Bedienung ist hier nicht nachgewiesen. |
| Hilfe und neuer Plan | Hilfe öffnen und mit Escape schließen; neuen Plan abbrechen, bestätigen, rückgängig machen und wiederholen | Die Hilfe erklärt Maße, Bedarf, Speicherung und PDF-Grenzen. Reset betrifft das Projekt. Rückgängig stellt den vorherigen Stand wieder her. |
| PDF-Einstieg | PDF wählen, Seite prüfen und „Seite verwenden“ auslösen | Die Oberfläche zeigt den aktuellen Schritt. Wandlänge und Raumnamen stehen erst im zugehörigen Schritt. |
| Maßstab | Zwei Wandpunkte, Länge 0 als Fehler, danach 480 cm; letzten Punkt korrigieren; abbrechen; zurück zur PDF-Auswahl und wieder vor | Länge 0 wird abgelehnt. Rücknavigation auf derselben Seite erhält die Punkte. Bestätigter Abbruch löscht die aktive Markierung. |
| Mehrere PDF-Räume | Zwei Räume auf Seite 1 nacheinander markieren; Raumkontur zwischen Schritt 2/3 behalten; Raum prüfen und Projekt öffnen | Nach dem Speichern bleibt der Wizard offen. Namen und Punkte bleiben auf Rückwegen erhalten. Der Abschluss nennt die Projektzahl und die Räume der Seite. |
| Seiten und Kalibrierung | Seite 2 mit 200 cm kalibrieren und Raum 120 × 200 cm erzeugen; Seite 3 mit 300 cm kalibrieren und Raum 300 × 360 cm erzeugen | Gedrehte Seite und Rasterseite sind bedienbar. Die Maßstäbe sind getrennt. Seite 2 erneut auf 220 cm gesetzt ergibt 132 × 220 cm; Undo stellt 120 × 200 cm wieder her. |
| Seitenwechsel und Hauptansicht | Bei gesetzten Punkten die Seite wechseln; Dialog abbrechen; bei geändertem Raumnamen die Projektansicht wählen; weiter markieren | Vor dem Verwerfen erscheint eine Entscheidung. „Weiter markieren“ erhält Namen und Punkte. |
| PDF-Raum entfernen | Inline-Entfernen abbrechen, bestätigen, rückgängig machen | Raumzahl und Seitenliste ändern sich passend. Undo stellt den Raum wieder her. |
| Datei- und Importfehler | Leere PDF und defekte Projektdatei öffnen | Beide Fehler werden sichtbar gemeldet. Die fünf vorhandenen Räume und die bisherige PDF bleiben erhalten. |
| PDF ersetzen | Dieselbe PDF erneut öffnen; andere PDF abbrechen und anschließend bestätigen | Dieselbe PDF erhält Räume und Maßstäbe. Der Ersetzungsdialog erklärt den Verlust der Zuordnung. Nach Bestätigung bleiben alle fünf Raumpläne als manuelle Räume erhalten. |
| Wiederaufnahme | Browser nach dem Speichern neu laden; PDF öffnen; vollständige Sicherung wieder importieren | Fünf Räume und die PDF werden lokal wiederhergestellt. Auf Seite 2 sind Raum 120 × 200 cm und Wandmaß 200 cm weiterhin sichtbar. |
| Mobile Projekt-/Planansicht | 390 × 844 px; Raum hinzufügen; langer Name; Einstellungen öffnen; 12 × 30 cm; zurück zur Vorschau | Der Plan steht vor den Einstellungen. Die Sprungaktionen funktionieren. Gemessen: 390 px Dokumentbreite bei 390 px Ansichtsbreite, auch mit langem Namen. |
| Mobiler PDF-Assistent | Wandpunkte mit Enter und Umschalt/Pfeil setzen; „Wandlänge eingeben“; Abbruchdialog/Escape; vier präzise Raumpunkte mit Korrektur; Seitenwechsel abbrechen; Raum übernehmen | Punktsetzen behält den Fokus im Plan. Die ausdrückliche Weiter-Aktion fokussiert das Eingabefeld. Der gespeicherte Test-Raum misst 240 × 240 cm. Alle Abschlussaktionen sind erreichbar. |

### Befunde während des Durchgangs

- **Zoomleiste verdeckt eine Raumecke:** Der automatisierte Zeigertest traf bei 125 % Zoom die Leiste. Die Leiste und die mobile Weiter-Aktion wurden unter die Zeichenfläche versetzt. Im anschließenden manuellen Durchgang waren die unteren Ecken erreichbar. Der erneut ausgeführte Zeigertest des Hauptagenten bestätigte vier Ecken und 24,96 m².
- **Unlesbarer aktiver Zuschnittschalter:** In der Projektübersicht war der aktive Zustand unter dem Mauszeiger zu hell. Der Hauptagent verwendet dafür nun die vorhandene primäre Schaltfläche. Das aktualisierte Desktop-Bild und das mobile Bild zeigen lesbare Beschriftung.
- **Beispielraum nach Wiederaufnahme nicht erkannt:** Der Vergleich über `JSON.stringify` hing von der Reihenfolge der Objektschlüssel ab. Nach dem Laden änderte sich diese Reihenfolge. Der gemeinsame semantische Vergleich in `project.ts` ersetzt diesen Vergleich. Die bewusste Ersetzen-Option gilt weiterhin nur für einen unveränderten Beispielraum ohne PDF-Zuordnung.
- **Projektverlauf verwirft PDF-Entwurf:** Bei geändertem Namen im Wizard verwarf die Kopfaktion „Rückgängig“ den Entwurf ohne Rückfrage. Der Hauptagent hat den Verlauf geschützt. Gezielte Nachprüfung: Die Kopfaktion öffnet jetzt „Markierung verwerfen?“. „Weiter markieren“ erhält den Namen und erlaubt die spätere Übernahme.
- **Fokus nach Schrittaktion und Dialogschluss:** Nach dem Entfernen der aktiven Schaltfläche landete der Fokus auf `BODY`. Der Wizard fokussiert jetzt nach bestätigtem Schrittwechsel die jeweilige Überschrift. Der Hauptagent hat die Fokus-Rückgabe im gemeinsamen Dialog korrigiert. Per DOM-Lesung nachgeprüft: „Maßstab prüfen“ fokussiert `H2` mit „Maßstab festlegen“; Escape im Abbruchdialog fokussiert die auslösende Schaltfläche „Abbrechen“; erfolgreiche Raumübernahme fokussiert `H2` mit „Raum übernommen“. Punktmarkierungen direkt auf der PDF lösen keinen Fokuswechsel aus.

### Sichtbare Belege

- [Projekt mit mehreren Räumen, Desktop](../screenshots/ux/01-projekt-mehrraum.jpg)
- [PDF und Seite wählen](../screenshots/ux/02-pdf-schritt-1.jpg)
- [PDF-Raum übernommen](../screenshots/ux/03-pdf-abschluss.jpg)
- [Gedrehte PDF-Seite und eigener Maßstab](../screenshots/ux/04-pdf-mehrseitig.jpg)
- [Dateifehler bei erhaltenem Projekt](../screenshots/ux/05-dateifehler.jpg)
- [Rückfrage vor PDF-Ersatz](../screenshots/ux/06-pdf-ersetzen.jpg)
- [Projektübersicht mit 390 px Breite](../screenshots/ux/07-mobil-projekt.jpg)
- [Mobile Vorschau mit 12 × 30 cm](../screenshots/ux/08-mobil-plan-12x30.jpg)
- [Mobile PDF-Markierung mit freier Zeichenfläche](../screenshots/ux/09-mobil-pdf-markierung.jpg)
- [Mobiler Abschluss mit Raummaßen und Weiter-Aktionen](../screenshots/ux/10-mobil-pdf-abschluss.jpg)
- [Fokus nach erfolgreicher Raumübernahme](../screenshots/ux/11-schrittfokus.jpg)

### Grenzen der Prüfung

Der Durchgang deckt alle Prozessgruppen ab. Er ist keine vollständige Prüfung aller Grenzwerte. Die Grenzen von 20 MiB, 32 Eckpunkten, zwölf Varianten und 50 Räumen wurden hier nicht jeweils manuell ausgeschöpft. Die Wiederherstellung bei absichtlich gelöschtem IndexedDB-Eintrag gehört zum automatisierten Test `Fehlende PDF in IndexedDB lässt sich ohne Verlust der Räume und Maßstäbe wiederherstellen`.

Die schmale Ansicht ist ein Browserfenster mit 390 × 844 px. Es wurde kein echtes iPhone, kein Bildschirmkeyboard und kein Screenreader verwendet. Eine vergrößerte Betriebssystemschrift wurde nicht geprüft. Es gibt daher keine Aussage über vollständige Barrierefreiheit, echte Touch-Bedienung oder physisch maßhaltigen Druck. Die separat ausgeführten Browser- und Geometrietests ergänzen diesen Bediennachweis; ihre Ergebnisse stehen im Abschlussbericht des Hauptagenten.
