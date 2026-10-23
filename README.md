# Spielzeit · Tic-Tac-Toe

**Ein Gerät. Zwei Köpfe. Drei in einer Reihe.**

Ein vollständiges Tic-Tac-Toe für zwei Personen an einem Gerät – mit ruhigen Farben, einer responsiven Oberfläche und direktem Einstieg ohne Login.

## Spielen

**[Spiel im Browser öffnen ↗](https://michkffm.github.io/Tic-Tac-Toe/)**

- Abwechselnd freie Felder wählen: X beginnt die erste Runde.
- Drei gleiche Zeichen waagerecht, senkrecht oder diagonal gewinnen.
- Gewinnerkennung, Hervorhebung der Gewinnreihe und Unentschieden sind integriert.
- **Nächste Runde** behält den Spielstand und wechselt die beginnende Person.
- **Neue Runde** kann auch eine laufende Runde ohne Punkte beenden.
- **Spielstand zurücksetzen** startet bei Runde 1 und null Punkten.

Die Punkte gelten für die aktuelle Sitzung und werden beim Neuladen zurückgesetzt. Es gibt keinen Computergegner, Online-Multiplayer oder Server. Alle Spielzüge bleiben im Browser; externe GitHub-Links öffnen sich nur beim Anklicken.

## Lokal starten

Voraussetzungen: **Node.js 24** und npm.

```bash
git clone https://github.com/michkffm/Tic-Tac-Toe.git
cd Tic-Tac-Toe/frontend
npm ci --ignore-scripts
npm start
```

Danach `http://localhost:4200/` öffnen. Das Spiel unterstützt Maus, Touch und Tastatur über Tab sowie Enter/Leertaste. Felder und Spielstatus besitzen zugängliche Beschriftungen; reduzierte Animationen werden berücksichtigt.

## Tests und Build

```bash
cd frontend
npm test -- --watch=false --browsers=ChromeHeadless
npm run build -- --base-href /Tic-Tac-Toe/
npm audit --omit=dev
```

Für die Tests muss Chrome installiert sein; gegebenenfalls dessen Pfad über `CHROME_BIN` angeben.

Die 17 Tests prüfen unter anderem alle acht Gewinnlinien, O-Sieg, Remis, Sieg im neunten Zug, ungültige und doppelte Züge, Schutz nach Rundenende, Spielstand, Rundenwechsel und die Bedienung über die tatsächlichen Spielfeld-Buttons. Lokal mit Node 24 auf macOS geprüft.

## Veröffentlichung

GitHub Pages veröffentlicht den statischen Angular-Build. Der Workflow unter `.github/workflows/pages.yml` führt bei einem Push auf `main` Installation, Prüfung der Produktionspakete, Tests und Build aus und veröffentlicht nur das Browser-Artefakt. Unter **Settings → Pages → Source** ist **GitHub Actions** vorgesehen.

Es werden keine geheimen Schlüssel benötigt. Die offiziellen Actions sind auf feste Commit-IDs gebunden; nur der Deployment-Job erhält die für Pages erforderlichen Schreibrechte.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/app/app.ts` | Spielzustand, Zugprüfung, Gewinnerkennung und Punkte |
| `frontend/src/app/app.html` | Spielfeld, Spielstand und Bedienung |
| `frontend/src/app/app.css` | Responsives Layout und Gestaltung |
| `frontend/src/app/app.spec.ts` | Spiel- und Oberflächentests |
| `.github/workflows/pages.yml` | Tests und Veröffentlichung |
| `backend/` | Frühes, leeres Python-Gerüst; wird vom Spiel nicht verwendet oder veröffentlicht |

## Sicherheit und Abhängigkeiten

Das Spiel verarbeitet keine Texteingaben, Konten oder hochgeladenen Dateien. Unzulässige und nachträgliche Spielzüge werden auch in der Spiellogik abgewehrt. Es gibt keine eingebetteten Zugangsdaten.

Der aktualisierte Produktionspaketstand meldete beim Abgleich am 23. Oktober 2026 **keine bekannten Schwachstellen**. In der separaten Karma-Testwerkzeugkette bestehen noch sechs abhängige Audit-Hinweise zu einem `braces`-Problem; npm bietet dafür im bestehenden Setup keinen passenden stabilen Fix an. Diese Werkzeuge werden nicht in die statische Website eingebunden. Die ungenutzten Python-Anforderungen im Backend sind ein historischer Stand und werden nicht installiert oder deployt.

`node_modules` und Build-Ergebnisse gehören nicht ins Repository. Abhängigkeiten werden aus `package-lock.json` mit `npm ci` reproduziert.
