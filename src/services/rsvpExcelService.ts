import * as XLSX from 'xlsx';
import { addWeddingWish } from './wishesService';

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
  checked_in_events?: string[];
  checked_in_guest_count?: number;
}

export interface CheckInPayload {
  passId: string;
  guestName: string;
  guestCount?: number;
  events?: string[];
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
  owner: '',
  repo: '',
  branch: 'main',
  filePath: 'wedding-rsvps.xlsx',
  token: '',
  autoSyncOnSubmit: true,
};

/**
 * Retrieves all stored RSVPs from localStorage
 */
export function getStoredRsvps(): RsvpRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_RSVPS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item, index) => ({
        id: item.id || `rsvp-${index + 1}-${Date.now()}`,
        submitted_at: item.submitted_at || new Date().toISOString(),
        guest_name: item.guest_name || 'Anonymous Guest',
        phone: item.phone || '',
        attending: item.attending === 'no' ? 'no' : 'yes',
        guest_count: Number(item.guest_count) || (item.attending === 'no' ? 0 : 1),
        events: Array.isArray(item.events) ? item.events : [],
        dietary: item.dietary || '',
        message: item.message || '',
        checked_in: Boolean(item.checked_in),
        checked_in_at: item.checked_in_at || null,
        checked_in_pass_id: item.checked_in_pass_id || null,
        checked_in_events: Array.isArray(item.checked_in_events) ? item.checked_in_events : item.events || [],
        checked_in_guest_count: typeof item.checked_in_guest_count === 'number' ? item.checked_in_guest_count : item.guest_count || 1,
      }));
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
 * Retrieves stored GitHub sync settings
 */
export function getGitHubConfig(): GitHubSyncConfig {
  let config: GitHubSyncConfig = {
    ...DEFAULT_GH_CONFIG,
    owner: (import.meta as any).env?.VITE_GITHUB_OWNER || 'ashutoshs019',
    repo: (import.meta as any).env?.VITE_GITHUB_REPO || 'wedding-invitation',
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

  return config;
}

/**
 * Saves GitHub sync settings to localStorage
 */
export function saveGitHubConfig(config: GitHubSyncConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_GH_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error('Error saving github config:', err);
  }
}

/**
 * Formats ISO date to readable string
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
 * Builds an XLSX workbook object from the RSVP records including Check-In status
 */
export function buildExcelWorkbook(records: RsvpRecord[]): XLSX.WorkBook {
  const rows = records.map((r, idx) => ({
    'S.No': idx + 1,
    'Submission Date': formatDate(r.submitted_at),
    'Guest Name': r.guest_name,
    'Contact Phone': r.phone || 'N/A',
    'Attending Status': r.attending === 'yes' ? 'Confirmed (Attending)' : 'Respectfully Declined',
    'Total Guests Attending': r.attending === 'yes' ? r.guest_count : 0,
    'Check-In Status': r.checked_in ? '✅ Checked In' : '⏳ Awaiting Check-In',
    'Check-In Time': r.checked_in_at ? formatDate(r.checked_in_at) : '—',
    'Pass ID': r.checked_in_pass_id || '—',
    'Ceremonies Selected': r.events && r.events.length > 0 ? r.events.join('; ') : 'All Celebrations / General',
    'Dietary Preferences': r.dietary || 'None specified',
    'Heartfelt Duas & Message': r.message || '—',
  }));

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
          'Check-In Status': '⏳ Awaiting Check-In',
          'Check-In Time': '—',
          'Pass ID': '—',
          'Ceremonies Selected': '—',
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
    { wch: 20 }, // Check-In Status
    { wch: 22 }, // Check-In Time
    { wch: 18 }, // Pass ID
    { wch: 45 }, // Ceremonies
    { wch: 22 }, // Dietary
    { wch: 55 }, // Message
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'RSVP Responses');

  // Summary sheet
  const totalResponses = records.length;
  const attendingCount = records.filter((r) => r.attending === 'yes').length;
  const totalGuests = records.reduce((sum, r) => sum + (r.attending === 'yes' ? r.guest_count : 0), 0);
  const checkedInRecords = records.filter((r) => r.checked_in);
  const checkedInCount = checkedInRecords.length;
  const checkedInGuestHeads = checkedInRecords.reduce((sum, r) => sum + (r.checked_in_guest_count || r.guest_count || 1), 0);
  const declinedCount = records.filter((r) => r.attending === 'no').length;

  const summaryData = [
    { Metric: 'Couple', Value: 'Basit Ali & Ambiya Basher' },
    { Metric: 'Wedding Date', Value: 'Thursday, 29th October 2026' },
    { Metric: 'Total RSVP Responses', Value: totalResponses },
    { Metric: 'Confirmed Attending Responses', Value: attendingCount },
    { Metric: 'Total Expected Guests (Heads)', Value: totalGuests },
    { Metric: 'Checked-In Passes Verified', Value: checkedInCount },
    { Metric: 'Total Guests Admitted at Venue (Heads)', Value: checkedInGuestHeads },
    { Metric: 'Declined Responses', Value: declinedCount },
    { Metric: 'Last Updated', Value: formatDate(new Date().toISOString()) },
  ];

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs['!cols'] = [{ wch: 38 }, { wch: 38 }];
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
 * Records a QR code check-in scan in the RSVP sheet and syncs it across server & GitHub
 */
