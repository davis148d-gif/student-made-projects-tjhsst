
{
'use strict';
/* ================= CORE: constants, utils, persistence, settings, keys ================= */
const W = 1280,
  H = 720,
  DT = 1 / 60,
  PPM = 73,
  GY = 560,
  TAU = Math.PI * 2;
const CFG = {
  half: 7,
  runoff: 1.6,
  enGarde: 2,
  warn: 2,
  minSep: 0.7,
  thigh: 0.5,
  shin: 0.5,
  upperArm: 0.32,
  foreArm: 0.3,
  blade: 0.9,
  hipY: -0.82,
  step: {
    adv: { dur: 0.26, len: 0.32 },
    ret: { dur: 0.28, len: 0.3 },
    fadv: { dur: 0.18, len: 0.45 },
    fret: { dur: 0.2, len: 0.42 }
  },
  halfStep: { len: 0.15, dur: 0.17, tap: 0.09 },
  thrust: { prep: 0.05, ext: 0.1, hold: 0.09, ret: 0.15 },
  counter: { prep: 0.03, ext: 0.08, hold: 0.07, ret: 0.16 },
  cut: { prep: 0.07, ext: 0.1, hold: 0.06, ret: 0.15 },
  feint: { ext: 0.4, window: 0.18, ret: 0.12, disExtend: 0.12 },
  lunge: {
    prep: 0.08,
    ext: 0.12,
    drive: 0.18,
    hold: 0.07,
    rec: 0.2,
    stuck: 0.22,
    foot: 0.75,
    hip: 0.42,
    drop: 0.16,
    fastRec: 1.6
  },
  advLunge: { minK: 0.6, extra: 0.1, recMul: 1.15, expExtra: 0.12, expDrive: 0.15, expRecMul: 1.3 },
  remise: { early: 0.07, deflWin: 0.15, lungeStuck: 0.12 },
  parry: { wind: 0.04, active: 0.17, rec: 0.16 },
  beat: { wind: 0.03, strike: 0.06, rec: 0.06, missRec: 0.18, press: 0.06 },
  dis: { dur: 0.16, cd: 0.45 },
  riposte: 0.45,
  deflect: 0.34,
  buffer: 0.15,
  lungeBuffer: 0.3,
  bell: 0.065,
  contact: 0.045,
  lineHoldMax: 1.5,
  engageDist: 0.035,
  engageTime: 0.15,
  fat: {
    step: 1,
    fstep: 3,
    thrust: 2,
    parry: 2,
    dis: 1,
    lunge: 7,
    advLunge: 9,
    beat: 3,
    feint: 1,
    regenIdle: 7,
    regenMove: 2.5,
    maxPen: 0.18
  }
};
const ZONES = ['head', 'upper', 'arm', 'lower', 'thigh', 'foot'];
const ZONE_NAME = {
  head: 'Head',
  upper: 'Upper torso',
  arm: 'Weapon arm',
  lower: 'Lower torso',
  thigh: 'Front thigh',
  foot: 'Front foot'
};
const ZONE_Y = { head: -1.62, upper: -1.33, arm: -1.22, lower: -0.98, thigh: -0.62, foot: -0.07 };
const CAP2ZONE = {
  head: 'head',
  bib: 'head',
  torso_u: 'upper',
  torso_l: 'lower',
  arm: 'arm',
  rarm: 'arm',
  thigh: 'thigh',
  shin: 'thigh',
  foot: 'foot'
};
const RULES = {
  epee: { name: 'Épée', lock: 0.04, row: false, offTarget: false, valid: () => true },
  foil: {
    name: 'Foil',
    lock: 0.3,
    row: true,
    offTarget: true,
    valid: z => z === 'torso_u' || z === 'torso_l' || z === 'bib'
  },
  sabre: {
    name: 'Sabre',
    lock: 0.12,
    row: true,
    offTarget: false,
    cuts: true,
    valid: z =>
      z === 'head' || z === 'bib' || z === 'torso_u' || z === 'torso_l' || z === 'arm' || z === 'rarm'
  }
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v),
  lerp = (a, b, t) => a + (b - a) * t;
const sstep = t => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
const eOut = t => {
  t = clamp(t, 0, 1);
  return 1 - (1 - t) ** 3;
};
let RNG = Math.random;
const rnd = (a, b) => a + RNG() * (b - a),
  pick = a => a[(RNG() * a.length) | 0],
  chance = p => RNG() < p;
function wpick(obj) {
  let s = 0;
  for (const k in obj) s += Math.max(0, obj[k]);
  let r = RNG() * s;
  for (const k in obj) {
    r -= Math.max(0, obj[k]);
    if (r <= 0) return k;
  }
  return Object.keys(obj)[0];
}
const P = (x, y) => ({ x, y });
const add = (a, b) => P(a.x + b.x, a.y + b.y),
  sub = (a, b) => P(a.x - b.x, a.y - b.y),
  mul = (a, s) => P(a.x * s, a.y * s),
  len = a => Math.hypot(a.x, a.y);
const lerpP = (a, b, t) => P(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
const pad2 = n => String(n).padStart(2, '0');
const fmtClock = t => {
  const s = Math.max(0, Math.ceil(t));
  return Math.floor(s / 60) + ':' + pad2(s % 60);
};
const fmtT = t => {
  const s = Math.max(0, Math.floor(t));
  return pad2(Math.floor(s / 60)) + ':' + pad2(s % 60);
};
const font = (sz, w = 600) =>
  `${w} ${sz}px "Segoe UI",system-ui,-apple-system,Roboto,Helvetica,Arial,sans-serif`;
const hexRgb = h => {
  const n = parseInt(h.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
};
function mulberry(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function ptSegDist(p, a, b) {
  const abx = b.x - a.x,
    aby = b.y - a.y;
  const l2 = abx * abx + aby * aby || 1e-9;
  const t = clamp(((p.x - a.x) * abx + (p.y - a.y) * aby) / l2, 0, 1);
  return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
}
function segSeg(p1, q1, p2, q2) {
  const d1 = sub(q1, p1),
    d2 = sub(q2, p2),
    r = sub(p1, p2);
  const a = d1.x * d1.x + d1.y * d1.y,
    e = d2.x * d2.x + d2.y * d2.y,
    f = d2.x * r.x + d2.y * r.y;
  let s, t;
  if (a <= 1e-9 && e <= 1e-9) {
    s = t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1.x * r.x + d1.y * r.y;
    if (e <= 1e-9) {
      t = 0;
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1.x * d2.x + d1.y * d2.y,
        den = a * e - b * b;
      s = den !== 0 ? clamp((b * f - c * e) / den, 0, 1) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }
  const c1 = add(p1, mul(d1, s)),
    c2 = add(p2, mul(d2, t));
  return { d: len(sub(c1, c2)), s, t, c1, c2 };
}
function ik2(a, t, l1, l2, sign) {
  let dx = t.x - a.x,
    dy = t.y - a.y,
    d = Math.hypot(dx, dy) || 1e-6;
  const maxd = l1 + l2 - 1e-4,
    mind = Math.abs(l1 - l2) + 1e-3;
  let tt = t;
  if (d > maxd) {
    tt = P(a.x + (dx / d) * maxd, a.y + (dy / d) * maxd);
    dx = tt.x - a.x;
    dy = tt.y - a.y;
    d = maxd;
  }
  if (d < mind) d = mind;
  const aa = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, l1 * l1 - aa * aa)),
    ux = dx / d,
    uy = dy / d;
  return { j: P(a.x + ux * aa - uy * h * sign, a.y + uy * aa + ux * h * sign), end: tt };
}
const parryNum = (h, s) => (h === 'low' ? (s === 'in' ? 7 : 8) : s === 'in' ? 4 : 6);
const PARRY_NAME = { 4: 'Quarte', 6: 'Sixte', 7: 'Septime', 8: 'Octave' };

/* persistence: localStorage with in-memory fallback */
const Store = {
  mem: {},
  ok: true,
  get(k, d) {
    try {
      const v = localStorage.getItem('fdob2:' + k);
      if (v != null) return JSON.parse(v);
    } catch (e) {
      this.ok = false;
    }
    return k in this.mem ? JSON.parse(JSON.stringify(this.mem[k])) : d;
  },
  set(k, v) {
    this.mem[k] = JSON.parse(JSON.stringify(v));
    try {
      localStorage.setItem('fdob2:' + k, JSON.stringify(v));
    } catch (e) {
      this.ok = false;
    }
  },
  del(k) {
    delete this.mem[k];
    try {
      localStorage.removeItem('fdob2:' + k);
    } catch (e) {}
  }
};

const SETTINGS = Object.assign(
  {
    weapon: 'epee',
    arena: 'grandprix',
    diff: 1,
    pers: 'balanced',
    sim: false,
    mouseAim: false,
    autoReplay: false,
    voice: true,
    sound: true
  },
  Store.get('settings', {})
);
function saveSettings() {
  Store.set('settings', SETTINGS);
}

/* key bindings (remappable, conflict-checked) */
const ACTION_LIST = [
  'adv',
  'ret',
  'high',
  'low',
  'thrust',
  'lunge',
  'parry',
  'disengage',
  'feint',
  'beat',
  'recover',
  'fast'
];
const ACTION_NAME = {
  adv: 'Advance',
  ret: 'Retreat',
  high: 'High guard',
  low: 'Low guard',
  thrust: 'Thrust / cut',
  lunge: 'Lunge',
  parry: 'Parry',
  disengage: 'Disengage',
  feint: 'Feint',
  beat: 'Blade beat',
  recover: 'Recover',
  fast: 'Fast footwork'
};
const DEF_KEYS = {
  p1: {
    adv: ['KeyD'],
    ret: ['KeyA'],
    high: ['KeyW'],
    low: ['KeyS'],
    thrust: ['KeyJ'],
    lunge: ['KeyK'],
    parry: ['KeyL'],
    disengage: ['KeyI'],
    feint: ['KeyU'],
    beat: ['KeyO'],
    recover: ['Space'],
    fast: ['ShiftLeft']
  },
  p2: {
    adv: ['ArrowLeft'],
    ret: ['ArrowRight'],
    high: ['ArrowUp'],
    low: ['ArrowDown'],
    thrust: ['Comma', 'Numpad1'],
    lunge: ['Period', 'Numpad2'],
    parry: ['Slash', 'Numpad3'],
    disengage: ['Quote', 'Numpad5'],
    feint: ['Semicolon', 'Numpad4'],
    beat: ['BracketRight', 'Numpad6'],
    recover: ['Enter', 'Numpad0'],
    fast: ['ShiftRight']
  }
};
const RESERVED = new Set(['Escape', 'KeyR', 'KeyM', 'Backspace', 'KeyT', 'Tab', 'F1']);
let KEYS = (() => {
  const k = Store.get('keys', null);
  const out = JSON.parse(JSON.stringify(DEF_KEYS));
  if (k)
    for (const p of ['p1', 'p2'])
      for (const a of ACTION_LIST)
        if (k[p] && Array.isArray(k[p][a]) && k[p][a].every(x => typeof x === 'string'))
          out[p][a] = k[p][a].slice(0, 2);
  return out;
})();
function keyLabel(c) {
  if (!c) return '—';
  return c
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Arrow', '')
    .replace('ShiftLeft', 'L-Shift')
    .replace('ShiftRight', 'R-Shift')
    .replace('BracketRight', ']')
    .replace('BracketLeft', '[')
    .replace('Semicolon', ';')
    .replace('Quote', "'")
    .replace('Comma', ',')
    .replace('Period', '.')
    .replace('Slash', '/')
    .replace('Numpad', 'Num ');
}
/* returns message; swaps within a scheme, refuses cross-scheme or reserved keys */
function remap(p, a, code) {
  if (RESERVED.has(code)) return keyLabel(code) + ' is reserved (pause, replay, mute, restart).';
  const other = p === 'p1' ? 'p2' : 'p1';
  for (const b of ACTION_LIST)
    if (KEYS[other][b].includes(code))
      return (
        keyLabel(code) +
        ' is already used by Player ' +
        (other === 'p1' ? 1 : 2) +
        ' (' +
        ACTION_NAME[b] +
        ').'
      );
  const old = KEYS[p][a][0];
  for (const b of ACTION_LIST)
    if (b !== a && KEYS[p][b].includes(code)) {
      KEYS[p][b] = KEYS[p][b].map(x => (x === code ? old : x)).filter(Boolean);
      Store.set('keys', KEYS);
      KEYS[p][a] = [code];
      Store.set('keys', KEYS);
      return 'Swapped with ' + ACTION_NAME[b] + '.';
    }
  KEYS[p][a] = [code].concat(KEYS[p][a].slice(1).filter(x => x !== code));
  Store.set('keys', KEYS);
  return ACTION_NAME[a] + ' set to ' + keyLabel(code) + '.';
}
function resetKeys() {
  KEYS = JSON.parse(JSON.stringify(DEF_KEYS));
  Store.set('keys', KEYS);
}

/* ================= SOUND (procedural) + referee voice ================= */
const Snd = {
  ctx: null,
  on: SETTINGS.sound,
  master: null,
  noise: null,
  crowdG: null,
  droneG: null,
  lastBreath: 0,
  hb: 0,
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = (this.ctx = new AC());
      this.master = c.createGain();
      this.master.gain.value = this.on ? 0.8 : 0;
      this.master.connect(c.destination);
      const b = c.createBuffer(1, c.sampleRate * 2, c.sampleRate),
        d = b.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      this.noise = b;
      const s = c.createBufferSource();
      s.buffer = b;
      s.loop = true;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 450;
      this.crowdG = c.createGain();
      this.crowdG.gain.value = 0.03;
      s.connect(lp);
      lp.connect(this.crowdG);
      this.crowdG.connect(this.master);
      s.start();
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = 55;
      this.droneG = c.createGain();
      this.droneG.gain.value = 0;
      o.connect(this.droneG);
      this.droneG.connect(this.master);
      o.start();
    } catch (e) {
      this.ctx = null;
    }
  },
  setOn(v) {
    this.on = v;
    SETTINGS.sound = v;
    saveSettings();
    if (this.master) this.master.gain.setTargetAtTime(v ? 0.8 : 0, this.ctx.currentTime, 0.05);
    if (!v) this.hush();
  },
  env(g, t, a, pk, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(pk, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  nb(t, dur, freq, type, vol, q = 0.7) {
    const c = this.ctx,
      s = c.createBufferSource();
    s.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    this.env(g, t, 0.003, vol, dur);
    s.connect(f);
    f.connect(g);
    g.connect(this.master);
    s.start(t, Math.random());
    s.stop(t + dur + 0.1);
    return f;
  },
  tone(t, f, type, vol, a, dec) {
    const c = this.ctx,
      o = c.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = c.createGain();
    this.env(g, t, a, vol, dec);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + a + dec + 0.05);
    return o;
  },
  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },
  clash(v = 1) {
    if (!this.ctx) return;
    const t = this.now();
    v = clamp(v, 0.15, 1.3);
    [2210, 3170, 4430, 5890, 7310].forEach((f, i) =>
      this.tone(
        t,
        f * (0.97 + 0.06 * Math.random()) * (0.9 + 0.15 * v),
        'sine',
        (0.11 * v) / (1 + i * 0.5),
        0.002,
        0.08 + 0.2 * v * Math.random()
      )
    );
    this.nb(t, 0.03 + 0.03 * v, 4200, 'highpass', 0.22 * v);
  },
  scrape() {
    if (!this.ctx) return;
    const f = this.nb(this.now(), 0.18, 5200, 'bandpass', 0.035, 3);
    f.frequency.setValueAtTime(4000, this.now());
    f.frequency.linearRampToValueAtTime(6500, this.now() + 0.18);
  },
  tick() {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 3900, 'triangle', 0.05, 0.001, 0.06);
    this.nb(t, 0.03, 5000, 'highpass', 0.08);
  },
  whoosh(v = 1) {
    if (!this.ctx) return;
    const t = this.now();
    const f = this.nb(t, 0.16, 700, 'bandpass', 0.12 * v, 2);
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + 0.14);
  },
  swish() {
    if (!this.ctx) return;
    this.nb(this.now(), 0.08, 1100, 'lowpass', 0.035);
  },
  step(v = 1) {
    if (!this.ctx) return;
    this.nb(this.now(), 0.045, 260, 'lowpass', 0.09 * v);
  },
  stomp() {
    if (!this.ctx) return;
    const t = this.now();
    this.nb(t, 0.09, 180, 'lowpass', 0.22);
    this.tone(t, 70, 'sine', 0.12, 0.002, 0.12);
  },
  squeak() {
    if (!this.ctx) return;
    const t = this.now();
    const f = this.nb(t, 0.07, 2600, 'bandpass', 0.05, 9);
    f.frequency.setValueAtTime(2300, t);
    f.frequency.linearRampToValueAtTime(3600, t + 0.06);
  },
  breath(v) {
    if (!this.ctx) return;
    const t = this.now();
    this.nb(t, 0.35, 800, 'bandpass', 0.035 * v, 0.8);
  },
  buzzer() {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 523, 'square', 0.045, 0.005, 0.75);
    this.tone(t, 784, 'sawtooth', 0.03, 0.005, 0.75);
  },
  beep(f = 880, d = 0.12, v = 0.08) {
    if (!this.ctx) return;
    this.tone(this.now(), f, 'sine', v, 0.005, d);
  },
  cheer(v = 1) {
    if (!this.ctx) return;
    const t = this.now(),
      c = this.ctx;
    [1300, 700].forEach((fr, i) => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = fr;
      f.Q.value = 0.6;
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime((0.11 * v) / (i + 1), t + 0.18);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6 + 1.4 * v);
      s.connect(f);
      f.connect(g);
      g.connect(this.master);
      s.start(t, Math.random());
      s.stop(t + 2.4);
    });
  },
  ooh() {
    if (!this.ctx) return;
    const t = this.now();
    const o = this.tone(t, 190, 'sawtooth', 0.025, 0.15, 0.5);
    o.frequency.setValueAtTime(170, t);
    o.frequency.linearRampToValueAtTime(230, t + 0.3);
    this.nb(t, 0.5, 500, 'bandpass', 0.05, 1);
  },
  fanfare() {
    if (!this.ctx) return;
    const t = this.now();
    [523, 659, 784, 1047].forEach((f, i) => {
      this.tone(t + i * 0.16, f, 'triangle', 0.07, 0.01, 0.5);
      this.tone(t + i * 0.16, f / 2, 'sine', 0.04, 0.01, 0.6);
    });
  },
  /* crowd intensity reacts to score/importance; tension drone at match point ties */
  atmosphere(intensity, tense) {
    if (!this.ctx) return;
    const t = this.now();
    this.crowdG.gain.setTargetAtTime(tense ? 0.012 : 0.02 + 0.03 * intensity, t, 0.5);
    this.droneG.gain.setTargetAtTime(tense ? 0.035 : 0, t, 0.8);
  },
  heartbeat() {
    if (!this.ctx) return;
    const t = this.now();
    this.tone(t, 58, 'sine', 0.12, 0.005, 0.12);
    this.tone(t + 0.18, 52, 'sine', 0.09, 0.005, 0.12);
  },
  hush() {
    if (this.ctx) {
      this.crowdG.gain.setTargetAtTime(0.02, this.now(), 0.3);
      this.droneG.gain.setTargetAtTime(0, this.now(), 0.3);
    }
  },
  say(txt) {
    if (!SETTINGS.voice || !this.on) return;
    try {
      const ss = window.speechSynthesis;
      if (!ss) return;
      ss.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'fr-FR';
      u.rate = 1.05;
      u.volume = 0.9;
      ss.speak(u);
    } catch (e) {}
  }
};

/* ================= FENCER: action state machines, footwork, pose ================= */
let ATK = 0;
class Fencer {
  constructor(i, m) {
    this.i = i;
    this.d = i ? -1 : 1;
    this.m = m;
    this.weapon = m ? m.weapon : 'epee';
    this.light = i ? '255,74,74' : '59,140,255';
    this.color = i ? 'RED' : 'BLUE';
    this.name = this.color;
    this.setLook({ trim: i ? '#ff4a4a' : '#3b8cff' });
    this.energy = 100;
    this.pen = 0;
    this.stats = { touches: 0, attacks: 0, lunges: 0, parries: 0, ripostes: 0, doubles: 0 };
    this.reset();
  }
  setLook(c) {
    this.cos = Object.assign({ mask: 'plain', shoes: 'white', lefty: false }, c);
    this.trim = this.cos.trim;
    this.rgb = hexRgb(this.trim);
  }
  reset() {
    const d = this.d;
    this.x = -d * (CFG.enGarde + 0.42);
    this.placeFeet();
    this.prevX = this.x;
    this.liftF = 0;
    this.liftR = 0;
    this.drop = 0;
    this.lean = 0;
    this.gh = 0;
    this.guard = 'mid';
    this.side = 'out';
    this.zone = 'arm';
    this.aimY = ZONE_Y.arm;
    this.legs = { type: 'idle', t: 0 };
    this.arm = { type: 'guard', t: 0 };
    this.attack = null;
    this.lastAtkY = ZONE_Y.arm;
    this.riposteT = 0;
    this.disCD = 0;
    this.disT = -1;
    this.deflA = 0;
    this.bend = 0;
    this.flex = 0;
    this.flinch = 0;
    this.vx = 0;
    this.extE = 0;
    this.lungeE = 0;
    this.lungeDp = 0;
    this.parryB = 0;
    this.parryH = 'high';
    this.stepQ = 0;
    this.cutR = 0;
    this.beatK = 0;
    this.dispT = 0;
    this.engaged = false;
    this.holdThrust = false;
    this.lineEst = -1;
    this.beatPrio = -9;
    this.remiseT = -1;
    this.extOn = false;
    this.extEp = this.extEp || 0;
    this.extT0 = 0;
    this.extMax = 0;
    this.extLunge = false;
    this.extAim = this.aimY;
    this.trail = [];
    this.glintT = 0;
    this.breath = Math.random() * TAU;
    this.pose = null;
    this.poseK = 0;
    this.balance = 'Balanced';
    this.computePose(null);
    this.prevTip = this.J.tip;
    this.prevBlade = this.J.blade.slice();
  }
  placeFeet() {
    this.front = this.x + this.d * 0.42;
    this.rear = this.x - this.d * 0.38;
  }
  shift(dx) {
    this.x += dx;
    this.front += dx;
    this.rear += dx;
    this.prevX += dx;
    const L = this.legs;
    if (L.x0 !== undefined) {
      L.x0 += dx;
      L.f0 += dx;
      L.r0 += dx;
      if (L.fs !== undefined) {
        L.fs += dx;
        L.rs += dx;
      }
    }
  }
  back() {
    return CFG.half + this.d * this.x;
  }
  spend(a) {
    if (this.m && this.m.sim) this.energy = Math.max(0, this.energy - CFG.fat[a]);
  }
  flipSide() {
    this.side = this.side === 'out' ? 'in' : 'out';
  }
  update(dt, it, m, accept, ctrl) {
    if (this.attack && this.attack.hit) return;
    const c = CFG;
    if (m.sim) {
      const lun = this.legs.type === 'lunge',
        mov = this.legs.type !== 'idle' || this.arm.type !== 'guard';
      this.energy = clamp(this.energy + (lun ? 0 : mov ? c.fat.regenMove : c.fat.regenIdle) * dt, 0, 100);
      this.pen = c.fat.maxPen * Math.pow(1 - this.energy / 100, 1.4);
    } else this.pen = 0;
    this.breath += dt * (2.1 + this.pen * 16);
    this.disCD -= dt;
    if (this.riposteT > 0) this.riposteT = Math.max(0, this.riposteT - dt);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.deflA *= Math.exp(-dt * 5);
    this.bend = Math.max(0, this.bend - dt * 3);
    this.glintT = Math.max(0, this.glintT - dt);
    this.dispT = Math.max(0, this.dispT - dt);
    if (this.disT >= 0) {
      this.disT += dt;
      if (this.disT > c.dis.dur) this.disT = -1;
    }
    if (!it || !accept)
      it = {
        move: 0,
        fast: false,
        guard: it ? it.guard : 'mid',
        zone: it ? it.zone : this.zone,
        aimY: it ? it.aimY : null,
        hold: false
      };
    if (this.arm.type === 'guard' || this.arm.type === 'disengage') this.guard = it.guard;
    if (it.zone) this.zone = it.zone;
    const want = it.aimY != null ? clamp(it.aimY, -1.8, -0.02) : ZONE_Y[this.zone];
    this.aimY += clamp(want - this.aimY, -3 * dt, 3 * dt);
    if (it.aimY != null) {
      let best = 'arm',
        bd = 9;
      for (const z of ZONES) {
        const dd = Math.abs(ZONE_Y[z] - this.aimY);
        if (dd < bd) {
          bd = dd;
          best = z;
        }
      }
      this.zone = best;
    }
    const gt = this.guard === 'high' ? 1 : this.guard === 'low' ? -1 : 0;
    this.gh += (gt - this.gh) * Math.min(1, dt * 14);
    this.holdThrust = !!it.hold;
    if (ctrl) {
      if (accept) {
        const buf = ctrl.buf;
        for (let i = 0; i < buf.length; i++) {
          const e = buf[i];
          const lim = e.a === 'lunge' ? c.lungeBuffer : c.buffer;
          if (m.time - e.t > lim) {
            buf.splice(i--, 1);
            continue;
          }
          if (this.tryAct(e.a, m, ctrl, it)) buf.splice(i--, 1);
        }
      } else ctrl.buf.length = 0;
    }
    this.updLegs(dt, it, m);
    this.updArm(dt, m);
    let tl = 0;
    if (this.legs.type === 'lunge') tl = 0.05 + 0.15 * this.lungeE;
    else if (this.arm.type === 'thrust' || this.arm.type === 'cut') tl = 0.11 * this.extE;
    else if (this.arm.type === 'feint') tl = 0.06 * this.extE;
    if (this.legs.type === 'step' && this.legs.fast) tl += this.legs.sgn > 0 ? 0.04 : -0.02;
    this.lean += (tl - this.lean) * Math.min(1, dt * (this.legs.type === 'lunge' ? 30 : 16));
    this.vx = (this.x - this.prevX) / dt;
    this.prevX = this.x;
    // observable extension episodes (what an opponent can see: the arm starting to extend)
    if (this.extE > 0.06 && !this.extOn) {
      this.extOn = true;
      this.extEp++;
      this.extT0 = m.time;
      this.extMax = 0;
      this.extLunge = false;
    }
    if (this.extOn) {
      this.extMax = Math.max(this.extMax, this.extE);
      this.extAim = this.aimY;
      if (this.legs.type === 'lunge' && this.legs.t >= c.lunge.prep + c.lunge.ext * 0.5) this.extLunge = true;
      if (this.extE < 0.03 && this.legs.type !== 'lunge') {
        this.extOn = false;
        m.onExtEnd(this);
      }
    }
    const L = this.legs,
      A = this.arm;
    this.balance =
      L.type === 'lunge'
        ? L.phase === 'recovery'
          ? 'Recovering'
          : L.phase === 'hold' || L.phase === 'committed'
            ? 'Overextended'
            : 'Lunging'
        : A.type === 'deflected' ||
            (A.type === 'parry' && A.ended) ||
            (A.type === 'beat' && A.phase === 'recover' && !A.contact)
          ? 'Recovering'
          : L.type === 'step'
            ? L.sgn > 0
              ? 'Advancing'
              : 'Retreating'
            : A.type === 'thrust' && this.extE > 0.9
              ? 'Extended'
              : 'Balanced';
  }
  armFree() {
    const A = this.arm;
    return (
      A.type === 'guard' ||
      (A.type === 'disengage' && A.t > 0.09) ||
      (A.type === 'beat' &&
        A.contact &&
        A.t > CFG.beat.wind + (A.press ? CFG.beat.press : 0) + CFG.beat.strike * 0.6)
    );
  }
  tryAct(a, m, ctrl, it) {
    const c = CFG,
      A = this.arm,
      L = this.legs,
      legsOK = L.type !== 'lunge';
    switch (a) {
      case 'thrust': {
        if (A.type === 'feint' && A.phase !== 'return') {
          this.fromFeint('thrust', m);
          return true;
        }
        if (this.canRemise()) {
          this.doRemise(m);
          return true;
        }
        if (!this.armFree() || !legsOK) return false;
        const retreating = (L.type === 'step' && L.sgn < 0) || it.move < 0;
        this.startAttack(this.weapon === 'sabre' ? 'cut' : retreating ? 'counter' : 'thrust', m);
        return true;
      }
      case 'lunge': {
        if (!legsOK) return false;
        if (A.type === 'feint' && A.phase !== 'return') {
          if (L.type === 'step' && (L.sgn < 0 || L.t / L.dur < c.advLunge.minK)) return false;
          this.fromFeint('lunge', m);
          return true;
        }
        if (!this.armFree()) return false;
        if (L.type === 'step') {
          if (L.sgn < 0 || L.t / L.dur < c.advLunge.minK) return false;
          this.startAttack('lunge', m, { adv: true, explosive: L.fast });
          return true;
        }
        this.startAttack('lunge', m);
        return true;
      }
      case 'feint':
        if (!this.armFree() || !legsOK || this.dispT > 0) return false;
        this.arm = { type: 'feint', t: 0 };
        this.spend('feint');
        Snd.swish();
        m.onFeintStart(this);
        return true;
      case 'beat': {
        if (!(A.type === 'guard' || (A.type === 'disengage' && A.t > 0.09)) || this.dispT > 0 || !legsOK)
          return false;
        const o = m.other(this);
        const g = this.J.guardC,
          mid = lerpP(o.J.guardC, o.J.tip, 0.6);
        const ownA = Math.atan2(-(this.J.tip.y - g.y), Math.abs(this.J.tip.x - g.x)),
          toA = Math.atan2(-(mid.y - g.y), Math.abs(mid.x - g.x));
        this.arm = { type: 'beat', t: 0, sgn: toA >= ownA ? 1 : -1, press: this.engaged, contact: false };
        this.spend('beat');
        Snd.swish();
        m.onBeatStart(this);
        return true;
      }
      case 'parry': {
        if (A.type !== 'guard' || !legsOK || this.dispT > 0) return false;
        const h = this.guard === 'low' ? 'low' : 'high';
        const side = ctrl && ctrl.parrySide ? ctrl.parrySide(this, m) : m.other(this).side;
        this.arm = { type: 'parry', t: 0, side, height: h };
        this.parryH = h;
        this.spend('parry');
        m.onParryStart(this);
        return true;
      }
      case 'disengage':
        if (this.disCD > 0) return false;
        if (A.type === 'feint' && A.phase === 'window' && !A.dis) {
          A.dis = true;
          A.ext = (A.ext || 0) + c.feint.disExtend;
          this.flipSide();
          this.disT = 0;
          this.disCD = c.dis.cd * 0.6;
          this.spend('dis');
          m.onDisengage(this, true);
          return true;
        }
        if (A.type === 'guard') {
          this.arm = { type: 'disengage', t: 0 };
          this.disCD = c.dis.cd;
          this.disT = 0;
          this.engaged = false;
          this.spend('dis');
          m.onDisengage(this, false);
          return true;
        }
        if (this.attack && !this.attack.disengaged && this.earlyAttack()) {
          this.attack.disengaged = true;
          this.flipSide();
          this.attack.side = this.side;
          this.disCD = c.dis.cd;
          this.disT = 0;
          this.spend('dis');
          m.onDisengage(this, true);
          return true;
        }
        return false;
      case 'recover':
        if (L.type === 'lunge') {
          L.fast = true;
          return true;
        }
        return A.type === 'guard';
      case 'adv':
      case 'ret':
      case 'hadv':
      case 'hret': {
        const s = a === 'adv' || a === 'hadv' ? 1 : -1,
          half = a[0] === 'h';
        if (A.type === 'feint' && A.phase === 'window' && s < 0) A.ext = A.t - A.tw - c.feint.window;
        if (L.type === 'idle') {
          this.startStep(s, it.fast && !half, m, true);
          if (half) this.makeHalf();
          return true;
        }
        if (L.type === 'step') {
          if (L.sgn !== s && L.t / L.dur < 0.35 && !L.half) {
            this.startStep(s, it.fast, m, true);
            if (half) this.makeHalf();
            return true;
          }
          if (!half) this.stepQ = s;
          return true;
        }
        return false;
      }
    }
    return false;
  }
  makeHalf() {
    const L = this.legs;
    L.half = true;
    L.decided = true;
    L.len = CFG.halfStep.len;
    L.dur = CFG.halfStep.dur * (1 + 0.6 * this.pen);
  }
  earlyAttack() {
    const a = this.attack;
    if (a.kind === 'lunge') return this.legs.type === 'lunge' && this.legs.t < CFG.lunge.prep + CFG.lunge.ext;
    const A = this.arm;
    return (A.type === 'thrust' || A.type === 'cut') && A.t < A.T.prep + A.T.ext * 0.55;
  }
  fromFeint(kind, m) {
    const A = this.arm;
    const compound = A.dis ? 'feint-disengage' : 'feint';
    m.onFeintEnd(this, A, true);
    if (kind === 'thrust')
      this.startAttack(this.weapon === 'sabre' ? 'cut' : 'thrust', m, { fromE: CFG.feint.ext, compound });
    else {
      const L = this.legs;
      const adv = L.type === 'step' && L.sgn > 0;
      this.startAttack('lunge', m, { fromE: CFG.feint.ext, compound, adv, explosive: adv && L.fast });
    }
  }
  canRemise() {
    const A = this.arm,
      L = this.legs,
      c = CFG;
    if (L.type === 'lunge')
      return (
        !L.remised &&
        (L.phase === 'hold' || L.phase === 'committed') &&
        (!this.attack || this.attack.parried || this.attack.blocked)
      );
    if ((A.type === 'thrust' || A.type === 'cut') && !A.remised) {
      const e = A.T.prep + A.T.ext,
        h = e + A.T.hold;
      if (A.t >= h && A.t < h + c.remise.early) return true;
      if (A.t >= e && this.attack && (this.attack.parried || this.attack.blocked)) return true;
    }
    if (A.type === 'deflected' && A.t < c.remise.deflWin && !A.remised) return true;
    return false;
  }
  doRemise(m) {
    const old = this.attack;
    if (old && !old.hit) {
      this.attack = null;
      m.onAttackMiss(this, old);
    }
    const L = this.legs;
    if (L.type === 'lunge') {
      L.remised = true;
      this.remiseT = 0;
      if (L.stuck !== undefined) L.stuck += CFG.remise.lungeStuck;
      else L.extraStuck = CFG.remise.lungeStuck;
      this.makeAttack('remise', m, {});
      this.attack.lungeRemise = true;
    } else {
      const T = this.weapon === 'sabre' ? CFG.cut : CFG.thrust;
      const E = this.extE;
      const k = 1 - Math.pow(1 - clamp((E - 0.08) / 0.92, 0, 0.999), 1 / 3);
      this.arm = {
        type: this.weapon === 'sabre' ? 'cut' : 'thrust',
        t: T.prep + k * T.ext * 0.6,
        T,
        remised: true
      };
      this.makeAttack('remise', m, {});
    }
    this.spend('thrust');
    Snd.whoosh(0.5);
    m.onAttackStart(this);
  }
  makeAttack(kind, m, opt) {
    const o = m.other(this);
    const counter =
      !this.riposteT && (kind === 'counter' || (o.attack && (o.attack.active || o.legs.type === 'lunge')));
    this.attack = {
      id: ++ATK,
      kind,
      zone: this.zone,
      aimY: this.aimY,
      height: this.guard,
      side: this.side,
      riposte: !!opt.rip,
      counter: !!counter && !opt.rip,
      compound: opt.compound || null,
      adv: !!opt.adv,
      explosive: !!opt.explosive,
      remise: kind === 'remise',
      active: false,
      hit: false,
      parried: false,
      blocked: false,
      disengaged: false,
      minGap: 9,
      dist: m.dist(),
      t0: m.time,
      reach: m.effReach(this, opt.adv ? (opt.explosive ? 'explosive' : 'adv') : kind, this.zone),
      beat: this.arm.type === 'beat' && this.arm.contact
    };
  }
  startAttack(kind, m, opt = {}) {
    const rip = this.riposteT > 0;
    this.riposteT = 0;
    if (this.arm.type === 'disengage' && !this.arm.flipped) this.flipSide();
    const wasBeat = this.arm.type === 'beat' && this.arm.contact;
    this.makeAttack(
      kind,
      m,
      Object.assign({ rip, compound: opt.compound || (wasBeat ? 'beat' : null) }, opt)
    );
    this.lastAtkY = this.aimY;
    if (kind !== 'lunge') {
      const T = kind === 'counter' ? CFG.counter : kind === 'cut' ? CFG.cut : CFG.thrust;
      let t = rip ? T.prep : 0;
      if (opt.fromE != null) {
        const k = 1 - Math.pow(1 - clamp((opt.fromE - 0.08) / 0.92, 0, 0.999), 1 / 3);
        t = T.prep + k * T.ext;
      }
      this.arm = { type: kind === 'cut' ? 'cut' : 'thrust', t, T };
      this.spend('thrust');
      Snd.whoosh(0.55);
    } else {
      const d = this.d,
        c = CFG.lunge,
        a = CFG.advLunge;
      let t = rip ? c.prep * 0.7 : 0;
      if (opt.fromE != null) {
        const k = 1 - Math.pow(1 - clamp((opt.fromE - 0.12) / 0.88, 0, 0.999), 1 / 3);
        t = c.prep + k * c.ext;
      }
      const ex = opt.adv ? a.extra + (opt.explosive ? a.expExtra : 0) : 0;
      this.arm = { type: 'lunge', t: 0 };
      this.legs = {
        type: 'lunge',
        t,
        x0: this.x,
        f0: this.x + d * 0.42,
        r0: this.x - d * 0.38,
        fs: this.front,
        rs: this.rear,
        fast: false,
        extra: ex,
        drive: opt.explosive ? a.expDrive : c.drive,
        recMul: opt.adv ? (opt.explosive ? a.expRecMul : a.recMul) : 1,
        mom: opt.adv ? Math.max(0, this.vx * d) : 0,
        adv: !!opt.adv,
        explosive: !!opt.explosive
      };
      this.stats.lunges++;
      this.spend(opt.adv ? 'advLunge' : 'lunge');
    }
    this.stats.attacks++;
    this.disT = -1;
    this.glintT = 0.18;
    m.onAttackStart(this);
  }
  finishAttack(m) {
    const a = this.attack;
    this.attack = null;
    if (a && !a.hit) m.onAttackMiss(this, a);
  }
  startStep(sgn, fast, m, fromPress) {
    const s = CFG.step[(fast ? 'f' : '') + (sgn > 0 ? 'adv' : 'ret')];
    const prev = this.legs;
    this.legs = {
      type: 'step',
      t: 0,
      dur: s.dur * (1 + 0.6 * this.pen),
      len: s.len * (1 - 0.3 * this.pen),
      sgn,
      fast,
      x0: this.x,
      f0: this.front,
      r0: this.rear,
      fromPress: !!fromPress,
      decided: !fromPress
    };
    this.spend(fast ? 'fstep' : 'step');
    if ((prev.type === 'step' && prev.sgn !== sgn) || fast) Snd.squeak();
    if (m) m.onStep(this, sgn);
  }
  updLegs(dt, it, m) {
    const L = this.legs,
      d = this.d;
    if (L.type === 'idle') {
      const tf = this.x + d * 0.42,
        tr = this.x - d * 0.38,
        df = tf - this.front,
        dr = tr - this.rear;
      if (Math.abs(df) > 0.004) {
        this.front += df * Math.min(1, dt * 8);
        this.liftF = Math.min(0.03, Math.abs(df) * 0.6);
      } else this.liftF = 0;
      if (Math.abs(dr) > 0.004) {
        this.rear += dr * Math.min(1, dt * 8);
        this.liftR = Math.min(0.03, Math.abs(dr) * 0.6);
      } else this.liftR = 0;
      const mv = it.move || this.stepQ;
      this.stepQ = 0;
      if (mv && this.arm.type !== 'lunge' && !(mv < 0 && this.back() < -CFG.runoff + 0.35))
        this.startStep(mv, it.fast, m, false);
    }
    if (this.legs.type === 'step') {
      const S = this.legs;
      S.t += dt;
      if (!S.decided) {
        if (S.t >= CFG.halfStep.tap) S.decided = true;
        else if (it.move !== S.sgn) this.makeHalf();
      }
      if (!S.half && it.move === -S.sgn && S.t / S.dur < 0.35) {
        this.startStep(-S.sgn, it.fast, m, false);
        return;
      }
      const k = clamp(S.t / S.dur, 0, 1),
        dist = S.len * S.sgn * d,
        xe = S.x0 + dist;
      const lead = 0.62,
        kA = sstep(k / lead),
        kB = sstep((k - (1 - lead)) / lead),
        fe = xe + d * 0.42,
        re = xe - d * 0.38;
      const sa = Math.sin(Math.PI * clamp(k / lead, 0, 1)),
        sb = Math.sin(Math.PI * clamp((k - (1 - lead)) / lead, 0, 1));
      if (S.sgn > 0) {
        this.front = lerp(S.f0, fe, kA);
        this.rear = lerp(S.r0, re, kB);
        this.liftF = sa * 0.05;
        this.liftR = sb * 0.03;
      } else {
        this.rear = lerp(S.r0, re, kA);
        this.front = lerp(S.f0, fe, kB);
        this.liftR = sa * 0.04;
        this.liftF = sb * 0.03;
      }
      this.x = lerp(S.x0, xe, sstep(k)) + d * S.sgn * Math.sin(Math.PI * k) * 0.015;
      this.drop = Math.sin(Math.PI * k) * 0.012 * (S.fast ? 1.6 : 1);
      if (k >= 1) {
        this.legs = { type: 'idle', t: 0 };
        this.liftF = this.liftR = 0;
        this.drop = 0;
        this.x = xe;
        Snd.step(S.fast ? 1 : 0.6);
      }
    }
    if (this.legs.type === 'lunge') this.updLunge(dt, m);
  }
  updLunge(dt, m) {
    const L = this.legs,
      c = CFG.lunge,
      d = this.d,
      p = c.prep,
      E = p + c.ext,
      D = E + L.drive,
      Hd = D + c.hold,
      pen = this.pen;
    const rec = c.rec * L.recMul * (1 + pen);
    if (L.stuck === undefined && L.t >= Hd)
      L.stuck = (this.attack && this.attack.hit ? 0 : L.fast ? 0 : c.stuck) + (L.extraStuck || 0);
    if (L.fast && L.stuck > 0 && L.t >= Hd && L.t < Hd + L.stuck && !L.remised) L.stuck = L.t - Hd;
    const RS = Hd + (L.stuck || 0);
    const prevT = L.t;
    L.t += dt * (L.fast && L.stuck !== undefined && L.t >= RS ? c.fastRec : 1);
    const t = L.t;
    let ae, dp, dpF;
    if (t < p) {
      ae = (0.12 * t) / p;
      dp = 0;
      dpF = 0;
    } else if (t < E) {
      ae = 0.12 + 0.88 * eOut((t - p) / c.ext);
      dp = 0;
      dpF = 0;
    } else if (t < D) {
      ae = 1;
      const k = (t - E) / L.drive;
      dp = sstep(k);
      dpF = eOut(k / 0.85);
    } else if (t < RS || L.stuck === undefined) {
      ae = 1;
      dp = 1;
      dpF = 1;
    } else {
      const k = (t - RS) / rec;
      ae = 1 - sstep(k * 1.15);
      dp = 1 - sstep(k);
      dpF = 1 - sstep(k * 1.06);
      if (k >= 1) {
        this.endLunge(m);
        return;
      }
    }
    if (prevT < D && t >= D) Snd.stomp();
    if (this.remiseT >= 0) {
      this.remiseT += dt;
      ae *= 1 - 0.3 * Math.sin(Math.PI * clamp(this.remiseT / 0.16, 0, 1));
    }
    const tm = Math.min(t, 0.2),
      s = L.mom * (tm - (tm * tm) / 0.4);
    const wb = sstep(Math.min(1, t / E));
    const hipLen = (c.hip + L.extra * 0.8) * (1 - 0.6 * pen),
      footLen = (c.foot + L.extra) * (1 - 0.6 * pen);
    this.x = L.x0 + d * s + d * hipLen * dp;
    this.front = lerp(L.fs, L.f0, wb) + d * s + d * footLen * dpF;
    this.rear = lerp(L.rs, L.r0, wb) + d * s;
    this.liftF =
      t >= E && t < D
        ? Math.sin(Math.PI * clamp((t - E) / (L.drive * 0.85), 0, 1)) * 0.08
        : L.stuck !== undefined && t >= RS
          ? Math.sin(Math.PI * clamp((t - RS) / rec, 0, 1)) * 0.04
          : t < E && Math.abs(L.fs - L.f0) > 0.02
            ? Math.sin(Math.PI * wb) * 0.03
            : 0;
    this.liftR = t < E && Math.abs(L.rs - L.r0) > 0.02 ? Math.sin(Math.PI * wb) * 0.03 : 0;
    this.drop = c.drop * dp * (L.explosive ? 1.12 : 1);
    this.lungeE = ae;
    this.lungeDp = dp;
    L.phase =
      t < p
        ? 'preparation'
        : t < E
          ? 'extension'
          : t < D
            ? 'drive'
            : t < Hd
              ? 'hold'
              : L.stuck === undefined || t < RS
                ? 'committed'
                : 'recovery';
    L.total = RS + rec;
    if (this.weapon === 'sabre') this.cutR = t < E ? sstep(t / E) : t < D ? 1 - eOut((t - E) / L.drive) : 0;
    const at = this.attack;
    if (at) {
      const ok = !at.parried && !at.blocked && !at.hit;
      at.active = at.lungeRemise ? ok && this.remiseT > 0.06 && t < RS : ok && t >= E - 0.03 && t < RS;
    }
    if (!L.wh && t >= E) {
      L.wh = true;
      Snd.whoosh(L.explosive ? 1.3 : 1);
    }
  }
  endLunge(m) {
    this.legs = { type: 'idle', t: 0 };
    this.arm = { type: 'guard', t: 0 };
    this.lungeE = 0;
    this.extE = 0;
    this.lungeDp = 0;
    this.drop = 0;
    this.liftF = 0;
    this.remiseT = -1;
    this.cutR = 0;
    this.finishAttack(m);
  }
  updArm(dt, m) {
    const A = this.arm,
      c = CFG;
    A.t += dt * m.bladeMul;
    if (A.type !== 'parry') this.parryB = Math.max(0, this.parryB - dt * 7);
    if (A.type !== 'beat') this.beatK *= Math.exp(-dt * 12);
    if (A.type !== 'lunge' && A.type !== 'cut') this.cutR = 0;
    switch (A.type) {
      case 'guard':
        this.extE = Math.max(0, this.extE - dt * 7);
        this.lineEst = -1;
        break;
      case 'thrust':
      case 'cut': {
        const T = A.T,
          p = T.prep,
          e = p + T.ext,
          h = e + T.hold,
          r = h + T.ret * (1 + this.pen);
        if (
          A.t >= e &&
          A.type === 'thrust' &&
          this.holdThrust &&
          !A.noHold &&
          (A.holdT || 0) < c.lineHoldMax &&
          !(this.attack && this.attack.hit)
        ) {
          if (A.t > h - 0.001) {
            A.holdT = (A.holdT || 0) + (A.t - (h - 0.001));
            A.t = h - 0.001;
          }
          if (this.lineEst < 0) this.lineEst = m.time;
        } else if (A.t >= h) this.lineEst = -1;
        const t = A.t;
        let E;
        if (t < p) E = (0.08 * t) / p;
        else if (t < e) E = 0.08 + 0.92 * eOut((t - p) / T.ext);
        else if (t < h) E = 1;
        else E = 1 - sstep((t - h) / (r - h));
        this.extE = E;
        A.phase = t < p ? 'preparation' : t < e ? 'extension' : t < h ? 'hold' : 'return';
        if (A.type === 'cut') this.cutR = t < p ? sstep(t / p) : t < e ? 1 - eOut((t - p) / T.ext) : 0;
        if (this.attack)
          this.attack.active =
            !this.attack.parried &&
            !this.attack.blocked &&
            !this.attack.hit &&
            t >= p + T.ext * (A.type === 'cut' ? 0.3 : 0.4) &&
            t < h;
        if (t >= r) {
          this.arm = { type: 'guard', t: 0 };
          this.extE = 0;
          this.lineEst = -1;
          this.finishAttack(m);
        }
        break;
      }
      case 'lunge':
        this.extE = this.lungeE;
        break;
      case 'feint': {
        const T = c.thrust,
          p = T.prep;
        let E;
        if (A.tw === undefined) {
          E = A.t < p ? (0.08 * A.t) / p : 0.08 + 0.92 * eOut((A.t - p) / T.ext);
          A.phase = 'rising';
          if (E >= c.feint.ext) {
            E = c.feint.ext;
            A.tw = A.t;
            A.phase = 'window';
          }
        } else if (A.t < A.tw + c.feint.window + (A.ext || 0)) {
          E = c.feint.ext + Math.sin((A.t - A.tw) * 40) * 0.008;
          A.phase = 'window';
        } else {
          const k = (A.t - A.tw - c.feint.window - (A.ext || 0)) / c.feint.ret;
          E = c.feint.ext * (1 - sstep(k));
          A.phase = 'return';
          if (k >= 1) {
            this.arm = { type: 'guard', t: 0 };
            m.onFeintEnd(this, A, false);
          }
        }
        this.extE = E;
        break;
      }
      case 'beat': {
        const B = c.beat,
          w = B.wind + (A.press ? B.press : 0),
          s = w + B.strike,
          r = s + (A.contact ? B.rec : B.missRec) * (1 + this.pen);
        A.phase = A.t < w ? 'wind' : A.t < s ? 'strike' : 'recover';
        this.beatK =
          A.t < w
            ? -sstep(A.t / w)
            : A.t < s
              ? -1 + 2 * eOut((A.t - w) / B.strike)
              : 1 - sstep((A.t - s) / (r - s));
        if (A.phase === 'recover' && !A.ended) {
          A.ended = true;
          if (!A.contact) m.onBeatMiss(this);
        }
        this.extE = Math.max(0, this.extE - dt * 7);
        if (A.t >= r) {
          this.arm = { type: 'guard', t: 0 };
        }
        break;
      }
      case 'parry': {
        const Pp = c.parry,
          t = A.t;
        this.parryB =
          t < Pp.wind
            ? eOut(t / Pp.wind)
            : t < Pp.wind + Pp.active
              ? 1
              : 1 - sstep((t - Pp.wind - Pp.active) / (Pp.rec * (1 + this.pen)));
        A.active = t >= Pp.wind * 0.6 && t < Pp.wind + Pp.active;
        this.extE = Math.max(0, this.extE - dt * 7);
        if (!A.ended && t >= Pp.wind + Pp.active) {
          A.ended = true;
          if (!A.contacted) m.onParryWhiff(this);
        }
        if (t >= Pp.wind + Pp.active + Pp.rec * (1 + this.pen)) this.arm = { type: 'guard', t: 0 };
        break;
      }
      case 'disengage':
        if (!A.flipped && A.t >= c.dis.dur * 0.5) {
          A.flipped = true;
          this.flipSide();
        }
        if (A.t >= c.dis.dur) this.arm = { type: 'guard', t: 0 };
        this.extE = Math.max(0, this.extE - dt * 7);
        break;
      case 'deflected':
        this.extE = (A.e0 || 0) * (1 - sstep(A.t / c.deflect));
        if (A.t >= c.deflect) this.arm = { type: 'guard', t: 0 };
        break;
    }
    this.flex += ((this.attack && this.attack.active ? 0.12 : 0) - this.flex) * Math.min(1, dt * 12);
  }
  aimAngle(sh, m) {
    const o = m ? m.other(this) : null;
    let tx;
    if (o) {
      const z = this.zone;
      tx =
        z === 'arm'
          ? o.x + o.d * 0.32
          : z === 'thigh'
            ? o.x + o.d * 0.15
            : z === 'foot'
              ? o.front + o.d * 0.12
              : o.x + o.d * 0.05;
    } else tx = this.x + this.d * 2.2;
    const hd = clamp(Math.abs(tx - sh.x), 0.7, 2.4);
    return Math.atan2(sh.y - this.aimY, hd);
  }
  computePose(m) {
    const d = this.d,
      c = CFG;
    const bob = Math.sin(this.breath) * 0.006 * (1 + this.pen * 5);
    const vic = this.pose === 'victory' ? this.poseK : 0,
      def = this.pose === 'defeat' ? this.poseK : 0;
    const hipY =
      c.hipY + this.drop + bob - vic * (0.12 + Math.abs(Math.sin(this.breath * 3)) * 0.03) + def * 0.05;
    const hip = P(this.x - d * this.flinch * 0.03, hipY);
    const lean = this.lean - this.flinch * 0.05;
    const e = this.extE;
    const sh = P(
      hip.x + d * (0.05 + lean + 0.035 * e - vic * 0.04 + def * 0.05),
      hip.y - 0.56 + Math.max(0, lean) * 0.25 + def * 0.05 + bob * 0.5
    );
    const head = P(sh.x + d * (0.05 + def * 0.07 - 0.01 * e), sh.y - 0.21 + def * 0.05);
    const lf = ik2(hip, P(this.front, -0.085 - this.liftF), c.thigh, c.shin, -d),
      lr = ik2(hip, P(this.rear, -0.085 - this.liftR), c.thigh, c.shin, -d);
    const gh = this.gh;
    const gHand = P(sh.x + d * 0.36, sh.y + 0.17 - gh * 0.13);
    let ba = 0.13 + (gh > 0 ? gh * 0.2 : gh * 0.45);
    if (this.side === 'in') ba -= 0.05;
    let hand = gHand,
      a = ba;
    if (e > 0) {
      const aim = this.aimAngle(sh, m);
      const ext = P(sh.x + d * Math.cos(aim) * 0.6, sh.y - Math.sin(aim) * 0.6);
      hand = lerpP(gHand, ext, e);
      a = lerp(ba, aim, e);
    }
    if (this.parryB > 0) {
      const hi = this.parryH !== 'low';
      const ph = hi ? P(sh.x + d * 0.3, sh.y + 0.26) : P(sh.x + d * 0.33, sh.y + 0.26);
      hand = lerpP(hand, ph, this.parryB);
      a = lerp(a, hi ? 0.95 : -0.85, this.parryB);
    }
    if (this.disT >= 0) {
      const k = this.disT / c.dis.dur;
      a += Math.sin(k * TAU) * 0.22;
      hand = P(hand.x, hand.y + Math.sin(k * TAU) * 0.02);
    }
    if (this.arm.type === 'beat' || Math.abs(this.beatK) > 0.01) {
      a += (this.arm.sgn || 1) * this.beatK * 0.25;
    }
    if (this.cutR > 0) {
      a += this.cutR * 1.25;
      hand = P(hand.x - d * 0.04 * this.cutR, hand.y - 0.12 * this.cutR);
    }
    a += this.deflA;
    if (vic > 0) {
      hand = lerpP(hand, P(sh.x + d * 0.12, sh.y - 0.5), vic);
      a = lerp(a, 1.4, vic);
    }
    if (def > 0) {
      hand = lerpP(hand, P(sh.x + d * 0.22, sh.y + 0.46), def);
      a = lerp(a, -1.25, def);
    }
    const arm = ik2(sh, hand, c.upperArm, c.foreArm, d);
    hand = arm.end;
    const bd = P(d * Math.cos(a), -Math.sin(a));
    const guardC = add(hand, mul(bd, 0.045));
    const tip = add(guardC, mul(bd, c.blade));
    let up = P(-bd.y, bd.x);
    if (up.y > 0) up = mul(up, -1);
    const B = Math.max(this.bend, this.flex);
    const btip = this.bend > 0.01 ? sub(tip, mul(bd, 0.07 * this.bend)) : tip;
    const cp = add(lerpP(guardC, btip, 0.55), mul(up, 0.16 * B));
    const qb = u =>
      P(
        (1 - u) * (1 - u) * guardC.x + 2 * (1 - u) * u * cp.x + u * u * btip.x,
        (1 - u) * (1 - u) * guardC.y + 2 * (1 - u) * u * cp.y + u * u * btip.y
      );
    const blade = [guardC, qb(1 / 3), qb(2 / 3), btip];
    const rs = P(sh.x - d * (0.06 + 0.03 * e), sh.y + 0.03);
    const ld = this.legs.type === 'lunge' ? this.lungeDp : 0;
    let rh = lerpP(P(rs.x - d * 0.25, rs.y - 0.3), P(rs.x - d * 0.52, rs.y + 0.08), ld);
    if (vic > 0) rh = lerpP(rh, P(rs.x - d * 0.05, rs.y - 0.56), vic);
    if (def > 0) rh = lerpP(rh, P(rs.x + d * 0.02, rs.y + 0.52), def);
    const ra = ik2(rs, rh, 0.29, 0.27, -d);
    const toeF = P(lf.end.x + d * 0.22, -0.03),
      toeR = P(lr.end.x + d * 0.08, -0.03);
    this.J = {
      hip,
      sh,
      head,
      kF: lf.j,
      aF: lf.end,
      kR: lr.j,
      aR: lr.end,
      el: arm.j,
      hand,
      guardC,
      tip: btip,
      bd,
      a,
      rs,
      re: ra.j,
      rh: ra.end,
      blade,
      cp,
      toeF,
      toeR
    };
  }
  caps() {
    const J = this.J,
      d = this.d,
      mid = lerpP(J.hip, J.sh, 0.5);
    return [
      [J.hip, mid, 0.125, 'torso_l'],
      [mid, J.sh, 0.125, 'torso_u'],
      [J.head, J.head, 0.12, 'head'],
      [P(J.head.x + d * 0.05, J.head.y + 0.14), P(J.head.x + d * 0.05, J.head.y + 0.14), 0.06, 'bib'],
      [J.sh, J.el, 0.055, 'arm'],
      [J.el, J.hand, 0.045, 'arm'],
      [J.rs, J.re, 0.05, 'rarm'],
      [J.re, J.rh, 0.045, 'rarm'],
      [J.hip, J.kF, 0.085, 'thigh'],
      [J.kF, J.aF, 0.06, 'shin'],
      [J.hip, J.kR, 0.085, 'thigh'],
      [J.kR, J.aR, 0.06, 'shin'],
      [J.aF, J.toeF, 0.045, 'foot'],
      [J.aR, J.toeR, 0.045, 'foot']
    ];
  }
  targetHit(p) {
    let mn = 9,
      z = null;
    for (const c of this.caps()) {
      const g = ptSegDist(p, c[0], c[1]) - c[2];
      if (g < mn) {
        mn = g;
        z = c[3];
      }
    }
    return { gap: mn, zone: z };
  }
  trailUpd() {
    const v = this.prevTip ? len(sub(this.J.tip, this.prevTip)) / DT : 0;
    if (this.extE > 0.15 && v > 2.2 && !(this.attack && this.attack.hit)) {
      this.trail.push(this.J.tip);
      if (this.trail.length > 8) this.trail.shift();
    } else if (this.trail.length) this.trail.shift();
  }
  actionLabel() {
    const L = this.legs,
      A = this.arm;
    if (this.pose === 'victory') return 'Victory!';
    if (this.pose === 'defeat') return 'Defeat';
    if (this.attack && this.attack.hit) return 'Touch!';
    if (L.type === 'lunge')
      return (
        (L.explosive
          ? 'Patinando — '
          : L.adv
            ? 'Advance-lunge — '
            : this.attack && this.attack.remise
              ? 'Remise — '
              : 'Lunge — ') + (L.phase || 'preparation')
      );
    if (A.type === 'thrust' || A.type === 'cut') {
      const at = this.attack;
      return at
        ? at.remise
          ? 'Remise'
          : at.riposte
            ? 'Riposte'
            : at.kind === 'counter'
              ? 'Retreating counter'
              : A.type === 'cut'
                ? 'Cut'
                : this.lineEst >= 0
                  ? 'Point in line'
                  : 'Straight thrust'
        : 'Returning';
    }
    if (A.type === 'feint') return A.dis ? 'Feint — disengaged' : 'Feint';
    if (A.type === 'beat') return A.contact ? 'Beat!' : A.phase === 'recover' ? 'Beat missed' : 'Beat';
    if (A.type === 'parry') return 'Parry ' + parryNum(A.height, A.side) + (A.ended ? ' — recovering' : '');
    if (A.type === 'disengage') return 'Disengage';
    if (A.type === 'deflected') return 'Blade beaten aside';
    if (this.dispT > 0) return 'Blade displaced';
    if (L.type === 'step')
      return (L.half ? 'Half-step ' : L.fast ? 'Fast ' : '') + (L.sgn > 0 ? 'advance' : 'retreat');
    if (this.engaged) return 'Engaged';
    return this.guard === 'high' ? 'High guard' : this.guard === 'low' ? 'Low guard' : 'En garde';
  }
}

/* ================= CONTROLLERS: human, recorder, predictor, AI, dummies, ghosts ================= */
const keys = new Set();
const ACTS = ['thrust', 'lunge', 'parry', 'disengage', 'feint', 'beat', 'recover', 'adv', 'ret'];
const GUARDS = ['mid', 'high', 'low'];
class Human {
  constructor(p, opts = {}) {
    this.p = p;
    this.buf = [];
    this.kind = 'human';
    this.it = { move: 0, fast: false, guard: 'mid', zone: 'arm', aimY: null, hold: false };
    this.lastTap = { high: -9, low: -9 };
    this.dbl = { high: false, low: false };
    this.mouse = !!opts.mouse;
    this.extraFast = opts.extraFast || null;
    this.rec = null;
  }
  s(a) {
    const k = KEYS[this.p][a] || [];
    return a === 'fast' && this.extraFast ? k.concat(this.extraFast) : k;
  }
  reset() {
    this.buf.length = 0;
  }
  held(a) {
    for (const k of this.s(a)) if (keys.has(k)) return true;
    return false;
  }
  press(code, t) {
    for (const a of ACTS)
      if (this.s(a).includes(code)) {
        this.buf.push({ a, t });
        if (this.rec) this.rec.press(a);
      }
    for (const g of ['high', 'low'])
      if (this.s(g).includes(code)) {
        const now = performance.now() / 1000;
        this.dbl[g] = now - this.lastTap[g] < 0.3;
        this.lastTap[g] = now;
      }
  }
  update(self, opp, m) {
    const it = this.it,
      ad = this.held('adv'),
      re = this.held('ret'),
      hi = this.held('high'),
      lo = this.held('low');
    it.move = ad && !re ? 1 : re && !ad ? -1 : 0;
    it.fast = this.held('fast');
    it.hold = this.held('thrust');
    if (!hi) this.dbl.high = false;
    if (!lo) this.dbl.low = false;
    it.guard = hi && !lo ? 'high' : lo ? 'low' : 'mid';
    it.zone =
      hi && lo
        ? 'foot'
        : hi
          ? this.dbl.high
            ? 'head'
            : 'upper'
          : lo
            ? this.dbl.low
              ? 'thigh'
              : 'lower'
            : 'arm';
    it.aimY = null;
    if (this.mouse && m && G.mouseIn) {
      it.aimY = clamp((G.mouse.y - GY) / (m.cam.z * PPM), -1.8, -0.02);
    }
    if (this.rec) this.rec.frame(it);
  }
}
/* records a human's intents and presses for Recorded Ghosts */
class Recorder {
  constructor() {
    this.n = 0;
    this.fr = [];
    this.pr = [];
    this.last = '';
  }
  frame(it) {
    const z = ZONES.indexOf(it.zone),
      row = [this.n, it.move, it.fast ? 1 : 0, GUARDS.indexOf(it.guard), z < 0 ? 2 : z, it.hold ? 1 : 0],
      k = row.slice(1).join();
    if (k !== this.last) {
      this.fr.push(row);
      this.last = k;
    }
    this.n++;
    if (this.n > 60 * 240) this.full = true;
  }
  press(a) {
    if (!this.full) this.pr.push([this.n, a]);
  }
  data() {
    return { frames: this.fr.slice(0, 20000), presses: this.pr.slice(0, 6000), length: this.n };
  }
}
class Bot {
  constructor() {
    this.buf = [];
    this.q = [];
    this.it = { move: 0, fast: false, guard: 'mid', zone: 'arm', aimY: null, hold: false };
    this.moveOv = null;
  }
  reset() {
    this.q.length = 0;
    this.buf.length = 0;
    this.it.move = 0;
    this.it.guard = 'mid';
    this.it.hold = false;
    this.moveOv = null;
  }
  sched(at, a, guard, zone) {
    this.q.push({ at, a, guard, zone });
  }
  runQ(now) {
    for (let i = 0; i < this.q.length; i++) {
      const e = this.q[i];
      if (now >= e.at) {
        this.q.splice(i--, 1);
        if (e.guard) this.it.guard = e.guard;
        if (e.zone) this.it.zone = e.zone;
        if (e.a) this.buf.push({ a: e.a, t: now });
      }
    }
  }
  seek(dist, tgt, back, tol = 0.16) {
    const err = dist - tgt;
    if (err > tol) {
      this.it.move = 1;
      this.it.fast = err > 1.1;
    } else if (err < -tol && back > 0.5) {
      this.it.move = -1;
      this.it.fast = err < -0.9;
    } else this.it.move = 0;
  }
}
const zoneGuard = z =>
  z === 'head' || z === 'upper' ? 'high' : z === 'lower' || z === 'thigh' || z === 'foot' ? 'low' : 'mid';

/* opponent-action predictor: recency-weighted, smoothed n-gram transition model over OBSERVED actions */
const TOKS = ['A', 'R', 'T', 'L', 'F', 'P', 'B', 'D'];
class Predictor {
  constructor(decay = 0.95) {
    this.decay = decay;
    this.uni = {};
    this.bi = {};
    this.tri = {};
    this.hist = [];
    this.lineH = 1;
    this.lineL = 1;
    this.pHigh = 1;
    this.pLow = 1;
    this.resp = { P: 1, R: 1, C: 1, N: 1 };
    this.atkDist = 2.2;
    this.n = 0;
    this.zoneScored = {};
  }
  static dec(o, d) {
    for (const k in o) {
      if (typeof o[k] === 'object') Predictor.dec(o[k], d);
      else o[k] *= d;
    }
  }
  obs(tok) {
    Predictor.dec(this.uni, this.decay);
    Predictor.dec(this.bi, this.decay);
    Predictor.dec(this.tri, this.decay);
    const h = this.hist,
      p1 = h[h.length - 1] || '_',
      p2 = (h[h.length - 2] || '_') + p1;
    this.uni[tok] = (this.uni[tok] || 0) + 1;
    (this.bi[p1] = this.bi[p1] || {})[tok] = (this.bi[p1][tok] || 0) + 1;
    (this.tri[p2] = this.tri[p2] || {})[tok] = (this.tri[p2][tok] || 0) + 1;
    h.push(tok);
    if (h.length > 40) h.shift();
    this.n++;
  }
  dist() {
    const h = this.hist,
      p1 = h[h.length - 1] || '_',
      p2 = (h[h.length - 2] || '_') + p1,
      t = this.tri[p2] || {},
      b = this.bi[p1] || {},
      u = this.uni;
    const s = o => Object.values(o).reduce((a, x) => a + x, 0),
      nt = s(t),
      nb = s(b),
      nu = s(u);
    const l3 = nt / (nt + 2),
      l2 = ((1 - l3) * nb) / (nb + 2),
      l1 = 1 - l3 - l2;
    const D = {};
    for (const k of TOKS)
      D[k] =
        (l3 * (t[k] || 0)) / (nt || 1) +
        (l2 * (b[k] || 0)) / (nb || 1) +
        (l1 * ((u[k] || 0) + 0.5)) / (nu + 0.5 * TOKS.length);
    return D;
  }
  pAttack() {
    const D = this.dist();
    return D.T + D.L;
  }
  line(low) {
    const d = this.decay;
    this.lineH *= d;
    this.lineL *= d;
    if (low) this.lineL++;
    else this.lineH++;
  }
  parryLine(low) {
    const d = this.decay;
    this.pHigh *= d;
    this.pLow *= d;
    if (low) this.pLow++;
    else this.pHigh++;
  }
  response(r) {
    for (const k in this.resp) this.resp[k] *= this.decay;
    this.resp[r] = (this.resp[r] || 0) + 1;
  }
  lowRate() {
    return this.lineL / (this.lineH + this.lineL);
  }
  parryHighRate() {
    return this.pHigh / (this.pHigh + this.pLow);
  }
  confidence() {
    return clamp(this.n / 25, 0, 1);
  }
  save() {
    return {
      uni: this.uni,
      bi: this.bi,
      tri: this.tri,
      lineH: this.lineH,
      lineL: this.lineL,
      pHigh: this.pHigh,
      pLow: this.pLow,
      resp: this.resp,
      atkDist: this.atkDist,
      n: Math.min(this.n, 40),
      zoneScored: this.zoneScored
    };
  }
  load(o, w = 0.5) {
    if (!o || typeof o !== 'object') return;
    const cp = x => {
      const r = {};
      for (const k in x) {
        if (typeof x[k] === 'object' && x[k]) r[k] = cp(x[k]);
        else if (isFinite(x[k])) r[k] = x[k] * w;
      }
      return r;
    };
    try {
      this.uni = cp(o.uni || {});
      this.bi = cp(o.bi || {});
      this.tri = cp(o.tri || {});
      this.lineH = 1 + (o.lineH || 0) * w;
      this.lineL = 1 + (o.lineL || 0) * w;
      this.pHigh = 1 + (o.pHigh || 0) * w;
      this.pLow = 1 + (o.pLow || 0) * w;
      this.resp = Object.assign({ P: 1, R: 1, C: 1, N: 1 }, cp(o.resp || {}));
      this.atkDist = isFinite(o.atkDist) ? o.atkDist : 2.2;
      this.n = Math.round((o.n || 0) * w);
      this.zoneScored = cp(o.zoneScored || {});
    } catch (e) {}
  }
}
const LV = [
  {
    name: 'Beginner',
    desc: 'Slow reactions, frequent mistakes',
    react: [0.45, 0.65],
    think: 0.6,
    acc: 0.55,
    terr: 0.12,
    miss: 0.3,
    rating: 850
  },
  {
    name: 'Intermediate',
    desc: 'Basic defence and ripostes',
    react: [0.25, 0.4],
    think: 0.45,
    acc: 0.75,
    terr: 0.07,
    miss: 0.12,
    rating: 1050
  },
  {
    name: 'Advanced',
    desc: 'Sharp distance and timing',
    react: [0.15, 0.25],
    think: 0.32,
    acc: 0.87,
    terr: 0.045,
    miss: 0.05,
    rating: 1250
  },
  {
    name: 'Expert',
    desc: 'Elite reactions and accuracy',
    react: [0.1, 0.18],
    think: 0.22,
    acc: 0.94,
    terr: 0.03,
    miss: 0.02,
    rating: 1450
  }
];
const W0 = {
  pressure: 1,
  defend: 1,
  distance: 1,
  bait: 0.6,
  prepare: 1,
  counter: 0.8,
  protect: 1,
  force: 0.6,
  break: 0.5
};
const PERS = {
  balanced: {
    name: 'Balanced',
    desc: 'An all-round épéeist with no glaring weakness',
    w: W0,
    zones: { head: 0.08, upper: 0.27, arm: 0.3, lower: 0.2, thigh: 0.1, foot: 0.05 },
    kinds: { thrust: 0.35, lunge: 0.45, adv: 0.2 },
    feint: 0.22,
    beat: 0.15,
    disc: 0.5,
    parry: 0.6,
    retreat: 0.5,
    counter: 0.4,
    remise: 0.25,
    predict: 0.5,
    temp: 0.35,
    pressure: 'patient',
    delayVar: 0.05,
    keep: 0,
    line: 0.1,
    bonus: 0
  },
  sniper: {
    name: 'The Sniper',
    desc: 'Picks off the arm and foot from long range; struggles under sustained pressure',
    w: { ...W0, distance: 1.7, prepare: 1.2, pressure: 0.35, counter: 1.1, defend: 0.7 },
    zones: { head: 0.03, upper: 0.1, arm: 0.55, lower: 0.08, thigh: 0.1, foot: 0.14 },
    kinds: { thrust: 0.6, lunge: 0.32, adv: 0.08 },
    feint: 0.15,
    beat: 0.1,
    disc: 0.6,
    parry: 0.45,
    retreat: 0.75,
    counter: 0.6,
    remise: 0.2,
    predict: 0.5,
    temp: 0.25,
    pressure: 'patient',
    delayVar: 0.04,
    keep: 0.25,
    line: 0.25,
    bonus: 40
  },
  wall: {
    name: 'The Wall',
    desc: 'Superb parries and patience; bites on convincing feints and compound attacks',
    w: { ...W0, defend: 1.9, protect: 1.5, distance: 1.2, pressure: 0.35, prepare: 0.5, force: 0.3 },
    zones: { head: 0.05, upper: 0.35, arm: 0.25, lower: 0.25, thigh: 0.08, foot: 0.02 },
    kinds: { thrust: 0.6, lunge: 0.35, adv: 0.05 },
    feint: 0.05,
    beat: 0.1,
    disc: 0.15,
    parry: 1,
    retreat: 0.25,
    counter: 0.2,
    remise: 0.1,
    predict: 0.6,
    temp: 0.25,
    pressure: 'patient',
    delayVar: 0.03,
    keep: 0.1,
    line: 0.05,
    bonus: 60,
    parryAcc: 0.08
  },
  phantom: {
    name: 'The Phantom',
    desc: 'Feints constantly with unpredictable timing; undone by disciplined defence',
    w: { ...W0, prepare: 1.6, force: 1.4, bait: 1, defend: 0.7 },
    zones: { head: 0.12, upper: 0.2, arm: 0.2, lower: 0.28, thigh: 0.15, foot: 0.05 },
    kinds: { thrust: 0.3, lunge: 0.5, adv: 0.2 },
    feint: 0.75,
    beat: 0.2,
    disc: 0.5,
    parry: 0.4,
    retreat: 0.55,
    counter: 0.35,
    remise: 0.35,
    predict: 0.4,
    temp: 0.45,
    pressure: 'patient',
    delayVar: 0.25,
    keep: 0,
    line: 0.05,
    bonus: 50
  },
  berserker: {
    name: 'The Berserker',
    desc: 'Relentless pressure and advance-lunges; walks into distance traps',
    w: { ...W0, pressure: 2.3, prepare: 1.3, defend: 0.35, distance: 0.3, protect: 0.4, counter: 0.4 },
    zones: { head: 0.1, upper: 0.4, arm: 0.12, lower: 0.28, thigh: 0.08, foot: 0.02 },
    kinds: { thrust: 0.15, lunge: 0.3, adv: 0.55 },
    feint: 0.1,
    beat: 0.25,
    disc: 0.3,
    parry: 0.3,
    retreat: 0.2,
    counter: 0.25,
    remise: 0.45,
    predict: 0.3,
    temp: 0.4,
    pressure: 'reckless',
    delayVar: 0.05,
    keep: -0.2,
    line: 0,
    bonus: 20
  },
  professor: {
    name: 'The Professor',
    desc: 'Reads your habits and turns them against you; beaten by deliberate pattern-breaking',
    w: { ...W0, bait: 1.1, break: 1.1, prepare: 1.2, force: 1 },
    zones: { head: 0.08, upper: 0.27, arm: 0.3, lower: 0.2, thigh: 0.1, foot: 0.05 },
    kinds: { thrust: 0.35, lunge: 0.45, adv: 0.2 },
    feint: 0.3,
    beat: 0.2,
    disc: 0.6,
    parry: 0.65,
    retreat: 0.45,
    counter: 0.45,
    remise: 0.25,
    predict: 1,
    temp: 0.2,
    pressure: 'patient',
    delayVar: 0.05,
    keep: 0,
    line: 0.1,
    bonus: 80,
    adaptDecay: 0.9
  },
  counterpuncher: {
    name: 'The Counterpuncher',
    desc: 'Waits, traps and punishes recovery; uncomfortable chasing a deficit',
    w: { ...W0, counter: 2.1, distance: 1.5, bait: 1.4, prepare: 0.35, pressure: 0.3, force: 0.3 },
    zones: { head: 0.05, upper: 0.3, arm: 0.35, lower: 0.2, thigh: 0.08, foot: 0.02 },
    kinds: { thrust: 0.55, lunge: 0.4, adv: 0.05 },
    feint: 0.1,
    beat: 0.1,
    disc: 0.75,
    parry: 0.6,
    retreat: 0.7,
    counter: 0.85,
    remise: 0.2,
    predict: 0.6,
    temp: 0.25,
    pressure: 'passive',
    delayVar: 0.04,
    keep: 0.15,
    line: 0.15,
    bonus: 60
  },
  champion: {
    name: 'The Champion',
    desc: 'Changes style during the bout and controls distance; beatable, but rarely twice the same way',
    w: { ...W0, distance: 1.3, prepare: 1.2, counter: 1.1 },
    zones: { head: 0.08, upper: 0.27, arm: 0.3, lower: 0.2, thigh: 0.1, foot: 0.05 },
    kinds: { thrust: 0.35, lunge: 0.45, adv: 0.2 },
    feint: 0.35,
    beat: 0.25,
    disc: 0.65,
    parry: 0.7,
    retreat: 0.5,
    counter: 0.5,
    remise: 0.3,
    predict: 0.8,
    temp: 0.25,
    pressure: 'patient',
    delayVar: 0.06,
    keep: 0.05,
    line: 0.15,
    bonus: 120,
    shifts: true
  }
};
const PERS_KEYS = Object.keys(PERS);

class AI extends Bot {
  constructor(lv, pk = 'balanced', opts = {}) {
    super();
    this.lv = lv;
    this.p = Object.assign({}, LV[lv], opts.lv || {});
    this.pk = pk;
    this.P0 = JSON.parse(JSON.stringify(opts.pers || PERS[pk]));
    this.P = JSON.parse(JSON.stringify(this.P0));
    this.kind = 'ai';
    this.pred = new Predictor(this.P.adaptDecay || 0.95);
    if (opts.memory) this.pred.load(opts.memory);
    this.goal = 'distance';
    this.goalU = {};
    this.think = 0.3;
    this.watch = null;
    this.delay = rnd(this.p.react[0], this.p.react[1]);
    this.delayT = 0;
    this.tgt = 3;
    this.ripPlanned = false;
    this.recoverUntil = 0;
    this.vulnCD = 0;
    this.logIdx = 0;
    this.mine = [];
    this.styleT = rnd(25, 35);
    this.style = null;
    this.concededRow = 0;
    this.lastScore = null;
    this.mode = 'observe';
    this.dbg = {};
  }
  reset() {
    super.reset();
    this.watch = null;
    this.ripPlanned = false;
    this.think = rnd(0.2, 0.6);
    this.tgt = 3;
  }
  parrySide(self, m) {
    return m.perceive(1 - self.i, this.delay).side;
  }
  /* layer 1: perception + observed-action ingestion (no access to inputs) */
  perceive(self, opp, m) {
    const now = m.time;
    this.delayT -= DT;
    if (this.delayT <= 0) {
      this.delay = rnd(this.p.react[0], this.p.react[1]);
      this.delayT = rnd(0.4, 0.9);
    }
    const eng = self.engaged ? Math.min(this.delay, 0.1) : this.delay;
    const S = m.perceive(opp.i, eng);
    const log = m.pub[opp.i];
    while (this.logIdx < log.length && log[this.logIdx].t <= now - this.delay) {
      const e = log[this.logIdx++];
      this.ingest(e, self, m);
    }
    return S;
  }
  ingest(e, self, m) {
    const pr = this.pred;
    pr.obs(e.tok);
    if (e.tok === 'T' || e.tok === 'L') {
      pr.line(e.low);
      pr.atkDist = lerp(pr.atkDist, e.dist, 0.25);
    }
    if (e.tok === 'P') pr.parryLine(e.low);
    if (this.awaitResp && m.time - this.awaitResp < 0.8) {
      if (e.tok === 'P') {
        pr.response('P');
        this.awaitResp = 0;
      } else if (e.tok === 'R') {
        pr.response('R');
        this.awaitResp = 0;
      } else if (e.tok === 'T' || e.tok === 'L') {
        pr.response('C');
        this.awaitResp = 0;
      }
    }
  }
  update(self, opp, m) {
    const p = this.p,
      P = this.P,
      now = m.time;
    this.weapon = m.weapon;
    const S = this.perceive(self, opp, m);
    const dist = Math.abs(S.x - self.x),
      back = self.back();
    this.runQ(now);
    // champion: style shifts
    if (P.shifts) {
      this.styleT -= DT;
      const sc = m.score[1 - self.i];
      if (this.lastScore != null && sc > this.lastScore) this.concededRow++;
      else if (m.score[self.i] > (this.lastOwn || 0)) this.concededRow = 0;
      this.lastScore = sc;
      this.lastOwn = m.score[self.i];
      if (this.styleT <= 0 || this.concededRow >= 2) {
        this.styleT = rnd(25, 35);
        this.concededRow = 0;
        const pk = pick(['sniper', 'wall', 'phantom', 'professor', 'counterpuncher']);
        this.style = PERS[pk].name;
        const b = PERS[pk];
        this.P = JSON.parse(JSON.stringify(this.P0));
        for (const k in this.P.w) this.P.w[k] = (this.P0.w[k] + b.w[k]) / 2;
        this.P.feint = (this.P0.feint + b.feint) / 2;
        this.P.zones = b.zones;
        this.P.kinds = b.kinds;
      }
    }
    this.reflex(self, opp, S, dist, m, back);
    if (self.riposteT > 0 && !this.ripPlanned) {
      this.ripPlanned = true;
      this.q.length = 0;
      this.moveOv = null;
      const z = this.openZone(S);
      this.it.zone = z;
      this.sched(now + this.delay * 0.45, dist < 1.75 ? 'thrust' : 'lunge', zoneGuard(z), z);
    }
    if (self.riposteT <= 0 && !self.attack && !this.q.length) this.ripPlanned = false;
    const free = !self.attack && self.arm.type === 'guard' && self.legs.type !== 'lunge';
    // remise when own attack was parried/missed and opponent is not visibly riposting
    if (self.canRemise() && !this.remTried) {
      this.remTried = true;
      if (chance(P.remise) && !(S.ext > 0.3)) this.buf.push({ a: 'thrust', t: now });
    }
    if (free) this.remTried = false;
    // exploit visible vulnerability (recovering, overextended, beaten blade)
    const myR = m.effReach(self, dist < 2 ? 'thrust' : 'lunge', self.zone);
    if (S.vuln && now > this.vulnCD && free && dist < myR + 0.05 && !this.ripPlanned && !this.q.length) {
      this.vulnCD = now + 0.7;
      if (chance(0.3 + P.counter * 0.6)) {
        this.mode = 'counterattack';
        this.strike(self, dist < 1.7 ? 'thrust' : 'lunge', m, S);
      }
    }
    if (this.moveOv) {
      if (now < this.moveOv.until) {
        this.it.move = this.moveOv.move;
        this.it.fast = this.moveOv.fast;
        if (this.it.move < 0 && back < 0.6) this.it.move = 0;
      } else this.moveOv = null;
    }
    this.think -= DT;
    if (this.think <= 0) {
      this.think = p.think * rnd(0.7, 1.3) + (P.delayVar ? rnd(0, P.delayVar * 2) : 0);
      if (!this.moveOv) this.decide(self, opp, S, dist, m, back);
    }
    if (!this.moveOv) this.seek(dist, this.tgt, back);
    this.it.hold = this.holdLine && now < this.holdLine;
  }
  /* defensive reflex: reacts to VISIBLE extension; disciplined fencers wait for confirmation (resists feints) */
  reflex(self, opp, S, dist, m, back) {
    const P = this.P,
      p = this.p,
      now = m.time;
    if (S.ep >= 0 && (!this.watch || this.watch.ep !== S.ep) && S.ext > 0.1) {
      this.watch = { ep: S.ep, t: now, done: false };
    }
    const w = this.watch;
    if (!w || w.done || S.ep !== w.ep) return;
    if (self.attack || self.legs.type === 'lunge' || this.ripPlanned) return;
    const confirmed = S.lunging || S.ext >= 0.65;
    const pA = this.pred.pAttack(),
      conf = this.pred.confidence();
    const discWait =
      P.disc * 0.16 * (m.pressure && P.pressure === 'reckless' && m.pressure[self.i] ? 0.4 : 1);
    const premature = now - w.t >= discWait * (1 - 0.5 * conf * pA * P.predict);
    if (!confirmed) {
      if (!premature) return;
      if (!w.rolled) {
        w.rolled = true;
        w.react = chance((1 - P.disc) * (0.55 + 0.45 * pA * conf * P.predict) + 0.05);
      }
      if (!w.react) return;
    }
    w.done = true;
    if (chance(p.miss)) return;
    this.awaitAtk = now;
    const kind = S.lunging ? 'lunge' : 'thrust';
    const reach = m.effReachObs(S, kind);
    const dv = m.doubleValue(self.i),
      row = RULES[m.weapon].row;
    if (kind === 'lunge' && dist > reach + 0.12) {
      this.mode = 'distance trap';
      this.moveOv = { move: back > 1 ? -1 : 0, fast: false, until: now + 0.15 };
      return;
    }
    let wP = P.parry + 0.25,
      wR = P.retreat * (back > 1.2 ? 1 : back > 0.7 ? 0.25 : 0) * (kind === 'lunge' ? 1 : 0.6),
      wC = P.counter * (row ? 0.15 : Math.max(0.05, 0.6 + 0.8 * dv)) * (kind === 'lunge' ? 0.5 : 0.8);
    const r = RNG() * (wP + wR + wC);
    if (r < wP) {
      this.mode = 'defend';
      let low;
      if (S.aim != null && S.ext > 0.35) low = S.aim > -1.12;
      else low = chance(lerp(0.5, this.pred.lowRate(), P.predict * conf));
      const acc = Math.min(0.99, p.acc + (P.parryAcc || 0));
      if (!chance(acc)) low = !low;
      const arrival = kind === 'lunge' ? 0.27 : 0.12,
        elapsed = S.epT + this.delay;
      const wait = Math.max(0, arrival - elapsed - 0.1 + rnd(-p.terr, p.terr));
      this.q.length = 0;
      const g = low ? 'low' : 'high';
      this.it.guard = g;
      this.sched(now + wait, 'parry', g);
    } else if (r < wP + wR) {
      this.mode = 'retreat';
      this.moveOv = { move: -1, fast: true, until: now + (kind === 'lunge' ? 0.45 : 0.3) };
    } else {
      this.mode = 'stop-hit';
      this.q.length = 0;
      this.it.zone = 'arm';
      this.sched(now + rnd(0, 0.05), 'thrust', 'mid', 'arm');
    }
  }
  openZone(S) {
    const z = Object.assign({}, this.P.zones);
    if (S.guard === 'high') {
      z.lower *= 1.6;
      z.thigh *= 1.5;
      z.upper *= 0.6;
    } else if (S.guard === 'low') {
      z.upper *= 1.6;
      z.head *= 1.4;
      z.lower *= 0.6;
    }
    this.filterZones(z);
    return wpick(z);
  }
  filterZones(z) {
    if (this.weapon === 'foil') {
      z.head = z.arm = z.thigh = z.foot = 0;
      z.upper += 0.3;
      z.lower += 0.3;
    }
    if (this.weapon === 'sabre') {
      z.lower *= 0.6;
      z.thigh = z.foot = 0;
      z.head += 0.2;
      z.arm += 0.1;
    }
  }
  /* layers 2-3: tactical analysis + utility-based strategy selection */
  decide(self, opp, S, dist, m, back) {
    const P = this.P,
      now = m.time,
      pr = this.pred,
      conf = pr.confidence();
    if (self.attack || self.legs.type === 'lunge' || self.arm.type !== 'guard' || this.q.length) return;
    this.it.guard = 'mid';
    this.it.zone = 'arm';
    const sc = m.score[self.i],
      so = m.score[1 - self.i],
      diff = sc - so,
      tl = m.o.periodLen ? m.clock : 999,
      ot = m.overtime;
    const behind = diff < 0 || (ot && m.priority !== self.i),
      ahead = diff > 0 || (ot && m.priority === self.i);
    const lateBehind = behind && (tl < 45 || ot || diff <= -3);
    const oppReach = m.effReachObs(S, 'adv'),
      myL = m.effReach(self, 'lunge', self.zone);
    const pA = pr.pAttack(),
      dv = m.doubleValue(self.i);
    const ent = this.entropy();
    const U = {};
    const w = P.w;
    U.pressure =
      w.pressure *
      (1 +
        (lateBehind ? 1.2 : 0) +
        (S.back < 2 ? 0.6 : 0) +
        (pr.resp.R / (pr.resp.P + pr.resp.R + pr.resp.C + pr.resp.N)) * 0.8 -
        self.pen * 2);
    U.defend = w.defend * (0.6 + pA * conf + (ahead ? 0.4 : 0));
    U.distance = w.distance * (0.7 + (pr.atkDist > 2.4 ? 0.6 : 0) + (ahead ? 0.3 : 0));
    U.bait = w.bait * (0.5 + pA * 0.8);
    U.prepare = w.prepare * (0.8 + (behind ? 0.3 : 0));
    U.counter =
      w.counter * (0.5 + pA * conf + (pr.atkDist > 2.4 ? 0.5 : 0)) * (RULES[m.weapon].row ? 0.6 : 1);
    U.protect = w.protect * (ahead && (tl < 60 || diff >= 2 || ot) ? 1.6 : 0.2) * (1 + Math.max(0, dv));
    U.force = w.force * (0.5 + pr.resp.P / (pr.resp.P + pr.resp.R + pr.resp.C + pr.resp.N));
    U.break = w.break * (ent < 0.9 ? 1.2 : 0.2);
    if (lateBehind) {
      const pm = P.pressure;
      if (pm === 'reckless') {
        U.pressure *= 2.2;
        U.prepare *= 1.4;
        U.defend *= 0.3;
      } else if (pm === 'passive') {
        U.pressure *= 1.2;
        U.counter *= 1.3;
      } else {
        U.prepare *= 1.3;
      }
      U.protect = 0;
    }
    if (back < 1.5) {
      U.defend *= 0.6;
      U.distance *= 0.3;
      U.pressure *= 1.5;
      U.prepare *= 1.3;
    }
    if (m.tieAtMatchPoint && m.tieAtMatchPoint()) {
      U.counter *= 0.6;
      U.prepare *= 1.2;
      U.bait *= 1.3;
    }
    for (const k in U) U[k] *= Math.exp(rnd(-1, 1) * P.temp * 0.5);
    this.goalU = U;
    let best = null,
      bv = -1;
    for (const k in U)
      if (U[k] > bv) {
        bv = U[k];
        best = k;
      }
    if (this.recoverUntil > now && best !== 'pressure') best = 'distance';
    this.goal = best;
    this.mode = best;
    const keep = P.keep || 0;
    const tg = {
      pressure: myL - 0.15,
      defend: oppReach + 0.4,
      distance: oppReach + 0.12 + keep,
      bait: oppReach + 0.02,
      prepare: myL + 0.2 + keep,
      counter: oppReach + 0.15,
      protect: oppReach + 0.5,
      force: myL + 0.05,
      break: myL
    }[best];
    this.tgt = clamp(tg + rnd(-0.12, 0.12), 1.4, 4.2);
    // offensive decisions (layer 4 uses the same actions as humans)
    const aggr =
      best === 'pressure'
        ? 0.55
        : best === 'prepare'
          ? 0.45
          : best === 'force'
            ? 0.35
            : best === 'break'
              ? 0.4
              : best === 'bait'
                ? 0.1
                : 0.05;
    const adv = m.effReach(self, 'adv', self.zone),
      thr = m.effReach(self, 'thrust', self.zone);
    if (dist <= adv + 0.05 && chance(aggr * (lateBehind && P.pressure === 'passive' ? 0.6 : 1))) {
      const k = dist <= thr ? 'thrust' : dist <= myL ? 'lunge' : 'adv';
      this.strike(self, k, m, S);
      return;
    }
    if (best === 'force' && dist < myL + 0.4 && chance(0.35)) {
      this.it.guard = 'high';
      this.buf.push({ a: 'feint', t: now });
      this.recoverUntil = now + 0.4;
      return;
    }
    if (best === 'bait' && chance(0.5)) {
      this.buf.push({ a: 'hadv', t: now });
      this.sched(now + rnd(0.35, 0.6), 'hret');
      return;
    }
    if ((best === 'defend' || best === 'protect') && RULES[m.weapon].row && dist < 2.6 && chance(P.line)) {
      this.it.zone = 'upper';
      this.buf.push({ a: 'thrust', t: now });
      this.holdLine = now + rnd(0.5, 1.2);
    }
  }
  entropy() {
    const c = {};
    for (const x of this.mine) c[x] = (c[x] || 0) + 1;
    const n = this.mine.length;
    if (n < 3) return 2;
    let h = 0;
    for (const k in c) {
      const p = c[k] / n;
      h -= p * Math.log2(p);
    }
    return h;
  }
  /* executes an attack plan: direct, compound (feint/disengage, beat) — chosen against predicted defence */
  strike(self, kind, m, S) {
    const P = this.P,
      now = m.time,
      pr = this.pred;
    const z = Object.assign({}, P.zones);
    const ph = pr.parryHighRate(),
      conf = pr.confidence();
    z.lower *= 1 + P.predict * conf * (ph - 0.5) * 2;
    z.thigh *= 1 + P.predict * conf * (ph - 0.5) * 2;
    z.upper *= 1 - P.predict * conf * (ph - 0.5) * 1.5;
    z.head *= 1 - P.predict * conf * (ph - 0.5) * 1.5;
    for (const k in pr.zoneScored) if (z[k] != null) z[k] *= 1 + Math.min(1.5, pr.zoneScored[k] * 0.3);
    if (this.goal === 'break') for (const x of this.mine.slice(-3)) if (z[x] != null) z[x] *= 0.3;
    this.weapon = m.weapon;
    this.filterZones(z);
    for (const k in z) z[k] = Math.max(0.001, z[k]);
    const zone = wpick(z);
    this.mine.push(zone);
    if (this.mine.length > 8) this.mine.shift();
    const g = zoneGuard(zone);
    this.it.zone = zone;
    this.it.guard = g;
    const pParry = pr.resp.P / (pr.resp.P + pr.resp.R + pr.resp.C + pr.resp.N);
    const compoundP = P.feint * (0.5 + pParry * P.predict);
    const t0 = now + 0.03;
    if (kind === 'adv') {
      this.it.fast = chance(P.kinds.adv > 0.4 ? 0.6 : 0.3);
      this.moveOv = { move: 1, fast: this.it.fast, until: now + 0.3 };
      const tl = t0 + 0.17 * (this.it.fast ? 0.72 : 1);
      if (chance(compoundP * 0.5)) {
        this.sched(tl - 0.08, 'feint', g, zone);
        this.sched(tl + 0.02, 'lunge', g, zone);
      } else this.sched(tl, 'lunge', g, zone);
    } else if (chance(compoundP) && kind !== 'thrust') {
      this.sched(t0, 'feint', g, zone);
      if (chance(0.7)) this.sched(t0 + 0.1, 'disengage');
      this.sched(t0 + 0.19, kind, g, zone);
    } else if (chance(compoundP * 0.6) && kind === 'thrust') {
      this.sched(t0, 'feint', g, zone);
      this.sched(t0 + 0.14, 'thrust', g, zone);
    } else if (chance(P.beat) && S && !S.disp) {
      this.sched(t0, 'beat');
      this.sched(t0 + 0.11, kind, g, zone);
    } else this.sched(t0, kind, g, zone);
    this.awaitResp = now;
    this.recoverUntil = now + (kind === 'thrust' ? 0.6 : 1.0);
  }
}
class Dummy extends Bot {
  constructor(type, opt = {}) {
    super();
    this.type = type;
    this.kind = 'dummy';
    this.tm = 2;
    this.tgt = type === 'mover' ? 2.6 : 2.3;
    this.watch = null;
    this.mode = type;
    this.o = opt;
  }
  reset() {
    super.reset();
    this.tm = this.o.firstDelay || 1.5;
    this.watch = null;
  }
  parrySide(self, m) {
    return m.perceive(1 - self.i, 0.12).side;
  }
  update(self, opp, m) {
    const now = m.time;
    this.runQ(now);
    const S = m.perceive(opp.i, this.o.delay || 0.12);
    const dist = Math.abs(S.x - self.x),
      back = self.back();
    const free = self.arm.type === 'guard' && self.legs.type !== 'lunge' && !self.attack;
    if (this.type === 'static') {
      this.it.move = 0;
      return;
    }
    if (this.type === 'mover') {
      this.tm -= DT;
      if (this.tm <= 0) {
        this.tm = rnd(1, 2.2);
        this.tgt = rnd(1.9, 3.5);
      }
      this.seek(dist, this.tgt, back, 0.1);
      return;
    }
    if (this.type === 'attacker' || this.type === 'lunger') {
      const at = this.o.at || 2.15;
      if (free && !this.q.length) this.seek(dist, at, back, 0.1);
      else this.it.move = 0;
      this.tm -= DT;
      if (this.tm <= 0 && free && !this.q.length && Math.abs(dist - at) < 0.2) {
        const z = this.o.zone || pick(['upper', 'arm', 'lower']);
        this.it.zone = z;
        this.it.guard = zoneGuard(z);
        if (!this.o.silent) m.float(self, zoneGuard(z) === 'low' ? 'LOW LINE' : 'HIGH LINE', '#ffd76a', 0.9);
        this.sched(now + (this.o.tell || 0.6), 'lunge', zoneGuard(z), z);
        this.tm = rnd(2.8, 3.8);
      }
      if (free && !this.q.length && this.tm < 2.2) {
        this.it.guard = 'mid';
      }
      if (self.riposteT > 0 && this.o.riposte && !this.q.length)
        this.sched(now + 0.2, 'thrust', 'mid', 'upper');
      return;
    }
    if (this.type === 'parrier' || this.type === 'eager') {
      if (free && !this.q.length) this.seek(dist, this.o.at || 2.3, back, 0.15);
      else if (!free) this.it.move = 0;
      if (S.ep >= 0 && S.ext > 0.1 && (!this.watch || this.watch.ep !== S.ep)) {
        this.watch = { ep: S.ep };
        const h =
          this.type === 'eager' ? 'high' : S.aim != null && S.aim > -1.12 ? 'low' : this.o.guess || 'high';
        this.it.guard = h;
        const wait =
          this.type === 'eager' ? 0 : Math.max(0, (S.lunging ? 0.27 : 0.12) - (S.epT + 0.12) - 0.1);
        this.sched(now + wait, 'parry', h);
      }
      if (self.riposteT > 0 && !this.q.length)
        this.sched(now + 0.22, dist < 1.75 ? 'thrust' : 'lunge', 'mid', 'upper');
      if (free && !this.q.length && S.ep < 0) this.it.guard = this.type === 'eager' ? 'high' : 'mid';
    }
  }
}
/* Recorded ghost: replays a recorded human's intents and presses through the normal mechanics */
class RecordedGhost extends Bot {
  constructor(data) {
    super();
    this.kind = 'ghost';
    this.d = data;
    this.n = 0;
    this.fi = 0;
    this.pi = 0;
    this.mode = 'recorded';
  }
  reset() {
    this.buf.length = 0;
  }
  update(self, opp, m) {
    const d = this.d;
    while (this.fi < d.frames.length && d.frames[this.fi][0] <= this.n) {
      const r = d.frames[this.fi++];
      this.it.move = r[1];
      this.it.fast = !!r[2];
      this.it.guard = GUARDS[r[3]] || 'mid';
      this.it.zone = ZONES[r[4]] || 'arm';
      this.it.hold = !!r[5];
    }
    while (this.pi < d.presses.length && d.presses[this.pi][0] <= this.n) {
      this.buf.push({ a: d.presses[this.pi++][1], t: m.time });
    }
    this.n++;
    if (this.n > d.length) {
      this.it.move = 0;
      this.it.hold = false;
      this.mode = 'recording ended';
    }
  }
}
/* Behavioural ghost: an AI whose personality and action sequencing are derived from a player profile */
function persFromProfile(pf) {
  const tot = Math.max(1, pf.attacks);
  const z = {};
  for (const k of ZONES) z[k] = 0.02 + (pf.zones[k] || 0) / tot;
  const kt = Math.max(1, (pf.kinds.thrust || 0) + (pf.kinds.lunge || 0) + (pf.kinds.adv || 0));
  const rr = Math.max(1, (pf.def.P || 0) + (pf.def.R || 0) + (pf.def.C || 0));
  const af = clamp(pf.attacksPerMin / 12, 0.2, 2);
  return {
    name: 'Ghost',
    desc: 'Behavioural ghost',
    w: {
      ...W0,
      pressure: af,
      prepare: 0.6 + af * 0.4,
      defend: 1.2 - af * 0.3,
      distance: clamp(pf.avgDist / 2.2, 0.5, 1.6),
      bait: 0.6,
      counter: 0.5 + (pf.def.C || 0) / rr,
      protect: 1,
      force: 0.5,
      break: 0.4
    },
    zones: z,
    kinds: {
      thrust: (pf.kinds.thrust || 0) / kt + 0.05,
      lunge: (pf.kinds.lunge || 0) / kt + 0.05,
      adv: (pf.kinds.adv || 0) / kt + 0.02
    },
    feint: clamp(pf.feints / tot, 0, 0.9),
    beat: clamp(pf.beats / tot, 0, 0.6),
    disc: 0.5,
    parry: 0.2 + (pf.def.P || 0) / rr,
    retreat: 0.2 + (pf.def.R || 0) / rr,
    counter: 0.1 + (pf.def.C || 0) / rr,
    remise: clamp(pf.remises / tot, 0, 0.6),
    predict: 0.4,
    temp: 0.35,
    pressure: 'patient',
    delayVar: 0.05,
    keep: clamp(pf.avgDist - 2.2, -0.3, 0.4),
    line: 0.05,
    bonus: 0
  };
}
class BehaviorGhost extends AI {
  constructor(pf, lv) {
    super(lv, 'balanced', { pers: persFromProfile(pf) });
    this.kind = 'ghost';
    this.pf = pf;
    this.myTok = [];
  }
  decide(self, opp, S, dist, m, back) {
    // mimic the profiled player's own action sequences (their transition model), while still reacting via the AI reflex layer
    const tr = this.pf.trans || {};
    const k2 = this.myTok.slice(-2).join('') || '__';
    const row = tr[k2] || tr[this.myTok.slice(-1)[0]] || null;
    if (row && chance(0.6) && !self.attack && self.arm.type === 'guard' && self.legs.type !== 'lunge') {
      const tok = wpick(row);
      this.myTok.push(tok);
      if (this.myTok.length > 4) this.myTok.shift();
      const now = m.time;
      const thr = m.effReach(self, 'thrust', self.zone),
        lun = m.effReach(self, 'lunge', self.zone);
      if (tok === 'A') {
        this.buf.push({ a: 'adv', t: now });
        return;
      }
      if (tok === 'R' && back > 1) {
        this.buf.push({ a: 'ret', t: now });
        return;
      }
      if ((tok === 'T' || tok === 'L') && dist <= lun + 0.3) {
        this.strike(self, dist <= thr ? 'thrust' : 'lunge', m, S);
        return;
      }
      if (tok === 'F' && dist < lun + 0.4) {
        this.buf.push({ a: 'feint', t: now });
        return;
      }
      if (tok === 'B' && dist < 2.7) {
        this.buf.push({ a: 'beat', t: now });
        return;
      }
    }
    super.decide(self, opp, S, dist, m, back);
  }
}

/* ================= MATCH: simulation, physical blade collision, rules engines, records, replay buffer ================= */
const REPLAY_FRAMES = 300;
const JKEYS = [
  'hip',
  'sh',
  'head',
  'kF',
  'aF',
  'kR',
  'aR',
  'el',
  'hand',
  'guardC',
  'tip',
  'rs',
  're',
  'rh',
  'toeF',
  'toeR'
];
class Match {
  constructor(o) {
    this.o = o;
    this.weapon = o.weapon || 'epee';
    this.rules = RULES[this.weapon];
    this.sim = !!o.sim;
    this.bladeMul = o.bladeMul || 1;
    this.arena = o.arena || SETTINGS.arena;
    this.f = [new Fencer(0, this), new Fencer(1, this)];
    this.c = o.ctrls;
    for (let i = 0; i < 2; i++) {
      this.f[i].name = o.names[i];
      if (o.looks && o.looks[i]) this.f[i].setLook(o.looks[i]);
    }
    this.score = o.startScore ? o.startScore.slice() : [0, 0];
    this.period = 1;
    this.clock = o.startClock != null ? o.startClock : o.periodLen;
    this.overtime = false;
    this.priority = -1;
    this.state = o.intro ? 'intro' : 'countdown';
    this.st = 0;
    this.time = 0;
    this.ft = 0;
    this.pending = null;
    this.lights = [0, 0];
    this.white = [0, 0];
    this.pulse = [0, 0];
    this.msg = '';
    this.sub = '';
    this.ref = '';
    this.winner = -1;
    this.winBy = '';
    this.timeUp = false;
    this.done = false;
    this.hist = [[], []];
    this.pub = [[], []];
    this.texts = [];
    this.parts = [];
    this.glints = [];
    this.flash = null;
    this.camFlash = [];
    this.ccT = 0;
    this.allezT = 9;
    this.breakT = 0;
    this.drill = o.drill || 0;
    this.engT = 0;
    this.row = { holder: -1, kind: '', t: 0, ripFor: -1, ripUntil: 0 };
    this.log = [];
    this.marks = [];
    this.lastFoot = [
      { s: 0, t: -9 },
      { s: 0, t: -9 }
    ];
    this.rec = {
      attacks: [],
      parries: [],
      feints: [],
      touches: [],
      beats: [],
      rear: [0, 0],
      recov: [0, 0],
      ripWin: [0, 0],
      ripUsed: [0, 0],
      warn: [0, 0],
      warnIn: [false, false]
    };
    this.rbuf = [];
    this.replays = [];
    this.resp = [
      { P: 0, R: 0, C: 0 },
      { P: 0, R: 0, C: 0 }
    ];
    this.lastAtk = [
      { t: -9, id: -1, done: -1 },
      { t: -9, id: -1, done: -1 }
    ];
    this.post = null;
    this.puzzleRes = null;
    this.hb = 0;
    this.atmT = 0;
    this.applyStart();
    const sep = this.f[1].x - this.f[0].x;
    this.cam = {
      x: (this.f[0].x + this.f[1].x) / 2,
      z: clamp(W / (Math.max(7.4, sep + 4.4) * PPM), 1.05, 2.15)
    };
  }
  applyStart() {
    const o = this.o;
    if (o.pos) {
      for (let i = 0; i < 2; i++) {
        this.f[i].x = o.pos[i];
        this.f[i].prevX = o.pos[i];
        this.f[i].placeFeet();
      }
    } else if (o.startDist) {
      for (let i = 0; i < 2; i++) {
        this.f[i].x = (-this.f[i].d * o.startDist) / 2;
        this.f[i].prevX = this.f[i].x;
        this.f[i].placeFeet();
      }
    }
    for (const f of this.f) {
      f.computePose(this);
      f.prevTip = f.J.tip;
      f.prevBlade = f.J.blade.slice();
    }
  }
  other(f) {
    return this.f[1 - f.i];
  }
  dist() {
    return this.f[1].x - this.f[0].x;
  }
  float(f, s, col = '#fff', sz = 1) {
    if (this.o.demo) return;
    const h = f.J.head;
    this.texts.push({
      s,
      x: h.x,
      y: h.y - 0.32 - this.texts.filter(t => t.t < 0.4).length * 0.12,
      t: 0,
      col,
      sz
    });
  }
  event(who, txt, kind, extra) {
    if (this.o.demo) return;
    const e = Object.assign({ t: this.ft, who, txt, kind }, extra || {});
    this.log.push(e);
    if (this.log.length > 800) this.log.shift();
    return e;
  }
  mark(who, kind, txt) {
    this.marks.push({ t: this.time, who, kind, txt });
    if (this.marks.length > 200) this.marks.shift();
  }
  /* ---------- effective reach: weapon length, extension, target, posture, lunge capability, footwork, movement ---------- */
  effReach(f, kind, zone) {
    let r =
      { thrust: 1.7, counter: 1.58, cut: 1.68, remise: 1.7, lunge: 2.2, adv: 2.5, explosive: 2.72 }[kind] ||
      1.7;
    r += { head: 0.08, upper: 0.12, arm: 0.32, lower: 0.12, thigh: 0.2, foot: 0.16 }[zone || f.zone] || 0.12;
    if (kind === 'lunge' || kind === 'adv' || kind === 'explosive') r -= 0.6 * f.pen * 0.75;
    r += clamp(f.vx * f.d, -0.6, 1.2) * 0.12;
    r -= Math.max(0, f.lean - 0.05) * 0.2;
    return r;
  }
  effReachObs(S, kind) {
    let r = { thrust: 1.7, lunge: 2.2, adv: 2.5 }[kind] || 2.2;
    r += 0.22;
    r -= (S.pen || 0) * 0.45;
    r += clamp(S.vx * S.d, -0.6, 1.2) * 0.12;
    return r;
  }
  doubleValue(i) {
    if (this.weapon !== 'epee') return 0;
    const t = this.o.target,
      s = this.score,
      me = s[i],
      op = s[1 - i];
    if (!isFinite(t)) return 0;
    if (this.overtime) return -0.3;
    if (me === t - 1 && op === t - 1) return -0.2;
    if (me === t - 1) return 1;
    if (op === t - 1) return -1;
    return me > op ? 0.3 : me < op ? -0.4 : 0;
  }
  tieAtMatchPoint() {
    const t = this.o.target;
    return isFinite(t) && ((this.score[0] === t - 1 && this.score[1] === t - 1) || this.overtime);
  }
  /* ---------- perception: only observable state ---------- */
  snap(f) {
    const L = f.legs,
      A = f.arm;
    return {
      x: f.x,
      vx: f.vx,
      d: f.d,
      front: f.front,
      guard: f.guard,
      side: f.side,
      ext: f.extE,
      ep: f.extOn ? f.extEp : -1,
      epT: f.extOn ? this.time - f.extT0 : 0,
      aim: f.extE > 0.2 ? f.aimY : null,
      lunging: L.type === 'lunge' && L.t >= CFG.lunge.prep + CFG.lunge.ext * 0.5,
      step: L.type === 'step' ? L.sgn : 0,
      parrying: A.type === 'parry' && f.parryB > 0.5,
      disp: f.dispT > 0,
      line: f.lineEst >= 0,
      back: f.back(),
      pen: f.pen,
      vuln:
        (L.type === 'lunge' && (L.phase === 'hold' || L.phase === 'committed' || L.phase === 'recovery')) ||
        A.type === 'deflected' ||
        (A.type === 'parry' && !!A.ended) ||
        (A.type === 'beat' && A.phase === 'recover' && !A.contact) ||
        f.dispT > 0
    };
  }
  perceive(i, delay) {
    const h = this.hist[i];
    if (!h.length) return this.snap(this.f[i]);
    const k = Math.round(delay / DT);
    return h[Math.max(0, h.length - 1 - k)];
  }
  pushHist() {
    for (let i = 0; i < 2; i++) {
      const h = this.hist[i];
      h.push(this.snap(this.f[i]));
      if (h.length > 100) h.shift();
    }
  }
  /* ---------- main step ---------- */
  step(dt) {
    this.time += dt;
    this.st += dt;
    this.allezT += dt;
    for (let i = 0; i < 2; i++) this.pulse[i] = Math.max(0, this.pulse[i] - dt * 1.4);
    const f = this.f,
      o = this.o;
    switch (this.state) {
      case 'intro':
        this.settle(dt);
        if (this.st >= 4) {
          this.state = 'countdown';
          this.st = 0;
        }
        break;
      case 'countdown': {
        const EG = o.training || o.sandbox ? 0.3 : 0.75,
          PR = o.training || o.sandbox ? 0.55 : 1.35;
        if (this.st - dt <= 0 && !o.demo) Snd.say('En garde');
        if (this.st - dt < EG && this.st >= EG) {
          Snd.beep(660, 0.1, 0.06);
          if (!o.demo) Snd.say('Prêts ?');
        }
        for (let i = 0; i < 2; i++) {
          if (this.c[i].kind === 'human') this.c[i].update(f[i], f[1 - i], this);
          f[i].update(dt, this.c[i].kind === 'human' ? this.c[i].it : null, this, false, this.c[i]);
          f[i].computePose(this);
        }
        this.pushHist();
        if (this.st >= PR) {
          this.state = 'fencing';
          this.st = 0;
          this.allezT = 0;
          this.lights = [0, 0];
          this.white = [0, 0];
          this.ref = '';
          Snd.beep(1320, 0.18, 0.08);
          if (!o.demo) Snd.say('Allez !');
        }
        break;
      }
      case 'fencing':
        this.fence(dt);
        break;
      case 'touch':
        this.recordFrame();
        if (this.st >= 0.6) {
          this.state = 'result';
          this.st = 0;
          for (const x of f) if (x.attack && x.attack.hit) x.attack = null;
          this.finishPost();
          if (SETTINGS.autoReplay && !o.demo && !o.training && this.replays.length && G.openReplay)
            G.openReplay(this, this.replays.length - 1, true);
        }
        break;
      case 'result':
      case 'halt':
        this.settle(dt);
        if (this.st >= (o.training || o.demo || o.sandbox ? 0.8 : 1.6)) this.proceed();
        break;
      case 'priority':
        this.settle(dt);
        if (this.st >= 2.8) this.newBout();
        break;
      case 'break':
        this.settle(dt);
        this.breakT -= dt;
        if (this.breakT <= 0) {
          this.period++;
          this.clock = o.periodLen;
          this.newBout();
        }
        break;
      case 'puzzleEnd':
        this.settle(dt);
        break;
      case 'victory':
        for (const x of f) {
          x.poseK = Math.min(1, x.poseK + dt * 2.5);
          x.update(dt, null, this, false, null);
          x.computePose(this);
        }
        if (this.st >= 3.4 && !this.done) {
          this.done = true;
          G.onMatchEnd(this);
        }
        break;
    }
    for (const p of this.parts) {
      p.t += dt;
      p.vy += 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.parts = this.parts.filter(p => p.t < p.l);
    for (const g of this.glints) g.t += dt;
    this.glints = this.glints.filter(g => g.t < 0.16);
    for (const t of this.texts) {
      t.t += dt;
      t.y -= dt * 0.25;
    }
    this.texts = this.texts.filter(t => t.t < 1.3);
    for (const c of this.camFlash) c.t += dt;
    this.camFlash = this.camFlash.filter(c => c.t < 0.25);
    if (this.flash) {
      this.flash.t += dt;
      if (this.flash.t > 0.8) this.flash = null;
    }
    this.camUpd(dt);
    this.atmos(dt);
  }
  atmos(dt) {
    if (this.o.demo || this.o.training) return;
    this.atmT -= dt;
    const tense = this.tieAtMatchPoint() && this.state === 'fencing';
    if (this.atmT <= 0) {
      this.atmT = 0.5;
      const t = this.o.target,
        imp = isFinite(t) ? (Math.max(...this.score) / t) * (this.o.final ? 1.4 : 1) : 0.3;
      Snd.atmosphere(clamp(imp, 0, 1.4), tense);
    }
    if (tense) {
      this.hb -= dt;
      if (this.hb <= 0) {
        this.hb = 0.95;
        Snd.heartbeat();
      }
    }
    const pl = this.f[0];
    if (pl.pen > 0.06 && this.state === 'fencing') {
      this.brT = (this.brT || 0) - dt;
      if (this.brT <= 0) {
        this.brT = 1.6 - pl.pen * 4;
        Snd.breath(pl.pen * 5);
      }
    }
  }
  settle(dt) {
    for (const x of this.f) {
      x.update(dt, null, this, false, null);
      x.computePose(this);
      x.trailUpd();
    }
  }
  fence(dt) {
    const f = this.f,
      c = this.c,
      o = this.o;
    this.ft += dt;
    for (let i = 0; i < 2; i++) c[i].update(f[i], f[1 - i], this);
    for (let i = 0; i < 2; i++) f[i].update(dt, c[i].it, this, true, c[i]);
    this.constrain(dt);
    for (const x of f) {
      x.prevTip = x.J.tip;
      x.prevBlade = x.J.blade.slice();
      x.computePose(this);
      x.trailUpd();
    }
    this.collide(dt);
    this.pushHist();
    this.recordFrame();
    const R = this.row;
    if (R.kind === 'line' && R.holder >= 0 && f[R.holder].lineEst < 0) {
      R.holder = -1;
      R.kind = '';
    }
    for (let i = 0; i < 2; i++) {
      const inW = f[i].back() < 1.0;
      if (inW && !this.rec.warnIn[i]) this.rec.warn[i]++;
      this.rec.warnIn[i] = inW;
    }
    if (this.state !== 'fencing') return;
    if (this.pending) {
      if (this.time - this.pending.t >= this.rules.lock - 1e-6) this.resolveTouch();
      return;
    }
    if (f[0].front < -CFG.half) {
      this.rec.rear[0]++;
      this.award([1], 'rear');
      return;
    }
    if (f[1].front > CFG.half) {
      this.rec.rear[1]++;
      this.award([0], 'rear');
      return;
    }
    if (this.ccT > 0.35) {
      this.halt('HALT', 'Corps-à-corps — no touch');
      return;
    }
    if (o.periodLen > 0) {
      this.clock -= dt;
      if (this.clock <= 0) {
        this.clock = 0;
        this.timeUp = true;
        this.halt(
          'TIME',
          this.overtime
            ? 'End of the priority minute'
            : o.periods > 1 && this.period < o.periods
              ? 'End of period ' + this.period
              : 'Time has expired'
        );
      }
    }
  }
  constrain(dt) {
    const a = this.f[0],
      b = this.f[1],
      gap = b.x - a.x;
    if (gap < CFG.minSep) {
      const o = CFG.minSep - gap,
        ma = Math.abs(a.vx),
        mb = Math.abs(b.vx),
        wa = (ma + 0.01) / (ma + mb + 0.02);
      a.shift(-o * wa);
      b.shift(o * (1 - wa));
      this.ccT += dt;
    } else this.ccT = Math.max(0, this.ccT - dt);
    for (const x of this.f) {
      const lim = CFG.half + CFG.runoff - 0.3,
        bk = -x.d * x.x;
      if (bk > lim) x.shift(x.d * (bk - lim));
    }
  }
  /* ---------- physical blade contact: 3-segment polylines, swept over the frame ---------- */
  bladeContact(D, A, useGuard) {
    let best = null;
    const n = 4;
    for (let s = 1; s <= n; s++) {
      const k = s / n;
      const bD = D.prevBlade.map((p, i) => lerpP(p, D.J.blade[i], k)),
        bA = A.prevBlade.map((p, i) => lerpP(p, A.J.blade[i], k));
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) {
          const r = segSeg(bD[i], bD[i + 1], bA[j], bA[j + 1]);
          if (!best || r.d < best.d)
            best = {
              d: r.d,
              uD: (i + r.s) / 3,
              uA: (j + r.t) / 3,
              pt: lerpP(r.c1, r.c2, 0.5),
              k,
              iD: i,
              sD: r.s
            };
        }
      if (useGuard) {
        const g = lerpP(D.prevBlade[0], D.J.blade[0], k);
        for (let j = 0; j < 3; j++) {
          const dd = ptSegDist(g, bA[j], bA[j + 1]) - CFG.bell;
          if (dd < best.d) best = { d: Math.max(0, dd), uD: 0, uA: (j + 0.5) / 3, pt: g, k, iD: 0, sD: 0 };
        }
      }
      if (best.d < CFG.contact) break;
    }
    if (!best || best.d >= CFG.contact) return null;
    const i = best.iD,
      cur = lerpP(D.J.blade[i], D.J.blade[i + 1], best.sD),
      prv = lerpP(D.prevBlade[i], D.prevBlade[i + 1], best.sD);
    best.vrel = len(sub(cur, prv)) / DT;
    return best;
  }
  collide(dt) {
    const f = this.f,
      c = CFG;
    for (let k = 0; k < 2; k++) {
      const D = f[k],
        A = f[1 - k];
      if (D.arm.type === 'parry' && D.arm.active && !D.arm.contacted && A.attack && A.attack.active) {
        const r = this.bladeContact(D, A, true);
        if (r) this.resolveParry(D, A, r);
      }
    }
    for (let k = 0; k < 2; k++) {
      const B = f[k],
        O = f[1 - k];
      if (B.arm.type === 'beat' && B.arm.phase === 'strike' && !B.arm.contact) {
        const r = this.bladeContact(B, O, false);
        if (r) this.resolveBeat(B, O, r);
      }
    }
    const ga = x => x.arm.type === 'guard' || x.arm.type === 'disengage';
    if (ga(f[0]) && ga(f[1])) {
      let md = 9;
      const a = f[0].J.blade,
        b = f[1].J.blade;
      for (let i = 0; i < 3; i++)
        for (let j = 0; j < 3; j++) md = Math.min(md, segSeg(a[i], a[i + 1], b[j], b[j + 1]).d);
      if (md < c.engageDist && f[0].side === f[1].side) this.engT += dt;
      else this.engT = 0;
    } else this.engT = 0;
    const eng = this.engT > c.engageTime;
    if (eng && !f[0].engaged) {
      Snd.scrape();
      this.mark(-1, 'engage', 'Blades engaged');
    }
    f[0].engaged = f[1].engaged = eng;
    for (let k = 0; k < 2; k++) {
      const A = f[k],
        B = f[1 - k],
        at = A.attack;
      if (!at || !at.active) continue;
      const pts = [];
      if (this.rules.cuts && (A.arm.type === 'cut' || A.legs.type === 'lunge')) {
        for (const u of [0.45, 0.63, 0.81, 1])
          pts.push([this.bladeAt(A.prevBlade, u), this.bladeAt(A.J.blade, u)]);
      } else pts.push([A.prevTip || A.J.tip, A.J.tip]);
      let done = false;
      for (const [p0, p1] of pts) {
        if (done) break;
        const n = Math.max(1, Math.ceil(len(sub(p1, p0)) / 0.015));
        for (let i = 1; i <= n; i++) {
          const p = lerpP(p0, p1, i / n);
          if (len(sub(p, B.J.guardC)) < c.bell) {
            at.blocked = true;
            at.active = false;
            this.spark(p, 0.4);
            Snd.tick();
            this.float(A, 'Off the guard', '#c8d2e0', 0.8);
            done = true;
            break;
          }
          const h = B.targetHit(p);
          if (h.gap < at.minGap) at.minGap = h.gap;
          if (h.gap <= 0) {
            const valid = this.rules.valid(h.zone);
            if (!valid && !this.rules.offTarget) {
              continue;
            }
            at.hit = true;
            at.active = false;
            A.bend = this.rules.cuts ? 0.3 : 1;
            B.flinch = 1;
            this.registerHit(A, B, p, h.zone, valid);
            done = true;
            break;
          }
        }
      }
    }
  }
  bladeAt(b, u) {
    const s = u * 3,
      i = Math.min(2, Math.floor(s));
    return lerpP(b[i], b[i + 1], s - i);
  }
  resolveParry(D, A, r) {
    D.arm.contacted = true;
    const at = A.attack,
      h = D.arm.height,
      side = D.arm.side,
      num = parryNum(h, side);
    const rec = { who: D.i, t: this.ft, num, success: false, reason: '' };
    this.rec.parries.push(rec);
    if (side !== A.side) {
      rec.reason = at.disengaged ? 'deceived' : 'side';
      this.float(D, at.disengaged ? 'Deceived!' : 'Wrong side', '#ff9a7a');
      this.event(D.i, `${D.color} parries ${num} — blades on opposite sides`, 'parryfail');
      return;
    }
    const lever = clamp(0.55 + 0.6 * (r.uA - r.uD), 0.1, 1),
      speed = clamp(r.vrel / 3, 0, 1),
      str = lever * (0.6 + 0.4 * speed);
    if (str < 0.3) {
      rec.reason = 'leverage';
      A.deflA += h === 'low' ? -0.12 : 0.12;
      this.spark(r.pt, 0.3);
      Snd.clash(0.35);
      this.float(D, 'Weak parry — forced through', '#ff9a7a');
      this.event(D.i, `${D.color}'s parry is forced through (weak leverage)`, 'parryfail');
      return;
    }
    rec.success = true;
    at.parried = true;
    at.active = false;
    A.deflA = (h === 'low' ? -1 : 1) * (0.45 + 0.6 * str);
    if (A.arm.type === 'thrust' || A.arm.type === 'cut') {
      A.arm = { type: 'deflected', t: 0, e0: A.extE };
      A.finishAttack(this);
    }
    D.arm = { type: 'guard', t: 0 };
    D.parryB = 1;
    D.parryH = h;
    D.riposteT = CFG.riposte;
    D.parryT = this.time;
    D.stats.parries++;
    this.rec.ripWin[D.i]++;
    this.spark(r.pt, 0.6 + str * 0.6);
    Snd.clash(0.5 + str * 0.6);
    Snd.ooh();
    this.float(D, 'PARRY ' + num, '#ffe08a', 1.1);
    this.mark(D.i, 'parry', 'Parry ' + num);
    this.event(D.i, `${D.color} parries ${num} (${PARRY_NAME[num]})`, 'parry');
    const R = this.row;
    R.holder = -1;
    R.kind = '';
    R.ripFor = D.i;
    R.ripUntil = this.time + CFG.riposte + 0.05;
  }
  resolveBeat(B, O, r) {
    B.arm.contact = true;
    const lever = clamp(0.55 + 0.6 * (r.uA - r.uD) + (B.arm.press ? 0.2 : 0), 0.15, 1);
    const disp = 0.12 + 0.1 * lever;
    O.dispT = Math.max(O.dispT, disp);
    O.deflA += (B.arm.sgn || 1) * (0.3 + 0.4 * lever);
    if (O.arm.type === 'parry') O.arm = { type: 'guard', t: 0 };
    if (O.arm.type === 'thrust' && O.lineEst >= 0) {
      O.arm.noHold = true;
      O.lineEst = -1;
    }
    let beatParry = false;
    if (O.attack && O.attack.active) {
      O.attack.parried = true;
      O.attack.active = false;
      beatParry = true;
      if (O.arm.type === 'thrust' || O.arm.type === 'cut') {
        O.arm = { type: 'deflected', t: 0, e0: O.extE };
        O.finishAttack(this);
      }
      B.riposteT = CFG.riposte;
      B.parryT = this.time;
      this.rec.ripWin[B.i]++;
      const R = this.row;
      R.holder = -1;
      R.kind = '';
      R.ripFor = B.i;
      R.ripUntil = this.time + CFG.riposte + 0.05;
    }
    B.beatPrio = this.time;
    if (this.row.holder === O.i && this.row.kind === 'line') {
      this.row.holder = -1;
      this.row.kind = '';
    }
    this.rec.beats.push({ who: B.i, t: this.ft, success: true, press: !!B.arm.press });
    this.spark(r.pt, 0.3 + lever * 0.4);
    Snd.clash(0.3 + lever * 0.4);
    this.float(B, beatParry ? 'BEAT PARRY' : B.arm.press ? 'PRESSURE' : 'BEAT!', '#bfe3ff', 0.9);
    this.mark(B.i, 'beat', 'Beat');
    this.event(
      B.i,
      `${B.color} ${B.arm.press ? 'presses' : 'beats'} the blade (${Math.round(disp * 1000)} ms displacement)`,
      'beat'
    );
  }
  spark(p, s) {
    for (let i = 0, n = 8 + s * 14; i < n; i++) {
      const a = Math.random() * TAU,
        v = (1 + Math.random() * 3.5) * (0.5 + s * 0.5);
      this.parts.push({
        x: p.x,
        y: p.y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 1.2,
        l: 0.15 + Math.random() * 0.3,
        t: 0
      });
    }
    this.glints.push({ x: p.x, y: p.y, t: 0, s });
  }
  /* ---------- action hooks: public observation log, match events, statistics ---------- */
  pubPush(f, tok, extra) {
    if (this.o.demo && false) return;
    this.pub[f.i].push(Object.assign({ t: this.time, tok }, extra || {}));
    if (this.pub[f.i].length > 400) this.pub[f.i].splice(0, 100);
  }
  onStep(f, sgn) {
    this.pubPush(f, sgn > 0 ? 'A' : 'R');
    if (sgn < 0) this.respond(f, 'R');
    const lf = this.lastFoot[f.i];
    if (lf.s !== sgn || this.ft - lf.t > 1.2)
      this.event(f.i, `${f.color} ${sgn > 0 ? 'advances' : 'retreats'}`, 'foot');
    lf.s = sgn;
    lf.t = this.ft;
    const o = this.other(f);
    if (sgn < 0 && o.arm.type === 'feint' && o.arm.rec) o.arm.rec.provoked = true;
  }
  onParryStart(D) {
    this.pubPush(D, 'P', { low: D.arm.height === 'low' });
    this.respond(D, 'P');
    this.mark(D.i, 'parrystart', 'Parry begins');
    const o = this.other(D);
    if (o.arm.type === 'feint' && o.arm.rec) o.arm.rec.provoked = true;
  }
  onBeatStart(B) {
    this.pubPush(B, 'B');
  }
  onBeatMiss(B) {
    this.rec.beats.push({ who: B.i, t: this.ft, success: false });
    this.float(B, 'Beat missed', 'rgba(200,210,230,.8)', 0.8);
    this.event(B.i, `${B.color}'s beat finds no blade`, 'beat');
  }
  onDisengage(f, inAtk) {
    this.pubPush(f, 'D');
    this.float(f, inAtk ? 'Disengage!' : 'Disengage', '#bfe3ff', 0.75);
  }
  onFeintStart(f) {
    const r = { who: f.i, t: this.ft, provoked: false, converted: false };
    this.rec.feints.push(r);
    f.arm.rec = r;
    this.event(f.i, `${f.color} feints`, 'feint');
    this.mark(f.i, 'feint', 'Feint');
  }
  onFeintEnd(f, A, conv) {
    if (A.rec) A.rec.converted = conv;
    if (A.rec && A.rec.provoked && !A.rec.noted) {
      A.rec.noted = true;
      this.float(f, 'Feint drew a reaction', '#bfe3ff', 0.7);
    }
  }
  onExtEnd(f) {
    const tok = f.extLunge ? 'L' : f.extMax >= 0.6 ? 'T' : 'F';
    this.pubPush(f, tok, { low: f.extAim > -1.12, dist: this.dist() });
  }
  respond(f, k) {
    const la = this.lastAtk[1 - f.i];
    if (this.time - la.t < 0.6 && la.done !== la.id) {
      la.done = la.id;
      this.resp[f.i][k]++;
    }
  }
  onAttackStart(A) {
    const at = A.attack,
      o = this.other(A);
    if (at.counter) this.respond(A, 'C');
    const la = this.lastAtk[A.i];
    la.t = this.time;
    la.id = at.id;
    const kind = at.remise
      ? 'remise'
      : at.riposte
        ? 'riposte'
        : at.adv
          ? at.explosive
            ? 'patinando'
            : 'advance-lunge'
          : at.kind;
    const reactT =
      at.riposte && A.parryT ? this.time - A.parryT : at.counter && o.attack ? this.time - o.attack.t0 : null;
    at.recIdx = this.rec.attacks.length;
    this.rec.attacks.push({
      who: A.i,
      kind,
      base: at.kind,
      zone: at.zone,
      dist: at.dist,
      reach: at.reach,
      t: this.ft,
      result: 'pending',
      riposte: at.riposte,
      counter: at.counter,
      compound: at.compound,
      reactT,
      line: zoneGuard(at.zone) === 'low' ? 'low' : 'high'
    });
    if (at.riposte) this.rec.ripUsed[A.i]++;
    this.event(
      A.i,
      `${A.color} ${at.riposte ? 'ripostes' : at.counter ? 'counterattacks' : 'attempts ' + kind}${at.compound ? ' (' + at.compound + ')' : ''} → ${ZONE_NAME[at.zone].toLowerCase()}, ${at.dist.toFixed(2)} m`,
      'attack'
    );
    this.mark(A.i, 'attack', kind[0].toUpperCase() + kind.slice(1));
    if (at.riposte) this.float(A, 'RIPOSTE', '#ffd76a', 1);
    if (this.rules.row) {
      const R = this.row,
        t = this.time;
      if (at.riposte && R.ripFor === A.i && t < R.ripUntil) {
        R.holder = A.i;
        R.kind = 'riposte';
      } else if (t - A.beatPrio < 0.35) {
        R.holder = A.i;
        R.kind = 'beat';
      } else if (o.lineEst >= 0 && o.lineEst < t - 0.05) {
        R.holder = o.i;
        R.kind = 'line';
      } else if (o.attack && t - o.attack.t0 < 0.06 && R.holder === o.i && !o.attack.riposte) {
        R.holder = -1;
        R.kind = 'simultaneous';
      } else if (R.holder === o.i && o.attack && !o.attack.parried && !o.attack.blocked) {
        at.counter = true;
      } else {
        R.holder = A.i;
        R.kind = at.remise ? 'remise' : 'attack';
      }
      R.t = t;
    }
  }
  onAttackMiss(A, at) {
    const r = this.rec.attacks[at.recIdx];
    const res = at.parried ? 'parried' : at.blocked ? 'blocked' : at.minGap < 0.15 ? 'missed' : 'short';
    if (r) {
      r.result = res;
      r.minGap = at.minGap;
    }
    if (!at.parried && !at.blocked) {
      const g = at.minGap;
      if (this.o.training && A.i === 0)
        this.float(A, g < 1.2 && g > 0.02 ? `Short by ${Math.round(g * 100)} cm` : 'Missed', '#9fc4ff');
      else this.float(A, res === 'short' ? 'Short' : 'Missed', 'rgba(200,210,230,.8)', 0.8);
      this.event(A.i, `${A.color}'s attack ${res === 'short' ? 'falls short' : 'misses'}`, 'miss');
    }
    if (this.rules.row && this.row.holder === A.i && this.row.kind !== 'line') {
      this.row.holder = -1;
      this.row.kind = '';
    }
  }
  onParryWhiff(D) {
    const A = this.other(D);
    this.rec.parries.push({ who: D.i, t: this.ft, success: false, reason: A.attack ? 'timing' : 'nothing' });
    if (A.attack && !A.attack.parried) this.float(D, 'Too early', '#ff9a7a');
  }
  registerHit(A, B, p, zone, valid) {
    if (this.state !== 'fencing') return;
    this.spark(p, 0.25);
    const at = A.attack;
    const h = {
      i: A.i,
      valid,
      zone,
      pt: p,
      t: this.time,
      rip: !!(at && at.riposte),
      kind: at ? at.kind : '',
      recIdx: at ? at.recIdx : -1,
      rel: P((p.x - B.J.hip.x) * B.d, p.y),
      recov: B.balance === 'Recovering' || B.balance === 'Overextended'
    };
    if (!this.pending) this.pending = { t: this.time, hits: [h] };
    else if (!this.pending.hits.some(x => x.i === A.i)) this.pending.hits.push(h);
    this.mark(A.i, 'hit', valid ? 'Touch' : 'Off target');
  }
  resolveTouch() {
    const p = this.pending;
    this.pending = null;
    if (this.rules.row) this.decideROW(p.hits);
    else
      this.award(
        p.hits.map(h => h.i),
        'touch',
        p.hits
      );
  }
  startPost(hits, txt, double) {
    this.post = {
      frames: this.rbuf.slice(),
      hits: hits.map(h => ({ i: h.i, pt: h.pt, t: h.t, valid: h.valid })),
      marks: this.marks.filter(m => m.t >= this.time - REPLAY_FRAMES * DT),
      label: txt,
      delta: double ? Math.abs(hits[1].t - hits[0].t) : null,
      weapon: this.weapon,
      n: 0,
      looks: this.f.map(x => x.cos)
    };
  }
  recordFrame() {
    const fr = {
      t: this.time,
      f: this.f.map(x => {
        const J = x.J,
          a = [];
        for (const k of JKEYS) {
          a.push(J[k].x, J[k].y);
        }
        a.push(J.blade[1].x, J.blade[1].y, J.blade[2].x, J.blade[2].y);
        return {
          J: a,
          d: x.d,
          side: x.side,
          bend: x.bend,
          flex: x.flex,
          glintT: x.glintT,
          label: x.actionLabel(),
          parry: x.arm.type === 'parry' && !!x.arm.active,
          atk: !!(x.attack && x.attack.active),
          bal: x.balance
        };
      }),
      gl: this.glints.map(g => ({ x: g.x, y: g.y, t: g.t, s: g.s })),
      lights: this.lights.slice()
    };
    this.rbuf.push(fr);
    if (this.rbuf.length > REPLAY_FRAMES) this.rbuf.shift();
    if (this.post) {
      this.post.frames.push(fr);
      this.post.n++;
    }
  }
  finishPost() {
    if (!this.post) return;
    const p = this.post;
    this.post = null;
    p.end = p.frames.length;
    this.replays.push(p);
    const idx = this.replays.length - 1;
    for (let i = this.log.length - 1; i >= 0; i--) {
      if (this.log[i].kind === 'touch') {
        this.log[i].rep = idx;
        break;
      }
    }
    const tr = this.rec.touches;
    for (let i = tr.length - 1; i >= 0 && tr[i].rep == null; i--) tr[i].rep = idx;
    if (this.replays.length > 40) this.replays.shift();
  }
  /* ---------- épée scoring ---------- */
  award(hitsIdx, reason, hits) {
    const s = this.score,
      o = this.o,
      tgt = o.target,
      f = this.f;
    this.state = 'touch';
    this.st = 0;
    this.lights = [hitsIdx.includes(0) ? 1 : 0, hitsIdx.includes(1) ? 1 : 0];
    const imp = isFinite(tgt) ? Math.max(...s) / tgt : 0.3;
    Snd.buzzer();
    Snd.cheer((hitsIdx.length === 2 ? 0.7 : 1) * (0.7 + imp * 0.6) * (o.final ? 1.3 : 1));
    if (!o.demo) Snd.say('Halte !');
    this.flash = { t: 0, cols: hitsIdx.map(i => f[i].light) };
    for (let i = 0; i < 10 + imp * 20; i++)
      this.camFlash.push({ x: Math.random() * W, y: 120 + Math.random() * 330, t: -Math.random() * 0.15 });
    let aw = [];
    const hs = hits || [];
    if (hitsIdx.length === 2) {
      this.msg = 'DOUBLE TOUCH';
      if (this.overtime) this.sub = 'Annulled during the priority minute';
      else if (isFinite(tgt) && s[0] === tgt - 1 && s[1] === tgt - 1)
        this.sub = `Annulled at ${s[0]}–${s[1]}`;
      else {
        aw = [0, 1];
        this.sub = `One point to each fencer · ${Math.round(Math.abs(hs[1].t - hs[0].t) * 1000)} ms apart`;
        f[0].stats.doubles++;
        f[1].stats.doubles++;
      }
    } else {
      const h = hitsIdx[0];
      aw = [h];
      this.msg = 'TOUCHÉ';
      const hh = hs[0];
      this.sub =
        reason === 'rear'
          ? `${f[1 - h].color} crossed the rear limit — point to ${f[h].color}`
          : `Point to ${f[h].color}` +
            (hh && hh.rip ? ' — riposte' : '') +
            (hh ? ' · ' + ZONE_NAME[CAP2ZONE[hh.zone]].toLowerCase() : '');
      if (hh && hh.rip) f[h].stats.ripostes++;
    }
    this.ref = reason === 'rear' ? 'Halte! Rear limit.' : 'Halte!';
    this.commitTouch(hs, aw, reason, hitsIdx.length === 2);
  }
  commitTouch(hs, aw, reason, dbl) {
    const s = this.score,
      o = this.o,
      tgt = o.target,
      f = this.f;
    for (const i of aw) {
      s[i]++;
      this.pulse[i] = 1;
      f[i].stats.touches++;
    }
    for (const h of hs) {
      const r = this.rec.attacks[h.recIdx];
      if (r) r.result = dbl ? 'double' : aw.includes(h.i) ? 'hit' : 'nopoint';
      this.rec.touches.push({
        who: h.i,
        victim: 1 - h.i,
        zone: CAP2ZONE[h.zone],
        cap: h.zone,
        rel: h.rel,
        valid: h.valid,
        scored: aw.includes(h.i),
        double: dbl,
        recov: h.recov,
        t: this.ft,
        rep: null
      });
      if (aw.includes(h.i) && h.recov) this.rec.recov[1 - h.i]++;
    }
    const label = aw.length === 2 ? 'Double touch' : aw.length === 1 ? `${f[aw[0]].color} scores` : this.msg;
    this.event(aw.length === 1 ? aw[0] : -1, label + (this.sub ? ' — ' + this.sub : ''), 'touch');
    if (hs.length) this.startPost(hs, label, dbl);
    if (o.demo && (s[0] >= 15 || s[1] >= 15)) {
      s[0] = 0;
      s[1] = 0;
    }
    if (o.puzzle) {
      const r = o.puzzle.check(this, { type: 'touch', aw, dbl, hits: hs, reason });
      if (r) {
        this.puzzleRes = r;
      }
    }
    if (!o.training && !o.demo && !o.puzzle) {
      if (this.overtime && aw.length === 1) {
        this.winner = aw[0];
        this.winBy = 'Touch in the priority minute';
      } else if (s[0] >= tgt || s[1] >= tgt) {
        this.winner = s[0] > s[1] ? 0 : 1;
        this.winBy = 'First to ' + tgt;
      }
    }
  }
  /* ---------- foil / sabre: right-of-way referee ---------- */
  decideROW(hits) {
    const f = this.f,
      R = this.row,
      o = this.o;
    this.state = 'touch';
    this.st = 0;
    this.lights = [0, 0];
    this.white = [0, 0];
    for (const h of hits) {
      if (h.valid) this.lights[h.i] = 1;
      else this.white[h.i] = 1;
    }
    Snd.buzzer();
    if (!o.demo) Snd.say('Halte !');
    this.flash = { t: 0, cols: hits.filter(h => h.valid).map(h => f[h.i].light) };
    let scorer = -1,
      msg,
      sub,
      ref;
    const KT = {
      attack: 'Attack',
      riposte: 'Parry-riposte',
      line: 'Point in line',
      beat: 'Attack with a beat',
      remise: 'Remise'
    };
    if (hits.length === 1) {
      const h = hits[0];
      if (h.valid) {
        scorer = h.i;
        msg = 'TOUCHÉ';
        ref = `Single light — ${f[h.i].color}`;
        sub = `Single light — point to ${f[h.i].color}`;
      } else {
        msg = 'OFF TARGET';
        ref = `Off target — ${f[h.i].color}`;
        sub = `${f[h.i].color} landed off-target — no touch, fencing stops`;
      }
    } else {
      if (R.holder < 0) {
        msg = 'NO TOUCH';
        ref = 'Simultaneous actions';
        sub =
          R.kind === 'simultaneous'
            ? 'Both attacks began together — neither has priority'
            : 'Neither fencer had established priority';
      } else {
        const h = hits.find(x => x.i === R.holder),
          oo = hits.find(x => x.i !== R.holder);
        const kt = KT[R.kind] || 'Attack';
        if (!h.valid) {
          msg = 'NO TOUCH';
          ref = `${kt} — ${f[R.holder].color}, off target`;
          sub = `${f[R.holder].color} had priority but landed off-target, so ${f[oo.i].color}'s touch is not counted`;
        } else {
          scorer = R.holder;
          msg = 'TOUCHÉ';
          ref = `${kt} — ${f[R.holder].color}`;
          sub = `${kt} from ${f[R.holder].color} has priority; ${f[oo.i].color}'s ${R.kind === 'riposte' ? 'remise' : R.kind === 'line' ? 'attack into the line' : 'counterattack'} does not score`;
        }
      }
    }
    this.msg = msg;
    this.sub = sub;
    this.ref = 'Referee: ' + ref;
    if (scorer >= 0) {
      Snd.cheer(1);
      const hh = hits.find(x => x.i === scorer);
      if (hh.rip) f[scorer].stats.ripostes++;
    }
    this.commitTouch(hits, scorer >= 0 ? [scorer] : [], 'touch', false);
  }
  halt(msg, sub) {
    this.state = 'halt';
    this.st = 0;
    this.msg = msg;
    this.sub = sub;
    this.ref = 'Halte!';
    Snd.beep(520, 0.35, 0.07);
    if (!this.o.demo) Snd.say('Halte !');
    this.event(-1, msg + ' — ' + sub, 'halt');
    if (this.o.puzzle) {
      const r = this.o.puzzle.check(this, { type: msg === 'TIME' ? 'time' : 'halt' });
      if (r) this.puzzleRes = r;
    }
  }
  proceed() {
    if (this.puzzleRes) {
      this.state = 'puzzleEnd';
      this.st = 0;
      G.onPuzzleEnd && G.onPuzzleEnd(this);
      return;
    }
    if (this.winner >= 0) {
      this.toVictory();
      return;
    }
    if (this.timeUp) {
      this.timeUp = false;
      this.handleTime();
      return;
    }
    this.newBout();
  }
  handleTime() {
    const s = this.score,
      o = this.o;
    if (o.periodLen <= 0) {
      this.newBout();
      return;
    }
    if (this.overtime) {
      this.winner = this.priority;
      this.winBy = 'Victory on priority';
      this.toVictory();
      return;
    }
    if (o.periods > 1 && this.period < o.periods) {
      this.state = 'break';
      this.st = 0;
      this.breakT = 60;
      return;
    }
    if (o.sandbox || o.training) {
      this.clock = o.periodLen;
      this.newBout();
      return;
    }
    if (s[0] !== s[1]) {
      this.winner = s[0] > s[1] ? 0 : 1;
      this.winBy = 'Higher score at time';
      this.toVictory();
      return;
    }
    this.state = 'priority';
    this.st = 0;
    this.priority = RNG() < 0.5 ? 0 : 1;
    this.overtime = true;
    this.clock = 60;
    Snd.beep(990, 0.2, 0.07);
    this.event(-1, 'Priority minute — priority to ' + this.f[this.priority].color, 'halt');
  }
  newBout() {
    const keep = this.o.respawn === 'continue' && this.o.sandbox;
    for (const x of this.f) {
      if (keep) {
        x.legs = { type: 'idle', t: 0 };
        x.arm = { type: 'guard', t: 0 };
        x.attack = null;
        x.extE = 0;
        x.lungeE = 0;
        x.drop = 0;
        x.lean = 0;
        x.riposteT = 0;
        x.bend = 0;
        x.computePose(this);
      } else x.reset();
    }
    if (!keep) this.applyStart();
    this.hist = [[], []];
    this.lights = [0, 0];
    this.white = [0, 0];
    this.pending = null;
    this.row = { holder: -1, kind: '', t: 0, ripFor: -1, ripUntil: 0 };
    for (const c of this.c) c.reset();
    this.state = 'countdown';
    this.st = 0;
    this.ccT = 0;
    this.parts.length = 0;
    this.rec.warnIn = [false, false];
  }
  toVictory() {
    this.state = 'victory';
    this.st = 0;
    const w = this.winner;
    for (const x of this.f) {
      x.legs = { type: 'idle', t: 0 };
      x.arm = { type: 'guard', t: 0 };
      x.attack = null;
      x.extE = 0;
      x.lean = 0;
      x.drop = 0;
    }
    this.f[w].pose = 'victory';
    this.f[1 - w].pose = 'defeat';
    Snd.cheer(1.6);
    Snd.hush();
    this.event(w, `${this.f[w].color} wins ${this.score[0]}–${this.score[1]} (${this.winBy})`, 'end');
  }
  setDrill(n) {
    this.drill = n;
    this.c[1] = DRILLS[n].make();
    this.f[1].name =
      n === DRILLS.length - 1 ? 'RED · AI ' + LV[SETTINGS.diff].name.toUpperCase() : 'RED · DUMMY';
    this.score = [0, 0];
    this.newBout();
  }
  camUpd(dt) {
    const a = this.f[0],
      b = this.f[1],
      mid = (a.x + b.x) / 2,
      sep = b.x - a.x;
    const z = clamp(W / (Math.max(7.4, sep + 4.4) * PPM), 1.05, 2.15);
    this.cam.z += (z - this.cam.z) * Math.min(1, dt * 2.5);
    const hw = W / 2 / (PPM * this.cam.z),
      lim = CFG.half + CFG.runoff + 0.4;
    const tx = hw >= lim ? 0 : clamp(mid, -lim + hw, lim - hw);
    this.cam.x += (tx - this.cam.x) * Math.min(1, dt * 4);
  }
  statusText() {
    const o = this.o;
    if (this.state === 'intro') return 'ATHLETE INTRODUCTIONS';
    if (this.state === 'break')
      return 'ONE-MINUTE BREAK · ' + fmtClock(this.breakT) + ' · press Enter to skip';
    if (this.state === 'victory') return 'BOUT OVER';
    if (this.state === 'touch' || this.state === 'result' || this.state === 'halt')
      return this.msg + (this.sub ? ' · ' + this.sub : '');
    if (this.overtime) return 'PRIORITY MINUTE · priority to ' + this.f[this.priority].color;
    if (o.puzzle) return 'PUZZLE · ' + o.puzzle.name.toUpperCase();
    if (o.sandbox) return 'SANDBOX' + (G.speed < 1 ? ' · ' + G.speed + '× SPEED' : '');
    if (o.training) return 'TRAINING · ' + DRILLS[this.drill].name.toUpperCase();
    if (this.f[0].engaged) return 'BLADES ENGAGED';
    return this.state === 'countdown' ? 'EN GARDE' : 'FENCING';
  }
}

/* ================= RENDERING: arenas, athletes, weapons, piste, world, debug overlays ================= */
const cv = document.getElementById('c');
const g = cv.getContext('2d');
let S = 1;
const BG = {};
const STREAKS = (() => {
  const R = mulberry(3),
    a = [];
  for (let i = 0; i < 70; i++)
    a.push({ x: R() * 17 - 8.5, y: -0.12 + R() * 0.4, w: 0.3 + R() * 1.6, a: 0.03 + R() * 0.07 });
  return a;
})();
const ARENAS = {
  club: { name: 'Local Fencing Club' },
  academy: { name: 'Traditional Fencing Academy' },
  national: { name: 'National Championship' },
  grandprix: { name: 'International Grand Prix' },
  olympic: { name: 'Olympic-Style Final' }
};
const ARENA_KEYS = Object.keys(ARENAS);
function resize() {
  const s = Math.min(innerWidth / W, innerHeight / H),
    dpr = window.devicePixelRatio || 1;
  cv.style.width = Math.round(W * s) + 'px';
  cv.style.height = Math.round(H * s) + 'px';
  S = s * dpr;
  cv.width = Math.round(W * S);
  cv.height = Math.round(H * S);
  for (const k in BG) delete BG[k];
}
function getBG(a) {
  if (!BG[a]) BG[a] = buildBG(a);
  return BG[a];
}
function crowd(b, R, top, rows, bw, li0, dense) {
  for (let r = 0; r < rows; r++) {
    const y = top + r * 27,
      li = li0 + (1 - li0) * (r / (rows - 1));
    b.fillStyle = `rgb(${16 + r * 2},${22 + r * 2},${38 + r * 3})`;
    b.fillRect(0, y, bw, 27);
    b.fillStyle = 'rgba(255,255,255,0.03)';
    b.fillRect(0, y, bw, 2);
    for (let x = R() * 14; x < bw; x += (dense ? 10 : 12) + R() * 10) {
      if (R() < (dense ? 0.06 : 0.16)) continue;
      if (Math.abs(((x + 70) % 420) - 210) < 14) continue;
      const hue = R() * 360,
        l = (9 + R() * 14) * li,
        sc = 0.85 + R() * 0.3;
      b.fillStyle = `hsl(${hue | 0},${(12 + R() * 20) | 0}%,${l.toFixed(1)}%)`;
      b.beginPath();
      b.ellipse(x, y + 23, 7 * sc, 8 * sc, 0, Math.PI, 0);
      b.fill();
      b.fillStyle = `hsl(${hue | 0},8%,${(l * 0.8 + 3).toFixed(1)}%)`;
      b.beginPath();
      b.arc(x, y + 10 * sc + 1, 4.6 * sc, 0, TAU);
      b.fill();
      if (R() < 0.012) {
        b.fillStyle = 'rgba(200,220,255,0.7)';
        b.fillRect(x + 3, y + 12, 2, 3);
      }
    }
  }
  for (let x = 140; x < bw; x += 420) {
    b.fillStyle = 'rgba(0,0,0,0.4)';
    b.fillRect(x - 10, top, 20, rows * 27);
  }
}
function lights(b, bw, y, col, step = 150) {
  for (let x = 50; x < bw; x += step) {
    const rg = b.createRadialGradient(x, y, 0, x, y, 64);
    rg.addColorStop(0, `rgba(${col},0.85)`);
    rg.addColorStop(0.08, `rgba(${col},0.45)`);
    rg.addColorStop(1, `rgba(${col},0)`);
    b.fillStyle = rg;
    b.fillRect(x - 64, y - 44, 128, 110);
    b.fillStyle = `rgb(${col})`;
    b.beginPath();
    b.ellipse(x, y, 9, 4, 0, 0, TAU);
    b.fill();
  }
}
function buildBG(a) {
  const bw = W + 400,
    c = document.createElement('canvas');
  c.width = Math.ceil(bw * S);
  c.height = Math.ceil(H * S);
  const b = c.getContext('2d');
  b.scale(S, S);
  const R = mulberry(7);
  let gr;
  const floor = (c1, c2) => {
    gr = b.createLinearGradient(0, 510, 0, H);
    gr.addColorStop(0, c1);
    gr.addColorStop(1, c2);
    b.fillStyle = gr;
    b.fillRect(0, 510, bw, H - 510);
  };
  if (a === 'club') {
    gr = b.createLinearGradient(0, 0, 0, 510);
    gr.addColorStop(0, '#3a3d44');
    gr.addColorStop(1, '#5b5e66');
    b.fillStyle = gr;
    b.fillRect(0, 0, bw, 510);
    b.fillStyle = '#4a4d55';
    b.fillRect(0, 330, bw, 180);
    for (let x = 0; x < bw; x += 96) {
      b.fillStyle = 'rgba(0,0,0,0.12)';
      b.fillRect(x, 330, 2, 180);
    }
    for (let x = 60; x < bw; x += 520) {
      b.fillStyle = '#6b4a2e';
      for (let i = 0; i < 10; i++) b.fillRect(x + i * 14, 150, 4, 180);
      for (let y = 160; y < 330; y += 20) b.fillRect(x, y, 140, 3);
    }
    for (let x = 300; x < bw; x += 520) {
      b.fillStyle = '#2b2f37';
      b.fillRect(x, 240, 180, 8);
      for (let i = 0; i < 6; i++) {
        b.fillStyle = '#e9ecf1';
        b.beginPath();
        b.ellipse(x + 15 + i * 30, 228, 11, 13, 0, 0, TAU);
        b.fill();
        b.fillStyle = '#20252e';
        b.beginPath();
        b.ellipse(x + 19 + i * 30, 228, 7, 10, 0, 0, TAU);
        b.fill();
      }
    }
    b.font = font(28, 900);
    b.fillStyle = 'rgba(255,255,255,0.18)';
    for (let x = 420; x < bw; x += 900) b.fillText('RIVERSIDE FENCING CLUB', x, 110);
    for (let x = 80; x < bw; x += 240) {
      b.fillStyle = '#eef3ff';
      b.fillRect(x, 30, 140, 6);
      const rg = b.createLinearGradient(0, 36, 0, 260);
      rg.addColorStop(0, 'rgba(240,246,255,0.18)');
      rg.addColorStop(1, 'rgba(240,246,255,0)');
      b.fillStyle = rg;
      b.beginPath();
      b.moveTo(x, 36);
      b.lineTo(x + 140, 36);
      b.lineTo(x + 200, 260);
      b.lineTo(x - 60, 260);
      b.fill();
    }
    gr = b.createLinearGradient(0, 510, 0, H);
    gr.addColorStop(0, '#a8743f');
    gr.addColorStop(1, '#6e4524');
    b.fillStyle = gr;
    b.fillRect(0, 510, bw, H - 510);
    for (let y = 516; y < H; y += 14) {
      b.fillStyle = 'rgba(60,30,10,0.25)';
      b.fillRect(0, y, bw, 1);
      for (let x = (y * 37) % 160; x < bw; x += 160 + ((y * 13) % 60)) b.fillRect(x, y - 13, 1, 13);
    }
    b.fillStyle = 'rgba(255,255,255,0.08)';
    b.fillRect(0, 510, bw, 2);
    return c;
  }
  if (a === 'academy') {
    gr = b.createLinearGradient(0, 0, 0, 510);
    gr.addColorStop(0, '#2a1a10');
    gr.addColorStop(1, '#4a2e1a');
    b.fillStyle = gr;
    b.fillRect(0, 0, bw, 510);
    for (let x = 100; x < bw; x += 300) {
      b.fillStyle = '#e8c88a';
      b.globalAlpha = 0.22;
      b.beginPath();
      b.moveTo(x, 360);
      b.lineTo(x, 170);
      b.arc(x + 60, 170, 60, Math.PI, 0);
      b.lineTo(x + 120, 360);
      b.fill();
      b.globalAlpha = 1;
      b.strokeStyle = '#5c3b22';
      b.lineWidth = 6;
      b.beginPath();
      b.moveTo(x, 360);
      b.lineTo(x, 170);
      b.arc(x + 60, 170, 60, Math.PI, 0);
      b.lineTo(x + 120, 360);
      b.stroke();
      b.lineWidth = 3;
      b.beginPath();
      b.moveTo(x + 60, 110);
      b.lineTo(x + 60, 360);
      b.moveTo(x, 250);
      b.lineTo(x + 120, 250);
      b.stroke();
    }
    for (let x = 250; x < bw; x += 300) {
      gr = b.createLinearGradient(x - 18, 0, x + 18, 0);
      gr.addColorStop(0, '#6b4a30');
      gr.addColorStop(0.5, '#c9a77a');
      gr.addColorStop(1, '#5a3c25');
      b.fillStyle = gr;
      b.fillRect(x - 18, 60, 36, 330);
      b.fillStyle = '#d8b98c';
      b.fillRect(x - 26, 52, 52, 12);
      b.fillRect(x - 26, 386, 52, 12);
    }
    b.fillStyle = '#3a2414';
    b.fillRect(0, 398, bw, 112);
    for (let x = 0; x < bw; x += 80) {
      b.fillStyle = 'rgba(255,220,160,0.06)';
      b.fillRect(x + 4, 406, 72, 96);
    }
    for (let x = 180; x < bw; x += 600) {
      b.strokeStyle = '#cfd5dd';
      b.lineWidth = 4;
      b.beginPath();
      b.moveTo(x - 70, 460);
      b.lineTo(x + 70, 300);
      b.moveTo(x + 70, 460);
      b.lineTo(x - 70, 300);
      b.stroke();
      b.fillStyle = '#8a1f1f';
      b.beginPath();
      b.arc(x, 380, 34, 0, TAU);
      b.fill();
      b.strokeStyle = '#e0b85a';
      b.lineWidth = 3;
      b.stroke();
    }
    for (let x = 200; x < bw; x += 450) {
      b.fillStyle = 'rgba(255,210,120,0.9)';
      for (let i = 0; i < 5; i++) {
        b.beginPath();
        b.arc(x - 40 + i * 20, 70, 4, 0, TAU);
        b.fill();
      }
      const rg = b.createRadialGradient(x, 70, 0, x, 70, 160);
      rg.addColorStop(0, 'rgba(255,200,110,0.35)');
      rg.addColorStop(1, 'rgba(255,200,110,0)');
      b.fillStyle = rg;
      b.fillRect(x - 160, 0, 320, 240);
    }
    gr = b.createLinearGradient(0, 510, 0, H);
    gr.addColorStop(0, '#7a4b28');
    gr.addColorStop(1, '#3d2412');
    b.fillStyle = gr;
    b.fillRect(0, 510, bw, H - 510);
    for (let y = 518; y < H; y += 16) {
      b.fillStyle = 'rgba(30,12,4,0.3)';
      b.fillRect(0, y, bw, 1);
    }
    return c;
  }
  const bright = a === 'national',
    olym = a === 'olympic';
  gr = b.createLinearGradient(0, 0, 0, H);
  if (bright) {
    gr.addColorStop(0, '#141a26');
    gr.addColorStop(0.5, '#1e2636');
    gr.addColorStop(1, '#0c0f16');
  } else if (olym) {
    gr.addColorStop(0, '#0a0a12');
    gr.addColorStop(0.5, '#16131f');
    gr.addColorStop(1, '#08070c');
  } else {
    gr.addColorStop(0, '#04070e');
    gr.addColorStop(0.35, '#0a1020');
    gr.addColorStop(0.7, '#0d1322');
    gr.addColorStop(1, '#07090f');
  }
  b.fillStyle = gr;
  b.fillRect(0, 0, bw, H);
  b.strokeStyle = 'rgba(120,140,170,0.10)';
  b.lineWidth = 2;
  b.beginPath();
  for (let x = 0; x < bw; x += 60) {
    b.moveTo(x, 28);
    b.lineTo(x + 30, 58);
    b.lineTo(x + 60, 28);
  }
  b.moveTo(0, 28);
  b.lineTo(bw, 28);
  b.moveTo(0, 58);
  b.lineTo(bw, 58);
  b.stroke();
  const top = olym ? 92 : 108,
    rows = olym ? 14 : 13;
  crowd(b, R, top, rows, bw, bright ? 0.6 : 0.35, olym);
  gr = b.createLinearGradient(0, top, 0, 470);
  gr.addColorStop(0, `rgba(3,5,10,${bright ? 0.45 : 0.78})`);
  gr.addColorStop(1, 'rgba(3,5,10,0.05)');
  b.fillStyle = gr;
  b.fillRect(0, top, bw, 470 - top);
  b.fillStyle = olym ? '#17120a' : '#0a1222';
  b.fillRect(0, 470, bw, 40);
  b.fillStyle = olym ? 'rgba(230,190,90,0.7)' : bright ? 'rgba(120,200,255,0.6)' : 'rgba(80,140,255,0.55)';
  b.fillRect(0, 470, bw, 2);
  b.font = font(15, 800);
  b.fillStyle = olym ? 'rgba(230,190,90,0.35)' : 'rgba(120,170,255,0.25)';
  const txt = olym
    ? 'THE GOLDEN PISTE  ·  CHAMPIONSHIP FINAL'
    : bright
      ? 'NATIONAL CHAMPIONSHIP  ·  SENIOR ÉPÉE'
      : 'DUEL OF BLADES  ·  WORLD ÉPÉE SERIES';
  for (let x = 40; x < bw; x += 430) b.fillText(txt, x, 495);
  floor(bright ? '#1b2230' : olym ? '#120f14' : '#131925', '#06080c');
  lights(b, bw, 44, olym ? '255,236,190' : '255,250,235', bright ? 110 : 150);
  if (olym) {
    for (let x = 0; x < bw; x += 8) {
      b.fillStyle = `rgba(255,215,120,${0.02 + 0.04 * Math.random()})`;
      b.fillRect(x, 80, 2, 2);
    }
  }
  return c;
}
function drawJumbo(x, y, m, w = 236) {
  g.fillStyle = '#02050b';
  rr(x - w / 2, y, w, 92, 6);
  g.fill();
  g.strokeStyle = '#1d2a44';
  g.lineWidth = 2;
  g.stroke();
  const gr = g.createLinearGradient(0, y, 0, y + 92);
  gr.addColorStop(0, '#0b1a38');
  gr.addColorStop(1, '#060d1d');
  g.fillStyle = gr;
  rr(x - w / 2 + 8, y + 7, w - 16, 78, 3);
  g.fill();
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(11, 800);
  g.fillStyle = '#8fb5ff';
  g.fillText('BLUE', x - 68, y + 24);
  g.fillStyle = '#ff9a9a';
  g.fillText('RED', x + 68, y + 24);
  g.font = font(32, 800);
  g.fillStyle = '#e9f0ff';
  g.fillText(pad2(m.score[0]), x - 68, y + 56);
  g.fillText(pad2(m.score[1]), x + 68, y + 56);
  g.font = font(12, 700);
  g.fillStyle = '#ffd76a';
  g.fillText(m.o.periodLen ? fmtClock(m.clock) : RULES[m.weapon].name.toUpperCase(), x, y + 46);
  g.fillStyle = 'rgba(200,215,240,.5)';
  g.font = font(9, 700);
  g.fillText(RULES[m.weapon].name.toUpperCase(), x, y + 64);
  g.fillStyle = 'rgba(255,255,255,0.04)';
  for (let i = y + 8; i < y + 84; i += 3) g.fillRect(x - w / 2 + 8, i, w - 16, 1);
}
function rr(x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}
function taper(a, b, r1, r2) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  g.beginPath();
  g.arc(a.x, a.y, r1, ang + Math.PI / 2, ang + Math.PI * 1.5);
  g.arc(b.x, b.y, r2, ang - Math.PI / 2, ang + Math.PI / 2);
  g.closePath();
}
function fs(c) {
  g.fillStyle = c;
  g.fill();
  g.stroke();
}
function line(a, b) {
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke();
}
function worldT(cam) {
  const k = S * cam.z * PPM;
  g.setTransform(k, 0, 0, k, S * (W / 2 - cam.x * cam.z * PPM), S * GY);
}
function toScreen(cam, x, y) {
  return P(W / 2 + (x - cam.x) * cam.z * PPM, GY + y * cam.z * PPM);
}
const SHOE_COL = {
  white: ['#eef1f5', '#c4cad3'],
  black: ['#2b2f36', '#1d2026'],
  gold: ['#e8c25a', '#b8922f'],
  team: null
};
function shoe(f, a, d, rear) {
  const L = rear ? 0.11 : 0.26,
    sole = a.y + 0.085,
    x0 = a.x - d * 0.06,
    x1 = a.x + d * L;
  const sc = SHOE_COL[f.cos.shoes] || [f.trim, f.trim];
  g.beginPath();
  g.moveTo(x0, sole);
  g.lineTo(x1, sole);
  g.quadraticCurveTo(x1 + d * 0.02, sole - 0.05, x1 - d * 0.06, sole - 0.075);
  g.lineTo(a.x, sole - 0.12);
  g.lineTo(x0, sole - 0.09);
  g.closePath();
  fs(rear ? sc[1] : sc[0]);
  g.fillStyle = '#2a2f38';
  g.fillRect(Math.min(x0, x1), sole - 0.018, Math.abs(x1 - x0), 0.018);
}
function limbFill(a, b, c1, c2) {
  const gr = g.createLinearGradient(a.x, a.y - 0.05, a.x, a.y + 0.05);
  gr.addColorStop(0, c1);
  gr.addColorStop(1, c2);
  return gr;
}
function drawBody(f) {
  const J = f.J,
    d = f.d,
    t = f.trim,
    lame = f.weapon === 'foil' || f.weapon === 'sabre';
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.lineWidth = 0.012;
  g.strokeStyle = 'rgba(6,10,18,0.72)';
  const W1 = '#f4f6f9',
    W2 = '#dde2e9',
    W3 = '#b4bcc8';
  const sleeve = f.weapon === 'sabre' ? '#aeb7c2' : W1;
  const frontArm = () => {
    taper(J.sh, J.el, 0.058, 0.048);
    fs(sleeve);
    taper(J.el, J.hand, 0.048, 0.04);
    fs(sleeve);
    const bd = sub(J.blade[1], J.guardC),
      bl = len(bd) || 1,
      u = mul(bd, 1 / bl);
    g.strokeStyle = '#1e232b';
    g.lineWidth = 0.024;
    line(sub(J.hand, mul(u, 0.09)), add(J.hand, mul(u, 0.03)));
    g.strokeStyle = 'rgba(6,10,18,0.72)';
    g.lineWidth = 0.012;
    g.save();
    g.translate(J.hand.x, J.hand.y);
    g.rotate(Math.atan2(u.y, u.x));
    g.beginPath();
    g.ellipse(-0.005, 0, 0.05, 0.04, 0, 0, TAU);
    g.restore();
    fs('#e8ebf0');
    g.strokeStyle = t;
    g.lineWidth = 0.016;
    const cu = lerpP(J.el, J.hand, 0.72);
    const pd = P(-(J.hand.y - J.el.y), J.hand.x - J.el.x),
      pl = len(pd) || 1;
    line(add(cu, mul(pd, 0.05 / pl)), sub(cu, mul(pd, 0.05 / pl)));
    g.strokeStyle = 'rgba(6,10,18,0.72)';
    g.lineWidth = 0.012;
  };
  const rearArm = () => {
    taper(J.rs, J.re, 0.05, 0.042);
    fs(f.weapon === 'sabre' ? '#9aa3ae' : W3);
    taper(J.re, J.rh, 0.042, 0.036);
    fs(f.weapon === 'sabre' ? '#9aa3ae' : W3);
    g.beginPath();
    g.arc(J.rh.x, J.rh.y, 0.04, 0, TAU);
    fs('#c3c9d2');
  };
  if (f.cos.lefty) frontArm();
  else rearArm();
  shoe(f, J.aR, d, true);
  taper(J.kR, J.aR, 0.058, 0.042);
  fs(W3);
  taper(J.hip, J.kR, 0.095, 0.066);
  fs(W3);
  const h = J.hip,
    s = J.sh,
    ux = s.x - h.x,
    uy = s.y - h.y,
    L = Math.hypot(ux, uy),
    fx = (-uy / L) * d,
    fy = (ux / L) * d;
  const pt = (k, o) => P(h.x + ux * k + fx * o, h.y + uy * k + fy * o);
  g.beginPath();
  const hb = pt(0, -0.1),
    hf = pt(0, 0.1),
    cf = pt(0.62, 0.15),
    sf = pt(1, 0.09),
    sb = pt(1, -0.1),
    bm = pt(0.55, -0.12);
  g.moveTo(hb.x, hb.y);
  g.lineTo(hf.x, hf.y);
  g.quadraticCurveTo(cf.x, cf.y, sf.x, sf.y);
  g.quadraticCurveTo(s.x, s.y - 0.07, sb.x, sb.y);
  g.quadraticCurveTo(bm.x, bm.y, hb.x, hb.y);
  g.closePath();
  const gr = g.createLinearGradient(s.x - fx * 0.1, s.y - 0.05, h.x + fx * 0.1, h.y);
  if (lame) {
    gr.addColorStop(0, '#dfe5ec');
    gr.addColorStop(0.5, '#a6b0bc');
    gr.addColorStop(1, '#7f8996');
  } else {
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.6, '#e9edf2');
    gr.addColorStop(1, '#c9d0da');
  }
  fs(gr);
  g.save();
  g.clip();
  g.strokeStyle = lame ? 'rgba(255,255,255,0.18)' : 'rgba(120,135,155,0.18)';
  g.lineWidth = 0.006;
  for (let k = 0.2; k < 1; k += lame ? 0.08 : 0.27) {
    const a1 = pt(k, -0.1),
      a2 = pt(k + 0.06, 0.12);
    line(a1, a2);
  }
  g.restore();
  g.strokeStyle = t;
  g.lineWidth = 0.018;
  const a1 = pt(0.08, -0.02),
    a2 = pt(0.5, -0.05),
    a3 = pt(0.92, -0.03);
  g.beginPath();
  g.moveTo(a1.x, a1.y);
  g.quadraticCurveTo(a2.x, a2.y, a3.x, a3.y);
  g.stroke();
  g.strokeStyle = 'rgba(6,10,18,0.25)';
  g.lineWidth = 0.01;
  line(pt(0.04, -0.1), pt(0.04, 0.1));
  g.strokeStyle = 'rgba(6,10,18,0.72)';
  g.lineWidth = 0.012;
  shoe(f, J.aF, d, false);
  g.fillStyle = t;
  g.fillRect(J.aF.x + (d > 0 ? 0.02 : -0.1), J.aF.y + 0.035, 0.08, 0.012);
  taper(J.kF, J.aF, 0.06, 0.043);
  fs(W2);
  taper(J.hip, J.kF, 0.1, 0.068);
  fs(limbFill(J.hip, J.kF, '#ffffff', '#dfe4ea'));
  g.strokeStyle = 'rgba(120,135,155,0.35)';
  g.lineWidth = 0.006;
  line(lerpP(J.hip, J.kF, 0.55), lerpP(J.hip, J.kF, 0.7));
  g.strokeStyle = t;
  g.lineWidth = 0.014;
  line(lerpP(J.hip, J.kF, 0.18), lerpP(J.hip, J.kF, 0.92));
  g.strokeStyle = 'rgba(6,10,18,0.72)';
  g.lineWidth = 0.012;
  drawMask(f);
  if (f.cos.lefty) rearArm();
  else frontArm();
}
function drawMask(f) {
  const J = f.J,
    d = f.d,
    t = f.trim,
    c = J.head;
  const lame = f.weapon === 'sabre';
  g.beginPath();
  g.moveTo(c.x - d * 0.02, c.y + 0.08);
  g.lineTo(c.x + d * 0.11, c.y + 0.07);
  g.lineTo(c.x + d * 0.09, c.y + 0.2);
  g.lineTo(c.x - d * 0.04, c.y + 0.18);
  g.closePath();
  fs(f.weapon === 'foil' ? '#b3bcc7' : '#dde2e9');
  g.strokeStyle = t;
  g.lineWidth = 0.012;
  line(P(c.x + d * 0.09, c.y + 0.19), P(c.x - d * 0.04, c.y + 0.175));
  g.strokeStyle = 'rgba(6,10,18,0.72)';
  g.save();
  g.beginPath();
  g.ellipse(c.x, c.y, 0.118, 0.132, 0, 0, TAU);
  g.fillStyle = lame ? '#b9c2cc' : '#f1f3f6';
  g.fill();
  g.clip();
  const m = f.cos.mask;
  g.fillStyle = t;
  if (m === 'stripe') g.fillRect(c.x - 0.13, c.y - 0.14, 0.26, 0.035);
  else if (m === 'flag') {
    g.fillRect(c.x - 0.13, c.y - 0.03, 0.26, 0.03);
    g.fillStyle = '#ffffff';
    g.fillRect(c.x - 0.13, c.y, 0.26, 0.02);
    g.fillStyle = '#d8323c';
    g.fillRect(c.x - 0.13, c.y + 0.02, 0.26, 0.03);
  } else if (m === 'star') {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.018 : 0.042,
        a = -Math.PI / 2 + (i * Math.PI) / 5;
      g.lineTo(c.x - d * 0.05 + Math.cos(a) * r, c.y - 0.02 + Math.sin(a) * r);
    }
    g.fill();
  } else if (m === 'chevron') {
    g.lineWidth = 0.02;
    g.strokeStyle = t;
    g.beginPath();
    g.moveTo(c.x - d * 0.1, c.y - 0.08);
    g.lineTo(c.x - d * 0.03, c.y - 0.02);
    g.lineTo(c.x - d * 0.1, c.y + 0.04);
    g.stroke();
  } else if (m === 'laurel') {
    g.fillStyle = '#e3b94a';
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      g.ellipse(c.x - d * (0.09 - i * 0.012), c.y - 0.09 + i * 0.03, 0.012, 0.022, d * 0.6, 0, TAU);
      g.fill();
    }
  }
  g.beginPath();
  g.ellipse(c.x + d * 0.055, c.y + 0.005, 0.086, 0.12, 0, 0, TAU);
  const mg = g.createLinearGradient(c.x, c.y - 0.12, c.x, c.y + 0.12);
  mg.addColorStop(0, '#3a4252');
  mg.addColorStop(0.5, '#141922');
  mg.addColorStop(1, '#0a0d13');
  g.fillStyle = mg;
  g.fill();
  g.save();
  g.clip();
  g.strokeStyle = 'rgba(170,185,205,0.28)';
  g.lineWidth = 0.004;
  g.beginPath();
  for (let i = -6; i <= 6; i++) {
    g.moveTo(c.x + i * 0.016, c.y - 0.14);
    g.lineTo(c.x + i * 0.016, c.y + 0.14);
    g.moveTo(c.x - 0.1, c.y + i * 0.02);
    g.lineTo(c.x + 0.21, c.y + i * 0.02);
  }
  g.stroke();
  const sh = g.createLinearGradient(c.x - 0.05, c.y - 0.12, c.x + 0.08, c.y + 0.05);
  sh.addColorStop(0, 'rgba(255,255,255,0.32)');
  sh.addColorStop(0.45, 'rgba(255,255,255,0.05)');
  sh.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sh;
  g.fillRect(c.x - 0.15, c.y - 0.15, 0.3, 0.3);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 0.01;
  g.beginPath();
  g.ellipse(c.x + d * 0.07, c.y - 0.03, 0.05, 0.08, 0, d > 0 ? -1.4 : -1.9, d > 0 ? -0.5 : -2.8, d < 0);
  g.stroke();
  g.restore();
  g.strokeStyle = t;
  g.lineWidth = 0.022;
  line(P(c.x - d * 0.09, c.y - 0.1), P(c.x - d * 0.1, c.y + 0.08));
  g.restore();
  g.lineWidth = 0.012;
  g.strokeStyle = 'rgba(6,10,18,0.72)';
  g.beginPath();
  g.ellipse(c.x, c.y, 0.118, 0.132, 0, 0, TAU);
  g.stroke();
}
function bladeCP(b) {
  return P((9 * b[1].x - 4 * b[0].x - b[3].x) / 4, (9 * b[1].y - 4 * b[0].y - b[3].y) / 4);
}
function drawWeapon(f) {
  const J = f.J,
    b = J.blade,
    base = b[0],
    tip = b[3],
    cp = bladeCP(b),
    u0 = sub(b[1], base),
    ul = len(u0) || 1,
    u = mul(u0, 1 / ul),
    wpn = f.weapon;
  g.lineCap = 'round';
  for (let i = 1; i < f.trail.length; i++) {
    const k = i / f.trail.length;
    g.strokeStyle = `rgba(200,225,255,${0.38 * k})`;
    g.lineWidth = 0.014 * k;
    line(f.trail[i - 1], f.trail[i]);
  }
  const bw = wpn === 'foil' ? 0.009 : wpn === 'sabre' ? 0.014 : 0.011;
  g.strokeStyle = 'rgba(10,14,22,0.85)';
  g.lineWidth = bw + 0.01;
  g.beginPath();
  g.moveTo(base.x, base.y);
  g.quadraticCurveTo(cp.x, cp.y, tip.x, tip.y);
  g.stroke();
  const gr = g.createLinearGradient(base.x, base.y, tip.x, tip.y);
  gr.addColorStop(0, '#cfd6df');
  gr.addColorStop(0.5, '#f7f9fc');
  gr.addColorStop(1, '#9aa4b1');
  g.strokeStyle = gr;
  g.lineWidth = bw;
  g.stroke();
  if (f.glintT > 0) {
    const k = 1 - f.glintT / 0.18;
    const q = P(
      (1 - k) * (1 - k) * base.x + 2 * (1 - k) * k * cp.x + k * k * tip.x,
      (1 - k) * (1 - k) * base.y + 2 * (1 - k) * k * cp.y + k * k * tip.y
    );
    const rg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, 0.09);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = rg;
    g.fillRect(q.x - 0.09, q.y - 0.09, 0.18, 0.18);
  }
  g.fillStyle = wpn === 'sabre' ? '#c8d0da' : f.trim;
  g.beginPath();
  g.arc(tip.x, tip.y, wpn === 'sabre' ? 0.008 : 0.015, 0, TAU);
  g.fill();
  g.save();
  g.translate(base.x, base.y);
  g.rotate(Math.atan2(u.y, u.x));
  const ry = wpn === 'foil' ? 0.055 : wpn === 'sabre' ? 0.062 : 0.078;
  const bgd = g.createLinearGradient(0, -0.08, 0, 0.08);
  bgd.addColorStop(0, '#f1f4f8');
  bgd.addColorStop(0.5, '#8a94a2');
  bgd.addColorStop(1, '#d7dde5');
  g.beginPath();
  g.ellipse(0, 0, 0.024, ry, 0, 0, TAU);
  g.fillStyle = bgd;
  g.fill();
  g.strokeStyle = 'rgba(10,14,22,.85)';
  g.lineWidth = 0.008;
  g.stroke();
  if (wpn === 'sabre') {
    g.strokeStyle = '#aeb7c3';
    g.lineWidth = 0.012;
    g.beginPath();
    g.moveTo(0, -ry * 0.9 * f.d);
    g.quadraticCurveTo(-0.1, -0.1 * f.d, -0.13, 0);
    g.stroke();
  }
  g.beginPath();
  g.ellipse(-0.006, 0, 0.012, ry * 0.85, 0, Math.PI / 2, Math.PI * 1.5);
  g.strokeStyle = 'rgba(255,255,255,.55)';
  g.lineWidth = 0.005;
  g.stroke();
  g.fillStyle = f.side === 'in' ? 'rgba(255,255,255,.9)' : f.trim;
  g.beginPath();
  g.arc(0.012, f.side === 'in' ? ry * 0.65 : -ry * 0.65, 0.009, 0, TAU);
  g.fill();
  g.restore();
}
function drawPiste(m, fencers) {
  const hw = CFG.half,
    ro = CFG.runoff,
    y0 = -0.13,
    y1 = 0.3,
    X = hw + ro,
    a = m.arena;
  if (a === 'olympic') {
    g.fillStyle = '#1a1408';
    g.fillRect(-X - 0.3, y1, 2 * X + 0.6, 0.42);
    const gl = g.createLinearGradient(0, y1, 0, y1 + 0.42);
    gl.addColorStop(0, 'rgba(255,215,120,0.6)');
    gl.addColorStop(1, 'rgba(255,215,120,0)');
    g.fillStyle = gl;
    g.fillRect(-X - 0.3, y1, 2 * X + 0.6, 0.06);
    for (let x = -X; x < X; x += 0.6) {
      g.fillStyle = 'rgba(255,220,140,0.55)';
      g.fillRect(x, y1 + 0.2, 0.08, 0.03);
    }
  } else {
    g.fillStyle = '#161b24';
    g.fillRect(-X, y1, 2 * X, 0.07);
  }
  const gr = g.createLinearGradient(0, y0, 0, y1);
  if (a === 'club' || a === 'academy') {
    gr.addColorStop(0, '#6f747c');
    gr.addColorStop(0.45, '#8c9299');
    gr.addColorStop(1, '#4e535a');
  } else {
    gr.addColorStop(0, '#77818e');
    gr.addColorStop(0.45, '#a6afbb');
    gr.addColorStop(1, '#565f6c');
  }
  g.fillStyle = gr;
  g.fillRect(-X, y0, 2 * X, y1 - y0);
  g.fillStyle = 'rgba(10,14,22,0.4)';
  g.fillRect(-X, y0, ro, y1 - y0);
  g.fillRect(hw, y0, ro, y1 - y0);
  const pul = 0.5 + 0.5 * Math.sin(m.time * 8);
  for (const f of fencers) {
    const inW = f.back() < CFG.warn,
      sgn = -f.d;
    g.fillStyle = `rgba(255,150,40,${inW ? 0.22 + 0.18 * pul : 0.13})`;
    g.fillRect(sgn > 0 ? hw - CFG.warn : -hw, y0, CFG.warn, y1 - y0);
    if (f.back() < 0.4) {
      g.fillStyle = `rgba(255,60,60,${0.25 + 0.3 * pul})`;
      g.fillRect(sgn > 0 ? hw - 0.15 : -hw - 0.15, y0, 0.3, y1 - y0);
    }
  }
  for (const s of STREAKS) {
    g.fillStyle = `rgba(255,255,255,${s.a})`;
    g.fillRect(s.x, s.y, s.w, 0.004);
  }
  const ln = (x, w, col) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - w / 2 + 0.03, y0);
    g.lineTo(x + w / 2 + 0.03, y0);
    g.lineTo(x + w / 2 - 0.03, y1);
    g.lineTo(x - w / 2 - 0.03, y1);
    g.fill();
  };
  ln(0, 0.035, 'rgba(255,255,255,.92)');
  for (const s of [-1, 1]) {
    ln(s * CFG.enGarde, 0.03, 'rgba(255,255,255,.85)');
    ln(s * (hw - CFG.warn), 0.025, 'rgba(255,190,90,.85)');
    ln(s * hw, 0.05, '#ffffff');
  }
  g.fillStyle = 'rgba(255,255,255,.35)';
  g.fillRect(-X, y0, 2 * X, 0.006);
  const rg = g.createRadialGradient(m.cam.x, 0.05, 0, m.cam.x, 0.05, 4);
  rg.addColorStop(0, `rgba(255,250,235,${a === 'national' ? 0.22 : 0.16})`);
  rg.addColorStop(1, 'rgba(255,250,235,0)');
  g.fillStyle = rg;
  g.fillRect(m.cam.x - 4, y0, 8, y1 - y0);
}
function drawScene(m, fencers, cam, extra) {
  g.setTransform(1, 0, 0, 1, 0, 0);
  const off = clamp(-cam.x * 14, -180, 180);
  g.drawImage(getBG(m.arena), (-200 + off) * S, 0);
  g.setTransform(S, 0, 0, S, 0, 0);
  if (
    (m.arena === 'national' || m.arena === 'grandprix' || m.arena === 'olympic') &&
    G.screen !== 'title' &&
    G.screen !== 'howto'
  )
    drawJumbo(170 + off * 0.4, 78, m);
  if (m.arena === 'national' || m.arena === 'grandprix' || m.arena === 'olympic')
    drawJumbo(W - 170 + off * 0.4, 78, m);
  if (m.arena !== 'club' && m.arena !== 'academy') {
    g.globalCompositeOperation = 'lighter';
    for (const x of [470, 810]) {
      const gr = g.createLinearGradient(0, 40, 0, 560);
      gr.addColorStop(0, m.arena === 'olympic' ? 'rgba(255,225,160,0.09)' : 'rgba(255,245,220,0.07)');
      gr.addColorStop(1, 'rgba(255,245,220,0.0)');
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(x - 20 + off * 0.3, 40);
      g.lineTo(x + 20 + off * 0.3, 40);
      g.lineTo(x + 260, 560);
      g.lineTo(x - 260, 560);
      g.fill();
    }
    g.globalCompositeOperation = 'source-over';
  }
  for (const c of m.camFlash || []) {
    if (c.t < 0) continue;
    g.fillStyle = `rgba(255,255,255,${1 - c.t / 0.25})`;
    g.beginPath();
    g.arc(c.x, c.y, 2.5, 0, TAU);
    g.fill();
  }
  worldT(cam);
  drawPiste(m, fencers);
  for (const f of fencers) {
    const rg = g.createRadialGradient(f.J.hip.x, 0.02, 0, f.J.hip.x, 0.02, 0.7);
    rg.addColorStop(0, 'rgba(0,0,0,0.45)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.scale(1, 0.1);
    g.fillStyle = rg;
    g.beginPath();
    g.arc(f.J.hip.x, 0.2, 0.7, 0, TAU);
    g.fill();
    g.restore();
  }
  g.save();
  g.beginPath();
  g.rect(-12, 0, 24, 0.3);
  g.clip();
  g.globalAlpha = 0.13;
  g.scale(1, -1);
  for (const f of fencers) drawBody(f);
  for (const f of fencers) drawWeapon(f);
  g.restore();
  if (extra && extra.under) extra.under();
  for (const f of fencers) drawBody(f);
  for (const f of fencers) drawWeapon(f);
  g.globalCompositeOperation = 'lighter';
  g.lineCap = 'round';
  for (const p of m.parts || []) {
    const k = 1 - p.t / p.l;
    g.strokeStyle = `rgba(255,${(200 + 55 * k) | 0},${(120 + 100 * k) | 0},${k})`;
    g.lineWidth = 0.012;
    g.beginPath();
    g.moveTo(p.x, p.y);
    g.lineTo(p.x - p.vx * 0.018, p.y - p.vy * 0.018);
    g.stroke();
  }
  for (const q of (extra && extra.glints) || m.glints || []) {
    const k = 1 - q.t / 0.16,
      r = 0.22 * (0.5 + q.s) * k;
    if (k <= 0) continue;
    const rg = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, r);
    rg.addColorStop(0, 'rgba(255,255,240,1)');
    rg.addColorStop(1, 'rgba(255,230,180,0)');
    g.fillStyle = rg;
    g.fillRect(q.x - r, q.y - r, 2 * r, 2 * r);
    g.strokeStyle = `rgba(255,255,255,${k})`;
    g.lineWidth = 0.006;
    line(P(q.x - r * 1.6, q.y), P(q.x + r * 1.6, q.y));
    line(P(q.x, q.y - r * 1.2), P(q.x, q.y + r * 1.2));
  }
  g.globalCompositeOperation = 'source-over';
  if (extra && extra.over) extra.over();
  g.setTransform(S, 0, 0, S, 0, 0);
}
function drawWorld(m) {
  drawScene(m, m.f, m.cam, {
    over: () => {
      if (m.o.sandbox) drawDebugWorld(m);
      if (m.f[0].engaged) {
        const p = lerpP(m.f[0].J.tip, m.f[1].J.tip, 0.5);
        g.fillStyle = 'rgba(191,227,255,0.8)';
        g.beginPath();
        g.arc(p.x, p.y - 0.0, 0.02, 0, TAU);
        g.fill();
      }
    }
  });
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  for (const t of m.texts) {
    const p = toScreen(m.cam, t.x, t.y);
    const a = t.t < 1 ? 1 : 1 - (t.t - 1) / 0.3;
    g.globalAlpha = clamp(a, 0, 1);
    g.font = font(Math.round(17 * t.sz), 800);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(0,0,0,.6)';
    g.strokeText(t.s, p.x, p.y);
    g.fillStyle = t.col;
    g.fillText(t.s, p.x, p.y);
  }
  g.globalAlpha = 1;
  if (m.flash) {
    const k = 1 - m.flash.t / 0.8,
      n = m.flash.cols.length;
    m.flash.cols.forEach((c, i) => {
      const right = n > 1 && i === 1;
      const gr = g.createLinearGradient(right ? W : 0, 0, right ? W * 0.4 : W * (n > 1 ? 0.6 : 1), 0);
      gr.addColorStop(0, `rgba(${c},${0.35 * k})`);
      gr.addColorStop(1, `rgba(${c},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);
    });
  }
  if (m.tieAtMatchPoint() && m.state === 'fencing') {
    const k = 0.5 + 0.5 * Math.sin(m.time * 6.6);
    g.strokeStyle = `rgba(255,80,80,${0.08 + 0.08 * k})`;
    g.lineWidth = 10;
    g.strokeRect(5, 5, W - 10, H - 10);
  }
  const vg = g.createRadialGradient(W / 2, H * 0.55, H * 0.35, W / 2, H * 0.55, H * 0.95);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
}
/* sandbox-only developer overlays (world space) */
function drawDebugWorld(m) {
  const D = G.dbg;
  for (const f of m.f) {
    const o = m.other(f);
    if (D.zones) {
      for (const c of f.caps()) {
        const v = m.rules.valid(c[3]);
        g.strokeStyle = v ? 'rgba(90,220,140,0.75)' : 'rgba(255,90,90,0.75)';
        g.lineWidth = c[2] * 2;
        g.globalAlpha = 0.25;
        line(c[0], c[1]);
        g.globalAlpha = 1;
        g.lineWidth = 0.006;
        g.beginPath();
        g.arc(c[0].x, c[0].y, c[2], 0, TAU);
        g.stroke();
      }
      g.strokeStyle = 'rgba(255,220,120,0.8)';
      g.lineWidth = 0.006;
      g.beginPath();
      g.arc(f.J.guardC.x, f.J.guardC.y, CFG.bell, 0, TAU);
      g.stroke();
    }
    if (D.geom) {
      g.strokeStyle = f.i ? '#ff8a8a' : '#8ab8ff';
      g.lineWidth = 0.008;
      g.beginPath();
      g.moveTo(f.J.blade[0].x, f.J.blade[0].y);
      for (let i = 1; i < 4; i++) g.lineTo(f.J.blade[i].x, f.J.blade[i].y);
      g.stroke();
      for (const p of f.J.blade) {
        g.fillStyle = '#fff';
        g.fillRect(p.x - 0.01, p.y - 0.01, 0.02, 0.02);
      }
    }
    if (D.parry && f.arm.type === 'parry') {
      g.strokeStyle = f.arm.active ? 'rgba(255,230,90,0.95)' : 'rgba(255,230,90,0.3)';
      g.lineWidth = 0.03;
      g.beginPath();
      g.moveTo(f.J.blade[0].x, f.J.blade[0].y);
      for (let i = 1; i < 4; i++) g.lineTo(f.J.blade[i].x, f.J.blade[i].y);
      g.stroke();
    }
    if (D.range) {
      for (const [k, col] of [
        ['thrust', '255,180,70'],
        ['lunge', '90,210,130'],
        ['adv', '160,140,255']
      ]) {
        const r = m.effReach(f, k, f.zone);
        const x = f.x + f.d * r;
        g.strokeStyle = `rgba(${col},0.9)`;
        g.lineWidth = 0.02;
        line(P(x, -0.12), P(x, 0.28));
      }
    }
    if (D.vuln) {
      const S = m.snap(f);
      if (S.vuln) {
        g.fillStyle = 'rgba(255,60,60,0.18)';
        g.fillRect(f.x - 0.6, -2.1, 1.2, 2.1);
      }
    }
  }
  if (D.geom) {
    const a = m.f[0].J.blade,
      b = m.f[1].J.blade;
    let best = null;
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const r = segSeg(a[i], a[i + 1], b[j], b[j + 1]);
        if (!best || r.d < best.d) best = r;
      }
    g.strokeStyle = 'rgba(255,255,255,0.6)';
    g.lineWidth = 0.004;
    line(best.c1, best.c2);
    m.dbgBlade = best.d;
  }
}

/* ================= MODES: drills, puzzles, analysis & coach, ratings, ghosts, career ================= */
const DRILLS = [
  {
    name: 'Target Practice',
    desc: 'A static opponent. Find your distance, then hit with thrusts (J) and lunges (K). Aim with W/S: tap twice for head or thigh, both for the foot.',
    make: () => new Dummy('static')
  },
  {
    name: 'Parry & Riposte',
    desc: 'The dummy calls its line, then lunges. Hold W or S to match, press L as the blade arrives, then J to riposte.',
    make: () => new Dummy('attacker', { riposte: false })
  },
  {
    name: 'Distance Control',
    desc: 'The dummy drifts in and out. Lunge only when the distance meter shows your green lunge zone.',
    make: () => new Dummy('mover')
  },
  {
    name: 'Disengage & Feint',
    desc: 'The dummy parries every attack it sees. Feint (U), then disengage (I) and lunge (K) — or launch a lunge and tap I a split second later.',
    make: () => new Dummy('parrier')
  },
  {
    name: 'Free Sparring',
    desc: 'Spar against the AI at the selected difficulty and personality. No clock, no bout end.',
    make: () => new AI(SETTINGS.diff, SETTINGS.pers)
  }
];

/* ---------- tactical puzzles: reproducible (seeded), outcome-checked (not input-scripted) ---------- */
const ok = msg => ({ ok: true, msg }),
  fail = msg => ({ ok: false, msg });
const PUZZLES = [
  {
    id: 'trap',
    name: 'The Distance Trap',
    goal: 'The opponent is preparing a lunge. Make it fall short, then land a counterattack.',
    hint: 'Stay just outside its reach: a retreat or half-step as it launches, then hit during its recovery.',
    seed: 11,
    par: 6,
    setup: () => ({
      startDist: 3.0,
      opp: new Dummy('lunger', { at: 2.35, tell: 0.15, silent: true, zone: 'upper', firstDelay: 0.6 })
    }),
    check(m, ev) {
      if (ev.type !== 'touch') return ev.type === 'halt' ? fail('Fencing was halted before a touch.') : null;
      if (ev.dbl) return fail('Double touch — your counter arrived while the attack was still live.');
      if (!ev.aw.includes(0))
        return fail(
          ev.reason === 'rear'
            ? 'You retreated off the piste.'
            : 'The lunge reached you — you were inside its effective range.'
        );
      const fell = m.rec.attacks.some(a => a.who === 1 && (a.result === 'short' || a.result === 'missed'));
      if (!fell)
        return fail(
          m.rec.parries.some(p => p.who === 0 && p.success)
            ? 'You parried it — this puzzle asks you to make the attack fall short.'
            : 'You scored, but the opponent never launched and missed.'
        );
      return ok('The lunge fell short and you punished the recovery.');
    }
  },
  {
    id: 'eager',
    name: 'The Overeager Defender',
    goal: 'This opponent parries high the moment your arm moves. Land a touch.',
    hint: 'Feint (U) to draw the parry, then disengage (I) and lunge (K) — or find a line its parry never covers.',
    seed: 22,
    par: 8,
    setup: () => ({ startDist: 2.9, opp: new Dummy('eager', { at: 2.35 }) }),
    check(m, ev) {
      if (ev.type !== 'touch') return null;
      if (ev.dbl) return fail('Double touch — the riposte caught you as you hit.');
      if (!ev.aw.includes(0))
        return fail('Your attack was parried and the riposte landed. Make the parry miss first.');
      return ok('You turned its eagerness into an opening.');
    }
  },
  {
    id: 'final',
    name: 'The Final Touch',
    goal: '14–14. Win with a clean single touch — a double touch will be annulled.',
    hint: 'Avoid launching into its attacks: wait for a fall-short, a parry, or a recovering opponent.',
    seed: 33,
    par: 15,
    setup: () => ({ startScore: [14, 14], target: 15, opp: new AI(2, 'balanced') }),
    check(m, ev) {
      if (ev.type !== 'touch') return null;
      if (ev.dbl) {
        m.float(m.f[0], 'Double annulled — keep going', '#ffd76a');
        return null;
      }
      if (ev.aw.length === 0) return null;
      return ev.aw.includes(0)
        ? ok('15–14. A clean single touch.')
        : fail('The opponent found the single touch first.');
    }
  },
  {
    id: 'boundary',
    name: 'The Boundary',
    goal: 'Your back foot is near the rear limit. Score without retreating off the piste.',
    hint: 'You cannot give ground. Parry, counter, or take the initiative and reclaim space.',
    seed: 44,
    par: 10,
    setup: () => ({ pos: [-6.15, -3.45], opp: new AI(1, 'berserker') }),
    check(m, ev) {
      if (ev.type !== 'touch') return null;
      if (ev.reason === 'rear') return fail('You crossed the rear limit — that concedes the touch.');
      if (ev.dbl) return fail('Double touch — both lights.');
      return ev.aw.includes(0)
        ? ok('You held the line and scored.')
        : fail('The pressure told — you were hit.');
    }
  },
  {
    id: 'riposte',
    name: 'The Perfect Riposte',
    goal: 'The opponent will attack. Make a real blade parry, then score with the riposte.',
    hint: 'Watch its blade for the line, parry (L) as the attack arrives, then thrust (J) inside the riposte window.',
    seed: 55,
    par: 6,
    setup: () => ({ startDist: 2.6, opp: new Dummy('attacker', { at: 2.15, tell: 0.45, silent: false }) }),
    check(m, ev) {
      if (ev.type !== 'touch') return null;
      if (ev.dbl) return fail('Double touch.');
      if (!ev.aw.includes(0)) return fail('The attack landed — the parry never met its blade.');
      const h = ev.hits.find(x => x.i === 0);
      return h && h.rip
        ? ok('Parry, riposte, touché.')
        : fail('You scored, but not with a riposte after a successful parry.');
    }
  },
  {
    id: 'clock',
    name: 'Against the Clock',
    goal: 'You trail 3–4 with ten seconds left. Equalise without conceding a match-ending double touch.',
    hint: 'A double makes it 4–5 and ends the bout. You need a single light — attack into its preparation or recovery.',
    seed: 66,
    par: 10,
    setup: () => ({
      startScore: [3, 4],
      target: 5,
      startClock: 10,
      periodLen: 10,
      opp: new AI(2, 'counterpuncher')
    }),
    check(m, ev) {
      if (ev.type === 'time') return fail('Time ran out.');
      if (ev.type !== 'touch') return null;
      if (ev.dbl) return fail('Double touch — 4–5, the bout is lost.');
      return ev.aw.includes(0) ? ok('4–4 with time to spare.') : fail('The opponent extended the lead.');
    }
  }
];

/* ---------- post-match analysis (deterministic, from recorded events only) ---------- */
function analyze(m, who) {
  const rec = m.rec,
    A = rec.attacks.filter(a => a.who === who),
    landed = a => a.result === 'hit' || a.result === 'double';
  const par = rec.parries.filter(p => p.who === who && p.reason !== 'nothing'),
    feints = rec.feints.filter(f => f.who === who);
  const counters = A.filter(a => a.counter),
    rips = A.filter(a => a.riposte);
  const zc = {};
  for (const a of A) zc[a.zone] = (zc[a.zone] || 0) + 1;
  let top = null;
  for (const z in zc) if (!top || zc[z] > zc[top]) top = z;
  const rts = A.map(a => a.reactT).filter(x => x != null);
  const bins = [
    [0, 1.6],
    [1.6, 1.9],
    [1.9, 2.2],
    [2.2, 2.5],
    [2.5, 2.8],
    [2.8, 9]
  ].map(([lo, hi]) => {
    const xs = A.filter(a => a.dist >= lo && a.dist < hi);
    return { lo, hi, n: xs.length, hit: xs.filter(landed).length };
  });
  return {
    attacks: A.length,
    landed: A.filter(landed).length,
    acc: A.length ? A.filter(landed).length / A.length : 0,
    parryOk: par.filter(p => p.success).length,
    parryFail: par.filter(p => !p.success).length,
    ripOk: rips.filter(landed).length,
    rips: rips.length,
    counters: counters.length,
    counterOk: counters.filter(landed).length,
    feints: feints.length,
    feintOk: feints.filter(f => f.provoked).length,
    avgDist: A.length ? A.reduce((s, a) => s + a.dist, 0) / A.length : 0,
    topZone: top,
    topZoneN: top ? zc[top] : 0,
    avgReact: rts.length ? rts.reduce((s, x) => s + x, 0) / rts.length : null,
    recov: rec.recov[who],
    rear: rec.rear[who],
    bins,
    zc,
    scored: rec.touches.filter(t => t.who === who && t.valid && (t.scored || t.double)),
    conceded: rec.touches.filter(t => t.victim === who && t.valid && (t.scored || t.double))
  };
}
function coach(m, who) {
  const rec = m.rec,
    A = rec.attacks.filter(a => a.who === who),
    out = [],
    landed = a => a.result === 'hit' || a.result === 'double';
  const lunges = A.filter(a => a.base === 'lunge'),
    missedL = lunges.filter(a => a.result === 'short' || a.result === 'missed'),
    far = missedL.filter(a => a.dist > a.reach);
  if (far.length >= 2 && far.length / missedL.length >= 0.5) {
    const av = far.reduce((s, a) => s + a.dist, 0) / far.length,
      ar = far.reduce((s, a) => s + a.reach, 0) / far.length;
    out.push(
      `${far.length} of your ${missedL.length} missed lunges began outside effective range (average start ${av.toFixed(2)} m against a reach of about ${ar.toFixed(2)} m).`
    );
  }
  if (rec.recov[who] >= 2)
    out.push(`You conceded ${rec.recov[who]} touches while recovering from committed actions.`);
  const hi = A.filter(a => a.line === 'high').slice(-8),
    hiP = hi.filter(a => a.result === 'parried').length;
  if (hi.length >= 4 && hiP >= 3)
    out.push(`Your opponent parried ${hiP} of your last ${hi.length} high-line attacks.`);
  const lo = A.filter(a => a.line === 'low'),
    hA = A.filter(a => a.line === 'high');
  if (lo.length >= 3 && hA.length >= 3) {
    const rl = lo.filter(landed).length / lo.length,
      rh = hA.filter(landed).length / hA.length;
    if (Math.abs(rl - rh) >= 0.2)
      out.push(
        rl > rh
          ? `Your low-line attacks landed ${Math.round(rl * 100)}% of the time against ${Math.round(rh * 100)}% for high-line attacks.`
          : `Your high-line attacks landed ${Math.round(rh * 100)}% of the time against ${Math.round(rl * 100)}% for low-line attacks.`
      );
  }
  if (rec.warn[who] >= 3)
    out.push(
      `You retreated into your last metre ${rec.warn[who]} times${rec.rear[who] ? ` and conceded ${rec.rear[who]} touch${rec.rear[who] > 1 ? 'es' : ''} at the rear limit` : ''}.`
    );
  const fe = rec.feints.filter(f => f.who === who);
  if (fe.length >= 3) {
    const pv = fe.filter(f => f.provoked).length;
    out.push(`${pv} of your ${fe.length} feints drew a visible reaction (parry or retreat).`);
  }
  const unused = rec.ripWin[who] - rec.ripUsed[who];
  if (rec.ripWin[who] >= 2 && unused >= 2)
    out.push(`You won ${rec.ripWin[who]} blade exchanges but riposted only ${rec.ripUsed[who]} times.`);
  const co = A.filter(a => a.counter);
  if (co.length >= 3)
    out.push(`Your counterattacks landed ${co.filter(landed).length} of ${co.length} times.`);
  if (A.length >= 5) {
    const zc = {};
    for (const a of A) zc[a.zone] = (zc[a.zone] || 0) + 1;
    for (const z in zc)
      if (zc[z] / A.length >= 0.7)
        out.push(
          `${Math.round((zc[z] / A.length) * 100)}% of your attacks went to the ${ZONE_NAME[z].toLowerCase()}.`
        );
  }
  const dbl = rec.touches.filter(t => t.who === who && t.double).length;
  if (dbl >= 2) out.push(`${dbl} of your touches were doubles${m.weapon === 'epee' ? '' : ''}.`);
  if (!out.length)
    out.push(
      'Not enough recorded data for specific advice yet — a longer bout gives the coach more to work with.'
    );
  return out;
}

/* ---------- offline ratings (Elo, per weapon; AI opponents only) ---------- */
const RANKS = [
  ['Bronze', 0],
  ['Silver', 1000],
  ['Gold', 1150],
  ['Platinum', 1300],
  ['Diamond', 1450],
  ['Master', 1600],
  ['Grandmaster', 1750],
  ['Elite', 1900]
];
const rankName = r => {
  let n = 'Bronze';
  for (const [k, v] of RANKS) if (r >= v) n = k;
  return n;
};
function getRatings() {
  const r = Store.get('ratings', null) || {};
  for (const w of ['epee', 'foil', 'sabre'])
    if (!r[w] || !isFinite(r[w].r)) r[w] = { r: 1000, n: 0, hist: [] };
  return r;
}
function rateMatch(m) {
  const o = m.o;
  if (!o.rated || m.winner < 0) return null;
  const R = getRatings(),
    w = m.weapon,
    me = R[w];
  const ai = m.c[1];
  const opp = LV[ai.lv].rating + ((ai.P0 && ai.P0.bonus) || 0);
  const exp = 1 / (1 + Math.pow(10, (opp - me.r) / 400)),
    K = me.n < 10 ? 40 : 24,
    sc = m.winner === 0 ? 1 : 0,
    delta = Math.round(K * (sc - exp));
  me.r += delta;
  me.n++;
  me.hist.unshift({ d: delta, r: me.r, opp, res: sc ? 'W' : 'L', score: m.score.join('–') });
  me.hist = me.hist.slice(0, 12);
  Store.set('ratings', R);
  return { delta, r: me.r, rank: rankName(me.r) };
}

/* ---------- player profile (for behavioural ghosts) ---------- */
function emptyProfile() {
  return {
    matches: 0,
    attacks: 0,
    zones: {},
    kinds: { thrust: 0, lunge: 0, adv: 0 },
    feints: 0,
    beats: 0,
    remises: 0,
    distSum: 0,
    def: { P: 0, R: 0, C: 0 },
    trans: {},
    fightTime: 0,
    avgDist: 2.2,
    attacksPerMin: 6
  };
}
function updateProfile(m) {
  if (m.o.demo || m.o.puzzle || m.o.training || m.c[0].kind !== 'human') return;
  const pf = Object.assign(emptyProfile(), Store.get('profile', {}));
  const rec = m.rec;
  const A = rec.attacks.filter(a => a.who === 0);
  pf.matches++;
  pf.attacks += A.length;
  for (const a of A) {
    pf.zones[a.zone] = (pf.zones[a.zone] || 0) + 1;
    const k =
      a.kind === 'advance-lunge' || a.kind === 'patinando' ? 'adv' : a.base === 'lunge' ? 'lunge' : 'thrust';
    pf.kinds[k] = (pf.kinds[k] || 0) + 1;
    if (a.kind === 'remise') pf.remises++;
    pf.distSum += a.dist;
  }
  pf.feints += rec.feints.filter(f => f.who === 0).length;
  pf.beats += rec.beats.filter(b => b.who === 0).length;
  pf.fightTime += m.ft;
  const toks = m.pub[0];
  for (let i = 2; i < toks.length; i++) {
    const k = toks[i - 2].tok + toks[i - 1].tok,
      t = toks[i].tok;
    const row = (pf.trans[k] = pf.trans[k] || {});
    row[t] = Math.min(500, (row[t] || 0) + 1);
  }
  const rs = m.resp[0];
  pf.def.P += rs.P;
  pf.def.R += rs.R;
  pf.def.C += rs.C;
  pf.avgDist = pf.attacks ? pf.distSum / pf.attacks : 2.2;
  pf.attacksPerMin = pf.fightTime > 0 ? pf.attacks / (pf.fightTime / 60) : 6;
  Store.set('profile', pf);
}

/* ---------- ghosts: storage + strict JSON validation (no code is ever executed) ---------- */
function getGhosts() {
  const g0 = Store.get('ghosts', []);
  return Array.isArray(g0) ? g0 : [];
}
function saveGhosts(a) {
  Store.set('ghosts', a.slice(0, 10));
}
function cleanName(s) {
  return (
    String(s || 'Ghost')
      .replace(/[^\w \-'.À-ÿ]/g, '')
      .slice(0, 24) || 'Ghost'
  );
}
function validateGhost(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw 'Not a ghost profile object.';
  if (obj.format !== 'fdob-ghost' || obj.version !== 1)
    throw 'Unknown format — expected format "fdob-ghost", version 1.';
  const kind = obj.kind;
  if (kind !== 'behavior' && kind !== 'recorded') throw 'kind must be "behavior" or "recorded".';
  const num = (v, lo, hi, name) => {
    if (typeof v !== 'number' || !isFinite(v) || v < lo || v > hi) throw `Invalid number for ${name}.`;
    return v;
  };
  const d = obj.data;
  if (!d || typeof d !== 'object') throw 'Missing data.';
  if (kind === 'behavior') {
    const pf = emptyProfile();
    pf.matches = num(d.matches, 0, 1e6, 'matches');
    pf.attacks = num(d.attacks, 0, 1e7, 'attacks');
    for (const z of ZONES) if (d.zones && d.zones[z] != null) pf.zones[z] = num(d.zones[z], 0, 1e7, 'zones');
    for (const k of ['thrust', 'lunge', 'adv'])
      pf.kinds[k] = num(d.kinds && d.kinds[k] != null ? d.kinds[k] : 0, 0, 1e7, 'kinds');
    for (const k of ['feints', 'beats', 'remises']) pf[k] = num(d[k] || 0, 0, 1e7, k);
    for (const k of ['P', 'R', 'C']) pf.def[k] = num(d.def && d.def[k] != null ? d.def[k] : 0, 0, 1e7, 'def');
    pf.avgDist = num(d.avgDist, 0.5, 6, 'avgDist');
    pf.attacksPerMin = num(d.attacksPerMin, 0, 200, 'attacksPerMin');
    if (d.trans) {
      if (typeof d.trans !== 'object') throw 'Invalid transitions.';
      let n = 0;
      for (const k in d.trans) {
        if (!/^[_ARTLFPBD]{1,2}$/.test(k)) throw 'Invalid transition key.';
        const row = d.trans[k];
        if (!row || typeof row !== 'object') throw 'Invalid transition row.';
        pf.trans[k] = {};
        for (const t in row) {
          if (!TOKS.includes(t)) throw 'Invalid action token.';
          pf.trans[k][t] = num(row[t], 0, 1e6, 'transition count');
          if (++n > 2000) throw 'Too many transitions.';
        }
      }
    }
    return { format: 'fdob-ghost', version: 1, name: cleanName(obj.name), kind, data: pf };
  }
  const fr = d.frames,
    pr = d.presses;
  if (!Array.isArray(fr) || !Array.isArray(pr) || fr.length > 20000 || pr.length > 6000)
    throw 'Invalid recording arrays.';
  const frames = fr.map(r => {
    if (!Array.isArray(r) || r.length !== 6) throw 'Invalid frame row.';
    return [
      num(r[0], 0, 1e6, 'frame') | 0,
      num(r[1], -1, 1, 'move') | 0,
      num(r[2], 0, 1, 'fast') | 0,
      num(r[3], 0, 2, 'guard') | 0,
      num(r[4], 0, 5, 'zone') | 0,
      num(r[5], 0, 1, 'hold') | 0
    ];
  });
  const presses = pr.map(r => {
    if (!Array.isArray(r) || r.length !== 2 || !ACTS.includes(r[1])) throw 'Invalid press row.';
    return [num(r[0], 0, 1e6, 'frame') | 0, r[1]];
  });
  return {
    format: 'fdob-ghost',
    version: 1,
    name: cleanName(obj.name),
    kind,
    data: { frames, presses, length: num(d.length, 0, 1e6, 'length') | 0 }
  };
}

/* ---------- career ---------- */
const CAREER_LEVELS = [
  {
    name: 'Riverside Club Open',
    tier: 'Local fencing club',
    arena: 'club',
    size: 4,
    target: 5,
    periods: 1,
    lv: [0, 1]
  },
  {
    name: 'Northern Regional Cup',
    tier: 'Regional competition',
    arena: 'academy',
    size: 8,
    target: 5,
    periods: 1,
    lv: [1, 1]
  },
  {
    name: 'National Circuit Grand Prix',
    tier: 'National circuit',
    arena: 'national',
    size: 8,
    target: 10,
    periods: 2,
    lv: [1, 2]
  },
  {
    name: 'Junior International Championship',
    tier: 'Junior international championship',
    arena: 'national',
    size: 8,
    target: 10,
    periods: 2,
    lv: [2, 2]
  },
  {
    name: 'Senior International Championship',
    tier: 'Senior international championship',
    arena: 'grandprix',
    size: 8,
    target: 15,
    periods: 3,
    lv: [2, 3]
  },
  {
    name: 'World Championship',
    tier: 'World championship',
    arena: 'grandprix',
    size: 8,
    target: 15,
    periods: 3,
    lv: [3, 3]
  },
  {
    name: 'The Golden Piste',
    tier: 'Olympic-style championship',
    arena: 'olympic',
    size: 8,
    target: 15,
    periods: 3,
    lv: [3, 3]
  }
];
const SURN = [
  'Moreau',
  'Tanaka',
  'Rossi',
  'Novak',
  'Park',
  'Weber',
  'Silva',
  'Okafor',
  'Lindqvist',
  'Kovács',
  'Duarte',
  'Ivanova',
  'Haddad',
  'Brennan',
  'Sato',
  'Mendes',
  'Varga',
  'Nielsen',
  'Costa',
  'Adeyemi',
  'Petrov',
  'Laurent',
  'Kim',
  'Fischer',
  'Rinaldi',
  'Horvat',
  'Quinn',
  'Achterberg'
];
const COUNTRIES = [
  'FRA',
  'JPN',
  'ITA',
  'CZE',
  'KOR',
  'GER',
  'BRA',
  'NGR',
  'SWE',
  'HUN',
  'POR',
  'UKR',
  'EGY',
  'IRL',
  'USA',
  'CAN',
  'EST',
  'DEN',
  'ESP',
  'GHA',
  'BUL',
  'SUI',
  'CHN',
  'AUT',
  'ARG',
  'CRO',
  'GBR',
  'NED'
];
function makeRoster() {
  const R = mulberry(2026),
    out = [];
  for (let i = 0; i < 28; i++) {
    const tier = Math.floor(i / 4);
    out.push({
      id: 'a' + i,
      n: String.fromCharCode(65 + Math.floor(R() * 26)) + '. ' + SURN[i],
      c: COUNTRIES[i],
      pers: PERS_KEYS[Math.floor(R() * PERS_KEYS.length)],
      tier,
      pts: Math.round(20 + tier * 60 + R() * 40)
    });
  }
  return out;
}
const TRIMS = [
  ['Royal blue', '#3b8cff', 0],
  ['Teal', '#19b3a6', 1],
  ['Emerald', '#2fbf5b', 2],
  ['Violet', '#8c5cff', 3],
  ['Gold', '#e3b94a', 4],
  ['Silver', '#aeb8c6', 5],
  ['Black', '#20242b', 7]
];
const MASKS = [
  ['Plain', 'plain', 0],
  ['Stripe', 'stripe', 1],
  ['Flag', 'flag', 2],
  ['Star', 'star', 4],
  ['Chevron', 'chevron', 5],
  ['Laurel', 'laurel', 7]
];
const SHOES = [
  ['White', 'white', 0],
  ['Black', 'black', 1],
  ['Team colour', 'team', 3],
  ['Gold', 'gold', 7]
];
const STYLES = ['Balanced', 'Aggressive', 'Defensive', 'Technical', 'Counter-attacker'];
function careerUnlocked(c, req) {
  return c.best >= req;
}
function getCareer() {
  const c = Store.get('career', null);
  if (!c || !c.profile) return null;
  if (!c.roster) c.roster = makeRoster();
  return c;
}
function saveCareer(c) {
  Store.set('career', c);
}
function newCareer(p) {
  return {
    profile: p,
    level: 0,
    best: 0,
    points: 0,
    rec: { w: 0, l: 0, tw: 0, streak: 0, bestStreak: 0, bestMargin: 0, touches: 0 },
    history: [],
    rivals: {},
    memory: {},
    roster: makeRoster(),
    cur: null,
    created: Date.now()
  };
}
function careerRank(c) {
  const all = c.roster
    .map(a => ({ n: a.n, p: a.pts, you: false }))
    .concat([{ n: c.profile.name, p: c.points, you: true }])
    .sort((a, b) => b.p - a.p);
  return { pos: all.findIndex(x => x.you) + 1, of: all.length, list: all };
}
function careerStart(c) {
  const L = CAREER_LEVELS[c.level];
  const pool = c.roster.filter(a => Math.abs(a.tier - c.level) <= 1).sort(() => RNG() - 0.5);
  let ent = pool.slice(0, L.size - 1);
  const rm = Object.keys(c.rivals).find(id => c.rivals[id].rematch);
  if (rm && !ent.some(a => a.id === rm)) {
    const a = c.roster.find(x => x.id === rm);
    if (a) ent[ent.length - 1] = a;
  }
  const ids = ['you'].concat(ent.map(a => a.id));
  if (rm) {
    const ri = ids.indexOf(rm);
    if (ri > 0) {
      const half = L.size / 2;
      const tgt = half + (ri % half);
      [ids[ri], ids[tgt]] = [ids[tgt], ids[ri]];
    }
  }
  c.cur = { lvl: c.level, rounds: [ids], res: [[]], r: 0, out: false, champ: false };
  saveCareer(c);
}
function careerOpp(c) {
  const rd = c.cur.rounds[c.cur.r],
    ix = rd.indexOf('you');
  return rd[ix % 2 ? ix - 1 : ix + 1];
}
function athlete(c, id) {
  return c.roster.find(a => a.id === id);
}
function careerAfterBout(c, m) {
  const cur = c.cur,
    rd = cur.rounds[cur.r],
    won = m.winner === 0,
    opp = careerOpp(c),
    a = athlete(c, opp),
    L = CAREER_LEVELS[cur.lvl];
  const rv = (c.rivals[opp] = c.rivals[opp] || { w: 0, l: 0, met: 0, notes: [], rematch: false });
  rv.met++;
  if (won) {
    rv.w++;
    c.rec.w++;
    c.rec.streak++;
    c.rec.bestStreak = Math.max(c.rec.bestStreak, c.rec.streak);
    c.rec.bestMargin = Math.max(c.rec.bestMargin, m.score[0] - m.score[1]);
    if (rv.rematch) rv.rematch = false;
  } else {
    rv.l++;
    c.rec.l++;
    c.rec.streak = 0;
  }
  c.rec.touches += m.score[0];
  rv.last = `${won ? 'W' : 'L'} ${m.score[0]}–${m.score[1]} · ${L.name}`;
  rv.notes = [];
  if (rv.l >= 2) rv.notes.push('Nemesis');
  if (rv.met >= 3) rv.notes.push('Rival');
  if (rv.w >= 3) rv.notes.push('Rival (beaten often)');
  const ai = m.c[1];
  if (ai.pred) {
    const mem = ai.pred.save();
    const zs = {};
    for (const t of m.rec.touches) if (t.who === 1 && t.scored) zs[t.zone] = (zs[t.zone] || 0) + 1;
    mem.zoneScored = zs;
    c.memory[opp] = mem;
  }
  const next = [];
  cur.res[cur.r] = [];
  for (let i = 0; i < rd.length; i += 2) {
    const x = rd[i],
      y = rd[i + 1];
    let w, sc;
    if (x === 'you' || y === 'you') {
      w = won ? 'you' : opp;
      sc = Math.max(...m.score) + '–' + Math.min(...m.score);
    } else {
      const ax = athlete(c, x),
        ay = athlete(c, y);
      w = RNG() < 0.5 + 0.08 * (ax.tier - ay.tier) ? x : y;
      sc = L.target + '–' + (Math.floor(L.target * 0.4) + Math.floor(RNG() * L.target * 0.55));
    }
    next.push(w);
    cur.res[cur.r].push({ w, sc });
  }
  if (!won) {
    cur.out = true;
    if (cur.r === Math.log2(L.size) - 1) {
      rv.rematch = true;
      rv.notes.push('Rematch pending');
    }
    careerFinish(c);
    return;
  }
  cur.rounds.push(next);
  if (next.length === 1) {
    cur.champ = true;
    careerFinish(c);
    return;
  }
  cur.r++;
  cur.res.push([]);
  saveCareer(c);
}
function careerFinish(c) {
  const cur = c.cur,
    L = CAREER_LEVELS[cur.lvl],
    rounds = Math.log2(L.size);
  const place = cur.champ
    ? 1
    : cur.r === rounds - 1
      ? 2
      : cur.r === rounds - 2
        ? 3
        : Math.pow(2, rounds - cur.r);
  const pts = Math.round((cur.champ ? 100 : place === 2 ? 60 : place <= 4 ? 35 : 15) * (cur.lvl + 1));
  c.points += pts;
  for (const a of c.roster)
    if (Math.abs(a.tier - cur.lvl) <= 1) a.pts += Math.round(RNG() * 40 * (a.tier + 1));
  if (cur.champ) {
    c.rec.tw++;
    c.best = Math.max(c.best, cur.lvl + 1);
    if (c.level < CAREER_LEVELS.length - 1) c.level++;
  }
  c.history.unshift({ lvl: cur.lvl, name: L.name, place, pts, date: new Date().toISOString().slice(0, 10) });
  c.history = c.history.slice(0, 20);
  c.lastPlace = { place, pts, champ: cur.champ, name: L.name };
  saveCareer(c);
}

/* ================= HUD, overlays, replay viewer rendering ================= */
const cap1 = s => (s ? s[0].toUpperCase() + s.slice(1) : s);
function lamp(x, y, on, rgb, white) {
  rr(x - 22, y - 8, 44, 16, 8);
  if (white) {
    g.shadowColor = '#fff';
    g.shadowBlur = 18;
    g.fillStyle = '#f4f6fb';
    g.fill();
    g.shadowBlur = 0;
  } else if (on) {
    g.shadowColor = `rgb(${rgb})`;
    g.shadowBlur = 22;
    g.fillStyle = `rgb(${rgb})`;
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,.55)';
    rr(x - 16, y - 5, 32, 4, 2);
    g.fill();
  } else {
    g.fillStyle = `rgba(${rgb},0.16)`;
    g.fill();
    g.strokeStyle = `rgba(${rgb},0.35)`;
    g.lineWidth = 1;
    g.stroke();
  }
}
function lineName(f) {
  const h = f.guard,
    n = parryNum(h === 'low' ? 'low' : 'high', f.side);
  return `${ZONE_NAME[f.zone].toUpperCase()} · ${f.side === 'out' ? 'OUT' : 'IN'} · ${PARRY_NAME[n]} (${n})`;
}
function fencerPanel(x, y, f, m) {
  const w = 400;
  rr(x, y, w, 66, 10);
  g.fillStyle = 'rgba(8,12,22,.82)';
  g.fill();
  g.strokeStyle = 'rgba(150,180,230,.16)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = `rgb(${f.light})`;
  rr(x, y + 8, 4, 50, 2);
  g.fill();
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.font = font(12, 800);
  g.fillStyle = '#e8eefc';
  g.fillText(f.name.length > 30 ? f.name.slice(0, 30) + '…' : f.name, x + 16, y + 16);
  g.textAlign = 'right';
  g.font = font(12, 600);
  g.fillStyle = '#ffd99a';
  g.fillText(cap1(f.actionLabel()), x + w - 14, y + 16);
  g.textAlign = 'left';
  g.font = font(11, 700);
  g.fillStyle = 'rgba(170,190,220,.7)';
  g.fillText('AIM', x + 16, y + 36);
  g.fillStyle = '#dfe8f7';
  g.font = font(12, 600);
  g.fillText(lineName(f), x + 48, y + 36);
  g.textAlign = 'right';
  if (f.back() < CFG.warn) {
    g.fillStyle = f.back() < 0.6 ? '#ff5c5c' : '#ffae4a';
    g.font = font(11, 800);
    g.fillText('REAR LIMIT', x + w - 14, y + 36);
  } else {
    g.fillStyle =
      f.balance === 'Balanced'
        ? 'rgba(150,220,170,.8)'
        : f.balance === 'Recovering' || f.balance === 'Overextended'
          ? '#ff9a7a'
          : 'rgba(200,210,230,.75)';
    g.font = font(11, 700);
    g.fillText(
      f.balance.toUpperCase() +
        (m.sim ? ` · ${f.energy > 70 ? 'FRESH' : f.energy > 35 ? 'TIRED' : 'EXHAUSTED'}` : ''),
      x + w - 14,
      y + 36
    );
  }
  g.textAlign = 'left';
  g.font = font(10, 700);
  g.fillStyle = 'rgba(170,190,220,.7)';
  const L = f.legs;
  g.fillText('LUNGE', x + 16, y + 54);
  rr(x + 62, y + 50, 150, 8, 4);
  g.fillStyle = 'rgba(255,255,255,.08)';
  g.fill();
  if (L.type === 'lunge') {
    const tot = L.total || 0.65,
      k = clamp(1 - L.t / tot, 0, 1);
    g.fillStyle = L.phase === 'committed' ? '#ff6b5a' : L.phase === 'recovery' ? '#ffc25a' : '#7fb4ff';
    rr(x + 62, y + 50, 150 * k, 8, 4);
    g.fill();
    g.fillStyle = '#cfe0ff';
    g.fillText((L.phase || '').toUpperCase(), x + 220, y + 54);
  } else {
    g.fillStyle = '#5fd38a';
    g.fillText('READY', x + 220, y + 54);
  }
  const rx = x + w - 104;
  rr(rx, y + 46, 90, 16, 8);
  if (f.riposteT > 0) {
    g.shadowColor = '#ffd76a';
    g.shadowBlur = 14;
    g.fillStyle = '#ffd76a';
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = '#1a1405';
    g.textAlign = 'center';
    g.font = font(10, 900);
    g.fillText('RIPOSTE!', rx + 45, y + 54);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillRect(rx + 8, y + 59, 74 * (1 - f.riposteT / CFG.riposte), 2);
  } else {
    g.strokeStyle = 'rgba(255,215,106,.25)';
    g.stroke();
    g.fillStyle = 'rgba(255,215,106,.3)';
    g.textAlign = 'center';
    g.font = font(10, 800);
    g.fillText('RIPOSTE', rx + 45, y + 54);
  }
}
function distMeter(m) {
  const x = W / 2 - 200,
    y = 650,
    w = 400,
    d = m.dist(),
    mx = 5,
    me = m.f[0];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(11, 700);
  g.fillStyle = 'rgba(170,190,220,.75)';
  g.fillText('DISTANCE', W / 2 - 60, y - 4);
  g.font = font(15, 800);
  g.fillStyle = '#fff';
  g.fillText(d.toFixed(2) + ' m', W / 2 + 18, y - 4);
  const tr = clamp(m.effReach(me, me.weapon === 'sabre' ? 'cut' : 'thrust', me.zone), 0, mx),
    lr_ = clamp(m.effReach(me, 'lunge', me.zone), tr, mx),
    ar = clamp(m.effReach(me, 'adv', me.zone), lr_, mx);
  const zs = [
    [0, tr, 'rgba(255,180,70,.55)', 'THRUST'],
    [tr, lr_, 'rgba(90,210,130,.6)', 'LUNGE'],
    [lr_, ar, 'rgba(160,140,255,.45)', 'ADV-LUNGE'],
    [ar, mx, 'rgba(150,165,190,.22)', 'OUT']
  ];
  for (const z of zs) {
    const a = x + (w * z[0]) / mx,
      b = x + (w * z[1]) / mx;
    g.fillStyle = z[2];
    g.fillRect(a, y + 16, b - a, 10);
    g.fillStyle = 'rgba(220,230,245,.6)';
    g.font = font(9, 700);
    if (b - a > 36) g.fillText(z[3], (a + b) / 2, y + 38);
  }
  const px = x + w * clamp(d / mx, 0, 1);
  g.fillStyle = '#fff';
  g.beginPath();
  g.moveTo(px, y + 14);
  g.lineTo(px - 6, y + 6);
  g.lineTo(px + 6, y + 6);
  g.fill();
  g.fillRect(px - 1, y + 14, 2, 14);
  g.font = font(10, 600);
  g.fillStyle = 'rgba(170,190,220,.5)';
  g.fillText('ESC pause · R replay last touch · M sound', W / 2, y + 54);
}
function wrap(txt, x, y, maxW, lh) {
  const ws = txt.split(' ');
  let l = '';
  for (const w of ws) {
    const t = l ? l + ' ' + w : w;
    if (g.measureText(t).width > maxW && l) {
      g.fillText(l, x, y);
      y += lh;
      l = w;
    } else l = t;
  }
  if (l) g.fillText(l, x, y);
  return y + lh;
}
function drawHUD(m) {
  const f = m.f,
    o = m.o,
    s = m.score;
  const x0 = W / 2 - 290,
    y0 = 12,
    w = 580,
    h = 86;
  rr(x0, y0, w, h, 14);
  let gr = g.createLinearGradient(0, y0, 0, y0 + h);
  gr.addColorStop(0, '#0e1729');
  gr.addColorStop(1, '#070b14');
  g.fillStyle = gr;
  g.fill();
  g.strokeStyle = 'rgba(150,180,230,.2)';
  g.lineWidth = 1;
  g.stroke();
  g.fillStyle = 'rgba(59,140,255,.15)';
  rr(x0 + 6, y0 + 6, 206, h - 12, 10);
  g.fill();
  g.fillStyle = 'rgba(255,74,74,.15)';
  rr(x0 + w - 212, y0 + 6, 206, h - 12, 10);
  g.fill();
  g.textBaseline = 'middle';
  g.font = font(12, 800);
  g.textAlign = 'left';
  g.fillStyle = '#a8c8ff';
  g.fillText(f[0].name.slice(0, 24), x0 + 20, y0 + 22);
  g.textAlign = 'right';
  g.fillStyle = '#ffb3b3';
  g.fillText(f[1].name.slice(0, 24), x0 + w - 20, y0 + 22);
  for (let i = 0; i < 2; i++) {
    const sc = 1 + m.pulse[i] * 0.35;
    g.save();
    g.translate(i ? x0 + w - 66 : x0 + 66, y0 + 56);
    g.scale(sc, sc);
    g.font = font(42, 800);
    g.textAlign = 'center';
    g.shadowColor = `rgba(${f[i].light},${0.4 + m.pulse[i]})`;
    g.shadowBlur = 12 + 20 * m.pulse[i];
    g.fillStyle = m.pulse[i] > 0.5 ? `rgb(${f[i].light})` : '#ffffff';
    g.fillText(pad2(s[i]), 0, 2);
    g.restore();
  }
  g.shadowBlur = 0;
  lamp(x0 + 160, y0 + 58, m.lights[0], f[0].light, m.white[0]);
  lamp(x0 + w - 160, y0 + 58, m.lights[1], f[1].light, m.white[1]);
  if (m.overtime && m.priority >= 0) {
    const px = m.priority ? x0 + w - 160 : x0 + 160;
    g.fillStyle = '#ffd76a';
    g.font = font(10, 900);
    g.textAlign = 'center';
    g.fillText('PRIORITY', px, y0 + 38);
  }
  g.textAlign = 'center';
  g.font = font(30, 800);
  g.fillStyle = o.periodLen && m.clock < 10 && m.state === 'fencing' ? '#ff6b5a' : '#f4f7ff';
  g.fillText(o.periodLen ? fmtClock(m.clock) : '∞', W / 2, y0 + 36);
  g.font = font(10, 800);
  g.fillStyle = 'rgba(190,205,230,.8)';
  g.fillText(
    m.overtime
      ? 'PRIORITY MINUTE'
      : o.periods > 1
        ? `PERIOD ${m.period} / ${o.periods}`
        : o.puzzle
          ? 'PUZZLE'
          : o.training
            ? 'TRAINING'
            : o.sandbox
              ? 'SANDBOX'
              : 'BOUT',
    W / 2,
    y0 + 60
  );
  g.fillStyle = '#ffd76a';
  g.fillText(
    m.rules.name.toUpperCase() + (isFinite(o.target) ? ' · FIRST TO ' + o.target : ''),
    W / 2,
    y0 + 74
  );
  g.font = font(12, 700);
  g.fillStyle = 'rgba(205,218,240,.85)';
  g.fillText(m.statusText().slice(0, 110), W / 2, y0 + h + 15);
  if (o.round) {
    g.font = font(11, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(o.round, W / 2, y0 + h + 32);
  }
  if (m.ref && (m.state === 'touch' || m.state === 'result' || m.state === 'halt')) {
    g.font = font(13, 800);
    g.fillStyle = '#ffffff';
    rr(W / 2 - 160, y0 + h + 40, 320, 24, 12);
    g.fillStyle = 'rgba(0,0,0,.55)';
    g.fill();
    g.fillStyle = '#fff';
    g.fillText(m.ref, W / 2, y0 + h + 52);
  }
  fencerPanel(16, 640, f[0], m);
  fencerPanel(W - 416, 640, f[1], m);
  distMeter(m);
  if (o.training) {
    const x = 16,
      y = 118;
    rr(x, y, 330, 186, 12);
    g.fillStyle = 'rgba(8,12,22,.8)';
    g.fill();
    g.strokeStyle = 'rgba(150,180,230,.16)';
    g.stroke();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = font(10, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(`DRILL ${m.drill + 1} / ${DRILLS.length}`, x + 16, y + 24);
    g.font = font(17, 800);
    g.fillStyle = '#fff';
    g.fillText(DRILLS[m.drill].name, x + 16, y + 46);
    g.font = font(13, 500);
    g.fillStyle = '#cdd8ea';
    let yy = wrap(DRILLS[m.drill].desc, x + 16, y + 68, 298, 18);
    const c1 = m.c[1];
    if (c1.kind === 'ai') {
      g.fillStyle = '#9fc4ff';
      g.fillText('AI goal: ' + c1.mode, x + 16, yy + 2);
    }
    g.font = font(11, 700);
    g.fillStyle = 'rgba(170,190,220,.75)';
    g.fillText('T next drill · Backspace reset · ESC menu', x + 16, y + 174);
  }
  if (o.puzzle) {
    const x = 16,
      y = 118;
    rr(x, y, 340, 150, 12);
    g.fillStyle = 'rgba(8,12,22,.82)';
    g.fill();
    g.strokeStyle = 'rgba(255,215,106,.3)';
    g.stroke();
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = font(10, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(`PUZZLE ${G.pz.i + 1} · ATTEMPT ${G.pz.att}`, x + 16, y + 24);
    g.font = font(17, 800);
    g.fillStyle = '#fff';
    g.fillText(o.puzzle.name, x + 16, y + 46);
    g.font = font(13, 500);
    g.fillStyle = '#cdd8ea';
    const yy = wrap(o.puzzle.goal, x + 16, y + 68, 308, 18);
    g.font = font(11, 700);
    g.fillStyle = 'rgba(170,190,220,.75)';
    g.fillText('Backspace restart · H hint · ESC menu', x + 16, y + 138);
    if (G.pz.hint) {
      rr(x, y + 156, 340, 58, 12);
      g.fillStyle = 'rgba(8,12,22,.82)';
      g.fill();
      g.fillStyle = '#bfe3ff';
      g.font = font(12, 500);
      wrap(o.puzzle.hint, x + 16, y + 176, 308, 17);
    }
  }
  if (o.sandbox) drawDebugHUD(m);
}
function drawDebugHUD(m) {
  const D = G.dbg,
    x = W - 356,
    y = 118;
  let yy = y;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  rr(x, y, 340, D.aist || D.aiprob || D.phases ? 300 : 70, 12);
  g.fillStyle = 'rgba(8,12,22,.85)';
  g.fill();
  g.strokeStyle = 'rgba(150,180,230,.2)';
  g.stroke();
  g.font = font(10, 800);
  g.fillStyle = '#ffd76a';
  g.fillText('SANDBOX · 1–8 overlays · [ ] speed ' + G.speed + '×', x + 14, (yy += 22));
  g.font = font(10, 600);
  g.fillStyle = '#9fb3d4';
  const ol = [
    '1 geometry',
    '2 zones',
    '3 phases',
    '4 parry',
    '5 range',
    '6 AI state',
    '7 AI probs',
    '8 vulnerability'
  ].map((t, i) => (Object.values(D)[i] ? '● ' : '○ ') + t);
  g.fillText(ol.slice(0, 4).join('   '), x + 14, (yy += 16));
  g.fillText(ol.slice(4).join('   '), x + 14, (yy += 14));
  if (D.geom && m.dbgBlade != null) {
    g.fillStyle = '#dfe8f7';
    g.fillText(
      'Blade separation: ' +
        (m.dbgBlade * 100).toFixed(1) +
        ' cm · contact < ' +
        (CFG.contact * 100).toFixed(1) +
        ' cm',
      x + 14,
      (yy += 16)
    );
  }
  if (D.phases)
    for (const f of m.f) {
      const L = f.legs,
        A = f.arm;
      g.fillStyle = f.i ? '#ffb3b3' : '#a8c8ff';
      g.fillText(
        `${f.color}: arm ${A.type}${A.phase ? '/' + A.phase : ''} ${A.t.toFixed(2)}s · legs ${L.type}${L.phase ? '/' + L.phase : ''} · ${f.balance}`,
        x + 14,
        (yy += 16)
      );
    }
  const ai = m.c[1];
  if (ai.kind === 'ai' || ai.kind === 'ghost') {
    if (D.aist) {
      g.fillStyle = '#ffd76a';
      g.fillText(
        `AI goal: ${ai.goal || ai.mode} · target dist ${(ai.tgt || 0).toFixed(2)} m${ai.style ? ' · style ' + ai.style : ''}`,
        x + 14,
        (yy += 18)
      );
      const U = ai.goalU || {};
      const mx = Math.max(0.01, ...Object.values(U));
      for (const k in U) {
        g.fillStyle = 'rgba(255,255,255,.08)';
        g.fillRect(x + 110, yy + 6, 200, 8);
        g.fillStyle = k === ai.goal ? '#ffd76a' : '#6f8fbf';
        g.fillRect(x + 110, yy + 6, (200 * U[k]) / mx, 8);
        g.fillStyle = '#cdd8ea';
        g.fillText(k, x + 14, (yy += 13));
      }
    }
    if (D.aiprob && ai.pred) {
      const Dd = ai.pred.dist();
      g.fillStyle = '#ffd76a';
      g.fillText(
        `Prediction of your next action (conf ${(ai.pred.confidence() * 100) | 0}%, low-line ${(ai.pred.lowRate() * 100) | 0}%)`,
        x + 14,
        (yy += 18)
      );
      let xx = x + 14;
      for (const k of TOKS) {
        const v = Dd[k];
        g.fillStyle = 'rgba(255,255,255,.08)';
        g.fillRect(xx, yy + 6, 30, 30);
        g.fillStyle = '#5fd38a';
        g.fillRect(xx, yy + 36 - 30 * v, 30, 30 * v);
        g.fillStyle = '#cdd8ea';
        g.fillText(k, xx + 11, yy + 50);
        xx += 38;
      }
      yy += 50;
    }
  }
}
function bigText(t, sub, col = '#fff', a = 1) {
  g.globalAlpha = a;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = 'italic ' + font(64, 900);
  g.lineWidth = 8;
  g.strokeStyle = 'rgba(0,0,0,.55)';
  g.strokeText(t, W / 2, 232);
  g.shadowColor = col;
  g.shadowBlur = 24;
  g.fillStyle = col;
  g.fillText(t, W / 2, 232);
  g.shadowBlur = 0;
  if (sub) {
    g.font = font(20, 700);
    g.lineWidth = 5;
    g.strokeText(sub, W / 2, 286);
    g.fillStyle = '#e8eefc';
    g.fillText(sub, W / 2, 286);
  }
  g.globalAlpha = 1;
}
function drawOverlay(m) {
  const o = m.o,
    st = m.st;
  if (m.state === 'intro') {
    dim(0.35);
    const k = clamp(st / 0.6, 0, 1);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(16, 800);
    g.fillStyle = '#e3b94a';
    g.fillText((o.introTitle || 'FINAL').toUpperCase(), W / 2, 170);
    for (let i = 0; i < 2; i++) {
      const x = i ? W / 2 + 240 + (1 - k) * 400 : W / 2 - 240 - (1 - k) * 400;
      g.font = 'italic ' + font(40, 900);
      g.fillStyle = `rgb(${m.f[i].light})`;
      g.fillText(m.f[i].name.split('·').pop().trim(), x, 250);
      g.font = font(15, 700);
      g.fillStyle = '#dfe8f7';
      g.fillText(o.introSub ? o.introSub[i] : '', x, 290);
    }
    g.font = 'italic ' + font(30, 900);
    g.fillStyle = '#fff';
    g.fillText('VS', W / 2, 250);
    g.font = font(12, 600);
    g.fillStyle = 'rgba(200,215,240,.7)';
    g.fillText('Enter to skip', W / 2, 340);
    return;
  }
  if (m.state === 'countdown') {
    const EG = o.training || o.sandbox ? 0.3 : 0.75;
    bigText(st < EG ? 'EN GARDE' : 'PRÊTS ?', null, '#ffffff');
  } else if (m.state === 'fencing' && m.allezT < 0.6) bigText('ALLEZ !', null, '#ffe27a', 1 - m.allezT / 0.6);
  else if (m.state === 'touch' || m.state === 'result' || m.state === 'halt') {
    const col =
      m.msg === 'TOUCHÉ'
        ? `rgb(${m.f[m.lights[0] ? 0 : 1].light})`
        : m.msg === 'DOUBLE TOUCH'
          ? '#ffd76a'
          : '#ffffff';
    bigText(m.msg, m.sub.length > 70 ? m.sub.slice(0, 70) + '…' : m.sub, col);
    if (m.replays.length && !o.demo) {
      g.font = font(13, 700);
      g.fillStyle = 'rgba(220,230,245,.8)';
      g.fillText('Press R to watch the replay', W / 2, 322);
    }
  } else if (m.state === 'priority') {
    const spin = st < 1.6;
    const who = spin ? Math.floor(st * 12) % 2 : m.priority;
    bigText(
      'PRIORITY MINUTE',
      spin
        ? 'Drawing priority…'
        : `Priority to ${m.f[m.priority].color} — a draw at time goes to ${m.f[m.priority].color}`,
      '#ffd76a'
    );
    g.beginPath();
    g.arc(W / 2, 350, 26 * (spin ? Math.abs(Math.cos(st * 9)) : 1), 0, TAU);
    g.fillStyle = `rgb(${m.f[who].light})`;
    g.fill();
  } else if (m.state === 'break')
    bigText(
      'ONE-MINUTE BREAK',
      `Period ${m.period + 1} starts in ${fmtClock(m.breakT)} · Enter to skip`,
      '#9fc4ff'
    );
  else if (m.state === 'victory') {
    const w = m.f[m.winner];
    bigText(w.color + ' WINS', m.winBy + ' · ' + m.score[0] + '–' + m.score[1], `rgb(${w.light})`);
  } else if (m.state === 'puzzleEnd') {
    const r = m.puzzleRes;
    bigText(r.ok ? 'SOLVED' : 'NOT YET', r.msg, r.ok ? '#5fd38a' : '#ff8a7a');
    g.font = font(14, 700);
    g.fillStyle = '#dfe8f7';
    g.fillText(
      r.ok
        ? 'Enter: next puzzle · Backspace: retry · R: replay · Esc: puzzle list'
        : 'Backspace or Enter: retry instantly · H: hint · R: replay · Esc: puzzle list',
      W / 2,
      330
    );
    if (r.ok && G.pz.stars) {
      g.font = font(30, 900);
      g.fillStyle = '#ffd76a';
      g.fillText('★'.repeat(G.pz.stars) + '☆'.repeat(3 - G.pz.stars), W / 2, 375);
    }
  }
}
/* ---------- replay viewer ---------- */
function rvFencer(rep, idx, i) {
  const fr = rep.frames[idx].f[i],
    a = fr.J,
    J = {};
  JKEYS.forEach((k, j) => (J[k] = P(a[j * 2], a[j * 2 + 1])));
  J.blade = [J.guardC, P(a[32], a[33]), P(a[34], a[35]), J.tip];
  const trail = [];
  for (let k = Math.max(0, idx - 7); k < idx; k++) {
    const q = rep.frames[k].f[i].J,
      q2 = rep.frames[k + 1].f[i].J;
    if (Math.hypot(q2[20] - q[20], q2[21] - q[21]) > 0.035) trail.push(P(q[20], q[21]));
  }
  const cos = rep.looks[i];
  return {
    J,
    d: fr.d,
    side: fr.side,
    bend: fr.bend,
    flex: fr.flex,
    glintT: fr.glintT,
    trail,
    weapon: rep.weapon,
    cos,
    trim: cos.trim,
    i,
    label: fr.label,
    bal: fr.bal,
    parry: fr.parry,
    atk: fr.atk,
    back() {
      return CFG.half + this.d * this.J.hip.x;
    }
  };
}
function drawReplay() {
  const R = G.rv,
    rep = R.rep,
    m = R.m,
    n = rep.frames.length,
    idx = clamp(Math.floor(R.i), 0, n - 1),
    fr = rep.frames[idx];
  const fs_ = [rvFencer(rep, idx, 0), rvFencer(rep, idx, 1)];
  const mid = (fs_[0].J.hip.x + fs_[1].J.hip.x) / 2,
    sep = Math.abs(fs_[1].J.hip.x - fs_[0].J.hip.x);
  const tz = clamp(W / (Math.max(5.2, sep + 3) * PPM), 1.6, 2.8);
  R.cam = R.cam || { x: mid, z: tz };
  R.cam.x += (mid - R.cam.x) * 0.12;
  R.cam.z += (tz - R.cam.z) * 0.08;
  const pseudo = {
    arena: m.arena,
    time: fr.t,
    cam: R.cam,
    score: m.score,
    o: m.o,
    weapon: rep.weapon,
    clock: m.clock,
    parts: [],
    camFlash: []
  };
  drawScene(pseudo, fs_, R.cam, {
    glints: fr.gl,
    over: () => {
      if (R.traj) {
        for (let i = 0; i < 2; i++) {
          g.strokeStyle = i ? 'rgba(255,120,120,0.75)' : 'rgba(120,170,255,0.75)';
          g.lineWidth = 0.008;
          g.beginPath();
          let st = false;
          for (let k = Math.max(0, idx - 90); k <= idx; k++) {
            const q = rep.frames[k].f[i].J;
            if (!st) {
              g.moveTo(q[20], q[21]);
              st = true;
            } else g.lineTo(q[20], q[21]);
          }
          g.stroke();
        }
      }
      for (const h of rep.hits) {
        if (fr.t >= h.t - 1e-6) {
          const k = (Math.sin(G.t * 10) + 1) / 2;
          g.strokeStyle = h.valid ? `rgba(255,230,90,${0.6 + 0.4 * k})` : 'rgba(255,255,255,0.8)';
          g.lineWidth = 0.012;
          g.beginPath();
          g.arc(h.pt.x, h.pt.y, 0.05 + 0.03 * k, 0, TAU);
          g.stroke();
          g.beginPath();
          g.arc(h.pt.x, h.pt.y, 0.012, 0, TAU);
          g.fillStyle = '#fff';
          g.fill();
        }
      }
    }
  });
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const stack = [0, 0];
  for (const mk of rep.marks) {
    if (Math.abs(fr.t - mk.t) < 0.35 && mk.who >= 0) {
      const f = fs_[mk.who],
        p = toScreen(R.cam, f.J.head.x, f.J.head.y - 0.35);
      p.y -= 22 * stack[mk.who]++;
      g.font = font(15, 800);
      g.lineWidth = 4;
      g.strokeStyle = 'rgba(0,0,0,.6)';
      g.strokeText(mk.txt, p.x, p.y);
      g.fillStyle =
        mk.kind === 'parrystart' || mk.kind === 'parry'
          ? '#ffe08a'
          : mk.kind === 'hit'
            ? '#ffffff'
            : '#bfe3ff';
      g.fillText(mk.txt, p.x, p.y);
    }
  }
  g.fillStyle = 'rgba(0,0,0,.35)';
  g.fillRect(0, 0, W, 6);
  rr(W / 2 - 300, 14, 600, 58, 12);
  g.fillStyle = 'rgba(8,12,22,.85)';
  g.fill();
  g.font = 'italic ' + font(20, 900);
  g.fillStyle = '#ffd76a';
  g.fillText('INSTANT REPLAY', W / 2, 34);
  g.font = font(13, 600);
  g.fillStyle = '#dfe8f7';
  const hit0 = rep.hits.length ? rep.hits[0].t : fr.t;
  g.fillText(
    `${rep.label}${rep.delta != null ? ` · lights ${Math.round(rep.delta * 1000)} ms apart` : ''} · ${((fr.t - hit0) * 1000).toFixed(0)} ms from first contact`,
    W / 2,
    56
  );
  for (let i = 0; i < 2; i++) {
    const x = i ? W - 216 : 16;
    rr(x, 586, 200, 46, 10);
    g.fillStyle = 'rgba(8,12,22,.8)';
    g.fill();
    g.textAlign = 'left';
    g.font = font(11, 800);
    g.fillStyle = i ? '#ffb3b3' : '#a8c8ff';
    g.fillText(i ? 'RED' : 'BLUE', x + 12, 602);
    g.font = font(12, 600);
    g.fillStyle = '#ffd99a';
    g.fillText(cap1(fs_[i].label), x + 12, 620);
  }
  const bx = 160,
    bw = W - 320,
    by = 650;
  rr(bx, by, bw, 10, 5);
  g.fillStyle = 'rgba(255,255,255,.12)';
  g.fill();
  for (const mk of rep.marks) {
    const k = (mk.t - rep.frames[0].t) / (rep.frames[n - 1].t - rep.frames[0].t || 1);
    if (k < 0 || k > 1) continue;
    g.fillStyle =
      mk.kind === 'hit' ? '#ffd76a' : mk.kind === 'parry' || mk.kind === 'parrystart' ? '#ffe08a' : '#7fb4ff';
    g.fillRect(bx + bw * k - 1, by - 4, 2, 18);
  }
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(bx + (bw * idx) / (n - 1), by + 5, 7, 0, TAU);
  g.fill();
  g.textAlign = 'center';
  g.font = font(12, 700);
  g.fillStyle = '#dfe8f7';
  g.fillText(
    `${R.playing ? '▶' : '❚❚'}  frame ${idx + 1}/${n}  ·  ${R.speed}×  ·  Space play/pause · ← → step · ↑ ↓ speed · T trajectories ${R.traj ? 'on' : 'off'} · Esc back`,
    W / 2,
    by + 30
  );
}

/* ================= SCREENS & MENUS ================= */
const G = {
  screen: 'title',
  idx: 0,
  pidx: 0,
  ridx: 0,
  bidx: 0,
  sidx: 0,
  cidx: 0,
  kidx: 0,
  gidx: 0,
  zidx: 0,
  hidx: 0,
  nidx: 0,
  match: null,
  demo: null,
  paused: false,
  rects: [],
  mouse: P(-1, -1),
  mouseIn: false,
  t: 0,
  tour: null,
  speed: 1,
  simAcc: 0,
  dbg: {
    geom: false,
    zones: false,
    phases: true,
    parry: true,
    range: false,
    aist: true,
    aiprob: false,
    vuln: false
  },
  rv: null,
  res: null,
  confirm: null,
  toast: null,
  capture: null,
  edit: null,
  modal: null,
  howPage: 0,
  pz: { i: 0, att: 0, hint: false },
  sb: {
    aggr: 50,
    react: 250,
    def: 'parry',
    pref: 'mixed',
    dist: 4.8,
    s0: 0,
    s1: 0,
    time: 0,
    blade: 1,
    speed: 1,
    fatigue: false,
    respawn: 'reset',
    pers: 'balanced'
  },
  draft: null,
  lastType: 'quick'
};
function toast(t) {
  G.toast = { t, time: 3 };
}
function dim(a = 0.6) {
  g.fillStyle = `rgba(3,5,10,${a})`;
  g.fillRect(0, 0, W, H);
}
function panel(x, y, w, h, a = 0.92) {
  rr(x, y, w, h, 16);
  g.fillStyle = `rgba(9,14,26,${a})`;
  g.fill();
  g.strokeStyle = 'rgba(150,180,230,.22)';
  g.lineWidth = 1;
  g.stroke();
}
function title(t, sub, x = 64, y = 78) {
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(34, 900);
  g.fillStyle = '#fff';
  g.fillText(t, x, y);
  if (sub) {
    g.font = font(14, 500);
    g.fillStyle = '#b9c7de';
    g.fillText(sub, x, y + 26);
  }
}
const lbl = it => (typeof it.l === 'function' ? it.l() : it.l);
function drawMenu(items, key, x, y, w, ih, sub) {
  const sel = G[key];
  items.forEach((it, i) => {
    const yy = y + i * ih,
      on = i === sel;
    G.rects.push({ x, y: yy, w, h: ih - 6, i, key, items });
    rr(x, yy, w, ih - 6, 10);
    g.fillStyle = on ? 'rgba(59,140,255,.22)' : 'rgba(255,255,255,.035)';
    g.fill();
    if (on) {
      g.strokeStyle = 'rgba(120,175,255,.7)';
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = '#3b8cff';
      rr(x, yy + 8, 4, ih - 22, 2);
      g.fill();
    }
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = font(ih > 46 ? 18 : 16, on ? 800 : 600);
    g.fillStyle = it.dis ? 'rgba(200,210,230,.35)' : on ? '#ffffff' : '#c9d4e6';
    g.fillText(lbl(it), x + 20, yy + (sub && it.s ? (ih - 6) / 2 - 8 : (ih - 6) / 2));
    if (it.v) {
      g.textAlign = 'right';
      g.font = font(15, 700);
      g.fillStyle = on ? '#ffd76a' : '#9fb3d4';
      g.fillText((it.lr ? '‹ ' : '') + it.v() + (it.lr ? ' ›' : ''), x + w - 18, yy + (ih - 6) / 2);
    }
    if (sub && it.s) {
      g.textAlign = 'left';
      g.font = font(12, 500);
      g.fillStyle = on ? '#a9c6f5' : 'rgba(170,185,210,.6)';
      g.fillText(typeof it.s === 'function' ? it.s() : it.s, x + 20, yy + (ih - 6) / 2 + 12);
    }
  });
}
function menuKey(code, items, key) {
  const n = items.length;
  if (!n) return;
  const it = items[G[key]] || items[0];
  if (code === 'ArrowUp' || code === 'KeyW') {
    G[key] = (G[key] + n - 1) % n;
    Snd.beep(660, 0.04, 0.04);
  } else if (code === 'ArrowDown' || code === 'KeyS') {
    G[key] = (G[key] + 1) % n;
    Snd.beep(660, 0.04, 0.04);
  } else if ((code === 'ArrowLeft' || code === 'KeyA') && it.lr) {
    it.lr(-1);
    Snd.beep(760, 0.04, 0.04);
  } else if ((code === 'ArrowRight' || code === 'KeyD') && it.lr) {
    it.lr(1);
    Snd.beep(760, 0.04, 0.04);
  } else if (code === 'Enter' || code === 'Space' || code === 'NumpadEnter' || code === 'KeyJ') {
    if (it.dis) return;
    Snd.beep(990, 0.06, 0.06);
    if (it.f) it.f();
    else if (it.lr) it.lr(1);
  }
}
const cyc = (arr, cur, d) => arr[(arr.indexOf(cur) + d + arr.length) % arr.length];
/* ---------- title ---------- */
function titleItems() {
  const w = SETTINGS.weapon;
  return [
    {
      l: 'Quick Match',
      s: `${RULES[w].name} · first to 5 · vs ${PERS[SETTINGS.pers].name} (${LV[SETTINGS.diff].name}) · rated`,
      f: () => startMatch('quick')
    },
    {
      l: 'Career',
      s: 'From local club to the Golden Piste · rivals remember you',
      f: () => {
        G.screen = getCareer() ? 'career' : 'careerNew';
        if (G.screen === 'careerNew') G.draft = newDraft();
        G.cidx = 0;
      }
    },
    { l: 'Tournament', s: '8-fencer direct elimination · first to 15 · three periods', f: startTour },
    {
      l: 'Tactical Puzzles',
      s: 'Six reproducible situations with more than one solution',
      f: () => {
        G.screen = 'puzzles';
        G.zidx = 0;
      }
    },
    { l: 'Training', s: 'Five drills with live feedback · no clock', f: () => startMatch('training') },
    {
      l: 'Sandbox',
      s: 'Configure everything · slow motion · debug overlays',
      f: () => {
        G.screen = 'sandbox';
        G.sidx = 0;
      }
    },
    {
      l: 'Ghost Opponents',
      s: 'Fence your own recordings or a behavioural copy of yourself',
      f: () => {
        G.screen = 'ghosts';
        G.gidx = 0;
      }
    },
    {
      l: 'Local Two-Player',
      s: "Blue (WASD + JKLIUO) vs Red (arrows + , . / ' ; ])",
      f: () => startMatch('2p')
    },
    {
      l: 'Offline Ratings',
      s: 'Elo against AI opponents, per weapon',
      f: () => {
        G.screen = 'ratings';
      }
    },
    {
      l: 'Settings',
      s: 'Weapon, arena, opponent, controls, accessibility',
      f: () => {
        G.screen = 'settings';
        G.nidx = 0;
      }
    },
    {
      l: 'How to Play',
      s: 'Controls, techniques and rules for all three weapons',
      f: () => {
        G.screen = 'howto';
        G.howPage = 0;
      }
    }
  ];
}
function drawTitle() {
  const gr = g.createLinearGradient(0, 0, W * 0.6, 0);
  gr.addColorStop(0, 'rgba(3,5,10,.9)');
  gr.addColorStop(1, 'rgba(3,5,10,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, W, H);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = 'italic ' + font(72, 900);
  const tg = g.createLinearGradient(0, 40, 0, 120);
  tg.addColorStop(0, '#ffffff');
  tg.addColorStop(0.55, '#c7d1de');
  tg.addColorStop(1, '#7f8a99');
  g.fillStyle = tg;
  g.shadowColor = 'rgba(80,140,255,.35)';
  g.shadowBlur = 30;
  g.fillText('FENCING', 60, 104);
  g.shadowBlur = 0;
  g.font = font(20, 800);
  g.fillStyle = '#3b8cff';
  g.fillText('DUEL', 64, 136);
  g.fillStyle = '#e8eefc';
  g.fillText(' OF ', 64 + g.measureText('DUEL').width, 136);
  g.fillStyle = '#ff4a4a';
  g.fillText('BLADES', 64 + g.measureText('DUEL OF ').width, 136);
  const tw = g.measureText('DUEL OF BLADES').width;
  g.fillStyle = '#ffd76a';
  g.font = font(12, 800);
  g.fillText('VERSION 2.0', 64 + tw + 16, 136);
  const it = titleItems();
  drawMenu(it, 'idx', 60, 156, 420, 44, false);
  const s = it[G.idx].s;
  g.font = font(13, 500);
  g.fillStyle = '#a9c6f5';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.fillText(typeof s === 'function' ? s() : s, 62, 656);
  g.font = font(12, 500);
  g.fillStyle = 'rgba(170,185,210,.55)';
  g.fillText('↑ ↓ choose · Enter select · M sound · mouse works everywhere', 62, 690);
}
/* ---------- settings ---------- */
function settingsItems() {
  const S_ = SETTINGS,
    sv = () => saveSettings();
  return [
    {
      l: 'Weapon',
      v: () => RULES[S_.weapon].name,
      lr: d => {
        S_.weapon = cyc(['epee', 'foil', 'sabre'], S_.weapon, d);
        sv();
      },
      s: 'Quick Match, Two-Player, Training and Sandbox'
    },
    {
      l: 'Arena',
      v: () => ARENAS[S_.arena].name,
      lr: d => {
        S_.arena = cyc(ARENA_KEYS, S_.arena, d);
        sv();
      },
      s: 'Identical dimensions and rules in every arena'
    },
    {
      l: 'Opponent personality',
      v: () => PERS[S_.pers].name,
      lr: d => {
        S_.pers = cyc(PERS_KEYS, S_.pers, d);
        sv();
      },
      s: () => PERS[S_.pers].desc
    },
    {
      l: 'AI difficulty',
      v: () => LV[S_.diff].name,
      lr: d => {
        S_.diff = (S_.diff + d + 4) % 4;
        sv();
      },
      s: () => LV[S_.diff].desc
    },
    {
      l: 'Simulation: fatigue & balance',
      v: () => (S_.sim ? 'On' : 'Off'),
      lr: () => {
        S_.sim = !S_.sim;
        sv();
      },
      s: 'Off for rated play unless you choose it; never causes input failures'
    },
    {
      l: 'Mouse aiming',
      v: () => (S_.mouseAim ? 'On' : 'Off'),
      lr: () => {
        S_.mouseAim = !S_.mouseAim;
        sv();
      },
      s: 'Mouse height sets the desired aim; the blade follows at a limited rate'
    },
    {
      l: 'Automatic replays',
      v: () => (S_.autoReplay ? 'On' : 'Off'),
      lr: () => {
        S_.autoReplay = !S_.autoReplay;
        sv();
      },
      s: 'Slow-motion replay after each touch (R always works)'
    },
    {
      l: 'Referee voice',
      v: () => (S_.voice ? 'On' : 'Off'),
      lr: () => {
        S_.voice = !S_.voice;
        sv();
      },
      s: 'Spoken En garde / Prêts / Allez / Halte when the browser supports speech'
    },
    { l: 'Sound', v: () => (Snd.on ? 'On' : 'Off'), lr: () => Snd.setOn(!Snd.on) },
    {
      l: 'Controls…',
      f: () => {
        G.screen = 'controls';
        G.kidx = 0;
      },
      s: 'Remap keys for both players'
    },
    {
      l: 'Reset learned opponent behaviour',
      f: () => {
        G.confirm = {
          text: 'Forget everything career opponents have learned about you?',
          yes: () => {
            const c = getCareer();
            if (c) {
              c.memory = {};
              saveCareer(c);
            }
            Store.del('profile');
            toast('Opponent memory and your behaviour profile were reset.');
          }
        };
      },
      s: 'Career opponents and behavioural profile'
    },
    {
      l: 'Reset all saved data',
      f: () => {
        G.confirm = {
          text: 'Delete career, ratings, ghosts, puzzle progress, settings and key bindings?',
          yes: () => {
            for (const k of [
              'career',
              'ratings',
              'ghosts',
              'profile',
              'puzzles',
              'settings',
              'keys',
              'lastRec'
            ])
              Store.del(k);
            resetKeys();
            toast('All saved data deleted.');
          }
        };
      }
    },
    { l: 'Back', f: toTitle }
  ];
}
function drawSettings() {
  dim(0.78);
  title('Settings', 'Saved in this browser' + (Store.ok ? '' : ' (storage unavailable — this session only)'));
  drawMenu(settingsItems(), 'nidx', 64, 130, 640, 40, false);
  const it = settingsItems()[G.nidx];
  if (it.s) {
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = font(14, 500);
    g.fillStyle = '#a9c6f5';
    wrap(typeof it.s === 'function' ? it.s() : it.s, 740, 150, 460, 20);
  }
}
/* ---------- controls remap ---------- */
function drawControls() {
  dim(0.82);
  title('Controls', 'Enter to rebind · keys are checked for conflicts · Escape to go back');
  const n = ACTION_LIST.length;
  for (let p = 0; p < 2; p++) {
    const pk = p ? 'p2' : 'p1',
      x = 64 + p * 420;
    g.font = font(13, 800);
    g.textAlign = 'left';
    g.fillStyle = p ? '#ff9a9a' : '#8fb5ff';
    g.fillText(p ? 'RED — PLAYER 2' : 'BLUE — PLAYER 1', x, 140);
    ACTION_LIST.forEach((a, i) => {
      const k = p * n + i,
        on = G.kidx === k,
        y = 152 + i * 36;
      G.rects.push({ x, y, w: 380, h: 32, i: k, key: 'kidx', items: null });
      rr(x, y, 380, 32, 8);
      g.fillStyle = on ? 'rgba(59,140,255,.25)' : 'rgba(255,255,255,.04)';
      g.fill();
      g.textBaseline = 'middle';
      g.font = font(14, 600);
      g.fillStyle = '#dfe8f7';
      g.fillText(ACTION_NAME[a], x + 14, y + 16);
      g.textAlign = 'right';
      g.fillStyle = G.capture && G.capture.p === pk && G.capture.a === a ? '#ffd76a' : '#ffd99a';
      g.fillText(
        G.capture && G.capture.p === pk && G.capture.a === a
          ? 'press a key…'
          : KEYS[pk][a].map(keyLabel).join(' / '),
        x + 366,
        y + 16
      );
      g.textAlign = 'left';
    });
  }
  const extra = [
    [
      'Reset to defaults',
      () => {
        resetKeys();
        toast('Default keys restored.');
      }
    ],
    [
      'Back',
      () => {
        G.screen = 'settings';
      }
    ]
  ];
  extra.forEach((e, i) => {
    const k = 2 * n + i,
      on = G.kidx === k,
      x = 920,
      y = 152 + i * 44;
    G.rects.push({ x, y, w: 280, h: 38, i: k, key: 'kidx', items: null });
    rr(x, y, 280, 38, 10);
    g.fillStyle = on ? 'rgba(59,140,255,.25)' : 'rgba(255,255,255,.05)';
    g.fill();
    g.textBaseline = 'middle';
    g.font = font(15, 700);
    g.fillStyle = '#fff';
    g.fillText(e[0], x + 16, y + 19);
  });
  g.font = font(13, 500);
  g.fillStyle = '#b9c7de';
  g.textBaseline = 'alphabetic';
  let y = 270;
  for (const t of [
    'Reserved: Esc pause · R replay · M sound · Backspace restart · T training drill.',
    'Contextual actions need no extra keys: advance + lunge, feint → disengage → lunge, beat → lunge, retreat + thrust, thrust → thrust (remise), parry → thrust (riposte).',
    'Aim: hold W (upper torso), double-tap W (head), nothing (weapon arm), S (lower torso), double-tap S (thigh), W+S (foot). Hold J to keep a point in line.'
  ])
    y = wrap(t, 920, y, 300, 19) + 10;
}
function controlsAct(k) {
  const n = ACTION_LIST.length;
  if (k >= 2 * n) {
    [
      () => {
        resetKeys();
        toast('Default keys restored.');
      },
      () => {
        G.screen = 'settings';
      }
    ][k - 2 * n]();
    return;
  }
  G.capture = { p: k < n ? 'p1' : 'p2', a: ACTION_LIST[k % n] };
}
/* ---------- how to play ---------- */
const HOW = [
  [
    'Controls',
    [
      ['A / D', 'Retreat / advance — tap for a half-step, hold to keep moving'],
      ['Shift', 'Fast footwork'],
      ['W / S', 'High / low guard and aim (double-tap: head / thigh, both: foot)'],
      ['J', 'Thrust (cut in sabre) — hold for a point in line'],
      ['K', 'Lunge — during the last 40% of an advance: advance-lunge'],
      ['L', 'Parry in your guard line'],
      ['I', 'Disengage'],
      ['U', 'Feint (40% extension, 180 ms branching window)'],
      ['O', 'Blade beat — must physically hit the other blade'],
      ['Space', 'Speed up lunge recovery (cannot cancel the drive)'],
      ['R', 'Replay the last touch'],
      ['Esc', 'Pause']
    ]
  ],
  [
    'Techniques',
    [
      ['Feint', 'U, then J (thrust), K (lunge), I (disengage) or A (withdraw). A feint alone never scores.'],
      [
        'Advance-lunge',
        'D then K late in the advance; with Shift it becomes an explosive patinando with longer recovery.'
      ],
      ['Retreating counter', 'Hold A and press J: fast extension while still moving back.'],
      [
        'Remise',
        'Press J again just after a missed or parried thrust; once only, and risky against a riposte.'
      ],
      [
        'Beat',
        'O strikes the opposing blade; the displacement (120–220 ms) depends on leverage. Follow with K.'
      ],
      ['Engagement', 'Blades resting together for a moment become engaged; beats then become pressure.'],
      ['Distance traps', "The distance meter shows your effective reach; stay just outside the opponent's."],
      [
        'Parries',
        'Real blade contact is required. Strong (near your guard) against weak (near their tip) wins.'
      ]
    ]
  ],
  [
    'Weapons & rules',
    [
      [
        'Épée',
        'Whole body valid, point only, no right-of-way. Lights within 40 ms are a double; doubles at the final touch and in the priority minute are annulled.'
      ],
      [
        'Foil',
        'Point only, torso and bib valid; off-target shows a white light and stops fencing. Right-of-way decides double lights (300 ms lockout).'
      ],
      [
        'Sabre',
        'Cuts and point, everything above the waist except hands. Right-of-way decides double lights (120 ms lockout).'
      ],
      [
        'Right-of-way',
        'The first attack has priority; a parry passes priority to the riposte; an established point in line beats an attack unless beaten aside; simultaneous attacks score nothing.'
      ],
      ['Rear limit', 'Both feet behind your rear line concedes a touch.'],
      ['Fatigue', 'Only in Simulation (Settings) and never more than about 18% slower.']
    ]
  ],
  [
    'Modes',
    [
      ['Quick Match', 'Choose weapon, personality and difficulty in Settings. Rated.'],
      ['Career', 'Seven competition levels, rivals, opponent memory, cosmetic unlocks. Rated.'],
      ['Puzzles', 'Reproducible tactical situations judged by outcome, not inputs.'],
      ['Sandbox', 'Opponent tuning, start state, speed and developer overlays.'],
      [
        'Ghosts',
        'Recorded ghosts replay your inputs; behavioural ghosts fence like you. Export and import as JSON.'
      ],
      [
        'Analysis',
        'After each bout: hit maps, distance success, timeline with replays and a data-driven coach.'
      ]
    ]
  ]
];
function drawHowto() {
  dim(0.85);
  const p = HOW[G.howPage];
  title('How to play — ' + p[0], `Page ${G.howPage + 1} of ${HOW.length} · ← → to turn · Esc to go back`);
  let y = 146;
  for (const r of p[1]) {
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = font(15, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(r[0], 64, y);
    g.font = font(15, 500);
    g.fillStyle = '#dbe4f3';
    y = wrap(r[1], 290, y, 900, 21) + 12;
  }
}
/* ---------- pause ---------- */
function pauseItems() {
  const m = G.match;
  const it = [
    {
      l: 'Resume',
      f: () => {
        G.paused = false;
      }
    }
  ];
  if (m.replays.length)
    it.push({
      l: 'Watch last touch',
      f: () => {
        G.paused = false;
        G.openReplay(m, m.replays.length - 1, false);
      }
    });
  it.push(
    {
      l: 'Restart',
      f: () => {
        if (m.o.puzzle) startPuzzle(G.pz.i);
        else if (m.o.type === 'career') startCareerBout();
        else if (m.o.type === 'tour') startMatch('tour');
        else startMatch(G.lastType);
      }
    },
    {
      l: m.o.type === 'career' ? 'Back to career (forfeits nothing)' : 'Main Menu',
      f: () => {
        if (m.o.type === 'career') {
          G.screen = 'careerBracket';
          G.paused = false;
          G.match = null;
        } else toTitle();
      }
    }
  );
  return it;
}
function drawPause() {
  dim(0.6);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = font(40, 900);
  g.fillStyle = '#fff';
  g.fillText('PAUSED', W / 2, 200);
  drawMenu(pauseItems(), 'pidx', W / 2 - 180, 230, 360, 52, false);
}
/* ---------- results & analysis ---------- */
const TABS = ['Summary', 'Hit maps', 'Distance', 'Timeline', 'Coach'];
function resultItems() {
  const m = G.match,
    o = m.o;
  if (o.type === 'tour') {
    const T = G.tour;
    return T.out || T.champ
      ? [{ l: 'Main Menu', f: toTitle }]
      : [
          {
            l: 'Next round',
            f: () => {
              G.screen = 'bracket';
            }
          },
          { l: 'Main Menu', f: toTitle }
        ];
  }
  if (o.type === 'career')
    return [
      {
        l: 'Continue',
        f: () => {
          const c = getCareer();
          G.screen = c && c.cur && !c.cur.out && !c.cur.champ ? 'careerBracket' : 'career';
          G.cidx = 0;
        }
      }
    ];
  if (o.type === 'ghost')
    return [
      { l: 'Rematch', f: () => startGhost(G.ghostSel) },
      {
        l: 'Ghosts',
        f: () => {
          G.screen = 'ghosts';
        }
      }
    ];
  return [
    { l: 'Rematch', f: () => startMatch(G.lastType) },
    { l: 'Main Menu', f: toTitle }
  ];
}
function drawResults() {
  const R = G.res,
    m = R.m,
    f = m.f;
  dim(0.7);
  const x = 60,
    y = 36,
    w = W - 120,
    h = H - 72;
  panel(x, y, w, h, 0.95);
  const w0 = m.winner;
  let tt = m.o.type === '2p' ? f[w0].color + ' WINS' : w0 === 0 ? 'VICTORY' : 'DEFEAT';
  if (m.o.type === 'tour' && G.tour.champ) tt = 'CHAMPION!';
  if (R.career && R.career.champ) tt = 'CHAMPION!';
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = 'italic ' + font(34, 900);
  g.fillStyle = `rgb(${f[w0].light})`;
  g.fillText(tt, x + 28, y + 50);
  g.font = font(30, 900);
  g.fillStyle = '#fff';
  g.fillText(pad2(m.score[0]) + ' – ' + pad2(m.score[1]), x + 260, y + 50);
  g.font = font(13, 600);
  g.fillStyle = '#b9c7de';
  g.fillText(m.winBy + ' · ' + m.rules.name, x + 420, y + 38);
  if (R.rating)
    g.fillText(
      `Offline AI rating (${m.rules.name}): ${R.rating.rank} ${R.rating.r} (${R.rating.delta >= 0 ? '+' : ''}${R.rating.delta}) — not an online ranking`,
      x + 420,
      y + 56
    );
  else if (R.career) g.fillText(R.career.text, x + 420, y + 56);
  TABS.forEach((t, i) => {
    const tx = x + 28 + i * 150,
      ty = y + 72,
      on = R.tab === i;
    G.rects.push({ x: tx, y: ty, w: 140, h: 32, i, key: 'restab', items: null });
    rr(tx, ty, 140, 32, 8);
    g.fillStyle = on ? 'rgba(59,140,255,.35)' : 'rgba(255,255,255,.05)';
    g.fill();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(14, on ? 800 : 600);
    g.fillStyle = '#fff';
    g.fillText(t, tx + 70, ty + 16);
  });
  g.textAlign = 'right';
  g.font = font(12, 600);
  g.fillStyle = 'rgba(170,185,210,.7)';
  g.fillText('Tab / Q E switch tabs', x + w - 28, y + 90);
  const cx = x + 28,
    cy = y + 124,
    cw = w - 56;
  [drawSummary, drawHitMaps, drawDistance, drawTimeline, drawCoach][R.tab](m, cx, cy, cw);
  const it = resultItems();
  it.forEach((t, i) => {
    const bx = x + w - 28 - (it.length - i) * 200,
      by = y + h - 62,
      on = i === G.ridx;
    G.rects.push({ x: bx, y: by, w: 190, h: 44, i, key: 'ridx', items: it });
    rr(bx, by, 190, 44, 10);
    g.fillStyle = on ? 'rgba(59,140,255,.35)' : 'rgba(255,255,255,.06)';
    g.fill();
    if (on) {
      g.strokeStyle = 'rgba(120,175,255,.8)';
      g.stroke();
    }
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = font(15, on ? 800 : 600);
    g.fillStyle = '#fff';
    g.fillText(t.l, bx + 95, by + 22);
  });
  g.textAlign = 'left';
  g.font = font(12, 500);
  g.fillStyle = 'rgba(170,185,210,.6)';
  g.fillText('← → choose · Enter confirm', x + 28, y + h - 38);
}
function drawSummary(m, x, y, w) {
  const a = [analyze(m, 0), analyze(m, 1)],
    pc = v => Math.round(v * 100) + '%';
  const rows = [
    ['Total attacks', s => s.attacks],
    ['Successful attacks', s => s.landed],
    ['Attack accuracy', s => (s.attacks ? pc(s.acc) : '—')],
    ['Successful parries', s => s.parryOk],
    ['Failed parries', s => s.parryFail],
    ['Successful ripostes', s => `${s.ripOk} / ${s.rips}`],
    ['Counterattack success', s => (s.counters ? `${s.counterOk} / ${s.counters}` : '—')],
    ['Feint success (drew a reaction)', s => (s.feints ? `${s.feintOk} / ${s.feints}` : '—')],
    ['Preferred attack distance', s => (s.attacks ? s.avgDist.toFixed(2) + ' m' : '—')],
    ['Most frequent target', s => (s.topZone ? ZONE_NAME[s.topZone] + ` (${s.topZoneN})` : '—')],
    ['Average attack reaction time', s => (s.avgReact != null ? Math.round(s.avgReact * 1000) + ' ms' : '—')],
    ['Touches conceded while recovering', s => s.recov],
    ['Touches lost at the rear limit', s => s.rear]
  ];
  g.textBaseline = 'middle';
  g.font = font(13, 800);
  g.textAlign = 'center';
  g.fillStyle = '#8fb5ff';
  g.fillText(m.f[0].color, x + 560, y + 4);
  g.fillStyle = '#ff9a9a';
  g.fillText(m.f[1].color, x + 700, y + 4);
  rows.forEach((r, i) => {
    const yy = y + 30 + i * 28;
    if (i % 2) {
      g.fillStyle = 'rgba(255,255,255,.03)';
      g.fillRect(x, yy - 13, 780, 26);
    }
    g.textAlign = 'left';
    g.font = font(14, 500);
    g.fillStyle = '#b9c7de';
    g.fillText(r[0], x + 12, yy);
    g.textAlign = 'center';
    g.font = font(15, 800);
    g.fillStyle = '#fff';
    g.fillText(String(r[1](a[0])), x + 560, yy);
    g.fillText(String(r[1](a[1])), x + 700, yy);
  });
  g.textAlign = 'left';
  g.font = font(12, 500);
  g.fillStyle = 'rgba(170,185,210,.7)';
  wrap(
    "Reaction time is measured from a successful parry to the riposte, and from the opponent's attack to a counterattack. Feints count as successful when the opponent visibly parried or retreated during them.",
    x + 820,
    y + 30,
    330,
    18
  );
}
function silhouette(cx, cy, sc, marks, heat, label, col) {
  const f = new Fencer(1, null);
  f.d = 1;
  f.reset();
  f.computePose(null);
  const k = sc;
  g.save();
  g.setTransform(S * k, 0, 0, S * k, S * cx, S * cy);
  g.translate(-f.J.hip.x, 0);
  const caps = f.caps();
  for (const c of caps) {
    const z = CAP2ZONE[c[3]],
      n = heat[z] || 0,
      mx = Math.max(1, ...Object.values(heat));
    g.strokeStyle = n ? `rgba(${col},${0.15 + (0.75 * n) / mx})` : 'rgba(255,255,255,0.08)';
    g.lineWidth = c[2] * 2;
    g.lineCap = 'round';
    line(c[0], c[1]);
  }
  for (const mk of marks) {
    const p = P(f.J.hip.x + mk.rel.x, mk.rel.y);
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(p.x, p.y, 0.03, 0, TAU);
    g.fill();
    g.strokeStyle = `rgb(${col})`;
    g.lineWidth = 0.012;
    g.stroke();
  }
  g.restore();
  g.setTransform(S, 0, 0, S, 0, 0);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = font(14, 800);
  g.fillStyle = '#fff';
  g.fillText(label, cx, cy + 60);
}
function drawHitMaps(m, x, y, w) {
  const a = analyze(m, 0);
  const heat = t => {
    const h = {};
    for (const z of ZONES) h[z] = 0;
    for (const q of t) h[q.zone]++;
    return h;
  };
  silhouette(
    x + 260,
    y + 330,
    150,
    a.scored,
    heat(a.scored),
    `Touches BLUE landed (${a.scored.length})`,
    '95,211,138'
  );
  silhouette(
    x + 720,
    y + 330,
    150,
    a.conceded,
    heat(a.conceded),
    `Touches BLUE conceded (${a.conceded.length})`,
    '255,110,110'
  );
  g.textAlign = 'left';
  g.font = font(13, 500);
  g.fillStyle = '#b9c7de';
  let yy = y + 20;
  g.font = font(13, 800);
  g.fillStyle = '#fff';
  g.fillText('By region', x + 960, yy);
  yy += 22;
  g.font = font(13, 500);
  for (const z of ZONES) {
    const sN = a.scored.filter(t => t.zone === z).length,
      cN = a.conceded.filter(t => t.zone === z).length;
    g.fillStyle = '#b9c7de';
    g.fillText(ZONE_NAME[z], x + 960, yy);
    g.fillStyle = '#5fd38a';
    g.fillText('+' + sN, x + 1090, yy);
    g.fillStyle = '#ff8a8a';
    g.fillText('−' + cN, x + 1130, yy);
    yy += 22;
  }
  g.fillStyle = 'rgba(170,185,210,.7)';
  g.font = font(12, 500);
  wrap(
    'Dots mark contact points relative to the hips; colour intensity shows how often each region was hit. Off-target lights are excluded.',
    x + 960,
    yy + 16,
    200,
    17
  );
}
function drawDistance(m, x, y, w) {
  const a = analyze(m, 0),
    mx = Math.max(1, ...a.bins.map(b => b.n));
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(14, 800);
  g.fillStyle = '#fff';
  g.fillText('BLUE attacks by starting distance', x, y + 10);
  a.bins.forEach((b, i) => {
    const bx = x + 40 + i * 150,
      base = y + 340,
      hA = (220 * b.n) / mx,
      hH = (220 * b.hit) / mx;
    g.fillStyle = 'rgba(150,165,190,.35)';
    g.fillRect(bx, base - hA, 90, hA);
    g.fillStyle = '#5fd38a';
    g.fillRect(bx, base - hH, 90, hH);
    g.textAlign = 'center';
    g.font = font(13, 700);
    g.fillStyle = '#dfe8f7';
    g.fillText(b.hi > 8 ? `> ${b.lo} m` : `${b.lo}–${b.hi} m`, bx + 45, base + 22);
    g.font = font(13, 800);
    g.fillStyle = b.n ? '#fff' : 'rgba(255,255,255,.4)';
    g.fillText(
      b.n ? `${Math.round((b.hit / b.n) * 100)}% (${b.hit}/${b.n})` : 'no attacks',
      bx + 45,
      base - hA - 10
    );
  });
  const A = m.rec.attacks.filter(q => q.who === 0);
  if (A.length) {
    const r = A.reduce((s, q) => s + q.reach, 0) / A.length;
    g.textAlign = 'left';
    g.font = font(13, 500);
    g.fillStyle = '#b9c7de';
    g.fillText(
      `Your average effective reach at launch was ${r.toFixed(2)} m; attacks launched beyond it usually fall short.`,
      x,
      y + 400
    );
  }
}
function drawTimeline(m, x, y, w) {
  const L = m.log;
  const rows = 13,
    top = clamp(G.res.scroll || 0, 0, Math.max(0, L.length - rows));
  G.res.scroll = top;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  if (!L.length) {
    g.font = font(14, 500);
    g.fillStyle = '#b9c7de';
    g.fillText('No events recorded.', x, y + 20);
    return;
  }
  for (let i = 0; i < rows && top + i < L.length; i++) {
    const e = L[top + i],
      yy = y + 10 + i * 30,
      on = G.res.sel === top + i;
    rr(x, yy - 13, w, 26, 6);
    g.fillStyle = on ? 'rgba(59,140,255,.25)' : i % 2 ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,0)';
    g.fill();
    G.rects.push({ x, y: yy - 13, w, h: 26, i: top + i, key: 'tl', items: null });
    g.font = font(13, 700);
    g.fillStyle = '#ffd76a';
    g.fillText(fmtT(e.t), x + 10, yy);
    g.font = font(13, e.kind === 'touch' ? 800 : 500);
    g.fillStyle = e.who === 0 ? '#a8c8ff' : e.who === 1 ? '#ffb3b3' : '#e8eefc';
    g.fillText(e.txt.slice(0, 120), x + 70, yy);
    if (e.rep != null && m.replays[e.rep]) {
      g.textAlign = 'right';
      g.fillStyle = '#5fd38a';
      g.font = font(12, 800);
      g.fillText('▶ REPLAY', x + w - 12, yy);
      g.textAlign = 'left';
    }
  }
  g.font = font(12, 500);
  g.fillStyle = 'rgba(170,185,210,.6)';
  g.fillText(
    `↑ ↓ or wheel to scroll · Enter or click a touch to replay it · ${L.length} events`,
    x,
    y + rows * 30 + 18
  );
}
function drawCoach(m, x, y, w) {
  const tips = coach(m, 0);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(14, 800);
  g.fillStyle = '#fff';
  g.fillText('Virtual coach — based only on what was recorded in this bout', x, y + 10);
  let yy = y + 44;
  for (const t of tips) {
    g.fillStyle = '#ffd76a';
    g.beginPath();
    g.arc(x + 8, yy - 5, 4, 0, TAU);
    g.fill();
    g.font = font(15, 500);
    g.fillStyle = '#dfe8f7';
    yy = wrap(t, x + 24, yy, w - 60, 22) + 14;
  }
}
/* ---------- puzzles ---------- */
function puzzleItems() {
  const pr = Store.get('puzzles', {});
  return PUZZLES.map((p, i) => ({
    l: `${i + 1}. ${p.name}`,
    v: () =>
      pr[p.id] && pr[p.id].done
        ? '★'.repeat(pr[p.id].stars || 1) + '☆'.repeat(3 - (pr[p.id].stars || 1))
        : 'unsolved',
    s: p.goal,
    f: () => startPuzzle(i)
  })).concat([{ l: 'Back', f: toTitle }]);
}
function drawPuzzles() {
  dim(0.82);
  title(
    'Tactical puzzles',
    'Each starts from the same state every time. Any legitimate tactic that meets the objective counts.'
  );
  drawMenu(puzzleItems(), 'zidx', 64, 130, 720, 62, true);
  const p = PUZZLES[G.zidx];
  if (p) {
    g.textAlign = 'left';
    g.font = font(14, 500);
    g.fillStyle = '#b9c7de';
    wrap(
      'Efficiency: ★★★ solved on the first attempt within the par time; ★★ within three attempts; ★ otherwise.',
      820,
      170,
      380,
      20
    );
  }
}
/* ---------- sandbox ---------- */
function sandboxItems() {
  const B = G.sb;
  const num = (k, lo, hi, st) => d => {
    B[k] = clamp(Math.round((B[k] + d * st) * 100) / 100, lo, hi);
  };
  return [
    { l: 'Start sandbox', f: startSandbox },
    {
      l: 'Opponent base personality',
      v: () => PERS[B.pers].name,
      lr: d => {
        B.pers = cyc(PERS_KEYS, B.pers, d);
      }
    },
    { l: 'Opponent aggression', v: () => B.aggr + '%', lr: num('aggr', 0, 100, 10) },
    { l: 'Opponent reaction time', v: () => B.react + ' ms', lr: num('react', 80, 700, 20) },
    {
      l: 'Defensive preference',
      v: () => ({ parry: 'Parry', retreat: 'Retreat', counter: 'Counterattack' })[B.def],
      lr: d => {
        B.def = cyc(['parry', 'retreat', 'counter'], B.def, d);
      }
    },
    {
      l: 'Preferred attack',
      v: () =>
        ({
          mixed: 'Mixed',
          thrust: 'Thrust',
          lunge: 'Lunge',
          adv: 'Advance-lunge',
          feint: 'Feint compounds'
        })[B.pref],
      lr: d => {
        B.pref = cyc(['mixed', 'thrust', 'lunge', 'adv', 'feint'], B.pref, d);
      }
    },
    { l: 'Starting distance', v: () => B.dist.toFixed(1) + ' m', lr: num('dist', 1.6, 8, 0.2) },
    { l: 'Starting score (you)', v: () => String(B.s0), lr: num('s0', 0, 14, 1) },
    { l: 'Starting score (opponent)', v: () => String(B.s1), lr: num('s1', 0, 14, 1) },
    { l: 'Remaining time', v: () => (B.time ? B.time + ' s' : 'No clock'), lr: num('time', 0, 180, 10) },
    { l: 'Blade speed multiplier', v: () => B.blade.toFixed(2) + '×', lr: num('blade', 0.5, 1.5, 0.05) },
    {
      l: 'Game speed',
      v: () => B.speed + '×',
      lr: d => {
        B.speed = cyc([0.25, 0.5, 0.75, 1], B.speed, d);
      }
    },
    {
      l: 'Fatigue',
      v: () => (B.fatigue ? 'On' : 'Off'),
      lr: () => {
        B.fatigue = !B.fatigue;
      }
    },
    {
      l: 'After a touch',
      v: () => (B.respawn === 'reset' ? 'Reset to start positions' : 'Continue from current positions'),
      lr: () => {
        B.respawn = B.respawn === 'reset' ? 'continue' : 'reset';
      }
    },
    { l: 'Back', f: toTitle }
  ];
}
function drawSandbox() {
  dim(0.82);
  title(
    'Sandbox',
    'Debug overlays: 1 geometry · 2 target zones · 3 phases · 4 parry windows · 5 effective range · 6 AI state · 7 AI probabilities · 8 vulnerability'
  );
  drawMenu(sandboxItems(), 'sidx', 64, 130, 640, 36, false);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(14, 500);
  g.fillStyle = '#b9c7de';
  wrap(
    'In the sandbox you can toggle overlays with keys 1–8 and change speed with [ and ] while fencing. Slow motion is only ever available here — competitive modes always run at full speed.',
    740,
    150,
    460,
    20
  );
}
/* ---------- ghosts ---------- */
function ghostItems() {
  const gs = getGhosts();
  const it = gs.map((gh, i) => ({
    l: `${gh.name}`,
    v: () => (gh.kind === 'behavior' ? 'Behavioural' : 'Recorded'),
    s:
      gh.kind === 'behavior'
        ? `Built from ${gh.data.matches} bouts, ${gh.data.attacks} attacks`
        : `${Math.round(gh.data.length / 60)} s of recorded fencing`,
    f: () => startGhost(i),
    ghost: i
  }));
  it.push({
    l: '+ Create behavioural ghost from my profile',
    f: () => {
      const pf = Store.get('profile', null);
      if (!pf || !pf.attacks) {
        toast('Fence a few rated bouts first — your profile is built from completed matches.');
        return;
      }
      const a = getGhosts();
      a.unshift({
        format: 'fdob-ghost',
        version: 1,
        name: 'My style ' + new Date().toISOString().slice(5, 10),
        kind: 'behavior',
        data: Object.assign(emptyProfile(), pf)
      });
      saveGhosts(a);
      toast('Behavioural ghost created.');
    }
  });
  it.push({
    l: '+ Save last recorded bout as a ghost',
    f: () => {
      const r = Store.get('lastRec', null);
      if (!r || !r.frames || !r.frames.length) {
        toast('No recording yet — play a Quick Match or Career bout first.');
        return;
      }
      const a = getGhosts();
      a.unshift({
        format: 'fdob-ghost',
        version: 1,
        name: 'Recording ' + new Date().toISOString().slice(5, 10),
        kind: 'recorded',
        data: r
      });
      saveGhosts(a);
      toast('Recorded ghost saved.');
    }
  });
  it.push({ l: '+ Import ghost from JSON', f: () => openModal('import') });
  it.push({ l: 'Back', f: toTitle });
  return it;
}
function drawGhosts() {
  dim(0.82);
  title('Ghost opponents', 'Enter: fence · E: export JSON · Delete: remove · stored only in this browser');
  drawMenu(ghostItems(), 'gidx', 64, 130, 720, 50, true);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(14, 500);
  g.fillStyle = '#b9c7de';
  wrap(
    'Recorded ghosts replay your exact inputs through the same mechanics — a timing and positioning exercise. Behavioural ghosts are AI opponents built from your profile: attack frequency, footwork, guard and target preferences, favourite sequences and reactions. They respond to you live. Imported files are validated strictly and can only contain numbers, names and action labels.',
    820,
    150,
    380,
    20
  );
}
/* ---------- ratings ---------- */
function drawRatings() {
  dim(0.82);
  title(
    'Offline ratings',
    'Elo against AI opponents only. Training, puzzles, sandbox, ghosts and two-player bouts never change it. Not an online ranking.'
  );
  const R = getRatings();
  ['epee', 'foil', 'sabre'].forEach((w, i) => {
    const r = R[w],
      x = 64 + i * 390,
      y = 140;
    panel(x, y, 360, 420);
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = font(15, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(RULES[w].name.toUpperCase(), x + 20, y + 34);
    g.font = 'italic ' + font(38, 900);
    g.fillStyle = '#fff';
    g.fillText(rankName(r.r), x + 20, y + 84);
    g.font = font(16, 700);
    g.fillStyle = '#b9c7de';
    g.fillText(`${r.r} · ${r.n} rated bouts`, x + 20, y + 112);
    let yy = y + 150;
    for (const h of r.hist.slice(0, 8)) {
      g.font = font(13, 600);
      g.fillStyle = h.res === 'W' ? '#5fd38a' : '#ff8a8a';
      g.fillText(`${h.res} ${h.score}`, x + 20, yy);
      g.fillStyle = '#dfe8f7';
      g.fillText(`vs ${h.opp}`, x + 110, yy);
      g.fillStyle = h.d >= 0 ? '#5fd38a' : '#ff8a8a';
      g.textAlign = 'right';
      g.fillText((h.d >= 0 ? '+' : '') + h.d, x + 340, yy);
      g.textAlign = 'left';
      yy += 24;
    }
    if (!r.hist.length) {
      g.font = font(13, 500);
      g.fillStyle = 'rgba(185,199,222,.7)';
      g.fillText('No rated bouts yet.', x + 20, yy);
    }
  });
  g.font = font(12, 500);
  g.fillStyle = 'rgba(185,199,222,.7)';
  g.textAlign = 'left';
  g.fillText('Ranks: ' + RANKS.map(r => r[0] + ' ' + r[1]).join(' · '), 64, 600);
  g.fillText('Esc or Enter to go back', 64, 630);
}
/* ---------- tournament (classic) ---------- */
const ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'];
const NAMES = [
  ['L. Moreau', 'FRA'],
  ['K. Tanaka', 'JPN'],
  ['M. Rossi', 'ITA'],
  ['A. Novak', 'CZE'],
  ['S. Park', 'KOR'],
  ['J. Weber', 'GER'],
  ['E. Silva', 'BRA'],
  ['R. Okafor', 'NGR'],
  ['T. Lindqvist', 'SWE'],
  ['D. Kovács', 'HUN']
];
function startTour() {
  const pool = NAMES.slice()
    .sort(() => Math.random() - 0.5)
    .slice(0, 7);
  const ent = [{ n: 'You', c: 'BLUE', you: true }].concat(
    pool.map(p => ({ n: p[0], c: p[1], pers: pick(PERS_KEYS) }))
  );
  G.tour = {
    ent,
    rounds: [[0, 1, 2, 3, 4, 5, 6, 7]],
    res: [[]],
    r: 0,
    out: false,
    champ: false,
    cur: { opp: 1 }
  };
  G.screen = 'bracket';
  G.bidx = 0;
}
function tourAfter(m) {
  const T = G.tour,
    rd = T.rounds[T.r],
    won = m.winner === 0,
    next = [];
  T.res[T.r] = [];
  for (let i = 0; i < rd.length; i += 2) {
    const a = rd[i],
      b = rd[i + 1];
    let w, sc;
    if (a === 0 || b === 0) {
      w = won ? 0 : a === 0 ? b : a;
      sc = Math.max(...m.score) + '–' + Math.min(...m.score);
    } else {
      w = Math.random() < 0.5 ? a : b;
      sc = '15–' + (6 + ((Math.random() * 9) | 0));
    }
    next.push(w);
    T.res[T.r].push({ w, sc });
  }
  if (!won) {
    T.out = true;
    return;
  }
  if (next.length === 1) {
    T.champ = true;
    T.rounds.push(next);
    return;
  }
  T.rounds.push(next);
  T.r++;
  T.res.push([]);
  const ix = next.indexOf(0);
  T.cur = { opp: next[ix % 2 ? ix - 1 : ix + 1] };
}
function bracketItems() {
  return G.tour.out || G.tour.champ
    ? [{ l: 'Main Menu', f: toTitle }]
    : [
        { l: 'Fence ' + ROUNDS[G.tour.r], f: () => startMatch('tour') },
        { l: 'Main Menu', f: toTitle }
      ];
}
function drawBracketGeneric(titleTxt, sub, rounds, res, name, isYou, labels, msg, items, key) {
  dim(0.8);
  title(titleTxt, sub, 64, 70);
  const nR = labels.length,
    colX = labels.map((_, i) => 64 + i * (1100 / nR));
  const size = rounds[0].length;
  for (let r = 0; r < nR; r++) {
    const rd = rounds[r];
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.font = font(12, 800);
    g.fillStyle = '#ffd76a';
    g.fillText(labels[r].toUpperCase(), colX[r], 140);
    const n = r < nR - 1 ? size / 2 ** r : 1,
      gap = 440 / n;
    for (let i = 0; i < n; i++) {
      const yy = 170 + gap * i + gap / 2 - 20,
        e = rd ? rd[i] : null,
        you = e != null && isYou(e);
      rr(colX[r], yy, Math.min(250, 1100 / nR - 20), 34, 8);
      g.fillStyle = you ? 'rgba(59,140,255,.28)' : 'rgba(255,255,255,.05)';
      g.fill();
      if (you) {
        g.strokeStyle = 'rgba(120,175,255,.7)';
        g.stroke();
      }
      g.font = font(13, you ? 800 : 600);
      g.fillStyle = e != null ? '#fff' : 'rgba(255,255,255,.3)';
      g.fillText(e != null ? name(e) : '—', colX[r] + 12, yy + 17);
      const rs = res[r] && res[r][i >> 1];
      if (rs && e != null) {
        const wn = rs.w === e;
        g.textAlign = 'right';
        g.font = font(12, 700);
        g.fillStyle = wn ? '#5fd38a' : 'rgba(255,140,140,.7)';
        g.fillText(wn ? 'W ' + rs.sc : 'L', colX[r] + Math.min(250, 1100 / nR - 20) - 10, yy + 17);
        g.textAlign = 'left';
      }
    }
  }
  g.font = font(15, 700);
  g.fillStyle = '#e8eefc';
  g.fillText(msg, 64, 640);
  items.forEach((t, i) => {
    const bx = W - 64 - (items.length - i) * 240,
      by = 616,
      on = i === G[key];
    G.rects.push({ x: bx, y: by, w: 230, h: 50, i, key, items });
    rr(bx, by, 230, 50, 10);
    g.fillStyle = on ? 'rgba(59,140,255,.3)' : 'rgba(255,255,255,.05)';
    g.fill();
    if (on) {
      g.strokeStyle = 'rgba(120,175,255,.8)';
      g.stroke();
    }
    g.textAlign = 'center';
    g.font = font(15, on ? 800 : 600);
    g.fillStyle = '#fff';
    g.fillText(t.l, bx + 115, by + 25);
    g.textAlign = 'left';
  });
}
function drawBracket() {
  const T = G.tour;
  const msg = T.champ
    ? 'You won the tournament!'
    : T.out
      ? 'You were eliminated.'
      : `Next: ${ROUNDS[T.r]} vs ${T.ent[T.cur.opp].n} (${T.ent[T.cur.opp].c}) · ${PERS[T.ent[T.cur.opp].pers].name} · AI ${LV[Math.min(3, SETTINGS.diff + T.r)].name}`;
  drawBracketGeneric(
    'Tournament · direct elimination',
    'Bouts to 15 touches, three 3-minute periods with one-minute breaks. Rated.',
    T.rounds,
    T.res,
    e => (T.ent[e].you ? 'YOU (BLUE)' : T.ent[e].n + '  ' + T.ent[e].c),
    e => T.ent[e].you,
    ['Quarterfinals', 'Semifinals', 'Final', 'Champion'],
    msg,
    bracketItems(),
    'bidx'
  );
}
/* ---------- career ---------- */
function newDraft() {
  const c = getCareer();
  const p = c
    ? Object.assign({}, c.profile)
    : {
        name: 'Alex Morgan',
        country: 'USA',
        hand: 'Right',
        mask: 'plain',
        trim: '#3b8cff',
        shoes: 'white',
        style: 'Balanced'
      };
  return p;
}
function draftItems() {
  const d = G.draft,
    c = getCareer(),
    best = c ? c.best : 0;
  const unl = arr => arr.filter(x => best >= x[2]);
  const it = [
    {
      l: 'Name',
      v: () => d.name + (G.edit ? '▏' : ''),
      f: () => {
        G.edit = {
          get: () => d.name,
          set: v => {
            d.name = v;
          },
          max: 20
        };
      }
    },
    {
      l: 'Country',
      v: () => d.country,
      lr: k => {
        d.country = cyc(COUNTRIES, d.country, k);
      }
    },
    {
      l: 'Dominant hand',
      v: () => d.hand,
      lr: () => {
        d.hand = d.hand === 'Right' ? 'Left' : 'Right';
      }
    },
    {
      l: 'Mask design',
      v: () => MASKS.find(x => x[1] === d.mask)[0],
      lr: k => {
        d.mask = cyc(
          unl(MASKS).map(x => x[1]),
          d.mask,
          k
        );
      }
    },
    {
      l: 'Uniform trim',
      v: () => TRIMS.find(x => x[1] === d.trim)[0],
      lr: k => {
        d.trim = cyc(
          unl(TRIMS).map(x => x[1]),
          d.trim,
          k
        );
      }
    },
    {
      l: 'Fencing shoes',
      v: () => SHOES.find(x => x[1] === d.shoes)[0],
      lr: k => {
        d.shoes = cyc(
          unl(SHOES).map(x => x[1]),
          d.shoes,
          k
        );
      }
    },
    {
      l: 'Preferred tactical style',
      v: () => d.style,
      lr: k => {
        d.style = cyc(STYLES, d.style, k);
      }
    }
  ];
  if (c)
    it.push(
      {
        l: 'Save changes',
        f: () => {
          c.profile = Object.assign({}, d);
          saveCareer(c);
          G.screen = 'career';
          toast('Profile saved.');
        }
      },
      {
        l: 'Cancel',
        f: () => {
          G.screen = 'career';
        }
      }
    );
  else
    it.push(
      {
        l: 'Begin career',
        f: () => {
          const nc = newCareer(Object.assign({}, d));
          saveCareer(nc);
          G.screen = 'career';
          G.cidx = 0;
        }
      },
      { l: 'Back', f: toTitle }
    );
  return it;
}
function lookOf(p) {
  return { trim: p.trim, mask: p.mask, shoes: p.shoes, lefty: p.hand === 'Left' };
}
function drawPreview(look, cx, cy, sc) {
  const f = new Fencer(0, null);
  f.setLook(look);
  f.reset();
  f.computePose(null);
  g.save();
  g.setTransform(S * sc, 0, 0, S * sc, S * cx, S * cy);
  g.translate(-f.x, 0);
  drawBody(f);
  drawWeapon(f);
  g.restore();
  g.setTransform(S, 0, 0, S, 0, 0);
}
function drawCareerNew() {
  dim(0.85);
  const c = getCareer();
  title(
    c ? 'Customise athlete' : 'New career',
    'Cosmetics are unlocked by results and never change performance.'
  );
  drawMenu(draftItems(), 'cidx', 64, 130, 620, 46, false);
  panel(760, 120, 440, 480);
  drawPreview(lookOf(G.draft), 980, 520, 190);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = font(20, 900);
  g.fillStyle = '#fff';
  g.fillText(G.draft.name, 980, 160);
  g.font = font(13, 600);
  g.fillStyle = '#b9c7de';
  g.fillText(`${G.draft.country} · ${G.draft.hand}-handed · ${G.draft.style}`, 980, 182);
  if (G.edit) {
    g.font = font(13, 600);
    g.fillStyle = '#ffd76a';
    g.textAlign = 'left';
    g.fillText('Type a name, Enter to confirm', 64, 520);
  }
}
function careerItems() {
  const c = getCareer();
  if (!c) return [{ l: 'Back', f: toTitle }];
  const cur = c.cur && !c.cur.out && !c.cur.champ;
  const L = CAREER_LEVELS[c.level];
  return [
    {
      l: cur ? 'Continue tournament' : `Enter: ${L.name}`,
      f: () => {
        if (!cur) careerStart(c);
        G.screen = 'careerBracket';
        G.bidx = 0;
      }
    },
    {
      l: 'Customise athlete',
      f: () => {
        G.draft = newDraft();
        G.screen = 'careerNew';
        G.cidx = 0;
      }
    },
    {
      l: 'Offline ratings',
      f: () => {
        G.screen = 'ratings';
        G.back = 'career';
      }
    },
    {
      l: 'Reset career',
      f: () => {
        G.confirm = {
          text: 'Delete this career permanently?',
          yes: () => {
            Store.del('career');
            toTitle();
            toast('Career deleted.');
          }
        };
      }
    },
    { l: 'Main Menu', f: toTitle }
  ];
}
function drawCareer() {
  const c = getCareer();
  dim(0.82);
  if (!c) {
    G.screen = 'careerNew';
    return;
  }
  const p = c.profile,
    L = CAREER_LEVELS[c.level],
    rk = careerRank(c);
  title(
    p.name,
    `${p.country} · ${p.hand}-handed · ${p.style} · career record ${c.rec.w}–${c.rec.l} · ${c.rec.tw} title${c.rec.tw === 1 ? '' : 's'}`
  );
  drawMenu(careerItems(), 'cidx', 64, 130, 380, 48, false);
  panel(470, 120, 360, 250);
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  g.font = font(12, 800);
  g.fillStyle = '#ffd76a';
  g.fillText(`LEVEL ${c.level + 1} OF 7 · ${L.tier.toUpperCase()}`, 490, 148);
  g.font = font(20, 900);
  g.fillStyle = '#fff';
  g.fillText(L.name, 490, 176);
  g.font = font(13, 500);
  g.fillStyle = '#b9c7de';
  let y = 200;
  for (const t of [
    `Arena: ${ARENAS[L.arena].name}`,
    `${L.size} fencers · direct elimination`,
    `Bouts to ${L.target} · ${L.periods} period${L.periods > 1 ? 's' : ''} of 3:00`,
    `Opponents: ${LV[L.lv[0]].name}–${LV[L.lv[1]].name} AI with personalities`
  ])
    y = wrap(t, 490, y, 320, 20);
  if (c.lastPlace) {
    g.fillStyle = '#5fd38a';
    wrap(
      `Last result: ${c.lastPlace.champ ? 'Champion' : 'Place ' + c.lastPlace.place} at ${c.lastPlace.name} (+${c.lastPlace.pts} pts)`,
      490,
      y + 8,
      320,
      20
    );
  }
  panel(850, 120, 370, 250);
  g.font = font(12, 800);
  g.fillStyle = '#ffd76a';
  g.fillText(`RANKING · #${rk.pos} OF ${rk.of} · ${c.points} PTS`, 870, 148);
  let yy = 176;
  for (const e of rk.list.slice(0, 7)) {
    g.font = font(13, e.you ? 800 : 500);
    g.fillStyle = e.you ? '#a8c8ff' : '#dfe8f7';
    g.fillText(e.n, 870, yy);
    g.textAlign = 'right';
    g.fillText(String(e.p), 1200, yy);
    g.textAlign = 'left';
    yy += 24;
  }
  panel(470, 390, 360, 230);
  g.font = font(12, 800);
  g.fillStyle = '#ffd76a';
  g.fillText('RIVALS', 490, 418);
  yy = 444;
  const rv = Object.entries(c.rivals)
    .sort((a, b) => b[1].met - a[1].met)
    .slice(0, 4);
  if (!rv.length) {
    g.font = font(13, 500);
    g.fillStyle = '#b9c7de';
    g.fillText('Recurring opponents will appear here.', 490, yy);
  }
  for (const [id, r] of rv) {
    const a = athlete(c, id);
    g.font = font(14, 800);
    g.fillStyle = '#fff';
    g.fillText(`${a.n} (${a.c})`, 490, yy);
    g.font = font(12, 500);
    g.fillStyle = '#b9c7de';
    g.fillText(
      `${r.w}–${r.l} · ${PERS[a.pers].name}${r.notes.length ? ' · ' + r.notes.join(', ') : ''}`,
      490,
      yy + 17
    );
    yy += 42;
  }
  panel(850, 390, 370, 230);
  g.font = font(12, 800);
  g.fillStyle = '#ffd76a';
  g.fillText('RECORDS & HISTORY', 870, 418);
  g.font = font(13, 500);
  g.fillStyle = '#dfe8f7';
  yy = 444;
  for (const t of [
    `Best win streak: ${c.rec.bestStreak}`,
    `Best winning margin: ${c.rec.bestMargin}`,
    `Career touches: ${c.rec.touches}`
  ]) {
    g.fillText(t, 870, yy);
    yy += 20;
  }
  yy += 6;
  for (const h of c.history.slice(0, 4)) {
    g.fillStyle = h.place === 1 ? '#ffd76a' : '#b9c7de';
    g.fillText(
      `${h.place === 1 ? '🏆 ' : ''}${h.name} — ${h.place === 1 ? '1st' : '#' + h.place}`.replace('🏆 ', ''),
      870,
      yy
    );
    yy += 20;
  }
  drawPreview(lookOf(p), 250, 620, 95);
}
function careerBracketItems() {
  const c = getCareer(),
    cur = c.cur;
  if (!cur || cur.out || cur.champ)
    return [
      {
        l: 'Back to career',
        f: () => {
          G.screen = 'career';
        }
      }
    ];
  return [
    { l: 'Fence ' + careerRoundName(cur), f: startCareerBout },
    {
      l: 'Back to career',
      f: () => {
        G.screen = 'career';
      }
    }
  ];
}
function careerRoundName(cur) {
  const L = CAREER_LEVELS[cur.lvl],
    n = Math.log2(L.size),
    left = n - cur.r;
  return left === 1 ? 'final' : left === 2 ? 'semifinal' : 'quarterfinal';
}
function drawCareerBracket() {
  const c = getCareer();
  if (!c || !c.cur) {
    G.screen = 'career';
    return;
  }
  const cur = c.cur,
    L = CAREER_LEVELS[cur.lvl];
  const n = Math.log2(L.size);
  const labels = (n === 2 ? ['Semifinals', 'Final'] : ['Quarterfinals', 'Semifinals', 'Final']).concat([
    'Champion'
  ]);
  let msg;
  if (cur.champ) msg = `Champion of the ${L.name}!`;
  else if (cur.out) msg = 'Eliminated — back to training.';
  else {
    const o = athlete(c, careerOpp(c)),
      rv = c.rivals[o.id];
    msg = `Next: ${careerRoundName(cur)} vs ${o.n} (${o.c}) · ${PERS[o.pers].name}${rv ? ` · head-to-head ${rv.w}–${rv.l}${rv.notes.length ? ' · ' + rv.notes.join(', ') : ''}` : ''}${c.memory[o.id] ? ' · remembers your habits' : ''}`;
  }
  drawBracketGeneric(
    L.name,
    `${L.tier} · ${ARENAS[L.arena].name} · bouts to ${L.target}`,
    cur.rounds,
    cur.res,
    e => (e === 'you' ? c.profile.name.toUpperCase() + ' (YOU)' : athlete(c, e).n + '  ' + athlete(c, e).c),
    e => e === 'you',
    labels,
    msg.slice(0, 130),
    careerBracketItems(),
    'bidx'
  );
}
function drawCeremony() {
  const R = G.cer;
  R.t += 1 / 60;
  dim(0.5);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = 'italic ' + font(44, 900);
  g.fillStyle = '#ffd76a';
  g.fillText('CHAMPION', W / 2, 110);
  g.font = font(18, 700);
  g.fillStyle = '#fff';
  g.fillText(R.title, W / 2, 142);
  const steps = [
    [W / 2 - 240, 420, '2', R.names[1]],
    [W / 2, 360, '1', R.names[0]],
    [W / 2 + 240, 460, '3', R.names[2]]
  ];
  for (const [x, y, n, nm] of steps) {
    const gr = g.createLinearGradient(0, y, 0, 600);
    gr.addColorStop(0, n === '1' ? '#e3b94a' : n === '2' ? '#c9d1db' : '#c8834a');
    gr.addColorStop(1, '#2a2a2a');
    g.fillStyle = gr;
    g.fillRect(x - 110, y, 220, 600 - y);
    g.font = font(48, 900);
    g.fillStyle = 'rgba(0,0,0,.35)';
    g.fillText(n, x, y + 60);
    g.font = font(16, 800);
    g.fillStyle = '#fff';
    g.fillText(nm, x, y - 20);
  }
  g.beginPath();
  g.arc(W / 2, 300, 24, 0, TAU);
  g.fillStyle = '#e3b94a';
  g.fill();
  g.strokeStyle = '#fff3c4';
  g.lineWidth = 3;
  g.stroke();
  for (const p of R.conf) {
    p.y += p.v;
    p.x += Math.sin(R.t * 2 + p.p) * 0.6;
    if (p.y > H) p.y = -10;
    g.fillStyle = p.c;
    g.fillRect(p.x, p.y, 6, 10);
  }
  g.font = font(14, 600);
  g.fillStyle = '#dfe8f7';
  g.fillText('Enter to continue', W / 2, 660);
}
/* ---------- confirm, toast, modal ---------- */
function drawConfirm() {
  dim(0.6);
  panel(W / 2 - 280, 260, 560, 180);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.font = font(17, 700);
  g.fillStyle = '#fff';
  wrap(G.confirm.text, W / 2, 312, 500, 24);
  g.font = font(14, 700);
  g.fillStyle = '#ffd76a';
  g.fillText('Enter / Y to confirm · Esc / N to cancel', W / 2, 410);
}
function drawToast() {
  if (!G.toast) return;
  G.toast.time -= 1 / 60;
  if (G.toast.time <= 0) {
    G.toast = null;
    return;
  }
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = font(14, 700);
  const w = Math.min(900, g.measureText(G.toast.t).width + 40);
  rr(W / 2 - w / 2, H - 110, w, 36, 18);
  g.fillStyle = 'rgba(20,30,50,.95)';
  g.fill();
  g.fillStyle = '#fff';
  g.fillText(G.toast.t, W / 2, H - 92);
}
function openModal(mode, ghost) {
  if (G.modal) return;
  const d = document.createElement('div');
  d.style.cssText =
    'position:fixed;inset:0;background:rgba(3,5,10,.75);display:flex;align-items:center;justify-content:center;z-index:9;font-family:system-ui,sans-serif';
  const b = document.createElement('div');
  b.style.cssText =
    'background:#0c1424;color:#e8eefc;border:1px solid #2a3b5c;border-radius:14px;padding:20px;width:min(720px,92vw)';
  d.appendChild(b);
  const h = document.createElement('div');
  h.textContent =
    mode === 'export' ? 'Export ghost — copy this JSON' : 'Import ghost — paste JSON or choose a file';
  h.style.cssText = 'font-weight:800;font-size:17px;margin-bottom:10px';
  b.appendChild(h);
  const ta = document.createElement('textarea');
  ta.style.cssText =
    'width:100%;height:280px;background:#060a12;color:#cfe0ff;border:1px solid #2a3b5c;border-radius:8px;font:12px ui-monospace,monospace;padding:8px;box-sizing:border-box';
  b.appendChild(ta);
  const msg = document.createElement('div');
  msg.style.cssText = 'min-height:20px;margin:8px 0;color:#ffd76a;font-size:13px';
  b.appendChild(msg);
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap';
  b.appendChild(row);
  const btn = (t, fn) => {
    const x = document.createElement('button');
    x.textContent = t;
    x.style.cssText =
      'min-height:40px;padding:0 16px;border-radius:8px;border:1px solid #3b8cff;background:#14305e;color:#fff;font-weight:700;cursor:pointer';
    x.onclick = fn;
    row.appendChild(x);
    return x;
  };
  const close = () => {
    d.remove();
    G.modal = null;
    cv.focus();
  };
  if (mode === 'export') {
    ta.value = JSON.stringify(ghost, null, 1);
    ta.readOnly = true;
    btn('Copy to clipboard', () => {
      try {
        navigator.clipboard.writeText(ta.value).then(
          () => {
            msg.textContent = 'Copied.';
          },
          () => {
            ta.select();
            msg.textContent = 'Select-all and copy manually (Ctrl/Cmd+C).';
          }
        );
      } catch (e) {
        ta.select();
        msg.textContent = 'Select-all and copy manually.';
      }
    });
  } else {
    const fi = document.createElement('input');
    fi.type = 'file';
    fi.accept = '.json,application/json';
    fi.style.cssText = 'color:#cfe0ff';
    fi.onchange = () => {
      const f = fi.files[0];
      if (!f) return;
      if (f.size > 2e6) {
        msg.textContent = 'File too large.';
        return;
      }
      const r = new FileReader();
      r.onload = () => {
        ta.value = String(r.result);
      };
      r.readAsText(f);
    };
    row.appendChild(fi);
    btn('Import', () => {
      let obj;
      try {
        obj = JSON.parse(ta.value);
      } catch (e) {
        msg.textContent = 'That is not valid JSON.';
        return;
      }
      try {
        const gh = validateGhost(obj);
        const a = getGhosts();
        a.unshift(gh);
        saveGhosts(a);
        toast(`Imported ghost "${gh.name}".`);
        close();
      } catch (e) {
        msg.textContent = 'Rejected: ' + e;
      }
    });
  }
  btn('Close', close);
  document.body.appendChild(d);
  G.modal = d;
  setTimeout(() => ta.focus(), 0);
}

/* ================= GAME FLOW, INPUT, LOOP ================= */
function playerLook() {
  const c = getCareer();
  return c ? lookOf(c.profile) : { trim: '#3b8cff' };
}
function human(p, extra) {
  return new Human(p, { mouse: SETTINGS.mouseAim && p === 'p1', extraFast: extra });
}
function startMatch(type) {
  RNG = Math.random;
  G.lastType = type === 'tour' ? G.lastType : type;
  let o;
  const w = SETTINGS.weapon,
    ar = SETTINGS.arena;
  if (type === 'quick') {
    const h = human('p1', ['ShiftRight']);
    h.rec = new Recorder();
    o = {
      type,
      weapon: w,
      arena: ar,
      target: 5,
      periods: 1,
      periodLen: 180,
      sim: SETTINGS.sim,
      rated: true,
      ctrls: [h, new AI(SETTINGS.diff, SETTINGS.pers)],
      names: [
        'BLUE · YOU',
        `RED · ${PERS[SETTINGS.pers].name.replace('The ', '').toUpperCase()} · ${LV[SETTINGS.diff].name.slice(0, 3).toUpperCase()}`
      ],
      looks: [playerLook(), null]
    };
  } else if (type === '2p')
    o = {
      type,
      weapon: w,
      arena: ar,
      target: 5,
      periods: 1,
      periodLen: 180,
      sim: SETTINGS.sim,
      ctrls: [human('p1'), new Human('p2')],
      names: ['BLUE · PLAYER 1', 'RED · PLAYER 2']
    };
  else if (type === 'training')
    o = {
      type,
      weapon: w,
      arena: ar === 'olympic' ? 'club' : ar,
      training: true,
      target: Infinity,
      periods: 1,
      periodLen: 0,
      ctrls: [human('p1', ['ShiftRight']), DRILLS[0].make()],
      names: ['BLUE · YOU', 'RED · DUMMY'],
      looks: [playerLook(), null]
    };
  else {
    const T = G.tour,
      opp = T.ent[T.cur.opp],
      lv = Math.min(3, SETTINGS.diff + T.r),
      fin = T.r === 2;
    const h = human('p1', ['ShiftRight']);
    h.rec = new Recorder();
    o = {
      type: 'tour',
      weapon: 'epee',
      arena: ar,
      target: 15,
      periods: 3,
      periodLen: 180,
      rated: true,
      final: fin,
      intro: fin && ar === 'olympic',
      introTitle: 'Tournament final',
      introSub: ['BLUE', opp.c],
      ctrls: [h, new AI(lv, opp.pers)],
      names: ['BLUE · YOU', `RED · ${opp.n.toUpperCase()} (${opp.c})`],
      round:
        ROUNDS[T.r].toUpperCase() +
        ' · ' +
        PERS[opp.pers].name.toUpperCase() +
        ' · AI ' +
        LV[lv].name.toUpperCase(),
      looks: [playerLook(), null]
    };
  }
  G.match = new Match(o);
  G.screen = 'match';
  G.paused = false;
  G.speed = 1;
}
function startCareerBout() {
  RNG = Math.random;
  const c = getCareer(),
    cur = c.cur,
    L = CAREER_LEVELS[cur.lvl],
    id = careerOpp(c),
    a = athlete(c, id);
  const rounds = Math.log2(L.size),
    fin = cur.r === rounds - 1;
  const lv = L.lv[Math.min(1, cur.r > 0 ? 1 : 0)];
  const h = human('p1', ['ShiftRight']);
  h.rec = new Recorder();
  const ai = new AI(lv, a.pers, { memory: c.memory[id] });
  G.match = new Match({
    type: 'career',
    weapon: 'epee',
    arena: L.arena,
    target: L.target,
    periods: L.periods,
    periodLen: 180,
    sim: SETTINGS.sim,
    rated: true,
    final: fin,
    intro: fin && L.arena === 'olympic',
    introTitle: L.name + ' · final',
    introSub: [c.profile.country, a.c],
    ctrls: [h, ai],
    names: [`BLUE · ${c.profile.name.toUpperCase()}`, `RED · ${a.n.toUpperCase()} (${a.c})`],
    looks: [lookOf(c.profile), null],
    round: `${L.name.toUpperCase()} · ${careerRoundName(cur).toUpperCase()} · ${PERS[a.pers].name.toUpperCase()}`
  });
  G.screen = 'match';
  G.paused = false;
  G.speed = 1;
}
function startPuzzle(i, keepAtt) {
  const p = PUZZLES[i];
  RNG = mulberry(p.seed);
  if (!keepAtt || G.pz.i !== i) G.pz = { i, att: 0, hint: false };
  G.pz.att++;
  G.pz.t0 = 0;
  G.pz.stars = 0;
  const s = p.setup();
  const o = {
    type: 'puzzle',
    weapon: 'epee',
    arena: 'national',
    puzzle: p,
    target: s.target || Infinity,
    periods: 1,
    periodLen: s.periodLen || 0,
    startClock: s.startClock,
    startScore: s.startScore,
    startDist: s.startDist,
    pos: s.pos,
    ctrls: [human('p1', ['ShiftRight']), s.opp],
    names: [
      'BLUE · YOU',
      'RED · ' + (s.opp.kind === 'ai' ? PERS[s.opp.pk].name.toUpperCase() : 'SPARRING PARTNER')
    ],
    looks: [playerLook(), null]
  };
  G.match = new Match(o);
  G.screen = 'match';
  G.paused = false;
  G.speed = 1;
}
function startSandbox() {
  RNG = Math.random;
  const B = G.sb;
  const base = JSON.parse(JSON.stringify(PERS[B.pers]));
  const a = B.aggr / 50;
  base.w.pressure *= a;
  base.w.prepare *= a;
  base.w.force *= a;
  base.w.defend /= Math.max(0.3, a);
  base.w.distance /= Math.max(0.3, a);
  base.parry = B.def === 'parry' ? 1 : 0.2;
  base.retreat = B.def === 'retreat' ? 1 : 0.2;
  base.counter = B.def === 'counter' ? 1 : 0.2;
  if (B.pref !== 'mixed') {
    if (B.pref === 'feint') {
      base.feint = 0.9;
    } else
      base.kinds = {
        thrust: B.pref === 'thrust' ? 1 : 0.05,
        lunge: B.pref === 'lunge' ? 1 : 0.05,
        adv: B.pref === 'adv' ? 1 : 0.05
      };
  }
  const ai = new AI(2, B.pers, {
    pers: base,
    lv: { react: [(B.react / 1000) * 0.9, (B.react / 1000) * 1.1] }
  });
  G.match = new Match({
    type: 'sandbox',
    sandbox: true,
    weapon: SETTINGS.weapon,
    arena: SETTINGS.arena,
    target: Infinity,
    periods: 1,
    periodLen: B.time,
    startScore: [B.s0, B.s1],
    startDist: B.dist,
    bladeMul: B.blade,
    sim: B.fatigue,
    respawn: B.respawn,
    ctrls: [human('p1', ['ShiftRight']), ai],
    names: ['BLUE · YOU', 'RED · ' + PERS[B.pers].name.toUpperCase() + ' (CUSTOM)'],
    looks: [playerLook(), null]
  });
  G.screen = 'match';
  G.paused = false;
  G.speed = B.speed;
}
function startGhost(i) {
  const gh = getGhosts()[i];
  if (!gh) return;
  RNG = Math.random;
  G.ghostSel = i;
  const ctrl = gh.kind === 'behavior' ? new BehaviorGhost(gh.data, 2) : new RecordedGhost(gh.data);
  G.match = new Match({
    type: 'ghost',
    weapon: 'epee',
    arena: SETTINGS.arena,
    target: 5,
    periods: 1,
    periodLen: 180,
    ctrls: [human('p1', ['ShiftRight']), ctrl],
    names: ['BLUE · YOU', 'RED · GHOST: ' + gh.name.toUpperCase()],
    looks: [playerLook(), { trim: '#b38cff', mask: 'plain', shoes: 'white' }]
  });
  G.screen = 'match';
  G.paused = false;
  G.speed = 1;
}
function toTitle() {
  G.screen = 'title';
  G.paused = false;
  G.match = null;
  G.speed = 1;
  RNG = Math.random;
}
G.onMatchEnd = m => {
  const R = { m, tab: 0, scroll: 0, sel: -1 };
  G.ridx = 0;
  R.rating = rateMatch(m);
  updateProfile(m);
  if (m.c[0].rec) {
    const d = m.c[0].rec.data();
    if (d.frames.length > 10) Store.set('lastRec', d);
  }
  if (m.o.type === 'tour') tourAfter(m);
  if (m.o.type === 'career') {
    const c = getCareer();
    careerAfterBout(c, m);
    const cur = c.cur;
    R.career = {
      champ: cur.champ,
      text: cur.champ
        ? `Champion of the ${CAREER_LEVELS[cur.lvl].name}!`
        : cur.out
          ? 'Eliminated from the ' + CAREER_LEVELS[cur.lvl].name
          : 'Through to the ' + careerRoundName(cur)
    };
    if (
      (cur.champ && cur.lvl === CAREER_LEVELS.length - 1) ||
      (cur.champ && CAREER_LEVELS[cur.lvl].arena === 'olympic')
    ) {
      startCeremony(CAREER_LEVELS[cur.lvl].name, [
        c.profile.name,
        athlete(c, careerOpp(c)).n,
        pick(c.roster).n
      ]);
      G.afterCer = 'results';
    }
  }
  if (m.o.type === 'tour' && G.tour.champ && m.arena === 'olympic') {
    startCeremony('Tournament', ['You', G.tour.ent[G.tour.cur.opp].n, G.tour.ent[2].n]);
    G.afterCer = 'results';
  }
  G.res = R;
  if (G.screen !== 'ceremony') G.screen = 'results';
};
function startCeremony(t, names) {
  G.cer = {
    t: 0,
    title: t,
    names,
    conf: Array.from({ length: 120 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      v: 1 + Math.random() * 2.5,
      p: Math.random() * 6,
      c: pick(['#ffd76a', '#3b8cff', '#ff4a4a', '#ffffff', '#5fd38a'])
    }))
  };
  G.screen = 'ceremony';
  Snd.fanfare();
  Snd.cheer(1.6);
}
G.onPuzzleEnd = m => {
  const r = m.puzzleRes,
    p = m.o.puzzle;
  if (r.ok) {
    const st = G.pz.att === 1 && m.ft <= p.par ? 3 : G.pz.att <= 3 ? 2 : 1;
    G.pz.stars = st;
    const pr = Store.get('puzzles', {});
    const prev = pr[p.id];
    pr[p.id] = {
      done: true,
      stars: Math.max(st, (prev && prev.stars) || 0),
      best: Math.min(m.ft, (prev && prev.best) || 99)
    };
    Store.set('puzzles', pr);
    Snd.fanfare();
  }
};
G.openReplay = (m, idx, auto) => {
  const rep = m.replays[idx];
  if (!rep) return;
  const start = Math.max(0, rep.frames.length - rep.n - 150);
  G.rv = {
    m,
    rep,
    i: start,
    start,
    playing: true,
    speed: auto ? 0.5 : 1,
    traj: true,
    auto,
    back: G.screen,
    cam: null
  };
  G.screen = 'replay';
};
function closeReplay() {
  const b = G.rv.back;
  G.rv = null;
  G.screen = b === 'replay' ? 'match' : b;
}
/* ---------- input ---------- */
const PREVENT = new Set([
  'Space',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'Slash',
  'Quote',
  'Tab',
  'Backspace',
  'Semicolon',
  'BracketLeft',
  'BracketRight'
]);
function screenItems() {
  switch (G.screen) {
    case 'title':
      return [titleItems(), 'idx'];
    case 'settings':
      return [settingsItems(), 'nidx'];
    case 'puzzles':
      return [puzzleItems(), 'zidx'];
    case 'sandbox':
      return [sandboxItems(), 'sidx'];
    case 'ghosts':
      return [ghostItems(), 'gidx'];
    case 'careerNew':
      return [draftItems(), 'cidx'];
    case 'career':
      return [careerItems(), 'cidx'];
    case 'careerBracket':
      return [careerBracketItems(), 'bidx'];
    case 'bracket':
      return [bracketItems(), 'bidx'];
    case 'results':
      return [resultItems(), 'ridx'];
  }
  return null;
}
function onKey(code, e) {
  if (G.confirm) {
    if (code === 'Enter' || code === 'KeyY') {
      const y = G.confirm.yes;
      G.confirm = null;
      y();
    } else if (code === 'Escape' || code === 'KeyN') G.confirm = null;
    return;
  }
  if (G.edit) {
    if (code === 'Enter' || code === 'Escape') {
      G.edit = null;
      return;
    }
    if (code === 'Backspace') {
      G.edit.set(G.edit.get().slice(0, -1));
      return;
    }
    if (
      e &&
      e.key &&
      e.key.length === 1 &&
      G.edit.get().length < G.edit.max &&
      /[\p{L}\p{N} '.\-]/u.test(e.key)
    )
      G.edit.set(G.edit.get() + e.key);
    return;
  }
  if (G.capture) {
    if (code === 'Escape') {
      G.capture = null;
      return;
    }
    toast(remap(G.capture.p, G.capture.a, code));
    G.capture = null;
    return;
  }
  if (code === 'KeyM') {
    Snd.setOn(!Snd.on);
    toast('Sound ' + (Snd.on ? 'on' : 'off'));
    return;
  }
  if (G.screen === 'replay') {
    const R = G.rv,
      n = R.rep.frames.length;
    if (code === 'Escape' || code === 'Enter' || code === 'KeyR') {
      closeReplay();
    } else if (code === 'Space') {
      R.playing = !R.playing;
      if (R.i >= n - 1) R.i = R.start;
      R.auto = false;
    } else if (code === 'ArrowLeft') {
      R.playing = false;
      R.auto = false;
      R.i = Math.max(0, Math.floor(R.i) - 1);
    } else if (code === 'ArrowRight') {
      R.playing = false;
      R.auto = false;
      R.i = Math.min(n - 1, Math.floor(R.i) + 1);
    } else if (code === 'ArrowUp') R.speed = cyc([0.25, 0.5, 1, 2], R.speed, 1);
    else if (code === 'ArrowDown') R.speed = cyc([0.25, 0.5, 1, 2], R.speed, -1);
    else if (code === 'Digit1') R.speed = 0.25;
    else if (code === 'Digit2') R.speed = 0.5;
    else if (code === 'Digit3') R.speed = 1;
    else if (code === 'Digit4') R.speed = 2;
    else if (code === 'KeyT') R.traj = !R.traj;
    else if (code === 'Home') {
      R.i = 0;
    }
    return;
  }
  if (G.screen === 'match') {
    const m = G.match,
      o = m.o;
    if (m.state === 'puzzleEnd') {
      if (code === 'Escape') {
        G.screen = 'puzzles';
        G.match = null;
        RNG = Math.random;
      } else if (code === 'Backspace' || (code === 'Enter' && !m.puzzleRes.ok)) startPuzzle(G.pz.i, true);
      else if (code === 'Enter' && m.puzzleRes.ok) {
        if (G.pz.i < PUZZLES.length - 1) startPuzzle(G.pz.i + 1);
        else {
          G.screen = 'puzzles';
          G.match = null;
        }
      } else if (code === 'KeyH') G.pz.hint = !G.pz.hint;
      else if (code === 'KeyR' && m.replays.length) G.openReplay(m, m.replays.length - 1, false);
      return;
    }
    if (code === 'Escape') {
      if (m.state !== 'victory') {
        G.paused = !G.paused;
        G.pidx = 0;
      }
      return;
    }
    if (G.paused) {
      menuKey(code, pauseItems(), 'pidx');
      return;
    }
    if (code === 'KeyR' && m.state !== 'fencing' && m.replays.length) {
      G.openReplay(m, m.replays.length - 1, false);
      return;
    }
    if ((m.state === 'break' || m.state === 'intro') && (code === 'Enter' || code === 'NumpadEnter')) {
      if (m.state === 'break') m.breakT = 0;
      else m.st = 99;
      return;
    }
    if (o.training) {
      if (code === 'KeyT') {
        m.setDrill((m.drill + 1) % DRILLS.length);
        return;
      }
      if (code === 'Backspace') {
        m.newBout();
        return;
      }
    }
    if (o.puzzle) {
      if (code === 'Backspace') {
        startPuzzle(G.pz.i, true);
        return;
      }
      if (code === 'KeyH') {
        G.pz.hint = !G.pz.hint;
        return;
      }
    }
    if (o.sandbox) {
      const ks = Object.keys(G.dbg);
      const dg = /^Digit([1-8])$/.exec(code);
      if (dg) {
        const k = ks[+dg[1] - 1];
        G.dbg[k] = !G.dbg[k];
        return;
      }
      if (code === 'BracketLeft') {
        G.speed = cyc([0.25, 0.5, 0.75, 1], G.speed, -1);
        return;
      }
      if (code === 'BracketRight') {
        G.speed = cyc([0.25, 0.5, 0.75, 1], G.speed, 1);
        return;
      }
    }
    if (m.state === 'fencing' || (m.state === 'countdown' && m.st > 1.2))
      for (const c of m.c) if (c.kind === 'human') c.press(code, m.time);
    return;
  }
  if (G.screen === 'results') {
    const R = G.res;
    if (code === 'Tab' || code === 'KeyE') {
      R.tab = (R.tab + 1) % TABS.length;
      return;
    }
    if (code === 'KeyQ') {
      R.tab = (R.tab + TABS.length - 1) % TABS.length;
      return;
    }
    if (R.tab === 3 && (code === 'ArrowUp' || code === 'ArrowDown')) {
      const L = R.m.log;
      R.sel = clamp((R.sel < 0 ? R.scroll : R.sel) + (code === 'ArrowDown' ? 1 : -1), 0, L.length - 1);
      if (R.sel < R.scroll) R.scroll = R.sel;
      if (R.sel > R.scroll + 12) R.scroll = R.sel - 12;
      return;
    }
    if (R.tab === 3 && code === 'Enter' && R.sel >= 0) {
      const e = R.m.log[R.sel];
      if (e && e.rep != null && R.m.replays[e.rep]) {
        G.openReplay(R.m, e.rep, false);
        return;
      }
    }
    if (code === 'ArrowLeft' || code === 'ArrowRight') {
      const it = resultItems();
      G.ridx = (G.ridx + (code === 'ArrowRight' ? 1 : it.length - 1)) % it.length;
      return;
    }
    if (code === 'Escape') {
      toTitle();
      return;
    }
    menuKey(code, resultItems(), 'ridx');
    return;
  }
  if (G.screen === 'ceremony') {
    if (code === 'Enter' || code === 'Space' || code === 'Escape') G.screen = G.afterCer || 'title';
    return;
  }
  if (G.screen === 'howto') {
    if (code === 'ArrowRight' || code === 'KeyD') G.howPage = Math.min(HOW.length - 1, G.howPage + 1);
    else if (code === 'ArrowLeft' || code === 'KeyA') G.howPage = Math.max(0, G.howPage - 1);
    else if (code === 'Escape' || code === 'Enter') toTitle();
    return;
  }
  if (G.screen === 'ratings') {
    if (code === 'Escape' || code === 'Enter') {
      G.screen = G.back === 'career' ? 'career' : 'title';
      G.back = null;
    }
    return;
  }
  if (G.screen === 'controls') {
    const n = ACTION_LIST.length,
      tot = 2 * n + 2;
    if (code === 'Escape') {
      G.screen = 'settings';
      return;
    }
    if (code === 'ArrowUp') G.kidx = (G.kidx + tot - 1) % tot;
    else if (code === 'ArrowDown') G.kidx = (G.kidx + 1) % tot;
    else if (code === 'ArrowRight' && G.kidx < n) G.kidx += n;
    else if (code === 'ArrowLeft' && G.kidx >= n && G.kidx < 2 * n) G.kidx -= n;
    else if (code === 'Enter') controlsAct(G.kidx);
    return;
  }
  if (G.screen === 'ghosts') {
    const it = ghostItems()[G.gidx];
    if (it && it.ghost != null) {
      if (code === 'KeyE') {
        openModal('export', getGhosts()[it.ghost]);
        return;
      }
      if (code === 'Delete' || code === 'Backspace') {
        const gi = it.ghost;
        G.confirm = {
          text: 'Delete this ghost?',
          yes: () => {
            const a = getGhosts();
            a.splice(gi, 1);
            saveGhosts(a);
          }
        };
        return;
      }
    }
  }
  if (code === 'Escape' && G.screen !== 'title') {
    if (G.screen === 'careerNew' && getCareer()) G.screen = 'career';
    else if (G.screen === 'careerBracket') G.screen = 'career';
    else toTitle();
    return;
  }
  const si = screenItems();
  if (si) menuKey(code, si[0], si[1]);
}
addEventListener('keydown', e => {
  if (G.modal) {
    if (e.code === 'Escape') {
      G.modal.remove();
      G.modal = null;
    }
    return;
  }
  if (PREVENT.has(e.code) || e.code.startsWith('Numpad')) e.preventDefault();
  Snd.init();
  keys.add(e.code);
  if (!e.repeat) onKey(e.code, e);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function mpos(e) {
  const r = cv.getBoundingClientRect();
  return P(((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H);
}
cv.addEventListener('mousemove', e => {
  G.mouse = mpos(e);
  G.mouseIn = true;
  for (const r of G.rects)
    if (r.items && G.mouse.x >= r.x && G.mouse.x <= r.x + r.w && G.mouse.y >= r.y && G.mouse.y <= r.y + r.h)
      G[r.key] = r.i;
});
cv.addEventListener('mouseleave', () => {
  G.mouseIn = false;
});
cv.addEventListener(
  'wheel',
  e => {
    if (G.screen === 'results' && G.res.tab === 3) {
      G.res.scroll = Math.max(0, (G.res.scroll || 0) + (e.deltaY > 0 ? 2 : -2));
      e.preventDefault();
    }
  },
  { passive: false }
);
cv.addEventListener('mousedown', e => {
  Snd.init();
  cv.focus();
  if (G.modal) return;
  const p = mpos(e);
  if (G.confirm) {
    const y = G.confirm.yes;
    G.confirm = null;
    if (p.y > 260 && p.y < 440) y();
    return;
  }
  for (const r of G.rects)
    if (p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h) {
      if (r.key === 'restab') {
        G.res.tab = r.i;
        return;
      }
      if (r.key === 'tl') {
        G.res.sel = r.i;
        const e2 = G.res.m.log[r.i];
        if (e2 && e2.rep != null && G.res.m.replays[e2.rep]) G.openReplay(G.res.m, e2.rep, false);
        return;
      }
      if (r.key === 'kidx') {
        G.kidx = r.i;
        controlsAct(r.i);
        return;
      }
      G[r.key] = r.i;
      const it = r.items[r.i];
      Snd.beep(990, 0.06, 0.06);
      if (it.f) it.f();
      else if (it.lr) it.lr(1);
      return;
    }
});
/* ---------- loop ---------- */
function render() {
  G.rects = [];
  g.setTransform(S, 0, 0, S, 0, 0);
  const sc = G.screen;
  if (sc === 'replay') {
    drawReplay();
  } else {
    const m = sc === 'match' || sc === 'results' ? G.match : G.demo;
    drawWorld(m);
    g.setTransform(S, 0, 0, S, 0, 0);
    if (sc === 'match') {
      drawHUD(G.match);
      drawOverlay(G.match);
      if (G.paused) drawPause();
    } else if (sc === 'results') drawResults();
    else if (sc === 'title') drawTitle();
    else if (sc === 'howto') drawHowto();
    else if (sc === 'settings') drawSettings();
    else if (sc === 'controls') drawControls();
    else if (sc === 'bracket') drawBracket();
    else if (sc === 'puzzles') drawPuzzles();
    else if (sc === 'sandbox') drawSandbox();
    else if (sc === 'ghosts') drawGhosts();
    else if (sc === 'ratings') drawRatings();
    else if (sc === 'careerNew') drawCareerNew();
    else if (sc === 'career') drawCareer();
    else if (sc === 'careerBracket') drawCareerBracket();
    else if (sc === 'ceremony') drawCeremony();
  }
  if (G.confirm) drawConfirm();
  drawToast();
}
function tick(dt) {
  G.t += dt;
  const sc = G.screen;
  if (sc === 'match') {
    if (!G.paused && !G.confirm) {
      G.simAcc += G.speed;
      while (G.simAcc >= 1) {
        G.match.step(dt);
        G.simAcc -= 1;
        if (G.screen !== 'match') break;
      }
    }
  } else if (sc === 'replay') {
    const R = G.rv,
      n = R.rep.frames.length;
    if (R.playing) {
      R.i += R.speed;
      if (R.i >= n - 1) {
        R.i = n - 1;
        R.playing = false;
        if (R.auto) closeReplay();
      }
    }
  } else if (sc === 'results') {
    G.match.step(dt);
  } else G.demo.step(dt);
}
let last = performance.now(),
  acc = 0;
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;
  let n = 0;
  while (acc >= DT && n < 6) {
    tick(DT);
    acc -= DT;
    n++;
  }
  if (n >= 6) acc = 0;
  render();
  requestAnimationFrame(frame);
}
G.demo = new Match({
  demo: true,
  weapon: 'epee',
  arena: 'grandprix',
  target: Infinity,
  periods: 1,
  periodLen: 0,
  ctrls: [new AI(1, 'balanced'), new AI(2, 'phantom')],
  names: ['BLUE', 'RED']
});
resize();
addEventListener('resize', resize);
cv.focus();
requestAnimationFrame(frame);
window.__FENCING = {
  G,
  startMatch,
  startPuzzle,
  startSandbox,
  startGhost,
  startCareerBout,
  startTour,
  tick,
  render,
  onKey,
  keys,
  Match,
  AI,
  Dummy,
  Human,
  Fencer,
  PUZZLES,
  PERS,
  LV,
  RULES,
  CFG,
  Store,
  analyze,
  coach,
  validateGhost,
  getCareer,
  newCareer,
  saveCareer,
  careerStart,
  setRNG: f => {
    RNG = f;
  },
  mulberry,
  DRILLS,
  BehaviorGhost,
  RecordedGhost,
  Recorder,
  emptyProfile,
  getGhosts,
  saveGhosts,
  getRatings
};

}

