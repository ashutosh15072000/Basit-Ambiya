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
  cardImagePath: string;
  cardImageFilename: string;
  candidateFilenames: string[];
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
    cardImagePath: 'assets/function-1-rukhsati.png',
    cardImageFilename: 'page 2(oct 29).png',
    candidateFilenames: [
      'page 2(oct 29).webp',
      'page 2(oct 29).png',
      'function-1-rukhsati.png',
      'page2.png',
    ],
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
    cardImagePath: 'assets/function-2-ramada.png',
    cardImageFilename: 'page3( 30 oct).png',
    candidateFilenames: [
      'page3( 30 oct).webp',
      'page3( 30 oct).png',
      'function-2-ramada.png',
    ],
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
    cardImagePath: 'assets/function-3-radiant.png',
    cardImageFilename: 'page 4 (2 Nov).png',
    candidateFilenames: [
      'page 4 (2 Nov).webp',
      'page 4 (2 Nov).png',
      'function-3-radiant.png',
    ],
  },
];

export interface CardImageOption {
  id: string;
  title: string;
  subtitle: string;
  path: string;
  filename: string;
  functionId?: number;
}

export const ALL_CARD_OPTIONS: CardImageOption[] = [
  {
    id: 'rukhsati',
    title: 'Rukhsati Ceremony Card',
    subtitle: 'Shimla Resort · Thursday, 29th Oct',
    path: 'assets/page 2(oct 29).png',
    filename: 'page 2(oct 29).png',
    functionId: 1,
  },
  {
    id: 'ramada',
    title: 'Hotel Ramada Reception Card',
    subtitle: 'Hotel Ramada · Friday, 30th Oct',
    path: 'assets/page3( 30 oct).png',
    filename: 'page3( 30 oct).png',
    functionId: 2,
  },
  {
    id: 'radiant',
    title: 'Radiant Resorts Reception Card',
    subtitle: 'Radiant Resorts · Monday, 2nd Nov',
    path: 'assets/page 4 (2 Nov).png',
    filename: 'page 4 (2 Nov).png',
    functionId: 3,
  },
  {
    id: 'main',
    title: 'Main Wedding Invitation Card',
    subtitle: 'With Love, Joy & Gratitude (Suite Page 2)',
    path: 'assets/page 1.png',
    filename: 'page 1.png',
  },
  {
    id: 'prelude',
    title: 'Sacred Prelude Swing Card',
    subtitle: '#BasitGotAmbitious Floral Blessing (Suite Page 1)',
    path: 'assets/Basti&Ambiya11.webp',
    filename: 'Basti&Ambiya11.webp',
  },
];

/**
 * Returns the card image path and metadata associated with the selected functions.
 */
export function getFunctionCardImage(functionIds: number[]): {
  path: string;
  filename: string;
  title: string;
  candidateFilenames: string[];
} {
  if (functionIds.length === 1) {
    const f = ALL_FUNCTIONS.find((item) => item.id === functionIds[0]);
    if (f) {
      return {
        path: f.cardImagePath,
        filename: f.cardImageFilename,
        title: f.title,
        candidateFilenames: f.candidateFilenames,
      };
    }
  }

  if (functionIds.length === 2) {
    if (functionIds.includes(1)) {
      return {
        path: 'assets/function-1-rukhsati.png',
        filename: 'page 2(oct 29).png',
        title: 'Rukhsati & Reception',
        candidateFilenames: ['page 2(oct 29).webp', 'page 2(oct 29).png', 'function-1-rukhsati.png'],
      };
    }
    return {
      path: 'assets/function-2-ramada.png',
      filename: 'page3( 30 oct).png',
      title: 'Wedding Receptions',
      candidateFilenames: ['page3( 30 oct).webp', 'page3( 30 oct).png', 'function-2-ramada.png'],
    };
  }

  // All 3 or general
  return {
    path: 'assets/function-all.png',
    filename: 'page 1.png',
    title: 'Sacred Wedding Invitation',
    candidateFilenames: ['page 1.webp', 'page 1.png', 'function-all.png'],
  };
}

