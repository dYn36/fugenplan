# Fugenplan bedienen

Installation und Schnellstart stehen in der [README](../README.md).

## Projekte, Etagen und Räume

Unter **Projekte** legst du getrennte Planungen an. Benenne ein Projekt und füge seine Etagen hinzu, zum Beispiel Erdgeschoss und Obergeschoss. Jede Etage besitzt eigene Räume und einen eigenen PDF-Seitenbezug. Bereits gespeicherte Planungen werden übernommen. Alte Räume verschiedener PDF-Seiten erscheinen in getrennten Etagen mit Namen wie „Seite 1“. Benenne diese passend zu deinem Gebäude um.

Die Etagenliste links wechselt zwischen den Geschossen. Auf dem Smartphone öffnet **Etagen** dieselbe Auswahl. Der Pfad oberhalb der Ansicht zeigt Projekt, Etage und gegebenenfalls den geöffneten Raum. **Projekte** führt zur Sammlung zurück.

Die Etagenansicht zeigt die Räume **an ihrer tatsächlichen Position in der PDF**. Die Verlegepläne verwenden gemeinsam einen Maßstab. Abstände zwischen den markierten Konturen bleiben erhalten. **Vorlage** blendet die Original-PDF ein oder aus. **Zuschnitte** markiert die angeschnittenen Elemente. Ziehen verschiebt die Ansicht; Plus, Minus und Einpassen ändern die Ansicht, nicht die Raummaße.

Manuell angelegte Räume erscheinen zuerst unter **Noch nicht angeordnet**. Mit **Anordnen** öffnest du die Eingabe für X und Y in Zentimetern. X zählt nach rechts, Y nach unten. Die Position versetzt den lokalen Raumursprung. Bei einer PDF ist deren linke obere Ecke der gemeinsame Ursprung der Etage. **Position aufheben** entfernt nur die Platzierung. Die Kontur und der Verlegeplan bleiben erhalten.

Mit **Räume anordnen** kannst du bereits platzierte manuelle Räume direkt in der Zeichnung verschieben. Erst beim Loslassen wird die neue Position gespeichert. Escape bricht die Verschiebung ab. **Rückgängig** stellt die vorige Position wieder her. Räume aus einer PDF behalten ihre gemessene Position. Über **Position ändern** kannst du die Koordinaten auch mit der Tastatur eingeben.

Klicke einen Raum im Grundriss oder in der Raumliste an. **Etage** führt vom Einzelplan zurück zur gemeinsamen Zeichnung. Bei mehreren Etagen kannst du in den Raumeinstellungen **Raum in andere Etage verschieben** wählen. Die Raumgeometrie und der Belag bleiben erhalten. Die alte PDF-Zuordnung und Position werden dabei gelöst. Ordne den Raum anschließend auf der Zieletage an.

Über das Menü neben einem Projekt oder einer Etage kannst du den Namen ändern oder den Eintrag entfernen. Vor dem Entfernen nennt die Bestätigung den Namen und die Zahl der betroffenen Räume. **Rückgängig** stellt die Änderung während der Sitzung wieder her. Auch leere Projekte und Etagen sind möglich.

Auf dem Smartphone steht der Raumplan vor den Einstellungen. **Raum und Belag einstellen** und **Zur Planvorschau** verbinden beide Bereiche.

## Einen Boden planen

Öffne zuerst einen Raum aus der Etagenansicht.

1. **Raum:** Innenmaße in Zentimetern eingeben. Rechteck, L-Form oder eigene Eckpunkte wählen. Hindernisse bei Bedarf ergänzen.
2. **Belag:** Das tatsächliche Werkmaß eingeben oder eine Formatvorgabe wählen, zum Beispiel **12 × 30 cm**. Fugenbreite und Randabstand in Millimetern festlegen. Fliesen und Dielen werden als Rechtecke gerechnet.
3. **Verlegung:** Über dem Raumplan „Start wählen“ anklicken. Dann eine Ecke oder Wandmitte direkt im Plan wählen. Muster wählen, drehen und verschieben. „Zentrieren“ richtet das Raster an der Raumbegrenzung aus und hebt die Startauswahl auf. Mit dem Werkzeug „Verband verschieben“ lässt sich die Position auch ziehen.
4. **Prüfen:** Ein Element anklicken. Die Ansicht zeigt seine Schnittkontur, das Hüllmaß und die Kantenlängen. „Zuschnitte“ markiert alle angeschnittenen Elemente.
5. **Vergleichen:** Mit „Variante merken“ bis zu zwölf Stände speichern. Jeder Stand enthält Raum, Belag und Verlegung. Vor dem Laden nennt eine Bestätigung den Zielraum und die Daten, die ersetzt werden.
6. **Sichern:** Unter „Exportieren“ eine Projektdatei, SVG-Grafik oder CSV-Elementliste laden. „Drucken / PDF“ öffnet den Druckdialog.

