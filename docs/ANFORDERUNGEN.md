# Abnahme

Die Anforderungen stammen aus dem Nutzerauftrag. Die Fachrecherche ergänzt die Rechenregeln.

| Anforderung | Umsetzung | Nachweis |
| --- | --- | --- |
| Neuer Projektordner im Arbeitsordner | `fugenplan/` | Dateien und Startskript vorhanden |
| Private Nutzung | Lokaler Betrieb, keine Konten und keine Telemetrie | Browser-Netzwerkprüfung und Quellcode |
| Raum maßstäblich eingeben | Rechteck, L-Form, freie Eckpunkte, Zeichenmodus, Hindernisse | Browserprüfung mit bekannten Innenmaßen |
| PDF als Grundriss laden | Lokaler PDF.js-Renderer, mehrere Seiten, Vektor- und Rasterpläne | Reproduzierbare PDF-Prüfvorlage, echte Browserprüfung |
| Maßstab aus bekannter Wand | Zwei PDF-Punkte und tatsächliche Wandlänge in cm, eigener Maßstab je Seite | Kalibrierungs- und Workspace-Tests, Browserprüfung bekannter Maße |
| Räume im PDF bestimmen | Innenkontur markieren, eigene Verlegeeinstellungen je Raum | Mehrere Räume, getrennte Einstellungen und aktualisierte Konturen geprüft |
| PDF-Projekt sichern | IndexedDB für Original-PDF, Projektdatei mit allen Räumen und eingebetteter PDF, alte Dateien lesbar | Speicher- und Import-/Exportprüfung |
| Fliesen oder Boden mit Maßen | Frei wählbares rechteckiges Produktmaß, Formatvorgaben | Browserprüfung und Geometrietests |
| Fugen berücksichtigen | Rasterfugen und Randabstand als separate Werte | Unabhängige Koordinatenmessung am SVG und Geometrietests |
| Typische Verlegemuster | Sieben Muster einschließlich Fischgrät | Tests aller Muster; Fischgrät zusätzlich auf Abstände und Überlagerung geprüft |
| Verteilung ausprobieren | Muster, Drehung, Versatz, Zentrieren, Zoom, Auswahl, Varianten | Browserprüfung |
| Einfache und schnelle Bedienung | Sofort nutzbarer Beispielraum, drei Einstellbereiche, lokaler Web Worker | Bildschirmprüfung bei Desktop/Smartphone und Funktionstests |
| Genauigkeit | Eine gemeinsame mm-Geometrie für Vorschau, Mengen und Export | Flächen-/Schnittinvarianten, SVG-Maßstab, Kontrollstrecke im Druck |
| Nachvollziehbare Zuschnitte | Einzelkonturen, Hüllmaße und Kantenmaße | Browserprüfung der Elementdetails und Exporttests |
| Recherche | Primärquellen und Entscheidungen dokumentiert | `RECHERCHE.md` |
| Spezialisten | Fachrecherche, Geometrie, Oberfläche, unabhängige Browserprüfung | Erstellte Dokumentation, Implementierung und Prüfberichte |

Das Tool garantiert keine Mindest-Stegstärke bei beliebigen Schnittkonturen und keine Regeln für Klicksysteme. Die Mengen enthalten keine Zuordnung wiederverwendbarer Reststücke. Diese Grenzen sind in Hilfe und README angegeben.
