export interface WeddingFunction {
  id: number;
  slug: string;
  title: string;
  ceremonyType: string;
  venue: string;
  dateLabel: string;
  dayOfWeek: string;
  dayOfMonth: string;
  monthName: string;
  year: string;
  timeLabel: string;
  rsvpId: string;
  directionsUrl: string;
  timestamp: number;
}

export const ALL_FUNCTIONS: WeddingFunction[] = [
  {
    id: 1,
    slug: 'rukhsati',
    title: 'Rukhsati',
    ceremonyType: 'Sacred Vows, Eternal Love & Divine Duas',
    venue: 'Shimla Resort',
    dateLabel: 'Thursday, 29th October 2026',
    dayOfWeek: 'Thursday',
    dayOfMonth: '29',
    monthName: 'October',
    year: '2026',
    timeLabel: 'Rukhsati at 07:30 PM',
    rsvpId: 'Rukhsati',
    directionsUrl: 'https://maps.app.goo.gl/oNb7LC2ZuKpFT9b7A?g_st=ac',
    timestamp: new Date('2026-10-29T19:30:00').getTime(),
  },
  {
    id: 2,
    slug: 'ramada',
    title: 'Wedding Reception',
    ceremonyType: 'A Blessed Feast & Grand Celebration',
    venue: 'Hotel Ramada',
    dateLabel: 'Friday, 30th October 2026',
    dayOfWeek: 'Friday',
    dayOfMonth: '30',
    monthName: 'October',
    year: '2026',
    timeLabel: '07:30 PM Onwards',
    rsvpId: 'Wedding Reception - Hotel Ramada',
    directionsUrl: 'https://maps.app.goo.gl/VC1HVfJNPzLf7CNy9',
    timestamp: new Date('2026-10-30T19:30:00').getTime(),
  },
  {
    id: 3,
    slug: 'radiant',
    title: 'Wedding Reception',
    ceremonyType: 'A Blessed Feast & Grand Celebration',
    venue: 'Radiant Resorts Gorakhpur',
    dateLabel: 'Monday, 2nd November 2026',
    dayOfWeek: 'Monday',
    dayOfMonth: '2',
    monthName: 'November',
    year: '2026',
    timeLabel: '07:30 PM Onwards',
    rsvpId: 'Wedding Reception - Radiant Resorts',
    directionsUrl: 'https://maps.app.goo.gl/YeqWGNYWq3HWQegm9',
    timestamp: new Date('2026-11-02T19:30:00').getTime(),
  },
];

/**
 * Normalizes string for fuzzy/alias matching (removes symbols, spaces, lowercases)
 */
function normalizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a token matches Function 1 (Rukhsati at Shimla Resort).
 * Matches: rukhsati, shimla, shimla resort, nikah, oct 29, 29, function 1, f1, etc.
 */
function matchesFunction1(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === '1' ||
    norm === 'f1' ||
    norm === 'fn1' ||
    norm === 'function1' ||
    norm === 'event1' ||
    norm === 'first' ||
    norm.includes('rukhsati') ||
    norm.includes('rukshati') ||
    norm.includes('rokhsati') ||
    norm.includes('rukhsathi') ||
    norm.includes('shimla') ||
    norm.includes('nikah') ||
    norm.includes('nikaah') ||
    norm.includes('baraat') ||
    norm.includes('barat') ||
    norm.includes('oct29') ||
    norm.includes('29oct') ||
    norm.includes('october29') ||
    norm === '29'
  );
}

/**
 * Checks if a token matches Function 2 (Wedding Reception at Hotel Ramada).
 * Matches: ramada, hotel ramada, reception 1, oct 30, 30, function 2, f2, etc.
 */
function matchesFunction2(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === '2' ||
    norm === 'f2' ||
    norm === 'fn2' ||
    norm === 'function2' ||
    norm === 'event2' ||
    norm === 'second' ||
    norm.includes('ramada') ||
    norm.includes('hotelramada') ||
    norm.includes('reception1') ||
    norm.includes('oct30') ||
    norm.includes('30oct') ||
    norm.includes('october30') ||
    norm === '30'
  );
}

/**
 * Checks if a token matches Function 3 (Wedding Reception at Radiant Resorts Gorakhpur).
 * Matches: radiant, radiant resorts, gorakhpur, reception 2, nov 2, 2, function 3, f3, etc.
 */
