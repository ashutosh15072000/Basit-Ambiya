import { getAssetPath } from '../utils/assets';
import { getGitHubConfig, sanitizeGitHubConfig, GitHubSyncConfig } from './rsvpExcelService';

export interface WeddingWish {
  id: string;
  name: string;
  relationOrCity?: string;
  message: string;
  date: string;
  timestamp?: string;
  likes: number;
  attending?: 'yes' | 'no';
}

const STORAGE_KEY_WISHES = 'wedding_guest_wishes';
const STORAGE_KEY_LIKES = 'wedding_wishes_liked';
const STORAGE_KEY_DELETED_WISHES = 'wedding_deleted_wish_ids';

export function getDeletedWishIds(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DELETED_WISHES);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) return new Set(arr);
    }
  } catch {}
  return new Set();
}

export function markWishAsDeleted(id: string): void {
  const ids = getDeletedWishIds();
  ids.add(id);
  try {
    localStorage.setItem(STORAGE_KEY_DELETED_WISHES, JSON.stringify(Array.from(ids)));
  } catch {}
}

// Initial fallback wishes in case network is completely offline
const INITIAL_FALLBACK_WISHES: WeddingWish[] = [
  {
    id: 'wish-1790437478785-lpdo',
    name: 'Ashuuu',
    relationOrCity: 'Lucknow',
    message: 'Djddismsbsusuwjj',
    date: '26 Sept 2026',
    timestamp: '2026-09-26T15:44:38.762Z',
    likes: 1,
    attending: 'yes',
  },
  {
    id: 'wish-1790434753458-8a6j',
    name: 'Ayesha Khan',
    relationOrCity: 'Hyderabad',
    message: 'Sending heartfelt prayers for a joyous married life! May Allah bless both of you abundantly.',
    date: 'Sep 26, 2026',
    timestamp: '2026-09-26T14:59:13.465Z',
    likes: 1,
    attending: 'yes',
  },
  {
    id: 'wish-init-1',
    name: 'Tariq Ahmad',
    relationOrCity: 'Family & Well-wisher',
    message: 'Mubarak to the lovely couple! May Allah SWT bless Basit & Ambiya with endless happiness, love and harmony in this sacred union. Ameen!',
    date: 'Sep 25, 2026',
    timestamp: '2026-09-25T19:04:05.325Z',
    likes: 12,
    attending: 'yes',
  },
  {
    id: 'wish-init-2',
    name: 'Farhan & Family',
    relationOrCity: 'Delhi',
    message: 'Heartiest congratulations to Basit Ali and Ambiya Basher on your sacred Rukhsati! May your home always be filled with joy, peace, and abundance of Barakah.',
    date: 'Sep 25, 2026',
    timestamp: '2026-09-25T19:20:00.000Z',
    likes: 9,
    attending: 'yes',
  },
  {
    id: 'wish-init-3',
    name: 'Zubair Siddiqui',
    relationOrCity: 'Lucknow',
    message: "Baarakallahu laka wa baaraka 'alayka wa jama'a baynakumaa fee khayr. May Allah shower His countless blessings upon both of you as you embark on this beautiful new journey together!",
    date: 'Sep 25, 2026',
    timestamp: '2026-09-25T19:35:00.000Z',
    likes: 15,
    attending: 'yes',
  },
];

/**
 * Encodes string to UTF-8 safe base64
 */
function toBase64Utf8(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return btoa(str);
  }
}

/**
 * Extracts any messages sent through RSVP submissions and converts them into wedding wishes
 * so they are immediately visible in the message display section.
 */
export function extractWishesFromRsvps(): WeddingWish[] {
  const deletedIds = getDeletedWishIds();
  try {
    const rawRsvps = localStorage.getItem('wedding_rsvps');
    if (!rawRsvps) return [];
    const rsvps = JSON.parse(rawRsvps);
    if (!Array.isArray(rsvps)) return [];

    return rsvps
      .filter((r) => r.message && String(r.message).trim().length > 0)
      .map((r, idx) => {
        const id = `wish-rsvp-${(r.guest_name || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${r.submitted_at || idx}`;
        const dateStr = r.submitted_at
          ? new Date(r.submitted_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })
          : 'Recent RSVP';

        return {
          id,
          name: String(r.guest_name).trim(),
          relationOrCity: r.events && r.events.length > 0 ? 'Attending Guest' : 'Wedding Guest',
          message: String(r.message).trim(),
          date: dateStr,
          timestamp: r.submitted_at || new Date().toISOString(),
          likes: 1,
          attending: r.attending || 'yes',
        };
      })
      .filter((w) => !deletedIds.has(w.id));
  } catch (err) {
    console.error('Error extracting wishes from stored RSVPs:', err);
    return [];
  }
}

/**
 * Get locally stored wishes merged with any messages sent through RSVP forms
 */
