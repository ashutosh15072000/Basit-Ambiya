import * as XLSX from 'xlsx';
import { addWeddingWish } from './wishesService';
import { getAssetPath } from '../utils/assets';

export interface RsvpRecord {
  id: string;
  submitted_at: string;
  guest_name: string;
  phone?: string | null;
  attending: 'yes' | 'no';
  guest_count: number;
  events: string[];
  dietary?: string | null;
  message?: string | null;
  checked_in?: boolean;
  checked_in_at?: string | null;
  checked_in_pass_id?: string | null;
  checked_in_events?: string[]; // Array of event names checked into
  checked_in_events_map?: Record<string, string>; // Map of { eventName: isoTimestamp }
  checked_in_guest_count?: number;
}

export interface CheckInPayload {
  passId: string;
  guestName: string;
  guestCount?: number;
  events?: string[];
  specificEvent?: string; // If scanning for a specific event only
  checkInAll?: boolean; // If checking into all invited events
  phone?: string;
  source?: string;
}

export interface GitHubSyncConfig {
  enabled: boolean;
  owner: string;
  repo: string;
  branch: string;
  filePath: string;
  token: string;
  autoSyncOnSubmit: boolean;
  lastSyncedAt?: string;
  lastCommitUrl?: string;
}

const STORAGE_KEY_RSVPS = 'wedding_rsvps';
const STORAGE_KEY_GH_CONFIG = 'wedding_github_sync_config';

const DEFAULT_GH_CONFIG: GitHubSyncConfig = {
  enabled: false,
  owner: 'ashutosh15072000',
  repo: 'Basit-Ambiya',
  branch: 'main',
  filePath: 'wedding-rsvps.xlsx',
  token:'',
  autoSyncOnSubmit: true,
};

/**
 * Standardizes event names for reliable matching across forms, passes, and Excel
 */
export function normalizeEventName(rawName: string): string {
  const clean = (rawName || '').toLowerCase().trim();
  if (clean.includes('rukhsati') || clean.includes('nikah') || clean.includes('shimla') || clean.includes('oct 29') || clean.includes('29th')) {
    return 'Rukhsati (Shimla Resort)';
  }
  if (clean.includes('ramada') || clean.includes('oct 30') || clean.includes('30th')) {
    return 'Wedding Reception (Hotel Ramada)';
  }
  if (clean.includes('radiant') || clean.includes('gorakhpur') || clean.includes('nov 2') || clean.includes('2nd') || clean.includes('walima')) {
    return 'Wedding Reception (Radiant Resorts)';
  }
  return rawName.trim() || 'Wedding Celebrations';
}

/**
 * Formats ISO date to readable string
 */
export function formatDateTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

/**
 * Formats ISO date to full readable date
 */
function formatDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

/**
 * Retrieves all stored RSVPs from localStorage
 */
export function getStoredRsvps(): RsvpRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RSVPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => {
        const events = Array.isArray(item.events) ? item.events : [];
        const checkedInEvents = Array.isArray(item.checked_in_events) ? item.checked_in_events : [];
        const checkedInMap: Record<string, string> = item.checked_in_events_map || {};

        // Backfill checkedInMap from checked_in_events if needed
        if (checkedInEvents.length > 0 && Object.keys(checkedInMap).length === 0) {
          checkedInEvents.forEach((ev: string) => {
            checkedInMap[ev] = item.checked_in_at || new Date().toISOString();
          });
        }

        const isCheckedIn = Boolean(item.checked_in) || checkedInEvents.length > 0 || Object.keys(checkedInMap).length > 0;

        return {
          id: item.id || `rsvp-${index + 1}-${Date.now()}`,
          submitted_at: item.submitted_at || new Date().toISOString(),
          guest_name: item.guest_name || 'Anonymous Guest',
          phone: item.phone || '',
          attending: item.attending === 'no' ? 'no' : 'yes',
          guest_count: Number(item.guest_count) || (item.attending === 'no' ? 0 : 1),
          events,
          dietary: item.dietary || '',
          message: item.message || '',
          checked_in: isCheckedIn,
          checked_in_at: item.checked_in_at || null,
          checked_in_pass_id: item.checked_in_pass_id || null,
          checked_in_events: checkedInEvents.length > 0 ? checkedInEvents : Object.keys(checkedInMap),
          checked_in_events_map: checkedInMap,
          checked_in_guest_count: typeof item.checked_in_guest_count === 'number' ? item.checked_in_guest_count : item.guest_count || 1,
        };
      });
    }
  } catch (err) {
    console.error('Error reading wedding_rsvps from localStorage:', err);
  }
  return [];
}

/**
 * Saves all RSVPs to localStorage
 */
export function saveAllRsvps(rsvps: RsvpRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_RSVPS, JSON.stringify(rsvps));
    window.dispatchEvent(new CustomEvent('wedding_rsvp_updated', { detail: rsvps }));
  } catch (err) {
    console.error('Error saving wedding_rsvps to localStorage:', err);
  }
}

/**
 * Fetches all RSVPs from backend API and GitHub so any phone / device displays all submitted responses in real time
 */
