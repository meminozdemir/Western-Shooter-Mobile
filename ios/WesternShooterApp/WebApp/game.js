/**
 * Offline Shooter — Mobile Game v7
 * FPS-style arcade shooter with bottom-center revolver,
 * authentic batwing saloon doors (low, open top),
 * round tables, visible piano + pianist, shatterable bottles,
 * synthesized audio (ragtime, gunshots, door creak, glass shatter).
 * Pure HTML5 Canvas + Web Audio API, fully offline.
 */
'use strict';

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const W = 480;
const H = 720;
const MAX_BULLETS = 6;
const RELOAD_TIME = 2.0;
const MAX_LIVES   = 3;
const CIV_PENALTY = 500;

// FPS gun anchor
const GUN_ANCHOR_X = W / 2;
const GUN_ANCHOR_Y = H + 30;
const GUN_AIM_LERP = 8;
const GUN_PAN_X    = 50;
const GUN_PAN_Y    = 25;
const RECOIL_DUR   = 0.18;
const RECOIL_KICK  = 18;

// Scene layout
const CEILING_Y    = 0;
const BALCONY_Y    = 90;
const RAIL_Y       = 120;
const WALL_TOP     = RAIL_Y + 8;
const BAR_Y        = 330;
const BAR_H        = 50;
const FLOOR_Y      = BAR_Y + BAR_H + 10;
const DOOR_CX      = W / 2;
const DOOR_TOP     = 155;
const DOOR_BOT     = 320;
const DOOR_W       = 90;

// Batwing door panels — doors sit LOW near the ground, large open space ABOVE
const DOOR_PANEL_H   = 95;   // panel height
const DOOR_PANEL_TOP = DOOR_BOT - DOOR_PANEL_H;  // panels start near bottom of opening
// This gives ~70px open space above the panels (DOOR_PANEL_TOP - DOOR_TOP ≈ 70)

// Bottle shelf
const BOTTLE_SHELF_Y = BAR_Y - 46;
const BOTTLE_POSITIONS = [20, 55, 90, 140, 260, 300, 350, 395, 440];
const BOTTLE_COLORS = ['#2E7B44', '#8B1A1A', '#DAA520', '#1A3A7A', '#6B3A6B'];

// Windows
const WINDOWS = [
  { id: 'wl', x: 62,      y: 210, w: 54, h: 68 },
  { id: 'wr', x: W - 62,  y: 210, w: 54, h: 68 },
];

// Enemy spawn slots
const SPAWN_SLOTS = [
  { id: 'cover_bl', x: 120, peekY: 405, type: 'cover', coverType: 'table', minWave: 1 },
  { id: 'cover_tl', x: 215, peekY: 402, type: 'cover', coverType: 'table', minWave: 1 },
  { id: 'cover_tr', x: 310, peekY: 402, type: 'cover', coverType: 'table', minWave: 1 },
  { id: 'cover_br', x: 415, peekY: 405, type: 'cover', coverType: 'table', minWave: 1 },
  { id: 'win_l', x: 62,      peekY: 195, type: 'window', winIdx: 0, minWave: 3 },
  { id: 'win_r', x: W - 62,  peekY: 195, type: 'window', winIdx: 1, minWave: 3 },
  { id: 'bal_l', x: 120, peekY: 68, type: 'balcony', minWave: 6 },
  { id: 'bal_c', x: 240, peekY: 68, type: 'balcony', minWave: 6 },
  { id: 'bal_r', x: 360, peekY: 68, type: 'balcony', minWave: 6 },
];

// Cover furniture — round tables
const COVERS = [
  { x: 120, y: 430, w: 78, h: 55, type: 'table' },
  { x: 215, y: 425, w: 80, h: 55, type: 'table' },
  { x: 310, y: 425, w: 80, h: 55, type: 'table' },
  { x: 415, y: 430, w: 78, h: 55, type: 'table' },
];

// Extra decorative round tables (non-cover, just ambiance)
const DECO_TABLES = [
  { x: 370, y: 465, w: 60, h: 42 },
];

const OUTFITS = [
  { shirt: '#4A3728', pants: '#3A2318', hat: '#2C1810', band: '#8B0000', bandana: '#8B0000', scar: false },
  { shirt: '#1E3A1E', pants: '#132213', hat: '#0E1A0E', band: '#DAA520', bandana: null,      scar: true },
  { shirt: '#3D1A1A', pants: '#2B1010', hat: '#1C0A0A', band: '#4169E1', bandana: '#4A2020', scar: false },
  { shirt: '#4A4028', pants: '#3A3018', hat: '#2C2010', band: '#FF6347', bandana: null,      scar: true },
  { shirt: '#2A2A3A', pants: '#1A1A28', hat: '#101018', band: '#C0C0C0', bandana: '#2A2A3A', scar: false },
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function rand(a, b) { return a + Math.random() * (b - a); }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function inRect(px, py, rx, ry, rw, rh) {
  return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}
function drawRR(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function enemyHB(e) {
  if (e.posType === 'window')  return { x: e.drawX - 22, y: e.drawY - 40, w: 44, h: 56 };
  if (e.posType === 'balcony') return { x: e.drawX - 22, y: e.drawY - 36, w: 44, h: 52 };
  return { x: e.drawX - 26, y: e.drawY - 56, w: 52, h: 82 };
}
function civHB(c) {
  if (c.type === 'doorCiv' && c.spawnMode === 'window')  return { x: c.x - 18, y: c.y - 36, w: 36, h: 50 };
  if (c.type === 'doorCiv' && c.spawnMode === 'balcony') return { x: c.x - 18, y: c.y - 32, w: 36, h: 46 };
  return { x: c.x - 20, y: c.y - 44, w: 40, h: 58 };
}

// ─── AUDIO MANAGER (Web Audio API — synthesised) ────────────────────────────
class AudioManager {
  constructor() {
    this.ctx = null;
    this.initialized = false;
    this.musicPlaying = false;
    this.musicGain = null;
    this.musicTimer = null;
  }

  init() {
    if (this.initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.initialized = true;
    } catch (_) {}
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  playNote(freq, startTime, duration, volume, type) {
    if (!this.initialized) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, startTime);
    g.gain.linearRampToValueAtTime(volume, startTime + 0.008);
    g.gain.setValueAtTime(volume * 0.7, startTime + duration * 0.35);
    g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    const dest = this.musicGain || ctx.destination;
    osc.connect(g); g.connect(dest);
    osc.start(startTime); osc.stop(startTime + duration + 0.02);
  }

  startMusic() {
    if (!this.initialized || this.musicPlaying) return;
    this.musicPlaying = true;
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.ctx.destination);
    this._scheduleLoop();
  }

  stopMusic() {
    this.musicPlaying = false;
    if (this.musicTimer) { clearTimeout(this.musicTimer); this.musicTimer = null; }
    if (this.musicGain) {
      try { this.musicGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.4); } catch (_) {}
    }
  }

  _scheduleLoop() {
    if (!this.musicPlaying || !this.initialized) return;
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.1;
    // Lively western saloon ragtime piano
    const bpm = 160;
    const bt = 60 / bpm;
    const bar = bt * 4;
    const n = {
      C2:65.41, E2:82.41, G2:98.00, A2:110.00, B2:123.47,
      C3:130.81, D3:146.83, E3:164.81, F3:174.61, Fs3:185.00,
      G3:196.00, Gs3:207.65, A3:220.00, Bb3:233.08, B3:246.94,
      C4:261.63, Cs4:277.18, D4:293.66, Ds4:311.13, E4:329.63,
      F4:349.23, Fs4:369.99, G4:392.00, Gs4:415.30, A4:440.00,
      Bb4:466.16, B4:493.88, C5:523.25, D5:587.33, E5:659.25,
      F5:698.46, G5:783.99,
    };
    const s = bt * 0.42; // staccato duration for bouncy feel
    const m = bt * 0.7;  // medium hold
    const l = bt * 1.2;  // longer hold
    const notes = [
      // ── Bar 1: C major stride (oom-pah oom-pah) + melody ──
      [n.C2,0,s,.16,'triangle'],[n.E4,0,s,.08,'triangle'],[n.G4,0,s,.08,'triangle'],
      [n.E3,bt,s,.10,'triangle'],[n.G3,bt,s,.10,'triangle'],[n.C4,bt,s,.08,'triangle'],
      [n.C2,bt*2,s,.16,'triangle'],[n.E4,bt*2,s,.08,'triangle'],[n.G4,bt*2,s,.08,'triangle'],
      [n.E3,bt*3,s,.10,'triangle'],[n.G3,bt*3,s,.10,'triangle'],[n.C4,bt*3,s,.08,'triangle'],
      // Melody over bar 1
      [n.C5,0,m,.11,'triangle'],[n.D5,bt,s,.09,'triangle'],
      [n.E5,bt*2,m,.11,'triangle'],[n.G5,bt*3,s,.09,'triangle'],

      // ── Bar 2: G7 stride + melody run ──
      [n.G2,bar,s,.16,'triangle'],[n.D4,bar,s,.08,'triangle'],[n.B3,bar,s,.08,'triangle'],
      [n.D3,bar+bt,s,.10,'triangle'],[n.G3,bar+bt,s,.10,'triangle'],[n.B3,bar+bt,s,.08,'triangle'],
      [n.G2,bar+bt*2,s,.16,'triangle'],[n.D4,bar+bt*2,s,.08,'triangle'],[n.F4,bar+bt*2,s,.07,'triangle'],
      [n.D3,bar+bt*3,s,.10,'triangle'],[n.G3,bar+bt*3,s,.10,'triangle'],[n.B3,bar+bt*3,s,.08,'triangle'],
      // Melody
      [n.F5,bar,s,.09,'triangle'],[n.E5,bar+bt,s,.09,'triangle'],
      [n.D5,bar+bt*2,m,.11,'triangle'],[n.B4,bar+bt*3,s,.09,'triangle'],

      // ── Bar 3: F major stride + honky-tonk lick ──
      [n.C2,bar*2,s,.16,'triangle'],[n.F4,bar*2,s,.08,'triangle'],[n.A3,bar*2,s,.08,'triangle'],
      [n.F3,bar*2+bt,s,.10,'triangle'],[n.A3,bar*2+bt,s,.10,'triangle'],[n.C4,bar*2+bt,s,.08,'triangle'],
      [n.C2,bar*2+bt*2,s,.16,'triangle'],[n.F4,bar*2+bt*2,s,.08,'triangle'],[n.A3,bar*2+bt*2,s,.08,'triangle'],
      [n.F3,bar*2+bt*3,s,.10,'triangle'],[n.A3,bar*2+bt*3,s,.10,'triangle'],[n.C4,bar*2+bt*3,s,.08,'triangle'],
      // Melody — ascending run
      [n.C5,bar*2,s,.10,'triangle'],[n.D5,bar*2+bt*.5,s,.08,'triangle'],
      [n.E5,bar*2+bt,s,.10,'triangle'],[n.F5,bar*2+bt*1.5,s,.08,'triangle'],
      [n.G5,bar*2+bt*2,m,.11,'triangle'],[n.E5,bar*2+bt*3,s,.09,'triangle'],

      // ── Bar 4: C-G7 turnaround ──
      [n.C2,bar*3,s,.16,'triangle'],[n.E4,bar*3,s,.08,'triangle'],[n.G4,bar*3,s,.08,'triangle'],
      [n.E3,bar*3+bt,s,.10,'triangle'],[n.G3,bar*3+bt,s,.10,'triangle'],
      [n.G2,bar*3+bt*2,s,.16,'triangle'],[n.D4,bar*3+bt*2,s,.08,'triangle'],[n.F4,bar*3+bt*2,s,.07,'triangle'],
      [n.D3,bar*3+bt*3,s,.10,'triangle'],[n.G3,bar*3+bt*3,s,.10,'triangle'],[n.B3,bar*3+bt*3,s,.08,'triangle'],
      // Melody — descending lick
      [n.E5,bar*3,s,.10,'triangle'],[n.D5,bar*3+bt,s,.09,'triangle'],
      [n.C5,bar*3+bt*2,s,.10,'triangle'],[n.B4,bar*3+bt*2.5,s,.07,'triangle'],
      [n.A4,bar*3+bt*3,s,.09,'triangle'],[n.G4,bar*3+bt*3.5,s,.07,'triangle'],

      // ── Bar 5: Am stride + bluesy melody ──
      [n.A2,bar*4,s,.16,'triangle'],[n.E4,bar*4,s,.08,'triangle'],[n.C4,bar*4,s,.08,'triangle'],
      [n.E3,bar*4+bt,s,.10,'triangle'],[n.A3,bar*4+bt,s,.10,'triangle'],[n.C4,bar*4+bt,s,.08,'triangle'],
      [n.A2,bar*4+bt*2,s,.16,'triangle'],[n.E4,bar*4+bt*2,s,.08,'triangle'],[n.C4,bar*4+bt*2,s,.08,'triangle'],
      [n.E3,bar*4+bt*3,s,.10,'triangle'],[n.A3,bar*4+bt*3,s,.10,'triangle'],
      // Melody
      [n.A4,bar*4,m,.11,'triangle'],[n.C5,bar*4+bt,s,.09,'triangle'],
      [n.E5,bar*4+bt*2,m,.11,'triangle'],[n.D5,bar*4+bt*3,s,.09,'triangle'],

      // ── Bar 6: D7→G stride + chromatic run ──
      [n.A2,bar*5,s,.16,'triangle'],[n.D4,bar*5,s,.08,'triangle'],[n.Fs3,bar*5,s,.08,'triangle'],
      [n.D3,bar*5+bt,s,.10,'triangle'],[n.Fs3,bar*5+bt,s,.10,'triangle'],[n.A3,bar*5+bt,s,.08,'triangle'],
      [n.G2,bar*5+bt*2,s,.16,'triangle'],[n.D4,bar*5+bt*2,s,.08,'triangle'],[n.B3,bar*5+bt*2,s,.08,'triangle'],
      [n.D3,bar*5+bt*3,s,.10,'triangle'],[n.G3,bar*5+bt*3,s,.10,'triangle'],[n.B3,bar*5+bt*3,s,.08,'triangle'],
      // Melody — chromatic descent
      [n.D5,bar*5,s,.09,'triangle'],[n.Cs4,bar*5+bt*.5,s,.07,'triangle'],
      [n.D5,bar*5+bt,s,.10,'triangle'],[n.C5,bar*5+bt*1.5,s,.07,'triangle'],
      [n.B4,bar*5+bt*2,m,.11,'triangle'],[n.A4,bar*5+bt*3,s,.09,'triangle'],

      // ── Bar 7: F major stride + high trill ──
      [n.C2,bar*6,s,.16,'triangle'],[n.F4,bar*6,s,.08,'triangle'],[n.A3,bar*6,s,.08,'triangle'],
      [n.F3,bar*6+bt,s,.10,'triangle'],[n.A3,bar*6+bt,s,.10,'triangle'],[n.C4,bar*6+bt,s,.08,'triangle'],
      [n.C2,bar*6+bt*2,s,.16,'triangle'],[n.E4,bar*6+bt*2,s,.08,'triangle'],[n.G3,bar*6+bt*2,s,.08,'triangle'],
      [n.E3,bar*6+bt*3,s,.10,'triangle'],[n.G3,bar*6+bt*3,s,.10,'triangle'],[n.C4,bar*6+bt*3,s,.08,'triangle'],
      // Melody
      [n.F5,bar*6,s,.09,'triangle'],[n.E5,bar*6+bt*.5,s,.07,'triangle'],
      [n.F5,bar*6+bt,s,.09,'triangle'],[n.G5,bar*6+bt*1.5,s,.07,'triangle'],
      [n.E5,bar*6+bt*2,m,.11,'triangle'],[n.C5,bar*6+bt*3,s,.09,'triangle'],

      // ── Bar 8: C→G7→C ending flourish ──
      [n.C2,bar*7,s,.16,'triangle'],[n.E4,bar*7,s,.08,'triangle'],[n.G4,bar*7,s,.08,'triangle'],
      [n.E3,bar*7+bt,s,.10,'triangle'],[n.G3,bar*7+bt,s,.10,'triangle'],[n.C4,bar*7+bt,s,.08,'triangle'],
      [n.G2,bar*7+bt*2,s,.16,'triangle'],[n.D4,bar*7+bt*2,s,.08,'triangle'],[n.B3,bar*7+bt*2,s,.07,'triangle'],
      [n.C2,bar*7+bt*3,s,.16,'triangle'],[n.E4,bar*7+bt*3,s,.08,'triangle'],[n.G4,bar*7+bt*3,l,.08,'triangle'],
      // Melody — final descending flourish
      [n.G5,bar*7,s,.10,'triangle'],[n.E5,bar*7+bt*.5,s,.08,'triangle'],
      [n.D5,bar*7+bt,s,.09,'triangle'],[n.C5,bar*7+bt*1.5,s,.07,'triangle'],
      [n.B4,bar*7+bt*2,s,.09,'triangle'],[n.C5,bar*7+bt*3,l,.12,'triangle'],
    ];
    for (const p of notes) this.playNote(p[0], now + p[1], p[2], p[3], p[4]);
    const loopLen = bar * 8;
    this.musicTimer = setTimeout(() => this._scheduleLoop(), (loopLen - 0.3) * 1000);
  }

  playGunshot() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const bufSz = Math.floor(ctx.sampleRate * 0.28);
    const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSz, 3.5);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(4500, now);
    flt.frequency.exponentialRampToValueAtTime(250, now + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.45, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(now); src.stop(now + 0.28);
    const thud = ctx.createOscillator(); thud.type = 'sine';
    thud.frequency.setValueAtTime(140, now);
    thud.frequency.exponentialRampToValueAtTime(45, now + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.25, now);
    tg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    thud.connect(tg); tg.connect(ctx.destination);
    thud.start(now); thud.stop(now + 0.13);
  }

  playEnemyShot() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const bufSz = Math.floor(ctx.sampleRate * 0.2);
    const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSz, 4);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass';
    flt.frequency.setValueAtTime(3000, now);
    flt.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(now); src.stop(now + 0.2);
  }

  playChandelierCrash() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Heavy metal impact
    const osc1 = ctx.createOscillator(); osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(280, now);
    osc1.frequency.exponentialRampToValueAtTime(60, now + 0.25);
    const g1 = ctx.createGain();
    g1.gain.setValueAtTime(0.3, now);
    g1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(g1); g1.connect(ctx.destination);
    osc1.start(now); osc1.stop(now + 0.36);
    // Glass/crystal shattering
    const bufSz = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSz, 2) *
             (1 + 0.7 * Math.sin(i * 0.06));
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'highpass';
    flt.frequency.setValueAtTime(2500, now + 0.05);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.25, now + 0.05);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
    src.connect(flt); flt.connect(g2); g2.connect(ctx.destination);
    src.start(now + 0.05); src.stop(now + 0.5);
    // Metallic ringing overtone (chandelier chain vibration)
    const ring = ctx.createOscillator(); ring.type = 'sine';
    ring.frequency.setValueAtTime(1800, now + 0.1);
    ring.frequency.exponentialRampToValueAtTime(600, now + 0.6);
    const rg = ctx.createGain();
    rg.gain.setValueAtTime(0.06, now + 0.1);
    rg.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    ring.connect(rg); rg.connect(ctx.destination);
    ring.start(now + 0.1); ring.stop(now + 0.66);
  }

  playDoorCreak() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const osc = ctx.createOscillator(); osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(55, now);
    osc.frequency.linearRampToValueAtTime(170, now + 0.12);
    osc.frequency.linearRampToValueAtTime(45, now + 0.32);
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass';
    flt.frequency.setValueAtTime(380, now); flt.Q.value = 7;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, now);
    g.gain.linearRampToValueAtTime(0.05, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.36);
    osc.connect(flt); flt.connect(g); g.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.38);
  }

  playGlassShatter() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // High-freq noise burst simulating glass
    const bufSz = Math.floor(ctx.sampleRate * 0.35);
    const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufSz, 2.5) *
             (1 + 0.5 * Math.sin(i * 0.08));
    }
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'highpass';
    flt.frequency.setValueAtTime(3000, now);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    src.connect(flt); flt.connect(g); g.connect(ctx.destination);
    src.start(now); src.stop(now + 0.35);
    // Tinkling overtone
    const osc = ctx.createOscillator(); osc.type = 'sine';
    osc.frequency.setValueAtTime(4200, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.2);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.08, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(g2); g2.connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.26);
  }

  playReload() {
    if (!this.initialized) return;
    const ctx = this.ctx, now = ctx.currentTime;
    // Cylinder open — latch click + creak
    const latch = ctx.createOscillator(); latch.type = 'square';
    latch.frequency.setValueAtTime(2200, now);
    latch.frequency.exponentialRampToValueAtTime(800, now + 0.03);
    const lg = ctx.createGain();
    lg.gain.setValueAtTime(0.14, now);
    lg.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    latch.connect(lg); lg.connect(ctx.destination);
    latch.start(now); latch.stop(now + 0.06);
    // Cylinder swing open — low metallic creak
    const creak = ctx.createOscillator(); creak.type = 'sawtooth';
    creak.frequency.setValueAtTime(120, now + 0.04);
    creak.frequency.linearRampToValueAtTime(260, now + 0.12);
    creak.frequency.linearRampToValueAtTime(80, now + 0.2);
    const cf = ctx.createBiquadFilter(); cf.type = 'bandpass';
    cf.frequency.value = 200; cf.Q.value = 6;
    const ckg = ctx.createGain();
    ckg.gain.setValueAtTime(0.06, now + 0.04);
    ckg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    creak.connect(cf); cf.connect(ckg); ckg.connect(ctx.destination);
    creak.start(now + 0.04); creak.stop(now + 0.24);
    // 6 individual bullet insertions — each is a metallic "click-thunk"
    const bulletStart = 0.28;
    const spacing = 0.22; // ~1.32s for all 6
    for (let i = 0; i < 6; i++) {
      const t = now + bulletStart + i * spacing;
      // Bullet slide-in — high metallic scrape
      const slide = ctx.createOscillator(); slide.type = 'square';
      slide.frequency.setValueAtTime(3200 + i * 150, t);
      slide.frequency.exponentialRampToValueAtTime(1200, t + 0.025);
      const slg = ctx.createGain();
      slg.gain.setValueAtTime(0.06, t);
      slg.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
      slide.connect(slg); slg.connect(ctx.destination);
      slide.start(t); slide.stop(t + 0.04);
      // Bullet seat — thunk (low click when bullet seats in chamber)
      const seat = ctx.createOscillator(); seat.type = 'triangle';
      seat.frequency.setValueAtTime(600 + i * 40, t + 0.03);
      seat.frequency.exponentialRampToValueAtTime(180, t + 0.07);
      const sg = ctx.createGain();
      sg.gain.setValueAtTime(0.12, t + 0.03);
      sg.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      seat.connect(sg); sg.connect(ctx.destination);
      seat.start(t + 0.03); seat.stop(t + 0.10);
      // Tiny metallic ring after each insertion
      const ring = ctx.createOscillator(); ring.type = 'sine';
      ring.frequency.setValueAtTime(4800 + i * 200, t + 0.04);
      const rg = ctx.createGain();
      rg.gain.setValueAtTime(0.03, t + 0.04);
      rg.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      ring.connect(rg); rg.connect(ctx.destination);
      ring.start(t + 0.04); ring.stop(t + 0.11);
    }
    // Cylinder snap shut — heavy double click
    const snapT = now + bulletStart + 6 * spacing + 0.08;
    const snap1 = ctx.createOscillator(); snap1.type = 'square';
    snap1.frequency.setValueAtTime(1400, snapT);
    snap1.frequency.exponentialRampToValueAtTime(300, snapT + 0.04);
    const s1g = ctx.createGain();
    s1g.gain.setValueAtTime(0.16, snapT);
    s1g.gain.exponentialRampToValueAtTime(0.001, snapT + 0.06);
    snap1.connect(s1g); s1g.connect(ctx.destination);
    snap1.start(snapT); snap1.stop(snapT + 0.07);
    // Heavy thud on close
    const thud = ctx.createOscillator(); thud.type = 'sine';
    thud.frequency.setValueAtTime(220, snapT + 0.01);
    thud.frequency.exponentialRampToValueAtTime(55, snapT + 0.09);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.13, snapT + 0.01);
    tg.gain.exponentialRampToValueAtTime(0.001, snapT + 0.12);
    thud.connect(tg); tg.connect(ctx.destination);
    thud.start(snapT + 0.01); thud.stop(snapT + 0.13);
    // Cylinder lock click
    const lock = ctx.createOscillator(); lock.type = 'square';
    lock.frequency.setValueAtTime(3500, snapT + 0.06);
    lock.frequency.exponentialRampToValueAtTime(1500, snapT + 0.08);
    const lkg = ctx.createGain();
    lkg.gain.setValueAtTime(0.08, snapT + 0.06);
    lkg.gain.exponentialRampToValueAtTime(0.001, snapT + 0.1);
    lock.connect(lkg); lkg.connect(ctx.destination);
    lock.start(snapT + 0.06); lock.stop(snapT + 0.11);
  }
}