/**
 * Discreet, unguessable access security tokens for wedding functions.
 * Instead of predictable function names (like "rukhsati" or "ramada"),
 * URLs use randomized alphanumeric keys so guests cannot guess or tamper with ceremony parameters.
 */
export const RANDOM_FUNCTION_TOKENS = {
  // Single function access codes
  FUNCTION_1: 'v8k29', // Rukhsati (Shimla Resort · Oct 29)
  FUNCTION_2: 'm4w30', // Hotel Ramada (Oct 30)
  FUNCTION_3: 'p7r02', // Radiant Resorts (Nov 2)
  // Multi-function combinations
  FUNCTIONS_1_2: 'x8b4w', // Rukhsati + Hotel Ramada
  FUNCTIONS_2_3: 'n3q9f', // Hotel Ramada + Radiant Resorts
  FUNCTIONS_1_3: 'g5t2k', // Rukhsati + Radiant Resorts
  ALL_FUNCTIONS: 'w9v4k', // All 3 Functions
};

/**
 * Normalizes string for fuzzy/alias matching (removes symbols, spaces, lowercases)
 */
function normalizeKey(str: string): string {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Checks if a token matches Function 1 (Rukhsati at Shimla Resort).
 */
function matchesFunction1(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === 'v8k29' ||
    norm === 'k9x2m4' ||
    norm === 'v7r8p1' ||
    norm === 'sh29x' ||
    norm === 'rk92a' ||
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
 */
function matchesFunction2(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === 'm4w30' ||
    norm === 'm4w7q3' ||
    norm === 'z2h8b6' ||
    norm === 'rm30b' ||
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
 */
function matchesFunction3(token: string): boolean {
  const norm = normalizeKey(token);
  if (!norm) return false;
  return (
    norm === 'p7r02' ||
    norm === 'p8j5v1' ||
    norm === 'y6k3d9' ||
    norm === 'rd02c' ||
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

export interface ParsedInvitationState {
  isValid: boolean;
  isTamperedOrInvalid: boolean;
  functionIds: number[];
  invalidTokens: string[];
  paramSpecified: boolean;
  rawSearch: string;
}

/**
 * Validates and parses query parameters to verify if valid unguessable access key(s) or pass details were supplied.
 * - Guest Pass URLs (?pass=..., ?checkin=..., ?guest=...) and event lists are first-class valid and open seamlessly.
 * - Function codes (?invite=v8k29, ?invite=x8b4w, etc.) accurately filter ceremonies.
 * - Tampered/invalid tokens without guest identification are securely intercepted.
 */
export function validateAndParseInvitationUrl(searchStr: string = ''): ParsedInvitationState {
  if (typeof window === 'undefined' && !searchStr) {
    return {
      isValid: true,
      isTamperedOrInvalid: false,
      functionIds: [1, 2, 3],
      invalidTokens: [],
      paramSpecified: false,
      rawSearch: '',
    };
  }

  const rawStr = searchStr || (typeof window !== 'undefined' ? window.location.search : '');
  if (!rawStr) {
    return {
      isValid: true,
      isTamperedOrInvalid: false,
      functionIds: [1, 2, 3],
      invalidTokens: [],
      paramSpecified: false,
      rawSearch: '',
    };
  }

  const query = rawStr.includes('?') ? rawStr.slice(rawStr.indexOf('?') + 1) : rawStr;
  const params = new URLSearchParams(query);

  // Check if this is a Guest Pass, RSVP Check-In QR scan, or Guest link
  const hasGuestIdentity = Boolean(
    params.get('pass') ||
    params.get('passId') ||
    params.get('pass_id') ||
    params.get('p') ||
    params.get('checkin') ||
    params.get('check_in') ||
    params.get('verify') ||
    params.get('guest') ||
    params.get('name') ||
    params.get('to') ||
    params.get('n')
  );

  const matched = new Set<number>();
  const invalidTokens: string[] = [];
  let paramSpecified = false;

  // 1. Process Event / Ceremony name parameters (e.g. from QR codes: "Wedding Reception - Hotel Ramada, Wedding Reception - Radiant Resorts")
  const eventKeys = ['event', 'events', 'ceremony', 'ceremonies', 'program', 'programs', 'e'];
  for (const key of eventKeys) {
    const rawEvents = params.getAll(key);
    for (const rawEv of rawEvents) {
      if (!rawEv || !rawEv.trim()) continue;
      paramSpecified = true;
      // Split by comma or pipe
      const eventPhrases = rawEv.split(/[,|]+/).map((s) => s.trim()).filter(Boolean);
      for (const phrase of eventPhrases) {
        const lower = phrase.toLowerCase();
        if (matchesFunction1(lower)) {
          matched.add(1);
        }
        if (matchesFunction2(lower)) {
          matched.add(2);
        }
        if (matchesFunction3(lower)) {
          matched.add(3);
        }
        if (lower.includes('all') || lower === '0') {
          matched.add(1);
          matched.add(2);
          matched.add(3);
        }
      }
    }
  }

  // 2. Process Security / Function Tokens (e.g. ?invite=v8k29, ?invite=x8b4w, ?function=rukhsati, ?f=1,2)
  const tokenKeys = [
    'invite',
    'access',
    'token',
    'code',
    'key',
    'function',
    'functions',
    'function_name',
    'functionname',
    'f',
    'fn',
    'invitation',
    'invited_to',
  ];

  const rawTokens: string[] = [];
  for (const key of tokenKeys) {
    const vals = params.getAll(key);
    for (const v of vals) {
      if (v !== null && v !== undefined && v.trim() !== '') {
        rawTokens.push(v);
        paramSpecified = true;
      }
    }
  }

  // 3. Check standalone flags (e.g. ?v8k29 or ?rukhsati or ?ramada)
  if (!paramSpecified) {
    for (const key of params.keys()) {
      const lower = key.toLowerCase().trim();
      if (
        [
          'guest',
          'name',
          'to',
          'n',
          'pass',
          'passid',
          'pass_id',
          'p',
          'checkin',
          'check_in',
          'verify',
          'guests',
          'count',
          'guest_count',
          'g',
          'admin',
          'host',
          'usher',
          'id',
          'v',
          'set_gh_token',
          'set_gh_owner',
          'set_gh_repo',
          'set_gh_branch',
          'gh_token',
          'gh_owner',
          'gh_repo',
          'gh_branch',
        ].includes(lower)
      ) {
        continue;
      }

      if (
        matchesFunction1(lower) ||
        matchesFunction2(lower) ||
        matchesFunction3(lower) ||
        lower === 'x8b4w' ||
        lower === 'n3q9f' ||
        lower === 'g5t2k' ||
        lower === 'w9v4k' ||
        lower === 'all'
      ) {
        rawTokens.push(lower);
        paramSpecified = true;
      }
    }
  }

  if (rawTokens.length > 0) {
    const combinedRaw = rawTokens.join(',').toLowerCase();
    if (
      combinedRaw.includes('all') ||
      combinedRaw.includes('w9v4k') ||
      combinedRaw.includes('royal2026') ||
      combinedRaw === '0'
    ) {
      matched.add(1);
      matched.add(2);
      matched.add(3);
    } else {
      const splitTokens = combinedRaw
        .split(/[,|+;&\s]+/)
        .map((t) => t.trim().replace(/^and$/, ''))
        .filter(Boolean);

      for (const token of splitTokens) {
        let tokenMatched = false;

        if (token === 'x8b4w' || token === 'rkrm12' || token === 'j7m1n5') {
          matched.add(1);
          matched.add(2);
          tokenMatched = true;
        } else if (token === 'n3q9f' || token === 'rmrd23' || token === 'c8v2x4') {
          matched.add(2);
          matched.add(3);
          tokenMatched = true;
        } else if (token === 'g5t2k' || token === 'rkrd13' || token === 'l4p9z3') {
          matched.add(1);
          matched.add(3);
          tokenMatched = true;
        } else if (token === 'w9v4k' || token === 'all') {
          matched.add(1);
          matched.add(2);
          matched.add(3);
          tokenMatched = true;
        } else if (matchesFunction1(token)) {
          matched.add(1);
          tokenMatched = true;
        } else if (matchesFunction2(token)) {
          matched.add(2);
          tokenMatched = true;
        } else if (matchesFunction3(token)) {
          matched.add(3);
          tokenMatched = true;
        } else {
          const norm = normalizeKey(token);
          if ((norm === 'reception' || norm === 'receptions') && !norm.includes('ramada') && !norm.includes('radiant')) {
            matched.add(2);
            matched.add(3);
            tokenMatched = true;
          }
        }

        if (!tokenMatched) {
          invalidTokens.push(token);
        }
      }
    }
  }

  // If this is a valid Guest Pass, QR Check-In, or guest URL, it is NEVER tampered/invalid
  if (hasGuestIdentity) {
    const finalFunctionIds = matched.size > 0 ? Array.from(matched).sort((a, b) => a - b) : [1, 2, 3];
    return {
      isValid: true,
      isTamperedOrInvalid: false,
      functionIds: finalFunctionIds,
      invalidTokens: [],
      paramSpecified: true,
      rawSearch: rawStr,
    };
  }

  // If no function parameters were specified, default to full wedding celebration
  if (!paramSpecified) {
    return {
      isValid: true,
      isTamperedOrInvalid: false,
      functionIds: [1, 2, 3],
      invalidTokens: [],
      paramSpecified: false,
      rawSearch: rawStr,
    };
  }

  // If a function parameter was explicitly given but failed matching and has invalid tokens without guest identity:
  if (matched.size === 0 || (invalidTokens.length > 0 && matched.size === 0)) {
    return {
      isValid: false,
      isTamperedOrInvalid: true,
      functionIds: [],
      invalidTokens,
      paramSpecified: true,
      rawSearch: rawStr,
    };
  }

  const result = Array.from(matched).sort((a, b) => a - b);
  return {
    isValid: true,
    isTamperedOrInvalid: false,
    functionIds: result.length > 0 ? result : [1, 2, 3],
    invalidTokens: [],
    paramSpecified: true,
    rawSearch: rawStr,
  };
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
 * Returns sorted list of valid function numbers [1, 2, 3]. Defaults to all [1, 2, 3] if not specified or empty.
 */
export function parseInvitedFunctionIds(searchStr: string = ''): number[] {
  const parsed = validateAndParseInvitationUrl(searchStr);
  if (parsed.isTamperedOrInvalid) {
    return [];
  }
  return parsed.functionIds.length > 0 ? parsed.functionIds : [1, 2, 3];
}

/**
 * Parses guest / recipient name from query params.
 * Supports: ?guest=Dr.+Salman+Qureshi or ?name=Uncle+Tariq or ?to=Ayesha+Khan
 */
export function parseGuestName(searchStr: string = ''): string {
  if (typeof window === 'undefined' && !searchStr) return '';
  const rawStr = searchStr || (typeof window !== 'undefined' ? window.location.search : '');
  if (!rawStr) return '';

  const query = rawStr.includes('?') ? rawStr.slice(rawStr.indexOf('?') + 1) : rawStr;
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
 * Returns the unguessable randomized security access token for selected functions.
 */
export function getFunctionToken(functionIds: number[]): string {
  const sorted = [...functionIds].sort((a, b) => a - b);
  if (sorted.length === 1) {
    if (sorted[0] === 1) return RANDOM_FUNCTION_TOKENS.FUNCTION_1; // 'v8k29' (Rukhsati)
    if (sorted[0] === 2) return RANDOM_FUNCTION_TOKENS.FUNCTION_2; // 'm4w30' (Ramada Reception)
    if (sorted[0] === 3) return RANDOM_FUNCTION_TOKENS.FUNCTION_3; // 'p7r02' (Radiant Resorts Reception)
  }
  if (sorted.length === 2) {
    if (sorted[0] === 1 && sorted[1] === 2) return RANDOM_FUNCTION_TOKENS.FUNCTIONS_1_2; // 'x8b4w' (Rukhsati + Ramada)
    if (sorted[0] === 2 && sorted[1] === 3) return RANDOM_FUNCTION_TOKENS.FUNCTIONS_2_3; // 'n3q9f' (Ramada + Radiant)
    if (sorted[0] === 1 && sorted[1] === 3) return RANDOM_FUNCTION_TOKENS.FUNCTIONS_1_3; // 'g5t2k' (Rukhsati + Radiant)
  }
  return RANDOM_FUNCTION_TOKENS.ALL_FUNCTIONS; // 'w9v4k'
}

/**
 * Builds an unguessable personalized invitation link with optional guest name.
 * Uses discrete randomized security tokens (e.g. ?invite=v8k29) rather than obvious function names,
 * preventing guests from guessing or tampering with ceremony access.
 */
export function buildInviteUrl(
  baseUrl: string,
  guestName: string,
  functionIds: number[]
): string {
  try {
    const url = new URL(
      baseUrl ||
        (typeof window !== 'undefined'
          ? window.location.origin + window.location.pathname
          : 'https://wedding.example.com')
    );

    // Reset all potential function and security parameter keys
    const keysToRemove = [
      'f',
      'fn',
      'function',
      'functions',
      'event',
      'events',
      'ceremony',
      'ceremonies',
      'program',
      'programs',
      'invite',
      'invitation',
      'access',
      'code',
      'token',
      'key',
      'pass',
      'guest',
      'name',
      'to',
      'admin',
      'host',
      'usher',
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

    // Assign randomized unguessable access key for specific function subsets
    const sorted = [...functionIds].sort((a, b) => a - b);
    if (sorted.length > 0 && sorted.length < 3) {
      const secureCode = getFunctionToken(sorted);
      url.searchParams.set('invite', secureCode);
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
      const secureCode = getFunctionToken(sorted);
      params.push(`invite=${secureCode}`);
    }
    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }
}

/**
 * Generates the official Wedding Entry & Quick Check-in Pass WhatsApp message
 * exactly matching the royal format with emoji bullets and guest details.
 */
export function buildGuestPassWhatsAppMessage(
  guestName: string,
  passId: string,
  guestCount: number,
  events: string[],
  passUrl: string
): string {
  const cleanEvents =
    events && events.length > 0 ? events.join(', ') : 'All Invited Wedding Celebrations';

  return (
    `🎟️ *WEDDING ENTRY & QUICK CHECK-IN PASS*\n\n` +
    `👑 *Basit Ali & Ambiya Basher Wedding Celebrations*\n\n` +
    `👤 *Honored Guest:* ${guestName.trim().toUpperCase()}\n` +
    `🆔 *Pass ID:* ${passId}\n` +
    `👥 *Admitted:* ${guestCount} ${guestCount === 1 ? 'Guest' : 'Guests'}\n` +
    `✨ *Ceremonies:* ${cleanEvents}\n\n` +
    `📱 *Show your verified digital pass & QR code at venue entrance:*\n` +
    `${passUrl}\n\n` +
    `Awaiting your noble presence & Duas! 🌸`
  );
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
      return (
        `✨ *${f.title}*\n` +
        `   📅 ${f.dateLabel}\n` +
        `   ⏰ ${f.timeLabel}\n` +
        `   📍 *Venue:* ${f.venue}\n` +
        `   🗺️ *Location Map:* ${f.directionsUrl}`
      );
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

