import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNPR(amount: number, nepali: boolean = false): string {
  if (nepali) {
    const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
    const formatted = Math.round(amount)
      .toString()
      .split('')
      .map((d) => (d >= '0' && d <= '9' ? nepaliDigits[parseInt(d, 10)] : d))
      .join('');
    return `रू ${formatted}`;
  }
  return `Rs. ${amount.toLocaleString('en-IN')}`;
}

export function formatDate(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toLocaleDateString('en-US', {
    timeZone: 'Asia/Kathmandu',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(dateInput: string | Date): string {
  const d = new Date(dateInput);
  return d.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kathmandu',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateTempPassword(length: number = 8): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

export interface CategoryConfig {
  key: string;
  name: string;
  nameNe?: string;
  icon: string;
}

export const SYSTEM_CATEGORIES: CategoryConfig[] = [
  { key: 'BED ROOM', name: 'Bed Room', nameNe: 'बेड रुम', icon: '🛏️' },
  { key: 'DRINK', name: 'Drinks', nameNe: 'पेय पदार्थ', icon: '🍹' },
  { key: 'SNAKS,CUISINE', name: 'Snacks & Cuisine', nameNe: 'खाजा र खाना', icon: '🍲' },
  { key: 'SNACKS', name: 'Snacks', nameNe: 'खाजा', icon: '🥟' },
  { key: 'CUISINE', name: 'Cuisine', nameNe: 'परिकारहरू', icon: '🍛' },
  { key: 'BREAKFAST', name: 'Breakfast', nameNe: 'बिहानको खाजा', icon: '🍳' },
  { key: 'FAST FOOD', name: 'Fast Food', nameNe: 'फास्ट फूड', icon: '🍔' },
  { key: 'DESSERT', name: 'Desserts', nameNe: 'मिठाई', icon: '🍰' },
  { key: 'SPECIALS', name: 'Specials', nameNe: 'विशेष परिकार', icon: '✨' },
];

export function getCategoryDetails(
  category: string,
  lang: 'en' | 'ne' = 'en'
): { label: string; icon: string } {
  if (!category) return { label: 'General', icon: '🍽️' };
  const normalized = category.toUpperCase().trim();
  const matched = SYSTEM_CATEGORIES.find(
    (c) => c.key === normalized || c.key.replace(/\s+/g, '') === normalized.replace(/\s+/g, '')
  );

  if (matched) {
    return {
      label: lang === 'ne' && matched.nameNe ? matched.nameNe : matched.name,
      icon: matched.icon,
    };
  }

  // Format custom category (e.g. "LOCAL SEAFOOD" -> "Local Seafood")
  const formatted = category
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return { label: formatted, icon: '🏷️' };
}

export function getAppBaseUrl(request?: { headers: { get: (name: string) => string | null } }): string {
  if (request) {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    if (host) {
      const isLocal =
        process.env.NODE_ENV === 'development' ||
        host.includes('localhost') ||
        host.includes('127.0.0.1') ||
        /^192\.168\./.test(host) ||
        /^10\./.test(host) ||
        /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host);

      if (isLocal || !process.env.NEXT_PUBLIC_APP_URL) {
        const proto =
          request.headers.get('x-forwarded-proto') ||
          (host.includes('localhost') || host.includes('127.0.0.1') ? 'http' : 'https');
        return `${proto}://${host}`;
      }
    }
  }

  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }

  const defaultPort = process.env.PORT || '3005';
  return `http://localhost:${defaultPort}`;
}
