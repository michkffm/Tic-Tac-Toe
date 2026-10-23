# Spielzeit · Frontend

Die vollständige Anleitung steht im [Projekt-README](../README.md).

```bash
npm ci --ignore-scripts
npm start
```

Entwicklung unter `http://localhost:4200/`.

```bash
npm test -- --watch=false --browsers=ChromeHeadless
npm run build -- --base-href /Tic-Tac-Toe/
```

Der GitHub-Pages-Build liegt anschließend unter `dist/frontend/browser/`. Spielzustand und Spielstand bestehen ausschließlich im Arbeitsspeicher des Browsers. Das Backend wird nicht benötigt.
