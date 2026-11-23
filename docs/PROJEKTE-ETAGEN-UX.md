# Projekte, Etagen und räumliche Übersicht

Stand: 28. Oktober 2026. Status: **Gestaltungsvertrag für die Umsetzung. Noch keine Abnahme.**

## Auftrag

Fugenplan soll mehrere unabhängige Projekte verwalten. Jedes Projekt enthält Etagen. Jede Etage enthält Räume. Eine Etagenübersicht zeigt die Räume gemeinsam an ihrer tatsächlichen Position. Der vorhandene PDF-Assistent bleibt der Weg vom Grundriss zur Raumkontur und zum Verlegeplan.

Der gewünschte Qualitätsmaßstab ist eine sorgfältig gestaltete, leicht verständliche Anwendung. Geprüft werden konkrete Abläufe, erkennbare Zustände, Lesbarkeit und räumliche Richtigkeit.

## Belegter Ausgangszustand

- `floorplan-types.ts` enthält einen Workspace mit Räumen und höchstens einer PDF. Projekte und Etagen fehlen als eigene Objekte.
- `ProjectOverview.tsx` berechnet Raumpläne und stellt jeden Raum in einer eigenen Vorschau dar. Die Vorschauen haben einen gemeinsamen Bildschirmmaßstab, aber keinen gemeinsamen räumlichen Ursprung.
- Jeder PDF-Raum enthält bereits `documentId`, `page`, `points` und `origin`. `calibration.ts` rechnet zwischen PDF-Koordinaten und lokalen Millimetern um. Diese Daten belegen die Lage innerhalb derselben PDF-Seite.
- `FloorPlanEditor.tsx` führt durch vier Schritte. Es gibt bereits Schutz vor dem Verwerfen einer ungespeicherten Markierung, Seitenwechsel, Maßstab und weitere Räume.
- Die vorhandene Oberfläche verwendet Manrope, eine grüne Akzentfarbe, Phosphor-Symbole und helle Zeichenflächen. Diese Grundlage bleibt erhalten.

Die bisherigen UX-Prüfberichte gelten für ihren dokumentierten Stand. Sie belegen die neue Hierarchie nicht.

## Ableitung aus Herstellerquellen

Die folgenden Primärquellen wurden am 28. Oktober 2026 gelesen. Apples HTML-Seiten verweisen auf eigene Markdown-Fassungen. Diese wurden direkt von `developer.apple.com` abgerufen. Die Übertragung auf Fugenplan ist eine Gestaltungsentscheidung für eine Webanwendung.