Verfügbare Muster: Kreuzverband, Halbverband, Drittelverband, Viertelverband, Wilder Verband, Diagonalverband und Fischgrät. Diagonalverband und Fischgrät beginnen bei 45°. Das Winkelfeld dreht diese Muster zusätzlich.

Dezimalkomma und Dezimalpunkt sind möglich. Enter oder ein Fokuswechsel übernimmt die Eingabe. Escape verwirft die aktuelle Feldeingabe. Strg/⌘ Z nimmt eine Änderung zurück. Strg/⌘ Umschalt Z stellt sie wieder her. Im fokussierten Plan wählen Pfeiltasten ein Element; Escape schließt die Details. Freie Raumkonturen sind auch vollständig über die Eckpunktfelder bedienbar.

## Startfliese festlegen

1. **Direkt im Raumplan:** Über dem großen Plan „Start wählen“ beziehungsweise „Start ändern“ anklicken. „Ecke“ oder „Wandmitte“ wählen und auf den gewünschten Punkt klicken. Die Punkte liegen an den tatsächlichen Raumecken oder Wandmitten. Das funktioniert auch bei L-Formen und freien PDF-Konturen. Die Auswahl ist unabhängig vom geöffneten Seitenreiter. „Im Raumplan wählen“ unter „Verlegung“ öffnet dieselbe Auswahl.

   Ziehen verschiebt die Ansicht. Plus und Minus ändern den Zoom. Eng beieinanderliegende Punkte lassen sich zusätzlich unter „Aus Liste wählen“ erreichen. Tab erreicht die Punkte; Enter oder Leertaste übernimmt. Escape oder „Abbrechen“ beendet die Auswahl ohne Änderung. Öffnen und Wechseln zwischen Ecke und Wandmitte verändern den Plan noch nicht. Erst die Wahl eines Punktes übernimmt den Start und setzt X/Y auf null. Rückgängig stellt die vorige Position mit ihrem Versatz wieder her.
2. **Ausrichten:** An einer Ecke wird das Raster an den beiden angrenzenden Wänden ausgerichtet. Bei „Wandmitte“ liegt die erste Rasterfliese mittig an dieser Wand. Die Randfuge bleibt frei. Die Drehung bleibt erhalten. Bei geraden, zum Belag parallelen Wänden beginnt der Plan mit einer ganzen Fliese, sofern Platz dafür vorhanden ist.
3. **Start prüfen:** Die grüne Markierung „Start 1“ zeigt das verlegbare Element, das der gewählten Startstelle am nächsten liegt. Bei schrägen Wänden, gedrehten Mustern oder Hindernissen kann dies ein Zuschnitt sein. „Startfliese prüfen“ öffnet seine Kontur und Kantenmaße. Bei einem Hindernis an der Startstelle wird das nächste verlegbare Element markiert.
4. **Zuschnitt anpassen:** „Versatz X/Y“ verschiebt das Raster relativ zur gewählten Startposition. „Am Start neu ausrichten“ setzt den Versatz auf null. Eine neue Ecke oder Wand setzt den Versatz ebenfalls auf null. Zuschnitte, Mengen und Verschnitt werden neu berechnet. „Variante merken“ speichert die Startauswahl zum Vergleich mit anderen Aufteilungen.
5. **Speichern:** Die Auswahl gilt je Raum und bleibt bei neuen Raummaßen, Produktmaßen, Randfugen und einer PDF-Neukalibrierung erhalten. Rückgängig, Wiederholen, Projektdateien und Varianten enthalten die Auswahl. SVG und Druck zeigen den Startmarker. Die CSV kennzeichnet Element 1 als Startfliese. Die übrige Nummerierung ist keine vorgegebene Verlegereihenfolge.

