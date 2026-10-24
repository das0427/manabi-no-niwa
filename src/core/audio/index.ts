import { useSyncExternalStore } from 'react';
import {
  createAudioEngine,
  type AudioApi,
  type AudioContextLike,
  type AudioState,
  type SpeechLike,
} from './engine';
import { watchPageHide } from './watch';

export type { AudioState, SfxName } from './engine';

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

function browserSpeech(): SpeechLike | null {
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    return null;
  }
  return {
    synth: speechSynthesis,
    createUtterance: (text: string) => new SpeechSynthesisUtterance(text),
  } as unknown as SpeechLike;
}

export const audio: AudioApi = createAudioEngine({
  createContext() {
    const Ctor = window.AudioContext ?? (window as WebkitWindow).webkitAudioContext;
    if (!Ctor) throw new Error('AudioContext is not available');
    return new Ctor() as unknown as AudioContextLike;
  },
  async fetchBytes(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
    return res.arrayBuffer();
  },
  speech: browserSpeech(),
  baseUrl: import.meta.env.BASE_URL,
  isDev: import.meta.env.DEV,
  watch: (cb) => watchPageHide(document, window, cb),
});

export function useAudioState(): AudioState {
  return useSyncExternalStore(audio.subscribe, audio.getState, audio.getState);
}
