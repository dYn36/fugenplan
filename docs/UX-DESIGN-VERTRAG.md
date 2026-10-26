# Projektansicht und Grundriss-Assistent

## Zweck

Fugenplan ist ein Werkzeug für maßhaltige Verlegepläne. Die Oberfläche zeigt echte Raumkonturen, Material und Zuschnitte. Bestehende Schrift, grüne Akzentfarbe, Phosphor-Symbole und ruhige Planflächen bleiben die Grundlage.

## Verbindlicher Umfang

1. Die Projektübersicht ist der Einstieg. Mehrere ausgewählte Räume erscheinen gleichzeitig als berechnete Verlegepläne. Ihre Vorschauen nutzen denselben Bildschirmmaßstab. Auswahl und Löschen sind getrennte Aktionen.
2. Räume lassen sich direkt öffnen. Die Einzelansicht zeigt eine sichtbare Raumliste und einen Rückweg zum Projekt. Änderungen gelten für den benannten Raum.
3. Der PDF-Assistent führt durch Datei und Seite, Wandmaß, Raumkontur und Abschluss. Ein weiterer Raum lässt sich ohne Neustart erfassen. Rückwege, Fehler und Entwurfsverlust müssen erkennbar sein.
4. Die zusätzliche Fliesenvorlage 12 × 30 cm setzt 120 × 300 mm. Eigene Maße und vorhandene Vorgaben bleiben erhalten.
5. Auf schmalen Bildschirmen steht die Planansicht vor den Einstellungen. Direkte Sprungaktionen verbinden beide Bereiche.

## Gestaltungsregeln

- Fachliche Inhalte führen: Grundriss, Maßstab, Raumnamen, Belag, Zuschnitte.
- Keine Marketingüberschriften, dekorativen Kennzahlen, Farbverläufe oder Bewegungen ergänzen.
- Schaltflächen benennen ihre Aktion. Eine Bestätigung nennt den betroffenen Raum und die tatsächliche Folge.
- Neue und geänderte Touch-Aktionen erhalten mindestens 44 px Höhe. Checkboxen und aktuelle Schritte sind ohne Farbe erkennbar.
- Vorschauen zeigen berechnete Daten. Lade- und Fehlerzustände dürfen keine gültige Berechnung vortäuschen.

## Nachweise vor Abschluss

Der Ausgangsaudit steht in [UX-AUDIT.md](UX-AUDIT.md). Der UX Architect prüft das vollständige Ablaufinventar. Danach prüft der UI Finish-Gate Reviewer die fertige Oberfläche anhand von Bildschirmbildern und Laufzeitbelegen. Zum Schluss bereinigt ein eigener Agent unnötige Texte, Dekoration und uneinheitliche Bedienmuster. Ergebnisse, Korrekturen und verbleibende Grenzen werden getrennt dokumentiert.

Zusätzlich werden die bestehenden Geometrie-, Datei- und Browsertests sowie neue Mehrraum-/Wizard-Prüfungen ausgeführt. Ein automatischer Accessibility-Scan ersetzt keinen manuellen Screenreader-Test.
