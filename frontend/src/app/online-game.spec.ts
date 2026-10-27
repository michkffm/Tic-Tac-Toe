import { TestBed } from '@angular/core/testing';
import { OnlineGame, RoomState, isRoomState } from './online-game';
const state = (): RoomState => ({roomId:'a'.repeat(32),player:'X',board:Array(9).fill(null),names:{X:'Alex',O:'Sam'},scores:{X:0,O:0,draw:0},round:1,currentPlayer:'X',result:null,lastMove:null,revision:1,targetWins:0,joined:true,opponentOnline:true});
describe('Online game',()=>{
  let game:OnlineGame; let fetchSpy:jasmine.Spy;
  beforeEach(async()=>{
    history.replaceState(null,'',location.pathname);sessionStorage.clear();
    fetchSpy=spyOn(window,'fetch').and.callFake(async()=>new Response(JSON.stringify(state()),{status:200}));
    await TestBed.configureTestingModule({imports:[OnlineGame]}).compileComponents();
    game=TestBed.createComponent(OnlineGame).componentInstance;game.api='https://example.test';
  });
  afterEach(()=>{game.ngOnDestroy();history.replaceState(null,'',location.pathname);});
  it('validates incoming room data',()=>{
    expect(isRoomState(state())).toBeTrue();
    for(const [key,value] of [['board',['X']],['player','Z'],['scores',{X:-1,O:0,draw:0}],['revision',-1],['targetWins',99],['roomId','invalid'],['joined','yes'],['names',{X:3,O:'Sam'}]]) expect(isRoomState({...state(),[String(key)]:value})).toBeFalse();
  });
  it('creates a room without exposing the private player key in its invitation',async()=>{
    game.name='Alex';await game.enter(false);
    const options=fetchSpy.calls.mostRecent().args[1];
    expect(JSON.parse(options.body)).toEqual({name:'Alex',targetWins:0});
    expect(options.headers.Authorization).toMatch(/^Bearer [a-f0-9]{64}$/);
    expect(game.invite).toContain('#room='+'a'.repeat(32));
    expect(game.invite).not.toContain(options.headers.Authorization.slice(7));
    expect(sessionStorage.getItem('spielzeit-room-'+'a'.repeat(32))).toBe(options.headers.Authorization.slice(7));
  });
  it('joins using a full invitation and blocks the opponent turn',async()=>{
    game.code='https://example.test/#room='+'a'.repeat(32);await game.enter(true);
    expect(fetchSpy.calls.mostRecent().args[0]).toContain('/join');
    await game.move(4);expect(JSON.parse(fetchSpy.calls.mostRecent().args[1].body)).toEqual({index:4,revision:1});
    game.room={...state(),currentPlayer:'O'};const calls=fetchSpy.calls.count();await game.move(0);expect(fetchSpy.calls.count()).toBe(calls);
  });
  it('handles invalid invitations, full rooms and network failures',async()=>{
    game.code='invalid';await game.enter(true);expect(fetchSpy).not.toHaveBeenCalled();
    game.code='a'.repeat(32);fetchSpy.and.callFake(async()=>new Response('{}',{status:409}));await game.enter(true);expect(game.error).toContain('voll');
    fetchSpy.and.rejectWith(new TypeError('Offline'));await game.enter(false);expect(game.connected).toBeFalse();expect(game.error).toContain('Server');
  });
  it('restores the same seat and leaves cleanly',async()=>{
    sessionStorage.setItem('spielzeit-room-'+'a'.repeat(32),'b'.repeat(64));history.replaceState(null,'','#room='+'a'.repeat(32));
    await game.ngOnInit();expect(game.room?.player).toBe('X');
    game.leave();expect(game.room).toBeNull();expect(location.hash).toBe('');
  });
  it('disables the board until both players have joined',()=>{
    const fixture=TestBed.createComponent(OnlineGame);fixture.componentInstance.room={...state(),joined:false};fixture.componentInstance.connected=true;fixture.detectChanges();
    const root:HTMLElement=fixture.nativeElement;expect(root.textContent).toContain('Warte auf deinen Mitspieler');expect(Array.from(root.querySelectorAll<HTMLButtonElement>('.cell')).every(b=>b.disabled)).toBeTrue();fixture.destroy();
  });
});
