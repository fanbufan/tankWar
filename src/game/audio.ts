import type { RuntimeEvent, RuntimeStatus } from "./runtime/types";

type OscillatorShape = OscillatorType;

interface ToneOptions {
  frequency: number;
  duration: number;
  volume: number;
  type?: OscillatorShape;
  slideTo?: number;
}

export class ArcadeAudio {
  private context?: AudioContext;
  private unlocked = false;

  public unlock(): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    void context.resume();
    this.unlocked = true;
  }

  public playRuntimeEvents(events: RuntimeEvent[]): void {
    if (!this.unlocked || events.length === 0) {
      return;
    }

    const priority = this.highestPriorityEvent(events);

    if (!priority) {
      return;
    }

    this.playEvent(priority);
  }

  public playOutcome(status: RuntimeStatus): void {
    if (!this.unlocked) {
      return;
    }

    if (status === "level-complete" || status === "victory") {
      this.sequence([
        { frequency: 392, duration: 0.09, volume: 0.05 },
        { frequency: 523, duration: 0.11, volume: 0.05 },
        { frequency: 784, duration: 0.16, volume: 0.045 },
      ]);
      return;
    }

    if (status === "defeat") {
      this.sequence([
        { frequency: 196, duration: 0.12, volume: 0.055 },
        { frequency: 147, duration: 0.14, volume: 0.05 },
        { frequency: 98, duration: 0.2, volume: 0.045 },
      ]);
    }
  }

  private playEvent(event: RuntimeEvent): void {
    if (event.type === "shot") {
      this.tone({ frequency: event.owner === "player" ? 720 : 520, slideTo: 280, duration: 0.055, volume: 0.035, type: "square" });
      return;
    }

    if (event.type === "enemy-spawned") {
      this.sequence([
        { frequency: 330, duration: 0.045, volume: 0.03, type: "square" },
        { frequency: 494, duration: 0.055, volume: 0.028, type: "square" },
      ]);
      return;
    }

    if (event.type === "powerup-collected") {
      this.sequence([
        { frequency: 660, duration: 0.045, volume: 0.04 },
        { frequency: 990, duration: 0.07, volume: 0.035 },
      ]);
      return;
    }

    if (event.type === "bonus-life") {
      this.sequence([
        { frequency: 784, duration: 0.055, volume: 0.04 },
        { frequency: 1047, duration: 0.075, volume: 0.036 },
        { frequency: 1319, duration: 0.1, volume: 0.032 },
      ]);
      return;
    }

    if (event.type === "enemy-destroyed") {
      this.noise(0.085, 0.04);
      this.tone({ frequency: 150, slideTo: 92, duration: 0.11, volume: 0.035, type: "sawtooth" });
      return;
    }

    if (event.type === "powerup-spawned") {
      this.sequence([
        { frequency: 880, duration: 0.04, volume: 0.032 },
        { frequency: 1175, duration: 0.05, volume: 0.03 },
      ]);
      return;
    }

    if (event.type === "player-stunned") {
      this.sequence([
        { frequency: 260, duration: 0.05, volume: 0.04, type: "square" },
        { frequency: 210, duration: 0.06, volume: 0.04, type: "square" },
      ]);
      return;
    }

    if (event.type === "life-lost" || event.type === "base-destroyed") {
      this.noise(0.28, 0.065);
      this.tone({ frequency: 120, slideTo: 58, duration: 0.28, volume: 0.045, type: "sawtooth" });
      return;
    }

    if (event.type === "explosion") {
      this.noise(0.11, 0.045);
      return;
    }

    if (event.type === "hit") {
      this.tone({ frequency: 180, duration: 0.035, volume: 0.035, type: "triangle" });
    }
  }

  private highestPriorityEvent(events: RuntimeEvent[]): RuntimeEvent | undefined {
    const priority = ["base-destroyed", "life-lost", "bonus-life", "powerup-collected", "powerup-spawned", "player-stunned", "enemy-destroyed", "explosion", "hit", "enemy-spawned", "shot", "level-complete"];

    return [...events].sort((first, second) => priority.indexOf(first.type) - priority.indexOf(second.type))[0];
  }

  private sequence(tones: ToneOptions[]): void {
    let offset = 0;

    for (const tone of tones) {
      this.tone(tone, offset);
      offset += tone.duration;
    }
  }

  private tone(options: ToneOptions, offset = 0): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    const start = context.currentTime + offset;
    const end = start + options.duration;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = options.type ?? "square";
    oscillator.frequency.setValueAtTime(options.frequency, start);

    if (options.slideTo !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, options.slideTo), end);
    }

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(options.volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(end + 0.01);
  }

  private noise(duration: number, volume: number): void {
    const context = this.getContext();

    if (!context) {
      return;
    }

    const sampleRate = context.sampleRate;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let index = 0; index < frameCount; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / frameCount);
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = context.currentTime;
    const end = start + duration;

    source.buffer = buffer;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(gain);
    gain.connect(context.destination);
    source.start(start);
    source.stop(end);
  }

  private getContext(): AudioContext | undefined {
    if (this.context) {
      return this.context;
    }

    if (typeof window === "undefined") {
      return undefined;
    }

    const AudioContextConstructor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextConstructor) {
      return undefined;
    }

    this.context = new AudioContextConstructor();
    return this.context;
  }
}
