# Spielzeit · Tic-Tac-Toe

Drei in einer Reihe – alleine, zu zweit an einem Gerät oder online auf zwei verschiedenen Rechnern.

[**Jetzt im Browser spielen ↗**](https://michkffm.github.io/Tic-Tac-Toe/)

![Online-Spiel auf GitHub Pages mit Render-Backend](docs/online-multiplayer.jpg)

## Spielmodi

- **Alleine:** Du spielst X gegen den Computer O. Leicht wählt zufällig; Mittel nutzt sofortige Gewinnchancen und blockiert direkte Gefahren; Schwer plant mit Minimax und ist nicht besiegbar.
- **Zu zweit:** Abwechselnd an einem Gerät spielen. Optional eigene Namen mit maximal 24 Zeichen eingeben.
- **Online mit Freunden:** Auf zwei Geräten mit einem privaten Einladungslink spielen. Ohne Konto oder Installation.

Hell-/Dunkelmodus und Deutsch/English bleiben im Browser gespeichert. Punkte, Runden, ein optionales Match bis drei Siege, Gewinnreihen und die Markierung des letzten Zugs sind integriert. Der Startspieler wechselt je Runde. Bei einem lokalen Moduswechsel oder einer Änderung von Schwierigkeit/Matchart startet ein neues Match.

## Online spielen

1. Auf der Spielseite **Online mit Freunden** auswählen.
2. Optional einen Namen und „Freies Spiel“ oder „Bis drei Siege“ wählen.
3. **Privaten Raum erstellen** anklicken. Du erhältst X.
4. Den angezeigten Link kopieren und privat an den Mitspieler senden.
5. Der Mitspieler öffnet ihn auf seinem Rechner, gibt optional einen Namen ein und wählt **Raum beitreten**. Er erhält O.
6. Der Server prüft die Züge und überträgt den Spielstand. Nach Rundenende kann einer von euch **Nächste Runde** wählen; nach drei Siegen beginnt **Neues Match** wieder bei null.

Der Link enthält nur die zufällige Raumnummer. Wer zuerst beitritt, erhält den zweiten Platz: deshalb nicht öffentlich posten. Ein dritter Spieler kann nicht beitreten. Spielerzugänge werden separat als zufällige Schlüssel in `sessionStorage` des jeweiligen Tabs gespeichert und nicht im Einladungslink übertragen. Neuladen im selben Tab stellt den Platz wieder her; nach Schließen des Tabs ist eine Wiederherstellung nicht garantiert. Ein belegter Platz wird nicht an andere Besucher freigegeben. Falls ein Spieler den Zugang verliert, erstellt einen neuen Raum.

Der Spielstand wird alle vier Sekunden abgefragt. Deshalb kann ein fremder Zug bis zu einigen Sekunden benötigen. „Mitspieler verbunden“ bedeutet Kontakt innerhalb der letzten 20 Sekunden. Bei Netzproblemen erscheint eine Meldung; bestehende Sitzungen versuchen erneut zu verbinden. Nur der Spieler am Zug kann freie Felder belegen. Punkte und Runden werden ausschließlich auf dem Server berechnet.

### Kostenloser Betrieb und Grenzen

Die Oberfläche liegt auf **GitHub Pages**, das Online-Backend auf **Render Free** in Frankfurt:

- API: `https://spielzeit-michkffm-online.onrender.com`
- Gesundheitsprüfung: `/health`
- Räume werden ausschließlich im Arbeitsspeicher gehalten: maximal 100 gleichzeitig und höchstens zwei Stunden ab Erstellung.
- Neustart, Redeploy oder Ruhezustand des Servers löscht die Räume. Es gibt keine dauerhafte Online-Rangliste oder Speicherung dieser Partien.
- Render Free schläft nach 15 Minuten ohne eingehende Aktivität ein. Beim nächsten Aufruf kann der Start ungefähr eine Minute dauern. Die Oberfläche wartet beim Verbindungsaufbau entsprechend länger.
- Die kostenlosen Laufzeit-, Bandbreiten- und Buildkontingente gelten für den gesamten Render-Workspace. Die Anwendung ist für gelegentliche private Partien gedacht, ohne Verfügbarkeitsgarantie.
- Online-Namen und Spielstände werden nur für die Raumdauer gehalten. Render verarbeitet Verbindungsmetadaten nach seinen Bedingungen. Namen sind innerhalb des Raums für beide Spieler sichtbar.

[Render: kostenlose Dienste und Grenzen](https://render.com/docs/free)

## Lokal entwickeln

Voraussetzungen: Node.js 24, npm und Python 3.13 oder neuer. Es werden Angular 20 und Flask verwendet; die installierten Paketversionen stehen in den Lock-/Requirements-Dateien.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/render-requirements.txt
npm --prefix frontend ci --ignore-scripts
npm --prefix frontend run build
```

Für einen lokalen Online-Test in `frontend/dist/frontend/browser/config.json` ausschließlich im gebauten Ergebnis eintragen:

```json
{"serverStorage": false, "onlineApi": "http://127.0.0.1:8812"}
```

In einem Terminal das Backend starten:

```sh
GAME_ALLOWED_ORIGIN=http://127.0.0.1:8811 GAME_DISABLE_SAVES=1 \
.venv/bin/gunicorn --workers 1 --threads 8 --bind 127.0.0.1:8812 'backend.app:create_app()'
```

In einem zweiten Terminal die Oberfläche starten:

```sh
python3 -m http.server 8811 --bind 127.0.0.1 --directory frontend/dist/frontend/browser
```

`http://127.0.0.1:8811/` in zwei unabhängigen Tabs/Browsern öffnen. Diese Adressen sind nur lokal erreichbar. Der nächste Build ersetzt die temporäre lokale Konfiguration wieder durch `frontend/public/config.json`.

Für die reine Frontendentwicklung: `npm --prefix frontend start`. Bei einer anderen Vorschauadresse muss `GAME_ALLOWED_ORIGIN` exakt angepasst werden.

## Lokale Serverspielstände

Die bisherige manuelle SQLite-Speicherung für lokale Einzel-/Zweispielerpartien bleibt verfügbar. Online-Partien verwenden sie nicht. Das öffentliche Render-Backend deaktiviert diese Funktion ausdrücklich, da Render Free keinen persistenten Datenträger bereitstellt.

Für lokalen Betrieb mit SQLite:

```sh
npm --prefix frontend run build
.venv/bin/python -m flask --app backend.app:create_app run --host 127.0.0.1 --port 8772
```

Unter `http://127.0.0.1:8772/` erlauben **Speichern/Laden** die manuelle Sicherung. Ohne vorheriges Speichern gehen neue lokale Züge beim Neuladen verloren. Der Browser hält einen zufälligen 256-Bit-Schlüssel; SQLite speichert dessen Hash. Löschen der Browserdaten entfernt den Zugang. Revisionsnummern verhindern unbemerktes Überschreiben durch andere Tabs. Die Datei `backend/instance/games.sqlite3` wird von Git ignoriert. Ältere Spielstände bleiben kompatibel. Der Flask-Entwicklungsserver ist nur für lokale Entwicklung vorgesehen.

| Variable | Zweck |
| --- | --- |
| `GAME_ALLOWED_ORIGIN` | Exakte zulässige Browser-Origin für Online-Räume; öffentlich `https://michkffm.github.io` |
| `GAME_DISABLE_SAVES` | `1` deaktiviert die SQLite-Speicher-API und deren UI-Konfiguration |
| `GAME_DATABASE` | Lokaler SQLite-Pfad, Standard `backend/instance/games.sqlite3` |
| `GAME_FRONTEND` | Pfad zum Frontend-Build, Standard `frontend/dist/frontend/browser` |
| `PORT` | Von Render vorgegebener Port für Gunicorn |

## Veröffentlichung

`.github/workflows/pages.yml` prüft Backend und Frontend, führt den Produktions-Audit aus und veröffentlicht die statische Oberfläche bei Push auf `main`. `frontend/public/config.json` benennt die öffentliche Online-API. Keine geheimen Schlüssel werden in der Oberfläche gespeichert.

`render.yaml` dokumentiert den kostenlosen Python-Webdienst; `.python-version` verwendet die aktuelle Patchversion von Python 3.13. **Gunicorn ist die einzige neue Produktionsabhängigkeit** und dient als produktiver WSGI-Server. Es muss genau **ein Worker-Prozess mit mehreren Threads** laufen, da die Räume im Prozessspeicher liegen. Mehrere Worker oder Instanzen benötigen eine gemeinsame Datenhaltung und sind nicht Teil dieser Version.

Bei manueller Einrichtung auf Render: öffentliches Repository `michkffm/Tic-Tac-Toe`, Branch `main`, Repository-Wurzel, Python, Region Frankfurt, Tarif **Free**. Build: `pip install -r backend/render-requirements.txt`. Start: `gunicorn --workers 1 --threads 8 --bind 0.0.0.0:$PORT 'backend.app:create_app()'`. Health Check: `/health`. Umgebungsvariablen siehe `render.yaml`.

Bei Anbindung über „Public Git Repository“ wird nicht automatisch jeder Push deployed; nach Backend-Änderungen auf Render **Manual Deploy → Deploy latest commit** verwenden. Alternativ kann die Blueprint-Konfiguration angebunden werden. Redeploys beenden bestehende Online-Räume.

## Tests und Sicherheit

Am 28.10.2026 veröffentlicht und live mit zwei unabhängigen Browsersitzungen geprüft: Einladen, Beitreten, wechselseitige Züge, Gewinnerkennung, Punkte, Neuladen mit gleichem Spielerplatz und gemeinsamer Rundenwechsel. 40 Frontend-Tests, 16 Backend-Tests sowie der Produktionsbuild waren erfolgreich; der npm-Produktionsaudit meldete keine bekannten Schwachstellen. Der Screenshot oben stammt von der veröffentlichten Spielseite.

```sh
.venv/bin/python -m unittest discover -s backend -v
CHROME_BIN='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' \
  npm --prefix frontend test -- --watch=false --browsers=ChromeHeadless
npm --prefix frontend run build -- --base-href /Tic-Tac-Toe/
npm --prefix frontend audit --omit=dev
git diff --check
```

Unter anderen Betriebssystemen Chrome-Pfad anpassen oder `CHROME_BIN` weglassen, wenn Chrome automatisch gefunden wird.

Die Tests prüfen die bisherigen lokalen Spielmodi, alle Gewinnlinien und erreichbaren Spielfelder sowie Online-Zugrechte, Drittspieler-Ausschluss, parallele Beitritte, Revisionen, Unentschieden, Rundenwechsel, Matchgewinn, Ablauf, Präsenz, CORS, private Schlüssel, Wiederherstellung und Fehlerfälle. Der Browser-Abgleich wird mit zwei getrennten Spielsitzungen durchgeführt; dies ersetzt keinen Lasttest und keine Verfügbarkeitsgarantie.

Alle Spielbefehle werden serverseitig validiert und unter einer Sperre verarbeitet. Spieler-Schlüssel werden ausschließlich in Authorization-Headern übertragen und serverseitig gehasht gehalten. Kein Schlüssel erscheint in URLs oder API-Antworten. Der Raumschlüssel im Einladungslink vermittelt nur den noch freien zweiten Platz. API-Antworten sind nicht cachebar. CORS gibt nur die konfigurierte Origin frei. Anfragen sind auf 4 KiB begrenzt; maximal 240 Online- bzw. 60 Speicher-API-Anfragen je Verbindung-IP und Minute im Prozess. Forwarded-IP-Header werden bewusst nicht vertraut; hinter einem Proxy können mehrere Besucher dieselbe Begrenzung teilen. Diese Hobby-Konfiguration ersetzt keinen Schutz für einen großen öffentlichen Spieledienst.

## Struktur

- `frontend/src/app/app.*`: lokale Modi, Computergegner, Namen, Punkte, Sprache und Theme.
- `frontend/src/app/online-game.*`, `online.css`: Online-UI, Raumverbindung und Wiederverbindung.
- `backend/app.py`: Flask, Schutzmaßnahmen, lokale SQLite-Speicherstände.
- `backend/online.py`: flüchtige Online-Räume und serverseitige Spielregeln.
- `backend/test_*.py`, `frontend/src/app/*.spec.ts`: automatisierte Prüfungen.
- `render.yaml`, `.python-version`, `backend/render-requirements.txt`: Produktionsbetrieb.
- `docs/online-multiplayer.jpg`: Screenshot der realen Online-Oberfläche mit Testnamen Alex und Sam.
