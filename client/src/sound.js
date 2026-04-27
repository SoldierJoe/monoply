// Tiny WebAudio sound bank — no external assets. Each sound is a short
// synthesized tone or noise burst. Sounds default to ON; toggle with
// `setSoundEnabled(false)` if you want to mute.

let ctx = null;
let enabled = true;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

export function setSoundEnabled(v) { enabled = v; }
export function isSoundEnabled() { return enabled; }

function tone({ freq = 440, duration = 0.15, type = 'sine', gain = 0.15, sweepTo = null }) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  if (sweepTo !== null) {
    osc.frequency.exponentialRampToValueAtTime(sweepTo, ac.currentTime + duration);
  }
  g.gain.value = gain;
  g.gain.setValueAtTime(gain, ac.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  osc.connect(g).connect(ac.destination);
  osc.start();
  osc.stop(ac.currentTime + duration);
}

function noise({ duration = 0.2, gain = 0.08 }) {
  if (!enabled) return;
  const ac = getCtx();
  if (!ac) return;
  const buf = ac.createBuffer(1, ac.sampleRate * duration, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
  const src = ac.createBufferSource();
  const g = ac.createGain();
  src.buffer = buf;
  g.gain.value = gain;
  g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + duration);
  src.connect(g).connect(ac.destination);
  src.start();
  src.stop(ac.currentTime + duration);
}

export const sfx = {
  diceRoll() { noise({ duration: 0.35, gain: 0.05 }); tone({ freq: 220, duration: 0.05, type: 'square', gain: 0.05 }); },
  move() { tone({ freq: 660, duration: 0.06, type: 'triangle', gain: 0.06 }); },
  buy() { tone({ freq: 440, duration: 0.08, type: 'triangle', gain: 0.1, sweepTo: 880 }); },
  rent() { tone({ freq: 330, duration: 0.12, type: 'sawtooth', gain: 0.08, sweepTo: 220 }); },
  jail() { tone({ freq: 200, duration: 0.3, type: 'square', gain: 0.08, sweepTo: 90 }); },
  win() {
    tone({ freq: 523, duration: 0.15, type: 'triangle', gain: 0.1 });
    setTimeout(() => tone({ freq: 659, duration: 0.15, type: 'triangle', gain: 0.1 }), 150);
    setTimeout(() => tone({ freq: 784, duration: 0.3, type: 'triangle', gain: 0.1 }), 300);
  },
  bankrupt() { tone({ freq: 220, duration: 0.4, type: 'sawtooth', gain: 0.1, sweepTo: 80 }); },
  yourTurn() { tone({ freq: 880, duration: 0.08, type: 'sine', gain: 0.07 }); },
};
