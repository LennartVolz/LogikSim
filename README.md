# LogikSim

Ein browserbasierter Logiksimulator für Digitaltechnik und Rechenarchitektur. Schaltungen werden grafisch aufgebaut, ereignisbasiert simuliert und live analysiert – ohne Installation.

## Funktionsumfang (MVP)

**Editor**

- SVG-Schaltplan mit Raster, Snap-to-Grid, Zoom, Pan und Touch-Gesten
- Touch-Bedienung: Bauteile am Griff aus der Bibliothek ziehen, Pinch-Zoom, größere Trefferflächen und mobile Panel-Leiste
- Bauteile per Drag-and-drop oder Klick platzieren, verschieben, löschen
- Leitungen durch Anklicken zweier Anschlüsse verbinden, inklusive Rückkopplungen
- Undo/Redo, automatische lokale Speicherung, JSON-Import und -Export
- Elf vorgefertigte Beispielschaltungen

**Bauteile**

- Logikgatter: AND, OR, NOT, NAND, NOR, XOR, XNOR
- Ein-/Ausgänge, Konstanten 0/1, Taktgeber
- D-Flip-Flop mit asynchronem Reset
- 4-Bit-Register mit Load, Takt und asynchronem Clear
- 4-Bit-Binärzähler mit Enable, parallelem Load, Modulo 2–16, asynchronem Clear und Terminal Count
- 4-Bit-Inkrementer, 2:1-Multiplexer und 1:2-Demultiplexer (je 1 und 4 Bit), 4-Bit-ALU, 4-Bit-Splitter, 4-Bit-Merger
- Ein- und Ausgänge sind als 1-, 4- oder 8-Bit-Bus konfigurierbar

**Simulation**

- Ereignisbasierte Ausbreitung: Nur beeinflusste Bauteile werden neu berechnet
- Leitungen zeigen ihren Signalzustand farblich, Busse zusätzlich als Binärwert
- Manuelle Taktschritte oder automatischer Lauf mit 1–16 Hz
- Synchrone Übernahme bei steigender Taktflanke; alle Flip-Flops und Register übernehmen gleichzeitig
- Erkennung nicht verbundener Eingänge, doppelter Treiber, Breitenkonflikte und schwingender Rückkopplungen

**Analyse**

- Wahrheitstabelle für bis zu 8 Eingangsbits, live aus der Schaltung erzeugt
- Timing-Diagramm mit automatischer Aufzeichnung aller Schalt- und Taktschritte; Busse werden in Bit-Spuren aufgelöst
- Prüfliste mit Warnungen und Fehlern, direkt verlinkt zum betroffenen Bauteil

**Lernmodus**

- XOR aus Grundgattern (XOR/XNOR gesperrt)
- Halbaddierer
- 4-Bit-Inkrementierer aus Gattern (fertiger Inkrementer gesperrt)
- Automatische vollständige Prüfung aller Eingabekombinationen mit konkreten Abweichungen

## Schnellstart

```bash
npm install
npm run dev
```

Der Editor läuft unter `http://localhost:3000`.

```bash
npm test        # Engine-, Beispiel- und Lernmodus-Tests
npm run build   # TypeScript-Prüfung + Produktionsbuild
npm run preview # Build lokal ansehen
```

## Architektur

```
src/
├── engine/          Unabhängige Simulations- und Analyse-Engine
│   ├── parts.ts     Bauteildefinitionen, Pins, Breiten, Formatierung
│   ├── simulate.ts  Ereigniswarteschlange, Taktverhalten, Warnungen
│   └── analysis.ts  Wahrheitstabelle, Signalauswahl, Prüf-Helfer
├── circuit/         Beispielschaltungen und Circuit-Builder
├── components/      Editor, Palette, Eigenschaften, Analyse, Lernmodus
├── learning/        Aufgaben und automatische Funktionsprüfungen
├── storage/         JSON-Format, Validierung, LocalStorage, Download
├── store/           Zustand-Store für Schaltung, Simulation und Historie
└── editor/          Editor-Konstanten
```