// ─── DOOR PHYSICS ───────────────────────────────────────────────────────────
class DoorPhysics {
  constructor() {
    this.angleL = 0; this.angleR = 0;
    this.velL = 0; this.velR = 0;
    this.stiffness = 14; this.damping = 4.5;
  }
  push(force) { this.velL += force; this.velR += force; }
  update(dt) {
    const accL = -this.stiffness * this.angleL - this.damping * this.velL;
    const accR = -this.stiffness * this.angleR - this.damping * this.velR;
    this.velL += accL * dt; this.velR += accR * dt;
    this.angleL += this.velL * dt; this.angleR += this.velR * dt;
    this.angleL = clamp(this.angleL, -0.1, 1.2);
    this.angleR = clamp(this.angleR, -0.1, 1.2);
  }
}

// ─── GAME ─────────────────────────────────────────────────────────────────────
class WesternShooter {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.scale  = 1;
    this.ox = 0; this.oy = 0;

    this.state    = 'intro';
    this.score    = 0;
    this.bestScore = parseInt(localStorage.getItem('westernShooterBest') || '0', 10);
    this.lives    = MAX_LIVES;
    this.bullets  = MAX_BULLETS;
    this.reloading = false;
    this.reloadTimer = 0;
    this.wave = 1;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.waveEnemies = 4;
    this.spawnTimer = 2;
    this.spawnInterval = 3.5;

    this.enemies   = [];
    this.civilians = [];
    this.particles = [];
    this.alerts    = [];

    // Bottles (interactive)
    this.bottles = [];
    this._initBottles();
    this.chandelierAlive = true;
    this.chandelierRespawn = 0;
    this.bottleRespawnTimer = 0;

    this.aimX = 0.5; this.aimY = 0.4;
    this.smoothAimX = 0.5; this.smoothAimY = 0.4;
    this.recoilT = 0;
    this.crossX = W / 2; this.crossY = H * 0.4;

    this.door = new DoorPhysics();
    this.audio = new AudioManager();
    this.civSpawnTimer = 0;
    this.nextCivDelay = 14;

    this.hitFlash = 0; this.civFlash = 0;
    this.waveBanner = 0; this.lastT = 0; this.time = 0;