export function getStoredWishes(): WeddingWish[] {
  const deletedIds = getDeletedWishIds();
  const wishesMap = new Map<string, WeddingWish>();

  // 1. Initial fallbacks
  INITIAL_FALLBACK_WISHES.forEach((w) => {
    if (!deletedIds.has(w.id)) wishesMap.set(w.id, w);
  });

  // 2. Direct wishes in localStorage
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WISHES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        parsed.forEach((w) => {
          if (!deletedIds.has(w.id)) wishesMap.set(w.id, w);
        });
      }
    }
  } catch (err) {
    console.error('Error reading wishes from localStorage:', err);
  }

  // 3. Messages sent through RSVP forms
  extractWishesFromRsvps().forEach((w) => {
    if (!deletedIds.has(w.id)) wishesMap.set(w.id, w);
  });

  return Array.from(wishesMap.values()).sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Save wishes to localStorage and trigger custom event
 */
export function saveWishesLocally(wishes: WeddingWish[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_WISHES, JSON.stringify(wishes));
    window.dispatchEvent(new CustomEvent('wedding_wishes_updated', { detail: wishes }));
  } catch (err) {
    console.error('Error saving wishes to localStorage:', err);
  }
}

/**
 * Fetches wishes from all public & GitHub sources so that when ANY visitor opens the website,
 * they see all the wishes and messages posted on GitHub.
 */
export async function fetchAllPublicWishes(): Promise<WeddingWish[]> {
  const localWishes = getStoredWishes();
  let fetchedWishes: WeddingWish[] = [];

  // 1. Try server endpoint first if full-stack server is active
  try {
    const res = await fetch('/api/wishes', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.wishes) && data.wishes.length > 0) {
        fetchedWishes = data.wishes;
      }
    }
  } catch {
    // Expected in pure static GitHub Pages
  }

  // 2. If not fetched from API, try static public wedding-wishes.json
  if (fetchedWishes.length === 0) {
    try {
      const staticUrl = `${getAssetPath('wedding-wishes.json')}?t=${Date.now()}`;
      const res = await fetch(staticUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          fetchedWishes = data;
        }
      }
    } catch {
      // Fall through
    }
  }

  // 3. Always check direct GitHub Raw file if owner and repo are known
  // This guarantees that any new commit to GitHub is immediately visible to any visitor
  const ghConfig = getGitHubConfig();
  if (ghConfig.owner && ghConfig.repo) {
    const rawUrls = [
      `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch || 'main'}/public/wedding-wishes.json?t=${Date.now()}`,
      `https://raw.githubusercontent.com/${ghConfig.owner}/${ghConfig.repo}/${ghConfig.branch || 'main'}/wedding-wishes.json?t=${Date.now()}`,
    ];

    for (const rawUrl of rawUrls) {
      try {
        const res = await fetch(rawUrl, { cache: 'no-store' });
        if (res.ok) {
          const rawData = await res.json();
          if (Array.isArray(rawData) && rawData.length > 0) {
            // Found fresh data on GitHub
            fetchedWishes = rawData;
            break;
          }
        }
      } catch {
        // Continue to next URL
      }
    }
  }

  // 4. Merge fetched wishes with local wishes, preserving any newly posted un-synced wishes
  const deletedIds = getDeletedWishIds();
  const combinedMap = new Map<string, WeddingWish>();

  // Add initial fallbacks first
  INITIAL_FALLBACK_WISHES.forEach((w) => {
    if (!deletedIds.has(w.id)) combinedMap.set(w.id, w);
  });

  // Add fetched wishes from GitHub / public JSON
  fetchedWishes.forEach((w) => {
    if (!deletedIds.has(w.id)) combinedMap.set(w.id, w);
  });

  // Add locally posted wishes (to not lose user's immediate post)
  localWishes.forEach((w) => {
    if (!deletedIds.has(w.id)) combinedMap.set(w.id, w);
  });

  // Add messages from all submitted RSVPs
  extractWishesFromRsvps().forEach((w) => {
    if (!deletedIds.has(w.id)) combinedMap.set(w.id, w);
  });

  const merged = Array.from(combinedMap.values()).sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return timeB - timeA;
  });

  saveWishesLocally(merged);
  return merged;
}

/**
 * Pushes the updated wedding-wishes.json directly to the GitHub repository via GitHub REST API
 */
