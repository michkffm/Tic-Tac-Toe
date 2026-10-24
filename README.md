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

- **Hell/Dunkel**: berücksichtigt beim ersten Start die Systemeinstellung; die Auswahl bleibt im Browser gespeichert.
- **Deutsch/English**: übersetzt Oberfläche, Meldungen und zugängliche Feldbeschriftungen; die Auswahl bleibt gespeichert.
- **Speichern/Laden**: im Flask-Betrieb werden Spielfeld, Runde und Punkte auf dem Server gespeichert. Dies geschieht ausdrücklich per Knopfdruck, nicht automatisch. Nach dem Neuladen mit **Laden** fortsetzen.

Ohne Server gelten die Punkte nur für die aktuelle Sitzung. Die GitHub-Pages-Version bleibt ein statisches Spiel ohne Serverspeicherung. Die neuen Funktionen sind zunächst für den lokalen Betrieb vorbereitet; ein öffentliches Backend ist noch nicht eingerichtet. Es gibt keinen Computergegner oder Online-Multiplayer.

## Lokal starten

Voraussetzungen: **Node.js 24** und npm.

```bash
git clone https://github.com/michkffm/Tic-Tac-Toe.git
cd Tic-Tac-Toe/frontend
npm ci --ignore-scripts
npm start
```

Danach `http://localhost:4200/` öffnen. Das Spiel unterstützt Maus, Touch und Tastatur über Tab sowie Enter/Leertaste. Felder und Spielstatus besitzen zugängliche Beschriftungen; reduzierte Animationen werden berücksichtigt.

## Mit lokalem Backend und dauerhafter Speicherung starten

Voraussetzungen: Python 3.12 oder neuer, Node.js 24, npm. Frontend und API werden über dieselbe Adresse ausgeliefert; es ist keine zusätzliche JavaScript-Produktionsabhängigkeit nötig. SQLite gehört zur Python-Standardbibliothek.

