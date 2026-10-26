# Startfliese: Prüfung am 26.10.2026

## Umgesetztes Verhalten

- Unter **Verlegung → Startfliese** sind „Frei“, „Ecke“ und „Wand“ verfügbar.
- Rechtecke bieten vier Ecken und vier Wandmitten. L-Formen und freie, auch aus PDF übernommene Konturen bieten ihre tatsächlichen Ecken und Wände.
- Die Auswahl richtet das Raster einschließlich Randfuge neu aus. Winkel und Muster bleiben erhalten. Zuschnitte und Materialmengen werden aus dem neuen Raster berechnet.
- Element 1 ist das verlegbare Element mit dem kleinsten Abstand zur gewählten Ecke oder Wandmitte. Es ist im Plan markiert und über „Startfliese prüfen“ erreichbar. Hindernisse und gedrehte Muster können einen Zuschnitt am Start verursachen.
- Die Auswahl bleibt je Raum, in Projektdateien, im Browserspeicher und in Varianten erhalten. SVG, Druck und CSV kennzeichnen dieselbe Startfliese.

## Automatische Prüfungen

`npm run build`: erfolgreich, einschließlich TypeScript-Prüfung. Vite meldet weiterhin den Größenhinweis für das Hauptpaket.

`npm test`: **147 Tests bestanden**, davon 31 neue Tests für Startpositionen und ihre Speicherung. Die Parametertests enthalten zusätzliche Kombinationen aus sieben Mustern, drei Winkeln, allen vier Ecken und vier Wänden sowie mit und ohne Fuge.

Nachweise:

- `tests/geometry.test.ts`: bekannte Sollkoordinaten der Startfliese; Änderung von Mengen und Verschnitt; Raum-, Produkt- und Randfugenänderungen; manuelle Versätze; L-Formen; schräge Konturen in beiden Umlaufrichtungen; Hindernisse; zusätzliche kollineare Punkte. Die Flächenprüfung kontrolliert Überlappungen, Außenflächen und Flächenbilanz mit einer unabhängigen Ganzzahlvereinigung. Die Startmarkierung muss innerhalb der zugeschnittenen Fläche und außerhalb von Löchern liegen.
- `tests/project.test.ts`: alte Projekte bleiben ohne Startbindung; gültige Startdaten bleiben beim Einlesen erhalten; ungültige Daten werden abgewiesen; SVG und CSV markieren dieselbe Fliese.
- `tests/workspace.test.ts`: getrennte Startpositionen in zwei PDF-Räumen; Projektdatei enthält beide; eine neue PDF-Kalibrierung hält den Start an derselben Ecke.

Ein durch die neuen Tests nachgewiesener Grenzfall betraf deckungsgleiche Kanten bei gedrehten Mustern ohne Fuge. Wenn die bisherige Schnittberechnung daran scheitert, wird nur dieser Schnitt mit Clipper auf einem Raster von 0,000001 mm wiederholt. Die Flächenprüfungen bestehen auch für diese Fälle.

## Prüfung in der Oberfläche

Über die Browser-Steuerung wurde die laufende Anwendung geprüft:

1. Alle vier Startecken ausgewählt. Auswahl, Planmarkierung und Startangabe stimmen überein.
2. Alle vier Wandmitten ausgewählt. Bei 4200 × 3600 mm Raummaß, 600 × 300 mm Fliesen und 5 mm Randfuge wurden folgende Konturen im SVG des Plans gelesen:
   - Oben: x = 1800…2400, y = 5…305 mm.
   - Rechts: x = 3595…4195, y = 1650…1950 mm.
   - Unten: x = 1800…2400, y = 3295…3595 mm.
   - Links: x = 5…605, y = 1650…1950 mm.
3. Oben links mit Versatz X = −10 cm: Startzuschnitt 500 × 300 mm. Rückgängig ergibt wieder 600 × 300 mm. Wiederholen stellt 500 × 300 mm wieder her.
4. „Am Start neu ausrichten“ setzt den Versatz zurück. „Belag zentrieren“ entfernt die Startbindung. Rückgängig stellt sie wieder her.
5. Neuladen des Browsers erhält die Startposition.
6. Projektdatei, SVG und CSV über die Oberfläche heruntergeladen und als JSON, XML und CSV eingelesen. Die Projektdatei enthält die Auswahl. SVG enthält den Startmarker. Genau ein CSV-Eintrag ist als Startfliese gekennzeichnet.
7. Startbindung entfernt und die heruntergeladene Projektdatei geöffnet. Die Auswahl und der Marker werden wiederhergestellt.
8. Variante mit „Unten rechts“ gespeichert. Danach auf Wandstart gewechselt. Die Variantenkarte nennt „Unten rechts“. Laden stellt diese Ecke wieder her. Die angelegte Testvariante wurde anschließend entfernt.
9. Beispielprojekt mit zwei PDF-Räumen geöffnet. Küche: Ecke 3. Wohnen: Wand 4. Nach dem Raumwechsel hat jeder Raum seine eigene Auswahl. Danach wurde der ursprüngliche Raum wieder geöffnet.
10. Bei 390 × 844 Pixeln ist die Auswahl bedienbar. Dokumentbreite und Ansichtsbreite betragen beide 390 Pixel. Startfliese, Details und Mengenübersicht sind erreichbar. Die vorübergehende Bildschirmgröße wurde zurückgesetzt.
11. Wechsel der Raumform entfernt die alte Startbindung. Rückgängig stellt Raumform und Startposition wieder her.
12. Die Fehlerprotokoll-Abfrage des Browsers enthält keine Einträge.

Die Browserprüfungen dieses Durchlaufs erfolgten über die Browser-Steuerung. Die separate bestehende Playwright-Suite wurde in diesem Durchlauf nicht erneut ausgeführt.

## Ansichten

- [Desktop](../screenshots/startfliese-desktop.jpg)
- [Smartphone mit geöffneten Fliesendetails](../screenshots/startfliese-mobil.jpg)

Die Desktop-Ansicht zeigt als Beispiel den Start unten rechts. Eine automatische Optimierung oder Wiederverwendung von Reststücken ist nicht Bestandteil dieser Änderung.