export async function pushWishesToGitHub(
  wishes: WeddingWish[],
  configOverride?: Partial<GitHubSyncConfig>
): Promise<{ success: boolean; message: string; commitUrl?: string }> {
  const rawConfig = { ...getGitHubConfig(), ...(configOverride || {}) };
  const config = sanitizeGitHubConfig(rawConfig);

  if (!config.owner || !config.repo || !config.token) {
    return {
      success: false,
      message: 'GitHub credentials not configured for direct push.',
    };
  }

  const cleanOwner = config.owner;
  const cleanRepo = config.repo;
  const cleanToken = config.token;
  const branch = config.branch || 'main';

  const jsonContent = JSON.stringify(wishes, null, 2);
  const base64Content = toBase64Utf8(jsonContent);

  // We commit to public/wedding-wishes.json so that GitHub Pages serves it
  const targetPaths = ['public/wedding-wishes.json', 'wedding-wishes.json'];
  let lastCommitUrl: string | undefined;

  try {
    for (const filePath of targetPaths) {
      // 1. Get existing file SHA if present
      let sha: string | undefined;
      try {
        const getRes = await fetch(
          `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/contents/${filePath}?ref=${branch}`,
          {
            headers: {
              Authorization: `Bearer ${cleanToken}`,
              Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
            },
          }
        );
        if (getRes.ok) {
          const fileData = await getRes.json();
          sha = fileData.sha;
        }
      } catch {
        // file may be new
      }

      // 2. Put file to GitHub
      const latestAuthor = wishes[0]?.name || 'Guest';
      const commitMessage = sha
        ? `Update wedding wishes on GitHub: New message from ${latestAuthor} (${wishes.length} wishes)`
        : `Initialize wedding wishes JSON: ${wishes.length} messages`;

      const putRes = await fetch(
        `https://api.github.com/repos/${cleanOwner}/${cleanRepo}/contents/${filePath}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cleanToken}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: commitMessage,
            content: base64Content,
            sha,
            branch,
          }),
        }
      );

      if (putRes.ok) {
        const resData = await putRes.json();
        lastCommitUrl = resData.commit?.html_url;
      }
    }

    return {
      success: true,
      message: 'Wishes saved and pushed to GitHub successfully!',
      commitUrl: lastCommitUrl,
    };
  } catch (err: any) {
    console.error('Error committing wishes to GitHub:', err);
    return {
      success: false,
      message: err.message || 'Failed to commit wishes to GitHub',
    };
  }
}

/**
 * Adds a new wish, saves to localStorage, notifies server, and commits to GitHub
 */
export async function addWeddingWish(entry: {
  name: string;
  relationOrCity?: string;
  message: string;
  attending?: 'yes' | 'no';
}): Promise<{ wish: WeddingWish; githubStatus?: string }> {
  const current = getStoredWishes();
  const now = new Date();

  const formattedDate = now.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const newWish: WeddingWish = {
    id: `wish-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: entry.name.trim(),
    relationOrCity: entry.relationOrCity?.trim() || 'Well-wisher',
    message: entry.message.trim(),
    date: formattedDate,
    timestamp: now.toISOString(),
    likes: 1,
    attending: entry.attending || 'yes',
  };

  const updated = [newWish, ...current];
  saveWishesLocally(updated);

  // Send to backend API if available
  try {
    await fetch('/api/wishes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWish),
    }).catch(() => {});
  } catch {
    // Ignore server failure in static deployment
  }

  // Push to GitHub if configured
  const ghConfig = getGitHubConfig();
  let githubStatus: string | undefined;

  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      const res = await pushWishesToGitHub(updated, ghConfig);
      if (res.success) {
        githubStatus = res.commitUrl || 'Committed to GitHub';
      }
    } catch (e: any) {
      console.warn('Could not auto-push wishes to GitHub:', e);
    }
  }

  return { wish: newWish, githubStatus };
}

/**
 * Deletes a wedding wish message (Admin only)
 * Updates local cache, notifies backend /api/wishes/:id, and syncs updated JSON to GitHub.
 */
export async function deleteWeddingWish(id: string): Promise<{
  success: boolean;
  message: string;
  githubStatus?: string;
}> {
  markWishAsDeleted(id);

  // Remove from localStorage
  const current = getStoredWishes().filter((w) => w.id !== id);
  saveWishesLocally(current);

  // If this wish was linked to an RSVP entry in localStorage, clear the message so it doesn't reappear
  try {
    const rawRsvps = localStorage.getItem('wedding_rsvps');
    if (rawRsvps) {
      const rsvps = JSON.parse(rawRsvps);
      if (Array.isArray(rsvps)) {
        let changed = false;
        const cleanedRsvps = rsvps.map((r: any) => {
          const rsvpWishId = `wish-rsvp-${(r.guest_name || 'guest').toLowerCase().replace(/[^a-z0-9]/g, '-')}-${r.submitted_at || r.id}`;
          if (rsvpWishId === id || r.id === id.replace('wish-rsvp-', '')) {
            changed = true;
            return { ...r, message: null };
          }
          return r;
        });
        if (changed) {
          localStorage.setItem('wedding_rsvps', JSON.stringify(cleanedRsvps));
        }
      }
    }
  } catch {}

  // Request backend server to delete and commit
  try {
    await fetch(`/api/wishes/${id}?admin=rsvp`, {
      method: 'DELETE',
      headers: {
        'x-admin-rsvp': 'true',
      },
    }).catch(() => {});
  } catch {}

  // Commit updated wishes to GitHub if configured
  const ghConfig = getGitHubConfig();
  let githubStatus: string | undefined;
  if (ghConfig.enabled && ghConfig.token && ghConfig.owner && ghConfig.repo) {
    try {
      const res = await pushWishesToGitHub(current, ghConfig);
      if (res.success) {
        githubStatus = res.commitUrl || 'Deletion synced to GitHub';
      }
    } catch (e: any) {
      console.warn('Auto-push deletion to GitHub failed:', e);
    }
  }

  window.dispatchEvent(new CustomEvent('wedding_wishes_updated', { detail: current }));

  return {
    success: true,
    message: 'Wish message deleted successfully.',
    githubStatus,
  };
}
