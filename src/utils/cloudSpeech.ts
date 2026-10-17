import { aiApiJson, aiApiFetch, AiApiError } from './aiApi';

/**
 * Converts a Blob to a base64 string.
 */
export const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data URL scheme prefix if present
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Transcribes an audio blob through the secure voice relay.
 */
export const transcribeAudio = async (blob: Blob): Promise<string> => {
  const base64 = await blobToBase64(blob);
  const payload = { audio: base64, mimeType: blob.type || 'audio/webm' };
  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await aiApiJson<{ text: string }>('ai/speech-transcribe', payload);
      return (response.text || '').trim();
    } catch (error) {
      lastError = error;
      const status = error instanceof AiApiError ? error.status : 0;
      const retryable = status === 500 || status === 502 || status === 503 || status === 504;
      if (!retryable || attempt === 1) throw error;
      await new Promise(resolve => window.setTimeout(resolve, 700));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Voice input is temporarily unavailable.');
};

/**
 * Synthesizes text to speech audio through the secure voice relay.
 * Returns an object URL that can be played with HTMLAudioElement.
 */
const ttsCache = new Map<string, string>();

const prepareSpeechText = (text: string): string => text
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/[*_`#>|]/g, ' ')
  // Piper ignores raw line breaks, so use sentence boundaries for natural pauses.
  .replace(/\r?\n+/g, '. ')
  .replace(/[.!?;:]+/g, '. ')
  .replace(/[,()[\]{}"'“”‘’…—–/\\-]+/g, ' ')
  .replace(/[ \t]+/g, ' ')
  .trim()
  .slice(0, 800);

export const splitSpeechText = (text: string): string[] => prepareSpeechText(text)
  .split(/(?<=[.!?])\s+/)
  .map((part) => part.trim())
  .filter(Boolean);

export const synthesizeSpeech = async (text: string): Promise<string> => {
  const speechText = prepareSpeechText(text);
  if (!speechText) throw new Error('There is no readable text in this answer.');
  const cachedUrl = ttsCache.get(speechText);
  if (cachedUrl) return cachedUrl;

  const response = await aiApiFetch('ai/speech-synthesize', {
    method: 'POST',
    body: JSON.stringify({ text: speechText }),
  });
  const blob = await response.blob();
  const audioUrl = URL.createObjectURL(blob);
  ttsCache.set(speechText, audioUrl);
  return audioUrl;
};

/**
 * Gets best supported recording mimeType on current browser.
 */
export const getBestAudioMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
    'audio/wav',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return '';
};

export interface SilenceDetectorOptions {
  /** RMS amplitude (0..1) that separates speech from background noise. */
  silenceThreshold?: number;
  /** How long the user must stay quiet before the recording auto-stops. */
  silenceDurationMs?: number;
  /** Give up if the user never starts speaking within this window. */
  noSpeechTimeoutMs?: number;
  /** Absolute upper bound for a single recording. */
  maxDurationMs?: number;
  /** Speech must last at least this long before auto-stop is armed. */
  minSpeechMs?: number;
  onSilence: () => void;
  /** Fires when the absolute recording limit is reached. */
  onMaxDuration?: () => void;
  onVolumeChange?: (volume: number) => void;
  onWaveformChange?: (levels: number[]) => void;
}

export interface SilenceDetectorController {
  stop: () => void;
}

/**
 * Monitors the microphone stream using time-domain RMS and automatically fires
 * onSilence once the user has finished speaking.
 *
 * Uses an adaptive noise floor so that a noisy environment does not prevent the
 * detector from ever registering silence, and a time-domain RMS measurement
 * (rather than an averaged FFT magnitude) so that quiet speech is still picked
 * up while true silence reliably triggers the stop.
 */
export const createSilenceDetector = (
  stream: MediaStream,
  options: SilenceDetectorOptions
): SilenceDetectorController => {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    return { stop: () => {} };
  }

  let audioContext: AudioContext;
  try {
    audioContext = new AudioContextClass();
  } catch {
    return { stop: () => {} };
  }

  // Autoplay policies can create the context in a suspended state; without this
  // the analyser returns all-zero samples and silence is never detected.
  try {
    void audioContext.resume().catch(() => {});
  } catch {
    // ignore
  }

  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.5;

  let source: MediaStreamAudioSourceNode;
  try {
    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
  } catch {
    try { audioContext.close(); } catch { /* ignore */ }
    return { stop: () => {} };
  }

  const timeData = new Uint8Array(analyser.fftSize);
  const baseThreshold = options.silenceThreshold ?? 0.02;
  const silenceLimit = options.silenceDurationMs ?? 1500;
  const noSpeechLimit = options.noSpeechTimeoutMs ?? 6000;
  const maxLimit = options.maxDurationMs ?? 30000;
  const minSpeechMs = options.minSpeechMs ?? 250;

  let hasSpoken = false;
  let speechStartedAt = 0;
  let lastSpeechTime = Date.now();
  const startTime = Date.now();
  let noiseFloor = 0.006;
  let isStopped = false;
  let timerId: number | null = null;

  const getRms = () => {
    analyser.getByteTimeDomainData(timeData);
    let sum = 0;
    for (let i = 0; i < timeData.length; i++) {
      const sample = (timeData[i] - 128) / 128;
      sum += sample * sample;
    }
    return Math.sqrt(sum / timeData.length);
  };

  const stop = () => {
    if (isStopped) return;
    isStopped = true;
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
    try {
      source.disconnect();
      audioContext.close();
    } catch {
      // ignore
    }
  };

  const finish = (reason: 'silence' | 'max') => {
    if (isStopped) return;
    stop();
    if (reason === 'max') options.onMaxDuration?.();
    else options.onSilence();
  };

  const checkAudio = () => {
    if (isStopped) return;

    const rms = getRms();
    options.onVolumeChange?.(rms);
    if (options.onWaveformChange) {
      const levels = Array.from({ length: 14 }, (_, index) => {
        const start = Math.floor(index * timeData.length / 14);
        const end = Math.floor((index + 1) * timeData.length / 14);
        let peak = 0;
        for (let sampleIndex = start; sampleIndex < end; sampleIndex++) {
          peak = Math.max(peak, Math.abs(timeData[sampleIndex] - 128) / 128);
        }
        return Math.min(1, peak);
      });
      options.onWaveformChange(levels);
    }

    const now = Date.now();
    // Adaptive threshold: always above the ambient noise floor, but never more
    // than twice the configured base threshold so real speech is not missed.
    const threshold = Math.max(baseThreshold, noiseFloor * 2);

    if (rms >= threshold) {
      if (!hasSpoken) {
        hasSpoken = true;
        speechStartedAt = now;
      }
      lastSpeechTime = now;
    } else {
      // Only adapt the noise floor while quiet, and cap it at the base
      // threshold so a loud environment cannot push the gate out of reach.
      noiseFloor = Math.min(noiseFloor * 0.96 + rms * 0.04, baseThreshold);

      if (
        hasSpoken &&
        now - speechStartedAt >= minSpeechMs &&
        now - lastSpeechTime > silenceLimit
      ) {
        finish('silence');
        return;
      }

      if (!hasSpoken && now - startTime > noSpeechLimit) {
        finish('silence');
        return;
      }
    }

    if (now - startTime > maxLimit) {
      finish('max');
      return;
    }

    timerId = window.setTimeout(checkAudio, 80);
  };

  timerId = window.setTimeout(checkAudio, 80);

  return { stop };
};
