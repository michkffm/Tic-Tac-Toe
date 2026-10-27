import { Component, Input, OnInit, OnDestroy } from '@angular/core';

type Player = 'X' | 'O';
export interface RoomState {
  roomId: string; player: Player; board: (Player | null)[];
  names: Record<Player, string>; scores: Record<Player | 'draw', number>;
  round: number; currentPlayer: Player; result: Player | 'draw' | null;
  lastMove: number | null; revision: number; targetWins: number;
  joined: boolean; opponentOnline: boolean;
}
export function isRoomState(value: unknown): value is RoomState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const names = v['names']; const scores = v['scores'];
  return typeof v['roomId'] === 'string' && /^[a-f0-9]{32}$/.test(v['roomId']) &&
    (v['player'] === 'X' || v['player'] === 'O') && (v['currentPlayer'] === 'X' || v['currentPlayer'] === 'O') &&
    Array.isArray(v['board']) && v['board'].length === 9 && v['board'].every(c => c === null || c === 'X' || c === 'O') &&
    (v['result'] === null || ['X', 'O', 'draw'].includes(String(v['result']))) &&
    (v['lastMove'] === null || (Number.isInteger(v['lastMove']) && Number(v['lastMove']) >= 0 && Number(v['lastMove']) < 9)) &&
    typeof names === 'object' && names !== null && ['X', 'O'].every(p => typeof (names as Record<string, unknown>)[p] === 'string' && Array.from(String((names as Record<string, unknown>)[p])).length <= 24) &&
    typeof scores === 'object' && scores !== null && ['X', 'O', 'draw'].every(p => Number.isSafeInteger((scores as Record<string, unknown>)[p]) && Number((scores as Record<string, unknown>)[p]) >= 0) &&
    Number.isSafeInteger(v['round']) && Number(v['round']) > 0 && Number.isSafeInteger(v['revision']) && Number(v['revision']) >= 0 &&
    (v['targetWins'] === 0 || v['targetWins'] === 3) && typeof v['joined'] === 'boolean' && typeof v['opponentOnline'] === 'boolean';
}

@Component({
  selector: 'online-game',
  templateUrl: './online-game.html',
  styleUrls: ['./app.css', './settings.css', './online.css'],
})
export class OnlineGame implements OnInit, OnDestroy {
  @Input() language: 'de' | 'en' = 'de';
  @Input() api = '';
  room: RoomState | null = null;
  name = '';
  code = '';
  target = '0';
  busy = false;
  connected = false;
  error = '';
  copied = false;
  private token = '';
  private timer?: ReturnType<typeof setTimeout>;
  private controller?: AbortController;
  private destroyed = false;
  private requestPending = false;

  t(de: string, en: string): string { return this.language === 'de' ? de : en; }
  get invite(): string { return `${location.origin}${location.pathname}#room=${this.room?.roomId ?? ''}`; }
  get winner(): Player | null {
    if (!this.room?.targetWins) return null;
    return this.room.scores.X >= this.room.targetWins ? 'X' : this.room.scores.O >= this.room.targetWins ? 'O' : null;
  }
  playerName(player: Player): string { return this.room?.names[player] || this.t(`Spieler ${player}`, `Player ${player}`); }
  get canPlay(): boolean { return !!this.room && this.connected && this.room.joined && this.room.currentPlayer === this.room.player && this.room.result === null && !this.busy; }
  get status(): string {
    if (!this.room) return this.t('Erstellt einen Raum oder öffnet euren Einladungslink.', 'Create a room or open your invitation link.');
    if (!this.connected) return this.t('Verbindung unterbrochen. Wir versuchen es erneut …', 'Connection lost. Retrying …');
    if (!this.room.joined) return this.t('Warte auf deinen Mitspieler …', 'Waiting for your opponent …');
    if (this.winner) return this.t(`${this.playerName(this.winner)} gewinnt das Match!`, `${this.playerName(this.winner)} wins the match!`);
    if (this.room.result === 'draw') return this.t('Unentschieden!', 'A draw!');
    if (this.room.result) return this.t(`${this.playerName(this.room.result)} gewinnt!`, `${this.playerName(this.room.result)} wins!`);
    return this.room.currentPlayer === this.room.player ? this.t('Du bist am Zug!', 'Your move!') : this.t(`${this.playerName(this.room.currentPlayer)} ist am Zug`, `${this.playerName(this.room.currentPlayer)} to move`);
  }

  async ngOnInit(): Promise<void> {
    this.code = new URLSearchParams(location.hash.slice(1)).get('room') ?? '';
    if (!/^[0-9a-f]{32}$/.test(this.code)) { this.code = ''; return; }
    try {
      const token = sessionStorage.getItem(`spielzeit-room-${this.code}`);
      if (token && /^[0-9a-f]{64}$/.test(token)) {
        this.token = token;
        await this.resume();
      }
    } catch { /* Rejoining remains possible with a fresh invitation. */ }
  }
  ngOnDestroy(): void { this.destroyed = true; clearTimeout(this.timer); this.controller?.abort(); }