| Quelle | Belegtes Prinzip | Entscheidung für Fugenplan |
| --- | --- | --- |
| [Apple HIG: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) | Seitenleisten eignen sich für Sammlungen. Apple empfiehlt im Regelfall höchstens zwei sichtbare Hierarchieebenen und kurze Gruppenbezeichnungen. | Die Projektbibliothek ist eine eigene Ebene. Innerhalb eines Projekts zeigt die Seitenleiste Etagen und bei Bedarf ihre Räume. Kein dreifach eingerückter Gesamtbaum mit allen Projekten. |
| [Apple HIG: Split views](https://developer.apple.com/design/human-interface-guidelines/split-views) | Eine geteilte Ansicht verbindet Auswahl und Detail. Die aktuelle Auswahl bleibt sichtbar. Auf schmalen Ansichten ist eine mehrspaltige Darstellung ungeeignet. | Auf Desktop stehen Etagenwahl und Zeichnung nebeneinander. Auf dem Smartphone folgen Auswahl und Detail aufeinander. Der aktive Projekt- und Etagenname bleibt erkennbar. |
| [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout) | Abstände und Gruppierung erklären Zusammenhänge. Zusätzliche Funktionen werden schrittweise sichtbar gemacht. | Die Etagenzeichnung führt. Seltene Verwaltungsschritte liegen bei ihrem jeweiligen Objekt. Projekt-, Etagen- und Raumbearbeitung werden nicht gleichzeitig als Formularstapel gezeigt. |
| [Apple HIG: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars) | Werkzeugleisten sollen bewusst ausgewählte Aktionen enthalten. Navigation, Titel und Aktionen haben getrennte Aufgaben. Eine hervorgehobene Hauptaktion setzt einen klaren Schwerpunkt. | Rückweg links, Name im Inhaltskopf, passende Aktion rechts. Dateiimport und Raumaufnahme tragen ihren Kontext. Keine mehrfachen grünen Hauptaktionen mit gleichem Zweck. |
| [Apple HIG: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles) | Verständliche Hierarchie, präzise Sprache und sorgfältige Details tragen zur Qualität bei. Dekoration darf die Aufgabe nicht behindern. | Der eigentliche Grundriss ist das prägende Bild. Keine Werbetexte, dekorativen Statistiken, Farbverläufe oder Erfolgssprüche. |

Es wird keine Apple-Oberfläche kopiert. Native Apple-Materialien und SF Symbols werden nicht als vorhandene Webfunktionen ausgegeben.

## Informationsstruktur

```text
Projekte
└── Projektname
    ├── Erdgeschoss
    │   ├── Wohnen
    │   ├── Küche
    │   └── Flur
    └── Obergeschoss
        ├── Schlafzimmer
        └── Bad
```

Die Namen im Beispiel sind vom Benutzer vergebene Bezeichnungen. Eine PDF-Seite wird nicht allein aufgrund ihrer Seitennummer als Erdgeschoss oder Obergeschoss ausgegeben.

### Projektbibliothek

Die Überschrift lautet **Projekte**. Die primäre Aktion lautet **Projekt anlegen**. Eine vorhandene Projektdatei kann über **Projekt öffnen** hinzugefügt werden.

Ein Projekt wird durch seinen Namen und eine echte Vorschau gekennzeichnet. Daneben stehen Etagen- und Raumanzahl. Die Darstellung ist eine Sammlung von Arbeitsdokumenten, kein Dashboard. Prozentanzeigen, Fortschrittsringe und erfundene Fertigstellungszustände entfallen.

**Projekt anlegen** fragt nur den Namen ab. Nach dem Anlegen öffnet sich dieses Projekt. **Etage anlegen** und **Grundriss importieren** bilden den nächsten sinnvollen Schritt. Ein neues Projekt enthält keine erfundenen Räume.

### Geöffnetes Projekt

Die Navigation zeigt den Rückweg **Projekte** und den Projektnamen. Links steht eine Etagenliste. Einträge zeigen den Namen, eine sichtbare Auswahlmarkierung und die Raumanzahl. **Etage anlegen** steht bei der Liste und bleibt ohne langes Scrollen erreichbar.

Die Hauptfläche zeigt die gewählte Etage. Ihr Name ist die Überschrift. Direkt darunter steht gegebenenfalls der Bezug, zum Beispiel **Grundriss.pdf · Seite 2**. Ein Etagenwechsel zeigt die andere Etage; Raumpläne dürfen nicht aus beiden Etagen gemischt werden.

Die gemeinsame Etagenzeichnung steht vor den Raumdaten. Eine kompakte Raumliste unter oder neben der Zeichnung bietet einen zweiten, tastaturgeeigneten Zugang. Ein Klick auf eine Raumfläche oder auf **Raum bearbeiten** öffnet den Raum. Die bisherige Auswahl „Räume anzeigen“ darf die räumliche Übersicht nicht wieder in einen Kartenvergleich verwandeln.

### Raumansicht

Der Rückweg nennt die Etage. Der Raumname bleibt die Hauptüberschrift. Raum, Belag, Verlegung und Varianten wirken ausschließlich auf den geöffneten Raum. Projekt- und Etagenwechsel sind Navigation; sie erzeugen keine Änderung an einem Raum.

Die vorhandene direkte Raumwahl kann bleiben. Sie zeigt die Räume der aktiven Etage. Ein anderer Etagenname ist über die Etagenwahl erreichbar. Diese beiden Aufgaben dürfen keine doppelte Gesamtnavigation ergeben.

## Gemeinsame Zeichnung

Die Etagenzeichnung besitzt genau einen Koordinatenraum und einen Maßstab. Sie enthält echte Konturen, Hindernisse und berechnete Beläge. Jeder Raum behält seine eigene Verlegung. Ein gemeinsamer Fugenursprung über mehrere Räume ist keine automatische Folge dieser Erweiterung.

Für Räume auf derselben kalibrierten PDF-Seite gilt die vorhandene Transformation:

```text
PDF-X = lokale Raum-X / Millimeter je PDF-Einheit + source.origin.x
PDF-Y = lokale Raum-Y / Millimeter je PDF-Einheit + source.origin.y
```

Damit bleiben Abstand, Wandstärke, relative Größe und die Lage zueinander erhalten. Raumpläne dürfen in der Übersicht weder einzeln zentriert noch einzeln skaliert werden. Eine PDF-Vorlage darf als Hintergrund sichtbar sein. Ein Schalter **PDF anzeigen** kann die Vorlage ausblenden, ohne Konturen oder Lage zu ändern.

Räume aus verschiedenen PDF-Seiten haben zunächst keinen belegten gemeinsamen Ursprung. Die Umsetzung muss diesen Fall ausdrücklich behandeln: entweder als getrennte Etagenbezüge oder durch eine vom Benutzer festgelegte Platzierung. Eine automatische Anordnung nebeneinander ist kein Nachweis ihrer tatsächlichen Lage.

Manuelle Räume ohne gespeicherte Platzierung stehen unter **Noch nicht angeordnet**. Sie dürfen nicht still in der maßstäblichen Etagenzeichnung erscheinen. Eine Aktion **Im Grundriss anordnen** legt eine echte Position fest. Falls manuelle Positionen unterstützt werden, müssen sie mit der Etage gespeichert und wieder geladen werden. Präzise Eingaben für X und Y in Zentimetern ergänzen eine direkte Verschiebung. Eine Verschiebung ändert die Etagenposition, nicht die lokalen Raummaße oder die Verlegung.

Die Zeichnung braucht **Vergrößern**, **Verkleinern** und **Alles zeigen**. Diese Werkzeuge bleiben außerhalb der markierbaren Raumflächen. Die Größenangabe bezieht sich auf die gemeinsame Ansicht. Raumname und Auswahl sind auch ohne Farbunterscheidung erkennbar.

## PDF-Ablauf

1. Der Benutzer öffnet ein Projekt und wählt oder erstellt eine Etage.
2. **Grundriss importieren** öffnet den vorhandenen Assistenten. Der sichtbare Kontext nennt Projekt und Etage.
3. Datei und Seite werden gewählt. Die Ziel-Etage ist sichtbar und kann vor der Übernahme geändert werden.
4. Die bekannte Wand setzt den Maßstab der betreffenden Vorlage. Der bestehende Schutz vor einer ungültigen Kalibrierung bleibt erhalten.
5. Jede markierte Kontur wird als Raum der benannten Etage übernommen.
6. **Weiteren Raum markieren** behält Datei, Seite, Maßstab und Etage bei.
7. **Etage ansehen** zeigt die aufgenommenen Räume gemeinsam an ihren PDF-Positionen.
8. Für eine weitere Etage kann eine andere Seite derselben PDF oder eine andere PDF gewählt werden. Bestehende Etagen und deren Quellen bleiben erhalten.

Eine neue PDF ersetzt keine andere Etage im Hintergrund. Wird eine verwendete Vorlage ersetzt, nennt die Bestätigung die betroffene Etage und die tatsächliche Folge für Lage und Maßstab. Andere Projekte und Etagen bleiben unverändert.

## Verwaltung und sichere Zustände

| Aktion | Erwartetes Verhalten |
| --- | --- |
| Projekt oder Etage umbenennen | Kurzer Dialog mit einem benannten Feld. Änderungen beeinflussen keine IDs, Zuordnungen oder Konturen. |
| Projekt wechseln | Zielprojekt mit seiner letzten sinnvollen Auswahl öffnen. Ein ungespeicherter PDF-Entwurf wird vorher geschützt. |
| Etage wechseln | Neue Etage und ihr Raumumfang sichtbar anzeigen. Keine alte PDF-Vorschau unter einem neuen Etagennamen stehen lassen. |
| Raum einer anderen Etage zuordnen | Ziel-Etage ausdrücklich nennen. Die PDF-Lage nur erhalten, wenn der Zielbezug kompatibel ist. Andernfalls Lage lösen und den Raum als noch nicht angeordnet zeigen. |
| Projekt oder Etage entfernen | Name und Umfang nennen. Keine vorausgewählte destruktive Aktion. Rückgängig oder eine gleichwertige Wiederherstellung anbieten. |
| Projektdatei öffnen | Projekt in die Bibliothek aufnehmen. Bestehende Projekte nicht still überschreiben. |
| Projekt exportieren | Das ausgewählte Projekt mit allen Etagen, Räumen, Platzierungen, Kalibrierungen und benötigten PDFs sichern. SVG, Druck und CSV dürfen weiter klar als Ausgabe des aktiven Raums benannt sein. |
| Bestehenden Browserstand übernehmen | Räume, Maße, Beläge und Quellen erhalten. Nicht belegte Etagenbezeichnungen neutral benennen. Die Migration darf keinen Beispielraum neu in echte Pläne einfügen. |

| Zustand | Inhalt und nächste Aktion |
| --- | --- |
| Keine Projekte | **Noch keine Projekte**. **Projekt anlegen** und **Projektdatei öffnen**. Keine Platzhalterprojekte. |
| Projekt ohne Etagen | Projektname bleibt sichtbar. **Erste Etage anlegen**. |
| Etage ohne Räume | Etagenname und gegebenenfalls Quelle. **Grundriss importieren** oder **Raum anlegen**. Keine leere Raumkarte mit Standardmaßen. |
| Nur nicht angeordnete Räume | Diese Räume mit Namen und Bearbeitungsaktion zeigen. Hinweis auf fehlende Position. Kein scheinbar vollständiger Grundriss. |
| PDF-Datei fehlt | Gespeicherte Konturen bleiben sichtbar. Konkreter Dateiname und **PDF erneut öffnen**. Kein vollständiger Datenverlust. |
| Einzelner Raum kann nicht berechnet werden | Kontur und Raumname bleiben auffindbar. Fehler am Raum benennen; andere Raumpläne bleiben nutzbar. |
| Speichern fehlgeschlagen | Fehler sichtbar halten. Keine Erfolgsmeldung. Export als Sicherungsweg anbieten. |
| Eine Berechnung läuft | Nur betroffene Berechnung als ausstehend kennzeichnen. Keine alte Berechnung als aktuell ausgeben. |

## Gestaltung und Umsetzung

Bestehende Farben und Schrift bleiben die Grundlage. Neue Klassen werden unter einem klaren Komponentenbereich wie `project-library`, `floor-navigation` und `floor-overview` geführt. Globale `.button`-Regeln werden nicht für einzelne Sonderfälle überschrieben.

Die räumliche Hierarchie lautet **Etagenname → gemeinsame Zeichnung → Raumliste → einzelne Materialangaben**. Eine einzelne, große Zeichenfläche ersetzt die dominante Sammlung von Raumkarten. Eine Auswahlfarbe zeigt den aktiven Kontext. Unterschiedliche Etagen brauchen keine unterschiedlichen dekorativen Farben.

Desktop ab etwa 900 px: eine Seitenleiste von 240 bis 280 px und eine flexible Zeichenfläche. Zwischenbereiche dürfen die Seitenleiste schmaler oder einklappbar machen. Unter 640 px wird die Hierarchie nacheinander gezeigt; eine ständig sichtbare linke Spalte entfällt. Diese Werte sind Startwerte für die Umsetzung und müssen am tatsächlichen Inhalt geprüft werden.

Auf Mobil steht der Grundriss vor dem langen Raumverzeichnis. Projekt-Rückweg, Etagenname und Etagenwechsel bleiben erreichbar. Das Etagenmenü braucht eine sichtbare Schaltfläche und darf nicht ausschließlich über eine Wischgeste erreichbar sein.

Neue Bedienflächen sind mindestens 44 × 44 px groß. Der Fokus bleibt bei geöffneten Dialogen im Dialog und kehrt nach dem Schließen zum Auslöser zurück. Nach einem Etagen- oder Raumwechsel wird die neue Hauptüberschrift erreichbar fokussiert. Versteckte Seitenleisten dürfen keine unsichtbaren Tab-Ziele enthalten.

Bewegung hat ausschließlich eine erklärende Funktion. Der Wechsel zwischen Kontexten darf kurz überblenden; Konturen dürfen dabei keine falsche Zwischenlage suggerieren. Die vorhandene Regel für reduzierte Bewegung bleibt wirksam. Ein neues Erscheinungsbild-Menü ist für diese Erweiterung der bestehenden Anwendung nicht erforderlich.

## Prüffälle vor Abschluss

Die Tabelle ist ein Prüfauftrag. **Kein Eintrag gilt allein durch diesen Vertrag als bestanden.**

| ID | Voraussetzung und Handlung | Erforderlicher Nachweis |
| --- | --- | --- |
| P1 | Zwei Projekte mit unterschiedlichen Namen und Räumen anlegen, wechseln, neu laden | Beide Projekte bleiben getrennt. Änderungen am Raum A verändern Projekt B nicht. Browsernachweis und Speicherprüfung. |
| P2 | In einem Projekt Erdgeschoss und Obergeschoss anlegen | Beide Etagen sind wählbar. Jede enthält nur ihre zugeordneten Räume. Leere Etagen bleiben sichtbar und bedienbar. |
| P3 | Zwei unterschiedlich große Räume auf derselben kalibrierten PDF-Seite markieren | Gemeinsame Ansicht bewahrt Größenverhältnis, Abstand und Lage. Abgleich mit Quellpunkten, Screenshot und Berechnung der Transformation. |
| P4 | Einen Raum öffnen, Belag oder Muster ändern und zur Etage zurückkehren | Der geänderte Raum liegt unverändert an derselben Stelle. Sein neuer Plan erscheint zusammen mit den anderen Räumen. |
| P5 | Zweite PDF-Seite oder zweite PDF einer weiteren Etage zuordnen | Erste Etage bleibt erhalten. Der Assistent und seine Abschlussaktion nennen die richtige Etage. |
| P6 | Einen manuellen Raum anlegen und seine Lage festlegen | Keine automatische erfundene Lage. Nach Platzierung und Neuladen stimmen Position und Raummaße. |
| P7 | Projekt-, Etagen- und Raumname ändern | Namen erscheinen konsistent in Navigation, Zeichnung und Export. IDs und Quellen bleiben erhalten. |
| P8 | Ein altes Projekt mit mehreren PDF-Räumen laden | Alle vorhandenen Räume, Kalibrierungen und Quellen bleiben vorhanden. Neue Hierarchie ist erreichbar. Keine still verworfenen Daten. |
| P9 | Ein neues Projekt mit mehreren Etagen exportieren und erneut öffnen | Alle Etagen, Räume, Positionen, PDFs und Maßstäbe stimmen überein. Bereits vorhandenes Projekt bleibt erhalten. |
| P10 | Während einer ungespeicherten PDF-Kontur Projekt oder Etage wechseln | Schutzdialog bietet Weiterarbeiten. Nach Abbruch des Wechsels bleiben Punkte und Raumname erhalten. |
| P11 | Aktives Projekt, aktive Etage oder Raum entfernen und wiederherstellen | Keine verwaisten aktiven IDs. Umfang der Entfernung stimmt mit der Bestätigung überein. Rückweg ist nutzbar. |
| P12 | 1280 × 720, 390 × 844 und 320 × 844 px | Kein horizontaler Dokumentüberlauf. Der wichtigste Grundriss ist ohne vorgeschalteten Formularstapel sichtbar. Alle neuen Hauptaktionen bleiben erreichbar. Screenshots mit echtem Inhalt. |
| P13 | Tastatur durch Bibliothek, Etagenwahl, Raumliste, Dialoge und Rückwege | Auswahl bleibt erkennbar. Keine Fokusfalle außerhalb eines aktiven Dialogs. Kein Fokusverlust nach Kontextwechsel. |
| P14 | Ein Raumfehler und eine fehlende PDF | Übrige Räume bleiben zugänglich. Fehler nennt seine Ursache und einen nächsten Schritt. |
| P15 | Unabhängiger Abschluss durch Anti-KI-Slop-Agent | Prüfung der gerenderten Desktop- und Mobiloberfläche. Fachliche Inhalte führen; keine unpassenden Statistik-Karten, Leertexte, dekorativen Labels oder doppelten Aktionen. Befunde korrigieren und nachprüfen. |

## Besondere Risiken

1. **Datenmodell ohne UI-Folge:** Neue IDs allein erfüllen die Aufgabe nicht. Die drei Ebenen müssen bedienbar und nach dem Neuladen wiedererkennbar sein.
2. **Scheinbare räumliche Richtigkeit:** Gleicher Maßstab allein genügt nicht. Quellursprung und Seite müssen berücksichtigt werden.
3. **PDF-Ersatz am falschen Umfang:** Eine neue Etagenquelle darf die Räume anderer Etagen nicht von ihrer Vorlage lösen.
4. **Widersprüchliche Navigation:** Ein ausgewählter Raum darf nicht unter dem Namen einer anderen Etage erscheinen.
5. **Zu große Berechnungslast:** Die Übersicht darf nicht alle Projekte und alle Etagen gleichzeitig berechnen. Sie berechnet die aktive Etage und zeigt ausstehende Ergebnisse ehrlich.
6. **Verdeckte Datenverluste:** Projektdateien, Browsermigration, Rückgängig und Varianten dürfen Zuordnungen oder Platzierungen nicht unbemerkt verlieren.
7. **Unbelegte Qualitätsbehauptung:** Ein automatischer Test ersetzt weder die visuelle Prüfung noch einen echten Screenreader- oder iPhone-Test. Der Abschluss nennt nur durchgeführte Prüfungen.
