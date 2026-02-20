import type { Tile } from '../types/tile';

export function isSameTile(a: Tile, b: Tile): boolean {
  return a.suit === b.suit && a.value === b.value;
}

const suitNames: Record<string, string> = {
  wan: '万',
  tong: '饼',
  tiao: '条',
};

const numberNames: Record<number, string> = {
  1: '一', 2: '二', 3: '三', 4: '四', 5: '五',
  6: '六', 7: '七', 8: '八', 9: '九',
};

const honorNames: Record<string, string> = {
  east: '东风',
  south: '南风',
  west: '西风',
  north: '北风',
  red: '红中',
  green: '发财',
  white: '白板',
};

export function getTileChineseName(tile: Tile): string {
  if (tile.suit === 'wan' || tile.suit === 'tong' || tile.suit === 'tiao') {
    return `${numberNames[tile.value as number]}${suitNames[tile.suit]}`;
  }
  if (tile.suit === 'wind' || tile.suit === 'dragon') {
    return honorNames[tile.value as string] ?? String(tile.value);
  }
  if (tile.suit === 'flower') {
    return '花';
  }
  return `${tile.suit} ${tile.value}`;
}

export function speakTileName(tile: Tile): void {
  speakChinese(getTileChineseName(tile));
}

let cachedVoice: SpeechSynthesisVoice | null = null;

function getChineseVoice(): SpeechSynthesisVoice | null {
  if (cachedVoice) return cachedVoice;
  const voices = speechSynthesis.getVoices();
  const chineseVoices = voices.filter(v => v.lang.startsWith('zh'));
  // Prefer Microsoft Xiaoxiao Online (Natural), fall back to first Chinese voice
  cachedVoice =
    chineseVoices.find(v => v.name.includes('Xiaoxiao')) ??
    chineseVoices.find(v => v.lang.startsWith('zh-CN')) ??
    chineseVoices[0] ??
    null;
  return cachedVoice;
}

// Refresh cached voice when voices load asynchronously
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  speechSynthesis.onvoiceschanged = () => {
    cachedVoice = null;
    getChineseVoice();
  };
}

export function speakChinese(text: string): void {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  const voice = getChineseVoice();
  if (voice) utterance.voice = voice;
  utterance.rate = 1.1;
  utterance.pitch = 1.5;
  utterance.volume = 0.8;
  window.speechSynthesis.speak(utterance);
}