    this.dust = Array.from({ length: 22 }, () => ({
      x: rand(0, W), y: rand(20, H * 0.7),
      r: rand(0.8, 2), vy: rand(0.3, 0.8), vx: rand(-0.4, 0.4),
      a: rand(0.04, 0.12),
    }));

    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.setupInput();
    requestAnimationFrame(t => this.loop(t));
  }

  _initBottles() {
    this.bottles = BOTTLE_POSITIONS.map((bx, i) => ({
      x: bx, y: BOTTLE_SHELF_Y, alive: true,
      color: BOTTLE_COLORS[i % BOTTLE_COLORS.length],
    }));
  }

  resize() {
    const dpr = window.devicePixelRatio || 1;
    const cw = window.innerWidth, ch = window.innerHeight;
    this.scale = Math.min(cw / W, ch / H);
    this.ox = (cw - W * this.scale) / 2;
    this.oy = (ch - H * this.scale) / 2;
    this.canvas.width = cw * dpr; this.canvas.height = ch * dpr;
    this.canvas.style.width = cw + 'px';
    this.canvas.style.height = ch + 'px';
    this.dpr = dpr;
  }
  toGame(cx, cy) {
    return { x: (cx - this.ox) / this.scale, y: (cy - this.oy) / this.scale };
  }

  setupInput() {
    const handle = (cx, cy, tap) => {
      const p = this.toGame(cx, cy);
      this.aimX = clamp(p.x / W, 0, 1);
      this.aimY = clamp(p.y / H, 0, 1);
      this.crossX = p.x; this.crossY = p.y;
      if (tap) this.onTap(p.x, p.y);
    };
    this.canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.audio.init(); this.audio.resume();
      handle(e.changedTouches[0].clientX, e.changedTouches[0].clientY, true);
    }, { passive: false });
    this.canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      handle(e.changedTouches[0].clientX, e.changedTouches[0].clientY, false);
    }, { passive: false });
    this.canvas.addEventListener('touchend', e => e.preventDefault(), { passive: false });
    this.canvas.addEventListener('mousedown', e => {
      this.audio.init(); this.audio.resume();
      handle(e.clientX, e.clientY, true);
    });
    this.canvas.addEventListener('mousemove', e => handle(e.clientX, e.clientY, false));
  }

  onTap(x, y) {
    if (this.state === 'intro') {
      if (inRect(x, y, W / 2 - 120, H / 2 + 80, 240, 54)) this.startGame();
      return;
    }
    if (this.state === 'gameover') {
      if (inRect(x, y, W / 2 - 100, H * 0.68, 200, 54)) this.startGame();
      if (inRect(x, y, W / 2 - 80, H * 0.78, 160, 46)) this.exitGame();
      return;
    }
    if (this.state === 'paused') {
      if (inRect(x, y, W / 2 - 90, H / 2 + 15, 180, 50)) { this.state = 'playing'; this.audio.startMusic(); }
      if (inRect(x, y, W / 2 - 80, H / 2 + 81, 160, 46)) this.exitGame();
      return;
    }
    if (this.state !== 'playing') return;
    if (inRect(x, y, W - 44, 6, 38, 30)) { this.state = 'paused'; this.audio.stopMusic(); return; }
    if (y > H - 100 && x < 110) { this.triggerReload(); return; }
    if (this.reloading || this.bullets <= 0) { this.triggerReload(); return; }
    this.fireAt(x, y);
  }

  startGame() {
    this.state = 'playing';
    this.score = 0; this.lives = MAX_LIVES; this.bullets = MAX_BULLETS;
    this.reloading = false; this.reloadTimer = 0;
    this.wave = 1; this.waveSpawned = 0; this.waveKills = 0;
    this.waveEnemies = 4; this.spawnTimer = 2; this.spawnInterval = 3.5;
    this.enemies = []; this.particles = []; this.alerts = [];
    this.hitFlash = 0; this.civFlash = 0; this.waveBanner = 0; this.recoilT = 0;
    this.door = new DoorPhysics();
    this._initBottles();
    this.chandelierAlive = true;
    this.chandelierRespawn = 0;
    this.bottleRespawnTimer = 0;
    this.civSpawnTimer = 0;
    this.nextCivDelay = 14;
    this.initCivilians();
    this.audio.init(); this.audio.resume(); this.audio.startMusic();
  }

  exitGame() {
    this.audio.stopMusic();
    this.state = 'intro';
  }

  initCivilians() {
    this.civilians = [
      { type: 'pianist',   x: 42,  y: 430, alive: true, scared: 0, hitTimer: 0 },
      { type: 'bartender', x: 360, y: 350, alive: true, scared: 0, hitTimer: 0 },
      { type: 'patron',    x: 215, y: 440, alive: true, scared: 0, hitTimer: 0 },
      { type: 'poker1',    x: 108, y: 460, alive: true, scared: 0, hitTimer: 0 },
      { type: 'poker2',    x: 132, y: 460, alive: true, scared: 0, hitTimer: 0 },
      { type: 'drinker',   x: 435, y: 358, alive: true, scared: 0, hitTimer: 0 },
    ];
  }

  triggerReload() {
    if (this.reloading || this.bullets === MAX_BULLETS) return;
    this.reloading = true; this.reloadTimer = RELOAD_TIME;
    this.audio.playReload();
  }

  fireAt(x, y) {
    this.bullets--;
    this.recoilT = RECOIL_DUR;
    this.audio.playGunshot();

    const gunTipX = W / 2 + (this.smoothAimX - 0.5) * GUN_PAN_X;
    const gunTipY = H - 170 + (this.smoothAimY - 0.5) * GUN_PAN_Y;
    this.particles.push({ type: 'flash', x: gunTipX, y: gunTipY, t: 0.13 });

    for (const c of this.civilians) { if (c.alive && c.hitTimer <= 0) c.scared = 1.5; }

    let hit = false;

    // Check enemies
    for (const e of this.enemies) {
      if (!e.visible) continue;
      const hb = enemyHB(e);
      if (inRect(x, y, hb.x, hb.y, hb.w, hb.h)) { this.damageEnemy(e); hit = true; break; }
    }

    // Check civilians
    if (!hit) {
      for (const c of this.civilians) {
        if (!c.alive || c.hitTimer > 0) continue;
        const hb = civHB(c);
        if (inRect(x, y, hb.x, hb.y, hb.w, hb.h)) { this.hitCivilian(c); hit = true; break; }
      }
    }

    // Check bottles
    if (!hit) {
      for (const b of this.bottles) {
        if (!b.alive) continue;
        if (inRect(x, y, b.x - 2, b.y - 7, 14, 27)) {
          b.alive = false;
          b.respawnTimer = 15 + rand(0, 10);
          this.audio.playGlassShatter();
          // Glass debris particles
          for (let i = 0; i < 8; i++) {
            this.particles.push({
              type: 'glass', x: b.x + 5, y: b.y + 8,
              vx: rand(-3, 3), vy: rand(-4, -1), t: rand(0.4, 0.8),
              color: b.color,
            });
          }
          this.alerts.push({ text: '+10', x: b.x + 5, y: b.y - 10, t: 0.8, color: '#88CCFF' });
          this.score += 10;
          hit = true;
          break;
        }
      }
    }

    // Check chandelier
    if (!hit && this.chandelierAlive) {
      const chCx = W / 2, chCy = 36;
      if (inRect(x, y, chCx - 22, chCy - 16, 44, 32)) {
        this.chandelierAlive = false;
        this.chandelierRespawn = 20 + rand(0, 10);
        this.audio.playChandelierCrash();
        // Metal & glass debris
        for (let i = 0; i < 14; i++) {
          this.particles.push({
            type: 'glass', x: chCx + rand(-18, 18), y: chCy + rand(-8, 8),
            vx: rand(-4, 4), vy: rand(-2, 3), t: rand(0.5, 1.2),
            color: i % 2 ? '#DAA520' : '#FF8C00',
          });
        }
        // Sparks
        for (let i = 0; i < 6; i++) {
          this.particles.push({
            type: 'glass', x: chCx + rand(-10, 10), y: chCy,
            vx: rand(-2, 2), vy: rand(-5, -2), t: rand(0.3, 0.6),
            color: '#FFE080',
          });
        }
        this.alerts.push({ text: '+20', x: chCx, y: chCy - 18, t: 1.0, color: '#FFD700' });
        this.score += 20;
        hit = true;
      }
    }

    if (!hit) this.particles.push({ type: 'hole', x, y, t: 6 });
    if (this.bullets === 0) setTimeout(() => this.triggerReload(), 350);
  }

  hitCivilian(c) {
    c.hitTimer = 2.5; c.scared = 2.5;
    this.score = Math.max(0, this.score - CIV_PENALTY);
    this.lives = Math.max(0, this.lives - 1);
    this.civFlash = 0.6;
    this.alerts.push({ text: `INNOCENT! -${CIV_PENALTY}`, x: c.x, y: c.y - 55, t: 2, color: '#FF4444' });
    if (this.lives === 0) this.endGame();
  }

  damageEnemy(e) {
    e.hp--;
    const hb = enemyHB(e);
    const cx = hb.x + hb.w / 2, cy = hb.y + hb.h / 2;
    for (let i = 0; i < 6; i++) {
      this.particles.push({ type: 'blood', x: cx, y: cy, vx: rand(-2.5, 2.5), vy: rand(-3, -0.5), t: rand(0.3, 0.65) });
    }
    this.particles.push({ type: 'hit', x: cx, y: cy, t: 0.2 });
    if (e.hp <= 0) {
      e.state = 'dead'; e.visible = true; e.deadT = 0.7;
      const pts = 100 * this.wave;
      this.score += pts;
      this.alerts.push({ text: `+${pts}`, x: cx, y: cy - 28, t: 1, color: '#FFD700' });
      this.waveKills++;
      if (this.waveKills >= this.waveEnemies) setTimeout(() => this.advanceWave(), 2000);
    } else {
      e.state = 'retreating'; e.retreatT = 0.45;
      setTimeout(() => { if (e.state !== 'dead') { e.state = 'hiding'; e.hideT = rand(1, 2.5); e.visible = false; } }, 460);
    }
  }

  enemyShoot(e) {
    if (e.state === 'dead') return;
    e.state = 'shooting'; e.shootT = 0.4;
    this.audio.playEnemyShot();
    this.particles.push({ type: 'eflash', x: e.drawX - 18, y: e.drawY + 6, t: 0.13 });
    setTimeout(() => { if (e.state !== 'dead') this.takeDamage(); }, 250);
    setTimeout(() => { if (e.state !== 'dead') { e.state = 'hiding'; e.hideT = rand(0.8, 2); e.visible = false; } }, 700);
  }

  takeDamage() {
    if (this.state !== 'playing') return;
    this.lives = Math.max(0, this.lives - 1);
    this.hitFlash = 0.55;
    if (this.lives === 0) this.endGame();
  }

  endGame() {
    this.bestScore = Math.max(this.bestScore, this.score);
    try { localStorage.setItem('westernShooterBest', String(this.bestScore)); } catch (_) {}
    this.audio.stopMusic();
    setTimeout(() => { this.state = 'gameover'; }, 500);
  }

  advanceWave() {
    if (this.state !== 'playing') return;
    this.wave++;
    this.waveSpawned = 0; this.waveKills = 0;
    this.waveEnemies = 4 + this.wave;
    this.spawnInterval = Math.max(1.6, 3.5 - this.wave * 0.18);
    this.spawnTimer = 1.8; this.waveBanner = 2.5;
    this.enemies = [];
    this.civilians = this.civilians.filter(c => c.type !== 'doorCiv');
    for (const c of this.civilians) { c.scared = 0; c.hitTimer = 0; }
    // Reset bottles each wave
    this._initBottles();
  }

  spawnEnemy() {
    const used = new Set(this.enemies.filter(e => e.state !== 'dead').map(e => e.slotId));
    const avail = SPAWN_SLOTS.filter(s => s.minWave <= this.wave && !used.has(s.id));
    if (!avail.length) return;
    const slot = avail[Math.floor(Math.random() * avail.length)];
    const isGround = slot.type === 'cover';
    if (isGround) { this.door.push(8); this.audio.playDoorCreak(); }

    let hp = 1;
    if (this.wave >= 5 && this.wave < 9) hp = Math.random() < 0.45 ? 2 : 1;
    else if (this.wave >= 9) { const r = Math.random(); hp = r < 0.2 ? 3 : r < 0.7 ? 2 : 1; }

    this.enemies.push({
      slotId: slot.id, slot, posType: slot.type,
      hp, maxHp: hp,
      outfit: Math.floor(Math.random() * OUTFITS.length),
      state: isGround ? 'entering' : 'appearing',
      visible: true,
      drawX: isGround ? DOOR_CX : slot.x,
      drawY: isGround ? DOOR_BOT - 30 : slot.peekY,
      peekY: slot.peekY,
      walkFrame: 0, walkT: 0, appearT: 0.6,
      hideT: 0, warnT: 0, peekT: 0,
      retreatT: 0, deadT: 0, shootT: 0,
    });
    this.waveSpawned++;
  }

  // ── Roaming civilian helpers ────────────────────────────────────────────────
  _spawnRoamingCiv() {
    this.civSpawnTimer = this.nextCivDelay + rand(0, 5);
    this.nextCivDelay = Math.max(6, this.nextCivDelay - 0.5);
    const types = ['cowgirl', 'oldman', 'townsfolk'];
    const subtype = types[Math.floor(Math.random() * types.length)];

    // Determine spawn mode based on wave
    let mode = 'door';
    if (this.wave >= 7) {
      const r = Math.random();
      if (r < 0.25) mode = 'balcony';
      else if (r < 0.50) mode = 'window';
      else mode = 'door';
    } else if (this.wave >= 4) {
      mode = Math.random() < 0.35 ? 'window' : 'door';
    }

    if (mode === 'door') {
      const goLeft = Math.random() < 0.5;
      this.door.push(6); this.audio.playDoorCreak();
      this.civilians.push({
        type: 'doorCiv', subtype, spawnMode: 'door',
        x: DOOR_CX, y: DOOR_BOT - 30,
        targetX: goLeft ? rand(100, 190) : rand(320, 420),
        targetY: 442,
        alive: true, scared: 0, hitTimer: 0,
        civState: 'entering', walkFrame: 0, walkT: 0, stayTimer: 0,
      });
    } else if (mode === 'window') {
      const win = WINDOWS[Math.floor(Math.random() * WINDOWS.length)];
      this.civilians.push({
        type: 'doorCiv', subtype, spawnMode: 'window',
        x: win.x, y: win.y + 5,
        alive: true, scared: 0, hitTimer: 0,
        civState: 'appearing', appearT: 0.5, stayTimer: rand(4, 8),
        drawAlpha: 0,
      });
    } else {
      const bx = [120, 240, 360][Math.floor(Math.random() * 3)];
      this.civilians.push({
        type: 'doorCiv', subtype, spawnMode: 'balcony',
        x: bx, y: 78,
        alive: true, scared: 0, hitTimer: 0,
        civState: 'appearing', appearT: 0.5, stayTimer: rand(4, 8),
        drawAlpha: 0,
      });
    }
  }

  _updateDoorCiv(c, dt) {
    const spd = 70 * dt;
    if (c.spawnMode === 'door') {
      if (c.civState === 'entering') {
        const dx = c.targetX - c.x, dy = (c.targetY || 442) - c.y;
        if (Math.abs(dx) < spd && Math.abs(dy) < spd) {
          c.x = c.targetX; c.y = c.targetY || 442;
          c.civState = 'idle'; c.stayTimer = rand(6, 12);
        } else {
          c.x += Math.sign(dx) * Math.min(spd, Math.abs(dx));
          c.y += Math.sign(dy) * Math.min(spd * 0.7, Math.abs(dy));
          c.walkT = (c.walkT || 0) + dt; if (c.walkT > 0.18) { c.walkT = 0; c.walkFrame = (c.walkFrame || 0) ^ 1; }
        }
      } else if (c.civState === 'idle') {
        c.stayTimer -= dt;
        if (c.stayTimer <= 0) { c.civState = 'leaving'; c.targetX = DOOR_CX; c.targetY = DOOR_BOT - 30; }
      } else if (c.civState === 'leaving') {
        const dx = DOOR_CX - c.x, dy = (DOOR_BOT - 30) - c.y;
        if (Math.abs(dx) < spd && Math.abs(dy) < spd) { c.alive = false; this.door.push(4); }
        else {
          c.x += Math.sign(dx) * Math.min(spd, Math.abs(dx));
          c.y += Math.sign(dy) * Math.min(spd * 0.7, Math.abs(dy));
          c.walkT = (c.walkT || 0) + dt; if (c.walkT > 0.18) { c.walkT = 0; c.walkFrame = (c.walkFrame || 0) ^ 1; }
        }
      }
    } else {
      // window / balcony civs: appear → idle → disappear
      if (c.civState === 'appearing') {
        c.appearT -= dt;
        c.drawAlpha = clamp(1 - c.appearT / 0.5, 0, 1);
        if (c.appearT <= 0) { c.civState = 'idle'; c.drawAlpha = 1; }
      } else if (c.civState === 'idle') {
        c.drawAlpha = 1;
        c.stayTimer -= dt;
        if (c.stayTimer <= 0) { c.civState = 'disappearing'; c.appearT = 0.4; }
      } else if (c.civState === 'disappearing') {
        c.appearT -= dt;
        c.drawAlpha = clamp(c.appearT / 0.4, 0, 1);
        if (c.appearT <= 0) c.alive = false;
      }
    }
  }

  // ─── UPDATE ─────────────────────────────────────────────────────────────────
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
    this.smoothAimX = lerp(this.smoothAimX, this.aimX, Math.min(1, dt * GUN_AIM_LERP));
    this.smoothAimY = lerp(this.smoothAimY, this.aimY, Math.min(1, dt * GUN_AIM_LERP));
    this.door.update(dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt * 2.2);
    if (this.civFlash > 0) this.civFlash = Math.max(0, this.civFlash - dt * 2.0);
    if (this.waveBanner > 0) this.waveBanner -= dt;
    if (this.recoilT > 0) this.recoilT = Math.max(0, this.recoilT - dt);
    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) { this.reloading = false; this.reloadTimer = 0; this.bullets = MAX_BULLETS; }
    }
    for (const d of this.dust) {
      d.x += d.vx * dt * 25; d.y -= d.vy * dt * 15;
      if (d.y < -5) { d.y = H * 0.7 + rand(0, 40); d.x = rand(0, W); }
      if (d.x < 0) d.x = W; if (d.x > W) d.x = 0;
    }
    for (const a of this.alerts) { a.t -= dt; a.y -= dt * 28; }
    this.alerts = this.alerts.filter(a => a.t > 0);
    for (const c of this.civilians) {
      if (c.scared > 0) c.scared = Math.max(0, c.scared - dt);
      if (c.hitTimer > 0) c.hitTimer = Math.max(0, c.hitTimer - dt);
      if (c.type === 'doorCiv') this._updateDoorCiv(c, dt);
    }
    this.civilians = this.civilians.filter(c => c.alive || c.hitTimer > 0);
    // Spawn roaming civilians starting wave 2
    if (this.wave >= 2) {
      this.civSpawnTimer -= dt;
      if (this.civSpawnTimer <= 0) {
        this._spawnRoamingCiv();
      }
    }
    const active = this.enemies.filter(e => e.state !== 'dead').length;
    const maxActive = clamp(2 + Math.floor(this.wave * 0.45), 1, 5);
    if (active < maxActive && this.waveSpawned < this.waveEnemies) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) { this.spawnTimer = this.spawnInterval + rand(0, 0.8); this.spawnEnemy(); }
    }
    this.enemies.forEach(e => this.updateEnemy(e, dt));
    this.enemies = this.enemies.filter(e => !(e.state === 'dead' && e.deadT <= 0));
    this.particles.forEach(p => {
      p.t -= dt;
      if (p.vx !== undefined) { p.x += p.vx; p.y += p.vy; p.vy += 0.18; }
    });
    this.particles = this.particles.filter(p => p.t > 0);
    // Respawn bottles
    for (const b of this.bottles) {
      if (!b.alive && b.respawnTimer !== undefined) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) { b.alive = true; b.respawnTimer = undefined; }
      }
    }
    // Respawn chandelier
    if (!this.chandelierAlive && this.chandelierRespawn > 0) {
      this.chandelierRespawn -= dt;
      if (this.chandelierRespawn <= 0) this.chandelierAlive = true;
    }
  }

  updateEnemy(e, dt) {
    const spd = (100 + this.wave * 8) * dt;
    switch (e.state) {
      case 'entering': {
        e.walkT += dt;
        if (e.walkT > 0.14) { e.walkT = 0; e.walkFrame ^= 1; }
        const dx = e.slot.x - e.drawX, dy = e.slot.peekY - e.drawY;
        if (Math.abs(dx) < spd && Math.abs(dy) < spd) {
          e.drawX = e.slot.x; e.drawY = e.slot.peekY;
          e.state = 'hiding'; e.hideT = rand(0.5, 1.4); e.visible = false;
        } else {
          e.drawX += Math.sign(dx) * Math.min(spd, Math.abs(dx));
          e.drawY += Math.sign(dy) * Math.min(spd * 0.5, Math.abs(dy));
        }
        break;
      }
      case 'appearing': e.appearT -= dt; if (e.appearT <= 0) { e.state = 'hiding'; e.hideT = rand(0.3, 0.9); e.visible = false; } break;
      case 'hiding':
        e.hideT -= dt;
        if (e.hideT <= 0) { e.state = 'warning'; e.warnT = rand(0.5, 1.0); e.visible = true; e.drawY = e.peekY + (e.posType === 'cover' ? 28 : 16); }
        break;
      case 'warning':
        e.warnT -= dt;
        e.drawY = e.peekY + (e.posType === 'cover' ? 26 : 14) + Math.sin(this.time * 13) * 4;
        if (e.warnT <= 0) { e.state = 'peeking'; e.peekT = rand(0.9, 1.6); e.drawY = e.peekY; }
        break;
      case 'peeking': e.peekT -= dt; if (e.peekT <= 0) this.enemyShoot(e); break;
      case 'shooting': e.shootT -= dt; break;
      case 'retreating': e.retreatT -= dt; e.drawY = e.peekY + (1 - clamp(e.retreatT / 0.45, 0, 1)) * 32; break;
      case 'dead': e.deadT -= dt; e.drawY += dt * 50; break;
    }
  }

  // ─── RENDER ─────────────────────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.translate(this.ox, this.oy);
    ctx.scale(this.scale, this.scale);
    switch (this.state) {
      case 'intro':    this.drawIntro(ctx); break;
      case 'playing':  this.drawGame(ctx);  break;
      case 'paused':   this.drawPaused(ctx); break;
      case 'gameover': this.drawGameOver(ctx); break;
    }
    ctx.restore();
  }

  drawIntro(ctx) {
    this.drawScene(ctx); this.drawDoors(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = 'bold 54px Georgia, serif';
    ctx.strokeStyle = '#2A1000'; ctx.lineWidth = 6;
    ctx.strokeText('OFFLINE', W / 2, H / 2 - 80);
    ctx.strokeText('SHOOTER', W / 2, H / 2 - 18);
    ctx.fillStyle = '#FFD700';
    ctx.fillText('OFFLINE', W / 2, H / 2 - 80);
    ctx.fillText('SHOOTER', W / 2, H / 2 - 18);
    ctx.font = '17px Georgia, serif'; ctx.fillStyle = '#DEB887';
    ctx.fillText('The Sheriff cleans up the saloon!', W / 2, H / 2 + 24);
    ctx.fillText('Tap outlaws  •  Spare civilians  •  6 bullets', W / 2, H / 2 + 48);
    if (this.bestScore > 0) {
      ctx.font = '16px Georgia, serif'; ctx.fillStyle = '#DAA520';
      ctx.fillText(`High Score: ${this.bestScore}`, W / 2, H / 2 + 72);
    }
    ctx.restore();
    this.drawBtn(ctx, W / 2, H / 2 + 108, 240, 52, 'ENTER THE BAR');
    this._drawCredit(ctx, H - 42);
  }

  drawGameOver(ctx) {
    this.drawScene(ctx); this.drawDoors(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.74)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = 'bold 52px Georgia, serif';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText('GAME OVER', W / 2, H * 0.33);
    ctx.fillStyle = '#CC1111'; ctx.fillText('GAME OVER', W / 2, H * 0.33);
    ctx.font = 'bold 28px Georgia, serif'; ctx.fillStyle = '#FFD700';
    ctx.fillText(`Score: ${this.score}`, W / 2, H * 0.45);
    ctx.fillText(`Wave:  ${this.wave}`, W / 2, H * 0.53);
    if (this.bestScore > 0) {
      ctx.font = '18px Georgia, serif'; ctx.fillStyle = '#DEB887';
      ctx.fillText(`Best: ${this.bestScore}`, W / 2, H * 0.60);
    }
    ctx.restore();
    this.drawBtn(ctx, W / 2, H * 0.70, 200, 52, 'PLAY AGAIN');
    this.drawBtn(ctx, W / 2, H * 0.80, 160, 44, 'EXIT');
    this._drawCredit(ctx, H - 42);
  }

  drawPaused(ctx) {
    this.drawScene(ctx); this.drawDoors(ctx);
    for (const c of COVERS) this.drawCover(ctx, c);
    for (const c of this.civilians) this.drawCivilian(ctx, c);
    this.drawFPSGun(ctx); this.drawHUD(ctx);
    ctx.fillStyle = 'rgba(0,0,0,0.58)'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.textAlign = 'center';
    ctx.font = 'bold 46px Georgia, serif';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText('PAUSED', W / 2, H / 2 - 18);
    ctx.fillStyle = '#FFD700'; ctx.fillText('PAUSED', W / 2, H / 2 - 18);
    ctx.restore();
    this.drawBtn(ctx, W / 2, H / 2 + 42, 180, 48, 'RESUME');
    this.drawBtn(ctx, W / 2, H / 2 + 105, 160, 44, 'EXIT');
    this._drawCredit(ctx, H - 42);
  }

  drawBtn(ctx, cx, cy, bw, bh, txt) {
    const x = cx - bw / 2, y = cy - bh / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    drawRR(ctx, x + 2, y + 3, bw, bh, 8); ctx.fill();
    const bg = ctx.createLinearGradient(x, y, x, y + bh);
    bg.addColorStop(0, '#B85A20'); bg.addColorStop(1, '#7A3210');
    ctx.fillStyle = bg; drawRR(ctx, x, y, bw, bh, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,120,0.4)'; ctx.lineWidth = 1;
    drawRR(ctx, x + 2, y + 2, bw - 4, bh - 4, 6); ctx.stroke();
    ctx.fillStyle = '#FFE8B0'; ctx.font = 'bold 20px Georgia, serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, cy + 1); ctx.textBaseline = 'alphabetic';
  }

  // ── Main game draw ──────────────────────────────────────────────────────────
  drawGame(ctx) {
    this.drawScene(ctx);

    // Balcony enemies + balcony civs → railing
    for (const e of this.enemies) { if (e.posType === 'balcony' && e.visible) this.drawEnemy(ctx, e); }
    for (const c of this.civilians) { if (c.type === 'doorCiv' && c.spawnMode === 'balcony') this.drawCivilian(ctx, c); }
    this.drawBalconyRail(ctx);

    // Doors FIRST, then entering enemies & door civs ON TOP
    this.drawDoors(ctx);
    for (const e of this.enemies) { if (e.state === 'entering' && e.visible) this.drawEnemy(ctx, e); }
    for (const c of this.civilians) { if (c.type === 'doorCiv' && c.spawnMode === 'door' && (c.civState === 'entering' || c.civState === 'leaving')) this.drawCivilian(ctx, c); }

    // Window enemies + window civs → frames
    for (const e of this.enemies) { if (e.posType === 'window' && e.visible && e.state !== 'entering') this.drawEnemy(ctx, e); }
    for (const c of this.civilians) { if (c.type === 'doorCiv' && c.spawnMode === 'window') this.drawCivilian(ctx, c); }
    this.drawWindowFrames(ctx);

    // Ground enemies → cover tables
    for (const e of this.enemies) { if (e.posType === 'cover' && e.state !== 'entering' && e.visible) this.drawEnemy(ctx, e); }
    for (const c of COVERS) this.drawCover(ctx, c);
    // Decorative tables
    for (const dt of DECO_TABLES) this.drawRoundTable(ctx, dt.x, dt.y, dt.w, dt.h);
    this.drawChairs(ctx);

    // Piano drawn ON TOP of tables for visibility
    this.drawPiano(ctx);

    // Ground-idle civs (static + idle door civs)
    for (const c of this.civilians) {
      if (c.type === 'doorCiv' && (c.spawnMode === 'window' || c.spawnMode === 'balcony')) continue;
      if (c.type === 'doorCiv' && (c.civState === 'entering' || c.civState === 'leaving')) continue;
      this.drawCivilian(ctx, c);
    }

    // FPS gun
    this.drawFPSGun(ctx);

    // Particles
    this.drawParticles(ctx);

    // Screen flashes
    if (this.hitFlash > 0) { ctx.fillStyle = `rgba(180,0,0,${this.hitFlash * 0.5})`; ctx.fillRect(0, 0, W, H); }
    if (this.civFlash > 0) { ctx.fillStyle = `rgba(220,180,0,${this.civFlash * 0.45})`; ctx.fillRect(0, 0, W, H); }

    // Floating alerts
    for (const a of this.alerts) {
      ctx.save(); ctx.globalAlpha = clamp(a.t, 0, 1);
      ctx.font = 'bold 18px Georgia, serif'; ctx.textAlign = 'center';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.strokeText(a.text, a.x, a.y);
      ctx.fillStyle = a.color; ctx.fillText(a.text, a.x, a.y);
      ctx.restore();
    }

    // Wave banner
    if (this.waveBanner > 0 && this.waveBanner < 2.5) {
      const a = clamp(Math.min(this.waveBanner, 2.5 - this.waveBanner) * 1.8, 0, 1);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center';
      ctx.font = 'bold 44px Georgia, serif';
      ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
      ctx.strokeText(`WAVE ${this.wave}`, W / 2, H * 0.38);
      ctx.fillStyle = '#FFD700'; ctx.fillText(`WAVE ${this.wave}`, W / 2, H * 0.38);
      ctx.restore();
    }

    this.drawHUD(ctx);
  }

  // ─── SCENE ──────────────────────────────────────────────────────────────────
  drawScene(ctx) {
    // Ceiling
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i % 2 ? '#4E3614' : '#5A4018';
      ctx.fillRect(0, i * 18, W, 18);
      ctx.fillStyle = '#3A2808'; ctx.fillRect(0, i * 18 + 16, W, 2);
    }
    // Wall
    for (let i = 0; i < 9; i++) {
      const y0 = WALL_TOP + i * 22;
      ctx.fillStyle = i % 2 ? '#6B5018' : '#7A5E22';
      ctx.fillRect(0, y0, W, 22);
      ctx.fillStyle = '#4A350E'; ctx.fillRect(0, y0 + 20, W, 2);
    }
    // Wanted posters — clear of door frame and window
    this.drawWanted(ctx, 108, 170);
    this.drawWanted(ctx, 320, 170);
    // Window backs
    for (const w of WINDOWS) this.drawWindowBack(ctx, w);
    // Shelf + bottles
    ctx.fillStyle = '#6B3A10'; ctx.fillRect(0, BAR_Y - 48, W, 18);
    this.drawBottles(ctx);
    // Bar counter
    const barGrad = ctx.createLinearGradient(0, BAR_Y, 0, BAR_Y + BAR_H);
    barGrad.addColorStop(0, '#A0562A'); barGrad.addColorStop(0.1, '#8B4513');
    barGrad.addColorStop(0.9, '#6B300E'); barGrad.addColorStop(1, '#4A2008');
    ctx.fillStyle = barGrad; ctx.fillRect(0, BAR_Y, W, BAR_H);
    ctx.fillStyle = '#B8682E'; ctx.fillRect(0, BAR_Y, W, 4);
    this.drawBarItems(ctx);
    // Dark door opening
    ctx.fillStyle = '#060300';
    ctx.fillRect(DOOR_CX - DOOR_W / 2, DOOR_TOP, DOOR_W, DOOR_BOT - DOOR_TOP);
    // Door frame
    ctx.fillStyle = '#3A2008';
    ctx.fillRect(DOOR_CX - DOOR_W / 2 - 8, DOOR_TOP - 6, DOOR_W + 16, 6);
    ctx.fillRect(DOOR_CX - DOOR_W / 2 - 8, DOOR_TOP - 6, 8, DOOR_BOT - DOOR_TOP + 12);
    ctx.fillRect(DOOR_CX + DOOR_W / 2, DOOR_TOP - 6, 8, DOOR_BOT - DOOR_TOP + 12);
    // "SALOON" sign
    ctx.fillStyle = '#4A2808';
    drawRR(ctx, DOOR_CX - 40, DOOR_TOP - 30, 80, 22, 3); ctx.fill();
    ctx.fillStyle = '#DAA520'; ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('SALOON', DOOR_CX, DOOR_TOP - 13);
    // Floor
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#6B3415' : '#7A3E1A';
      ctx.fillRect(0, FLOOR_Y + i * 22, W, 22);
      ctx.fillStyle = '#4A2410'; ctx.fillRect(0, FLOOR_Y + i * 22 + 20, W, 2);
    }
    // Chandelier
    this.drawChandelier(ctx);
    // Light cone — dimmer when chandelier is broken
    if (this.chandelierAlive) {
      const lg = ctx.createRadialGradient(W / 2, 40, 0, W / 2, 40, 340);
      lg.addColorStop(0, 'rgba(255,210,100,0.18)');
      lg.addColorStop(0.5, 'rgba(255,170,50,0.06)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    } else {
      const lg = ctx.createRadialGradient(W / 2, 40, 0, W / 2, 40, 200);
      lg.addColorStop(0, 'rgba(255,180,60,0.04)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    }
    // Vignette
    const vig = ctx.createRadialGradient(W / 2, H * 0.42, H * 0.2, W / 2, H * 0.42, H * 0.85);
    vig.addColorStop(0, 'rgba(0,0,0,0)'); vig.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
    // Dust
    ctx.save();
    for (const d of this.dust) {
      ctx.globalAlpha = d.a; ctx.fillStyle = '#FFE0A0';
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  // ── Batwing Doors — LOW position, large open space ABOVE ──
  drawDoors(ctx) {
    const halfW = DOOR_W / 2 - 2;
    const panelH = DOOR_PANEL_H;
    const louverH = panelH * 0.55;
    const aL = this.door.angleL;
    const aR = this.door.angleR;

    ctx.save();
    ctx.translate(DOOR_CX, DOOR_PANEL_TOP);

    // Left panel
    ctx.save();
    ctx.translate(-halfW, 0);
    ctx.scale(Math.cos(aL), 1);
    this.drawBatwingPanel(ctx, 0, 0, halfW, panelH, louverH, false);
    ctx.restore();

    // Right panel
    ctx.save();
    ctx.translate(halfW, 0);
    ctx.scale(-Math.cos(aR), 1);
    this.drawBatwingPanel(ctx, 0, 0, halfW, panelH, louverH, true);
    ctx.restore();

    ctx.restore();
  }

  drawBatwingPanel(ctx, x, y, w, h, louverH, mirror) {
    const pGrad = ctx.createLinearGradient(x, y, x + w, y);
    pGrad.addColorStop(0, '#9B6020'); pGrad.addColorStop(0.3, '#8B5018');
    pGrad.addColorStop(0.7, '#7A4414'); pGrad.addColorStop(1, '#6A3810');
    ctx.fillStyle = pGrad; ctx.fillRect(x, y, w, h);

    ctx.fillStyle = '#6A3810';
    ctx.fillRect(x, y, w, 5);        // top rail
    ctx.fillRect(x, y + h - 5, w, 5); // bottom rail
    ctx.fillRect(x, y + louverH + 8, w, 4); // middle rail

    // Louvers
    const slotCount = 7, slotStart = y + 8;
    for (let i = 0; i < slotCount; i++) {
      const sy = slotStart + (i / slotCount) * louverH;
      const sp = louverH / slotCount;
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x + 3, sy, w - 6, 1);
      const sG = ctx.createLinearGradient(x, sy, x, sy + sp * 0.7);
      sG.addColorStop(0, '#A8702C'); sG.addColorStop(0.5, '#8B5A20'); sG.addColorStop(1, '#7A4A18');
      ctx.fillStyle = sG; ctx.fillRect(x + 3, sy + 1, w - 6, sp * 0.55);
      ctx.fillStyle = 'rgba(255,220,150,0.12)'; ctx.fillRect(x + 3, sy + 1, w - 6, 1);
    }

    // Solid bottom panel
    const solidY = y + louverH + 12, solidH = h - louverH - 17;
    ctx.fillStyle = '#7A4A18'; ctx.fillRect(x + 2, solidY, w - 4, solidH);

    // Scalloped edge
    ctx.fillStyle = '#6A3810';
    ctx.beginPath();
    ctx.moveTo(x, y + h - 5);
    ctx.quadraticCurveTo(x + w * 0.25, y + h + 5, x + w * 0.5, y + h - 5);
    ctx.quadraticCurveTo(x + w * 0.75, y + h + 5, x + w, y + h - 5);
    ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); ctx.closePath(); ctx.fill();

    // Wood grain
    ctx.strokeStyle = 'rgba(40,20,5,0.15)'; ctx.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      const gy = solidY + 4 + i * (solidH / 3);
      ctx.beginPath(); ctx.moveTo(x + 4, gy);
      ctx.quadraticCurveTo(x + w / 2, gy + (i % 2 ? 2 : -2), x + w - 4, gy + 1); ctx.stroke();
    }

    // Stiles
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x, y, 3, h); ctx.fillRect(x + w - 3, y, 3, h);

    // Hinge pins (always on wall side; mirror flips via scale)
    ctx.fillStyle = '#C8A030';
    const hx = x + 2;
    [y + 12, y + h / 2, y + h - 12].forEach(hy => {
      ctx.beginPath(); ctx.arc(hx, hy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#8A6A10'; ctx.lineWidth = 0.8; ctx.stroke();
    });
  }

  // ── Windows ─────────────────────────────────────────────────────────────────
  drawWindowBack(ctx, win) {
    const x = win.x - win.w / 2, y = win.y - win.h / 2;
    ctx.fillStyle = '#070308'; ctx.fillRect(x + 3, y + 3, win.w - 6, win.h - 6);
    ctx.fillStyle = 'rgba(20,30,60,0.35)'; ctx.fillRect(x + 3, y + 3, win.w - 6, win.h - 6);
    ctx.fillStyle = 'rgba(255,255,200,0.3)';
    ctx.beginPath(); ctx.arc(x + 12, y + 12, 1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + win.w - 14, y + 18, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  drawWindowFrames(ctx) {
    for (const win of WINDOWS) {
      const x = win.x - win.w / 2, y = win.y - win.h / 2;
      ctx.strokeStyle = '#4A2C08'; ctx.lineWidth = 5; ctx.strokeRect(x, y, win.w, win.h);
      ctx.fillStyle = '#5A3A10'; ctx.fillRect(x - 3, y + win.h - 2, win.w + 6, 6);
      ctx.strokeStyle = '#4A2C08'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(win.x, y); ctx.lineTo(win.x, y + win.h);
      ctx.moveTo(x, win.y); ctx.lineTo(x + win.w, win.y); ctx.stroke();
      ctx.fillStyle = '#5A3A1E'; ctx.fillRect(x - 10, y, 10, win.h); ctx.fillRect(x + win.w, y, 10, win.h);
      ctx.strokeStyle = '#3A2210'; ctx.lineWidth = 0.8;
      for (let i = 0; i < 5; i++) {
        const sy = y + 6 + i * (win.h / 5);
        ctx.beginPath();
        ctx.moveTo(x - 9, sy); ctx.lineTo(x - 1, sy);
        ctx.moveTo(x + win.w + 1, sy); ctx.lineTo(x + win.w + 9, sy); ctx.stroke();
      }
    }
  }

  drawBalconyRail(ctx) {
    ctx.fillStyle = '#5A3210'; ctx.fillRect(0, RAIL_Y, W, 5);
    ctx.fillStyle = '#6B3A10'; ctx.fillRect(0, BALCONY_Y, W, 6);
    ctx.fillStyle = '#7A4A18';
    for (let i = 0; i < 17; i++) ctx.fillRect(12 + i * 28, BALCONY_Y + 5, 5, RAIL_Y - BALCONY_Y - 4);
    ctx.fillStyle = '#5A3210';
    for (let i = 0; i < 5; i++) {
      const px = 56 + i * 95;
      ctx.fillRect(px, BALCONY_Y - 2, 8, RAIL_Y - BALCONY_Y + 8);
      ctx.fillStyle = '#7A5020'; ctx.fillRect(px - 2, BALCONY_Y - 4, 12, 4);
      ctx.fillStyle = '#5A3210';
    }
  }

  // ── Scene props ─────────────────────────────────────────────────────────────
  drawChandelier(ctx) {
    const cx = W / 2, cy = 36;
    // Chain from ceiling
    ctx.strokeStyle = '#8B6914'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, cy - 8); ctx.stroke();
    if (!this.chandelierAlive) {
      // Broken: just dangling chain + sparks
      ctx.strokeStyle = '#5A4010'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy - 8); ctx.lineTo(cx - 3, cy + 4); ctx.stroke();
      // Occasional spark
      if (Math.sin(this.time * 7) > 0.7) {
        ctx.fillStyle = '#FFD700'; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(cx - 1, cy, 2, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
      return;
    }
    // Main body
    ctx.fillStyle = '#B8860B'; ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#DAA520'; ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.fill();
    // Candles with flickering flames
    for (let j = -2; j <= 2; j++) {
      const fx = cx + j * 9;
      const flicker = Math.sin(this.time * 8 + j * 2) * 1.5;
      ctx.fillStyle = '#FF8C00'; ctx.beginPath(); ctx.arc(fx, cy - 8, 3.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FFD700'; ctx.beginPath(); ctx.arc(fx, cy - 11 + flicker, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,80,0.3)'; ctx.beginPath(); ctx.arc(fx, cy - 10 + flicker, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  drawWanted(ctx, x, y) {
    const pw = 56, ph = 72;
    // Aged parchment background
    ctx.save();
    ctx.fillStyle = '#E8D5A8'; ctx.fillRect(x, y, pw, ph);
    // Aged texture
    ctx.fillStyle = 'rgba(180,140,80,0.12)'; ctx.fillRect(x + 3, y + 12, pw - 6, 30);
    ctx.fillStyle = 'rgba(100,70,30,0.08)';
    ctx.beginPath(); ctx.ellipse(x + pw * 0.3, y + ph * 0.7, 12, 8, 0.2, 0, Math.PI * 2); ctx.fill();
    // Double border
    ctx.strokeStyle = '#7A4510'; ctx.lineWidth = 2; ctx.strokeRect(x, y, pw, ph);
    ctx.strokeStyle = '#9B6B30'; ctx.lineWidth = 0.8; ctx.strokeRect(x + 3, y + 3, pw - 6, ph - 6);
    // "WANTED" header
    ctx.fillStyle = '#8B0000'; ctx.font = 'bold 8px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillText('WANTED', x + pw / 2, y + 12);
    // Decorative line under WANTED
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 14); ctx.lineTo(x + pw - 8, y + 14); ctx.stroke();
    // Face portrait area — darker background
    const faceX = x + pw / 2, faceY = y + 32;
    ctx.fillStyle = '#D4BA8A'; ctx.fillRect(x + 10, y + 17, pw - 20, 28);
    ctx.strokeStyle = '#8B6B30'; ctx.lineWidth = 0.6; ctx.strokeRect(x + 10, y + 17, pw - 20, 28);
    // Head
    ctx.fillStyle = '#C8946A'; ctx.beginPath(); ctx.arc(faceX, faceY, 9, 0, Math.PI * 2); ctx.fill();
    // Hat
    ctx.fillStyle = '#3A2008';
    ctx.fillRect(faceX - 12, faceY - 14, 24, 5);
    ctx.fillRect(faceX - 7, faceY - 20, 14, 8);
    // Eyes
    ctx.fillStyle = '#1A0A00';
    ctx.beginPath(); ctx.arc(faceX - 3, faceY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(faceX + 3, faceY - 2, 1.5, 0, Math.PI * 2); ctx.fill();
    // Eyebrows (menacing)
    ctx.strokeStyle = '#2C1810'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(faceX - 5, faceY - 5); ctx.lineTo(faceX - 1, faceY - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(faceX + 5, faceY - 5); ctx.lineTo(faceX + 1, faceY - 4); ctx.stroke();
    // Nose
    ctx.strokeStyle = '#A07050'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(faceX, faceY - 1); ctx.lineTo(faceX - 1.5, faceY + 2); ctx.lineTo(faceX + 1.5, faceY + 2); ctx.stroke();
    // Mustache
    ctx.fillStyle = '#2C1810';
    ctx.beginPath(); ctx.moveTo(faceX - 6, faceY + 3); ctx.quadraticCurveTo(faceX, faceY + 5, faceX + 6, faceY + 3);
    ctx.quadraticCurveTo(faceX, faceY + 7, faceX - 6, faceY + 3); ctx.fill();
    // Mouth/frown
    ctx.strokeStyle = '#6B3A20'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.arc(faceX, faceY + 9, 3, 0.15, Math.PI - 0.15); ctx.stroke();
    // "DEAD OR ALIVE" text
    ctx.fillStyle = '#5A2010'; ctx.font = 'bold 5px Georgia, serif';
    ctx.fillText('DEAD OR ALIVE', x + pw / 2, y + 52);
    // Decorative line
    ctx.strokeStyle = '#8B0000'; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x + 8, y + 54); ctx.lineTo(x + pw - 8, y + 54); ctx.stroke();
    // Reward amount
    ctx.fillStyle = '#3A1A00'; ctx.font = 'bold 7px Georgia, serif';
    ctx.fillText('$500 REWARD', x + pw / 2, y + 63);
    // Corner tacks
    ctx.fillStyle = '#8B7030';
    ctx.beginPath(); ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + pw - 5, y + 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 5, y + ph - 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + pw - 5, y + ph - 5, 2, 0, Math.PI * 2); ctx.fill();
    ctx.textAlign = 'left';
    ctx.restore();
  }

  drawBottles(ctx) {
    for (const b of this.bottles) {
      if (!b.alive) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, 10, 20);
      ctx.fillRect(b.x + 2, b.y - 4, 6, 6);
      ctx.fillStyle = '#DEB887'; ctx.fillRect(b.x + 2, b.y - 7, 6, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(b.x + 1, b.y + 2, 3, 14);
    }
  }

  drawBarItems(ctx) {
    const y = BAR_Y - 1;
    [95, 175, 285, 405].forEach(bx => {
      ctx.fillStyle = 'rgba(200,180,100,0.6)'; ctx.fillRect(bx, y - 12, 9, 12);
      ctx.fillStyle = 'rgba(255,255,200,0.35)'; ctx.fillRect(bx + 1, y - 10, 3, 7);
      ctx.strokeStyle = 'rgba(140,120,60,0.5)'; ctx.lineWidth = 0.8; ctx.strokeRect(bx, y - 12, 9, 12);
    });
    ctx.fillStyle = '#8B5A2B'; ctx.fillRect(442, y - 18, 10, 18); ctx.fillRect(445, y - 23, 4, 7);
  }

  // ── Upright Piano — LEFT side, drawn on top of tables ──
  drawPiano(ctx) {
    const px = 2, py = 405;
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(px + 34, py + 42, 36, 7, 0, 0, Math.PI * 2); ctx.fill();
    // Body
    ctx.fillStyle = '#1A0A04'; ctx.fillRect(px, py - 62, 68, 84);
    // Top lid
    ctx.fillStyle = '#2A1400'; ctx.fillRect(px - 3, py - 68, 74, 8);
    ctx.fillStyle = '#3A2000'; ctx.fillRect(px - 3, py - 68, 74, 2);
    // Inner panel
    ctx.fillStyle = '#0A0604'; ctx.fillRect(px + 4, py - 56, 60, 62);
    // Music stand
    ctx.fillStyle = '#E8E0D0'; ctx.fillRect(px + 16, py - 58, 30, 10);
    ctx.fillStyle = '#444';
    [18, 26, 34, 40].forEach(mx => ctx.fillRect(px + mx, py - 56, 1, 6));
    // Keys
    const keyY = py + 14;
    for (let i = 0; i < 15; i++) ctx.fillStyle = '#F0E8D8', ctx.fillRect(px + 4 + i * 4, keyY, 3.2, 12);
    ctx.fillStyle = '#111';
    [1, 2, 4, 5, 6, 8, 9, 11, 12].forEach(k => { if (k < 15) ctx.fillRect(px + 4 + k * 4 - 1, keyY, 2.2, 7); });
    // Key shelf
    ctx.fillStyle = '#2A1400'; ctx.fillRect(px, py + 10, 68, 5);
    // Legs
    ctx.fillStyle = '#1A0A04';
    ctx.fillRect(px + 4, py + 22, 6, 24); ctx.fillRect(px + 58, py + 22, 6, 24);
    // Cross brace
    ctx.fillStyle = '#2A1400'; ctx.fillRect(px + 9, py + 36, 50, 3);
    // Pedals
    ctx.fillStyle = '#B8860B';
    ctx.fillRect(px + 22, py + 40, 5, 5); ctx.fillRect(px + 38, py + 40, 5, 5);
    // Candle holders
    ctx.fillStyle = '#C8A030';
    ctx.fillRect(px + 10, py - 75, 3, 8); ctx.fillRect(px + 55, py - 75, 3, 8);
    ctx.fillStyle = '#FF8C00';
    ctx.beginPath(); ctx.arc(px + 11.5, py - 77, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 56.5, py - 77, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(px + 11.5, py - 79, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 56.5, py - 79, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  drawChairs(ctx) {
    [110, 150, 228, 288, 365, 405].forEach(cx => {
      const cy = 440 + (cx % 3) * 2;
      ctx.fillStyle = '#7A4A18'; ctx.fillRect(cx - 8, cy, 16, 4);
      ctx.fillStyle = '#6B3A10'; ctx.fillRect(cx - 8, cy - 12, 16, 3);
      ctx.fillStyle = '#5A3210';
      ctx.fillRect(cx - 7, cy + 4, 3, 10); ctx.fillRect(cx + 4, cy + 4, 3, 10);
      ctx.fillRect(cx - 7, cy - 9, 3, 13); ctx.fillRect(cx + 4, cy - 9, 3, 13);
    });
  }

  // ── Cover / Round Table ─────────────────────────────────────────────────────
  drawCover(ctx, c) { this.drawRoundTable(ctx, c.x, c.y, c.w, c.h); }

  drawRoundTable(ctx, cx, cy, w, h) {
    const rx = w / 2, topRy = 14;
    // Leg
    ctx.fillStyle = '#6B4A10'; ctx.fillRect(cx - 3, cy + 2, 6, h / 2 + 4);
    ctx.strokeStyle = '#5A3A10'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - rx * 0.6, cy + h / 2 + 6); ctx.lineTo(cx + rx * 0.6, cy + h / 2 + 6); ctx.stroke();
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.ellipse(cx + 2, cy + 3, rx, topRy + 1, 0, 0, Math.PI * 2); ctx.fill();
    // Top
    const tg = ctx.createRadialGradient(cx - 5, cy - 3, 2, cx, cy, rx);
    tg.addColorStop(0, '#B8862A'); tg.addColorStop(0.5, '#A07820'); tg.addColorStop(1, '#7A5A10');
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, topRy, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#5A3A08'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(cx, cy, rx, topRy, 0, 0, Math.PI * 2); ctx.stroke();
    // Highlight
    ctx.strokeStyle = 'rgba(255,220,150,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy - 1, rx - 3, topRy - 2, 0, Math.PI + 0.3, -0.3); ctx.stroke();
    // Glass
    ctx.fillStyle = 'rgba(180,220,255,0.4)';
    ctx.beginPath(); ctx.arc(cx - 10, cy - 2, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(200,170,60,0.5)';
    ctx.beginPath(); ctx.arc(cx + 12, cy - 1, 4, 0, Math.PI * 2); ctx.fill();
  }

  // ── Enemies ─────────────────────────────────────────────────────────────────
  drawEnemy(ctx, e) {
    if (!e.visible && e.state !== 'entering') return;
    const o = OUTFITS[e.outfit], x = e.drawX, y = e.drawY;
    ctx.save();
    if (e.state === 'retreating') ctx.globalAlpha = 0.7 + Math.sin(this.time * 20) * 0.3;
    if (e.state === 'dead') ctx.globalAlpha = clamp(e.deadT / 0.7, 0, 1);

    if (e.posType === 'cover' || e.state === 'entering') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.ellipse(x, y + 48, 18, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
    if (e.state === 'entering') {
      const lo = e.walkFrame ? 5 : -5;
      ctx.fillStyle = o.pants;
      ctx.fillRect(x - 9, y + 22, 8, 24); ctx.fillRect(x + 1, y + 22, 8, 24);
      ctx.fillStyle = '#1A0800';
      ctx.fillRect(x - 11 + lo, y + 44, 11, 6); ctx.fillRect(x - lo, y + 44, 11, 6);
    }

    ctx.fillStyle = o.shirt; ctx.fillRect(x - 12, y + 3, 24, 24);
    ctx.fillStyle = '#2A1808'; ctx.fillRect(x - 12, y + 24, 24, 3);
    ctx.fillStyle = '#DAA520'; ctx.fillRect(x - 3, y + 24, 6, 3);
    ctx.fillStyle = '#C8844A';
    ctx.beginPath(); ctx.arc(x, y - 8, 13, 0, Math.PI * 2); ctx.fill();
    if (o.bandana) {
      ctx.fillStyle = o.bandana;
      ctx.beginPath();
      ctx.moveTo(x - 13, y - 4); ctx.lineTo(x + 13, y - 4);
      ctx.lineTo(x + 9, y + 5); ctx.lineTo(x, y + 7); ctx.lineTo(x - 9, y + 5);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(x - 4, y - 10, 2, 0, Math.PI * 2); ctx.arc(x + 4, y - 10, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(x - 8, y - 14); ctx.lineTo(x - 2, y - 12);
    ctx.moveTo(x + 2, y - 12); ctx.lineTo(x + 8, y - 14); ctx.stroke();
    if (o.scar) { ctx.strokeStyle = '#8B4040'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y - 15); ctx.lineTo(x + 2, y + 1); ctx.stroke(); }
    if (!o.bandana) {
      ctx.fillStyle = '#3C2010';
      ctx.beginPath(); ctx.ellipse(x - 4, y - 1, 4.5, 2.5, 0.3, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x + 4, y - 1, 4.5, 2.5, -0.3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = o.hat;
    ctx.beginPath(); ctx.ellipse(x, y - 18, 22, 4.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 13, y - 38, 26, 20);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath(); ctx.moveTo(x - 9, y - 38); ctx.quadraticCurveTo(x, y - 33, x + 9, y - 38);
    ctx.lineTo(x + 9, y - 36); ctx.quadraticCurveTo(x, y - 31, x - 9, y - 36); ctx.closePath(); ctx.fill();
    ctx.fillStyle = o.band; ctx.fillRect(x - 13, y - 20, 26, 3);

    if (e.state === 'peeking' || e.state === 'warning' || e.state === 'shooting') {
      ctx.fillStyle = '#555'; ctx.fillRect(x - 24, y + 9, 18, 5);
      ctx.fillStyle = '#333'; ctx.fillRect(x - 34, y + 10, 12, 3.5);
      if (e.state === 'shooting') { ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#AAA'; ctx.beginPath(); ctx.arc(x - 36, y + 9, 5, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    }
    if (e.maxHp > 1) {
      for (let i = 0; i < e.maxHp; i++) { ctx.beginPath(); ctx.arc(x - 7 + i * 14, y - 50, 4.5, 0, Math.PI * 2); ctx.fillStyle = i < e.hp ? '#FF3333' : '#444'; ctx.fill(); }
    }
    if (e.state === 'warning') {
      const p = 0.55 + Math.abs(Math.sin(this.time * 14)) * 0.45;
      ctx.save(); ctx.globalAlpha = p; ctx.font = 'bold 20px Georgia, serif'; ctx.fillStyle = '#FFD700';
      ctx.textAlign = 'center'; ctx.fillText('!', x, y - 54); ctx.restore();
    }
    ctx.restore();
  }

  // ── Civilians ─────────────────────────────────────────────────────────────
  drawCivilian(ctx, c) {
    if (!c.alive) return;
    ctx.save();
    if (c.hitTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(this.time * 15) * 0.3;
    switch (c.type) {
      case 'pianist':   this.drawPianist(ctx, c); break;
      case 'bartender': this.drawBartender(ctx, c); break;
      case 'patron':    this.drawPatron(ctx, c); break;
      case 'poker1':    this.drawPokerPlayer(ctx, c, false); break;
      case 'poker2':    this.drawPokerPlayer(ctx, c, true); break;
      case 'drinker':   this.drawDrinker(ctx, c); break;
      case 'doorCiv':   this.drawDoorCiv(ctx, c); break;
    }
    ctx.restore();
  }

  // ── Pianist — LEFT side next to piano ──
  drawPianist(ctx, c) {
    const x = 42, y = 430;
    c.x = x; c.y = y;
    const dy = c.scared > 0 ? 7 : 0;
    const bobY = c.scared > 0 ? 0 : Math.sin(this.time * 5) * 1.5;
    const armSwing = c.scared > 0 ? 0 : Math.sin(this.time * 8) * 4;

    // Red dress
    ctx.fillStyle = '#B22222';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 2 + dy + bobY); ctx.lineTo(x + 14, y + 2 + dy + bobY);
    ctx.lineTo(x + 18, y + 32); ctx.lineTo(x - 18, y + 32);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#FFD700'; ctx.fillRect(x - 14, y + 1 + dy + bobY, 28, 2);
    ctx.fillStyle = '#CC1818'; ctx.fillRect(x - 10, y - 6 + dy + bobY, 20, 12);

    // Arms
    ctx.fillStyle = '#E0B090';
    ctx.beginPath();
    ctx.moveTo(x - 10, y + dy + bobY); ctx.lineTo(x - 22 - armSwing, y + 8 + dy + bobY);
    ctx.lineTo(x - 20 - armSwing, y + 12 + dy + bobY); ctx.lineTo(x - 8, y + 4 + dy + bobY);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 10, y + dy + bobY); ctx.lineTo(x + 22 + armSwing, y + 8 + dy + bobY);
    ctx.lineTo(x + 20 + armSwing, y + 12 + dy + bobY); ctx.lineTo(x + 8, y + 4 + dy + bobY);
    ctx.closePath(); ctx.fill();

    // Head
    ctx.fillStyle = '#E0B090';
    ctx.beginPath(); ctx.arc(x, y - 17 + dy + bobY, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#8B3A1A';
    ctx.beginPath(); ctx.arc(x, y - 19 + dy + bobY, 12, Math.PI + 0.4, -0.4); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 1, y - 30 + dy + bobY, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFD700';
    ctx.beginPath(); ctx.arc(x + 4, y - 32 + dy + bobY, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2A5A2A';
    ctx.beginPath(); ctx.arc(x - 3, y - 18 + dy + bobY, 1.8, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 18 + dy + bobY, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#CC3333';
    ctx.beginPath(); ctx.arc(x, y - 12 + dy + bobY, 2, 0, Math.PI); ctx.fill();
    if (c.scared > 0) { ctx.strokeStyle = '#AA4444'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y - 11 + dy + bobY, 2.5, 0, Math.PI * 2); ctx.stroke(); }

    // Stool
    ctx.fillStyle = '#8B2020'; ctx.fillRect(x - 12, y + 26, 24, 5);
    ctx.fillStyle = '#5A3A1E'; ctx.fillRect(x - 8, y + 31, 4, 10); ctx.fillRect(x + 4, y + 31, 4, 10);
  }

  drawBartender(ctx, c) {
    const x = c.x, y = c.y, dy = c.scared > 0 ? 8 : 0;
    ctx.fillStyle = '#E8DCC8'; ctx.fillRect(x - 10, y - 2 + dy, 20, 22);
    ctx.fillStyle = '#2A2A2A'; ctx.fillRect(x - 10, y - 2 + dy, 7, 22); ctx.fillRect(x + 3, y - 2 + dy, 7, 22);
    ctx.fillStyle = '#E0D8C8'; ctx.fillRect(x - 9, y + 8 + dy, 18, 16);
    ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 13 + dy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3A2A1A'; ctx.beginPath(); ctx.arc(x, y - 15 + dy, 11, Math.PI + 0.3, -0.3); ctx.fill();
    ctx.fillStyle = '#3A2A1A';
    ctx.beginPath(); ctx.ellipse(x - 4, y - 7 + dy, 5, 2.5, 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + 4, y - 7 + dy, 5, 2.5, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1A1A1A'; ctx.beginPath();
    ctx.moveTo(x - 4, y - 3 + dy); ctx.lineTo(x, y - 1 + dy); ctx.lineTo(x + 4, y - 3 + dy);
    ctx.lineTo(x, y - 5 + dy); ctx.closePath(); ctx.fill();
  }

  drawPatron(ctx, c) {
    const x = c.x, y = c.y, dy = c.scared > 0 ? 10 : 0;
    ctx.fillStyle = '#6A8AA0'; ctx.fillRect(x - 9, y - 2 + dy, 18, 20);
    ctx.fillStyle = '#D4A070'; ctx.beginPath(); ctx.arc(x, y - 13 + dy, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5A4A30'; ctx.fillRect(x - 12, y - 20 + dy, 24, 4); ctx.fillRect(x - 9, y - 28 + dy, 18, 9);
    ctx.fillStyle = '#3A3A3A';
    ctx.beginPath(); ctx.arc(x - 3, y - 14 + dy, 1.5, 0, Math.PI * 2); ctx.arc(x + 3, y - 14 + dy, 1.5, 0, Math.PI * 2); ctx.fill();
    if (!c.scared) {
      ctx.strokeStyle = '#D4A070'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 9, y + 2); ctx.lineTo(x + 18, y - 3); ctx.stroke();
      ctx.fillStyle = 'rgba(200,170,60,0.7)'; ctx.fillRect(x + 16, y - 10, 7, 10);
    }
  }

  // ── Poker Player — sitting at decorative table with cards ──
  drawPokerPlayer(ctx, c, flipped) {
    const x = c.x, y = c.y, dy = c.scared > 0 ? 8 : 0;
    const dir = flipped ? -1 : 1;
    // Body (vest over shirt)
    ctx.fillStyle = flipped ? '#8B7355' : '#6B5A40'; ctx.fillRect(x - 8, y - 2 + dy, 16, 18);
    ctx.fillStyle = flipped ? '#5A4A2A' : '#3A2A1A';
    ctx.fillRect(x - 6, y - 2 + dy, 5, 15); ctx.fillRect(x + 1, y - 2 + dy, 5, 15);
    // Head
    ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 12 + dy, 9, 0, Math.PI * 2); ctx.fill();
    // Hat
    ctx.fillStyle = flipped ? '#4A3020' : '#2C1810';
    ctx.fillRect(x - 11, y - 18 + dy, 22, 3); ctx.fillRect(x - 8, y - 26 + dy, 16, 9);
    // Eyes
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(x - 3, y - 13 + dy, 1.3, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 13 + dy, 1.3, 0, Math.PI * 2); ctx.fill();
    // Cards in hand
    if (!c.scared) {
      ctx.save();
      ctx.fillStyle = '#F5F0E0';
      ctx.translate(x + dir * 14, y + 2 + dy); ctx.rotate(dir * -0.2);
      ctx.fillRect(-4, -8, 8, 11);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5; ctx.strokeRect(-4, -8, 8, 11);
      ctx.fillStyle = '#CC0000'; ctx.font = '6px serif'; ctx.textAlign = 'center';
      ctx.fillText('\u2660', 0, 0);
      ctx.restore();
      ctx.save();
      ctx.fillStyle = '#F5F0E0';
      ctx.translate(x + dir * 18, y - 1 + dy); ctx.rotate(dir * 0.15);
      ctx.fillRect(-4, -8, 8, 11);
      ctx.strokeStyle = '#888'; ctx.lineWidth = 0.5; ctx.strokeRect(-4, -8, 8, 11);
      ctx.fillStyle = '#CC0000'; ctx.font = '6px serif'; ctx.textAlign = 'center';
      ctx.fillText('\u2665', 0, 0);
      ctx.restore();
      // Arm holding cards
      ctx.strokeStyle = '#D4A574'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + dir * 8, y + 2 + dy); ctx.lineTo(x + dir * 14, y + 2 + dy); ctx.stroke();
    }
  }

  // ── Drinker — cowboy at the bar sipping a beer ──
  drawDrinker(ctx, c) {
    const x = c.x, y = c.y, dy = c.scared > 0 ? 6 : 0;
    // Body (flannel)
    ctx.fillStyle = '#8B4513'; ctx.fillRect(x - 9, y - 2 + dy, 18, 20);
    ctx.fillStyle = '#6B3410'; ctx.fillRect(x - 9, y + 6 + dy, 18, 14);
    // Head
    ctx.fillStyle = '#D4A070'; ctx.beginPath(); ctx.arc(x, y - 13 + dy, 10, 0, Math.PI * 2); ctx.fill();
    // Stubble
    ctx.fillStyle = 'rgba(60,40,20,0.2)';
    ctx.beginPath(); ctx.arc(x, y - 8 + dy, 7, 0, Math.PI); ctx.fill();
    // Hat
    ctx.fillStyle = '#5A4030';
    ctx.beginPath(); ctx.ellipse(x, y - 18 + dy, 15, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(x - 9, y - 28 + dy, 18, 11);
    ctx.fillStyle = '#3A2820'; ctx.fillRect(x - 9, y - 19 + dy, 18, 2);
    // Eyes
    ctx.fillStyle = '#333';
    ctx.beginPath(); ctx.arc(x - 3, y - 14 + dy, 1.5, 0, Math.PI * 2);
    ctx.arc(x + 3, y - 14 + dy, 1.5, 0, Math.PI * 2); ctx.fill();
    if (!c.scared) {
      // Arm holding beer
      ctx.strokeStyle = '#D4A070'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + 9, y + 2 + dy); ctx.lineTo(x + 20, y - 6 + dy); ctx.stroke();
      // Beer mug
      ctx.fillStyle = 'rgba(200,180,100,0.75)'; ctx.fillRect(x + 16, y - 16 + dy, 9, 13);
      ctx.fillStyle = 'rgba(255,255,200,0.5)'; ctx.fillRect(x + 17, y - 14 + dy, 3, 8);
      ctx.fillStyle = '#FFFDE0';
      ctx.beginPath(); ctx.ellipse(x + 20.5, y - 16 + dy, 5, 2, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,140,80,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x + 25, y - 10 + dy, 4, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
    } else {
      // Scared hands up
      ctx.strokeStyle = '#D4A070'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x - 9, y + dy); ctx.lineTo(x - 16, y - 14 + dy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 9, y + dy); ctx.lineTo(x + 16, y - 14 + dy); ctx.stroke();
    }
  }

  // ── Door Civilian — innocent bystander entering the saloon ──
  drawDoorCiv(ctx, c) {
    if (!c.alive) return;
    const x = c.x, y = c.y, dy = c.scared > 0 ? 8 : 0;
    const mode = c.spawnMode || 'door';
    ctx.save();
    // Apply alpha for window/balcony fade
    if (c.drawAlpha !== undefined && c.drawAlpha < 1) ctx.globalAlpha = c.drawAlpha;

    if (mode === 'window' || mode === 'balcony') {
      // Upper-body only (peeking from window or leaning on balcony)
      this._drawDoorCivHead(ctx, c, x, y, dy);
    } else {
      // Door mode — full body with walking
      const walking = c.civState === 'entering' || c.civState === 'leaving';
      const legOff = walking ? ((c.walkFrame || 0) ? 4 : -4) : 0;
      if (walking) {
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.beginPath(); ctx.ellipse(x, y + 18, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      this._drawDoorCivBody(ctx, c, x, y, dy, walking, legOff);
    }
    ctx.restore();
  }

  // Head + upper torso drawing for window/balcony civs
  _drawDoorCivHead(ctx, c, x, y, dy) {
    if (c.subtype === 'cowgirl') {
      ctx.fillStyle = '#8B3A60'; ctx.fillRect(x - 8, y - 12 + dy, 16, 10);
      ctx.fillStyle = '#E0B890'; ctx.beginPath(); ctx.arc(x, y - 22 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8B5A2B';
      ctx.beginPath(); ctx.arc(x, y - 24 + dy, 10, Math.PI + 0.3, -0.3); ctx.fill();
      ctx.fillRect(x - 10, y - 22 + dy, 4, 16); ctx.fillRect(x + 6, y - 22 + dy, 4, 16);
      ctx.fillStyle = '#A06848';
      ctx.beginPath(); ctx.arc(x, y - 28 + dy, 7, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3A6A3A';
      ctx.beginPath(); ctx.arc(x - 3, y - 23 + dy, 1.5, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 23 + dy, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (c.subtype === 'oldman') {
      ctx.fillStyle = '#5A5A4A'; ctx.fillRect(x - 9, y - 6 + dy, 18, 12);
      ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 16 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#C8C0B0'; ctx.fillRect(x - 10, y - 18 + dy, 4, 8); ctx.fillRect(x + 6, y - 18 + dy, 4, 8);
      ctx.strokeStyle = '#8B8B6B'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x - 3, y - 17 + dy, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y - 17 + dy, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(x - 3, y - 17 + dy, 1, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 17 + dy, 1, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#6A7A8A'; ctx.fillRect(x - 9, y - 4 + dy, 18, 10);
      ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 14 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2A2A2A';
      ctx.beginPath(); ctx.ellipse(x, y - 20 + dy, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 26 + dy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(x - 3, y - 15 + dy, 1.3, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 15 + dy, 1.3, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Full body drawing for door-walking civs
  _drawDoorCivBody(ctx, c, x, y, dy, walking, legOff) {
    if (c.subtype === 'cowgirl') {
      ctx.fillStyle = '#6A2848';
      ctx.beginPath(); ctx.moveTo(x - 10, y - 4 + dy); ctx.lineTo(x + 10, y - 4 + dy);
      ctx.lineTo(x + 14, y + 18); ctx.lineTo(x - 14, y + 18); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#8B3A60'; ctx.fillRect(x - 8, y - 12 + dy, 16, 10);
      ctx.fillStyle = '#E0B890'; ctx.beginPath(); ctx.arc(x, y - 22 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8B5A2B';
      ctx.beginPath(); ctx.arc(x, y - 24 + dy, 10, Math.PI + 0.3, -0.3); ctx.fill();
      ctx.fillRect(x - 10, y - 22 + dy, 4, 16); ctx.fillRect(x + 6, y - 22 + dy, 4, 16);
      ctx.fillStyle = '#A06848';
      ctx.beginPath(); ctx.arc(x, y - 28 + dy, 7, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#3A6A3A';
      ctx.beginPath(); ctx.arc(x - 3, y - 23 + dy, 1.5, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 23 + dy, 1.5, 0, Math.PI * 2); ctx.fill();
      if (walking) {
        ctx.fillStyle = '#4A1828';
        ctx.fillRect(x - 4 + legOff, y + 14, 4, 8); ctx.fillRect(x - legOff, y + 14, 4, 8);
      }
    } else if (c.subtype === 'oldman') {
      ctx.fillStyle = '#5A5A4A'; ctx.fillRect(x - 9, y - 6 + dy, 18, 22);
      ctx.fillStyle = '#C8B898'; ctx.fillRect(x - 4, y - 6 + dy, 8, 18);
      ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 16 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#C8C0B0'; ctx.fillRect(x - 10, y - 18 + dy, 4, 8); ctx.fillRect(x + 6, y - 18 + dy, 4, 8);
      ctx.strokeStyle = '#8B8B6B'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x - 3, y - 17 + dy, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y - 17 + dy, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#444';
      ctx.beginPath(); ctx.arc(x - 3, y - 17 + dy, 1, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 17 + dy, 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#5A3A1E'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + 12, y - 2 + dy); ctx.lineTo(x + 14, y + 20); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 11, y - 4 + dy, 3, Math.PI, 0); ctx.stroke();
      if (walking) {
        ctx.fillStyle = '#3A3A2A';
        ctx.fillRect(x - 5 + legOff, y + 14, 5, 8); ctx.fillRect(x - legOff, y + 14, 5, 8);
      }
    } else {
      ctx.fillStyle = '#6A7A8A'; ctx.fillRect(x - 9, y - 4 + dy, 18, 20);
      ctx.fillStyle = '#3A3A3A'; ctx.fillRect(x - 5, y - 4 + dy, 2, 18); ctx.fillRect(x + 3, y - 4 + dy, 2, 18);
      ctx.fillStyle = '#D4A574'; ctx.beginPath(); ctx.arc(x, y - 14 + dy, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2A2A2A';
      ctx.beginPath(); ctx.ellipse(x, y - 20 + dy, 12, 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y - 26 + dy, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath(); ctx.arc(x - 3, y - 15 + dy, 1.3, 0, Math.PI * 2);
      ctx.arc(x + 3, y - 15 + dy, 1.3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3A2A1A';
      ctx.beginPath(); ctx.ellipse(x, y - 10 + dy, 5, 2, 0, 0, Math.PI); ctx.fill();
      if (walking) {
        ctx.fillStyle = '#4A4A3A';
        ctx.fillRect(x - 5 + legOff, y + 14, 5, 8); ctx.fillRect(x - legOff, y + 14, 5, 8);
      }
    }
  }

  // ── FPS Revolver — realistic steel & walnut ───────────────────────────────
  drawFPSGun(ctx) {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    const panX = (this.smoothAimX - 0.5) * GUN_PAN_X;
    const panY = (this.smoothAimY - 0.5) * GUN_PAN_Y;
    const recoil = this.recoilT > 0 ? Math.sin((1 - this.recoilT / RECOIL_DUR) * Math.PI) * RECOIL_KICK : 0;
    ctx.save();
    ctx.translate(GUN_ANCHOR_X + panX, GUN_ANCHOR_Y + panY - recoil);
    const tilt = (this.smoothAimX - 0.5) * -0.08;
    ctx.rotate(tilt);

    // Hand
    const hg = ctx.createLinearGradient(-15, 30, 25, 120);
    hg.addColorStop(0, '#D4A070'); hg.addColorStop(1, '#C08050');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.moveTo(-22, 80); ctx.quadraticCurveTo(-28, 50, -20, 20);
    ctx.lineTo(24, 16); ctx.quadraticCurveTo(32, 50, 26, 80);
    ctx.lineTo(26, 140); ctx.lineTo(-22, 140); ctx.closePath(); ctx.fill();

    // Cuff
    ctx.fillStyle = '#C8B898'; ctx.fillRect(-24, 72, 52, 14);
    ctx.fillStyle = '#B0A080'; ctx.fillRect(-24, 72, 52, 2); ctx.fillRect(-24, 84, 52, 2);
    // Sleeve
    const sg = ctx.createLinearGradient(0, 86, 0, 145);
    sg.addColorStop(0, '#5A3A1E'); sg.addColorStop(1, '#3D2410');
    ctx.fillStyle = sg; ctx.fillRect(-26, 86, 56, 60);
    // Thumb
    ctx.fillStyle = '#D4A070';
    ctx.beginPath(); ctx.ellipse(22, 8, 10, 5, -0.6, 0, Math.PI * 2); ctx.fill();
    // Fingers
    ctx.fillStyle = '#C8946A';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(0, 26 + i * 8, 20, 5, 0, 0, Math.PI); ctx.fill(); }
    ctx.strokeStyle = 'rgba(100,60,30,0.3)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-18, 24 + i * 8); ctx.quadraticCurveTo(0, 26 + i * 8, 18, 24 + i * 8); ctx.stroke(); }

    // ── Gun ──
    // Grip (walnut)
    const gg = ctx.createLinearGradient(-10, 10, 12, 68);
    gg.addColorStop(0, '#7A4420'); gg.addColorStop(0.4, '#9B5E30'); gg.addColorStop(1, '#5A3010');
    ctx.fillStyle = gg;
    ctx.beginPath(); ctx.moveTo(-8, 10); ctx.lineTo(12, 8);
    ctx.quadraticCurveTo(16, 35, 14, 65); ctx.quadraticCurveTo(4, 72, -10, 62);
    ctx.quadraticCurveTo(-14, 35, -8, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(40,20,5,0.15)'; ctx.lineWidth = 0.5;
    for (let i = 0; i < 8; i++) { const y = 16 + i * 6; ctx.beginPath(); ctx.moveTo(-6, y); ctx.lineTo(12, y + 1); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(2, 38, 5, 0, Math.PI * 2);
    const mg = ctx.createRadialGradient(1, 37, 0.5, 2, 38, 5);
    mg.addColorStop(0, '#E8C860'); mg.addColorStop(1, '#8A7020');
    ctx.fillStyle = mg; ctx.fill();

    // Frame (dark steel)
    const fg = ctx.createLinearGradient(-12, -50, -12, 12);
    fg.addColorStop(0, '#B0B0B0'); fg.addColorStop(0.3, '#8A8A8A');
    fg.addColorStop(0.7, '#606060'); fg.addColorStop(1, '#404040');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.moveTo(-12, -40); ctx.lineTo(18, -42);
    ctx.lineTo(20, 10); ctx.lineTo(-8, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(220,220,220,0.22)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-10, -38); ctx.lineTo(16, -40); ctx.stroke();

    // Cylinder
    const cylX = 4, cylY = -15, cylR = 16;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.arc(cylX + 1, cylY + 1, cylR, 0, Math.PI * 2); ctx.fill();
    const cg = ctx.createRadialGradient(cylX - 3, cylY - 3, 1, cylX, cylY, cylR);
    cg.addColorStop(0, '#A0A0A0'); cg.addColorStop(0.4, '#707070'); cg.addColorStop(1, '#2A2A2A');
    ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cylX, cylY, cylR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(160,160,160,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cylX, cylY, cylR, 0, Math.PI * 2); ctx.stroke();

    const ca = this.time * 0.35;
    ctx.strokeStyle = 'rgba(20,20,20,0.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const fa = (i / 6) * Math.PI * 2 + ca + Math.PI / 6;
      ctx.beginPath(); ctx.moveTo(cylX + Math.cos(fa) * 5, cylY + Math.sin(fa) * 5);
      ctx.lineTo(cylX + Math.cos(fa) * (cylR - 1), cylY + Math.sin(fa) * (cylR - 1)); ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + ca;
      const bx = cylX + Math.cos(a) * 9.5, by = cylY + Math.sin(a) * 9.5;
      ctx.beginPath(); ctx.arc(bx, by, 3.5, 0, Math.PI * 2);
      if (i < this.bullets) {
        const bg = ctx.createRadialGradient(bx, by, 0.5, bx, by, 3.5);
        bg.addColorStop(0, '#E8C860'); bg.addColorStop(1, '#8A7020'); ctx.fillStyle = bg;
      } else ctx.fillStyle = '#0A0A0A';
      ctx.fill();
    }
    ctx.fillStyle = '#808080'; ctx.beginPath(); ctx.arc(cylX, cylY, 2.5, 0, Math.PI * 2); ctx.fill();

    // Barrel (shorter, wider, dark steel)
    const bg2 = ctx.createLinearGradient(-8, -45, 16, -45);
    bg2.addColorStop(0, '#A0A0A0'); bg2.addColorStop(0.3, '#707070');
    bg2.addColorStop(0.7, '#484848'); bg2.addColorStop(1, '#252525');
    ctx.fillStyle = bg2; ctx.fillRect(-8, -105, 24, 65);
    ctx.fillStyle = 'rgba(200,200,200,0.12)'; ctx.fillRect(-8, -105, 24, 3);
    ctx.strokeStyle = 'rgba(140,140,140,0.2)'; ctx.lineWidth = 0.6;
    ctx.beginPath(); ctx.moveTo(-2, -105); ctx.lineTo(-2, -42); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -105); ctx.lineTo(12, -42); ctx.stroke();
    // Ejector rod
    ctx.fillStyle = '#484848'; ctx.fillRect(16, -95, 5, 50);
    // Front sight
    ctx.fillStyle = '#D0D0D0'; ctx.fillRect(1, -112, 6, 7);
    // Muzzle
    ctx.fillStyle = '#505050'; ctx.beginPath(); ctx.arc(4, -107, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#080808'; ctx.beginPath(); ctx.arc(4, -107, 6, 0, Math.PI * 2); ctx.fill();

    // Trigger guard (brass)
    ctx.strokeStyle = '#C8A030'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-6, 10);
    ctx.quadraticCurveTo(-10, 28, -2, 34);
    ctx.quadraticCurveTo(8, 28, 6, 10); ctx.stroke();
    ctx.strokeStyle = '#707070'; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-2, 24); ctx.stroke();

    // Hammer
    ctx.fillStyle = '#808080';
    ctx.beginPath(); ctx.moveTo(12, -40); ctx.lineTo(14, -54);
    ctx.quadraticCurveTo(20, -56, 21, -48); ctx.lineTo(18, -38); ctx.closePath(); ctx.fill();

    ctx.restore();
  }

  // ── Fixed black crosshair (clean "+") ─────────────────────────────────────
  drawCrosshair(ctx) {
    const x = this.crossX, y = this.crossY;
    ctx.save();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    const gap = 5, arm = 14;
    ctx.beginPath();
    ctx.moveTo(x - arm, y); ctx.lineTo(x - gap, y);
    ctx.moveTo(x + gap, y); ctx.lineTo(x + arm, y);
    ctx.moveTo(x, y - arm); ctx.lineTo(x, y - gap);
    ctx.moveTo(x, y + gap); ctx.lineTo(x, y + arm);
    ctx.stroke();
    ctx.restore();
  }

  // ── Particles ─────────────────────────────────────────────────────────────
  drawParticles(ctx) {
    for (const p of this.particles) {
      ctx.save();
      if (p.type === 'blood') {
        ctx.globalAlpha = clamp(p.t / 0.6, 0, 1); ctx.fillStyle = '#8B0000';
        ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'glass') {
        ctx.globalAlpha = clamp(p.t / 0.6, 0, 1);
        ctx.fillStyle = p.color || '#88CCFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, rand(1.5, 3), 0, Math.PI * 2); ctx.fill();
        // Glint
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 1, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'hole') {
        ctx.globalAlpha = clamp(p.t * 0.22, 0, 0.8); ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#333'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.stroke();
        for (let a = 0; a < 5; a++) {
          const ang = (a / 5) * Math.PI * 2; ctx.strokeStyle = '#222';
          ctx.beginPath(); ctx.moveTo(p.x + Math.cos(ang) * 4, p.y + Math.sin(ang) * 4);
          ctx.lineTo(p.x + Math.cos(ang) * 12, p.y + Math.sin(ang) * 12); ctx.stroke();
        }
      } else if (p.type === 'hit') {
        ctx.globalAlpha = clamp(p.t / 0.2, 0, 1); ctx.fillStyle = '#FF5555';
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'flash') {
        const ft = clamp(p.t / 0.13, 0, 1); ctx.globalAlpha = ft * 0.45;
        const og = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 36);
        og.addColorStop(0, 'rgba(255,180,60,0.8)'); og.addColorStop(0.4, 'rgba(255,120,20,0.4)');
        og.addColorStop(1, 'rgba(255,80,0,0)');
        ctx.fillStyle = og; ctx.beginPath(); ctx.arc(p.x, p.y, 36, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = ft * 0.8; ctx.fillStyle = '#FFF';
        ctx.beginPath(); ctx.arc(p.x, p.y, 8, 0, Math.PI * 2); ctx.fill();
      } else if (p.type === 'eflash') {
        ctx.globalAlpha = clamp(p.t / 0.13, 0, 0.8); ctx.fillStyle = '#FFBB44';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ── Developer Credit with bullet-hole torn poster effect ─────────────────
  _drawCredit(ctx, baseY) {
    ctx.save();
    const cx = W / 2;
    const bw = 300, bh = 90, bx = cx - bw / 2, by = baseY - 50;

    // ══ Wooden sign board ══
    // Shadow behind board
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    drawRR(ctx, bx + 4, by + 5, bw, bh, 6); ctx.fill();

    // Main wood plank
    const woodGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
    woodGrad.addColorStop(0, '#A07040');
    woodGrad.addColorStop(0.15, '#8B5E30');
    woodGrad.addColorStop(0.5, '#7A4E25');
    woodGrad.addColorStop(0.85, '#6B4020');
    woodGrad.addColorStop(1, '#5A3518');
    ctx.fillStyle = woodGrad;
    drawRR(ctx, bx, by, bw, bh, 6); ctx.fill();

    // Wood grain lines
    ctx.strokeStyle = 'rgba(50,25,5,0.15)'; ctx.lineWidth = 0.8;
    for (let i = 0; i < 7; i++) {
      const gy = by + 8 + i * 12;
      ctx.beginPath();
      ctx.moveTo(bx + 8, gy);
      ctx.quadraticCurveTo(cx + Math.sin(i * 1.3) * 30, gy + Math.sin(i * 0.7) * 3, bx + bw - 8, gy + Math.sin(i) * 2);
      ctx.stroke();
    }

    // Outer frame (ornate dark border)
    ctx.strokeStyle = '#3A1A08'; ctx.lineWidth = 3;
    drawRR(ctx, bx, by, bw, bh, 6); ctx.stroke();
    // Inner frame line (golden)
    ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 1.5;
    drawRR(ctx, bx + 6, by + 6, bw - 12, bh - 12, 4); ctx.stroke();

    // Corner nail heads
    const nails = [[bx + 10, by + 10], [bx + bw - 10, by + 10], [bx + 10, by + bh - 10], [bx + bw - 10, by + bh - 10]];
    for (const [nx, ny] of nails) {
      ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2);
      const ng = ctx.createRadialGradient(nx - 1, ny - 1, 0.5, nx, ny, 3.5);
      ng.addColorStop(0, '#D0C080'); ng.addColorStop(1, '#8A7030');
      ctx.fillStyle = ng; ctx.fill();
      ctx.strokeStyle = 'rgba(60,40,10,0.4)'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(nx, ny, 3.5, 0, Math.PI * 2); ctx.stroke();
    }

    // ══ Decorative stars on sides ══
    const drawStar = (sx, sy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = (i * 4 * Math.PI) / 5 - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](sx + Math.cos(a) * r, sy + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    };
    ctx.fillStyle = '#DAA520';
    drawStar(bx + 24, baseY - 10, 5);
    drawStar(bx + bw - 24, baseY - 10, 5);

    // ══ Text ══
    // "Developed By" — embossed style
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillText('Developed By', cx + 1, baseY - 17);
    ctx.fillStyle = '#E8D0A0';
    ctx.fillText('Developed By', cx, baseY - 18);

    // "Kendine Coder" — large golden text
    ctx.font = 'bold 22px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillText('Kendine Coder', cx + 1, baseY + 6);
    const tg = ctx.createLinearGradient(cx - 80, baseY - 5, cx - 80, baseY + 8);
    tg.addColorStop(0, '#FFE880'); tg.addColorStop(0.5, '#DAA520'); tg.addColorStop(1, '#B8860B');
    ctx.fillStyle = tg;
    ctx.fillText('Kendine Coder', cx, baseY + 5);

    // Website URL
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillText('kendinecoder.com', cx + 1, baseY + 24);
    ctx.fillStyle = '#D4B880';
    ctx.fillText('kendinecoder.com', cx, baseY + 23);

    // Decorative line separators
    ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx - 100, baseY - 8); ctx.lineTo(cx - 38, baseY - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 38, baseY - 8); ctx.lineTo(cx + 100, baseY - 8); ctx.stroke();
    // Small diamond in center of lines
    ctx.fillStyle = '#DAA520';
    ctx.save(); ctx.translate(cx - 115, baseY - 8); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2, -2, 4, 4); ctx.restore();
    ctx.save(); ctx.translate(cx + 115, baseY - 8); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-2, -2, 4, 4); ctx.restore();

    ctx.restore();
  }

  // ── HUD (sleek, minimal) ──────────────────────────────────────────────────
  drawHUD(ctx) {
    ctx.save();
    // Score
    ctx.textAlign = 'left'; ctx.font = 'bold 20px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText(`${this.score}`, 13, 26);
    ctx.fillStyle = '#FFD700'; ctx.fillText(`${this.score}`, 12, 25);
    ctx.font = '12px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(`BEST: ${this.bestScore}`, 13, 41);
    ctx.fillStyle = '#C8A050'; ctx.fillText(`BEST: ${this.bestScore}`, 12, 40);
    // Wave
    ctx.textAlign = 'right'; ctx.font = 'bold 16px Georgia, serif';
    ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillText(`WAVE ${this.wave}`, W - 49, 24);
    ctx.fillStyle = '#DEB887'; ctx.fillText(`WAVE ${this.wave}`, W - 50, 23);
    // Pause
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    drawRR(ctx, W - 42, 8, 34, 24, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,220,140,0.7)';
    ctx.fillRect(W - 34, 13, 4, 14); ctx.fillRect(W - 24, 13, 4, 14);
    ctx.restore();

    // Hearts
    for (let i = 0; i < MAX_LIVES; i++) this.drawHeart(ctx, 14 + i * 22, 52, i < this.lives);

    // Ammo wheel
    this.drawAmmoWheel(ctx);

    // Reload — cylinder spin animation
    if (this.reloading) {
      const prog = 1 - this.reloadTimer / RELOAD_TIME;
      const cx = W / 2, cy = H - 175, R = 28;

      // Spinning cylinder overlay
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath(); ctx.arc(cx, cy, R + 6, 0, Math.PI * 2); ctx.fill();
      // Cylinder body
      const cg = ctx.createRadialGradient(cx - 4, cy - 4, 1, cx, cy, R);
      cg.addColorStop(0, '#909090'); cg.addColorStop(0.5, '#606060'); cg.addColorStop(1, '#2A2A2A');
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(160,160,160,0.4)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

      // Spinning chambers with bullets loading in
      const spinAngle = prog * Math.PI * 4; // 2 full spins
      ctx.strokeStyle = 'rgba(20,20,20,0.3)'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const fa = (i / 6) * Math.PI * 2 + spinAngle + Math.PI / 6;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(fa) * 5, cy + Math.sin(fa) * 5);
        ctx.lineTo(cx + Math.cos(fa) * (R - 1), cy + Math.sin(fa) * (R - 1));
        ctx.stroke();
      }
      const bulletsLoaded = Math.floor(prog * MAX_BULLETS);
      for (let i = 0; i < MAX_BULLETS; i++) {
        const a = (i / MAX_BULLETS) * Math.PI * 2 + spinAngle;
        const bx = cx + Math.cos(a) * (R * 0.55), by = cy + Math.sin(a) * (R * 0.55);
        ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI * 2);
        if (i < bulletsLoaded) {
          const bg = ctx.createRadialGradient(bx, by, 0.5, bx, by, 4);
          bg.addColorStop(0, '#FFE880'); bg.addColorStop(1, '#C8A030'); ctx.fillStyle = bg;
        } else ctx.fillStyle = '#0A0A0A';
        ctx.fill();
      }
      // Center pin
      ctx.fillStyle = '#808080'; ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Progress arc around cylinder
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(cx, cy, R + 4, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();

      // Label
      ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillText('RELOADING', cx + 1, cy + R + 20);
      ctx.fillStyle = 'rgba(255,215,0,0.85)'; ctx.fillText('RELOADING', cx, cy + R + 19);
    } else if (this.bullets === 0) {
      const p = 0.6 + Math.abs(Math.sin(this.time * 3.6)) * 0.4;
      ctx.save(); ctx.globalAlpha = p;
      ctx.font = 'bold 14px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillStyle = '#FF4444'; ctx.fillText('TAP TO RELOAD', W / 2, H - 158);
      ctx.restore();
    }
  }

  drawHeart(ctx, x, y, filled) {
    ctx.save(); ctx.translate(x, y);
    ctx.beginPath(); ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-7, -4, -12, 0, -7, 6); ctx.lineTo(0, 12);
    ctx.lineTo(7, 6); ctx.bezierCurveTo(12, 0, 7, -4, 0, 3); ctx.closePath();
    ctx.fillStyle = filled ? '#CC2222' : 'rgba(60,20,20,0.5)'; ctx.fill();
    if (filled) { ctx.fillStyle = 'rgba(255,100,100,0.3)'; ctx.beginPath(); ctx.arc(-3, 2, 3, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  drawAmmoWheel(ctx) {
    const cx = 48, cy = H - 52, R = 24;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(30,30,30,0.6)'; ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < MAX_BULLETS; i++) {
      const a = (i / MAX_BULLETS) * Math.PI * 2 - Math.PI / 2;
      const bx = cx + Math.cos(a) * R, by = cy + Math.sin(a) * R;
      ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2);
      if (i < this.bullets) {
        const bg = ctx.createRadialGradient(bx - 1, by - 1, 0.5, bx, by, 7);
        bg.addColorStop(0, '#FFE880'); bg.addColorStop(1, '#C8A030'); ctx.fillStyle = bg;
      } else ctx.fillStyle = '#1A1A1A';
      ctx.fill(); ctx.strokeStyle = 'rgba(120,120,120,0.3)'; ctx.lineWidth = 0.6; ctx.stroke();
    }
    ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.font = '11px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,215,0,0.65)'; ctx.fillText(`${this.bullets}/${MAX_BULLETS}`, cx, cy + R + 16);
    if (this.bullets < MAX_BULLETS && !this.reloading && this.bullets > 0) {
      ctx.font = '9px Georgia, serif'; ctx.fillStyle = 'rgba(200,160,80,0.5)'; ctx.fillText('TAP', cx, cy + R + 27);
    }
  }
}

// ─── BOOTSTRAP ────────────────────────────────────────────────────────────────
window.addEventListener('load', () => new WesternShooter());