function matchesFunction3(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === '3' ||
    norm === 'f3' ||
    norm === 'fn3' ||
    norm === 'function3' ||
    norm === 'event3' ||
    norm === 'third' ||
    norm.includes('radiant') ||
    norm.includes('radiantresort') ||
    norm.includes('gorakhpur') ||
    norm.includes('gkp') ||
    norm.includes('reception2') ||
    norm.includes('nov2') ||
    norm.includes('2nov') ||
    norm.includes('november2') ||
    norm.includes('nov02')
  );
}

/**
 * Parses query params to find which functions a guest is invited to.
 * Supports passing function names, aliases, or numbers via:
 *   ?function=rukhsati
 *   ?functions=rukhsati,ramada
 *   ?function=ramada
 *   ?function=radiant
 *   ?functions=ramada,radiant
 *   ?functions=rukhsati,radiant
 *   ?function=hotel ramada
 *   ?function=shimla resort
 *   ?function=radiant resorts gorakhpur
 *   ?events=rukhsati,ramada
 *   ?f=1,2
 *   ?f=rukhsati
 *   ?ceremony=rukhsati
 *   or bare flags like ?rukhsati or ?ramada or ?radiant
 *
 * Returns sorted list of valid function numbers [1, 2, 3]. Defaults to all [1, 2, 3] if not specified.
 */
export function parseInvitedFunctionIds(searchStr: string = ''): number[] {
  if (typeof window === 'undefined' && !searchStr) {
    return [1, 2, 3];
  }

  const query = searchStr || (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) {
    return [1, 2, 3];
  }

  const params = new URLSearchParams(query);

  // 1. Gather all values from common parameter keys
  const paramKeys = [
    'function',
    'functions',
    'function_name',
    'functionname',
    'f',
    'fn',
    'event',
    'events',
    'ceremony',
    'ceremonies',
    'program',
    'programs',
    'invite',
    'invitation',
    'invited_to',
  ];

  const rawValues: string[] = [];
  for (const key of paramKeys) {
    const vals = params.getAll(key);
    for (const v of vals) {
      if (v) rawValues.push(v);
    }
  }

  // 2. If no explicit parameter values, check if any query flag itself is a function name
  // e.g. ?rukhsati or ?ramada or ?radiant or ?rukhsati&ramada
  if (rawValues.length === 0) {
    for (const key of params.keys()) {
      const lower = key.toLowerCase();
      if (
        matchesFunction1(lower) ||
        matchesFunction2(lower) ||
        matchesFunction3(lower)
      ) {
        rawValues.push(lower);
      }
    }
  }

  if (rawValues.length === 0) {
    return [1, 2, 3];
  }

  // Check if user requested "all"
  const combinedRaw = rawValues.join(',').toLowerCase();
  if (combinedRaw.includes('all') || combinedRaw === '0') {
    return [1, 2, 3];
  }

  // Split tokens by comma, pipe, slash, plus, or 'and'
  const tokens = combinedRaw
    .split(/[,|+;&\s]+/)
    .map((t) => t.trim().replace(/^and$/, ''))
    .filter(Boolean);

  const matched = new Set<number>();

  for (const token of tokens) {
    if (token === 'all') {
      return [1, 2, 3];
    }

    if (matchesFunction1(token)) {
      matched.add(1);
    }
    if (matchesFunction2(token)) {
      matched.add(2);
    }
    if (matchesFunction3(token)) {
      matched.add(3);
    }

    // Generic "reception" without specifying Ramada or Radiant matches both receptions (2 & 3)
    const norm = normalizeKey(token);
    if ((norm === 'reception' || norm === 'receptions') && !norm.includes('ramada') && !norm.includes('radiant')) {
      matched.add(2);
      matched.add(3);
    }
  }

  const result = Array.from(matched).sort((a, b) => a - b);
  return result.length > 0 ? result : [1, 2, 3];
}

/**
 * Parses guest / recipient name from query params.
 * Supports: ?guest=Dr.+Salman+Qureshi or ?name=Uncle+Tariq or ?to=Ayesha+Khan
 */
export function parseGuestName(searchStr: string = ''): string {
  if (typeof window === 'undefined' && !searchStr) return '';
  const query = searchStr || (typeof window !== 'undefined' ? window.location.search : '');
  if (!query) return '';

  const params = new URLSearchParams(query);
  const raw =
    params.get('guest') ||
    params.get('name') ||
    params.get('to') ||
    params.get('n') ||
    '';

  return raw.trim();
}

/**
 * Formats a clean list of function titles for display or message text.
 */