export async function fetchAllRsvps(): Promise<RsvpRecord[]> {
  const localRsvps = getStoredRsvps();
  let remoteRecords: RsvpRecord[] = [];

  // 1. Try server API endpoint
  try {
    const res = await fetch('/api/rsvp', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.rsvps) && data.rsvps.length > 0) {
        remoteRecords = data.rsvps;
      }
    }
  } catch {
    // static host or offline
  }

  // 2. Try static public/wedding-rsvps.json if on GitHub Pages
  if (remoteRecords.length === 0) {
    try {
      const staticUrl = `${getAssetPath('wedding-rsvps.json')}?t=${Date.now()}`;
      const res = await fetch(staticUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          remoteRecords = data;
        }
      }
    } catch {}
  }

  // 3. Try GitHub Raw file if repository is configured
  if (remoteRecords.length === 0) {
    const ghConfig = getGitHubConfig();
    if (ghConfig.owner && ghConfig.repo) {
      try {
        const rawUrl = `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch || 'main'}/public/wedding-rsvps.json?t=${Date.now()}`;
        const res = await fetch(rawUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && data.length > 0) {
            remoteRecords = data;
          }
        }
      } catch {}
    }
  }

  // If remote records found, merge with local records so no submissions are ever lost
  if (remoteRecords.length > 0) {
    const mergedMap = new Map<string, RsvpRecord>();

    // Start with local records
    localRsvps.forEach((r) => {
      const key = (r.id || `${r.guest_name}-${r.phone || ''}`).toLowerCase();
      mergedMap.set(key, r);
    });

    // Merge remote records
    remoteRecords.forEach((r, idx) => {
      const events = Array.isArray(r.events) ? r.events : [];
      const checkedInEvents = Array.isArray(r.checked_in_events) ? r.checked_in_events : [];
      const checkedInMap: Record<string, string> = r.checked_in_events_map || {};

      const standardized: RsvpRecord = {
        id: r.id || `rsvp-rem-${idx}-${Date.now()}`,
        submitted_at: r.submitted_at || new Date().toISOString(),
        guest_name: r.guest_name || 'Anonymous Guest',
        phone: r.phone || '',
        attending: r.attending === 'no' ? 'no' : 'yes',
        guest_count: Number(r.guest_count) || (r.attending === 'no' ? 0 : 1),
        events,
        dietary: r.dietary || '',
        message: r.message || '',
        checked_in: Boolean(r.checked_in) || checkedInEvents.length > 0 || Object.keys(checkedInMap).length > 0,
        checked_in_at: r.checked_in_at || null,
        checked_in_pass_id: r.checked_in_pass_id || null,
        checked_in_events: checkedInEvents.length > 0 ? checkedInEvents : Object.keys(checkedInMap),
        checked_in_events_map: checkedInMap,
        checked_in_guest_count: typeof r.checked_in_guest_count === 'number' ? r.checked_in_guest_count : r.guest_count || 1,
      };

      const key = (standardized.id || `${standardized.guest_name}-${standardized.phone || ''}`).toLowerCase();
      const existing = mergedMap.get(key);
      if (existing) {
        mergedMap.set(key, {
          ...existing,
          ...standardized,
          checked_in_events_map: { ...(existing.checked_in_events_map || {}), ...(standardized.checked_in_events_map || {}) },
          checked_in: existing.checked_in || standardized.checked_in,
        });
      } else {
        mergedMap.set(key, standardized);
      }
    });

    const finalMerged = Array.from(mergedMap.values()).sort((a, b) => {
      const timeA = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
      const timeB = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
      return timeB - timeA;
    });

    saveAllRsvps(finalMerged);
    return finalMerged;
  }

  return localRsvps;
}

/**
 * Sanitizes GitHub input fields to avoid common formatting mistakes (URL pastes, extra slashes, etc.)
 */
