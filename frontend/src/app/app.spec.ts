import { TestBed } from '@angular/core/testing';
import { App, bestComputerMove, computerMove } from './app';

const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

describe('Tic-Tac-Toe', () => {
  let app: App;
  beforeEach(async () => {
    localStorage.removeItem('spielzeit-language');
    localStorage.removeItem('spielzeit-theme');
    document.documentElement.dataset['theme'] = 'light';
    spyOn(window, 'matchMedia').and.returnValue({ matches: false } as MediaQueryList);
    spyOn(window, 'fetch').and.resolveTo(new Response(JSON.stringify({ serverStorage: false }), { status: 200 }));
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
    app = TestBed.createComponent(App).componentInstance;
  });

  it('switches all visible game text and accessible labels to English', () => {
    app.toggleLanguage();
    expect(document.documentElement.lang).toBe('en');
    expect(app.status).toBe('X to move');
    expect(app.cellLabel(0)).toBe('Row 1, column 1: empty');
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.language = 'en';
    fixture.detectChanges();
    const text: string = fixture.nativeElement.textContent;
    expect(text).toContain('Your move.');
    expect(text).toContain('New round');
    expect(text).not.toContain('Dein Zug');
  });

  it('persists theme and language preferences', () => {
    app.toggleTheme();
    app.toggleLanguage();
    expect(document.documentElement.dataset['theme']).toBe('dark');
    const restored = TestBed.createComponent(App).componentInstance;
    expect(restored.darkMode).toBeTrue();
    expect(restored.language).toBe('en');
  });

  it('saves a snapshot with a private bearer key and reloads it', async () => {
    app.serverStorage = true;
    app.play(4);
    const saved = { mode: 'local', settings: { names: { X: '', O: '' }, difficulty: 'hard', targetWins: 0, lastMove: 4 }, board: [...app.board], startingPlayer: 'X', round: 1, scores: { X: 0, O: 0, draw: 0 } };
    const fetchSpy = window.fetch as jasmine.Spy;
    fetchSpy.and.resolveTo(new Response(JSON.stringify({ revision: 1 }), { status: 200 }));
    await app.transferState('save');
    expect(app.storageMessage).toBe('saved');
    const options: RequestInit = fetchSpy.calls.mostRecent().args[1];
    expect(JSON.parse(String(options.body)).state).toEqual(saved);
    expect(localStorage.getItem('spielzeit-save-key')).toMatch(/^[0-9a-f]{64}$/);
    app.resetMatch();
    fetchSpy.and.resolveTo(new Response(JSON.stringify({ state: saved, revision: 1 }), { status: 200 }));
    await app.transferState('load');
    expect(app.board[4]).toBe('X');
    expect(app.currentPlayer).toBe('O');
    expect(app.storageMessage).toBe('loaded');
  });

  it('keeps the current game on server conflict, missing save, invalid response or network error', async () => {
    app.serverStorage = true;
    app.play(0);
    const fetchSpy = window.fetch as jasmine.Spy;
    for (const code of [409, 404, 503]) {
      fetchSpy.and.resolveTo(new Response('{}', { status: code }));
      await app.transferState('load');
      expect(app.board[0]).toBe('X');
      expect(app.busy).toBeFalse();
      expect(app.storageMessage).toBe(code === 409 ? 'conflict' : code === 404 ? 'missing' : 'error');
    }
    fetchSpy.and.resolveTo(new Response(JSON.stringify({ revision: 1, state: {} }), { status: 200 }));
    await app.transferState('load');
    expect(app.storageMessage).toBe('error');
    expect(app.board[0]).toBe('X');
    fetchSpy.and.rejectWith(new TypeError('Network unavailable'));
    await app.transferState('save');
    expect(app.storageMessage).toBe('error');
    expect(app.board[0]).toBe('X');
  });

  it('blocks game changes while transferring a save', () => {
    app.busy = true;
    app.play(0);
    app.newRound();
    app.resetMatch();
    expect(app.moveCount).toBe(0);
    expect(app.round).toBe(1);
  });

  it('plays solo, opens the next round as O and resets when switching modes', () => {
    app.setMode('single');
    app.play(0);
    expect(app.moveCount).toBe(2);
    expect(app.currentPlayer).toBe('X');
    app.newRound();
    expect(app.moveCount).toBe(1);
    expect(app.board.includes('O')).toBeTrue();
    app.setMode('local');
    expect(app.moveCount).toBe(0);
    expect(app.round).toBe(1);
  });

  it('renders mode selection and plays a computer reply through the UI', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const solo = root.querySelector<HTMLButtonElement>('.mode-card')!;
    solo.click();
    fixture.detectChanges();
    expect(solo.getAttribute('aria-pressed')).toBe('true');
    root.querySelector<HTMLButtonElement>('.cell')!.click();
    fixture.detectChanges();
    expect(root.querySelectorAll('.cell-x').length).toBe(1);
    expect(root.querySelectorAll('.cell-o').length).toBe(1);
    expect(root.textContent).toContain('Computer · O');
  });

  it('loads solo games and completes a pending computer turn', async () => {
    app.serverStorage = true;
    const state = { mode: 'single', board: ['X', null, null, null, null, null, null, null, null], startingPlayer: 'X', round: 1, scores: { X: 0, O: 0, draw: 0 } };
    (window.fetch as jasmine.Spy).and.resolveTo(new Response(JSON.stringify({ state, revision: 1 }), { status: 200 }));
    await app.transferState('load');
    expect(app.mode).toBe('single');
    expect(app.moveCount).toBe(2);
    expect(app.currentPlayer).toBe('X');
  });

  it('uses safe player names and keeps them after a reset', () => {
    app.updateName('X', '  Alex  ');
    expect(app.playerName('X')).toBe('Alex');
    expect(app.status).toBe('Alex ist am Zug');
    app.updateName('O', 'a'.repeat(40));
    expect(app.names.O.length).toBe(24);
    app.resetMatch();
    expect(app.playerName('X')).toBe('Alex');
    app.setMode('single');
    expect(app.playerName('X')).toBe('Du');
    expect(app.playerName('O')).toBe('Computer');
  });

  it('completes a first-to-three match and starts a fresh match', () => {
    app.setTarget('3');
    app.scores = { X: 2, O: 0, draw: 0 };
    [0, 3, 1, 4, 2].forEach(index => app.play(index));
    expect(app.matchWinner).toBe('X');
    expect(app.lastMove).toBe(2);
    expect(app.status).toContain('gewinnt das Match');
    app.newRound();
    expect(app.matchWinner).toBeNull();
    expect(app.scores.X).toBe(0);
    expect(app.lastMove).toBeNull();
    expect(app.round).toBe(1);
  });

  it('resets the match when changing difficulty but ignores invalid settings', () => {
    app.play(0);
    app.setDifficulty('easy');
    expect(app.moveCount).toBe(0);
    expect(app.difficulty).toBe('easy');
    app.setDifficulty('invalid');
    app.setTarget('99');
    expect(app.difficulty).toBe('easy');
    expect(app.targetWins).toBe(0);
  });

  it('renders names as plain text and exposes translated settings', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.updateName('X', '<b>Alex</b>');
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    expect(root.querySelector('.player-name')?.textContent).toContain('<b>Alex</b>');
    expect(root.querySelector('.player-name b')).toBeNull();
    expect(root.querySelectorAll('input[maxlength="24"]').length).toBe(2);
    fixture.componentInstance.setMode('single');
    fixture.componentInstance.toggleLanguage();
    fixture.detectChanges();
    expect(root.querySelector('#difficulty')?.textContent).toContain('Easy');
  });

  it('starts with nine empty fields and X', () => {
    expect(app.board).toEqual(Array(9).fill(null));
    expect(app.currentPlayer).toBe('X');
    expect(app.moveCount).toBe(0);
  });

  it('alternates players and protects occupied fields', () => {
    app.play(0);
    app.play(0);
    expect(app.currentPlayer).toBe('O');
    expect(app.moveCount).toBe(1);
    app.play(4);
    expect(app.board[4]).toBe('O');
    expect(app.currentPlayer).toBe('X');
  });

  it('rejects invalid indices', () => {
    [-1, 9, 0.5, NaN, Infinity].forEach((index) => app.play(index));
    expect(app.moveCount).toBe(0);
  });

  LINES.forEach((line, index) => {
    it(`recognizes winning line ${index + 1} for X`, () => {
      app.board = Array(9).fill(null);
      app.board[line[0]] = 'X';
      app.board[line[1]] = 'X';
      app.play(line[2]);
      expect(app.result).toBe('X');
      expect(app.winningLine).toEqual(line);
      expect(app.scores.X).toBe(1);
    });
  });

  it('recognizes an O win through legal moves and prevents later moves or duplicate scores', () => {
    [0, 3, 1, 4, 8, 5].forEach((index) => app.play(index));
    expect(app.result).toBe('O');
    expect(app.scores.O).toBe(1);
    const board = [...app.board];
    app.play(6);
    app.play(7);
    expect(app.board).toEqual(board);
    expect(app.scores.O).toBe(1);
  });

  it('recognizes a draw after nine legal moves', () => {
    [0, 1, 2, 4, 3, 5, 7, 6, 8].forEach((index) => app.play(index));
    expect(app.result).toBe('draw');
    expect(app.scores.draw).toBe(1);
    expect(app.moveCount).toBe(9);
    app.play(0);
    expect(app.scores.draw).toBe(1);
  });

  it('prioritizes a win on the ninth move over a draw', () => {
    [0, 1, 2, 3, 4, 5, 7, 6, 8].forEach((index) => app.play(index));
    expect(app.result).toBe('X');
    expect(app.scores.draw).toBe(0);
  });

  it('retains scores, clears the board and alternates the round starter', () => {
    [0, 3, 1, 4, 2].forEach((index) => app.play(index));
    app.newRound();
    expect(app.round).toBe(2);
    expect(app.currentPlayer).toBe('O');
    expect(app.scores.X).toBe(1);
    expect(app.result).toBeNull();
    expect(app.winningLine).toEqual([]);
    expect(app.moveCount).toBe(0);
    app.newRound();
    expect(app.currentPlayer).toBe('X');
  });

  it('resets the entire match', () => {
    [0, 3, 1, 4, 2].forEach((index) => app.play(index));
    app.newRound();
    app.resetMatch();
    expect(app.scores).toEqual({ X: 0, O: 0, draw: 0 });
    expect(app.round).toBe(1);
    expect(app.currentPlayer).toBe('X');
    expect(app.moveCount).toBe(0);
  });

  it('renders accessible buttons, responds to clicks and disables the finished board', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root: HTMLElement = fixture.nativeElement;
    const cells = Array.from(root.querySelectorAll<HTMLButtonElement>('.cell'));
    expect(cells.length).toBe(9);
    expect(cells[0].getAttribute('aria-label')).toContain('Zeile 1, Spalte 1: frei');
    [0, 3, 1, 4, 2].forEach((index) => { cells[index].click(); fixture.detectChanges(); });
    expect(root.querySelector('[role="status"]')?.textContent).toContain('X gewinnt');
    expect(cells.every((cell) => cell.disabled)).toBeTrue();
    expect(root.querySelectorAll('.winning').length).toBe(3);
    expect(cells[0].getAttribute('aria-label')).toContain('X');
  });
});