Im Repository-Hauptordner:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
cd frontend
npm ci --ignore-scripts
npm run build -- --base-href /
cd ..
.venv/bin/python -m flask --app backend.app:create_app run --host 127.0.0.1 --port 8772
```

Danach **http://127.0.0.1:8772/** öffnen. Unter Windows entsprechend `.venv/Scripts/python` verwenden. `npm start` startet ausschließlich das Frontend; für die Serverspeicherung den gemeinsamen Flask-Start oben verwenden.

Der Zugang zum eigenen Spielstand liegt als zufälliger 256-Bit-Schlüssel in diesem Browser. Der Server speichert nur dessen Hash. Es gibt keine Konten und keine geräteübergreifende Wiederherstellung: Wer Browserdaten löscht oder einen anderen Browser bzw. eine andere Adresse verwendet, hat keinen Zugriff auf den bisherigen Spielstand. Den Schlüssel nicht weitergeben. Es werden keine Spielernamen erhoben.

Die SQLite-Datei `backend/instance/games.sqlite3` bleibt bei Neustarts erhalten und wird von Git ignoriert. **Spielstand zurücksetzen** setzt das aktuelle Spiel zurück; erst **Speichern** überschreibt den Serverstand. Ohne vorheriges Speichern gehen neue Züge beim Neuladen verloren. Für einen bereits existierenden Serverstand zuerst **Laden** wählen, bevor er erneut gespeichert wird. Revisionsnummern verhindern unbemerktes Überschreiben aus mehreren Tabs.

| Umgebungsvariable | Standard / Zweck |
| --- | --- |
| `GAME_DATABASE` | `backend/instance/games.sqlite3`; auf einen dauerhaft gespeicherten, beschreibbaren Pfad setzen |
| `GAME_FRONTEND` | `frontend/dist/frontend/browser`; Verzeichnis des gebauten Frontends |

`GET /config.json` aktiviert die Serverfunktionen im Flask-Betrieb. Die statische `frontend/public/config.json` deaktiviert sie für GitHub Pages. `GET /api/state` lädt, `PUT /api/state` speichert `{state, revision}`; beide benötigen `Authorization: Bearer <Browser-Schlüssel>`. Antworten: 400 ungültige Daten, 401 fehlender Zugang, 404 kein Spielstand, 409 veraltete Revision, 413 zu große Anfrage, 415 falscher Inhaltstyp, 429 Anfragelimit, 503 Speicher nicht verfügbar. API-Antworten sind nicht cachebar.

## Tests und Build

```bash
cd frontend
npm test -- --watch=false --browsers=ChromeHeadless
npm run build -- --base-href /Tic-Tac-Toe/
npm audit --omit=dev
```

Für die Tests muss Chrome installiert sein; gegebenenfalls dessen Pfad über `CHROME_BIN` angeben.

Die Frontend-Tests prüfen zusätzlich Sprache, Theme, Speicherung und Fehlerfälle sowie alle acht Gewinnlinien, O-Sieg, Remis, Sieg im neunten Zug, ungültige und doppelte Züge, Schutz nach Rundenende, Spielstand, Rundenwechsel und die Bedienung über die tatsächlichen Spielfeld-Buttons. Lokal mit Node 24 auf macOS geprüft.

Backend-Tests im Repository-Hauptordner:

```bash
.venv/bin/python -m unittest discover -s backend -v
```

Sie prüfen dauerhafte Speicherung nach App-Neustart, Zugriffstrennung, Revisionen, ungültige Eingaben, Größenlimit, Sicherheitsheader und Anfragelimits. Zusätzlich werden alle 5.478 erreichbaren Spielfelder für beide Startspieler geprüft.

## Veröffentlichung

GitHub Pages veröffentlicht den statischen Angular-Build. Der Workflow unter `.github/workflows/pages.yml` führt bei einem Push auf `main` Backend-Tests, Installation, Prüfung der Frontend-Produktionspakete, Frontend-Tests und Build aus und veröffentlicht nur das Browser-Artefakt. Unter **Settings → Pages → Source** ist **GitHub Actions** vorgesehen.

Für die statische Veröffentlichung werden keine geheimen Schlüssel benötigt. Ein öffentliches Backend benötigt einen separaten Hosting-Dienst mit dauerhaftem Datenträger, HTTPS und einem Produktions-WSGI-Server. Flask weist ausdrücklich darauf hin, den Entwicklungsserver nicht öffentlich zu betreiben: [Flask Deployment-Dokumentation](https://flask.palletsprojects.com/en/stable/deploying/). Hosting und neue Produktionspakete werden vor diesem Schritt gemeinsam ausgewählt.

Das lokale Anfragelimit beträgt 60 API-Anfragen je IP und Minute pro Prozess, maximal 10.000 gespeicherte Browser-Spielstände und 4 KiB je Anfrage. Vor öffentlichem Hosting sind Anfragelimits am Reverse Proxy, dessen IP-Vertrauen, Datenbank-Backups und ein Verfahren zur Bereinigung verwaister Spielstände einzurichten. SQLite benötigt einen persistenten Datenträger; ein flüchtiges Container-Dateisystem reicht nicht aus.

Die Spielstände stammen aus lokalen Partien und sind keine manipulationssichere Rangliste. Das Backend validiert Spielfeld, Zugverteilung, Gewinner und Wertebereiche; es bestätigt keine früheren Partien anhand einer serverseitigen Zugchronik.

 Die offiziellen Actions sind auf feste Commit-IDs gebunden; nur der Deployment-Job erhält die für Pages erforderlichen Schreibrechte.

## Projektstruktur

| Pfad | Inhalt |
| --- | --- |
| `frontend/src/app/app.ts` | Spielzustand, Zugprüfung, Gewinnerkennung und Punkte |
| `frontend/src/app/app.html` | Spielfeld, Spielstand und Bedienung |
| `frontend/src/app/app.css` | Responsives Layout und Gestaltung |
| `frontend/src/app/app.spec.ts` | Spiel- und Oberflächentests |
| `.github/workflows/pages.yml` | Tests und Veröffentlichung |
| `backend/app.py` | Flask-API, Zugriffsschutz, Validierung und SQLite-Speicherung |
| `backend/test_app.py` | API-, Persistenz- und Grenzfalltests |

## Sicherheit und Abhängigkeiten

Das Spiel verarbeitet keine Konten oder hochgeladenen Dateien. Server-Spielstände enthalten ausschließlich Spielfeld, Punkte und Runde. Unzulässige und nachträgliche Spielzüge werden auch in der Spiellogik abgewehrt. Es gibt keine eingebetteten Zugangsdaten.

Der aktualisierte Produktionspaketstand meldete beim Abgleich am 23. Oktober 2026 **keine bekannten Schwachstellen**. In der separaten Karma-Testwerkzeugkette bestehen noch sechs abhängige Audit-Hinweise zu einem `braces`-Problem; npm bietet dafür im bestehenden Setup keinen passenden stabilen Fix an. Diese Werkzeuge werden nicht in die statische Website eingebunden. Die bestehenden Flask-/Werkzeug-Anforderungen wurden innerhalb ihrer stabilen Versionsreihe aktualisiert; der Abgleich der sieben Backend-Pakete am 23. Oktober 2026 meldete keine bekannten Schwachstellen. Datenbankzugriffe sind parametrisiert, Eingaben werden validiert und fremde Browser-Origin-Zugriffe erhalten keine CORS-Freigabe.

`node_modules` und Build-Ergebnisse gehören nicht ins Repository. Abhängigkeiten werden aus `package-lock.json` mit `npm ci` reproduziert.

### Spielmodi

Die Auswahlkarten wechseln zwischen einem lokalen Duell zu zweit und einem Einzelspiel gegen den Computer. Im Einzelspiel übernimmt der Mensch X und der Computer O. Der Computer sucht mit Minimax den besten Zug und kann nicht besiegt werden. Der Rundenbeginn wechselt weiterhin; ein Moduswechsel setzt das Match zurück. Serverspielstände enthalten den Spielmodus; ältere Spielstände werden als Zweispielermodus geladen.
