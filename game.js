/**
 * Western Shooter — Mobile Game
 * Pure HTML5 Canvas + Vanilla JavaScript
 * Portrait mobile design (480 × 720 logical pixels)
 *
 * Controls: tap an enemy to shoot it, tap RELOAD (or empty-barrel tap) to reload.
 */
'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const W = 480;
const H = 720;
const MAX_BULLETS = 6;
const RELOAD_TIME = 2.0;   // seconds
const MAX_LIVES   = 3;

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
    this.bestScore = 0;
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
    const tap = (cx, cy) => {
      const p = this.toGame(cx, cy);
      this.onTap(p.x, p.y);
    };
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      tap(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
    }, { passive: false });
    this.canvas.addEventListener('mousedown', e => tap(e.clientX, e.clientY));
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
  }

  triggerReload() {
    if (this.reloading || this.bullets === MAX_BULLETS) return;
    this.reloading   = true;
    this.reloadTimer = RELOAD_TIME;
  }

  fireAt(x, y) {
    this.bullets--;
    // Muzzle-flash particle at bottom-centre (player gun position)
    this.particles.push({ type: 'flash', x: W / 2, y: H - 145, t: 0.14 });

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

    // 4. Particles / FX
    this.drawParticles(ctx);

    // 5. Red screen flash when player takes damage
    if (this.hitFlash > 0) {
      ctx.fillStyle = `rgba(200,0,0,${this.hitFlash * 0.58})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 6. "WAVE N" banner
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
        // Player muzzle flash
        ctx.globalAlpha = clamp(p.t / 0.14, 0, 0.9);
        ctx.fillStyle = '#FFEE88';
        ctx.beginPath(); ctx.arc(p.x, p.y, 32, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, Math.PI * 2); ctx.fill();

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