export function sanitizeGitHubConfig(cfg: Partial<GitHubSyncConfig>): GitHubSyncConfig {
  let owner = (cfg.owner || '').trim();
  owner = owner.replace(/^https?:\/\/github\.com\//i, '').replace(/^github\.com\//i, '');
  if (owner.includes('/')) {
    owner = owner.split('/')[0];
  }
  owner = owner.replace(/\/+$/, '').trim();

  let repo = (cfg.repo || '').trim();
  repo = repo.replace(/^https?:\/\/github\.com\//i, '').replace(/^github\.com\//i, '');
  if (repo.includes('/')) {
    const parts = repo.split('/');
    repo = parts[parts.length - 1];
  }
  repo = repo.replace(/\.git$/i, '').replace(/\/+$/, '').trim();

  let token = (cfg.token || '').trim();
  token = token.replace(/^bearer\s+/i, '').replace(/^token\s+/i, '').trim();

  let branch = (cfg.branch || '').trim() || 'main';
  let filePath = (cfg.filePath || '').trim().replace(/^\/+/, '') || 'wedding-rsvps.xlsx';

  return {
    enabled: cfg.enabled !== undefined ? cfg.enabled : Boolean(token && owner && repo),
    owner,
    repo,
    branch,
    filePath,
    token,
    autoSyncOnSubmit: cfg.autoSyncOnSubmit !== undefined ? cfg.autoSyncOnSubmit : true,
    lastSyncedAt: cfg.lastSyncedAt,
    lastCommitUrl: cfg.lastCommitUrl,
  };
}

/**
 * Tests connection to GitHub repository and checks credentials & permissions
 */
export async function testGitHubConnection(rawConfig: GitHubSyncConfig): Promise<{
  success: boolean;
  message: string;
  repoDetails?: {
    full_name: string;
    owner?: string;
    repo?: string;
    private: boolean;
    default_branch: string;
  };
}> {
  const config = sanitizeGitHubConfig(rawConfig);
  if (!config.token || !config.owner || !config.repo) {
    return {
      success: false,
      message: 'Please provide GitHub Username/Org, Repository Name, and Personal Access Token (PAT).',
    };
  }

  try {
    const res = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (res.status === 401) {
      return {
        success: false,
        message: 'Invalid Personal Access Token (401 Unauthorized). Please check or regenerate your token with "repo" or "contents:write" permission.',
      };
    }

    if (res.status === 404) {
      return {
        success: false,
        message: `Repository "${config.owner}/${config.repo}" was not found (404). Please ensure the repository name is exact and exists on your GitHub account.`,
      };
    }

    if (res.status === 403) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      return {
        success: false,
        message: `Access Forbidden (403): ${errJson.message || 'Token lacks sufficient repository permissions. Ensure it has "repo" (Classic) or "Contents: Read and write" (Fine-Grained).'}`,
      };
    }

    if (!res.ok) {
      const errJson = (await res.json().catch(() => ({}))) as any;
      return {
        success: false,
        message: `GitHub Error (${res.status}): ${errJson.message || 'Unable to connect to repository.'}`,
      };
    }

    const repoData = (await res.json()) as any;
    const actualOwner = repoData.owner?.login || (repoData.full_name ? repoData.full_name.split('/')[0] : config.owner);
    const actualRepo = repoData.name || (repoData.full_name ? repoData.full_name.split('/')[1] : config.repo);
    const defaultBranch = repoData.default_branch || 'main';

    return {
      success: true,
      message: `Connection successful! Connected to "${repoData.full_name}" (${repoData.private ? 'Private' : 'Public'}, default branch: ${defaultBranch}).`,
      repoDetails: {
        full_name: repoData.full_name,
        owner: actualOwner,
        repo: actualRepo,
        private: repoData.private,
        default_branch: defaultBranch,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: `Network error connecting to GitHub: ${err.message || 'Check your internet connection.'}`,
    };
  }
}

/**
 * Retrieves stored GitHub sync settings
 */
export function getGitHubConfig(): GitHubSyncConfig {
  let config: GitHubSyncConfig = {
    ...DEFAULT_GH_CONFIG,
    owner: (import.meta as any).env?.VITE_GITHUB_OWNER || '',
    repo: (import.meta as any).env?.VITE_GITHUB_REPO || '',
    branch: (import.meta as any).env?.VITE_GITHUB_BRANCH || 'main',
    token: (import.meta as any).env?.VITE_GITHUB_TOKEN || '',
    enabled: Boolean((import.meta as any).env?.VITE_GITHUB_TOKEN),
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY_GH_CONFIG);
    if (raw) {
      config = { ...config, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Error reading github config:', err);
  }

  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlToken = params.get('set_gh_token') || params.get('gh_token');
      const urlOwner = params.get('set_gh_owner') || params.get('gh_owner');
      const urlRepo = params.get('set_gh_repo') || params.get('gh_repo');
      const urlBranch = params.get('set_gh_branch') || params.get('gh_branch');
      if (urlToken || urlOwner || urlRepo) {
        config = {
          ...config,
          token: urlToken || config.token,
          owner: urlOwner || config.owner,
          repo: urlRepo || config.repo,
          branch: urlBranch || config.branch,
          enabled: true,
          autoSyncOnSubmit: true,
        };
        saveGitHubConfig(config);
      }
    } catch {}
  }

  return sanitizeGitHubConfig(config);
}

/**
 * Saves GitHub sync settings to localStorage and server
 */
export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    const sanitized = sanitizeGitHubConfig(config);
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(sanitized));

    // Also persist to server so all users & automated RSVP submissions use this config
    fetch('/api/github-config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sanitized),
    }).catch(() => {});
  } catch (err) {
    console.error('Error saving github config:', err);
  }
}

/**
 * Builds an XLSX workbook object from the RSVP records with Multi-Function Check-In tracking
 */
