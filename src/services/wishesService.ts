import { getAssetPath } from '../utils/assets';
import { getGitHubConfig, GitHubSyncConfig } from './rsvpExcelService';

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

// Initial fallback wishes in case network is completely offline
const INITIAL_FALLBACK_WISHES: WeddingWish[] = [
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
 * Get locally stored wishes
 */
export function getStoredWishes(): WeddingWish[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WISHES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Error reading wishes from localStorage:', err);
  }
  return INITIAL_FALLBACK_WISHES;
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
  const combinedMap = new Map<string, WeddingWish>();

  // Add initial fallbacks first
  INITIAL_FALLBACK_WISHES.forEach((w) => combinedMap.set(w.id, w));

  // Add fetched wishes from GitHub / public JSON
  fetchedWishes.forEach((w) => combinedMap.set(w.id, w));

  // Add locally posted wishes (to not lose user's immediate post)
  localWishes.forEach((w) => combinedMap.set(w.id, w));

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
  const config = { ...getGitHubConfig(), ...(configOverride || {}) };

  if (!config.owner || !config.repo || !config.token) {
    return {
      success: false,
      message: 'GitHub credentials not configured for direct push.',
    };
  }

  const cleanOwner = config.owner.trim();
  const cleanRepo = config.repo.trim();
  const cleanToken = config.token.trim();
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
              Accept: 'application/vnd.github.v3+json',
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
            Accept: 'application/vnd.github.v3+json',
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
