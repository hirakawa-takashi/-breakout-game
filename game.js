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
  const PADDLE = { w: 100, h: 14, speed: 520, minW: 60 };
  const BALL = { r: 7, baseSpeed: 320, maxSpeed: 620 };
  const BRICK = { rows: 6, cols: 10, h: 20, gap: 4, top: 60, side: 20 };
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

  function updateHud() {
    ui.score.textContent = score;
    ui.lives.textContent = lives;
    ui.level.textContent = level;
    ui.hiscore.textContent = hiscore;
  }

  function buildBricks() {
    bricks = [];
    const bw = (W - BRICK.side * 2 - BRICK.gap * (BRICK.cols - 1)) / BRICK.cols;
    for (let r = 0; r < BRICK.rows; r++) {
      for (let c = 0; c < BRICK.cols; c++) {
        // higher levels add tougher bricks in upper rows
        const hp = r < Math.min(level - 1, 3) ? 2 : 1;
        bricks.push({
          x: BRICK.side + c * (bw + BRICK.gap),
          y: BRICK.top + r * (BRICK.h + BRICK.gap),
          w: bw,
          h: BRICK.h,
          hp,
          maxHp: hp,
          color: ROW_COLORS[r % ROW_COLORS.length],
          points: (BRICK.rows - r) * 10,
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
    const speed = Math.min(BALL.baseSpeed + (level - 1) * 30, BALL.maxSpeed);
    const angle = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 3);
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed;
  }

  function newGame() {
    score = 0;
    lives = 3;
    level = 1;
    paddle.w = PADDLE.w;
    buildBricks();
    resetBall();
    updateHud();
    state = State.READY;
  }

  function nextLevel() {
    level++;
    paddle.w = Math.max(PADDLE.minW, PADDLE.w - 8);
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
      if (score > hiscore) {
        hiscore = score;
        localStorage.setItem(HISCORE_KEY, String(hiscore));
        updateHud();
      }
    } else {
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
    if (state === State.READY) {
      launchBall();
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
      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); }
      if (ball.x + ball.r > W) { ball.x = W - ball.r; ball.vx = -Math.abs(ball.vx); }
      if (ball.y - ball.r < 0) { ball.y = ball.r; ball.vy = Math.abs(ball.vy); }

      // paddle
      if (ball.vy > 0 &&
          ball.y + ball.r >= paddle.y && ball.y - ball.r <= paddle.y + paddle.h &&
          ball.x >= paddle.x - ball.r && ball.x <= paddle.x + paddle.w + ball.r) {
        const hit = (ball.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2); // -1..1
        const speed = Math.min(Math.hypot(ball.vx, ball.vy) * 1.02, BALL.maxSpeed);
        const angle = -Math.PI / 2 + hit * (Math.PI / 3);
        ball.vx = Math.cos(angle) * speed;
        ball.vy = Math.sin(angle) * speed;
        ball.y = paddle.y - ball.r;
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
        } else {
          score += 5;
        }
        updateHud();
        break;
      }

      if (bricks.every((b) => b.hp <= 0)) {
        state = State.LEVEL_CLEAR;
        stateTimer = 0;
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
