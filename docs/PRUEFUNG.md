# Prüfstand

Geprüft am 25. Oktober 2026 auf diesem Mac.

## Automatische Prüfungen

- `npm run build`: erfolgreich. TypeScript-Prüfung und statischer Vite-Build erfolgreich.
- `npm test`: **116 Tests erfolgreich**. 44 Geometrieprüfungen, 29 Prüfungen für Einzelprojekte und Exporte, 24 Kalibrierungsprüfungen sowie 19 Prüfungen für mehrere Räume und vollständige Projektdateien.
- `npm run test:e2e`: **24 Browserprüfungen gemeinsam erfolgreich** (45,6 Sekunden). Darin enthalten sind die 17 bisherigen Prüfungen und sieben zusätzliche PDF-Prüfungen. Die PDF-Abläufe sind in [PDF-PRUEFUNG.md](PDF-PRUEFUNG.md) beschrieben.
- Die Prüfungen behandeln auch Import/Reset während des Zeichnens, Wiederherstellung beschädigter Speicherung und lokale Netzwerkanfragen.
- `zsh -n Starten.command`: erfolgreich. Die Startdatei ist ausführbar. Der lokale Entwicklungsserver und der Server für den fertigen Build wurden gestartet.
- npm-Prüfung der installierten Pakete: keine gemeldeten Sicherheitslücken beim geprüften Stand.

## Geometrie

Die Tests prüfen unter anderem vollständige Raster, echte Fugenflächen, Randfugen, Millimeterbruchteile, negative Versätze, Rotation, konkave Raumkonturen, überlappende Hindernisse und mehrere Schnittteile je Ausgangsstück.

Fischgrät wird mit mehreren Seitenverhältnissen unabhängig auf Überschneidungen und Fugenabstände geprüft. Ein Invariantentest kombiniert 35 reproduzierbare Fälle mit Mustern, Rotation, konkavem Raum, Hindernis und Fugen. Ein großer Rechteckraum wird mit mehr als 8.000 Elementen vollständig berechnet. Grenzüberschreitungen erzeugen Fehler.

Die Browserprüfung misst tatsächliche SVG-Koordinaten eines bekannten 3×3-Rasters. Änderungen von Fuge und Randabstand werden am gezeichneten Ergebnis geprüft. Die Exportprüfung vergleicht Papiermaß und Koordinaten für alle angebotenen SVG-Maßstäbe.

## Bedienung und Ansicht

Geprüft wurden Dezimalkomma, ungültige Eingaben, sieben Muster, Dielen ohne Fuge, Zeichnen, numerische Eckpunkte, Hindernisse, Mausverschiebung, Tastaturauswahl, Zoom, Rückgängig/Wiederholen, Speicherung, Varianten und Exporte.

Axe meldete auf den drei Einstellbereichen bei 1440×1000 und 390×844 Pixeln keine schweren oder kritischen Verstöße. Das ist keine vollständige Konformitätszertifizierung. Die Tastaturwege wurden zusätzlich bedient.

Desktop- und Mobilansichten wurden als Screenshots geprüft. Die Maßlinien bleiben frei. Es gibt bei diesen Fenstergrößen keinen horizontalen Überlauf. Die Ansicht bei 1280×720 Pixeln wurde zusätzlich mit Fischgrät geprüft.

- [Desktop](../tests/screenshots/desktop-1440x1000.png)
- [Mobile Einstellungen](../tests/screenshots/mobile-390x844.png)
- [Mobiler Plan](../tests/screenshots/mobile-plan-390x844.png)
- [Druckdarstellung](../tests/screenshots/print-layout.png)

Ein zulässiger A4-Grenzfall mit 100 Zeichen im Projektnamen wurde separat gemessen: 247,59 mm Inhaltshöhe bei 273 mm verfügbarer Höhe. Zu große SVG-Pläne werden für den A4-Bericht gesperrt; ein kleinerer Maßstab bleibt wählbar.

## Daten und Grenzen

Die Netzwerkprüfung beobachtet HTTP- und WebSocket-Anfragen ab der ersten Navigation sowie während Raum-, Belag- und Musteränderungen. Alle Ziele waren lokal. Es wurden keine externen Ziele angesprochen.

PDF-Daten, Seitendrehung, lokale Decoder und die bytegenaue IndexedDB-Speicherung wurden zusätzlich geprüft. Einzelheiten und Primärquellen stehen in [PDF-TECHNIK.md](PDF-TECHNIK.md). Die vollständige Bedienfolge mit einer dreiseitigen Prüf-PDF ist in [PDF-PRUEFUNG.md](PDF-PRUEFUNG.md) dokumentiert.

Die Anwendung rechnet idealisierte ebene Geometrie. Nicht enthalten sind produktbezogene Klickregeln, automatische Reststückzuordnung und eine vollständige Optimierung der Bestellmenge. Diese Grenzen stehen auch in Hilfe und README.
