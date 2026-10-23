import { DOCUMENT } from '@angular/common';
import { Component, ElementRef, QueryList, ViewChild, ViewChildren, OnInit, inject } from '@angular/core';

type Player = 'X' | 'O';
type Result = Player | 'draw' | null;

const WINNING_LINES: readonly (readonly number[])[] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly document = inject(DOCUMENT);
  language: 'de' | 'en' = 'de';
  darkMode = false;
  serverStorage = false;
  busy = false;
  revision = 0;
  storageMessage: 'saved' | 'loaded' | 'error' | 'missing' | 'conflict' | null = null;

  constructor() {
    try {
      this.language = localStorage.getItem('spielzeit-language') === 'en' ? 'en' : 'de';
      const theme = localStorage.getItem('spielzeit-theme');
      this.darkMode = theme ? theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    } catch { /* The game also works when browser storage is blocked. */ }
    this.applyPreferences();
  }

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch('config.json', { signal: AbortSignal.timeout(10000) });
      const config: unknown = response.ok ? await response.json() : null;
      this.serverStorage = typeof config === 'object' && config !== null && 'serverStorage' in config && config.serverStorage === true;
    } catch { this.serverStorage = false; }
  }

  t(de: string, en: string): string { return this.language === 'de' ? de : en; }

  toggleLanguage(): void {
    this.language = this.language === 'de' ? 'en' : 'de';
    this.applyPreferences();
  }

  toggleTheme(): void {
    this.darkMode = !this.darkMode;
    this.applyPreferences();
  }

  private applyPreferences(): void {
    this.document.documentElement.lang = this.language;
    this.document.documentElement.dataset['theme'] = this.darkMode ? 'dark' : 'light';
    this.document.title = this.t('Spielzeit · Tic-Tac-Toe für zwei', 'Spielzeit · Tic-Tac-Toe for two');
    try {
      localStorage.setItem('spielzeit-language', this.language);
      localStorage.setItem('spielzeit-theme', this.darkMode ? 'dark' : 'light');
    } catch { /* Preferences remain usable for this session. */ }
  }

  get storageStatus(): string {
    switch (this.storageMessage) {
      case 'saved': return this.t('Spielstand auf dem Server gespeichert.', 'Game saved on the server.');
      case 'loaded': return this.t('Gespeicherten Spielstand geladen.', 'Saved game loaded.');
      case 'missing': return this.t('Für diesen Browser gibt es noch keinen gespeicherten Spielstand.', 'There is no saved game for this browser yet.');
      case 'conflict': return this.t('Ein anderer Tab hat gespeichert. Bitte zuerst den Server-Spielstand laden.', 'Another tab saved a game. Load the server save first.');
      case 'error': return this.t('Speichern oder Laden fehlgeschlagen. Dein aktuelles Spiel bleibt erhalten.', 'Saving or loading failed. Your current game is unchanged.');
      default: return '';
    }
  }

  async transferState(action: 'save' | 'load'): Promise<void> {
    if (!this.serverStorage || this.busy) return;
    this.busy = true;
    this.storageMessage = null;
    try {
      let token = localStorage.getItem('spielzeit-save-key');
      if (!token || !/^[0-9a-f]{64}$/.test(token)) {
        token = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
        localStorage.setItem('spielzeit-save-key', token);
      }
      const response = await fetch('api/state', {
        method: action === 'save' ? 'PUT' : 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: action === 'save' ? JSON.stringify({ state: { board: this.board, startingPlayer: this.startingPlayer, round: this.round, scores: this.scores }, revision: this.revision }) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        this.storageMessage = response.status === 404 ? 'missing' : response.status === 409 ? 'conflict' : 'error';
        return;
      }
      const body: unknown = await response.json();
      if (!isRecord(body) || !Number.isSafeInteger(body['revision']) || Number(body['revision']) < 1) throw new Error('Invalid response');
      if (action === 'load') {
        const state = body['state'];
        if (!isSavedGame(state)) throw new Error('Invalid saved game');
        this.board = [...state.board];
        this.startingPlayer = state.startingPlayer;
        this.round = state.round;
        this.scores = { ...state.scores };
        this.winningLine = WINNING_LINES.find(line => this.board[line[0]] !== null && line.every(index => this.board[index] === this.board[line[0]])) ?? [];
        this.result = this.winningLine.length ? this.board[this.winningLine[0]] : this.moveCount === 9 ? 'draw' : null;
        const other = this.startingPlayer === 'X' ? 'O' : 'X';
        this.currentPlayer = this.result === 'X' || this.result === 'O' ? this.result : this.moveCount % 2 === 0 ? this.startingPlayer : other;
      }
      this.revision = Number(body['revision']);
      this.storageMessage = action === 'save' ? 'saved' : 'loaded';
    } catch { this.storageMessage = 'error'; }
    finally { this.busy = false; }
  }

  board: (Player | null)[] = Array.from({ length: 9 }, () => null);
  currentPlayer: Player = 'X';
  startingPlayer: Player = 'X';
  result: Result = null;
  winningLine: readonly number[] = [];
  round = 1;
  scores = { X: 0, O: 0, draw: 0 };

  @ViewChildren('cell') private cells?: QueryList<ElementRef<HTMLButtonElement>>;
  @ViewChild('nextRound') private nextRoundButton?: ElementRef<HTMLButtonElement>;

  get status(): string {
    if (this.result === 'draw') return this.t('Unentschieden. Gut gespielt!', 'A draw. Well played!');
    if (this.result) return this.t(`${this.result} gewinnt diese Runde!`, `${this.result} wins this round!`);
    return this.t(`${this.currentPlayer} ist am Zug`, `${this.currentPlayer} to move`);
  }

  get moveCount(): number {
    return this.board.filter((cell) => cell !== null).length;
  }

  play(index: number): void {
    if (this.busy || !Number.isInteger(index) || index < 0 || index > 8 || this.board[index] !== null || this.result !== null) return;
    this.storageMessage = null;
    const player = this.currentPlayer;
    this.board = this.board.map((cell, position) => position === index ? player : cell);
    const line = WINNING_LINES.find((positions) => positions.every((position) => this.board[position] === player));
    if (line) {
      this.result = player;
      this.winningLine = line;
      this.scores = { ...this.scores, [player]: this.scores[player] + 1 };
    } else if (this.moveCount === 9) {
      this.result = 'draw';
      this.scores = { ...this.scores, draw: this.scores.draw + 1 };
    } else {
      this.currentPlayer = player === 'X' ? 'O' : 'X';
    }
    if (this.result !== null) this.nextRoundButton?.nativeElement.focus();
  }

  newRound(): void {
    if (this.busy) return;
    this.storageMessage = null;
    this.round += 1;
    this.startingPlayer = this.startingPlayer === 'X' ? 'O' : 'X';
    this.clearBoard();
  }

  resetMatch(): void {
    if (this.busy) return;
    this.storageMessage = null;
    this.scores = { X: 0, O: 0, draw: 0 };
    this.round = 1;
    this.startingPlayer = 'X';
    this.clearBoard();
  }

  cellLabel(index: number): string {
    return this.t(`Zeile ${Math.floor(index / 3) + 1}, Spalte ${index % 3 + 1}: ${this.board[index] ?? 'frei'}`, `Row ${Math.floor(index / 3) + 1}, column ${index % 3 + 1}: ${this.board[index] ?? 'empty'}`);
  }

  private clearBoard(): void {
    this.board = Array.from({ length: 9 }, () => null);
    this.currentPlayer = this.startingPlayer;
    this.result = null;
    this.winningLine = [];
    // Occupied cells are disabled; wait until Angular has enabled the new board.
    setTimeout(() => this.cells?.first?.nativeElement.focus());
  }
}

interface SavedGame {
  board: (Player | null)[];
  startingPlayer: Player;
  round: number;
  scores: { X: number; O: number; draw: number };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSavedGame(value: unknown): value is SavedGame {
  if (!isRecord(value) || !Array.isArray(value['board']) || value['board'].length !== 9 ||
      !value['board'].every(cell => cell === null || cell === 'X' || cell === 'O') ||
      !Number.isSafeInteger(value['round']) || Number(value['round']) < 1 || Number(value['round']) > 1000000 ||
      value['startingPlayer'] !== (Number(value['round']) % 2 ? 'X' : 'O') || !isRecord(value['scores'])) return false;
  const scores = value['scores'];
  return ['X', 'O', 'draw'].every(key => Number.isSafeInteger(scores[key]) && Number(scores[key]) >= 0 && Number(scores[key]) <= Number(value['round']));
}