export function buildExcelWorkbook(records: RsvpRecord[]): XLSX.WorkBook {
  const rows = records.map((r, idx) => {
    const eventsList = r.events || [];
    const checkInMap = r.checked_in_events_map || {};

    // Helper to evaluate checkin status for each specific function
    const getFuncStatus = (keyword: string): string => {
      const isInvited = eventsList.length === 0 || eventsList.some((e) => e.toLowerCase().includes(keyword));
      if (!isInvited) return '— Not Invited';

      // Check if checked in
      const matchingKey = Object.keys(checkInMap).find((k) => k.toLowerCase().includes(keyword));
      if (matchingKey && checkInMap[matchingKey]) {
        return `✅ Admitted (${formatDateTime(checkInMap[matchingKey])})`;
      }
      if (r.checked_in && (!r.checked_in_events || r.checked_in_events.length === 0)) {
        return `✅ Admitted (${formatDateTime(r.checked_in_at)})`;
      }
      return '⏳ Awaiting Entry';
    };

    const rukhsatiStatus = getFuncStatus('rukhsati') || getFuncStatus('shimla');
    const ramadaStatus = getFuncStatus('ramada');
    const radiantStatus = getFuncStatus('radiant');

    // Overall summary calculation
    const totalInvitedEvents = eventsList.length > 0 ? eventsList.length : 3;
    const totalCheckedInEvents = Object.keys(checkInMap).length;
    let overallCheckInStr = '⏳ Awaiting Check-In';
    if (totalCheckedInEvents >= totalInvitedEvents && totalCheckedInEvents > 0) {
      overallCheckInStr = `✅ All ${totalCheckedInEvents}/${totalInvitedEvents} Functions Checked In`;
    } else if (totalCheckedInEvents > 0) {
      overallCheckInStr = `⚡ Partial (${totalCheckedInEvents}/${totalInvitedEvents} Functions Checked In)`;
    } else if (r.checked_in) {
      overallCheckInStr = '✅ Checked In';
    }

    return {
      'S.No': idx + 1,
      'Submission Date': formatDate(r.submitted_at),
      'Guest Name': r.guest_name,
      'Contact Phone': r.phone || 'N/A',
      'Attending Status': r.attending === 'yes' ? 'Confirmed (Attending)' : 'Respectfully Declined',
      'Total Guests Attending': r.attending === 'yes' ? r.guest_count : 0,
      'Overall Check-In Status': overallCheckInStr,
      'Rukhsati (29 Oct) Check-In': rukhsatiStatus,
      'Ramada Reception (30 Oct) Check-In': ramadaStatus,
      'Radiant Reception (2 Nov) Check-In': radiantStatus,
      'Latest Check-In Time': r.checked_in_at ? formatDate(r.checked_in_at) : '—',
      'VIP Pass ID': r.checked_in_pass_id || '—',
      'Invited Ceremonies': eventsList.length > 0 ? eventsList.join('; ') : 'All Celebrations / General',
      'Dietary Preferences': r.dietary || 'None specified',
      'Heartfelt Duas & Message': r.message || '—',
    };
  });

  const wb = XLSX.utils.book_new();

  const ws = rows.length > 0
    ? XLSX.utils.json_to_sheet(rows)
    : XLSX.utils.json_to_sheet([
        {
          'S.No': 1,
          'Submission Date': formatDate(new Date().toISOString()),
          'Guest Name': 'Registry Initialized',
          'Contact Phone': '—',
          'Attending Status': 'Awaiting Responses',
          'Total Guests Attending': 0,
          'Overall Check-In Status': '⏳ Awaiting Check-In',
          'Rukhsati (29 Oct) Check-In': '—',
          'Ramada Reception (30 Oct) Check-In': '—',
          'Radiant Reception (2 Nov) Check-In': '—',
          'Latest Check-In Time': '—',
          'VIP Pass ID': '—',
          'Invited Ceremonies': '—',
          'Dietary Preferences': '—',
          'Heartfelt Duas & Message': 'Welcome to Basit & Ambiya Wedding RSVP Registry',
        },
      ]);

  ws['!cols'] = [
    { wch: 8 },  // S.No
    { wch: 22 }, // Date
    { wch: 28 }, // Guest Name
    { wch: 18 }, // Phone
    { wch: 24 }, // Attending
    { wch: 22 }, // Guest Count
    { wch: 30 }, // Overall Check-In Status
    { wch: 28 }, // Rukhsati Check-In
    { wch: 32 }, // Ramada Reception Check-In
    { wch: 32 }, // Radiant Reception Check-In
    { wch: 22 }, // Check-In Time
    { wch: 18 }, // Pass ID
    { wch: 45 }, // Ceremonies
    { wch: 22 }, // Dietary
    { wch: 55 }, // Message
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'RSVP & Check-Ins');

  // Summary sheet
  const totalResponses = records.length;
  const attendingCount = records.filter((r) => r.attending === 'yes').length;
  const totalGuests = records.reduce((sum, r) => sum + (r.attending === 'yes' ? r.guest_count : 0), 0);
  const checkedInRecords = records.filter((r) => r.checked_in);
  const checkedInCount = checkedInRecords.length;
  const checkedInGuestHeads = checkedInRecords.reduce((sum, r) => sum + (r.checked_in_guest_count || r.guest_count || 1), 0);

  // Per function check-in stats
  const rukhsatiCheckIns = records.filter((r) => {
    const map = r.checked_in_events_map || {};
    return Object.keys(map).some((k) => k.toLowerCase().includes('rukhsati') || k.toLowerCase().includes('shimla'));
  }).length;

  const ramadaCheckIns = records.filter((r) => {
    const map = r.checked_in_events_map || {};
    return Object.keys(map).some((k) => k.toLowerCase().includes('ramada'));
  }).length;

  const radiantCheckIns = records.filter((r) => {
    const map = r.checked_in_events_map || {};
    return Object.keys(map).some((k) => k.toLowerCase().includes('radiant'));
  }).length;

  const declinedCount = records.filter((r) => r.attending === 'no').length;

  const summaryData = [
    { Metric: 'Couple', Value: 'Basit Ali & Ambiya Basher' },
    { Metric: 'Sacred Rukhsati', Value: 'Thursday, 29th October 2026 (Shimla Resort)' },
    { Metric: 'Wedding Reception 1', Value: 'Friday, 30th October 2026 (Hotel Ramada)' },
    { Metric: 'Wedding Reception 2', Value: 'Monday, 2nd November 2026 (Radiant Resorts)' },
    { Metric: 'Total RSVP Responses', Value: totalResponses },
    { Metric: 'Confirmed Attending Responses', Value: attendingCount },
    { Metric: 'Total Expected Guests (Heads)', Value: totalGuests },
    { Metric: 'Total Passes Checked In (Any Function)', Value: checkedInCount },
    { Metric: 'Rukhsati Guests Checked In', Value: rukhsatiCheckIns },
    { Metric: 'Hotel Ramada Guests Checked In', Value: ramadaCheckIns },
    { Metric: 'Radiant Resorts Guests Checked In', Value: radiantCheckIns },
    { Metric: 'Total Admitted Guests at Venue (Heads)', Value: checkedInGuestHeads },
    { Metric: 'Declined Responses', Value: declinedCount },
    { Metric: 'Last Updated', Value: formatDate(new Date().toISOString()) },
  ];

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 40 }, { wch: 45 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary & Statistics');

  return wb;
}

/**
 * Generates binary base64 string of the Excel file
 */
export function generateExcelBase64(records: RsvpRecord[]): string {
  const wb = buildExcelWorkbook(records);
  return XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
}

/**
 * Triggers a browser download of the Excel spreadsheet
 */
export function downloadExcelFile(records?: RsvpRecord[], filename = 'Basit-Ambiya-Wedding-RSVPs.xlsx'): void {
  const data = records || getStoredRsvps();
  const wb = buildExcelWorkbook(data);
  XLSX.writeFile(wb, filename);
}

/**
 * Records a QR code check-in scan in the RSVP sheet with Multi-Function support
 * - If guest is invited to 2 functions and visits function 1, function 1 is marked checked-in.
 * - When they later visit function 2 with the same QR code, function 2 is marked checked-in as well.
 */
