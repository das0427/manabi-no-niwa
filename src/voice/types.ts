/**
 * 音声台本の型。
 * キーは音声ファイル名になる（public/audio/<key>.mp3）。使える文字は [a-z0-9._-]。
 * 値は読み上げる文。表示の文と読み方が違う場合（数字など）は { text, yomi } にする。
 * Open JTalk は「1こ」を「いちこ」と読むため、数字＋助数詞は必ずひらがなで書くか yomi を付ける。
 */
export type VoiceEntry = string | { text: string; yomi?: string; speed?: number };
export type VoiceEntries = Record<string, VoiceEntry>;

export function voiceText(e: VoiceEntry): string {
  return typeof e === 'string' ? e : e.text;
}

export function voiceYomi(e: VoiceEntry): string {
  return typeof e === 'string' ? e : (e.yomi ?? e.text);
}
