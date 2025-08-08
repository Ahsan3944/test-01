
function escapeHTML(str){ if (str===0) return '0'; if (!str) return ''; return String(str).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;'); }



/* Background music (optional) using WebAudio - gentle ambient synth loop */
let backgroundMusic = { ctx:null, o:null, g:null, playing:false };
function startBackgroundMusic(){
  try{
    if (backgroundMusic.playing) return;
    const ctx = _audioCtx; backgroundMusic.ctx = ctx;
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = 220;
    g.gain.value = 0.01;
    o.connect(g); g.connect(ctx.destination);
    o.start();
    backgroundMusic.o = o; backgroundMusic.g = g; backgroundMusic.playing = true;
  }catch(e){}
}
function stopBackgroundMusic(){
  try{ if (backgroundMusic.o) backgroundMusic.o.stop(); backgroundMusic.playing=false; }catch(e){} }



/* --- Optional Firebase integration (scaffold) ---
   To enable global leaderboards, provide your Firebase config and call initFirebase(config).
   This code loads Firestore dynamically (CDN) and exposes save/get functions that will
   fallback to localStorage if Firebase is not initialized or network fails.
*/
let FIREBASE_ENABLED = false;
let FIREBASE_DB = null;

async function initFirebase(config){
  if (!config) return false;
  try {
    // Load Firebase scripts dynamically (modular v9 compat from CDN)
    if (!window.firebaseAppLoaded) {
      const s1 = document.createElement('script'); s1.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js"; document.head.appendChild(s1);
      const s2 = document.createElement('script'); s2.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js"; document.head.appendChild(s2);
      await new Promise(res => { s2.onload = res; s1.onload = res; setTimeout(res, 1200); });
      window.firebaseAppLoaded = true;
    }
    // Initialize app
    if (!window.firebase || !window.firebase.initializeApp) {
      console.warn('Firebase scripts loaded but API not available.');
      return false;
    }
    const app = firebase.initializeApp(config);
    FIREBASE_DB = firebase.firestore();
    FIREBASE_ENABLED = true;
    console.log('Firebase initialized for UltraOP (leaderboards).');
    return true;
  } catch(e){
    console.warn('Firebase init failed:', e);
    return false;
  }
}

async function saveToLeaderboardRemote(gameId, name, score){
  if (!FIREBASE_ENABLED || !FIREBASE_DB) return false;
  try {
    await FIREBASE_DB.collection('leaderboards').doc(gameId).collection('scores').add({name,score,at:new Date()});
    return true;
  } catch(e){ console.warn('saveToLeaderboardRemote failed', e); return false; }
}

async function getLeaderboardRemote(gameId, limitN=30){
  if (!FIREBASE_ENABLED || !FIREBASE_DB) return null;
  try {
    const snap = await FIREBASE_DB.collection('leaderboards').doc(gameId).collection('scores').orderBy('score','desc').limit(limitN).get();
    const out = [];
    snap.forEach(doc => out.push(doc.data()));
    return out;
  } catch(e){ console.warn('getLeaderboardRemote failed', e); return null; }
}


/* Simple sound helper using WebAudio */
const _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq=440, duration=0.05){
  try{
    const o = _audioCtx.createOscillator();
    const g = _audioCtx.createGain();
    o.type = 'sine';
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g); g.connect(_audioCtx.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, _audioCtx.currentTime + duration);
    setTimeout(()=>{ o.stop(); }, duration*1000 + 20);
  }catch(e){ /* silent */ }
}

/* games.js - Modular Games + Leaderboards + Achievements for UltraOP */

/* Utility helpers */
const U = {
  qs: (s, root=document) => root.querySelector(s),
  qsa: (s, root=document) => Array.from(root.querySelectorAll(s)),
  el: (t, attrs={}, children=[]) => { const e = document.createElement(t); Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,v)); children.forEach(c => e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c)); return e; },
  rand: (min, max) => Math.floor(Math.random()*(max-min+1))+min,
  nowISO: () => new Date().toISOString().slice(0,19).replace('T',' ')
};

