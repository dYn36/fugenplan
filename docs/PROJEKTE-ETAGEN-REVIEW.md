# UI-Abschlussprüfung: Projekte und Etagen

Stand: 28. Oktober 2026. Entscheidung: **PASS für den unten geprüften UI-Umfang**. Die erste Prüfung war nach Korrektur von R1 bis R3 abgeschlossen. Die neue Raumverschiebung und die Tabkonflikte wurden danach getrennt geprüft. Auch R4 bis R6 sind korrigiert und unabhängig nachgeprüft. Die Grenzen des eigenen Browsernachweises stehen am Ende.

## Produkt und Aufgabe

Fugenplan wird zur Planung von Fliesen und Dielen anhand von Raummaßen und PDF-Grundrissen verwendet. In dieser Erweiterung ist die aktive Etage das erste Arbeitsobjekt. Ihre Zeichnung muss Raumlage und Belag zeigen. Projekt und Etage bilden den sichtbaren Kontext. Ein Raum führt von dort in den vorhandenen Editor. Die Oberfläche verwendet weiterhin Manrope, Phosphor-Symbole, eine grüne Auswahlfarbe und helle Planflächen. Eine allgemeine Statistikübersicht würde die verlangte räumliche Aufgabe verfehlen.

Die Prüfung bewertet konkrete Oberflächen und Abläufe. Sie bestätigt keine Auszeichnung durch Apple. Der vollständige Funktionsnachweis, Datei-Rundläufe und Regressionstests werden vom Hauptagenten getrennt geführt.

## Gestaltungsvertrag und Vergleichsmuster

Der umgesetzte Vertrag steht in [PROJEKTE-ETAGEN-UX.md](PROJEKTE-ETAGEN-UX.md). Für diese Prüfung gelten: Etagenname vor Zeichnung, gemeinsame Koordinaten statt einzelner Raumkarten, benannte Rückwege, getrennte Behandlung unbekannter Raumpositionen und vollständige Bedienung bei 320 und 390 Pixeln Breite.

Die folgenden Herstellerquellen wurden am 28. Oktober 2026 gelesen. Die Übertragung auf Fugenplan ist eine begründete Gestaltungsentscheidung; es wurde keine fremde Oberfläche kopiert.