describe('Computer opponent', () => {
  it('takes a win and blocks an immediate loss', () => {
    expect(bestComputerMove(['O', 'O', null, 'X', 'X', null, 'X', null, null])).toBe(2);
    expect(bestComputerMove(['X', 'X', null, null, 'O', null, null, null, null])).toBe(2);
  });
  it('never loses against any human continuation with either starter', () => {
    const winner = (board: (string | null)[]) => LINES.some(line => line.every(i => board[i] === 'X'));
    function visit(board: ('X' | 'O' | null)[], humanTurn: boolean): void {
      expect(winner(board)).toBeFalse();
      if (LINES.some(line => board[line[0]] && line.every(i => board[i] === board[line[0]])) || board.every(Boolean)) return;
      if (!humanTurn) {
        const index = bestComputerMove(board);
        expect(index).not.toBeNull();
        if (index !== null) { const next = [...board]; next[index] = 'O'; visit(next, true); }
      } else {
        board.forEach((cell, i) => { if (!cell) { const next = [...board]; next[i] = 'X'; visit(next, false); } });
      }
    }
    visit(Array(9).fill(null), true);
    visit(Array(9).fill(null), false);
  });
});

describe('Difficulty levels', () => {
  const board: ('X' | 'O' | null)[] = ['X', 'X', null, null, 'O', null, null, null, null];
  it('uses a random free cell on easy without changing the board', () => {
    const original = [...board];
    expect(computerMove(board, 'easy', () => 0.99)).toBe(8);
    expect(board).toEqual(original);
  });
  it('blocks threats and prioritizes its own win on medium', () => {
    expect(computerMove(board, 'medium')).toBe(2);
    expect(computerMove(['O', 'O', null, 'X', 'X', null, null, null, null], 'medium')).toBe(2);
  });
  it('uses perfect play on hard and handles a full board', () => {
    expect(computerMove(board, 'hard')).toBe(bestComputerMove(board));
    expect(computerMove(Array(9).fill('X'), 'easy')).toBeNull();
  });
});
