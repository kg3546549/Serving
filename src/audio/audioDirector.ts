type ToneStep = {
  frequency: number;
  duration: number;
  delay?: number;
  type?: OscillatorType;
  gain?: number;
};

let audioContext: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") {
    return null;
  }

  audioContext ??= new AudioContext();
  return audioContext;
}

function playTone(step: ToneStep): void {
  const context = getContext();
  if (!context) {
    return;
  }

  const startAt = context.currentTime + (step.delay ?? 0);
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = step.type ?? "sine";
  oscillator.frequency.setValueAtTime(step.frequency, startAt);
  gainNode.gain.setValueAtTime(0.0001, startAt);
  gainNode.gain.exponentialRampToValueAtTime(step.gain ?? 0.045, startAt + 0.015);
  gainNode.gain.exponentialRampToValueAtTime(
    0.0001,
    startAt + step.duration,
  );

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + step.duration + 0.03);
}

export async function unlockAudio(): Promise<void> {
  const context = getContext();
  if (context?.state === "suspended") {
    await context.resume();
  }
}

export function playWaveStart(): void {
  playTone({ frequency: 180, duration: 0.12, type: "sawtooth" });
  playTone({
    frequency: 420,
    duration: 0.16,
    delay: 0.09,
    type: "triangle",
  });
}

export function playUiTap(): void {
  playTone({
    frequency: 540,
    duration: 0.045,
    type: "triangle",
    gain: 0.018,
  });
  playTone({
    frequency: 720,
    duration: 0.03,
    delay: 0.012,
    type: "sine",
    gain: 0.012,
  });
}

export function playWaveFailed(): void {
  playTone({ frequency: 90, duration: 0.35, type: "sawtooth", gain: 0.065 });
  playTone({
    frequency: 55,
    duration: 0.45,
    delay: 0.08,
    type: "square",
    gain: 0.025,
  });
}

export function playWaveCleared(): void {
  [261, 329, 392, 523].forEach((frequency, index) => {
    playTone({
      frequency,
      duration: 0.28,
      delay: index * 0.09,
      type: "triangle",
      gain: 0.04,
    });
  });
}
