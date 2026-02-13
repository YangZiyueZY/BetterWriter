import type { Settings } from '../types';

export function getEyeCareModalBackgroundColor(settings: Settings): string | undefined {
  if (settings.darkMode) return undefined;
  if (settings.backgroundImage) return undefined;
  const color = settings.backgroundColor;
  if (!color) return undefined;

  const match = color.match(/rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i);
  if (!match) return undefined;
  const r = Math.min(255, Math.max(0, Number(match[1])));
  const g = Math.min(255, Math.max(0, Number(match[2])));
  const b = Math.min(255, Math.max(0, Number(match[3])));
  return `rgba(${r}, ${g}, ${b}, 0.95)`;
}

export function sanitizeBackgroundImageUrl(raw: string | undefined | null): string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  if (value.length > 2048) return undefined;
  if (/[\r\n\t]/.test(value)) return undefined;

  try {
    const url = new URL(value, window.location.href);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}

export function toCssUrlValue(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;
  const escaped = rawUrl.replace(/["\\]/g, '\\$&');
  return `url("${escaped}")`;
}

export function sanitizeFontFamilyCss(raw: string | undefined | null): string | undefined {
  const value = (raw ?? '').trim();
  if (!value) return undefined;
  if (value.length > 256) return undefined;
  return value.replace(/[\r\n\t;]/g, ' ').replace(/[{}]/g, '').trim();
}

