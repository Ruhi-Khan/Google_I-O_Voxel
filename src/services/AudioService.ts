class AudioService {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOscs: OscillatorNode[] = [];
  private engineGains: GainNode[] = [];
  private isInitialized = false;

  public init() {
    if (this.isInitialized) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.8;
    this.isInitialized = true;
  }

  public startCountdownSound() {
    this.init();
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // 1. ENGINE RUMBLE (Sub-bass growl - Filtered to remove buzzing)
    const rumble = this.ctx.createOscillator();
    const rumbleGain = this.ctx.createGain();
    const rumbleFilter = this.ctx.createBiquadFilter();
    
    rumble.type = 'sawtooth';
    rumble.frequency.setValueAtTime(30, now);
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(100, now); // Cut off all high buzz
    
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.3, now + 0.1);
    
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(this.masterGain);
    rumble.start();
    this.engineOscs.push(rumble);
    this.engineGains.push(rumbleGain);

    // 2. EXHAUST AIR (Smooth Noise)
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(400, now);
    noiseFilter.Q.value = 5;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.15, now + 0.1);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start();
    
    (this as any).engineNoise = noise;
    (this as any).engineNoiseFilter = noiseFilter;
    (this as any).engineNoiseGain = noiseGain;

    // 3. CYLINDER PULSE (Smooth Triangle Pulse)
    const pulse = this.ctx.createOscillator();
    const pulseGain = this.ctx.createGain();
    pulse.type = 'triangle'; // Triangle is much smoother than Square/Saw
    pulse.frequency.setValueAtTime(60, now);
    pulseGain.gain.setValueAtTime(0, now);
    pulseGain.gain.exponentialRampToValueAtTime(0.1, now + 0.1);
    pulse.connect(pulseGain);
    pulseGain.connect(this.masterGain);
    pulse.start();
    this.engineOscs.push(pulse);
    this.engineGains.push(pulseGain);
  }

  public playTickSound(count: number) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    
    // 1. CLOCK TICK (Sharp, mechanical)
    const tickOsc = this.ctx.createOscillator();
    const tickGain = this.ctx.createGain();
    
    // Use a high-pitched triangle for a cleaner 'clack' or 'tick'
    tickOsc.type = 'triangle';
    tickOsc.frequency.setValueAtTime(count <= 3 ? 800 : 400, now);
    
    tickGain.gain.setValueAtTime(0, now);
    tickGain.gain.linearRampToValueAtTime(0.4, now + 0.005);
    tickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    tickOsc.connect(tickGain);
    tickGain.connect(this.masterGain!);
    tickOsc.start(now);
    tickOsc.stop(now + 0.05);

    // 2. RACING ENGINE SHIFT (Pitch increases as we approach launch)
    const intensity = (11 - count) / 11;
    const baseFreq = 30 + (intensity * 120);
    const filterFreq = 400 + (intensity * 3000);

    this.engineOscs.forEach((osc, i) => {
      const multiplier = i === 0 ? 1 : 2;
      osc.frequency.exponentialRampToValueAtTime(baseFreq * multiplier, now + 0.2);
    });

    if ((this as any).engineNoiseFilter) {
      (this as any).engineNoiseFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 0.2);
    }
  }

  public playFinalRevelation() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;

    // Stop all engine sounds
    this.engineGains.forEach(g => g.gain.exponentialRampToValueAtTime(0.001, now + 0.1));
    if ((this as any).engineNoiseGain) {
      (this as any).engineNoiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    }

    setTimeout(() => {
      this.engineOscs.forEach(o => o.stop());
      if ((this as any).engineNoise) (this as any).engineNoise.stop();
      this.engineOscs = [];
      this.engineGains = [];
    }, 150);

    // THE BLAST
    const noise = this.ctx.createBufferSource();
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(1.0, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 2.5);
    noise.connect(noiseGain);
    noiseGain.connect(this.masterGain);
    noise.start();

    // CROWD CHEER (High frequency shimmering noise)
    const cheerFilter = this.ctx.createBiquadFilter();
    cheerFilter.type = 'highpass';
    cheerFilter.frequency.setValueAtTime(2000, now);
    const cheerGain = this.ctx.createGain();
    cheerGain.gain.setValueAtTime(0, now);
    cheerGain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    cheerGain.gain.exponentialRampToValueAtTime(0.01, now + 4);
    
    const cheerNoise = this.ctx.createBufferSource();
    cheerNoise.buffer = buffer;
    cheerNoise.connect(cheerFilter);
    cheerFilter.connect(cheerGain);
    cheerGain.connect(this.masterGain);
    cheerNoise.start(now + 0.1);

    // Success chord
    [261.63, 329.63, 392.00, 523.25].forEach((f, i) => {
      const o = this.ctx!.createOscillator();
      const g = this.ctx!.createGain();
      o.frequency.setValueAtTime(f, now);
      o.type = 'triangle';
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.3, now + 0.1);
      g.gain.exponentialRampToValueAtTime(0.01, now + 3);
      o.connect(g);
      g.connect(this.masterGain!);
      o.start();
      o.stop(now + 3);
    });
  }
}

export const audioService = new AudioService();

