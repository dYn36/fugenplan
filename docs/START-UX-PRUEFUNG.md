# Direkte Startwahl im Raumplan

Stand: 26. Oktober 2026.

## Änderung

Ein UX-Experten-Agent hat Code und Screenshots der bisherigen Startwahl geprüft. Die alte Auswahl lag nur im Seitenreiter „Verlegung“. Ihre kleine nummerierte Grafik war nicht bedienbar. Der neue Einstieg „Start wählen“ beziehungsweise „Start ändern“ steht direkt über dem großen Raumplan. „Im Raumplan wählen“ im Seitenbereich öffnet denselben Modus.

Die separate Auswahlleiste bietet „Ecke“, „Wandmitte“ und „Abbrechen“. Nummerierte Ziele liegen auf den tatsächlichen Raumecken oder Wandmitten. Sie haben 44 × 44 Bildschirmpixel große Trefferflächen. Eine Positionsliste bleibt als Alternative verfügbar. Hervorhebung, Tooltip und Klick nutzen dieselbe Ermittlung des nächsten Ziels bei überlappenden Trefferflächen.

Öffnen, Wechseln des Typs, Zoom, Verschieben der Ansicht und Abbruch ändern keine Projektdaten. Erst das Wählen eines Punktes setzt den Start und den Versatz X/Y auf null. Rückgängig stellt den vorigen Start einschließlich Versatz wieder her. Während einer Neuberechnung sind Auswahl und Übernahme gesperrt.

## Prüfung in der laufenden Anwendung

Die folgenden Prüfungen erfolgten mit Browserbedienung über CUA. Es wurde keine externe Browser-Automation gestartet.

- Rechteck: alle vier Ecken und alle vier Wandmitten direkt gewählt. Zusammenfassung und Startmarkierung zeigten jeweils die gewählte Stelle.
- Einstieg im geöffneten Reiter „Raum“: vollständige Auswahl ohne Wechsel zu „Verlegung“.
- Abbruch: Wechsel Ecke/Wandmitte und Abbruch erhalten Start und Versatz. Eine einzige Rückgängig-Aktion stellt den Zustand vor der Übernahme wieder her. Wiederholen stellt den gewählten Start erneut her.
- Versatz: X = 12 cm und Y = 7 cm bleiben nach Escape erhalten. Eine neue Startwahl setzt beide auf null. Eine Rückgängig-Aktion stellt Start und beide Werte wieder her.
- Tastatur: fünf Tab-Schritte ab „Ecke“ erreichen das erste Konturziel. Enter übernimmt, ohne zugleich Fliesendetails zu öffnen. Leertaste übernimmt ebenfalls. Escape schließt den Modus und gibt den Fokus an den Einstieg zurück. Das wurde für Plan- und Seitenbereich-Einstieg geprüft.
- Zoom und Pan: bei 125 % wurde von einem Startziel aus gezogen. Der Start blieb unverändert. Die anschließende direkte Eckwahl traf den richtigen Konturindex. Zoom blieb erhalten.
- L-Form: sechs tatsächliche Ziele; die konkave Ecke 3 bei 2800/1200 mm wurde direkt gewählt.
- PDF-Kontur: synthetisches Beispielprojekt mit zwei Räumen importiert. Punkt 2 der Küche auf Y = 80 cm gesetzt. Die erste schräge Wand hatte ihr Auswahlziel bei 2400/400 mm. Die direkte Wahl übernahm „Wand 1 · Mitte“.
- Raumwechsel: beendet den Auswahlmodus. Rückkehr zur Küche erhält deren Start.
- Speicher: Neuladen erhält Raum und Start. Die exportierte Projektdatei enthält zwei Räume, Original-PDF und `{ kind: 'side', index: 0 }`. Wiederimport zeigt den gleichen Start.
- SVG: enthält die Startmarkierung. Enthält keine Auswahlziele oder Bedienleisten.
- Bestehende Werkzeuge: Fliesen-Anklicken öffnet Details. Startwahl schließt Details. Verbandverschiebung per Ziehen ändert X/Y. Zentrieren hebt den Start auf. Raumzeichnen beendet die Startwahl und lässt sich abbrechen.
- 390 × 844 Pixel: kein horizontaler Seitenüberlauf. Auswahlleiste und alle vier Rechteckziele bleiben sichtbar. Trefferflächen messen 44 × 44 Pixel. Wandmitte und Auswahl über die Liste funktionieren.

Der Ausgangsplan „Wohnzimmer“ wurde nach den Prüfungen wiederhergestellt. Testvarianten wurden nicht angelegt.

## Automatische Prüfungen

- `npm run build`: erfolgreich. Vite meldet weiterhin den bereits bestehenden Hinweis auf einen JavaScript-Chunk über 500 kB.
- `npm test`: 147 Tests in vier Dateien erfolgreich.
- Die bestehende Playwright-E2E-Suite wurde in dieser Prüfung nicht ausgeführt.

## Fachliche Nachprüfung

Der UX-Experten-Agent hat die Umsetzung und die Desktop-/Mobilaufnahmen erneut geprüft. Er meldete keine allgemeinen UX-Blocker. Seine Restanmerkung zu abweichender Hervorhebung bei überlappenden Zielen wurde umgesetzt und von ihm am Code bestätigt.

Die Prüfung erfolgte im Browser bei Desktop- und Mobilbreite. Es liegt kein Nutzertest mit Endanwendern und keine Prüfung auf einem echten iPhone oder mit VoiceOver vor.

## Aufnahmen

- [Direkte Startwahl, Desktop](../screenshots/startwahl-direkt-desktop.jpg)
- [Direkte Startwahl, 390 Pixel](../screenshots/startwahl-direkt-mobil.jpg)
