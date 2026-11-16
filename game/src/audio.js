// All sound is synthesized with WebAudio: no audio files, nothing to load. Short oscillator
// blips and filtered noise make the effects; a slow two-voice arpeggio is the music. The
// context is created lazily on the first user gesture, as browsers require, and M mutes.

const MUSIC_NOTES = [220, 261.63, 329.63, 392, 329.63, 261.63]; // A C E G E C, a calm loop
const BASS_NOTES = [110, 130.81, 98, 164.81];

export class SoundBank {
  constructor() {
    this.context = null;
    this.master = null;
    this.muted = false;
    this.musicStep = 0;
    this.musicTimer = 0;
    this.musicOn = false;
  }

  /** Create the context on a user gesture; safe to call every frame. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    this.context = new AudioCtor();
    this.master = this.context.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.context.destination);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  /** One oscillator note with an envelope; slideTo bends its pitch over the note's life. */
  tone(freq, seconds, { type = 'sine', volume = 0.2, slideTo = null, delay = 0 } = {}) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const osc = this.context.createOscillator();
    const gain = this.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + seconds);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(volume, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain).connect(this.master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.05);
  }

  /** A burst of white noise through a band-pass: footsteps of static for thuds and poofs. */
  noise(seconds, { freq = 800, volume = 0.15, delay = 0 } = {}) {
    if (!this.context || this.muted) return;
    const t0 = this.context.currentTime + delay;
    const length = Math.max(1, Math.floor(this.context.sampleRate * seconds));
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = this.context.createGain();
    gain.gain.value = volume;
    source.connect(filter).connect(gain).connect(this.master);
    source.start(t0);
  }

  jump() { this.tone(320, 0.16, { type: 'square', volume: 0.08, slideTo: 640 }); }
  shard() {
    this.tone(1318, 0.09, { type: 'sine', volume: 0.16 });
    this.tone(1760, 0.14, { type: 'sine', volume: 0.14, delay: 0.05 });
  }
  stomp() {
    this.noise(0.12, { freq: 300, volume: 0.25 });
    this.tone(160, 0.12, { type: 'sine', volume: 0.2, slideTo: 60 });
  }
  hurt() { this.tone(220, 0.25, { type: 'sawtooth', volume: 0.14, slideTo: 90 }); }
  spring() { this.tone(240, 0.22, { type: 'square', volume: 0.09, slideTo: 880 }); }
  checkpoint() {
    this.tone(784, 0.12, { type: 'triangle', volume: 0.16 });
    this.tone(1046, 0.2, { type: 'triangle', volume: 0.16, delay: 0.09 });
  }
  goal() {
    [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, { type: 'triangle', volume: 0.16, delay: i * 0.09 }));
  }
  win() {
    [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', volume: 0.15, delay: i * 0.13 }));
  }
  over() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.32, { type: 'triangle', volume: 0.15, delay: i * 0.16 }));
  }

  /** Advance the music loop; call once a frame with the frame's seconds while playing. */
  updateMusic(dt, playing) {
    if (!this.context || this.muted) return;
    this.musicOn = playing;
    if (!playing) return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    this.musicTimer = 0.24;
    const step = this.musicStep;
    this.musicStep += 1;
    this.tone(MUSIC_NOTES[step % MUSIC_NOTES.length], 0.3, { type: 'triangle', volume: 0.045 });
    if (step % 2 === 0) this.tone(BASS_NOTES[(step / 2) % BASS_NOTES.length], 0.44, { type: 'sine', volume: 0.05 });
  }
}
