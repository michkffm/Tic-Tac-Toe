import { Component, ElementRef, QueryList, ViewChild, ViewChildren } from '@angular/core';

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
export class App {
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
    if (this.result === 'draw') return 'Unentschieden. Gut gespielt!';
    if (this.result) return `${this.result} gewinnt diese Runde!`;
    return `${this.currentPlayer} ist am Zug`;
  }

  get moveCount(): number {
    return this.board.filter((cell) => cell !== null).length;
  }

  play(index: number): void {
    if (!Number.isInteger(index) || index < 0 || index > 8 || this.board[index] !== null || this.result !== null) return;
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
    this.round += 1;
    this.startingPlayer = this.startingPlayer === 'X' ? 'O' : 'X';
    this.clearBoard();
  }

  resetMatch(): void {
    this.scores = { X: 0, O: 0, draw: 0 };
    this.round = 1;
    this.startingPlayer = 'X';
    this.clearBoard();
  }

  cellLabel(index: number): string {
    return `Zeile ${Math.floor(index / 3) + 1}, Spalte ${index % 3 + 1}: ${this.board[index] ?? 'frei'}`;
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
