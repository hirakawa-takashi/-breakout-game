(() => {
  'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  const ui = {
    score: document.getElementById('score'),
    lives: document.getElementById('lives'),
    level: document.getElementById('level'),
    hiscore: document.getElementById('hiscore'),
  };

  const HISCORE_KEY = 'breakout.hiscore';
  const PADDLE = { w: 140, h: 14, speed: 520, minW: 60 };
  const BALL = { r: 7, baseSpeed: 240, maxSpeed: 620 };
  const BRICK = { rows: 6, cols: 10, h: 20, gap: 4, top: 60, side: 20 };

  // difficulty ramps from a gentle level 1 to full strength around level 4
  const rowsForLevel = (lv) => Math.min(BRICK.rows, 3 + lv);
  const speedForLevel = (lv) => Math.min(BALL.baseSpeed + (lv - 1) * 40, BALL.maxSpeed);
  const paddleWidthForLevel = (lv) => Math.max(PADDLE.minW, PADDLE.w - (lv - 1) * 12);
  const toughRowsForLevel = (lv) => Math.max(0, Math.min(lv - 2, 3));
  const paddleBoostForLevel = (lv) => (lv === 1 ? 1 : 1.02);
  const ROW_COLORS = ['#ff5f6d', '#ffa15c', '#ffd85c', '#7bff8a', '#5cc8ff', '#b28cff'];

  const State = { READY: 0, PLAYING: 1, PAUSED: 2, LEVEL_CLEAR: 3, GAME_OVER: 4 };

  let state = State.READY;
  let score = 0;
  let lives = 3;
  let level = 1;
  let hiscore = Number(localStorage.getItem(HISCORE_KEY)) || 0;
  let bricks = [];
  let paddle = { x: (W - PADDLE.w) / 2, y: H - 40, w: PADDLE.w, h: PADDLE.h };
  let ball = { x: W / 2, y: 0, vx: 0, vy: 0, r: BALL.r };
  let particles = [];
  let stateTimer = 0;

  const keys = { left: false, right: false };
  let pointerX = null;

  // ---------- sound (Web Audio, no external files) ----------
  const MUTE_KEY = 'breakout.muted';
  let audioCtx = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  }

  function tone({ freq, endFreq = freq, type = 'square', duration = 0.08, volume = 0.15, delay = 0 }) {
    if (muted) return;
    const ac = ensureAudio();
    if (!ac) return;
    const t0 = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain).connect(ac.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }

  const sfx = {
    paddle: () => tone({ freq: 440, endFreq: 660, type: 'triangle', duration: 0.07 }),
    wall: () => tone({ freq: 220, type: 'triangle', duration: 0.04, volume: 0.08 }),
    brick: (row) => tone({ freq: 600 + row * 90, endFreq: 900 + row * 90, duration: 0.06 }),
    crack: () => tone({ freq: 300, endFreq: 200, type: 'sawtooth', duration: 0.06, volume: 0.1 }),
    launch: () => tone({ freq: 500, endFreq: 1000, type: 'sine', duration: 0.12 }),
    lose: () => tone({ freq: 300, endFreq: 80, type: 'sawtooth', duration: 0.4, volume: 0.2 }),
    levelClear: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'square', duration: 0.15, delay: i * 0.12 })),
    gameOver: () => [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sawtooth', duration: 0.25, delay: i * 0.2, volume: 0.18 })),
  };

  function toggleMute() {
    muted = !muted;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    if (!muted) sfx.paddle();
  }

  function updateHud() {
    ui.score.textContent = score;
    ui.lives.textContent = lives;
    ui.level.textContent = level;
    ui.hiscore.textContent = hiscore;
  }

  function buildBricks() {
    bricks = [];
    const bw = (W - BRICK.side * 2 - BRICK.gap * (BRICK.cols - 1)) / BRICK.cols;
    const rows = rowsForLevel(level);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < BRICK.cols; c++) {
        const hp = r < toughRowsForLevel(level) ? 2 : 1;
        bricks.push({
          x: BRICK.side + c * (bw + BRICK.gap),
          y: BRICK.top + r * (BRICK.h + BRICK.gap),
          w: bw,
          h: BRICK.h,
          hp,
          maxHp: hp,
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: (BRICK.rows - r) * 10,
          row: r,
        });
      }
    }
  }

  function resetBall() {
    ball.x = paddle.x + paddle.w / 2;
    ball.y = paddle.y - ball.r - 1;
    ball.vx = 0;
    ball.vy = 0;
  }

  function launchBall() {
    const speed = speedForLevel(level);
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function newGame() {
    score = 0;
    lives = 3;
    level = 1;
    paddle.w = paddleWidthForLevel(level);
    buildBricks();
    resetBall();
    updateHud();
    state = State.READY;
  }

  function nextLevel() {
    level++;
    paddle.w = paddleWidthForLevel(level);
    buildBricks();
    resetBall();
    updateHud();
    state = State.READY;
  }

  function loseLife() {
    lives--;
    updateHud();
    if (lives <= 0) {
      state = State.GAME_OVER;
      sfx.gameOver();
      if (score > hiscore) {
        hiscore = score;
        localStorage.setItem(HISCORE_KEY, String(hiscore));
        updateHud();
      }
    } else {
      sfx.lose();
      resetBall();
      state = State.READY;
    }
  }

  function spawnParticles(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 60 + Math.random() * 140;
      particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5, color });
    }
  }

  function start() {
    ensureAudio();
    if (state === State.READY) {
      launchBall();
      sfx.launch();
      state = State.PLAYING;
    } else if (state === State.GAME_OVER) {
      newGame();
    } else if (state === State.LEVEL_CLEAR) {
      nextLevel();
    } else if (state === State.PAUSED) {
      state = State.PLAYING;
    }
  }

  function togglePause() {
    if (state === State.PLAYING) state = State.PAUSED;
    else if (state === State.PAUSED) state = State.PLAYING;
  }

  // ---------- input ----------
  window.addEventListener('keydown', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = true;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = true;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); start(); }
    if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') togglePause();
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });
  window.addEventListener('keyup', (e) => {
    if (['ArrowLeft', 'a', 'A'].includes(e.key)) keys.left = false;
    if (['ArrowRight', 'd', 'D'].includes(e.key)) keys.right = false;
  });

  function canvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    return (clientX - rect.left) * (W / rect.width);
  }
  canvas.addEventListener('pointermove', (e) => { pointerX = canvasX(e.clientX); });
  canvas.addEventListener('pointerdown', (e) => { pointerX = canvasX(e.clientX); start(); });
  canvas.addEventListener('pointerleave', () => { pointerX = null; });

  // ---------- update ----------
  function update(dt) {
    stateTimer += dt;

    // paddle movement
    if (state === State.PLAYING || state === State.READY) {
      if (pointerX !== null) {
        paddle.x = pointerX - paddle.w / 2;
      } else {
        if (keys.left) paddle.x -= PADDLE.speed * dt;
        if (keys.right) paddle.x += PADDLE.speed * dt;
      }
      paddle.x = Math.max(0, Math.min(W - paddle.w, paddle.x));
    }

    if (state === State.READY) {
      ball.x = paddle.x + paddle.w / 2;
      ball.y = paddle.y - ball.r - 1;
    }

    if (state === State.PLAYING) {
      ball.x += ball.vx * dt;
      ball.y += ball.vy * dt;

      // walls
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); sfx.wall(); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); sfx.wall(); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); sfx.wall(); }

      // paddle
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
        const speed = Math.min(Math.hypot(ball.vx, ball.vy) * paddleBoostForLevel(level), BALL.maxSpeed);
        const angle = -Math.PI / 2 + hit * (Math.PI / 3);
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = paddle.y - ball.r;
        sfx.paddle();
      }

      // bricks
      for (const b of bricks) {
        if (b.hp <= 0) continue;
        if (ball.x + ball.r < b.x || ball.x - ball.r > b.x + b.w ||
            ball.y + ball.r < b.y || ball.y - ball.r > b.y + b.h) continue;

        const overlapX = Math.min(ball.x + ball.r - b.x, b.x + b.w - (ball.x - ball.r));
        const overlapY = Math.min(ball.y + ball.r - b.y, b.y + b.h - (ball.y - ball.r));
        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
          ball.x += ball.vx > 0 ? overlapX : -overlapX;
        } else {
          ball.vy = -ball.vy;
          ball.y += ball.vy > 0 ? overlapY : -overlapY;
        }
        b.hp--;
        if (b.hp <= 0) {
          score += b.points;
          spawnParticles(b.x + b.w / 2, b.y + b.h / 2, b.color);
          sfx.brick(BRICK.rows - b.row);
        } else {
          score += 5;
          sfx.crack();
        }
        updateHud();
        break;
      }

      if (bricks.every((b) => b.hp <= 0)) {
        state = State.LEVEL_CLEAR;
        stateTimer = 0;
        sfx.levelClear();
      }

      // bottom
      if (ball.y - ball.r > H) loseLife();
    }

    // particles
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
  }

  // ---------- render ----------
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawOverlay(title, sub) {
    ctx.fillStyle = 'rgba(8, 10, 24, 0.7)';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(title, W / 2, H / 2 - 10);
    ctx.font = '18px system-ui, sans-serif';
    ctx.fillStyle = '#b8c0ff';
    ctx.fillText(sub, W / 2, H / 2 + 30);
  }

  function render() {
    ctx.clearRect(0, 0, W, H);

    for (const b of bricks) {
      if (b.hp <= 0) continue;
      ctx.fillStyle = b.color;
      ctx.globalAlpha = b.hp < b.maxHp ? 0.55 : 1;
      roundRect(b.x, b.y, b.w, b.h, 4);
      ctx.fill();
      if (b.maxHp > 1 && b.hp === b.maxHp) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#e8ecff';
    ctx.shadowColor = '#7f9dff';
    ctx.shadowBlur = 12;
    roundRect(paddle.x, paddle.y, paddle.w, paddle.h, 7);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowBlur = 0;

    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 0.5);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;

    if (state === State.READY) drawOverlay(level === 1 && score === 0 ? 'ブロック崩し' : `LEVEL ${level}`, 'Space / クリックで開始');
    else if (state === State.PAUSED) drawOverlay('PAUSE', 'P で再開');
    else if (state === State.LEVEL_CLEAR) drawOverlay('LEVEL CLEAR!', 'Space / クリックで次のレベル');
    else if (state === State.GAME_OVER) drawOverlay('GAME OVER', `SCORE ${score}  —  Space / クリックでリトライ`);

    ctx.textAlign = 'right';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(184,192,255,0.7)';
    ctx.fillText(muted ? '🔇 M: サウンドON' : '🔊 M: サウンドOFF', W - 10, H - 10);
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    update(dt);
    render();
    requestAnimationFrame(frame);
  }

  newGame();
  requestAnimationFrame(frame);
})();