„Start aufheben“ unter „Verlegung“ entfernt die Startbindung und setzt den Versatz auf null. „Belag zentrieren“ entfernt die Startbindung und berechnet einen mittigen Versatz. Bei einer neuen Raumform, einer neu gezeichneten Kontur oder hinzugefügten/entfernten Eckpunkten muss der Start erneut gewählt werden. Änderungen an den Koordinaten vorhandener Eckpunkte erhalten die Auswahl, solange die Anzahl der wirksamen Ecken gleich bleibt. Wird der letzte Punkt auf den ersten gesetzt, muss der Start neu gewählt werden.

## Räume aus einer PDF übernehmen

1. **Grundriss öffnen:** In der gewünschten Etage „PDF-Grundriss laden“ oder den Reiter „Grundriss“ wählen. Eine PDF auswählen oder in die Fläche ziehen. Die gewünschte PDF-Seite wählen und „Seite verwenden“ anklicken. Bei einem unveränderten Beispielraum kannst du wählen, ob der erste übernommene PDF-Raum ihn ersetzen soll.
2. **Wand markieren:** „Wand markieren“ wählen. Den Anfang und das Ende einer bekannten Wand anklicken. Für genaue Punkte die Ansicht vergrößern. Ziehen verschiebt die Ansicht.
3. **Maßstab speichern:** Die tatsächliche Wandlänge in **Zentimetern** eingeben. „Maßstab speichern“ wählen. Beispiel: Für eine 4,80 m lange Wand `480` eingeben.
4. **Raum markieren:** „Raum markieren“ wählen. Die inneren Raumecken der Reihe nach anklicken. Einen Namen eingeben und „Raum übernehmen“ wählen. Die letzte Kante wird geschlossen. Der Assistent zeigt den gespeicherten Raum im Schritt „Prüfen“.
5. **Prüfen oder weiterzeichnen:** „Raum prüfen“ öffnet den Einzelplan. „Weiteren Raum markieren“ beginnt die nächste Kontur im selben Grundriss. „Zur Etagenansicht“ zeigt die Räume in ihrer tatsächlichen Anordnung. Jeder Raum hat eigene Belag- und Verlegeeinstellungen.
6. **Projekt sichern:** „Exportieren“ → „Projektdatei“ speichert alle Etagen, Räume, Maßstäbe und Original-PDFs des Projekts. SVG, Druck und CSV beziehen sich auf den aktiven Raum.

Jede Etage hat einen eigenen PDF-Seitenbezug und Maßstab. Wenn die aktuelle Etage bereits PDF-Räume enthält, bietet eine andere PDF-Seite eine eigene Etage an. Beim Anlegen einer Etage kannst du auch eine vorhandene PDF und deren gewünschte Seite wählen. Eine neue Kalibrierung passt alle zugeordneten Räume dieser Seite sowie deren Hindernisse an. Produktmaße und Verlegeeinstellungen bleiben erhalten. Änderungen der Raumkontur in den normalen Raumfeldern erscheinen auch in der PDF. Rückgängig und Wiederholen umfassen diese Änderungen.

Die Schrittleiste führt zurück zu vorherigen Eingaben. Ein ungespeicherter Entwurf bleibt beim Zurückgehen erhalten. Vor einem Seitenwechsel, Ansichtswechsel oder Abbruch fragt die App, ob die Markierung verworfen werden soll. Auch „Rückgängig“ und „Wiederholen“ in der Kopfzeile schützen einen offenen Entwurf durch diese Rückfrage.

Die PDF kann Vektoren oder ein gescanntes Bild enthalten. Die Anwendung erkennt Räume nicht automatisch. Die Kalibrierung setzt einen gleichmäßigen Maßstab in beide Richtungen voraus. Verzerrte Scans müssen vorher korrigiert werden. Die Genauigkeit hängt von der Vorlage und den markierten Punkten ab. Prüfe deshalb ein zweites bekanntes Maß am übernommenen Raum.

