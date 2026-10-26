# Recherche und fachliche Grundlage

Stand: 25. Oktober 2026. Die Quellen wurden an diesem Tag geprüft.

## Zweck

Fugenplan ist ein privater 2D-Verlegeplaner. Er zeigt, wie das gewählte Material in einen gemessenen Raum passt. Er unterstützt den Vergleich von Mustern, Richtung, Fugen und Randzuschnitten. Er ersetzt keine produktbezogene Verlegeanleitung.

## Funktionale Referenz

CalcuFloor beschreibt diesen Ablauf: Raumkontur erfassen, tatsächliches Produktmaß eingeben, Muster und Richtung wählen, Lage verschieben und Mengen prüfen. Die Kontur kann Ecken, Nischen und ausgesparte Flächen enthalten. Änderungen aktualisieren den Plan. Die Fliesenansicht nennt außerdem Fugenbreite, Zentrierung und ganze sowie geschnittene Fliesen. [CalcuFloor: Ablauf](https://calcufloor.com/de/so-funktioniert-calcufloor.html), [CalcuFloor: Fliesenrechner](https://calcufloor.com/de/fliesenrechner.html)

Für Fugenplan folgt daraus dieser Arbeitsumfang:

- Raummaße in einer einfachen Grundform oder als eigene Kontur erfassen.
- Fliesen oder Dielen mit frei wählbarer Länge und Breite planen.
- Fugenbreite und Randabstand getrennt einstellen.
- Muster, Drehung und Verschiebung unmittelbar im Grundriss prüfen.
- Zuschnitte sichtbar machen und Maße prüfen.
- Eine Variante speichern und als Plan ausgeben.

Das ist eine eigene Umsetzung der Funktionen. Texte, Bilder, Marken und Quellcode der Referenz werden nicht übernommen. Die Startseite war beim direkten Webabruf nicht verfügbar. Die verlinkten Funktionsseiten waren verfügbar.

## Maße und Fugen

Villeroy & Boch unterscheidet Nennmaß, Werkmaß und Kaliber. Das Nennmaß enthält in der Regel die Fuge. Das tatsächliche Maß kann daher vom Produktnamen abweichen. Die Kaliberangabe steht auf der Verpackung. Beispiel des Herstellers: Bei einem Nennmaß von 30 × 30 cm sind Werkmaße von 295, 296 oder 297 mm möglich. [Villeroy & Boch: Technische Eigenschaften](https://pro.villeroy-boch.com/de/de/fliesen/service/faqs/technische-eigenschaften)

**Folge für die Eingabe:** Länge und Breite sind die tatsächlichen Elementmaße. Das Programm addiert die Fuge einmal je Rasterabstand. Die Fuge darf nicht ein zweites Mal in den Elementmaßen enthalten sein.

Die Fugenbreite hängt von Material, Format und Maßabweichung ab. Der Bundesverband Keramische Fliesen nennt die Toleranzaufnahme als Aufgabe der Fuge. VitrA nennt unterschiedliche Mindestbreiten für rektifizierte und nicht rektifizierte Produkte. Deshalb ist ein einziger allgemeingültiger Vorgabewert nicht belegt. [Bundesverband: Fuge](https://www.fliesenverband.de/faq-items/fuge/), [VitrA: Häufige Fragen](https://www.vitra-bad.de/haufig-gestellte-fragen/)

Für die Software ist ein Startwert eine bearbeitbare Planungseinstellung. Er ist keine Freigabe für das gewählte Produkt. Bei dicht verbundenen Dielen kann der Zwischenraum 0 mm sein. Das ändert den nötigen Randabstand nicht.

Randfugen haben eine eigene Funktion. Sie verhindern, dass der Belag an Wänden oder festen Bauteilen eingespannt wird. Vorhandene Bewegungsfugen können weitere Trennungen im Belag erfordern. [Schlüter: DITRA-SOUND, Hinweise zu Rand- und Bewegungsfugen](https://eu.schluter.com/statics/www_schlueter_de_2x/downloads/cumulus/schlueter_db_6_3_ditra_sound_de.pdf)

Für Laminat nennt der Herstellerverband mindestens 10 mm Randabstand oder einen größeren Wert nach Herstellervorgabe. Der Abstand gilt auch an festen Einbauten. [EPLF: FAQ](https://eplf.com/de/laminat/faq)

## Muster

Die nachfolgenden Muster sind in der Übersicht von SCHÖNER WOHNEN-Fliesen beschrieben. [Verlegearten](https://schoener-wohnen-fliesen.de/Wissen/Verlegearten/)

| Muster | Geometrie im Plan |
| --- | --- |
| Kreuzfuge | Alle Reihen haben dieselbe Ausgangslage. |
| Halbverband | Jede Reihe hat einen Versatz von einem halben Rasterabstand. |
| Drittelverband | Jede Reihe hat einen Versatz von einem Drittel des Rasterabstands. |
| Viertelverband | Jede Reihe hat einen Versatz von einem Viertel des Rasterabstands. |
| Diagonal | Das Raster ist um 45° gedreht. |
| Fischgrät | Gleich große Rechtecke liegen abwechselnd im rechten Winkel zueinander. |
| Wilder Verband | Reihen haben unterschiedliche Versätze. Eine Vorschau muss beim erneuten Öffnen gleich bleiben. |

Bei der Software ist der Rasterabstand das Elementmaß plus Fuge. Damit beziehen sich die Versätze auf die Fugenachsen. Das ist eine geometrische Festlegung der Umsetzung.

Für rechteckige Fliesen empfiehlt VitrA einen Viertelversatz. Die Musterübersicht nennt den Halbverband als weniger geeignet für sehr große Formate. **Folge:** Halbverband darf als Entwurf gewählt werden. Bei Fliesen erscheint ein kurzer Hinweis, die Herstellerfreigabe für das Format zu prüfen. Eine pauschale Sperre aller Halbverbände wäre nicht belegt. [VitrA: Häufige Fragen](https://www.vitra-bad.de/haufig-gestellte-fragen/), [Verlegearten](https://schoener-wohnen-fliesen.de/Wissen/Verlegearten/)

Fischgrät benötigt ein passendes Produkt. MEISTER beschreibt ein System mit einer universellen Diele und nennt als Vergleich Systeme mit A- und B-Dielen. Die Vorschau kann die Form zeigen, aber keine unbekannte Klickverbindung prüfen. [MEISTER: Fischgrät verlegen](https://www.meister.com/de/beratung/verlegung/fischgraet-verlegen.html)

Bei Dielen ist auch der Abstand benachbarter Kopfstöße produktabhängig. MEISTER nennt für seine Laminatprodukte mindestens 40 cm. Andere Formate können andere Vorgaben haben. Das Tool darf eine Vorschau nicht als automatische Freigabe des Versatzes darstellen. [MEISTER: Laminat verlegen](https://www.meister.com/de/beratung/verlegung/laminat-verlegen.html)

## Verbindliche Rechenregeln der Umsetzung

Diese Regeln sind mathematische Anforderungen. Sie sind keine Bauvorschriften.

1. Alle Längen werden intern in Millimetern verarbeitet. Anzeige und Export verwenden dieselbe Geometrie.
2. Ein Raummaß ist ein Innenmaß. Der Randabstand verkleinert die belegbare Fläche senkrecht zu jeder Wand.
3. Bei einer rechteckigen Fläche mit Breite `R` und Randabstand `a` beträgt die belegbare Breite `R − 2a`.
4. Eine Reihe mit `n` vollständigen Elementen, Elementlänge `L` und Fuge `g` ist `n × L + (n − 1) × g` lang. Eine äußere Fuge wird nicht zusätzlich gezählt.
5. Bei einer Drehung bleiben Elementlänge, Elementbreite und Fugenbreite unverändert. Alle Punkte verwenden dieselbe Drehung.
6. Elementpolygone werden an der belegbaren Raumkontur geschnitten. Ein nur außerhalb liegendes Element zählt nicht.
7. Ein Zuschnitt bleibt von einem ganzen Element unterscheidbar. Bei schrägen Schnitten ist eine rechteckige Hüllfläche keine vollständige Schnittbeschreibung.
8. Ein Maßstab am Bildschirm bewahrt die Proportionen. Er behauptet keine physische 1:1-Darstellung auf unbekannten Bildschirmen.
9. Ganze Elemente und Zuschnitte werden aus dem Plan gezählt. Eine zusätzliche Reserve muss getrennt ausgewiesen werden.
10. Falls Reststücke nicht anderen Zuschnitten zugeordnet werden, wird das ausdrücklich genannt. Die Stückzahl ist dann keine optimierte Einkaufsliste.
11. Ein Grenzwert für schmale Zuschnitte ist eine Planungshilfe. Er ist keine allgemeine zulässige Mindestbreite.

## Prüfbeispiele

- 5 Elemente mit je 600 mm und 4 Fugen mit je 3 mm ergeben 3.012 mm.
- Ein 4.000 mm breiter Raum mit 10 mm Randabstand hat 3.980 mm belegbare Breite.
- Ein 2.000 × 1.000 mm großer Raum hat 2 m². Die Darstellung muss ein Seitenverhältnis von 2:1 haben.
- Eine Drehung um 90° tauscht bei einem Rechteck die Ausdehnung in x- und y-Richtung. Sie ändert dessen Fläche nicht.
- Bei Fischgrät bleiben sämtliche einzelnen Elemente Rechtecke mit den eingegebenen Maßen. Unterschiedliche Orientierungen dürfen sich nicht überlappen.
- Speichern und erneutes Laden müssen dieselbe Kontur, dasselbe Muster und dieselben Mengen ergeben.

## Fachliche Grenzen

Der Plan rechnet mit ebenen Flächen und idealen Elementen. Er prüft keine Ebenheit, Kleberwahl, Materialtoleranz, Feuchte oder Fußbodenheizung. Er berechnet keinen Fugenmörtel. Er plant keine zusätzlichen Bewegungsfugen automatisch. Untergrund und Verlegeanleitung bleiben für die Ausführung maßgebend. Diese Grenze entspricht auch der ausdrücklich genannten Grenze der funktionalen Referenz. [CalcuFloor: Ablauf](https://calcufloor.com/de/so-funktioniert-calcufloor.html)
