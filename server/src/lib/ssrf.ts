import { lookup } from 'dns/promises';
import { isIP } from 'net';

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  return false;
};

export const assertSafeRemoteUrl = async (
  urlString: string,
  opts?: { allowPrivate?: boolean }
): Promise<URL> => {
  const url = new URL(urlString);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Invalid protocol');
  }

  const host = url.hostname;
  const allowPrivate = opts?.allowPrivate === true;

  if (!allowPrivate) {
    const directIpVersion = isIP(host);
    const addresses =
      directIpVersion > 0 ? [{ address: host }] : await lookup(host, { all: true, verbatim: true });

    for (const { address } of addresses) {
      const version = isIP(address);
      if (version === 4 && isPrivateIpv4(address)) throw new Error('Blocked host');
      if (version === 6 && isPrivateIpv6(address)) throw new Error('Blocked host');
    }
  }

  return url;
};

