# Bereinigung der Projektübersicht

Stand: 26. Oktober 2026. Grundlage sind [UX-DESIGN-VERTRAG.md](UX-DESIGN-VERTRAG.md), [UI-FINISH-GATE.md](UI-FINISH-GATE.md), [UX-ABLAEUFE.md](UX-ABLAEUFE.md) und der aktuelle Quellcode.

| Änderung | Begründung und Nachweis |
| --- | --- |
| Einleitung „Wähle die Räume … Öffne einen Plan …“ entfernt | „Räume anzeigen“ und „Raum bearbeiten“ benennen diese Aktionen bereits. Die zugehörigen Absatzstile und die Anordnung des früheren Text-/Aktionspaars sind ebenfalls entfernt. |
| Flächenhinweis präzisiert | „Hindernisflächen sind von den Raumflächen abgezogen. Materialmengen stehen im jeweiligen Raumplan.“ `roomGeometry` in `geometry.ts` zieht Hindernisse geometrisch ab; `roomArea` verwendet dieses Ergebnis. Der Hinweis zum gemeinsamen Bildschirmmaßstab bleibt bestehen. |
| Text in „Markierung verwerfen?“ gekürzt | Der allgemeine Dialog sagt nun: „Die aktuelle Markierung ist noch nicht übernommen. Beim Fortfahren wird sie verworfen.“ Die Folge bleibt ausdrücklich benannt. |
| Sechs alte CSS-Regeln entfernt | `.room-switcher-row`, dessen Kindregeln und die direkten Label-Regeln von `.room-switcher` haben seit der sichtbaren Raumliste kein zugehöriges Element mehr. Entfernt ist auch die mobile Dropdown-Höhe. |

Alle Aktionslabels bleiben unverändert. Berechnung, Fokussteuerung, Scrollziele, PDF-Zoomleiste und Mindestgrößen wurden nicht geändert. Die fachlichen Vorschauen, Manrope, grüne Akzente und Phosphor-Symbole bleiben erhalten.

## Verifikation nach der Änderung

- Drei bestehende Browsertests bestanden: gemeinsame Raumvorschau mit Auswahlfokus; PDF-Entwurfsschutz bei Seiten- und Ansichtswechsel; mobile Projekt-/Planansicht.
- Der Mobiltest prüft die vollständige erste Vorschau bei 390 × 844 px, den Fokus und das Scrollziel beim Raumöffnen sowie Bedienflächen von mindestens 44 × 44 px und fehlenden horizontalen Überlauf bei 390 und 320 px.
- Zwei bestehende Geometrietests bestanden: Abzug von Hindernissen und Randfugen; einmaliger Abzug überlappender und teilweise außerhalb liegender Hindernisse.
- `npx tsc -b` und `git diff --check` bestanden. Die Quellsuche findet keine alten Dropdown- oder Einleitungsselektoren mehr.

Ausgeführte Testbefehle:

```sh
npx playwright test tests/project.e2e.spec.ts --grep 'Projekt zeigt getrennte Räume|Wizard erhält Markierungen|Mobile Projektansicht' --workers=1
npx vitest run tests/geometry.test.ts -t 'zieht Hindernisse|subtrahiert überlappende'
```

Diese Nachprüfung umfasste die beschriebenen Browser- und Geometriefälle. Die [Abnahme](UX-ABNAHME.md) dokumentiert den vollständigen Lauf und den Build. Tests auf einem physischen iPhone, mit Screenreader oder am Drucker standen hier aus.
