/**
 * Western Shooter — Mobile Game
 * Pure HTML5 Canvas + Vanilla JavaScript
 * Responsive design: scales to fill any screen (portrait or landscape).
 *
 * Controls (touch): tap an enemy to shoot it; tap RELOAD (or tap when empty) to reload.
 * Controls (mouse):  click to shoot / reload (desktop fallback).
 */
'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const W = 480;
const H = 720;
const MAX_BULLETS = 6;
const RELOAD_TIME = 2.0;   // seconds
const MAX_LIVES   = 3;

// OTS Gun — Colt Peacemaker proportions
const GUN_ARM_LEN          = 140;   // sleeve length: pivot → grip (px)
const GUN_BARREL_LEN       = 82;    // barrel extension beyond grip (px)
const GUN_MIN_ANGLE        = -Math.PI + 0.15; // leftmost aim angle (rad)
const GUN_MAX_ANGLE        = -0.18;           // rightmost aim angle (rad)
const RECOIL_DURATION      = 0.20;  // seconds for full recoil cycle
const RECOIL_MAX_DIST      = 22;    // max backward shift during recoil (px)
const RECOIL_MAX_ANGLE     = 0.08;  // max upward angular kick during recoil (rad)
const CYLINDER_ROT_SPEED   = 0.35;  // cylinder idle rotation speed (rad/s)

// Bar-door position (enemies enter from here)
const DOOR_CX = 412;
const DOOR_CY  = 318;
const DOOR_W   = 76;
const DOOR_H   = 155;

// Cover slots (barrels & tables enemies hide behind)
// x,y = centre; w,h = full extent of the object
const COVERS = [
  { id: 0, x:  78, y: 410, w: 90,  h: 112, type: 'barrel' },
  { id: 1, x: 200, y: 405, w: 134, h:  92, type: 'table'  },
  { id: 2, x: 308, y: 405, w: 134, h:  92, type: 'table'  },
  { id: 3, x: 420, y: 410, w: 90,  h: 112, type: 'barrel' },
];