/* Game Manager: registers games, manages modal, leaderboards, achievements */
const GameManager = {
  games: {},
  current: null,
  username: localStorage.getItem('ultraop_player_name') || 'Guest',
  init(){
    this.cache();
    this.loadGames();
    this.renderCards();
    this.bindUI();
    this.renderPlayerName();
    this.renderAchievementsPanel();
    // initialize challenge engine
    if (!this.challengeEngine) this.challengeEngine = new ChallengeEngine(this);
  },
  cache(){
    this.grid = U.qs('#games-grid');
    this.modal = U.qs('#game-modal');
    this.modalPanel = U.qs('.modal-panel');
    this.gameArea = U.qs('#game-area');
    this.gameTitle = U.qs('#game-title');
    this.scoreArea = U.qs('#score-area');
    this.lbPanel = U.qs('#leaderboard-list');
    this.achPanel = U.qs('#achievements-list');
  },
  bindUI(){
    U.qs('#save-name').addEventListener('click', ()=>{
      const v = U.qs('#player-name').value.trim() || 'Guest';
      this.username = v;
      localStorage.setItem('ultraop_player_name', v);
      this.renderPlayerName();
      alert('Saved player name: ' + v);
    });
    U.qs('#close-game').addEventListener('click', ()=> this.closeGame());
    U.qs('#save-score-btn').addEventListener('click', ()=> this.promptSaveScore());
    U.qs('#share-score-btn').addEventListener('click', ()=> this.shareCurrentScore());
    U.qs('#open-leaderboard-btn').addEventListener('click', ()=> {
      if (this.current) this.renderLeaderboard(this.current.id);
    });
  },
  renderPlayerName(){
    U.qs('#player-name').value = this.username;
  },
  loadGames(){
    /* Register built-in games here */
    this.registerGame(SnakeGame);
    this.registerGame(TicTacToeGame);
    this.registerGame(MemoryMatchGame);
    this.registerGame(GullyCricketGame);
    this.registerGame(ReactionTimeGame);
    this.registerGame(MathQuizGame);
    this.registerGame(SpinWheelGame);
    this.registerGame(GuessNumberGame);
  },
  registerGame(gameClass){
    this.games[gameClass.id] = gameClass;
  },
  renderCards(){
    this.grid.innerHTML='';
    Object.values(this.games).forEach(g => {
      const card = U.el('article', {class:'game-card', tabindex:0}, []);
      const thumb = U.el('div', {class:'game-thumb'}, [g.icon||'🎮']);
      const info = U.el('div', {class:'game-info'}, []);
      const title = U.el('h4', {}, [g.name]);
      const btn = U.el('button', {class:'play-btn', 'aria-label':'Play '+g.name}, [ 'PLAY' ]);
      btn.addEventListener('click', ()=> this.openGame(g.id));
      info.appendChild(title); info.appendChild(btn);
      card.appendChild(thumb); card.appendChild(info);
      card.addEventListener('keydown', (ev)=> { if(ev.key==='Enter') btn.click(); });
      this.grid.appendChild(card);
    });
  },
  openGame(id){
    const G = this.games[id];
    if (!G) return;
    this.current = {id, instance: null, lastScore: null};
    this.gameTitle.textContent = G.name;
    this.gameArea.innerHTML = '';
    this.scoreArea.innerHTML = '';
    U.qs('#game-modal').setAttribute('aria-hidden','false');
    // Create a container
    const container = U.el('div',{class:'game-host'});
    this.gameArea.appendChild(container);
    // Instantiate game
    const instance = new G(container, {
      onScore: (score) => {
        this.current.lastScore = score;
        this.scoreArea.textContent = `Score: ${score}`;
        this.checkAchievements(id, score);
      },
      onEnd: (score)=> {
        this.current.lastScore = score;
        this.scoreArea.textContent = `Final Score: ${score}`;
        this.checkAchievements(id, score, true);
      }
    });
    this.current.instance = instance;
    instance.start();
    // Show default leaderboard for game
    this.renderLeaderboard(id);
  },
  closeGame(){
    if (this.current && this.current.instance && this.current.instance.stop) this.current.instance.stop();
    this.current = null;
    U.qs('#game-modal').setAttribute('aria-hidden','true');
    this.gameArea.innerHTML='';
    this.scoreArea.innerHTML='';
  },
  /* Leaderboards stored in localStorage per game */
  lbKey(gameId){ return 'ultraop_lb_' + gameId; },
  getLeaderboard(gameId){ 
    const raw = localStorage.getItem(this.lbKey(gameId));
    try { return raw ? JSON.parse(raw) : []; } catch(e){return [];}
  },
  saveToLeaderboard(gameId, name, score){
    const arr = this.getLeaderboard(gameId);
    arr.push({name, score: Number(score), at: U.nowISO()});
    // Keep only top 30 sorted desc
    arr.sort((a,b)=> b.score - a.score);
    const saved = arr.slice(0,30);
    localStorage.setItem(this.lbKey(gameId), JSON.stringify(saved));
    this.renderLeaderboard(gameId);
  },
  renderLeaderboard(gameId){
    const list = this.getLeaderboard(gameId);
    if (!list.length) {
      this.// UNSAFE innerHTML replaced, build DOM manually
while(lbPanel.firstChild) lbPanel.removeChild(lbPanel.firstChild);
// Append nodes safely here instead of using innerHTML
      return;
    }
    this.lbPanel.innerHTML = '';
    list.slice(0,10).forEach((row, idx) => {
      const entry = U.el('div',{class:'leaderboard-entry'},[]);
      while(entry.firstChild) entry.removeChild(entry.firstChild);
// Left side
const left = document.createElement('div');
const nameStrong = document.createElement('strong');
nameStrong.textContent = (idx+1) + '. ' + row.name;
const dateDiv = document.createElement('div');
dateDiv.style.fontSize = '0.85rem';
dateDiv.style.color = 'var(--muted)';
dateDiv.textContent = row.at;
left.appendChild(nameStrong);
left.appendChild(dateDiv);
// Right side
const right = document.createElement('div');
right.style.minWidth = '80px';
right.style.textAlign = 'right';
const scoreStrong = document.createElement('strong');
scoreStrong.textContent = row.score;
right.appendChild(scoreStrong);
entry.appendChild(left);
entry.appendChild(right);
      this.lbPanel.appendChild(entry);
    });
  },
  promptSaveScore(){
    if (!this.current || this.current.lastScore == null) { alert('No score to save yet. Play a game and get a score!'); return; }
    let name = prompt('Enter name for leaderboard', this.username || 'Guest') || 'Guest'; name = name.replace(/[<>"'`]/g,'').trim() || 'Guest';
    this.saveToLeaderboard(this.current.id, name, this.current.lastScore);
    alert('Saved!');
  },
  shareCurrentScore(){
    if (!this.current || this.current.lastScore == null) { alert('No score to share yet.'); return; }
    const text = `I scored ${this.current.lastScore} in ${this.games[this.current.id].name} on UltraOP! Can you beat me?`;
    if (navigator.share) {
      navigator.share({title: 'UltraOP Score', text}).catch(()=>{});
    } else {
      // fallback: copy to clipboard and show share links
      navigator.clipboard?.writeText(text).then(()=>{
        const w = window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
        if (!w) alert('Score copied to clipboard. Share it!');
      }).catch(()=>{ alert('Could not copy; use your browser share.'); });
    }
  },

  /* Achievements system: simple thresholds per game */
  achKey(){ return 'ultraop_achievements_v1'; },
  getAchievements(){ try{ return JSON.parse(localStorage.getItem(this.achKey())) || {}; } catch(e){ return {}; } },
  saveAchievements(obj){ localStorage.setItem(this.achKey(), JSON.stringify(obj)); },
  unlockAchievement(gameId, id, title, desc){
    const all = this.getAchievements();
    all[gameId] = all[gameId] || {};
    if (all[gameId][id]) return false;
    all[gameId][id] = {title,desc,at: U.nowISO()};
    this.saveAchievements(all);
    this.renderAchievementsPanel();
    // initialize challenge engine
    if (!this.challengeEngine) this.challengeEngine = new ChallengeEngine(this);
    // small toast
    try{ new Notification?.requestPermission && Notification.requestPermission(()=>{}); }catch(e){}
    return true;
  },
  checkAchievements(gameId, score, ended=false){
    // sample rules per game
    const rules = this.games[gameId].achievementRules || [];
    rules.forEach(r => {
      const pass = (r.type==='score' && score >= r.value) || (r.type==='firstWin' && ended && score>0);
      if (pass) {
        const unlocked = this.unlockAchievement(gameId, r.id, r.title, r.desc);
        if (unlocked) alert(`Achievement unlocked: ${r.title}`);
      }
    });
  },
  renderAchievementsPanel(){
    const all = this.getAchievements();
    this.achPanel.innerHTML='';
    if (!Object.keys(all).length) {
      this.achPanel.innerHTML = '<div class="muted">No achievements yet. Play a game to unlock badges.</div>';
      return;
    }
    Object.entries(all).forEach(([gameId, group])=>{
      Object.entries(group).forEach(([id, meta])=>{
        const el = U.el('div',{class:'achievement'},[]);
        // UNSAFE innerHTML replaced, build DOM manually
while(el.firstChild) el.removeChild(el.firstChild);
// Append nodes safely here instead of using innerHTML
        this.achPanel.appendChild(el);
      });
    });
  }
};

/* -----------------------
   Games (constructors)
   Each game exposes: id, name, icon, constructor(container, hooks)
-------------------------*/

/* --- 1) Snake Game --- */
class SnakeGame {
  static id = 'snake';
  static name = 'Snake';
  static icon = '🟩';
  static achievementRules = [
    {id:'snake_50', type:'score', value:50, title:'Green Champion', desc:'Score 50 in Snake'},
    {id:'snake_first', type:'firstWin', title:'Snake Starter', desc:'Finish a Snake game'}
  ];
  constructor(container, hooks){
    this.container = container;
    this.hooks = hooks || {};
    this.canvas = document.createElement('canvas');
    this.canvas.width = 560; this.canvas.height = 400;
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);
    this._running = false;
    this.reset();
    this.bindKeys();
  }
  reset(){
    this.grid = 20;
    this.cols = Math.floor(this.canvas.width/this.grid);
    this.rows = Math.floor(this.canvas.height/this.grid);
    this.snake = [{x:Math.floor(this.cols/2), y:Math.floor(this.rows/2)}];
    this.dir = {x:1,y:0};
    this.placeFood();
    this.score = 0;
    this.tick = 0;
    this.speed = 8; // frames per move
  }
  placeFood(){
    this.food = {x: U.rand(1,this.cols-2), y: U.rand(1,this.rows-2)};
  }
  bindKeys(){
    this.keyHandler = (e)=>{
      const k = e.key;
      if (['ArrowUp','w'].includes(k) && this.dir.y===0) this.dir = {x:0,y:-1};
      if (['ArrowDown','s'].includes(k) && this.dir.y===0) this.dir = {x:0,y:1};
      if (['ArrowLeft','a'].includes(k) && this.dir.x===0) this.dir = {x:-1,y:0};
      if (['ArrowRight','d'].includes(k) && this.dir.x===0) this.dir = {x:1,y:0};
    };
    window.addEventListener('keydown', this.keyHandler);
  }
  start(){
    this._running = true;
    this.loop = setInterval(()=> this.step(), 1000/60);
  }
  step(){
    this.tick++;
    if (this.tick % this.speed !== 0) {
      this.draw(); 
      return;
    }
    // move
    const head = {x: this.snake[0].x + this.dir.x, y: this.snake[0].y + this.dir.y};
    // wrap-around
    if (head.x < 0) head.x = this.cols-1;
    if (head.x >= this.cols) head.x = 0;
    if (head.y < 0) head.y = this.rows-1;
    if (head.y >= this.rows) head.y = 0;
    // collision with self
    if (this.snake.some(s => s.x===head.x && s.y===head.y)) return this.gameOver();
    this.snake.unshift(head);
    if (head.x === this.food.x && head.y === this.food.y){
      this.score += 10;
      this.placeFood();
      // increase difficulty slightly
      if (this.speed>3) this.speed -= 0.2;
    } else {
      this.snake.pop();
    }
    // update hooks
    if (this.hooks.onScore) this.hooks.onScore(this.score);
    this.draw();
  }
  draw(){
    const ctx = this.ctx;
    ctx.clearRect(0,0,this.canvas.width,this.canvas.height);
    // background grid subtle
    ctx.fillStyle = '#071023'; ctx.fillRect(0,0,this.canvas.width,this.canvas.height);
    // food
    ctx.fillStyle = '#ffb86b'; ctx.fillRect(this.food.x*this.grid, this.food.y*this.grid, this.grid, this.grid);
    // snake
    ctx.fillStyle = '#6c5ce7';
    this.snake.forEach((s,i)=> {
      const size = this.grid - (i===0?2:4);
      ctx.fillRect(s.x*this.grid+2, s.y*this.grid+2, size, size);
    });
    // score overlay
    ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(6,6,120,28);
    ctx.fillStyle = '#e6f0ff'; ctx.font = '14px system-ui'; ctx.fillText('Score: '+this.score, 14, 24);
  }
  gameOver(){
    this.stop();
    if (this.hooks.onEnd) this.hooks.onEnd(this.score);
    // show small dialog
    setTimeout(()=>{
      if (confirm(`Game Over — Score: ${this.score}\nSave to leaderboard?`)) GameManager.saveToLeaderboard('snake', GameManager.username||'Guest', this.score);
    }, 80);
  }
  stop(){
    this._running=false;
    clearInterval(this.loop);
    window.removeEventListener('keydown', this.keyHandler);
  }
}

/* --- 2) Tic Tac Toe --- */
class TicTacToeGame {
  static id='tictactoe';
  static name='Tic‑Tac‑Toe';
  static icon='⭕';
  static achievementRules = [
    {id:'ttt_win', type:'firstWin', title:'3-in-a-row', desc:'Win a tic-tac-toe game'}
  ];
  constructor(container, hooks){
    this.container = container;
    this.hooks = hooks || {};
    this.el = document.createElement('div');
    this.el.className='ttt-host';
    this.container.appendChild(this.el);
    this.reset();
  }
  reset(){
    this.board = Array(9).fill(null);
    this.turn = 'X';
    this.over=false;
    this.render();
  }
  render(){
    this.el.innerHTML='';
    const board = document.createElement('div'); board.style.display='grid'; board.style.gridTemplateColumns='repeat(3, 80px)'; board.style.gap='8px';
    this.board.forEach((v,i)=>{
      const cell = document.createElement('button'); cell.style.width='80px'; cell.style.height='80px'; cell.style.fontSize='28px'; cell.style.borderRadius='8px'; cell.style.background='linear-gradient(180deg, rgba(255,255,255,0.02), transparent)';
      cell.textContent = v || '';
      cell.addEventListener('click', ()=> this.play(i));
      board.appendChild(cell);
    });
    const controls = document.createElement('div'); controls.style.marginTop='12px';
    const resetBtn = document.createElement('button'); resetBtn.textContent='Reset'; resetBtn.className='btn'; resetBtn.addEventListener('click', ()=> this.reset());
    controls.appendChild(resetBtn);
    this.el.appendChild(board); this.el.appendChild(controls);
  }
  play(i){
    if (this.over || this.board[i]) return;
    this.board[i]=this.turn;
    if (this.checkWin(this.turn)){
      this.over=true; this.hooks.onEnd && this.hooks.onEnd(this.turn==='X'?1:1);
      setTimeout(()=> alert(`Player ${this.turn} wins!`), 50);
      GameManager.saveToLeaderboard('tictactoe', GameManager.username||'Guest', 1);
      GameManager.checkAchievements('tictactoe', 1, true);
      return;
    }
    if (this.board.every(Boolean)){ this.over=true; this.hooks.onEnd && this.hooks.onEnd(0); alert('Draw'); return; }
    this.turn = this.turn === 'X' ? 'O' : 'X';
    // simple ai on O
    if (this.turn==='O') this.aiMove();
    this.render();
  }
  aiMove(){
    // pick random available (simple AI keeps game fast)
    const empties = this.board.map((v,i)=>v?null:i).filter(Boolean!==null);
    if (!empties.length) return;
    const choice = empties[Math.floor(Math.random()*empties.length)];
    this.play(choice);
  }
  checkWin(p){
    const b = this.board;
    const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    return lines.some(line => line.every(i=>b[i]===p));
  }
  start(){ /* nothing to init */ }
  stop(){ /* nothing special */ }
}

/* --- 3) Memory Match --- */
class MemoryMatchGame {
  static id='memory';
  static name='Memory Match';
  static icon='🧠';
  static achievementRules=[{id:'mem_pairs_8', type:'score', value:8, title:'Memory Master', desc:'Match 8 pairs'}];
  constructor(container, hooks){
    this.container = container; this.hooks = hooks || {};
    this.el = document.createElement('div'); this.el.className='mem-host'; this.container.appendChild(this.el);
    this.reset();
  }
  reset(){
    this.pairs = 8;
    this.loadCards();
    this.matched=0; this.moves=0; this.flipped=[];
    this.render();
  }
  loadCards(){
    const emojis = ['🐯','🐵','🐙','🦁','🦊','🐼','🐸','🐤','🦄','🐢','🦀','🐮'];
    const set = emojis.slice(0,this.pairs);
    this.deck = [...set, ...set].sort(()=>Math.random()-0.5);
  }
  render(){
    this.el.innerHTML='';
    const grid = document.createElement('div'); grid.style.display='grid'; grid.style.gridTemplateColumns='repeat(4,80px)'; grid.style.gap='10px';
    this.deck.forEach((card,i)=>{
      const btn = document.createElement('button'); btn.style.width='80px'; btn.style.height='80px'; btn.style.fontSize='32px'; btn.style.borderRadius='8px';
      btn.innerHTML = this.flipped.includes(i) || this.matchedIndices?.includes(i) ? this.deck[i] : '❓';
      btn.addEventListener('click', ()=> this.flip(i));
      grid.appendChild(btn);
    });
    const info = document.createElement('div'); info.style.marginTop='10px'; while(info.firstChild) info.removeChild(info.firstChild);
const divMoves = document.createElement('div'); divMoves.textContent = 'Moves: ' + this.moves; info.appendChild(divMoves);
    this.el.appendChild(grid); this.el.appendChild(info);
    if (this.hooks.onScore) this.hooks.onScore(this.matched);
  }
  flip(i){
    if (this.flipped.includes(i) || (this.matchedIndices||[]).includes(i)) return;
    this.flipped.push(i);
    if (this.flipped.length===2){
      this.moves++;
      const [a,b]=this.flipped;
      if (this.deck[a]===this.deck[b]){
        this.matchedIndices = (this.matchedIndices||[]).concat([a,b]);
        this.matched++;
        this.hooks.onScore && this.hooks.onScore(this.matched);
        if (this.matched === this.pairs){
          this.hooks.onEnd && this.hooks.onEnd(this.moves);
          setTimeout(()=> { alert(`Completed in ${this.moves} moves`); GameManager.saveToLeaderboard('memory', GameManager.username||'Guest', Math.max(1, 200 - this.moves)); GameManager.checkAchievements('memory', this.matched, true); }, 120);
        }
      }
      setTimeout(()=>{ this.flipped=[]; this.render(); }, 800);
    } else this.render();
  }
  start(){}
  stop(){}
}

/* --- 4) Gully Cricket (timing mini-game) --- */
class GullyCricketGame {
  static id='gully';
  static name='Gully Cricket';
  static icon='🏏';
  static achievementRules=[{id:'gully_50', type:'score', value:50, title:'Street Striker', desc:'Score 50 runs'}];
  constructor(container, hooks){
    this.container = container; this.hooks = hooks || {};
    this.el = document.createElement('div'); this.el.className='gully-host'; this.container.appendChild(this.el);
    this.score = 0; this.running=false; this.render();
  }
  render(){
    this.// UNSAFE innerHTML replaced, build DOM manually
while(el.firstChild) el.removeChild(el.firstChild);
// Append nodes safely here instead of using innerHTML
    this.ball = this.el.querySelector('#gully-ball');
    this.track = this.el.querySelector('#gully-track');
    this.hitBtn = this.el.querySelector('#gully-hit');
    this.startBtn = this.el.querySelector('#gully-start');
    this.scoreEl = this.el.querySelector('#gully-score');
    this.hitBtn.addEventListener('click', ()=> this.hit());
    this.startBtn.addEventListener('click', ()=> this.startRound());
  }
  startRound(){
    if (this.running) return;
    this.running = true;
    this.x = 0; this.dir = 1;
    this.ball.style.left = '0px';
    this.t = setInterval(()=>{
      this.x += 6 * this.dir;
      if (this.x > (this.track.clientWidth - 24)) { this.x = this.track.clientWidth - 24; this.dir = -1; }
      if (this.x < 0) { this.x = 0; this.dir = 1; }
      this.ball.style.left = this.x + 'px';
    }, 20);
    // auto-stop in 20s
    this.endTimer = setTimeout(()=> this.end(), 20000);
  }
  hit(){
    if (!this.running) return;
    // Better timing near center yields higher runs
    const center = (this.track.clientWidth - 24) / 2;
    const dist = Math.abs(this.x - center);
    const rel = Math.max(0, 1 - (dist / center));
    // map rel to runs 0-6 (0,1,2,3,4,6)
    const choices = [0,1,2,3,4,6];
    const idx = Math.floor(rel * (choices.length-1));
    const run = choices[idx];
    this.score += run;
    this.scoreEl.textContent = 'Score: ' + this.score;
    this.hooks.onScore && this.hooks.onScore(this.score);
    // small feedback
    const flash = document.createElement('div'); flash.textContent = run>0? `+${run}` : 'OUT'; flash.style.position='absolute'; flash.style.top='0'; flash.style.left=(this.x)+'px'; flash.style.color='#fff'; flash.style.fontWeight='800';
    this.track.appendChild(flash);
    setTimeout(()=> flash.remove(),800);
  }
  end(){
    clearInterval(this.t); clearTimeout(this.endTimer); this.running=false;
    this.hooks.onEnd && this.hooks.onEnd(this.score);
    setTimeout(()=> { if (confirm(`Innings over! Runs: ${this.score}\nSave to leaderboard?`)) GameManager.saveToLeaderboard('gully', GameManager.username||'Guest', this.score); }, 100);
  }
  start(){}
  stop(){ if (this.running) this.end(); }
}



/* --- 5) Reaction Time Game --- */
class ReactionTimeGame {
  static id = 'reaction';
  static name = 'Reaction Test';
  static icon = '⚡';
  static achievementRules = [{id:'react_200', type:'score', value:200, title:'Lightning Reflex', desc:'React under 200ms'}];
  constructor(container, hooks){
    this.container = container; this.hooks = hooks || {};
    this.el = document.createElement('div'); this.el.className='reaction-host'; this.container.appendChild(this.el);
    this.reset();
  }
  reset(){
    this.state = 'idle'; this.startAt = 0; this.best = null; this.render();
  }
  render(){
    this.// UNSAFE innerHTML replaced, build DOM manually
while(el.firstChild) el.removeChild(el.firstChild);
// Append nodes safely here instead of using innerHTML
    this.box = this.el.querySelector('#reaction-box');
    this.info = this.el.querySelector('#reaction-info');
    this.box.addEventListener('click', ()=> this.onClick());
  }
  onClick(){
    if (this.state === 'idle'){
      this.box.textContent = 'Wait for green...'; this.box.style.background = 'linear-gradient(90deg, #333, #222)'; this.state='waiting';
      const delay = 1000 + Math.random()*2500;
      this.timeout = setTimeout(()=>{ this.state='go'; this.startAt = performance.now(); this.box.textContent='CLICK!'; this.box.style.background='linear-gradient(90deg, #10b981, #059669)'; }, delay);
    } else if (this.state === 'waiting'){
      // too early
      clearTimeout(this.timeout); this.box.textContent='Too Soon!'; this.state='idle';
      setTimeout(()=> this.reset(), 800);
    } else if (this.state === 'go'){
      const delta = Math.round(performance.now() - this.startAt);
      this.best = this.best === null ? delta : Math.min(this.best, delta);
      this.info.textContent = 'Best: ' + this.best + ' ms';
      this.hooks.onEnd && this.hooks.onEnd(delta);
      // small sound
      playTone(delta < 300 ? 880 : 440, 0.06);
      // achievement check via GameManager
      GameManager.checkAchievements('reaction', delta, true);
      this.state='idle';
      setTimeout(()=> this.reset(), 900);
    }
  }
  start(){}
  stop(){ clearTimeout(this.timeout); }
}

/* --- 6) Math Quiz (timed) --- */
class MathQuizGame {
  static id='mathquiz';
  static name='Math Quiz';
  static icon='🧮';
  static achievementRules=[{id:'math_10', type:'score', value:10, title:'Quick Thinker', desc:'Answer 10 questions correctly'}];
  constructor(container, hooks){
    this.container = container; this.hooks = hooks || {};
    this.el = document.createElement('div'); this.el.className='math-host'; this.container.appendChild(this.el);
    this.reset();
  }
  reset(){
    this.score=0; this.total=0; this.timeLeft=30; this.current=null; this.timer=null; this.render();
  }
  render(){
    this.// UNSAFE innerHTML replaced, build DOM manually
while(el.firstChild) el.removeChild(el.firstChild);
// Append nodes safely here instead of using innerHTML
    this.qEl = this.el.querySelector('#mq-question');
    this.aEl = this.el.querySelector('#mq-answer');
    this.infoEl = this.el.querySelector('#mq-info');
    this.el.querySelector('#mq-submit').addEventListener('click', ()=> this.submit());
    this.el.querySelector('#mq-start').addEventListener('click', ()=> this.start());
    this.el.querySelector('#mq-reset').addEventListener('click', ()=> this.reset());
  }
  nextQuestion(){
    const a = U.rand(1,12), b = U.rand(1,12);
    this.current = {q:`${a} × ${b}`, ans: a*b};
    this.qEl.textContent = this.current.q;
  }
  submit(){
    const v = parseInt(this.aEl.value);
    if (isNaN(v)) return;
    this.total++;
    if (v === this.current.ans){ this.score++; playTone(880,0.05); if (this.hooks.onScore) this.hooks.onScore(this.score); }
    else playTone(220,0.06);
    this.aEl.value=''; this.nextQuestion();
    this.infoEl.textContent = `Score: ${this.score} • Time: ${this.timeLeft}s`;
    if (this.score >= 10){ this.hooks.onEnd && this.hooks.onEnd(this.score); GameManager.saveToLeaderboard('mathquiz', GameManager.username||'Guest', this.score); GameManager.checkAchievements('mathquiz', this.score, true); }
  }
  start(){
    if (this.timer) return;
    this.score=0; this.total=0; this.timeLeft=30; this.nextQuestion();
    this.timer = setInterval(()=>{
      this.timeLeft--; this.infoEl.textContent = `Score: ${this.score} • Time: ${this.timeLeft}s`;
      if (this.timeLeft<=0){ clearInterval(this.timer); this.timer=null; this.hooks.onEnd && this.hooks.onEnd(this.score); }
    },1000);
  }
  stop(){ clearInterval(this.timer); this.timer=null; }
}




/* Example: request rewarded ad before saving score (used by GameManager.promptSaveScore optionally) */
function requestRewardBeforeSave(callback){
  showRewardedAd(()=>{
    // simulate reward granted
    callback && callback();
  });
}




/* --- 7) Spin Wheel (prize) --- */
class SpinWheelGame {
  static id='spinwheel'; static name='Spin Wheel'; static icon='🎡';
  static achievementRules=[{id:'spin_first', type:'firstWin', title:'Lucky Spinner', desc:'Spin the wheel once'}];
  constructor(container, hooks){
    this.container = container; this.hooks = hooks||{};
    this.el = document.createElement('div'); this.el.className='spin-host'; this.container.appendChild(this.el);
    this.render();
  }
  render(){
    this.el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;gap:12px">
      <canvas id="spin-canvas" width="360" height="360" style="border-radius:180px"></canvas>
      <button id="spin-btn" class="btn">Spin</button>
      <div id="spin-result" style="min-height:28px;color:var(--muted)"></div>
    </div>`;
    this.canvas = this.el.querySelector('#spin-canvas'); this.ctx = this.canvas.getContext('2d');
    this.btn = this.el.querySelector('#spin-btn'); this.resultEl = this.el.querySelector('#spin-result');
    this.segments = ['10','20','30','40','50','100','2x','Lose'];
    this.btn.addEventListener('click', ()=> this.spin());
    this.drawWheel(0);
  }
  drawWheel(rot){
    const ctx = this.ctx; const w = this.canvas.width, h = this.canvas.height; const cx = w/2, cy = h/2;
    ctx.clearRect(0,0,w,h);
    const seg = this.segments.length; const angle = (Math.PI*2)/seg;
    for(let i=0;i<seg;i++){
      ctx.beginPath();
      ctx.moveTo(cx,cy);
      ctx.arc(cx,cy,160, i*angle + rot, (i+1)*angle + rot);
      ctx.closePath();
      ctx.fillStyle = (i%2===0) ? '#1f2937' : '#111827';
      ctx.fill();
      ctx.save();
      ctx.translate(cx,cy); ctx.rotate(i*angle + rot + angle/2);
      ctx.fillStyle = '#fff'; ctx.font='18px system-ui'; ctx.fillText(this.segments[i], 90, 6);
      ctx.restore();
    }
    // pointer
    ctx.fillStyle='#ef4444'; ctx.beginPath(); ctx.moveTo(cx,cy-170); ctx.lineTo(cx-10,cy-140); ctx.lineTo(cx+10,cy-140); ctx.fill();
  }
  spin(){
    if (this.spinning) return;
    this.spinning=true; const duration=3000; const start = performance.now(); const startRot = Math.random()*Math.PI*2; const spins = 6 + Math.floor(Math.random()*6);
    const total = spins * 2 * Math.PI + startRot;
    const step = (t)=>{
      const now = performance.now(); const p = Math.min(1,(now-start)/duration); const ease = 1 - Math.pow(1-p,3);
      const rot = startRot + ease*(total-startRot);
      this.drawWheel(rot);
      if (p<1) requestAnimationFrame(step); else { this.spinning=false; const finalAngle = (rot)%(2*Math.PI); const seg = this.segments.length; const idx = Math.floor(((2*Math.PI)-finalAngle)/(2*Math.PI) * seg) % seg; const prize = this.segments[idx]; this.resultEl.textContent = 'You got: '+prize; playTone(600,0.08); if (this.hooks.onScore) this.hooks.onScore(prize==='Lose'?0:parseInt(prize)||0); this.hooks.onEnd && this.hooks.onEnd(prize==='Lose'?0:parseInt(prize)||0); }
    };
    requestAnimationFrame(step);
  }
  start(){} stop(){}
}

/* --- 8) Guess Number (simple) --- */
class GuessNumberGame {
  static id='guessnum'; static name='Guess Number'; static icon='🔢';
  static achievementRules=[{id:'guess_1', type:'firstWin', title:'Lucky Guess', desc:'Guess the number correctly'}];
  constructor(container, hooks){
    this.container=container; this.hooks=hooks||{}; this.el=document.createElement('div'); this.container.appendChild(this.el); this.reset();
  }
  reset(){ this.target = U.rand(1,50); this.tries=0; this.render(); }
  render(){
    this.el.innerHTML = `<div style="display:flex;flex-direction:column;gap:10px;align-items:center">
      <div id="gn-info">Guess a number between 1 and 50</div>
      <input id="gn-input" placeholder="Enter number" style="padding:8px;border-radius:6px"/>
      <div style="display:flex;gap:8px"><button id="gn-submit" class="btn">Guess</button><button id="gn-reset" class="btn">Reset</button></div>
      <div id="gn-result" style="min-height:20px;color:var(--muted)"></div>
    </div>`;
    this.input = this.el.querySelector('#gn-input'); this.resultEl = this.el.querySelector('#gn-result');
    this.el.querySelector('#gn-submit').addEventListener('click', ()=> this.guess());
    this.el.querySelector('#gn-reset').addEventListener('click', ()=> this.reset());
  }
  guess(){
    const v = parseInt(this.input.value); if (isNaN(v)) return; this.tries++; if (v===this.target){ this.resultEl.textContent = 'Correct! Tries: '+this.tries; playTone(880,0.08); this.hooks.onEnd && this.hooks.onEnd(100 - this.tries); GameManager.saveToLeaderboard('guessnum', GameManager.username||'Guest', Math.max(1,100 - this.tries)); GameManager.checkAchievements('guessnum', 1, true); } else { this.resultEl.textContent = v < this.target ? 'Higher' : 'Lower'; playTone(220,0.06); } this.input.value=''; }
  start(){} stop(){}
}



/* Bind UI in GameManager.init for background music and firebase */
const _origInit = GameManager.init;
GameManager.init = function(){
  _origInit.apply(this, arguments);
  // music toggle
  const musicToggle = document.getElementById('bg-music-toggle');
  if (musicToggle){
    musicToggle.addEventListener('change', (e)=>{
      if (e.target.checked) startBackgroundMusic(); else stopBackgroundMusic();
    });
  }
  // firebase init button
  const fbBtn = document.getElementById('init-fb');
  if (fbBtn){
    fbBtn.addEventListener('click', ()=>{
      const panel = document.getElementById('fb-config-panel'); panel.style.display = panel.style.display==='none'?'block':'none';
    });
    const saveBtn = document.getElementById('fb-config-save');
    if (saveBtn){
      saveBtn.addEventListener('click', ()=>{
        try{
          const cfgText = document.getElementById('fb-config').value.trim();
          const cfg = JSON.parse(cfgText);
          initFirebase(cfg).then(ok=>{ if(ok) alert('Firebase initialized'); else alert('Firebase init failed. Check console.'); });
        }catch(e){ alert('Invalid JSON'); }
      });
    }
  }
};




/* -----------------------------
   Challenge Engine - dynamic challenge generator and autoplay
-------------------------------*/
class ChallengeEngine {
  constructor(gameManager){
    this.gm = gameManager;
    this.history = []; // recent challenge ids
    this.maxHistory = 8;
    this.pool = [];
    this.seed = Math.floor(Math.random()*1000000);
    this.autoPlaying = false;
    this.autoInterval = 60000; // 60s between auto challenges by default
    this.loadPool();
    this.bindUI();
  }

  async loadPool(){
    try {
      const res = await fetch('challenges.json', {cache:'no-store'});
      if (!res.ok) throw new Error('no challenges file');
      const data = await res.json();
      this.pool = data.templates || [];
      if (data.pool_seed) this.seed = data.pool_seed;
      this.updateBanner('Loaded ' + this.pool.length + ' challenge templates');
    } catch(e){
      // fallback: create some templates from registered games
      this.pool = Object.values(this.gm.games).map(g=>({id:'auto_'+g.id, game:g.id, title:'Play '+g.name, params:{}}));
      this.updateBanner('Using local auto templates');
    }
  }

  randChoice(arr){
    return arr[Math.floor(Math.random()*arr.length)];
  }

  pickChallenge(){
    if (!this.pool.length) return null;
    // try pick one not in recent history
    const candidates = this.pool.filter(c=> !this.history.includes(c.id));
    const chosen = (candidates.length ? this.randChoice(candidates) : this.randChoice(this.pool));
    // push to history
    this.history.push(chosen.id);
    if (this.history.length>this.maxHistory) this.history.shift();
    return chosen;
  }

  async playRandomChallenge(){
    const ch = this.pickChallenge();
    if (!ch) return;
    this.updateBanner(`Challenge: ${ch.title} — ${ch.description||''}`);
    // apply dynamic params: e.g., randomize pairs or time if not provided
    const params = Object.assign({}, ch.params || {});
    if (this.gm.games[ch.game]){
      // tweak params per game type for variety
      if (ch.game==='memory' && !params.pairs) params.pairs = 4 + Math.floor(Math.random()*6);
      if (ch.game==='snake' && !params.speed) params.speed = 6 + Math.floor(Math.random()*6);
      if (ch.game==='mathquiz' && !params.time) params.time = 20 + Math.floor(Math.random()*20);
      if (ch.game==='reaction' && !params.threshold) params.threshold = 250;
      if (ch.game==='gully' && !params.duration) params.duration = 15000;
      // start game with params — some games support custom params via constructor or instance methods
      this.startGameWithParams(ch.game, params);
    } else {
      this.updateBanner('Game not available: ' + ch.game);
    }
  }

  startGameWithParams(gameId, params){
    // Certain games support runtime parameterization via exposed props on their constructor
    // We'll open the game modal then apply params if the instance supports it.
    this.gm.openGame(gameId);
    const inst = this.gm.current && this.gm.current.instance;
    if (!inst) return;
    // apply common params if possible
    try{
      if (gameId==='memory' && params.pairs && inst.pairs!==undefined){ inst.pairs = params.pairs; inst.loadCards(); inst.render(); }
      if (gameId==='snake' && params.speed && inst.speed!==undefined){ inst.speed = Math.max(3, params.speed); }
      if (gameId==='mathquiz' && params.time && inst.timeLeft!==undefined){ inst.timeLeft = params.time; inst.infoEl && (inst.infoEl.textContent = `Score: ${inst.score} • Time: ${inst.timeLeft}s`); }
      if (gameId==='reaction' && params.threshold){ inst.threshold = params.threshold; }
      if (gameId==='gully' && params.duration){ clearTimeout(inst.endTimer); inst.endTimer = setTimeout(()=> inst.end(), params.duration); }
      // announce parameters
      this.updateBanner(`Started ${this.gm.games[gameId].name} — params: ${JSON.stringify(params)}`);
    }catch(e){ console.warn('apply params failed', e); }
  }

  bindUI(){
    const playBtn = document.getElementById('play-random-challenge');
    if (playBtn) playBtn.addEventListener('click', ()=> this.playRandomChallenge());
    const autoToggle = document.getElementById('auto-play-toggle');
    if (autoToggle) autoToggle.addEventListener('change', (e)=> this.setAuto(e.target.checked));
    const histBtn = document.getElementById('view-challenge-history');
    if (histBtn) histBtn.addEventListener('click', ()=> alert('Recent challenges:\\n' + (this.history.length? this.history.join('\\n') : 'None')));
  }

  setAuto(enabled){
    this.autoPlaying = enabled;
    if (enabled){
      this.updateBanner('Auto-play enabled — new challenges every ' + (this.autoInterval/1000) + 's');
      this.autoHandle = setInterval(()=> this.playRandomChallenge(), this.autoInterval);
    } else {
      clearInterval(this.autoHandle);
      this.updateBanner('Auto-play paused');
    }
  }

  updateBanner(txt){
    const el = document.getElementById('challenge-banner');
    if (el) el.textContent = txt;
    console.log('[ChallengeEngine]', txt);
  }
}


/* Boot */
document.addEventListener('DOMContentLoaded', ()=> GameManager.init());
