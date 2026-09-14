// src/lib/fontObfuscation.ts

// Homoglyph map: ASCII -> visually identical Unicode character
const HOMOGLYPHS: Record<string, string> = {
  a: 'а', c: 'с', e: 'е', o: 'о', p: 'р', x: 'х', y: 'у',
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  '0': 'Ο', '1': 'Ⅰ', '3': 'З',
};

const SKIP_WORDS = new Set(['io', 'AI', 'VM', 'ToS']);
const MIN_LENGTH = 3;

let cachedMaps: Record<string, string> | null = null;

export const loadFontMaps = async (): Promise<void> => {
  if (cachedMaps) return;
  return new Promise((resolve) => {
    setTimeout(() => {
      cachedMaps = HOMOGLYPHS;
      resolve();
    }, 0);
  });
};

export const getFontMaps = (): { maps: Record<string, string> | null } => {
  return { maps: cachedMaps };
};

export const shouldObfuscateDisplay = (text: string): boolean => {
  if (!text || text.length < MIN_LENGTH) return false;
  if (SKIP_WORDS.has(text.trim())) return false;
  return true;
};

export const obfuscateDisplayText = (
  text: string,
  maps: Record<string, string>
): string => {
  return text
    .split('')
    .map((char) => maps[char] ?? char)
    .join('');
};