Tastatur: Im PDF-Zeichenbereich verschieben Pfeiltasten den Zeiger; Enter setzt einen Punkt. Umschalt vergrößert den Schritt. Plus und Minus ändern den Zoom. Unter „Punkte per Tastatur eingeben“ lassen sich Positionen als Prozentwerte der Seite eingeben. Nach dem zweiten Wandpunkt über diese Felder ist das Feld für die Wandlänge aktiv. Escape bricht die Markierung ab. „Letzten Punkt entfernen“ oder Strg/⌘ Z im fokussierten PDF-Zeichenbereich korrigiert einen Punkt.

„Andere PDF“ erhält die bisherigen Raumpläne und löst nach deiner Bestätigung ihre Zuordnung zur alten PDF. Dieselbe PDF erneut zu öffnen erhält die Zuordnung. Das hilft auch, wenn die PDF aus dem Browserspeicher gelöscht wurde. „Neues Projekt“ legt eine weitere Planung an. Die vorhandenen Projekte bleiben erhalten.

## Genauigkeit und Mengen

- Alle Rechenwerte verwenden Millimeter. Das Rastermaß ist Produktmaß plus Fuge. Die Randfuge wird von der Kontur abgezogen; an Hindernissen wird sie ergänzt.
- Der Grundriss und alle Elemente werden als Polygone geschnitten. Auch konkave Räume, schräge Kanten und getrennte Schnittteile werden berücksichtigt.
- Randabstände werden auf einem Raster von **0,001 mm** berechnet. Drehung und Zuschnitte verwenden Fließkommazahlen. Scheitert ein Konturschnitt an nahezu deckungsgleichen Kanten, wird dieser Schnitt auf einem Raster von 0,000001 mm wiederholt. Die SVG-Ausgabe speichert Koordinaten bis auf 0,0001 mm. Diese Rechengenauigkeit ersetzt kein genaues Aufmaß.
- Die Bildschirmansicht bewahrt die Maßverhältnisse. Der Maßstabsbalken ändert sich beim Zoomen. Die Anzeige auf dem Bildschirm hat keinen festen physischen Maßstab.
- SVG und Druck haben einen festgelegten Maßstab. Beim Drucken **100 %**, Papierformat A4 und keine automatische Seitenanpassung einstellen. Der Bericht enthält eine 50-mm-Kontrollstrecke. Zu große Pläne brauchen einen kleineren Maßstab.
- Ein angeschnittenes Element zählt als ein Ausgangsstück. **Reststücke werden nicht anderen Elementen zugeordnet.** Die Mengen sind daher ohne Wiederverwendung berechnet. Wenn ein Ausgangsstück mehrere Schnittteile ergibt, zählt es einmal.
- Verschnitt ist die nicht verlegte Fläche der gezählten Ausgangsstücke, geteilt durch deren volle Fläche. Reserve wird zusätzlich auf die Stückzahl aufgeschlagen. Pakete werden aufgerundet.
- Die Raumfläche ist die Grundfläche abzüglich der Hindernisflächen. Fugen und Randabstände werden bei dieser Raumfläche nicht abgezogen.
- Das Hüllmaß umschließt die Schnittkontur in den Elementachsen. Bei schrägen oder verwinkelten Schnitten ist es keine Mindest-Stegstärke. Die Warnschwelle bezieht sich auf dieses Hüllmaß.

Der wilde Verband ist reproduzierbar. Er prüft keinen vom Hersteller geforderten Mindestabstand zwischen Kopfstößen. „Zentrieren“ ist keine automatische Verschnittoptimierung. Fugen, Randabstände, Versatz und Eignung für Fischgrät müssen zum verwendeten Produkt passen.

## Speicherung und Grenzen

Projekte, Etagen, Räume, Maßstäbe und Varianten werden im lokalen Speicher dieses Browsers gespeichert. Original-PDFs liegen in IndexedDB. Andere Browser und andere Adressen haben einen eigenen Speicher. Das Löschen von Browserdaten löscht auch die gespeicherten Projekte. Sichere wichtige Stände als Projektdatei. Die Projektdatei enthält alle Etagen, Räume und benötigten Original-PDFs; jede PDF ist nur einmal enthalten. Separat gemerkte Varianten sind nicht enthalten. Alte Projektdateien mit einem oder mehreren Räumen bleiben lesbar. Eine importierte Projektdatei wird als zusätzliches Projekt angelegt.