| Quelle | Muster und übertragbare Entscheidung |
| --- | --- |
| [Apple: Dateien auf dem iPad](https://support.apple.com/guide/ipad/modify-files-and-folders-ipad49b77901/ipados) | Dokumenthierarchie, Vorschau und Metadaten gehören zusammen. Die Projektbibliothek zeigt echte Raumkonturen neben Namen und Umfang. |
| [magicplan: Etage und Raum hinzufügen](https://help.magicplan.app/add-a-new-floor-ios) | Ein Projekt enthält Etagen; Räume werden aus der Etage heraus hinzugefügt. Fugenplan benötigt dieselbe erkennbare Zuordnung bei jeder Erfassung. |
| [magicplan: Neuer Grundrisseditor](https://magicplan.app/blog/commenting-and-mentions-beta-release-0) | Der Etagenwechsel ist direkt aus dem Editor erreichbar. In Fugenplan darf er auf Mobil nicht mit der Seitenleiste verschwinden. |
| [RoomSketcher: Ebenen in einem Projekt](https://help.roomsketcher.com/hc/en-us/articles/360000893509-How-Do-I-Create-a-3D-Site-Plan) | Unterschiedliche Planebenen bleiben getrennte Arbeitsflächen innerhalb eines Projekts. Quellen von verschiedenen PDF-Seiten dürfen keine erfundene gemeinsame Lage erhalten. |

Verbotene Standardmuster für diese Oberfläche: dekorative Kennzahlenkarten, Fortschrittsringe ohne fachliche Grundlage, allgemeine Werbetexte, zufällige Etagenfarben und automatische Raumcollagen ohne belegte Position.

## Eigener Browsernachweis

Geprüft wurde der aktuelle Quellstand über CUA auf einer getrennten lokalen Adresse `127.0.0.1:52470`. Die Benutzerdaten auf Port 5173 wurden nicht verändert. Projekte und Räume wurden durch die echte Oberfläche angelegt. Die importierte Datei `tests/fixtures/grundriss-drei-seiten.pdf` enthält synthetische Prüfgeometrie.

| Prüfung | Beobachtetes Ergebnis |
| --- | --- |
| Neues Projekt | „Haus am Garten“ öffnet sich ohne erfundene Räume. „Erste Etage anlegen“ ist sichtbar. |
| Zwei Etagen | „Erdgeschoss“ und „Obergeschoss“ erscheinen in der Navigation. Die aktuelle Etage wird durch Fläche, Umrandung und `aria-current` gekennzeichnet. |
| PDF und Maßstab | Seite 1 wurde gewählt. Zwei Wandpunkte wurden per Prozentfeldern gesetzt. 480 cm wurden übernommen. Der Fokus gelangte nach dem zweiten Punkt in das Längenfeld. |
| Zwei PDF-Räume | „Wohnen“ und „Küche“ wurden nacheinander markiert. Beide Räume liegen gemeinsam in der Etagenzeichnung. Die DOM-Ursprünge sind `(1200, 1400)` und `(6000, 1400)` mm. Das entspricht den erfassten Quellpunkten und 20 mm je PDF-Einheit. |
| Getrennte PDF-Seite | Für „Obergeschoss“ wurde dieselbe PDF mit Seite 2 gewählt. Die zwei Räume im Erdgeschoss blieben erhalten. |
| Manuell ohne Position | „Bad“, 240 × 300 cm, stand zunächst unter „Noch nicht angeordnet“. Es erschien nicht als vermeintlich richtiger Teil des Grundrisses. |
| Manuelle Position | Nach Eingabe von X = 40 cm und Y = 60 cm erschien „Bad“ in der Zeichnung. Nach Neuladen blieben der DOM-Ursprung `(400, 600)` mm und die Fläche 7,2 m² erhalten. |
| Raum per Tastatur öffnen | Enter auf der Raumfläche „Bad bearbeiten“ öffnete den Raum. Der Fokus wechselte auf `workspace-main`, die Überschrift lautete „Bad“. |
| Zweites Projekt | „Wohnung Innenstadt“ wurde zusätzlich angelegt. Die Bibliothek zeigte zwei Projekte, davon „Haus am Garten“ mit zwei Etagen und drei Räumen. |
| Umbenennen und Abbrechen | Das zweite Projekt erhielt den längeren Namen „Wohnung Innenstadt mit ausgebautem Dachgeschoss“. Die Entfernen-Bestätigung nannte diesen Namen und 0 Räume. Nach „Behalten“ und Escape erhielt der ursprüngliche Verwalten-Auslöser wieder den Fokus. |
| Desktop, 1280 × 720 px | Kein horizontaler Dokumentüberlauf. Die gemeinsame Etagenzeichnung ist der größte Inhaltsbereich. Der Raumeditor besitzt weiterhin eine 724 px breite Zeichenfläche. |
| Mobil, 390 × 844 px | Kein horizontaler Dokumentüberlauf. Die Etagenzeichnung liegt zwischen y = 393,59 und 733,59 px und ist vollständig im ersten Bildschirm sichtbar. Der Etagenwechsel bleibt erreichbar. |
| Mobil, 320 × 844 px | Kein horizontaler Dokumentüberlauf. Aktionen umbrechen. Gemessene neue Hauptaktionen und Zoomschalter besitzen mindestens 44 px Höhe. Auch die Bibliothek mit einem 47 Zeichen langen Projektnamen bleibt innerhalb von x = 18 bis 302 px. |

## Befunde und Korrekturen

| ID | Befund | Änderung und Nachprüfung |
| --- | --- | --- |
| R1 · P2 | Die neue Etage mit bereits zugeordneter PDF-Seite 2 zeigte weiterhin „Lade eine PDF …“. Dateiname und Seite fehlten. | Korrigiert. Der Zustand zeigt „Maßstab für diese Etage festlegen“, den Dateinamen und „Seite 2“. Die Aktion führt zum Maßstab. Auf Desktop und bei 390 px geprüft. |
| R2 · P2 | Die mobile Etagenwahl schnitt „Projekt verwalten“ links ab. Der Button begann bei x = −37,51 px; der Dialog begann bei x = 16 px. | Korrigiert. Die drei Aktionen stehen auf Mobil in eigenen Zeilen. Bei 320 px liegen sie vollständig zwischen x = 37 und 283 px. Ihre Höhe beträgt 44 px. Auch 390 px wurde erneut geprüft. |
| R3 · P2 | Beim Wechsel von „Projekt verwalten“ zur Entfernen-Bestätigung wird der fokussierte Auslöser entfernt. `document.activeElement` ist danach `BODY`, obwohl ein Dialog geöffnet bleibt. | Korrigiert. Projekt- und Etagenbestätigung fokussieren „Behalten“. Nach dem Rückweg liegt der Fokus wieder auf `INPUT#entity-name`. Die Bestätigung ist damit ohne verlorenen Fokus bedienbar. |

## Nachprüfung: Räume anordnen und Änderungen in einem anderen Tab

Die Nachprüfung verwendete zwei eigene Edge-Tabs auf derselben getrennten Adresse `127.0.0.1:52470`. Der In-App-Browser war für diesen Prüfagenten nicht verfügbar. Da Edge einen eigenen leeren Speicher hatte, wurden „Haus am Garten · Nachprüfung“, die Etage „Erdgeschoss“ und der manuelle Raum „Bad“ durch die Oberfläche angelegt. Der Raum misst 240 × 300 cm. Es wurden keine App-Dateien geändert und keine vollständigen Testsuiten gestartet.

Das zusätzliche Gestaltungskriterium ist konkret: Der Anordnungsmodus muss die Änderung einer Raumposition von der Verschiebung der Ansicht unterscheiden. Ein Konflikthinweis muss die Folgen seiner Aktionen nennen und die laufende Eingabe erhalten. Das bloße Betrachten eines anderen Projekts darf keine Inhaltsänderung vortäuschen.

| Prüfung | Beobachtetes Ergebnis |
| --- | --- |
| Modus und Hilfe | „Räume anordnen“ wechselt zu „Anordnen beenden“ mit `aria-pressed`. Der manuelle Raum erhält eine gestrichelte Kontur. Der Hilfetext nennt Ziehen, freie Fläche, feste PDF-Räume, Enter für X/Y und Escape. Er erklärt, dass Loslassen die Position speichert. |
| Ziehen und Speicherung | Bei 320 px wurde „Bad“ vom Ursprung `(400, 600)` mm durch einen Zeigerzug um 35 × 30 Bildschirmpixel auf X = 815,8 mm und Y = 956,4 mm verschoben. Nach Neuladen blieben diese DOM-Koordinaten und die Fläche 7,2 m² erhalten. |
| X/Y per Tastatur | Enter auf „Bad verschieben“ öffnet den Positionsdialog. X erhält den Fokus. Nach Abbrechen liegt der Fokus wieder auf derselben SVG-Raumfläche. Nach Speichern wird der zugehörige Raum in der Liste fokussiert. |
| Zahlenanzeige nach Drag | Nach der Korrektur stehen `81.58` und `95.64` in den X/Y-Feldern. Die vorher beobachtete Anzeige `216.70999999999998` tritt im nachgeprüften Fall nicht mehr auf. |
| Escape ohne laufenden Zug | Escape beendet den Anordnungsmodus. Der getrennte Nachweis für Escape während eines noch gedrückten Zeigers ist unten beschrieben. |
| Konflikthinweis bei 320 px | Text und beide Aktionen bleiben vollständig erreichbar. Die Buttons liegen bei x = 18 bis 302 px, sind 284 px breit und 44 px hoch. Kein horizontaler Dokumentüberlauf. |
| Konflikthinweis bei 390 px | Die Buttons liegen bei x = 18 bis 372 px, sind 354 px breit und 44 px hoch. Kein horizontaler Dokumentüberlauf. |
| „Beide Stände erhalten“ | Die ursprüngliche Fassung blieb sichtbar. Die lokale Änderung erschien zusätzlich als „Haus am Garten · Stand A (eigene Fassung)“. Die Aktion wurde per Enter ausgelöst. Der Fokus ging auf `MAIN#workspace-main`; eine Statusmeldung erklärte das Ergebnis. |
| „Aktuellen Stand laden“ | Der zweite Tab übernahm die gespeicherte Bibliothek mit beiden Fassungen. Die Warnung verschwand. Enter löste die Aktion aus; danach lag der Fokus auf `MAIN#workspace-main`. Eine Statusmeldung bestätigte die Übernahme. |
| Eintreffender Konflikt bei Eingabe | Während im X/Y-Dialog `125` eingegeben war, wurde im anderen Tab ein geänderter Stand gespeichert. Der Konflikthinweis erschien hinter dem Dialog. Der Fokus blieb auf X, der Wert blieb `125`, der Dialog blieb offen. |
| Auswahlwechsel nach R6-Korrektur | Für die Nachprüfung wurden ein zweiter Raum „Eingang“ und eine leere Etage „Obergeschoss“ angelegt. Beide Tabs wurden frisch geladen. Ein Projektwechsel in Tab B ließ Tab A unverändert im Obergeschoss; Status „Lokal gespeichert“, keine Warnung. Ein Etagenwechsel und ein Raumwechsel in Tab A ließen Tab B unverändert in seiner Etage; ebenfalls keine Warnung. |
| Echte Änderung nach R6-Korrektur | Nach Änderung des Raumnamens auf „Bad · geprüft“ und Verlassen des Felds erschien im anderen Tab wieder die Warnung mit beiden Aktionen und „Nicht gespeichert“. Bei 320 px blieben beide Buttons vollständig erreichbar. „Aktuellen Stand laden“ per Enter löste den Konflikt und fokussierte `workspace-main`. |

| ID | Befund | Änderung und Nachprüfung |
| --- | --- | --- |
| R4 · P2 | Der Positionsdialog eines bereits platzierten Raums schnitt „Position aufheben“ ab. Bei 320 px begann der Button bei x = −97,66 px, obwohl der Dialog bei x = 16 px begann. Bei 390 px begann der Button bei x = −27,66 px. | Korrigiert. Die drei Aktionen stehen auf Mobil untereinander. Bei 320 px liegen alle zwischen x = 37 und 283 px; bei 390 px zwischen x = 37 und 353 px. Jede Aktion ist 44 px hoch. Autofokus und Rückfokus wurden geprüft. |
| R5 · P2 | Mit dem neuen Anordnen-Button schrumpfte „Manuell angeordnet“ bei 320 px auf 13,89 px Breite. Der Text brach fast buchstabenweise um und beanspruchte 117 px Höhe. | Korrigiert. Die Beschriftung hat eine eigene Zeile mit 264 px Breite und 13 px Höhe. Der Hilfetext und die Aktionen sind lesbar; kein horizontaler Dokumentüberlauf. |
| R6 · P2 | Ein reiner Projektwechsel im zweiten Tab erzeugte im ersten Tab die Meldung „Die Projekte wurden … geändert“ und den Status „Nicht gespeichert“. Reproduktion: Beide Tabs synchronisieren; im zweiten Tab nur eine andere Projektkarte öffnen. Es wurde kein Inhalt bearbeitet. | Korrigiert. Der Vergleich unterscheidet Auswahlkontext von Inhalt. Mit zwei frisch geladenen Tabs geprüft: Projekt-, Etagen- und Raumwechsel lösen keine Warnung aus und wechseln die andere Ansicht nicht. Eine echte Namensänderung löst weiterhin die Warnung aus. Das Laden des aktuellen Stands funktioniert danach per Tastatur. |

### Weitere Bildschirmbelege

- [Anordnungsmodus bei 320 px nach Korrektur](../screenshots/hierarchy/review-anordnen-320-nachher.jpg)
- [Anordnungsmodus bei 390 px nach Korrektur](../screenshots/hierarchy/review-anordnen-390-nachher.jpg)
- [R4: Positionsdialog vor der Korrektur, 320 px](../screenshots/hierarchy/review-anordnen-xy-320.jpg)
- [R4: Positionsdialog vor der Korrektur, 390 px](../screenshots/hierarchy/review-anordnen-xy-390-vorher.jpg)
- [R4: Positionsdialog nach der Korrektur, 320 px](../screenshots/hierarchy/review-anordnen-xy-320-nachher.jpg)
- [R4: Positionsdialog nach der Korrektur, 390 px](../screenshots/hierarchy/review-anordnen-xy-390-nachher.jpg)
- [X/Y-Werte nach Drag, 320 px](../screenshots/hierarchy/review-anordnen-werte-320.jpg)
- [R5: Planbeschriftung vor der Korrektur, 320 px](../screenshots/hierarchy/review-anordnen-titel-320-vorher.jpg)
- [R5: Planbeschriftung nach der Korrektur, 320 px](../screenshots/hierarchy/review-anordnen-titel-320-nachher.jpg)
- [Konflikthinweis auf Desktop](../screenshots/hierarchy/review-tabkonflikt-desktop.jpg)
- [Konflikthinweis bei 320 px](../screenshots/hierarchy/review-tabkonflikt-320.jpg)
- [Konflikthinweis bei 390 px](../screenshots/hierarchy/review-tabkonflikt-390.jpg)
- [Erhaltene Projektfassungen bei 390 px](../screenshots/hierarchy/review-tabkonflikt-ergebnis-390.jpg)
- [R6: Konflikthinweis nach reinem Projektwechsel](../screenshots/hierarchy/review-tabkonflikt-nur-navigation.jpg)
- [R6: Keine Warnung nach Projektwechsel, nach Korrektur](../screenshots/hierarchy/review-tabnavigation-projekt-nachher.jpg)
- [R6: Andere Ansicht bleibt nach Raumwechsel erhalten](../screenshots/hierarchy/review-tabnavigation-raum-nachher.jpg)
- [Echte Inhaltsänderung löst weiterhin die Warnung aus, 320 px](../screenshots/hierarchy/review-tabkonflikt-echte-aenderung-320-nachher.jpg)

## Beibehalten

- Die Projektvorschau zeigt echte Konturen. Projekte ohne Zeichnung erhalten ein sachliches Gebäudesymbol.
- Die Etagenzeichnung bewahrt gemeinsame Lage und Maßstab. Die Raumliste ergänzt den Zugang und ersetzt die Zeichnung nicht.
- Manuelle Räume ohne Position werden ausdrücklich getrennt. Das verhindert eine falsche Aussage über den Grundriss.
- Etagenwechsel und Raumöffnung bleiben auf Mobil erreichbar. Die neue Auswahlansicht nennt den aktiven Kontext.
- Die bestehenden Farben und Symbole bilden eine durchgehende Oberfläche. Es gibt keine dekorativen Diagramme oder erfundenen Fertigstellungsanzeigen.

## Bildschirmbelege

- [Leere Bibliothek](../screenshots/hierarchy/review-bibliothek-leer.jpg)
- [Projekt ohne Etagen](../screenshots/hierarchy/review-projekt-leer.jpg)
- [Bibliothek mit zwei Projekten](../screenshots/hierarchy/review-bibliothek-desktop.jpg)
- [Bibliothek bei 320 px mit langem Namen](../screenshots/hierarchy/review-bibliothek-320.jpg)
- [Gemeinsame Etagenzeichnung auf Desktop](../screenshots/hierarchy/review-etage-desktop.jpg)
- [Etagenzeichnung bei 390 px](../screenshots/hierarchy/review-etage-390.jpg)
- [Etagenzeichnung bei 320 px](../screenshots/hierarchy/review-etage-320.jpg)
- [R1 vor der Korrektur](../screenshots/hierarchy/review-og-ohne-massstab.jpg)
- [R1 nach der Korrektur, Desktop](../screenshots/hierarchy/review-og-massstab-desktop.jpg)
- [R1 nach der Korrektur, 390 px](../screenshots/hierarchy/review-og-massstab-390.jpg)
- [R2 vor der Korrektur](../screenshots/hierarchy/review-etagenwahl-390-overflow.jpg)
- [R2 nach der Korrektur, 320 px](../screenshots/hierarchy/review-etagenwahl-320.jpg)
- [R2 nach der Korrektur, 390 px](../screenshots/hierarchy/review-etagenwahl-390.jpg)
- [Manueller Raum ohne Position](../screenshots/hierarchy/review-raum-unplatziert.jpg)
- [Manuelle Position nach Neuladen](../screenshots/hierarchy/review-manuell-neugeladen.jpg)
- [Benannte Entfernen-Bestätigung](../screenshots/hierarchy/review-entfernen-bestaetigung.jpg)
- [Korrigierter Fokus auf Behalten](../screenshots/hierarchy/review-entfernen-fokus.jpg)

## Grenzen

Diese Prüfung verwendet Browser mit nachgebildeten Ansichtsgrößen. Ein physisches iPhone, Bildschirmtastatur, manuelle Screenreader-Bedienung und Druck wurden nicht geprüft. Die direkte manuelle Raumverschiebung wurde in der Nachprüfung über CUA geprüft. Die CUA-Aktion `drag(from, to)` verarbeitet Escape in diesem Prüfweg erst nach Ende des Zeigerzugs. Daher ist Escape während eines laufenden Zugs kein eigener CUA-Nachweis. Der Hauptagent meldet dafür den erfolgreichen gezielten Browserfall in `tests/arrangement.e2e.spec.ts`, einschließlich `pointercancel`; dieser Lauf wurde nicht von diesem Prüfagenten ausgeführt.

Ein erneuter PDF-Upload war in Edge durch die fehlende Erweiterungsoption „Allow access to file URLs“ gesperrt. Die Berechtigung wurde nicht geändert. Die festen PDF-Positionen im neuen Anordnungsmodus wurden deshalb nicht erneut durch diesen Agenten bedient. Dafür liegen laut Hauptagent ein gesonderter CUA-Nachweis des Spatial-Agenten und gezielte automatische Anordnen-Tests vor. Der frühere eigene Nachweis der PDF-Raumlage steht oben. Diese Nachweise sind von der neuen eigenen Prüfung zu unterscheiden.

Die Datei-Rundläufe, fehlende PDF-Dateien, Speicherfehler und Geometrieregressionen gehören in den gesonderten Funktionsnachweis. Die hier gezeigten positiven UI-Befunde ersetzen diese Prüfungen nicht.
