# Spielzeit · Frontend

Die vollständige Anleitung steht im Projekt-README: [Deutsch](../README.md) | [English](../README.en.md).

```bash
npm ci --ignore-scripts
npm start
```

Entwicklung unter `http://localhost:4200/`.

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build -- --base-href /Tic-Tac-Toe/
```

Der GitHub-Pages-Build liegt anschließend unter `dist/frontend/browser/`. Ohne Backend besteht der Spielstand nur in der aktuellen Sitzung. Hell/Dunkel und Deutsch/Englisch werden im Browser gespeichert. Für dauerhaft auf dem Server gespeicherte Partien den gemeinsamen Flask-Start aus dem Projekt-README verwenden; dafür mit `--base-href /` bauen.
