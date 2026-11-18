// All sound is synthesized with WebAudio: no audio files, no network, nothing to load.
// A tiny synth builds blips, noise bursts and a slow arpeggio loop. Audio starts only after
// the player's first gesture (the browser's autoplay rule), and M mutes everything.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A minor arpeggio that drifts under the game; the bass note changes each wave.
  const MELODY = [220, 261.63, 329.63, 392, 329.63, 261.63, 196, 261.63];
  const BASS = [55, 55, 65.41, 49, 55, 65.41, 73.42, 49];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.12;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = null) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function startMusic() {
    if (!ctx || musicTimer !== null) return;
    musicTimer = setInterval(() => {
      if (muted || !ctx) return;
      const step = musicStep % 8;
      const note = MELODY[step];
      const bass = BASS[step];
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.5, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.55);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(t0);
      osc.stop(t0 + 0.6);
      if (step === 0) {
        const b = ctx.createOscillator();
        const bg = ctx.createGain();
        b.type = 'triangle';
        b.frequency.setValueAtTime(bass, t0);
        bg.gain.setValueAtTime(0.0001, t0);
        bg.gain.exponentialRampToValueAtTime(0.6, t0 + 0.05);
        bg.gain.exponentialRampToValueAtTime(0.001, t0 + 1.8);
        b.connect(bg);
        bg.connect(musicGain);
        b.start(t0);
        b.stop(t0 + 1.9);
      }
      musicStep += 1;
    }, 340);
  }

  return {
    unlock() {
      if (ensure()) {
        if (ctx.state === 'suspended') ctx.resume();
        startMusic();
      }
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 0.07, 'square', 0.08, 0, 340);
    },
    enemyShoot() {
      tone(300, 0.12, 'sawtooth', 0.05, 0, 140);
    },
    hit() {
      tone(190, 0.06, 'square', 0.1, 0, 90);
    },
    explode() {
      noise(0.28, 0.22, 900);
      tone(120, 0.25, 'sine', 0.2, 0, 40);
    },
    bossExplode() {
      noise(0.6, 0.3, 600);
      tone(90, 0.5, 'sine', 0.25, 0, 30);
      tone(180, 0.4, 'sawtooth', 0.1, 0.05, 50);
    },
    pickup() {
      tone(880, 0.09, 'sine', 0.12);
      tone(1318, 0.12, 'sine', 0.1, 0.06);
    },
    powerup() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, i * 0.07));
    },
    hurt() {
      tone(160, 0.3, 'sawtooth', 0.2, 0, 60);
      noise(0.2, 0.15, 500);
    },
    dash() {
      noise(0.12, 0.1, 2400);
    },
    wave() {
      tone(392, 0.18, 'triangle', 0.14);
      tone(523, 0.18, 'triangle', 0.14, 0.12);
      tone(659, 0.3, 'triangle', 0.14, 0.24);
    },
    boss() {
      tone(98, 0.5, 'sawtooth', 0.18, 0, 49);
      tone(147, 0.5, 'sawtooth', 0.12, 0.15, 73);
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((f, i) => tone(f, 0.35, 'triangle', 0.14, i * 0.22));
    },
  };
}