// Enemy outfit colour variants
const OUTFITS = [
  { shirt: '#4A3728', pants: '#3A2318', hat: '#2C1810', band: '#8B0000' },
  { shirt: '#1E3A1E', pants: '#132213', hat: '#0E1A0E', band: '#DAA520' },
  { shirt: '#3D1A1A', pants: '#2B1010', hat: '#1C0A0A', band: '#4169E1' },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function rand(min, max) { return min + Math.random() * (max - min); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function inRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
function drawRoundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function drawButton(ctx, cx, cy, bw, bh, text) {
  const x = cx - bw / 2, y = cy - bh / 2;
  ctx.fillStyle = '#6B2A00';
  drawRoundRect(ctx, x + 2, y + 4, bw, bh, 10);
  ctx.fill();
  ctx.fillStyle = '#A04010';
  drawRoundRect(ctx, x, y, bw, bh, 10);
  ctx.fill();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  drawRoundRect(ctx, x, y, bw, bh, 10);
  ctx.stroke();
  ctx.fillStyle = '#FFD700';
  ctx.font = 'bold 22px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, cx, cy + 1);
  ctx.textBaseline = 'alphabetic';
}

// Return the tappable hitbox for a visible enemy
function enemyHitbox(e) {
  return { x: e.drawX - 30, y: e.drawY - 68, w: 60, h: 95 };
}

// ─── GAME CLASS ───────────────────────────────────────────────────────────────
class WesternShooter {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.scale  = 1;
    this.ox = 0; this.oy = 0;

    // Game state
    this.state    = 'intro'; // 'intro' | 'playing' | 'gameover'
    this.score    = 0;
    // Restore best score from Local Storage so it survives app restarts on Android
    this.bestScore = parseInt(localStorage.getItem('westernShooterBest') || '0', 10);
    this.lives    = MAX_LIVES;
    this.bullets  = MAX_BULLETS;
    this.reloading    = false;
    this.reloadTimer  = 0;
    this.wave          = 1;
    this.waveSpawned   = 0;
    this.waveKills     = 0;
    this.waveEnemies   = 5;
    this.spawnTimer    = 2;
    this.spawnInterval = 3;

    // Entities / FX
    this.enemies   = [];
    this.particles = [];

    // Misc
    this.doorSwing   = 0;  // 0→1 drive for swing animation
    this.hitFlash    = 0;  // player-hit screen red
    this.waveBanner  = 0;  // countdown for "WAVE N" splash
    this.lastT       = 0;
    this.time        = 0;  // total elapsed seconds — frame-rate-independent animations

    // Aim tracking & OTS gun
    this.aimX    = W * 0.4;
    this.aimY    = H * 0.3;
    this.recoilT = 0;
    this.muzzleX = W / 2;
    this.muzzleY = H - 140;

    // Atmospheric dust motes
    this.dustMotes = Array.from({ length: 20 }, () => ({
      x: rand(0, W), y: rand(20, H * 0.8),
      r: rand(0.8, 2.0),
      speed: rand(0.3, 0.8),
      drift: rand(-0.4, 0.4),
      alpha: rand(0.04, 0.13),
    }));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupInput();
    requestAnimationFrame(t => this.loop(t));
  }

  // ── Sizing ────────────────────────────────────────────────────────────────
  resize() {
    const cw = window.innerWidth, ch = window.innerHeight;
    this.scale = Math.min(cw / W, ch / H);
    this.ox = (cw - W * this.scale) / 2;
    this.oy = (ch - H * this.scale) / 2;
    this.canvas.width  = cw;
    this.canvas.height = ch;
  }
  toGame(cx, cy) {
    return { x: (cx - this.ox) / this.scale, y: (cy - this.oy) / this.scale };
  }

  // ── Input ─────────────────────────────────────────────────────────────────
  setupInput() {
    const handle = (cx, cy, isTap) => {
      const p = this.toGame(cx, cy);
      this.aimX = p.x;
      this.aimY = p.y;
      if (isTap) this.onTap(p.x, p.y);
    };

    // Touch events — use the first changed touch for single-tap gameplay.
    // passive: false is required so we can call e.preventDefault() and stop
    // the WebView from triggering scroll / zoom behaviours during gameplay.
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      handle(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
    }, { passive: false });
    // Track aim on touchmove AND prevent WebView scroll/zoom gestures
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      handle(e.changedTouches[0].clientX, e.changedTouches[0].clientY, false);
    }, { passive: false });

    // Prevent touchend from triggering WebView gestures
    this.canvas.addEventListener('touchend', e => {
      e.preventDefault();
    }, { passive: false });

    // Mouse events for desktop browsers / Android emulator
    this.canvas.addEventListener('mousedown', e => handle(e.clientX, e.clientY, true));
    this.canvas.addEventListener('mousemove', e => handle(e.clientX, e.clientY, false));
  }

  onTap(x, y) {
    if (this.state === 'intro') {
      if (inRect(x, y, W / 2 - 125, H / 2 + 90, 250, 56)) this.startGame();
      return;
    }
    if (this.state === 'gameover') {
      if (inRect(x, y, W / 2 - 110, H * 0.67, 220, 56)) this.startGame();
      return;
    }
    if (this.state !== 'playing') return;

    // RELOAD button (bottom-right)
    if (inRect(x, y, W - 118, H - 70, 108, 34)) {
      this.triggerReload();
      return;
    }
    // Shoot (or reload if empty)
    if (this.reloading || this.bullets <= 0) {
      this.triggerReload();
    } else {
      this.fireAt(x, y);
    }
  }

  // ── Game lifecycle ────────────────────────────────────────────────────────
  startGame() {
    this.state         = 'playing';
    this.score         = 0;
    this.lives         = MAX_LIVES;
    this.bullets       = MAX_BULLETS;
    this.reloading     = false;
    this.reloadTimer   = 0;
    this.wave          = 1;
    this.waveSpawned   = 0;
    this.waveKills     = 0;
    this.waveEnemies   = 5;
    this.spawnTimer    = 2;
    this.spawnInterval = 3;
    this.enemies       = [];
    this.particles     = [];
    this.doorSwing     = 0;
    this.hitFlash      = 0;
    this.waveBanner    = 0;
    this.recoilT       = 0;
  }

  triggerReload() {
    if (this.reloading || this.bullets === MAX_BULLETS) return;
    this.reloading   = true;
    this.reloadTimer = RELOAD_TIME;
  }

  fireAt(x, y) {
    this.bullets--;
    this.recoilT = RECOIL_DURATION;
    // Muzzle-flash particle at calculated barrel tip
    this.particles.push({ type: 'flash', x: this.muzzleX, y: this.muzzleY, t: 0.14 });

    let hit = false;
    for (const e of this.enemies) {
      if (!e.visible) continue;
      const hb = enemyHitbox(e);
      if (inRect(x, y, hb.x, hb.y, hb.w, hb.h)) {
        this.damageEnemy(e);
        hit = true;
        break;
      }
    }
    if (!hit) {
      // Bullet-hole decal at tap position
      this.particles.push({ type: 'hole', x, y, t: 7 });
    }
    if (this.bullets === 0) {
      setTimeout(() => this.triggerReload(), 350);
    }
  }

  damageEnemy(e) {
    e.hp--;
    const hb = enemyHitbox(e);
    const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        type: 'blood', x: cx, y: cy,
        vx: rand(-2.5, 2.5), vy: rand(-3.5, -0.5),
        t: rand(0.35, 0.7),
      });
    }
    this.particles.push({ type: 'hit', x: cx, y: cy, t: 0.22 });

    if (e.hp <= 0) {
      e.state   = 'dead';
      e.visible = true;
      e.deadT   = 0.75;
      this.score += 100 * this.wave;
      this.waveKills++;
      if (this.waveKills >= this.waveEnemies) {
        setTimeout(() => this.advanceWave(), 2000);
      }
    } else {
      // Enemy retreats then comes back later
      e.state     = 'retreating';
      e.retreatT  = 0.45;
      setTimeout(() => {
        if (e.state !== 'dead') {
          e.state   = 'hiding';
          e.hideT   = rand(1, 2.5);
          e.visible = false;
        }
      }, 460);
    }
  }

  enemyShoot(e) {
    if (e.state === 'dead') return;
    e.state  = 'shooting';
    e.shootT = 0.4;
    // Enemy muzzle-flash
    this.particles.push({ type: 'eflash', x: e.drawX - 24, y: e.drawY + 8, t: 0.14 });
    setTimeout(() => { if (e.state !== 'dead') this.takeDamage(); }, 260);
    setTimeout(() => {
      if (e.state !== 'dead') {
        e.state   = 'hiding';
        e.hideT   = rand(0.9, 2);
        e.visible = false;
      }
    }, 720);
  }

  takeDamage() {
    if (this.state !== 'playing') return;
    this.lives    = Math.max(0, this.lives - 1);
    this.hitFlash = 0.55;
    if (this.lives === 0) {
      this.bestScore = Math.max(this.bestScore, this.score);
      // Persist the best score so it survives app restarts on Android
      try { localStorage.setItem('westernShooterBest', String(this.bestScore)); } catch (e) { console.warn('Could not save best score:', e); }
      setTimeout(() => { this.state = 'gameover'; }, 550);
    }
  }

  advanceWave() {
    if (this.state !== 'playing') return;
    this.wave++;
    this.waveSpawned   = 0;
    this.waveKills     = 0;
    this.waveEnemies   = 5 + this.wave * 2;
    this.spawnInterval = Math.max(1.1, 3 - this.wave * 0.22);
    this.spawnTimer    = 1.8;
    this.waveBanner    = 2.6;
    this.enemies       = [];
  }

  spawnEnemy() {
    const usedIds = new Set(
      this.enemies.filter(e => e.state !== 'dead').map(e => e.coverId)
    );
    const free = COVERS.filter(c => !usedIds.has(c.id));
    if (!free.length) return;
    const cover = free[Math.floor(Math.random() * free.length)];

    // peekY = body-centre when fully peeked above the cover top
    const coverTop = cover.y - cover.h / 2;
    const peekY    = coverTop - 28;

    this.enemies.push({
      coverId:   cover.id,
      cover,
      hp: this.wave >= 3 ? 2 : 1,
      maxHp: this.wave >= 3 ? 2 : 1,
      outfit: Math.floor(Math.random() * OUTFITS.length),
      state:     'entering',
      visible:   true,
      drawX:     DOOR_CX,  // starts at door
      drawY:     peekY,
      peekY,
      walkFrame: 0,
      walkT:     0,
      // timers
      hideT:    0, warnT: 0, peekT: 0,
      retreatT: 0, deadT: 0, shootT: 0,
    });
    this.waveSpawned++;
    this.doorSwing = 1;
  }

  // ── Update ────────────────────────────────────────────────────────────────
  loop(t) {
    const dt = Math.min((t - this.lastT) / 1000, 0.05);
    this.lastT = t;
    this.update(dt);
    this.render();
    requestAnimationFrame(ts => this.loop(ts));
  }

  update(dt) {
    if (this.state !== 'playing') return;
    this.time += dt;

    // Door-swing decay
    if (this.doorSwing > 0) this.doorSwing = Math.max(0, this.doorSwing - dt * 1.5);

    // Red hit overlay decay
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);

    // Wave-banner countdown
    if (this.waveBanner > 0) this.waveBanner -= dt;

    // Reload
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        this.reloading   = false;
        this.reloadTimer = 0;
        this.bullets     = MAX_BULLETS;
      }
    }

    // Gun recoil decay
    if (this.recoilT > 0) this.recoilT = Math.max(0, this.recoilT - dt);

    // Animate floating dust motes
    for (const d of this.dustMotes) {
      d.x += d.drift * dt * 25;
      d.y -= d.speed * dt * 15;
      if (d.y < -5) {
        d.y = H * 0.8 + rand(0, 50);
        d.x = rand(0, W);
      }
      if (d.x < 0) d.x = W;
      if (d.x > W) d.x = 0;
    }

    // Spawn logic
    const active = this.enemies.filter(e => e.state !== 'dead').length;
    const maxActive = clamp(2 + Math.floor(this.wave * 0.6), 1, 4);
    if (active < maxActive && this.waveSpawned < this.waveEnemies) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnTimer = this.spawnInterval + rand(0, 0.8);
        this.spawnEnemy();
      }
    }

    // Update each enemy
    this.enemies.forEach(e => this.updateEnemy(e, dt));
    this.enemies = this.enemies.filter(e => !(e.state === 'dead' && e.deadT <= 0));

    // Update particles
    this.particles.forEach(p => {
      p.t -= dt;
      if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; }
    });
    this.particles = this.particles.filter(p => p.t > 0);
  }

  updateEnemy(e, dt) {
    const spd = (115 + this.wave * 12) * dt;
    switch (e.state) {

      case 'entering': {
        // Walk animation
        e.walkT += dt;
        if (e.walkT > 0.14) { e.walkT = 0; e.walkFrame ^= 1; }
        const dx = e.cover.x - e.drawX;
        if (Math.abs(dx) <= spd) {
          e.drawX   = e.cover.x;
          e.state   = 'hiding';
          e.hideT   = rand(0.4, 1.2);
          e.visible = false;
        } else {
          e.drawX += Math.sign(dx) * spd;
        }
        break;
      }

      case 'hiding':
        e.hideT -= dt;
        if (e.hideT <= 0) {
          e.state   = 'warning';
          e.warnT   = rand(0.45, 0.85);
          e.visible = true;
          e.drawY   = e.peekY + 30; // barely visible
        }
        break;

      case 'warning':
        e.warnT -= dt;
        // Slight bob — just the hat peak showing
        e.drawY = e.peekY + 28 + Math.sin(this.time * 13.3) * 5;
        if (e.warnT <= 0) {
          e.state = 'peeking';
          e.peekT = rand(0.85, 1.5);
          e.drawY = e.peekY;
        }
        break;

      case 'peeking':
        e.peekT -= dt;
        if (e.peekT <= 0) this.enemyShoot(e);
        break;

      case 'shooting':
        e.shootT -= dt;
        break;

      case 'retreating':
        e.retreatT -= dt;
        e.drawY = e.peekY + (1 - clamp(e.retreatT / 0.45, 0, 1)) * 35;
        break;

      case 'dead':
        e.deadT -= dt;
        e.drawY  += dt * 55;
        break;
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);

    switch (this.state) {
      case 'intro':    this.drawIntro(ctx);    break;
      case 'playing':  this.drawGame(ctx);     break;
      case 'gameover': this.drawGameOver(ctx); break;
    }
    ctx.restore();
  }

  // ── Screens ───────────────────────────────────────────────────────────────
  drawIntro(ctx) {
    this.drawScene(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.74)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 60px Georgia, serif';
    ctx.strokeStyle = '#3D1F00';
    ctx.lineWidth   = 5;
    ctx.strokeText('WESTERN', W / 2, H / 2 - 88);
    ctx.strokeText('SHOOTER', W / 2, H / 2 - 20);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('WESTERN', W / 2, H / 2 - 88);
    ctx.fillText('SHOOTER', W / 2, H / 2 - 20);

    ctx.font = '19px Georgia, serif';
    ctx.fillStyle = '#DEB887';
    ctx.fillText('Enter the bar — shoot the outlaws!', W / 2, H / 2 + 32);
    ctx.fillText('Tap enemies  •  6 bullets  •  Tap RELOAD', W / 2, H / 2 + 58);
    ctx.restore();

    drawButton(ctx, W / 2, H / 2 + 120, 252, 54, 'ENTER THE BAR');
  }

  drawGameOver(ctx) {
    this.drawScene(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.76)';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.strokeStyle = '#000';
    ctx.lineWidth   = 4;
    ctx.strokeText('GAME OVER', W / 2, H * 0.34);
    ctx.fillStyle = '#CC1111';
    ctx.fillText('GAME OVER', W / 2, H * 0.34);

    ctx.font = 'bold 30px Georgia, serif';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`Score: ${this.score}`, W / 2, H * 0.46);
    ctx.fillText(`Wave:  ${this.wave}`,  W / 2, H * 0.54);

    if (this.bestScore > 0) {
      ctx.font = '20px Georgia, serif';
      ctx.fillStyle = '#DEB887';
      ctx.fillText(`Best: ${this.bestScore}`, W / 2, H * 0.61);
    }
    ctx.restore();

    drawButton(ctx, W / 2, H * 0.71, 216, 54, 'PLAY AGAIN');
  }

  drawGame(ctx) {
    this.drawScene(ctx);

    // 1. Non-entering enemies drawn BEHIND cover objects (painter's algorithm)
    for (const e of this.enemies) {
      if (e.state !== 'entering' && e.visible) this.drawEnemy(ctx, e);
    }
    // 2. Cover objects drawn on top  → they visually occlude enemy lower bodies
    for (const c of COVERS) this.drawCover(ctx, c);

    // 3. Entering enemies drawn IN FRONT of cover (they're walking past furniture)
    for (const e of this.enemies) {
      if (e.state === 'entering') this.drawEnemy(ctx, e);
    }

    // 4. Player arm & revolver (OTS foreground — drawn under FX so flash appears on top)
    this.drawPlayerGun(ctx);

    // 5. Particles / FX
    this.drawParticles(ctx);

    // 6. Red screen flash when player takes damage
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(200,0,0,${this.hitFlash * 0.58})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 7. "WAVE N" banner
    if (this.waveBanner > 0 && this.waveBanner < 2.6) {
      const alpha = clamp(Math.min(this.waveBanner, 2.6 - this.waveBanner) * 1.6, 0, 1);
      ctx.save();
      ctx.globalAlpha  = alpha;
      ctx.textAlign    = 'center';
      ctx.font         = 'bold 48px Georgia, serif';
      ctx.strokeStyle  = '#000';
      ctx.lineWidth    = 4;
      ctx.strokeText(`WAVE ${this.wave}`, W / 2, H / 2 + 10);
      ctx.fillStyle    = '#FFD700';
      ctx.fillText(`WAVE ${this.wave}`, W / 2, H / 2 + 10);
      ctx.restore();
    }

    this.drawHUD(ctx);
  }

  // ── Scene background ──────────────────────────────────────────────────────
  drawScene(ctx) {
    // ── Wooden wall planks ──
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#7A5E22' : '#6B5018';
      ctx.fillRect(0, i * 52, W, 52);
      ctx.fillStyle = '#4A350E';
      ctx.fillRect(0, i * 52 + 50, W, 3);
    }

    // ── Wanted posters ──
    this.drawWanted(ctx,  48,  60);
    this.drawWanted(ctx, 192,  44);
    this.drawWanted(ctx, 336,  68);

    // ── Bar counter (back of room) ──
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 300, W, 64);
    ctx.fillStyle = '#A0562A';
    ctx.fillRect(0, 300, W, 10); // top highlight
    ctx.fillStyle = '#5C2E08';
    ctx.fillRect(0, 357, W, 7);  // shadow

    // Shelf above counter
    ctx.fillStyle = '#6B3A10';
    ctx.fillRect(0, 278, W, 24);

    // Bottles on shelf
    this.drawBottles(ctx, 284);

    // ── Door ──
    this.drawDoor(ctx);

    // ── Floor ──
    for (let i = 0; i < 10; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#7A3E1A' : '#6B3415';
      ctx.fillRect(0, 490 + i * 24, W, 24);
      ctx.fillStyle = '#4A2410';
      ctx.fillRect(0, 490 + i * 24 + 22, W, 2);
    }

    // ── Chandelier ──
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, 38); ctx.stroke();
    // Chain links
    for (let j = 0; j < 3; j++) {
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(W / 2, 10 + j * 10, 4, 6, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = '#DAA520';
    ctx.beginPath(); ctx.arc(W / 2, 42, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#B8860B';
    ctx.beginPath(); ctx.arc(W / 2, 42, 14, 0, Math.PI * 2); ctx.fill();
    // Flames
    for (let j = -2; j <= 2; j++) {
      ctx.fillStyle = '#FF8C00';
      ctx.beginPath(); ctx.arc(W / 2 + j * 11, 31, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(W / 2 + j * 11, 28, 2.5, 0, Math.PI * 2); ctx.fill();
    }

    // ── Warm light cone from chandelier ──
    const lcg = ctx.createRadialGradient(W / 2, 42, 0, W / 2, 42, 360);
    lcg.addColorStop(0,    'rgba(255,210,100,0.22)');
    lcg.addColorStop(0.45, 'rgba(255,170,50,0.07)');
    lcg.addColorStop(1,    'rgba(0,0,0,0)');
    ctx.fillStyle = lcg;
    ctx.fillRect(0, 0, W, H);

    // ── Vignette (dark edges for cinematic depth) ──
    const vig = ctx.createRadialGradient(W / 2, H * 0.44, H * 0.22, W / 2, H * 0.44, H * 0.82);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.65)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);

    // ── Floating dust motes ──
    ctx.save();
    for (const d of this.dustMotes) {
      ctx.globalAlpha = d.alpha;
      ctx.fillStyle = '#FFE0A0';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawWanted(ctx, x, y) {
    // Parchment
    ctx.fillStyle = '#DEB87A';
    ctx.fillRect(x, y, 62, 82);
    ctx.strokeStyle = '#7A4510';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 62, 82);
    // "WANTED" header
    ctx.fillStyle = '#8B0000';
    ctx.font = 'bold 9px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('WANTED', x + 31, y + 14);
    // Simple outlaw face
    ctx.fillStyle = '#C8A070';
    ctx.beginPath(); ctx.arc(x + 31, y + 38, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2C1810';
    ctx.fillRect(x + 17, y + 23, 28, 5);
    ctx.fillRect(x + 20, y + 16, 22, 10);
    ctx.fillStyle = '#8B0000';
    ctx.font = '6px Georgia, serif';
    ctx.fillText('DEAD OR ALIVE', x + 31, y + 72);
    ctx.textAlign = 'left';
  }

  drawBottles(ctx, shelfY) {
    const colors = ['#2E7B44', '#8B1A1A', '#DAA520', '#1A3A7A', '#6B3A6B'];
    const xs     = [22, 60, 100, 148, 192, 250, 295, 345, 390, 432];
    xs.forEach((bx, i) => {
      const col = colors[i % colors.length];
      ctx.fillStyle = col;
      ctx.fillRect(bx, shelfY + 4, 14, 28);   // body
      ctx.fillRect(bx + 4, shelfY - 2, 6, 8); // neck
      ctx.fillStyle = '#DEB887';
      ctx.fillRect(bx + 4, shelfY - 7, 6, 6); // cork
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(bx + 2, shelfY + 6, 4, 18);
    });
  }

  drawDoor(ctx) {
    const x = DOOR_CX - DOOR_W / 2 - 4;
    const y = DOOR_CY - DOOR_H / 2 - 4;
    const w = DOOR_W + 8, h = DOOR_H + 8;

    // Door frame
    ctx.fillStyle = '#4A2C08';
    ctx.fillRect(x, y, w, h);

    // "SALOON" sign above door
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 14px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('SALOON', DOOR_CX, y - 6);

    // Door background (opening)
    ctx.fillStyle = '#1A0A00';
    ctx.fillRect(DOOR_CX - DOOR_W / 2, DOOR_CY - DOOR_H / 2, DOOR_W, DOOR_H);

    // Swing panels (perspective skew via x-scale)
    const swingAmt = Math.sin(this.doorSwing * Math.PI) * 0.7;
    const halfW = DOOR_W / 2 - 2;
    ctx.save();
    ctx.translate(DOOR_CX, DOOR_CY);
    // Left panel
    ctx.save();
    ctx.scale(1 - swingAmt * 0.5, 1);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(-halfW - 1, -DOOR_H / 2, halfW, DOOR_H);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(-halfW - 1, -DOOR_H / 2, 4, DOOR_H);
    ctx.fillStyle = '#DAA520';
    ctx.beginPath(); ctx.arc(-6, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Right panel
    ctx.save();
    ctx.scale(1 - swingAmt * 0.5, 1);
    ctx.fillStyle = '#7A3E10';
    ctx.fillRect(2, -DOOR_H / 2, halfW, DOOR_H);
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.fillRect(halfW - 2, -DOOR_H / 2, 4, DOOR_H);
    ctx.fillStyle = '#DAA520';
    ctx.beginPath(); ctx.arc(6, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  drawCover(ctx, c) {
    if (c.type === 'barrel') this.drawBarrel(ctx, c.x, c.y, c.w, c.h);
    else                     this.drawTable(ctx,  c.x, c.y, c.w, c.h);
  }

  drawBarrel(ctx, cx, cy, w, h) {
    const rx = w / 2, ry = h / 2;
    // Body
    ctx.fillStyle = '#8B4513';
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); ctx.fill();
    // Wood grain rings
    ctx.strokeStyle = '#5C2E08';
    ctx.lineWidth = 4;
    [-0.4, 0, 0.4].forEach(offset => {
      ctx.beginPath();
      ctx.ellipse(cx, cy + offset * h * 0.35, rx - 6, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    // Highlight
    ctx.fillStyle = 'rgba(255,200,100,0.13)';
    ctx.beginPath(); ctx.ellipse(cx - rx * 0.3, cy - ry * 0.3, rx * 0.32, ry * 0.25, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  drawTable(ctx, cx, cy, w, h) {
    const x = cx - w / 2, y = cy - h / 2;
    const topH = h * 0.38;
    // Tabletop
    ctx.fillStyle = '#8B6914';
    ctx.fillRect(x, y, w, topH);
    ctx.fillStyle = '#A07820';
    ctx.fillRect(x, y, w, 5);
    // Legs
    ctx.fillStyle = '#6B4A10';
    [[x + 6, y + topH - 2, 13, h - topH + 2],
     [x + w - 19, y + topH - 2, 13, h - topH + 2]].forEach(([lx, ly, lw, lh]) => {
      ctx.fillRect(lx, ly, lw, lh);
    });
    // Items on table (glasses)
    ctx.fillStyle = 'rgba(180,220,255,0.55)';
    [[cx - 22, y + 12], [cx + 12, y + 11]].forEach(([gx, gy]) => {
      ctx.beginPath(); ctx.arc(gx, gy, 7, 0, Math.PI * 2); ctx.fill();
    });
  }

  // ── Enemy sprite ──────────────────────────────────────────────────────────
  drawEnemy(ctx, e) {
    if (!e.visible && e.state !== 'entering') return;
    const outfit = OUTFITS[e.outfit];
    const x = e.drawX, y = e.drawY;
    const isHit = e.state === 'retreating';

    ctx.save();
    if (isHit) ctx.globalAlpha = 0.7 + Math.sin(this.time * 20) * 0.3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.beginPath(); ctx.ellipse(x, y + 58, 22, 7, 0, 0, Math.PI * 2); ctx.fill();

    // Legs (only when walking in)
    if (e.state === 'entering') {
      const legOff = e.walkFrame === 0 ? 6 : -6;
      ctx.fillStyle = outfit.pants;
      ctx.fillRect(x - 10,        y + 27, 10, 30);
      ctx.fillRect(x + 1,         y + 27, 10, 30);
      ctx.fillStyle = '#1A0800';
      ctx.fillRect(x - 12 + legOff, y + 53, 13, 8);  // boots
      ctx.fillRect(x - 1 - legOff,  y + 53, 13, 8);
    }

    // Body
    ctx.fillStyle = outfit.shirt;
    ctx.fillRect(x - 14, y + 6, 28, 28);

    // Suspenders
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, y + 6); ctx.lineTo(x - 5, y + 34);
    ctx.moveTo(x + 8, y + 6); ctx.lineTo(x + 5, y + 34);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#C8844A';
    ctx.beginPath(); ctx.arc(x, y - 8, 15, 0, Math.PI * 2); ctx.fill();

    // Eyes
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(x - 5, y - 10, 2.5, 0, Math.PI * 2);
    ctx.arc(x + 5, y - 10, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Angry brows
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 9, y - 16); ctx.lineTo(x - 3, y - 13);
    ctx.moveTo(x + 3, y - 13); ctx.lineTo(x + 9, y - 16);
    ctx.stroke();

    // Moustache
    ctx.fillStyle = '#5C3010';
    ctx.beginPath(); ctx.ellipse(x - 5, y - 1, 5, 3, 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 5, y - 1, 5, 3, -0.3, 0, Math.PI * 2); ctx.fill();

    // Cowboy hat brim
    ctx.fillStyle = outfit.hat;
    ctx.fillRect(x - 23, y - 20, 46, 7);
    // Crown
    ctx.fillRect(x - 15, y - 42, 30, 24);
    // Hat band
    ctx.fillStyle = outfit.band;
    ctx.fillRect(x - 15, y - 22, 30, 5);

    // Gun (visible when peeking / warning / shooting)
    if (e.state === 'peeking' || e.state === 'warning' || e.state === 'shooting') {
      ctx.fillStyle = '#555';
      ctx.fillRect(x - 28, y + 12, 22, 7); // handle+cylinder
      ctx.fillStyle = '#333';
      ctx.fillRect(x - 38, y + 13, 12, 4); // barrel
    }

    // HP pips (for tanky enemies)
    if (e.maxHp > 1) {
      for (let i = 0; i < e.maxHp; i++) {
        ctx.beginPath(); ctx.arc(x - 8 + i * 16, y - 58, 5, 0, Math.PI * 2);
        ctx.fillStyle = i < e.hp ? '#FF3333' : '#444';
        ctx.fill();
      }
    }

    // Warning "!" indicator
    if (e.state === 'warning') {
      const pulse = 0.55 + Math.abs(Math.sin(this.time * 14.3)) * 0.45;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.font = 'bold 24px Georgia, serif';
      ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center';
      ctx.fillText('!', x, y - 64);
      ctx.restore();
    }

    ctx.restore();
  }

  // ── Player OTS Gun (Over-the-shoulder Colt Peacemaker) ─────────────────────
  drawPlayerGun(ctx) {
    if (this.state !== 'playing') return;

    // Pivot: bottom-right corner, partly off-screen
    const pivotX = W - 5;
    const pivotY = H + 15;

    // Aim angle from pivot toward crosshair
    const dx = this.aimX - pivotX;
    const dy = this.aimY - pivotY;
    let angle = Math.atan2(dy, dx);
    angle = clamp(angle, GUN_MIN_ANGLE, GUN_MAX_ANGLE);

    // Recoil: smooth sin-curve kick
    const recoilFrac = this.recoilT > 0
      ? Math.sin((1 - this.recoilT / RECOIL_DURATION) * Math.PI)
      : 0;
    const recoilOff  = recoilFrac * RECOIL_MAX_DIST;
    const recoilKick = recoilFrac * RECOIL_MAX_ANGLE;

    const armLen    = GUN_ARM_LEN;
    const barrelLen = GUN_BARREL_LEN;
    const totalLen  = armLen + barrelLen - recoilOff;

    const effAngle = angle - recoilKick;
    this.muzzleX = pivotX + Math.cos(effAngle) * totalLen;
    this.muzzleY = pivotY + Math.sin(effAngle) * totalLen;

    ctx.save();
    ctx.translate(pivotX, pivotY);
    ctx.rotate(effAngle);

    const ro = recoilOff; // shorthand

    // ── Leather duster coat sleeve ──
    const slvGrad = ctx.createLinearGradient(0, -22, 0, 22);
    slvGrad.addColorStop(0,    '#3D2410');
    slvGrad.addColorStop(0.20, '#5A3A1E');
    slvGrad.addColorStop(0.50, '#6B4828');
    slvGrad.addColorStop(0.80, '#4A3018');
    slvGrad.addColorStop(1,    '#2A1808');
    ctx.fillStyle = slvGrad;
    ctx.beginPath();
    ctx.moveTo(-ro - 30, -18);
    ctx.quadraticCurveTo(armLen * 0.3 - ro, -20, armLen - ro + 8, -14);
    ctx.lineTo(armLen - ro + 10,  16);
    ctx.quadraticCurveTo(armLen * 0.3 - ro, 18, -ro - 30, 17);
    ctx.closePath();
    ctx.fill();

    // Sleeve leather stitching (double row)
    ctx.save();
    ctx.strokeStyle = 'rgba(180,140,80,0.30)';
    ctx.lineWidth = 0.8;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(-ro + 10, -16);
    ctx.quadraticCurveTo(armLen * 0.5 - ro, -19, armLen - ro + 6, -12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-ro + 10, 15);
    ctx.quadraticCurveTo(armLen * 0.5 - ro, 17, armLen - ro + 8, 14);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    // Sleeve wrinkle folds (3 fabric creases)
    ctx.save();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1.2;
    for (let w = 0; w < 3; w++) {
      const wx = armLen * (0.2 + w * 0.22) - ro;
      ctx.beginPath();
      ctx.moveTo(wx, -15);
      ctx.quadraticCurveTo(wx + 3, 0, wx - 1, 14);
      ctx.stroke();
    }
    ctx.restore();

    // Sleeve cuff (folded leather edge)
    const cuffX = armLen - ro + 2;
    const cuffGrad = ctx.createLinearGradient(cuffX - 12, 0, cuffX + 4, 0);
    cuffGrad.addColorStop(0, '#5A3A1E');
    cuffGrad.addColorStop(1, '#3A2210');
    ctx.fillStyle = cuffGrad;
    ctx.beginPath();
    ctx.moveTo(cuffX - 12, -14);
    ctx.lineTo(cuffX + 4,  -12);
    ctx.lineTo(cuffX + 6,   14);
    ctx.lineTo(cuffX - 12,  15);
    ctx.closePath();
    ctx.fill();

    // ── Leather glove hand ──
    const handX = armLen - ro + 6;
    // Wrist
    const wristGrad = ctx.createRadialGradient(handX - 2, 1, 2, handX, 1, 16);
    wristGrad.addColorStop(0, '#8B6538');
    wristGrad.addColorStop(1, '#5A3E20');
    ctx.fillStyle = wristGrad;
    ctx.beginPath();
    ctx.ellipse(handX - 2, 1, 14, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Palm/fingers gripping
    const palmGrad = ctx.createLinearGradient(handX, -10, handX, 12);
    palmGrad.addColorStop(0, '#7A5530');
    palmGrad.addColorStop(0.5, '#96703E');
    palmGrad.addColorStop(1, '#6B4828');
    ctx.fillStyle = palmGrad;
    ctx.beginPath();
    ctx.ellipse(handX + 6, 2, 12, 10, 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Finger segments wrapping grip
    ctx.strokeStyle = 'rgba(60,35,10,0.5)';
    ctx.lineWidth = 0.8;
    for (let f = 0; f < 4; f++) {
      const fy = -5 + f * 4.5;
      ctx.beginPath();
      ctx.moveTo(handX - 2, fy);
      ctx.quadraticCurveTo(handX + 10, fy + 1.5, handX + 16, fy);
      ctx.stroke();
    }

    // Thumb (on top of grip)
    ctx.fillStyle = '#8B6538';
    ctx.beginPath();
    ctx.ellipse(handX + 12, -8, 8, 4.5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(60,35,10,0.4)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(handX + 16, -8, 3, 0, Math.PI);
    ctx.stroke();

    // Glove stitching detail on hand
    ctx.strokeStyle = 'rgba(200,170,110,0.25)';
    ctx.lineWidth = 0.6;
    ctx.setLineDash([2, 3]);
    ctx.beginPath();
    ctx.ellipse(handX + 4, 2, 14, 12, 0.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ── Colt Peacemaker Revolver ──
    const g = armLen - ro; // gun-origin x in local space

    // --- Grip (walnut burl wood with medallion) ---
    ctx.save();
    const gripGrad = ctx.createLinearGradient(g - 2, 4, g + 20, 38);
    gripGrad.addColorStop(0,    '#7A4420');
    gripGrad.addColorStop(0.25, '#9B5E30');
    gripGrad.addColorStop(0.50, '#6B3818');
    gripGrad.addColorStop(0.75, '#8B5028');
    gripGrad.addColorStop(1,    '#4A2810');
    ctx.fillStyle = gripGrad;
    ctx.beginPath();
    ctx.moveTo(g + 2,   4);
    ctx.lineTo(g + 20,  6);
    ctx.quadraticCurveTo(g + 22, 20, g + 18, 38);
    ctx.quadraticCurveTo(g + 10, 42, g - 2,  36);
    ctx.quadraticCurveTo(g - 4,  20, g + 2,   4);
    ctx.closePath();
    ctx.fill();

    // Wood grain pattern
    ctx.strokeStyle = 'rgba(40,18,5,0.22)';
    ctx.lineWidth = 0.7;
    for (let wi = 0; wi < 7; wi++) {
      const gy = 8 + wi * 4.2;
      ctx.beginPath();
      ctx.moveTo(g + 1, gy);
      ctx.quadraticCurveTo(g + 10, gy + (wi % 2 === 0 ? 2 : -1.5), g + 19, gy + 1);
      ctx.stroke();
    }

    // Checkering pattern (cross-hatch on lower grip)
    ctx.strokeStyle = 'rgba(0,0,0,0.18)';
    ctx.lineWidth = 0.5;
    for (let ci = 0; ci < 8; ci++) {
      ctx.beginPath();
      ctx.moveTo(g + 3 + ci * 2, 16);
      ctx.lineTo(g + 1 + ci * 2, 34);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(g + 3, 16 + ci * 2.4);
      ctx.lineTo(g + 19, 17 + ci * 2.4);
      ctx.stroke();
    }

    // Grip medallion (brass Colt emblem circle)
    const medX = g + 10, medY = 22;
    ctx.beginPath();
    ctx.arc(medX, medY, 5.5, 0, Math.PI * 2);
    const medGrad = ctx.createRadialGradient(medX - 1, medY - 1, 0.5, medX, medY, 5.5);
    medGrad.addColorStop(0,   '#E8C860');
    medGrad.addColorStop(0.6, '#C8A030');
    medGrad.addColorStop(1,   '#8A7020');
    ctx.fillStyle = medGrad;
    ctx.fill();
    ctx.strokeStyle = '#6A5010';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    // Star inside medallion
    ctx.strokeStyle = '#9A7828';
    ctx.lineWidth = 0.6;
    for (let si = 0; si < 5; si++) {
      const sa = (si / 5) * Math.PI * 2 - Math.PI / 2;
      const sa2 = ((si + 2) / 5) * Math.PI * 2 - Math.PI / 2;
      ctx.beginPath();
      ctx.moveTo(medX + Math.cos(sa) * 3.5, medY + Math.sin(sa) * 3.5);
      ctx.lineTo(medX + Math.cos(sa2) * 3.5, medY + Math.sin(sa2) * 3.5);
      ctx.stroke();
    }
    ctx.restore();

    // --- Grip frame (back-strap, blued steel) ---
    const bsGrad = ctx.createLinearGradient(g - 4, 4, g + 2, 4);
    bsGrad.addColorStop(0, '#1A2A40');
    bsGrad.addColorStop(0.5, '#2A3A55');
    bsGrad.addColorStop(1, '#182838');
    ctx.fillStyle = bsGrad;
    ctx.beginPath();
    ctx.moveTo(g - 2, 4);
    ctx.lineTo(g + 3, 4);
    ctx.quadraticCurveTo(g + 1, 20, g - 1, 36);
    ctx.quadraticCurveTo(g - 5, 20, g - 2, 4);
    ctx.closePath();
    ctx.fill();

    // --- Main frame (case-hardened steel with colour mottling) ---
    const frmGrad = ctx.createLinearGradient(g - 6, -18, g - 6, 10);
    frmGrad.addColorStop(0,    '#A8B0C0');
    frmGrad.addColorStop(0.15, '#8090A8');
    frmGrad.addColorStop(0.35, '#7888A0');
    frmGrad.addColorStop(0.55, '#6878A0');
    frmGrad.addColorStop(0.80, '#5060A0');
    frmGrad.addColorStop(1,    '#384880');
    ctx.fillStyle = frmGrad;
    ctx.beginPath();
    ctx.moveTo(g - 6,  -14);
    ctx.lineTo(g + 26, -16);
    ctx.lineTo(g + 28,   8);
    ctx.lineTo(g + 2,    8);
    ctx.lineTo(g - 4,    6);
    ctx.closePath();
    ctx.fill();

    // Case-hardening colour swirl (semi-transparent overlay)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#6040C0';
    ctx.beginPath();
    ctx.ellipse(g + 8, -4, 12, 8, 0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#C08040';
    ctx.beginPath();
    ctx.ellipse(g + 18, -8, 8, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Frame edge highlight (specular)
    ctx.strokeStyle = 'rgba(200,210,230,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g - 5, -13);
    ctx.lineTo(g + 25, -15);
    ctx.stroke();

    // Engraving scroll on frame
    ctx.save();
    ctx.strokeStyle = 'rgba(180,190,210,0.25)';
    ctx.lineWidth = 0.6;
    // Scroll pattern
    ctx.beginPath();
    ctx.moveTo(g + 2, -6);
    ctx.bezierCurveTo(g + 6, -10, g + 10, -2, g + 14, -8);
    ctx.bezierCurveTo(g + 18, -12, g + 22, -4, g + 24, -10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(g + 4, 2);
    ctx.bezierCurveTo(g + 8, -2, g + 12, 4, g + 16, 0);
    ctx.bezierCurveTo(g + 20, -3, g + 23, 2, g + 26, -1);
    ctx.stroke();
    ctx.restore();

    // --- Cylinder (rotating drum, blued finish) ---
    const cylX = g + 12, cylY = -3;
    const cylR = 15;
    // Cylinder shadow behind
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(cylX + 1, cylY + 2, cylR + 1, cylR + 1, 0, 0, Math.PI * 2);
    ctx.fill();

    // Main cylinder body
    const cylGrad = ctx.createRadialGradient(cylX - 3, cylY - 3, 1, cylX, cylY, cylR);
    cylGrad.addColorStop(0,   '#7888A8');
    cylGrad.addColorStop(0.3, '#5868A0');
    cylGrad.addColorStop(0.7, '#384878');
    cylGrad.addColorStop(1,   '#1A2840');
    ctx.fillStyle = cylGrad;
    ctx.beginPath();
    ctx.arc(cylX, cylY, cylR, 0, Math.PI * 2);
    ctx.fill();

    // Cylinder rim edge
    ctx.strokeStyle = 'rgba(120,140,180,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cylX, cylY, cylR, 0, Math.PI * 2);
    ctx.stroke();

    // Cylinder flutes (machined grooves between chambers)
    const cylAngle = this.time * CYLINDER_ROT_SPEED;
    ctx.save();
    ctx.strokeStyle = 'rgba(10,15,30,0.35)';
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 6; i++) {
      const fa = (i / 6) * Math.PI * 2 + cylAngle + Math.PI / 6;
      const fx1 = cylX + Math.cos(fa) * 6;
      const fy1 = cylY + Math.sin(fa) * 6;
      const fx2 = cylX + Math.cos(fa) * (cylR - 1);
      const fy2 = cylY + Math.sin(fa) * (cylR - 1);
      ctx.beginPath();
      ctx.moveTo(fx1, fy1);
      ctx.lineTo(fx2, fy2);
      ctx.stroke();
    }
    ctx.restore();

    // Six chambers (loaded = brass cartridge, spent = dark)
    for (let i = 0; i < 6; i++) {
      const ca  = (i / 6) * Math.PI * 2 + cylAngle;
      const cbx = cylX + Math.cos(ca) * 9;
      const cby = cylY + Math.sin(ca) * 9;

      // Chamber hole
      ctx.beginPath();
      ctx.arc(cbx, cby, 3.5, 0, Math.PI * 2);
      if (i < this.bullets) {
        // Loaded: brass cartridge primer
        const brassGrad = ctx.createRadialGradient(cbx - 0.5, cby - 0.5, 0.5, cbx, cby, 3.5);
        brassGrad.addColorStop(0, '#E8C860');
        brassGrad.addColorStop(0.6, '#C8A030');
        brassGrad.addColorStop(1, '#8A7020');
        ctx.fillStyle = brassGrad;
        ctx.fill();
        // Primer circle
        ctx.beginPath();
        ctx.arc(cbx, cby, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#AA7818';
        ctx.fill();
      } else {
        // Spent: empty dark chamber
        ctx.fillStyle = '#0A0A12';
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(40,50,80,0.5)';
      ctx.lineWidth = 0.6;
      ctx.stroke();
    }

    // Cylinder pin (center axis)
    ctx.fillStyle = '#6878A8';
    ctx.beginPath();
    ctx.arc(cylX, cylY, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(30,40,70,0.6)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Specular highlight on cylinder
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = '#C0D0F0';
    ctx.beginPath();
    ctx.ellipse(cylX - 5, cylY - 6, 6, 3.5, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Barrel (octagonal profile, blued steel) ---
    const barGrad = ctx.createLinearGradient(g + 24, -14, g + 24, 6);
    barGrad.addColorStop(0,    '#8898B8');
    barGrad.addColorStop(0.12, '#7080A8');
    barGrad.addColorStop(0.30, '#5868A0');
    barGrad.addColorStop(0.50, '#4858A0');
    barGrad.addColorStop(0.70, '#384880');
    barGrad.addColorStop(0.88, '#283868');
    barGrad.addColorStop(1,    '#1A2848');
    ctx.fillStyle = barGrad;
    ctx.beginPath();
    ctx.moveTo(g + 22, -12);
    ctx.lineTo(g + barrelLen + 2,  -10);
    ctx.lineTo(g + barrelLen + 2,    4);
    ctx.lineTo(g + 22,               4);
    ctx.closePath();
    ctx.fill();

    // Top flat of octagonal barrel (lighter face)
    const topGrad = ctx.createLinearGradient(g + 24, -14, g + 24, -10);
    topGrad.addColorStop(0, '#A0B0D0');
    topGrad.addColorStop(1, '#8090B0');
    ctx.fillStyle = topGrad;
    ctx.fillRect(g + 24, -14, barrelLen - 20, 3.5);

    // Barrel edge highlight
    ctx.strokeStyle = 'rgba(160,180,220,0.3)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(g + 24, -12);
    ctx.lineTo(g + barrelLen + 2, -10);
    ctx.stroke();

    // Ejector rod housing (beneath barrel)
    ctx.fillStyle = '#3A4A70';
    ctx.beginPath();
    ctx.moveTo(g + 26, 1);
    ctx.lineTo(g + barrelLen - 4, 0);
    ctx.lineTo(g + barrelLen - 4, 5);
    ctx.lineTo(g + 26, 6);
    ctx.closePath();
    ctx.fill();
    // Ejector rod tip
    ctx.fillStyle = '#6878A0';
    ctx.beginPath();
    ctx.arc(g + barrelLen - 2, 3, 3, 0, Math.PI * 2);
    ctx.fill();

    // Front sight blade (dove-tail style)
    ctx.fillStyle = '#D0D8E8';
    ctx.beginPath();
    ctx.moveTo(g + barrelLen - 6, -18);
    ctx.lineTo(g + barrelLen - 2, -18);
    ctx.lineTo(g + barrelLen - 1, -12);
    ctx.lineTo(g + barrelLen - 7, -12);
    ctx.closePath();
    ctx.fill();
    // Sight notch
    ctx.fillStyle = '#F8F0E0';
    ctx.fillRect(g + barrelLen - 5, -20, 2, 3);

    // Muzzle crown
    const mzX = g + barrelLen + 2, mzY = -3;
    // Outer ring
    const mzGrad = ctx.createRadialGradient(mzX, mzY, 2, mzX, mzY, 8);
    mzGrad.addColorStop(0,   '#5060A0');
    mzGrad.addColorStop(0.5, '#384878');
    mzGrad.addColorStop(1,   '#1A2840');
    ctx.fillStyle = mzGrad;
    ctx.beginPath();
    ctx.arc(mzX, mzY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(120,140,180,0.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // Inner bore
    ctx.fillStyle = '#050508';
    ctx.beginPath();
    ctx.arc(mzX, mzY, 4, 0, Math.PI * 2);
    ctx.fill();
    // Rifling hint inside bore
    ctx.strokeStyle = 'rgba(60,70,100,0.4)';
    ctx.lineWidth = 0.4;
    for (let ri = 0; ri < 6; ri++) {
      const ra = (ri / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(mzX + Math.cos(ra) * 1.5, mzY + Math.sin(ra) * 1.5);
      ctx.lineTo(mzX + Math.cos(ra) * 3.8, mzY + Math.sin(ra) * 3.8);
      ctx.stroke();
    }

    // --- Trigger guard (brass) ---
    const tgGrad = ctx.createLinearGradient(g, 8, g + 12, 28);
    tgGrad.addColorStop(0,   '#D8B848');
    tgGrad.addColorStop(0.5, '#C8A030');
    tgGrad.addColorStop(1,   '#A88020');
    ctx.strokeStyle = tgGrad;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(g + 2, 8);
    ctx.quadraticCurveTo(g - 2, 22, g + 6, 28);
    ctx.quadraticCurveTo(g + 14, 22, g + 12, 8);
    ctx.stroke();

    // --- Trigger (blued steel) ---
    ctx.strokeStyle = '#5868A0';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(g + 7,  6);
    ctx.quadraticCurveTo(g + 5, 14, g + 4, 20);
    ctx.stroke();

    // --- Hammer (cocked back, case-hardened) ---
    const hmGrad = ctx.createLinearGradient(g + 18, -18, g + 30, -28);
    hmGrad.addColorStop(0, '#8090A8');
    hmGrad.addColorStop(0.5, '#6878A0');
    hmGrad.addColorStop(1, '#4A5888');
    ctx.fillStyle = hmGrad;
    ctx.beginPath();
    ctx.moveTo(g + 20, -16);
    ctx.lineTo(g + 24, -26);
    ctx.quadraticCurveTo(g + 30, -28, g + 32, -22);
    ctx.lineTo(g + 28, -14);
    ctx.closePath();
    ctx.fill();
    // Hammer spur serrations
    ctx.strokeStyle = 'rgba(40,50,80,0.5)';
    ctx.lineWidth = 0.5;
    for (let hs = 0; hs < 4; hs++) {
      const hsx = g + 24 + hs * 2;
      ctx.beginPath();
      ctx.moveTo(hsx, -26);
      ctx.lineTo(hsx + 0.5, -23);
      ctx.stroke();
    }
    // Hammer specular
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#C0D0F0';
    ctx.beginPath();
    ctx.ellipse(g + 26, -22, 3, 1.5, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // --- Loading gate (right side of frame) ---
    ctx.fillStyle = 'rgba(90,110,150,0.4)';
    ctx.beginPath();
    ctx.arc(g + 22, 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(50,60,90,0.5)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // --- Gun drop shadow (subtle depth) ---
    ctx.save();
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(g - 6, 10);
    ctx.lineTo(g + barrelLen + 4, 8);
    ctx.lineTo(g + barrelLen + 4, 12);
    ctx.lineTo(g - 6, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      if (p.type === 'blood') {
        ctx.globalAlpha = clamp(p.t / 0.7, 0, 1);
        ctx.fillStyle = '#8B0000';
        ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();

      } else if (p.type === 'hole') {
        // Bullet hole decal
        ctx.globalAlpha = clamp(p.t * 0.25, 0, 0.85);
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.stroke();
        // Cracks
        for (let a = 0; a < 6; a++) {
          const ang = (a / 6) * Math.PI * 2;
          ctx.strokeStyle = '#222';
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(ang) * 5, p.y + Math.sin(ang) * 5);
          ctx.lineTo(p.x + Math.cos(ang) * 14, p.y + Math.sin(ang) * 14);
          ctx.stroke();
        }

      } else if (p.type === 'hit') {
        ctx.globalAlpha = clamp(p.t / 0.22, 0, 1);
        ctx.fillStyle = '#FF5555';
        ctx.beginPath(); ctx.arc(p.x, p.y, 14, 0, Math.PI * 2); ctx.fill();

      } else if (p.type === 'flash') {
        // Player muzzle flash — multi-layer cinematic flash
        const ft = clamp(p.t / 0.14, 0, 1);
        // Outer glow (warm orange)
        ctx.globalAlpha = ft * 0.5;
        const outerGlow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 44);
        outerGlow.addColorStop(0,   'rgba(255,180,60,0.8)');
        outerGlow.addColorStop(0.4, 'rgba(255,120,20,0.4)');
        outerGlow.addColorStop(1,   'rgba(255,80,0,0)');
        ctx.fillStyle = outerGlow;
        ctx.beginPath(); ctx.arc(p.x, p.y, 44, 0, Math.PI * 2); ctx.fill();
        // Mid flash (bright yellow)
        ctx.globalAlpha = ft * 0.85;
        const midFlash = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 24);
        midFlash.addColorStop(0,   '#FFFFFF');
        midFlash.addColorStop(0.3, '#FFF8D0');
        midFlash.addColorStop(0.7, '#FFDD60');
        midFlash.addColorStop(1,   'rgba(255,180,40,0)');
        ctx.fillStyle = midFlash;
        ctx.beginPath(); ctx.arc(p.x, p.y, 24, 0, Math.PI * 2); ctx.fill();
        // Core (white-hot)
        ctx.globalAlpha = ft;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        // Spark streaks (directional)
        ctx.globalAlpha = ft * 0.6;
        ctx.strokeStyle = '#FFE080';
        ctx.lineWidth = 1.5;
        for (let si = 0; si < 5; si++) {
          const sa = (si / 5) * Math.PI * 2 + p.t * 8;
          const sl = 12 + Math.sin(si * 3.7) * 10;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(sa) * 8, p.y + Math.sin(sa) * 8);
          ctx.lineTo(p.x + Math.cos(sa) * sl, p.y + Math.sin(sa) * sl);
          ctx.stroke();
        }

      } else if (p.type === 'eflash') {
        // Enemy muzzle flash
        ctx.globalAlpha = clamp(p.t / 0.14, 0, 0.85);
        ctx.fillStyle = '#FFBB44';
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── HUD ───────────────────────────────────────────────────────────────────
  drawHUD(ctx) {
    // Score (top-left)
    ctx.save();
    ctx.font = 'bold 22px Georgia, serif';
    ctx.textAlign  = 'left';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText(`SCORE: ${this.score}`, 12, 34);
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`SCORE: ${this.score}`, 12, 34);

    // Wave (top-right)
    ctx.textAlign = 'right';
    ctx.strokeText(`WAVE ${this.wave}`, W - 12, 34);
    ctx.fillText(`WAVE ${this.wave}`, W - 12, 34);
    ctx.restore();

    // Lives (hearts)
    ctx.font = '26px serif';
    ctx.textAlign = 'left';
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.fillText(i < this.lives ? '❤️' : '🖤', 12 + i * 32, 64);
    }

    // 6-shooter cylinder UI (bottom-right)
    this.drawCylinder(ctx);

    // Reload progress bar / prompt
    if (this.reloading) {
      const prog = 1 - this.reloadTimer / RELOAD_TIME;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      drawRoundRect(ctx, W / 2 - 90, H - 94, 180, 38, 8); ctx.fill();
      ctx.fillStyle = '#8B4513';
      drawRoundRect(ctx, W / 2 - 88, H - 92, (180 - 4) * prog, 34, 6); ctx.fill();
      ctx.font = 'bold 16px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.fillText('RELOADING…', W / 2, H - 70);
    } else if (this.bullets === 0) {
      const pulse = 0.6 + Math.abs(Math.sin(this.time * 3.6)) * 0.4;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = '#FF3333';
      ctx.font = 'bold 18px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAP TO RELOAD!', W / 2, H - 72);
      ctx.restore();
    }
  }

  drawCylinder(ctx) {
    const cx = W - 68, cy = H - 62, R = 30;

    // Outer ring
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(cx, cy, R + 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, R + 7, 0, Math.PI * 2); ctx.stroke();

    // 6 chambers
    for (let i = 0; i < MAX_BULLETS; i++) {
      const angle = (i / MAX_BULLETS) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(angle) * R;
      const by = cy + Math.sin(angle) * R;
      ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < this.bullets ? '#FFD700' : '#2A2A2A';
      ctx.fill();
      ctx.strokeStyle = '#888'; ctx.lineWidth = 1;
      ctx.stroke();
    }
    // Centre pin
    ctx.fillStyle = '#999';
    ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill();

    // Bullet count
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFD700';
    ctx.fillText(`${this.bullets}/6`, cx, cy + 50);

    // RELOAD button
    const btnFill = this.bullets === MAX_BULLETS ? '#444' : '#8B0000';
    ctx.fillStyle = btnFill;
    drawRoundRect(ctx, cx - 34, cy + 56, 68, 28, 6); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 12px Georgia, serif';
    ctx.fillText('RELOAD', cx, cy + 74);
  }
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
window.addEventListener('load', () => new WesternShooter());