export async function recordGuestCheckIn(payload: CheckInPayload): Promise<{
  success: boolean;
  isNewEntry: boolean;
  record: RsvpRecord;
  message: string;
  checkedInEventName: string;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const cleanName = (payload.guestName || 'Honored Guest').trim();
  const cleanPassId = (payload.passId || `BA-PASS-${Date.now()}`).trim();
  const guests = Math.max(1, Number(payload.guestCount) || 1);
  const invitedEvents = Array.isArray(payload.events) && payload.events.length > 0 ? payload.events : ['Wedding Celebrations'];
  const nowIso = new Date().toISOString();

  // Find target event to check into
  let targetEventToCheckIn = payload.specificEvent ? normalizeEventName(payload.specificEvent) : '';
  if (!targetEventToCheckIn) {
    // If no specific event passed, pick the earliest pending event, or the first event
    targetEventToCheckIn = normalizeEventName(invitedEvents[0] || 'Wedding Celebrations');
  }

  // Look for matching record: first by pass id, second by guest name, third by phone
  let matchIndex = current.findIndex(
    (r) =>
      (r.checked_in_pass_id && r.checked_in_pass_id.toLowerCase() === cleanPassId.toLowerCase()) ||
      (r.guest_name && r.guest_name.toLowerCase() === cleanName.toLowerCase()) ||
      (payload.phone && r.phone && r.phone === payload.phone)
  );

  let targetRecord: RsvpRecord;
  let isNewEntry = false;

  if (matchIndex >= 0) {
    const existing = current[matchIndex];
    const prevMap: Record<string, string> = { ...(existing.checked_in_events_map || {}) };

    if (payload.checkInAll) {
      invitedEvents.forEach((ev) => {
        const norm = normalizeEventName(ev);
        if (!prevMap[norm]) prevMap[norm] = nowIso;
      });
    } else {
      prevMap[targetEventToCheckIn] = prevMap[targetEventToCheckIn] || nowIso;
    }

    const updatedEventsList = Array.from(new Set([...(existing.checked_in_events || []), ...Object.keys(prevMap)]));

    targetRecord = {
      ...existing,
      checked_in: true,
      checked_in_at: nowIso,
      checked_in_pass_id: cleanPassId,
      checked_in_events: updatedEventsList,
      checked_in_events_map: prevMap,
      checked_in_guest_count: guests,
      attending: 'yes',
      guest_count: Math.max(existing.guest_count, guests),
    };
    current[matchIndex] = targetRecord;
  } else {
    isNewEntry = true;
    const initialMap: Record<string, string> = {};
    if (payload.checkInAll) {
      invitedEvents.forEach((ev) => {
        initialMap[normalizeEventName(ev)] = nowIso;
      });
    } else {
      initialMap[targetEventToCheckIn] = nowIso;
    }

    targetRecord = {
      id: `rsvp-scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submitted_at: nowIso,
      guest_name: cleanName,
      phone: payload.phone || null,
      attending: 'yes',
      guest_count: guests,
      events: invitedEvents,
      dietary: null,
      message: 'Verified VIP QR Pass scan check-in',
      checked_in: true,
      checked_in_at: nowIso,
      checked_in_pass_id: cleanPassId,
      checked_in_events: Object.keys(initialMap),
      checked_in_events_map: initialMap,
      checked_in_guest_count: guests,
    };
    current.unshift(targetRecord);
  }

  // 1. Save locally
  saveAllRsvps(current);

  // 2. Notify backend server
  try {
    await fetch('/api/rsvp/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        passId: cleanPassId,
        guestName: cleanName,
        guestCount: guests,
        events: invitedEvents,
        targetEvent: targetEventToCheckIn,
        checkInAll: payload.checkInAll,
        checked_in_events_map: targetRecord.checked_in_events_map,
        phone: payload.phone || null,
        checked_in_at: nowIso,
      }),
    }).catch(() => {});
  } catch {}

  // 3. Push to GitHub if configured
  const ghConfig = getGitHubConfig();
  let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      githubSyncResult = await pushExcelToGitHub(current, ghConfig);
    } catch (ghErr) {
      console.warn('Auto GitHub push on checkin failed:', ghErr);
    }
  }

  window.dispatchEvent(new CustomEvent('wedding_rsvp_updated', { detail: current }));

  return {
    success: true,
    isNewEntry,
    record: targetRecord,
    checkedInEventName: targetEventToCheckIn,
    message: `Check-in recorded for ${cleanName} at "${targetEventToCheckIn}" (${guests} guest${guests > 1 ? 's' : ''})`,
    githubSyncResult,
  };
}

/**
 * Toggles a specific event check-in state for a guest
 */
export async function toggleGuestEventCheckIn(
  recordId: string,
  eventName: string
): Promise<{
  success: boolean;
  newStatus: boolean;
  record?: RsvpRecord;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const idx = current.findIndex((r) => r.id === recordId);
  if (idx < 0) return { success: false, newStatus: false };

  const normEvent = normalizeEventName(eventName);
  const nowIso = new Date().toISOString();
  const prevMap: Record<string, string> = { ...(current[idx].checked_in_events_map || {}) };

  const wasCheckedIn = Boolean(prevMap[normEvent]);
  const newStatus = !wasCheckedIn;

  if (newStatus) {
    prevMap[normEvent] = nowIso;
  } else {
    delete prevMap[normEvent];
  }

  const updatedEventsList = Object.keys(prevMap);
  const hasAnyCheckIn = updatedEventsList.length > 0;

  current[idx] = {
    ...current[idx],
    checked_in: hasAnyCheckIn,
    checked_in_at: hasAnyCheckIn ? (newStatus ? nowIso : current[idx].checked_in_at) : null,
    checked_in_events: updatedEventsList,
    checked_in_events_map: prevMap,
  };

  saveAllRsvps(current);

  try {
    await fetch('/api/rsvp/checkin/toggle-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: recordId,
        eventName: normEvent,
        checked_in: newStatus,
        checked_in_at: newStatus ? nowIso : null,
        checked_in_events_map: prevMap,
      }),
    }).catch(() => {});
  } catch {}

  const ghConfig = getGitHubConfig();
  let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      githubSyncResult = await pushExcelToGitHub(current, ghConfig);
    } catch {}
  }

  window.dispatchEvent(new CustomEvent('wedding_rsvp_updated', { detail: current }));

  return { success: true, newStatus, record: current[idx], githubSyncResult };
}

/**
 * Toggles entire check-in state manually from RSVP manager table
 */
export async function toggleGuestCheckInStatus(recordId: string): Promise<{
  success: boolean;
  newStatus: boolean;
  record?: RsvpRecord;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const idx = current.findIndex((r) => r.id === recordId);
  if (idx < 0) return { success: false, newStatus: false };

  const prevStatus = Boolean(current[idx].checked_in);
  const newStatus = !prevStatus;
  const nowIso = new Date().toISOString();

  const newMap: Record<string, string> = {};
  if (newStatus) {
    const events = current[idx].events && current[idx].events.length > 0 ? current[idx].events : ['Wedding Celebrations'];
    events.forEach((ev) => {
      newMap[normalizeEventName(ev)] = nowIso;
    });
  }

  current[idx] = {
    ...current[idx],
    checked_in: newStatus,
    checked_in_at: newStatus ? nowIso : null,
    checked_in_pass_id: newStatus ? current[idx].checked_in_pass_id || `BA-MANUAL-${current[idx].id.slice(-4)}` : current[idx].checked_in_pass_id,
    checked_in_events: Object.keys(newMap),
    checked_in_events_map: newMap,
  };

  saveAllRsvps(current);

  try {
    await fetch('/api/rsvp/checkin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, checked_in: newStatus, checked_in_at: newStatus ? nowIso : null, checked_in_events_map: newMap }),
    }).catch(() => {});
  } catch {}

  const ghConfig = getGitHubConfig();
  let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      githubSyncResult = await pushExcelToGitHub(current, ghConfig);
    } catch {}
  }

  window.dispatchEvent(new CustomEvent('wedding_rsvp_updated', { detail: current }));

  return { success: true, newStatus, record: current[idx], githubSyncResult };
}

/**
 * Pushes the Excel file directly to GitHub repository via GitHub REST API v3
 */
export async function pushExcelToGitHub(
  records: RsvpRecord[],
  rawConfig: GitHubSyncConfig
): Promise<{ success: boolean; message: string; commitUrl?: string }> {
  const config = sanitizeGitHubConfig(rawConfig);
  if (!config.token || !config.owner || !config.repo) {
    return {
      success: false,
      message: 'GitHub credentials incomplete. Please configure Token, Owner, and Repository.',
    };
  }

  let exactOwner = config.owner;
  let exactRepo = config.repo;
  let branch = config.branch || 'main';

  // 1. Proactively query repo metadata to resolve transferred repos or org ownership
  try {
    const metaRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (metaRes.ok) {
      const meta = (await metaRes.json()) as any;
      if (meta.owner?.login) {
        exactOwner = meta.owner.login;
      } else if (meta.full_name && meta.full_name.includes('/')) {
        exactOwner = meta.full_name.split('/')[0];
      }
      if (meta.name) {
        exactRepo = meta.name;
      }
      if (meta.default_branch && (!config.branch || config.branch === 'main' || config.branch === 'master')) {
        branch = meta.default_branch;
      }
    }
  } catch (e) {
    // Continue with sanitized config
  }

  const base64Content = generateExcelBase64(records);
  const filePath = config.filePath || 'wedding-rsvps.xlsx';
  const apiUrl = `https://api.github.com/repos/${exactOwner}/${exactRepo}/contents/${filePath}`;

  let existingSha: string | undefined = undefined;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (getRes.ok) {
      const data = (await getRes.json()) as any;
      existingSha = data.sha;
    } else if (getRes.status === 401) {
      return {
        success: false,
        message: 'Invalid Personal Access Token (401 Unauthorized). Please check your GitHub token.',
      };
    } else if (getRes.status === 404) {
      // Check if branch exists, or if 'main' / 'master' fallback is needed
      const branchRes = await fetch(`https://api.github.com/repos/${exactOwner}/${exactRepo}/branches/${branch}`, {
        headers: {
          Authorization: `Bearer ${config.token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }).catch(() => null);

      if (branchRes && branchRes.status === 404) {
        const altBranch = branch === 'main' ? 'master' : 'main';
        const altRes = await fetch(`https://api.github.com/repos/${exactOwner}/${exactRepo}/branches/${altBranch}`, {
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        }).catch(() => null);

        if (altRes && altRes.ok) {
          branch = altBranch;
          config.branch = altBranch;
          saveGitHubConfig(config);
        }
      }
    }
  } catch (e) {
    // If not found, will create new file
  }

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const checkedInCount = records.filter((r) => r.checked_in).length;
  const commitMessage = existingSha
    ? `Update RSVP & Multi-Function Check-In sheet (${records.length} RSVPs, ${checkedInCount} Checked-In) [${timestamp}]`
    : `Initialize RSVP & Multi-Function Check-In sheet (${records.length} RSVPs) [${timestamp}]`;

  const payload: any = {
    message: commitMessage,
    content: base64Content,
    branch,
  };
  if (existingSha) {
    payload.sha = existingSha;
  }

  try {
    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putRes.ok) {
      const errJson = (await putRes.json().catch(() => ({}))) as any;
      let errorMsg = errJson.message || `GitHub API error: HTTP ${putRes.status}`;
      if (putRes.status === 401) {
        errorMsg = 'GitHub Token unauthorized (401). Please check Personal Access Token.';
      } else if (putRes.status === 404) {
        errorMsg = `Repository or branch "${exactOwner}/${exactRepo} (${branch})" not found. Please verify repo name.`;
      } else if (putRes.status === 409) {
        errorMsg = 'Commit SHA conflict (409). Please click Sync again to re-align with latest GitHub commit.';
      } else if (putRes.status === 403) {
        errorMsg = `Permission denied (403): Token lacks write permission. Ensure token has "repo" (Classic) or "Contents: Read & write" (Fine-grained).`;
      }
      throw new Error(errorMsg);
    }

    const resData = (await putRes.json()) as any;
    const commitUrl = resData?.commit?.html_url || `https://github.com/${exactOwner}/${exactRepo}/blob/${branch}/${filePath}`;

    const updatedConfig: GitHubSyncConfig = {
      ...config,
      owner: exactOwner,
      repo: exactRepo,
      branch,
      lastSyncedAt: new Date().toISOString(),
      lastCommitUrl: commitUrl,
    };
    saveGitHubConfig(updatedConfig);

    return {
      success: true,
      message: `Successfully synced Excel spreadsheet (${filePath}) to GitHub (${exactOwner}/${exactRepo} on branch "${branch}")!`,
      commitUrl,
    };
  } catch (err: any) {
    console.warn('Client-side GitHub commit notice, trying server sync endpoint:', err);

    // Try server sync proxy endpoint
    try {
      const serverRes = await fetch('/api/github-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: commitMessage }),
      });
      if (serverRes.ok) {
        const sData = await serverRes.json();
        if (sData.success) {
          return {
            success: true,
            message: sData.message || 'Synced to GitHub via server!',
            commitUrl: sData.commitUrl,
          };
        }
      }
    } catch {}

    return {
      success: false,
      message: err.message || 'Failed to push Excel file to GitHub. Please check token permissions.',
    };
  }
}