Die Engine kennt weder React noch SVG. Eine Schaltung ist ein reines JSON-Objekt aus Bauteilen und Leitungen; die Simulation liefert Pin-Werte, Laufzeitzustand und Warnungen zurück. Dadurch lässt sie sich unabhängig testen und später auch für Server- oder CLI-Aufgaben verwenden.

### Simulationsmodell

1. **Ereignisbasiert:** Eine Änderung an einem Ausgang stellt nur die über Leitungen verbundenen Bauteile erneut in die Warteschlange.
2. **Fixpunkt mit Grenze:** Rückkopplungen werden bis zu einem stabilen Zustand berechnet. Schwingungen werden nach 80 Auswertungen pro Bauteil abgebrochen und als Fehler gemeldet.
3. **Synchroner Takt:** Bei einem Taktschritt werden zuerst alle kombinatorischen Werte stabilisiert. Danach berechnen alle sequentiellen Bauteile ihren nächsten Zustand aus denselben Werten und übernehmen ihn gemeinsam. Das verhindert Race Conditions in Shift-Registern.
4. **Busse:** Jeder Pin besitzt eine feste Breite. Verbindungen mit unterschiedlicher Breite werden abgelehnt. Splitter/Merger überführen zwischen 4-Bit-Bus und Einzelbits.
5. **Asynchrone Resets:** `R` am Flip-Flop und `CLR` am Register wirken sofort, unabhängig von der Taktflanke.

### Projektformat

```json
{
  "format": "logiksim",
  "version": 1,
  "name": "Halbaddierer",
  "parts": [
    { "id": "p1", "kind": "input", "x": 80, "y": 120, "label": "A", "bits": 1, "value": 1 }
  ],
  "wires": [
    {
      "id": "w1",
      "from": { "partId": "p1", "pin": "out" },
      "to": { "partId": "p2", "pin": "in1" }
    }
  ]
}
```

Beim Import werden unbekannte Bauteile abgelehnt und ungültige Leitungen übersprungen. Das Projekt wird automatisch unter `logiksim.project.v1` im LocalStorage gesichert.

## Bedienung

| Aktion | Bedienung |
| --- | --- |
| Bauteil platzieren | Aus der Bibliothek ziehen oder anklicken und in den Editor klicken |
| Bauteil verschieben | Ziehen |
| Leitung zeichnen | Ausgang und Eingang nacheinander anklicken (beide Richtungen möglich) |
| Eingang schalten | Schalter am Eingang anklicken oder Bittasten im Eigenschaftenpanel |
| Taktschritt | `T` oder »Takt« in der Toolbar |
| Ansicht einpassen | `F` oder Prozentanzeige unten rechts |
| Simulation starten/pausieren | Leertaste oder »Start« |
| Löschen | `Entf` |
| Rückgängig / Wiederholen | `Strg+Z` / `Strg+Shift+Z` |
| Speichern als JSON | `Strg+S` oder »Speichern« |
| Zoomen / Ansicht einpassen | Mausrad / Prozentanzeige unten rechts |

**Auf Touch-Geräten:** Die Leiste unter der Toolbar öffnet „Bauteile“ und „Eigenschaften“ als einblendbare Panels. Ein Bauteil wird am Griff `⠿` aus der Bibliothek direkt auf den Editor gezogen; ein einfacher Tipp auf das Bauteil aktiviert weiterhin die Platzierung per Fingertipp. Zwei Finger zoomen und verschieben die Ansicht gleichzeitig. Die Zoomleiste bleibt als Alternative verfügbar.

## Nächste Ausbaustufen

Der aktuelle Stand entspricht MVP 1 bis MVP 3: Editor, Simulation, Analyse, Lernmodus, Zähler mit Load und Modulo, Multiplexer, Demultiplexer und ALU. Noch nicht enthalten:

- Subcircuits und hierarchische Bausteine
- RAM, ROM und CPU-Modell
- Verzögerungsmodell und Timing-Analyse mit echten Gatterlaufzeiten
- Debugger mit Breakpoints
- Kollaboration oder Server-Speicherung

Die Engine ist so geschnitten, dass Subcircuits später als weitere `PartKind`-Implementierung ergänzt werden können, ohne den Editor umzubauen.