Wenn ein anderer Tab die Projekte ändert, hält Fugenplan das automatische Speichern dieses Tabs an. **Beide Stände erhalten** übernimmt den aktuellen Speicherstand und ergänzt lokal geänderte Projekte als zusätzliche Fassungen. **Aktuellen Stand laden** zeigt den Stand aus dem anderen Tab. Vor der Auflösung bleibt der bisherige lokale Stand als Sicherung im Browserspeicher erhalten.

Die Eingabe unterstützt Räume bis 50 m je Rechteckseite, bis zu 32 Eckpunkte und 24 rechteckige Hindernisse. Der Rechenkern begrenzt einen Plan auf 12.000 Elemente und 60.000 Rasterkandidaten. Bei einer Überschreitung erscheint ein Fehler; der Plan wird nicht still gekürzt. Flächen mit mehreren äußeren, voneinander getrennten Raumkonturen werden nicht als eigener Raumtyp eingegeben. Hindernisse können die nutzbare Fläche jedoch teilen.

Die Sammlung unterstützt bis zu 20 Projekte. Ein Projekt kann bis zu 50 Etagen und jede Etage bis zu 50 Räume enthalten. Eine Etage verwendet eine Seite aus einer PDF mit bis zu 200 Seiten und 20 MiB. Verschiedene Etagen können verschiedene PDFs verwenden. Übernommene PDF-Räume müssen zwischen 10 cm und 50 m breit und tief sein. Verschlüsselte PDFs benötigen eine unverschlüsselte Kopie. Projektdateien dürfen höchstens 128 MiB groß sein; ihre Original-PDFs dürfen zusammen höchstens 80 MiB umfassen. Fehlerhafte Importe erhalten das aktuelle Projekt.

Nicht enthalten: automatische Raumerkennung, Scan-Entzerrung, Preise, Kleber- und Fugenmörtelverbrauch, Reststückoptimierung, Klickprofilregeln sowie sechseckige oder speziell zugeschnittene Ausgangselemente.

## Entwicklung und Prüfung

```sh
npm run dev       # lokaler Entwicklungsserver
npm run build     # TypeScript prüfen und statische Anwendung bauen
npm test          # Geometrie, Projektdaten und Export prüfen
npm run test:e2e  # Browserfunktionen, Maßverhältnisse und Zugänglichkeit prüfen
```

Für Browserprüfungen auf einem neuen Gerät einmal `npx playwright install chromium` ausführen. `dist/` enthält nach dem Build die statische Anwendung. Ein HTTP-Server ist erforderlich, da die Berechnung in einem Web Worker läuft.

Technik: React, TypeScript, Vite, SVG, Web Worker, PDF.js, IndexedDB, Clipper und polygon-clipping. Es gibt kein Backend. Der lokale Server bindet nur an `127.0.0.1`. Die npm-Skripte kopieren PDF-Schriften und Decoder aus der installierten PDF.js-Version nach `public/pdfjs/`; der Build enthält diese Dateien.

Fachliche Quellen und die daraus abgeleiteten Regeln stehen in [docs/RECHERCHE.md](RECHERCHE.md). Die Funktionen orientieren sich am Arbeitsablauf von CalcuFloor. Oberfläche und Code wurden eigenständig erstellt. Es wurden keine CalcuFloor-Dateien oder Grafiken übernommen. Der aktuelle Status der Veröffentlichung und Lizenz steht in der [README](../README.md#projektstatus-und-lizenz).

PDF-Technik und Prüfnachweise: [docs/PDF-TECHNIK.md](PDF-TECHNIK.md) und [docs/PDF-PRUEFUNG.md](PDF-PRUEFUNG.md).

Startpositionen und Prüfnachweise: [docs/START-PRUEFUNG.md](START-PRUEFUNG.md).

Direkte Startwahl und UX-Prüfung: [docs/START-UX-PRUEFUNG.md](START-UX-PRUEFUNG.md).

Projekte, Etagen und gemeinsame Grundrisse: [Funktionsprüfung](PROJEKTE-ETAGEN-PRUEFUNG.md) und [unabhängige UI-Prüfung](PROJEKTE-ETAGEN-REVIEW.md).