/**
 * Adds or updates a single RSVP submission
 */
export const addRsvpEntry = submitRsvp;

export async function submitRsvp(entry: Omit<RsvpRecord, 'id' | 'submitted_at'>): Promise<{
  success: boolean;
  record: RsvpRecord;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const newRecord: RsvpRecord = {
    ...entry,
    id: `rsvp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    submitted_at: new Date().toISOString(),
    checked_in: false,
    checked_in_at: null,
    checked_in_pass_id: null,
    checked_in_events: [],
    checked_in_events_map: {},
  };

  current.unshift(newRecord);
  saveAllRsvps(current);

  if (newRecord.message && newRecord.message.trim().length > 0) {
    addWeddingWish({
      name: newRecord.guest_name,
      relationOrCity: newRecord.events.length > 0 ? 'Attending Guest' : 'Wedding Guest',
      message: newRecord.message.trim(),
      attending: newRecord.attending,
    }).catch(() => {});
  }

  try {
    await fetch('/api/rsvp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRecord),
    }).catch(() => {});
  } catch {}

  const ghConfig = getGitHubConfig();
  let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
  if (ghConfig.enabled && ghConfig.autoSyncOnSubmit && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      githubSyncResult = await pushExcelToGitHub(current, ghConfig);
    } catch (ghErr) {
      console.warn('Auto GitHub push on RSVP failed:', ghErr);
    }
  }

  return {
    success: true,
    record: newRecord,
    githubSyncResult,
  };
}

/**
 * Imports an uploaded XLSX or CSV file and merges with existing records
 */
export async function importExcelFile(file: File): Promise<{
  success: boolean;
  message: string;
  totalRecords: number;
  newImportedCount: number;
  records: RsvpRecord[];
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const wb = XLSX.read(arrayBuffer, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      throw new Error('No sheets found in uploaded Excel file.');
    }
    const ws = wb.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

    if (rawRows.length === 0) {
      throw new Error('The uploaded Excel sheet contains no data rows.');
    }

    const currentRecords = getStoredRsvps();
    const parsedRecords: RsvpRecord[] = [];

    const findField = (row: Record<string, any>, patterns: string[]): any => {
      const keys = Object.keys(row);
      for (const pattern of patterns) {
        const cleanPattern = pattern.toLowerCase().replace(/[^a-z0-9]/g, '');
        const foundKey = keys.find(
          (k) => k.trim().toLowerCase().replace(/[^a-z0-9]/g, '') === cleanPattern
        );
        if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null) {
          return row[foundKey];
        }
      }
      return '';
    };

    let importedCount = 0;
    for (let idx = 0; idx < rawRows.length; idx++) {
      const row = rawRows[idx];
      const guestName = String(
        findField(row, ['Guest Name', 'Name', 'Full Name', 'Guest', 'Invitee'])
      ).trim();

      if (
        !guestName ||
        guestName.toLowerCase().includes('registry initialized') ||
        guestName.toLowerCase().includes('template initialized') ||
        guestName.toLowerCase().includes('wedding rsvp registry')
      ) {
        continue;
      }

      const phone =
        String(findField(row, ['Contact Phone', 'Phone', 'Mobile', 'Contact', 'Number'])).trim() ||
        null;
      const attendingRaw = String(
        findField(row, ['Attending Status', 'Attending', 'Status', 'RSVP Status'])
      ).toLowerCase();
      const isDeclined =
        attendingRaw.includes('decline') ||
        attendingRaw.includes('no') ||
        attendingRaw.includes('not attending');
      const attending: 'yes' | 'no' = isDeclined ? 'no' : 'yes';
      const guestCountRaw = findField(row, [
        'Total Guests Attending',
        'Guests',
        'Guest Count',
        'Number of Guests',
        'Total Guests',
        'Count',
        'Seats',
      ]);
      const parsedGuestCount = Number(guestCountRaw);
      const guest_count =
        attending === 'no'
          ? 0
          : !isNaN(parsedGuestCount) && parsedGuestCount > 0
          ? parsedGuestCount
          : 1;

      const checkInRaw = String(
        findField(row, ['Check-In Status', 'Overall Check-In Status', 'Check In Status', 'Check In', 'Checked In', 'Checkin'])
      ).toLowerCase();
      const checked_in = checkInRaw.includes('check') || checkInRaw.includes('yes') || checkInRaw.includes('admit');

      const checkInTimeRaw = String(
        findField(row, ['Check-In Time', 'Latest Check-In Time', 'Checkin Time', 'Scan Time', 'Arrival Time'])
      ).trim();

      const passId = String(
        findField(row, ['VIP Pass ID', 'Pass ID', 'PassId', 'Pass', 'VIP Pass', 'Check-In Pass ID'])
      ).trim() || null;

      const ceremoniesRaw = String(
        findField(row, ['Invited Ceremonies', 'Ceremonies Selected', 'Ceremonies', 'Events', 'Functions', 'Events Selected'])
      ).trim();
      const events: string[] =
        ceremoniesRaw &&
        ceremoniesRaw !== '—' &&
        ceremoniesRaw.toLowerCase() !== 'all celebrations / general'
          ? ceremoniesRaw.split(/[;,]/).map((s) => s.trim()).filter(Boolean)
          : [];

      const dietary = String(
        findField(row, ['Dietary Preferences', 'Dietary', 'Diet', 'Food Preferences', 'Food'])
      ).trim();
      const cleanDietary =
        dietary && dietary !== '—' && dietary.toLowerCase() !== 'none specified' ? dietary : null;

      const message = String(
        findField(row, [
          'Heartfelt Duas & Message',
          'Message',
          'Duas',
          'Dua',
          'Blessing',
          'Wishes',
          'Notes',
        ])
      ).trim();
      const cleanMessage = message && message !== '—' ? message : null;

      const dateRaw = String(
        findField(row, ['Submission Date', 'Date', 'Submitted At', 'Timestamp'])
      ).trim();
      let submitted_at = new Date().toISOString();
      if (dateRaw) {
        const parsedDate = new Date(dateRaw);
        if (!isNaN(parsedDate.getTime())) {
          submitted_at = parsedDate.toISOString();
        }
      }

      parsedRecords.push({
        id: `rsvp-import-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        submitted_at,
        guest_name: guestName,
        phone,
        attending,
        guest_count,
        events,
        dietary: cleanDietary,
        message: cleanMessage,
        checked_in,
        checked_in_at: checked_in ? (checkInTimeRaw || new Date().toISOString()) : null,
        checked_in_pass_id: passId,
        checked_in_events: checked_in ? events : [],
      });
      importedCount++;
    }

    if (parsedRecords.length === 0) {
      throw new Error(
        'No valid guest records found in the sheet. Please make sure columns have "Guest Name" and "Attending Status".'
      );
    }

    const mergedList: RsvpRecord[] = [...currentRecords];
    let newEntriesCount = 0;
    for (const newRec of parsedRecords) {
      const existingIdx = mergedList.findIndex(
        (cur) =>
          cur.guest_name.toLowerCase() === newRec.guest_name.toLowerCase() &&
          (cur.phone === newRec.phone || (!cur.phone && !newRec.phone))
      );
      if (existingIdx >= 0) {
        mergedList[existingIdx] = {
          ...mergedList[existingIdx],
          ...newRec,
          id: mergedList[existingIdx].id,
        };
      } else {
        mergedList.push(newRec);
        newEntriesCount++;
      }

      if (newRec.message && newRec.message.trim().length > 0) {
        addWeddingWish({
          name: newRec.guest_name,
          relationOrCity: newRec.events.length > 0 ? 'Attending Guest' : 'Wedding Guest',
          message: newRec.message.trim(),
          attending: newRec.attending,
        }).catch(() => {});
      }
    }

    saveAllRsvps(mergedList);

    try {
      await fetch('/api/rsvp/bulk?admin=rsvp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-rsvp': 'true',
        },
        body: JSON.stringify({ rsvps: mergedList }),
      }).catch(() => {});
    } catch {}

    const ghConfig = getGitHubConfig();
    let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
    if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
      try {
        githubSyncResult = await pushExcelToGitHub(mergedList, ghConfig);
      } catch (ghErr) {
        console.warn('Auto GitHub push after import failed:', ghErr);
      }
    }

    const ghNotice = githubSyncResult?.success ? ' and synced to GitHub!' : '';
    return {
      success: true,
      message: `Successfully uploaded & imported ${importedCount} guests (${newEntriesCount} new)${ghNotice}`,
      totalRecords: mergedList.length,
      newImportedCount: newEntriesCount,
      records: mergedList,
      githubSyncResult,
    };
  } catch (err: any) {
    console.error('Error importing Excel file:', err);
    return {
      success: false,
      message: err.message || 'Failed to read or parse the Excel file.',
      totalRecords: 0,
      newImportedCount: 0,
      records: [],
    };
  }
}

/**
 * Deletes an RSVP record by ID (Admin only)
 */
export async function deleteRsvpEntry(id: string): Promise<{
  success: boolean;
  message: string;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const existing = current.find((r) => r.id === id);
  if (!existing) {
    return { success: false, message: 'Record not found' };
  }

  const updated = current.filter((r) => r.id !== id);
  saveAllRsvps(updated);

  try {
    await fetch(`/api/rsvp/${id}?admin=rsvp`, {
      method: 'DELETE',
      headers: {
        'x-admin-rsvp': 'true',
      },
    }).catch(() => {});
  } catch {}

  const ghConfig = getGitHubConfig();
  let githubSyncResult: { success: boolean; message: string; commitUrl?: string } | undefined;
  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      githubSyncResult = await pushExcelToGitHub(updated, ghConfig);
    } catch (e: any) {
      console.warn('GitHub push error on delete:', e);
    }
  }

  window.dispatchEvent(new CustomEvent('wedding_rsvp_updated', { detail: updated }));
  window.dispatchEvent(new CustomEvent('wedding_wishes_updated'));

  return {
    success: true,
    message: `RSVP record for "${existing.guest_name}" was deleted successfully.`,
    githubSyncResult,
  };
}