  private async resume(): Promise<void> { this.busy = true; await this.send(`/api/rooms/${this.code}`); this.busy = false; this.schedule(); }
  private schedule(): void {
    clearTimeout(this.timer);
    if (!this.destroyed && this.token && this.code) this.timer = setTimeout(async () => {
      if (!this.requestPending) await this.send(`/api/rooms/${this.code}`);
      this.schedule();
    }, 4000);
  }
  async enter(join: boolean): Promise<void> {
    if (!this.api || this.busy || this.requestPending) return;
    const raw = this.code.trim();
    // Accept either the room code itself or a complete invitation URL.
    if (join && raw.includes('#')) {
      try { this.code = new URLSearchParams(new URL(raw).hash.slice(1)).get('room') ?? ''; } catch { this.code = ''; }
    } else this.code = raw;
    if (join && !/^[a-f0-9]{32}$/.test(this.code)) { this.error = this.t('Bitte einen gültigen Raumcode oder Einladungslink eingeben.', 'Enter a valid room code or invitation link.'); return; }
    this.token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    this.busy = true;
    await this.send(join ? `/api/rooms/${this.code}/join` : '/api/rooms', join ? {name: this.name} : {name: this.name, targetWins: Number(this.target)});
    this.busy = false;
    if (this.room) {
      this.code = this.room.roomId;
      try { sessionStorage.setItem(`spielzeit-room-${this.code}`, this.token); } catch { /* Current connection still works. */ }
      history.replaceState(null, '', `#room=${this.code}`);
      this.schedule();
    }
  }
  async move(index: number): Promise<void> {
    if (!this.canPlay || !this.room || this.room.board[index] !== null) return;
    await this.action('move', {index});
  }
  async nextRound(): Promise<void> { if (this.room?.result) await this.action('round', {}); }
  private async action(action: string, extra: Record<string, number>): Promise<void> {
    if (!this.room || this.busy || this.requestPending || !this.connected) return;
    this.busy = true;
    await this.send(`/api/rooms/${this.room.roomId}/${action}`, {revision: this.room.revision, ...extra});
    this.busy = false;
  }
  leave(): void {
    clearTimeout(this.timer); this.controller?.abort(); this.token = ''; this.room = null;
    this.code = ''; this.connected = false; this.error = ''; this.copied = false;
    history.replaceState(null, '', location.pathname + location.search);
  }
  async copyInvite(): Promise<void> {
    try { await navigator.clipboard.writeText(this.invite); this.copied = true; }
    catch { this.error = this.t('Bitte den Einladungslink im Feld markieren und kopieren.', 'Select and copy the invitation link from the field.'); }
  }
  private async send(path: string, body?: Record<string, unknown>): Promise<void> {
    if (this.destroyed || this.requestPending) return;
    this.requestPending = true;
    const controller = new AbortController(); this.controller = controller;
    const timeout = setTimeout(() => controller.abort(), 70000);
    try {
      const response = await fetch(this.api.replace(/\/$/, '') + path, {
        method: body ? 'POST' : 'GET', headers: {Authorization: `Bearer ${this.token}`, ...(body ? {'Content-Type': 'application/json'} : {})},
        body: body ? JSON.stringify(body) : undefined, signal: controller.signal,
      });
      if (this.destroyed || controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status === 404 || response.status === 403 || response.status === 401) {
          this.error = this.t('Raum nicht mehr verfügbar. Bitte einen neuen Raum erstellen oder erneut beitreten.', 'Room no longer available. Create a new room or join again.');
          this.token = ''; this.room = null; this.connected = false;
        } else if (response.status === 409) {
          this.error = this.room ? this.t('Spielstand geändert. Er wird gleich neu geladen.', 'The game changed. Refreshing shortly.') : this.t('Dieser Raum ist bereits voll.', 'This room is already full.');
        } else throw new Error('Unavailable');
        return;
      }
      const data: unknown = await response.json();
      if (this.destroyed || controller.signal.aborted) return;
      if (!isRoomState(data)) throw new Error('Invalid response');
      this.room = data; this.code = data.roomId; this.connected = true; this.error = '';
    } catch {
      if (!this.destroyed && this.token) { this.connected = false; this.error = this.t('Server nicht erreichbar. Beim ersten Start kann es etwa eine Minute dauern. Bitte erneut versuchen.', 'Server unavailable. The first start can take about a minute. Please try again.'); }
    } finally { clearTimeout(timeout); this.requestPending = false; }
  }
}