export function getInvitedFunctionsDescription(functionIds: number[]): string {
  if (functionIds.length === 3) {
    return 'All Sacred Celebrations (Rukhsati & Both Receptions)';
  }

  const names = functionIds.map((id) => {
    const f = ALL_FUNCTIONS.find((item) => item.id === id);
    if (!f) return `Function ${id}`;
    if (id === 1) return 'Rukhsati (Shimla Resort)';
    if (id === 2) return 'Wedding Reception (Hotel Ramada)';
    if (id === 3) return 'Wedding Reception (Radiant Resorts)';
    return f.title;
  });

  return names.join(' & ');
}

/**
 * Returns canonical slug for function ID:
 * 1 -> 'rukhsati'
 * 2 -> 'ramada'
 * 3 -> 'radiant'
 */
export function getFunctionSlug(id: number): string {
  if (id === 1) return 'rukhsati';
  if (id === 2) return 'ramada';
  if (id === 3) return 'radiant';
  return `function${id}`;
}

/**
 * Builds a clean invitation link with optional guest name and selected functions.
 * By default generates clean, human-readable function names in parameter:
 * e.g. ?function=rukhsati or ?functions=rukhsati,ramada
 */
export function buildInviteUrl(
  baseUrl: string,
  guestName: string,
  functionIds: number[],
  useFunctionNames: boolean = true
): string {
  try {
    const url = new URL(
      baseUrl ||
        (typeof window !== 'undefined'
          ? window.location.origin + window.location.pathname
          : 'https://wedding.example.com')
    );

    // Reset relevant params
    const keysToRemove = [
      'f',
      'fn',
      'function',
      'functions',
      'event',
      'events',
      'ceremony',
      'ceremonies',
      'guest',
      'name',
      'to',
      'admin',
      'rukhsati',
      'ramada',
      'radiant',
    ];
    for (const k of keysToRemove) {
      url.searchParams.delete(k);
    }

    const trimmedName = guestName.trim();
    if (trimmedName) {
      url.searchParams.set('guest', trimmedName);
    }

    // Only set parameter if not all 3 functions
    const sorted = [...functionIds].sort((a, b) => a - b);
    if (sorted.length > 0 && sorted.length < 3) {
      if (useFunctionNames) {
        if (sorted.length === 1) {
          url.searchParams.set('function', getFunctionSlug(sorted[0]));
        } else {
          url.searchParams.set(
            'functions',
            sorted.map((id) => getFunctionSlug(id)).join(',')
          );
        }
      } else {
        url.searchParams.set('f', sorted.join(','));
      }
    }

    return url.toString();
  } catch {
    const base = baseUrl.split('?')[0];
    const params: string[] = [];
    if (guestName.trim()) {
      params.push(`guest=${encodeURIComponent(guestName.trim())}`);
    }
    const sorted = [...functionIds].sort((a, b) => a - b);
    if (sorted.length > 0 && sorted.length < 3) {
      if (useFunctionNames) {
        if (sorted.length === 1) {
          params.push(`function=${getFunctionSlug(sorted[0])}`);
        } else {
          params.push(
            `functions=${sorted.map((id) => getFunctionSlug(id)).join(',')}`
          );
        }
      } else {
        params.push(`f=${sorted.join(',')}`);
      }
    }
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }
}

/**
 * Generates an elegant WhatsApp invitation message pre-filled with the guest's name,
 * invited ceremonies, and customized link.
 */
export function buildWhatsAppMessage(
  guestName: string,
  functionIds: number[],
  inviteUrl: string
): string {
  const greeting = guestName.trim()
    ? `Dear ${guestName.trim()},`
    : 'Dear Family & Friends,';

  const functionsList = functionIds
    .map((id) => {
      const f = ALL_FUNCTIONS.find((item) => item.id === id);
      if (!f) return null;
      return `✨ *${f.title}*\n   📅 ${f.dateLabel}\n   📍 ${f.venue}`;
    })
    .filter(Boolean)
    .join('\n\n');

  return (
    `بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ\n\n` +
    `*Wedding Invitation*\n\n` +
    `${greeting}\n\n` +
    `With the divine grace and blessings of Allah (SWT), we cordially invite you and your family to celebrate the wedding ceremonies of\n\n` +
    `👑 *Basit Ali & Ambiya Basher* 🕊️\n\n` +
    `We humbly request the honor of your gracious presence & Duas for:\n\n` +
    `${functionsList}\n\n` +
    `💌 *Please view your personal invitation & RSVP here:*\n` +
    `${inviteUrl}\n\n` +
    `Awaiting your noble presence, love, and prayers! 🌸`
  );
}