export async function recordGuestCheckIn(payload: CheckInPayload): Promise<{
  success: boolean;
  isNewEntry: boolean;
  record: RsvpRecord;
  message: string;
  githubSyncResult?: { success: boolean; message: string; commitUrl?: string };
}> {
  const current = getStoredRsvps();
  const cleanName = (payload.guestName || 'Honored Guest').trim();
  const cleanPassId = (payload.passId || `BA-PASS-${Date.now()}`).trim();
  const guests = Math.max(1, Number(payload.guestCount) || 1);
  const events = Array.isArray(payload.events) && payload.events.length > 0 ? payload.events : ['Wedding Celebrations'];
  const nowIso = new Date().toISOString();

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
    targetRecord = {
      ...current[matchIndex],
      checked_in: true,
      checked_in_at: current[matchIndex].checked_in_at || nowIso,
      checked_in_pass_id: cleanPassId,
      checked_in_events: events,
      checked_in_guest_count: guests,
      attending: 'yes',
      guest_count: Math.max(current[matchIndex].guest_count, guests),
    };
    current[matchIndex] = targetRecord;
  } else {
    isNewEntry = true;
    targetRecord = {
      id: `rsvp-scan-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      submitted_at: nowIso,
      guest_name: cleanName,
      phone: payload.phone || null,
      attending: 'yes',
      guest_count: guests,
      events: events,
      dietary: null,
      message: 'Verified VIP QR Pass scan check-in',
      checked_in: true,
      checked_in_at: nowIso,
      checked_in_pass_id: cleanPassId,
      checked_in_events: events,
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
        events: events,
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
    message: `Check-in recorded for ${cleanName} (${guests} guest${guests > 1 ? 's' : ''})`,
    githubSyncResult,
  };
}

/**
 * Toggles check-in state manually from RSVP manager table
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

  current[idx] = {
    ...current[idx],
    checked_in: newStatus,
    checked_in_at: newStatus ? nowIso : null,
    checked_in_pass_id: newStatus ? current[idx].checked_in_pass_id || `BA-MANUAL-${current[idx].id.slice(-4)}` : current[idx].checked_in_pass_id,
  };

  saveAllRsvps(current);

  try {
    await fetch('/api/rsvp/checkin/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recordId, checked_in: newStatus, checked_in_at: newStatus ? nowIso : null }),
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
  config: GitHubSyncConfig
): Promise<{ success: boolean; message: string; commitUrl?: string }> {
  if (!config.token || !config.owner || !config.repo) {
    return {
      success: false,
      message: 'GitHub credentials incomplete. Please configure Token, Owner, and Repository.',
    };
  }

  const base64Content = generateExcelBase64(records);
  const filePath = config.filePath || 'wedding-rsvps.xlsx';
  const branch = config.branch || 'main';
  const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${filePath}`;

  let existingSha: string | undefined = undefined;
  try {
    const getRes = await fetch(`${apiUrl}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${config.token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (getRes.ok) {
      const data = (await getRes.json()) as any;
      existingSha = data.sha;
    }
  } catch {
    // If not found, will create new file
  }

  const timestamp = new Date().toLocaleString();
  const checkedInCount = records.filter((r) => r.checked_in).length;
  const commitMessage = existingSha
    ? `Update RSVP & Check-in sheet (${records.length} RSVPs, ${checkedInCount} Checked-In) [${timestamp}]`
    : `Initialize RSVP & Check-in sheet (${records.length} RSVPs) [${timestamp}]`;

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
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!putRes.ok) {
      const errJson = (await putRes.json().catch(() => ({}))) as any;
      throw new Error(errJson.message || `GitHub API error: HTTP ${putRes.status}`);
    }

    const resData = (await putRes.json()) as any;
    const commitUrl = resData?.commit?.html_url || `https://github.com/${config.owner}/${config.repo}/blob/${branch}/${filePath}`;

    const updatedConfig: GitHubSyncConfig = {
      ...config,
      lastSyncedAt: new Date().toISOString(),
      lastCommitUrl: commitUrl,
    };
    saveGitHubConfig(updatedConfig);

    return {
      success: true,
      message: `Successfully synced Excel spreadsheet to GitHub repository (${config.owner}/${config.repo})!`,
      commitUrl,
    };
  } catch (err: any) {
    console.error('Failed to commit Excel file to GitHub:', err);
    return {
      success: false,
      message: err.message || 'Failed to push Excel file to GitHub.',
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
        findField(row, ['Check-In Status', 'Check In Status', 'Check In', 'Checked In', 'Checkin'])
      ).toLowerCase();
      const checked_in = checkInRaw.includes('check') || checkInRaw.includes('yes') || checkInRaw.includes('attended');

      const checkInTimeRaw = String(
        findField(row, ['Check-In Time', 'Checkin Time', 'Scan Time', 'Arrival Time'])
      ).trim();

      const passId = String(
        findField(row, ['Pass ID', 'PassId', 'Pass', 'VIP Pass', 'Check-In Pass ID'])
      ).trim() || null;

      const ceremoniesRaw = String(
        findField(row, ['Ceremonies Selected', 'Ceremonies', 'Events', 'Functions', 'Events Selected'])
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
