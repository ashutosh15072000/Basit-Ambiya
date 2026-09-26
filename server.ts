import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(express.json());

const EXCEL_PUBLIC_PATH = path.resolve(__dirname, 'public/wedding-rsvps.xlsx');
const EXCEL_ROOT_PATH = path.resolve(__dirname, 'wedding-rsvps.xlsx');
const DATA_DIR = path.resolve(__dirname, 'data');
const JSON_BACKUP_PATH = path.resolve(DATA_DIR, 'rsvps.json');

const WISHES_PUBLIC_PATH = path.resolve(__dirname, 'public/wedding-wishes.json');
const WISHES_ROOT_PATH = path.resolve(__dirname, 'wedding-wishes.json');
const WISHES_DATA_PATH = path.resolve(DATA_DIR, 'wishes.json');

// Ensure data directories exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(path.resolve(__dirname, 'public'))) {
  fs.mkdirSync(path.resolve(__dirname, 'public'), { recursive: true });
}

interface WeddingWishEntry {
  id: string;
  name: string;
  relationOrCity?: string;
  message: string;
  date: string;
  timestamp?: string;
  likes: number;
  attending?: 'yes' | 'no';
}

function loadWishes(): WeddingWishEntry[] {
  // Check data/wishes.json, public/wedding-wishes.json, or root wedding-wishes.json
  const candidatePaths = [WISHES_DATA_PATH, WISHES_PUBLIC_PATH, WISHES_ROOT_PATH];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {
        // try next
      }
    }
  }
  return [];
}

function saveWishes(wishes: WeddingWishEntry[]): void {
  const json = JSON.stringify(wishes, null, 2);
  fs.writeFileSync(WISHES_DATA_PATH, json, 'utf-8');
  fs.writeFileSync(WISHES_PUBLIC_PATH, json, 'utf-8');
  fs.writeFileSync(WISHES_ROOT_PATH, json, 'utf-8');
}

interface RsvpEntry {
  id: string;
  submitted_at: string;
  guest_name: string;
  phone?: string | null;
  attending: 'yes' | 'no';
  guest_count: number;
  events: string[];
  dietary?: string | null;
  message?: string | null;
}

function loadRsvps(): RsvpEntry[] {
  if (fs.existsSync(JSON_BACKUP_PATH)) {
    try {
      const data = fs.readFileSync(JSON_BACKUP_PATH, 'utf-8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }
  return [];
}

function saveRsvps(entries: RsvpEntry[]): void {
  // 1. Save JSON backup
  fs.writeFileSync(JSON_BACKUP_PATH, JSON.stringify(entries, null, 2), 'utf-8');

  // 2. Build and save Excel workbook
  const rows = entries.map((r, idx) => ({
    'S.No': idx + 1,
    'Submission Date': r.submitted_at,
    'Guest Name': r.guest_name,
    'Contact Phone': r.phone || 'N/A',
    'Attending Status': r.attending === 'yes' ? 'Confirmed (Attending)' : 'Respectfully Declined',
    'Total Guests Attending': r.attending === 'yes' ? r.guest_count : 0,
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
          'Submission Date': new Date().toISOString(),
          'Guest Name': 'Template Initialized',
          'Contact Phone': '—',
          'Attending Status': 'Awaiting Responses',
          'Total Guests Attending': 0,
          'Ceremonies Selected': '—',
          'Dietary Preferences': '—',
          'Heartfelt Duas & Message': 'Wedding RSVP Registry for Basit Ali & Ambiya Basher',
        },
      ]);

  ws['!cols'] = [
    { wch: 8 },
    { wch: 22 },
    { wch: 28 },
    { wch: 18 },
    { wch: 24 },
    { wch: 24 },
    { wch: 45 },
    { wch: 22 },
    { wch: 55 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, 'RSVP Responses');

  const totalGuests = entries.reduce((acc, cur) => acc + (cur.attending === 'yes' ? cur.guest_count : 0), 0);
  const attendingCount = entries.filter((e) => e.attending === 'yes').length;
  const summaryWs = XLSX.utils.json_to_sheet([
    { Metric: 'Couple', Value: 'Basit Ali & Ambiya Basher' },
    { Metric: 'Wedding Date', Value: 'Thursday, 29th October 2026' },
    { Metric: 'Total RSVP Responses', Value: entries.length },
    { Metric: 'Confirmed Attending Responses', Value: attendingCount },
    { Metric: 'Total Guests (Heads)', Value: totalGuests },
    { Metric: 'Last Updated', Value: new Date().toISOString() },
  ]);
  summaryWs['!cols'] = [{ wch: 32 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary & Statistics');

  const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync(EXCEL_PUBLIC_PATH, buffer);
  fs.writeFileSync(EXCEL_ROOT_PATH, buffer);
}

// REST API Endpoints
app.get('/api/rsvp', (req: Request, res: Response) => {
  const isAdmin =
    req.query.admin === 'rsvp' ||
    req.query.host === 'rsvp' ||
    req.headers['x-admin-rsvp'] === 'true';

  if (!isAdmin) {
    return res.status(403).json({
      success: false,
      error: 'RSVP guest details are private. Access via ?admin=rsvp',
    });
  }

  const rsvps = loadRsvps();
  res.json({ success: true, count: rsvps.length, rsvps });
});

app.post('/api/rsvp', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || !body.guest_name) {
      return res.status(400).json({ success: false, error: 'guest_name is required' });
    }

    const current = loadRsvps();
    const newEntry: RsvpEntry = {
      id: body.id || `rsvp-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      submitted_at: body.submitted_at || new Date().toISOString(),
      guest_name: String(body.guest_name).trim(),
      phone: body.phone ? String(body.phone).trim() : null,
      attending: body.attending === 'no' ? 'no' : 'yes',
      guest_count: Number(body.guest_count) || (body.attending === 'no' ? 0 : 1),
      events: Array.isArray(body.events) ? body.events : [],
      dietary: body.dietary ? String(body.dietary).trim() : null,
      message: body.message ? String(body.message).trim() : null,
    };

    current.push(newEntry);
    saveRsvps(current);

    // If RSVP contains a heartfelt message/dua, automatically save it to wishes JSON as well
    if (newEntry.message && newEntry.message.trim().length > 0) {
      const currentWishes = loadWishes();
      const wishId = `wish-rsvp-${newEntry.id}`;
      if (!currentWishes.some((w) => w.id === wishId)) {
        currentWishes.unshift({
          id: wishId,
          name: newEntry.guest_name,
          relationOrCity: newEntry.events && newEntry.events.length > 0 ? 'Attending Guest' : 'Wedding Guest',
          message: newEntry.message.trim(),
          date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
          timestamp: newEntry.submitted_at,
          likes: 1,
          attending: newEntry.attending,
        });
        saveWishes(currentWishes);
      }
    }

    // Optional: Auto-commit to GitHub if environment variables are set
    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo = process.env.GITHUB_REPO;
    const ghBranch = process.env.GITHUB_BRANCH || 'main';

    let githubStatus: string | null = null;
    if (ghToken && ghOwner && ghRepo) {
      try {
        const filePath = 'wedding-rsvps.xlsx';
        const buffer = fs.readFileSync(EXCEL_ROOT_PATH);
        const base64 = buffer.toString('base64');

        // Check existing file SHA
        let sha: string | undefined = undefined;
        try {
          const getRes = await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
            {
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (getRes.ok) {
            const data = (await getRes.json()) as any;
            sha = data.sha;
          }
        } catch {
          // New file
        }

        const putRes = await fetch(
          `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Update wedding RSVP Excel registry: ${newEntry.guest_name}`,
              content: base64,
              sha,
              branch: ghBranch,
            }),
          }
        );

        if (putRes.ok) {
          githubStatus = 'Synced to GitHub repository';
        }
      } catch (ghErr) {
        console.warn('Server GitHub commit error:', ghErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'RSVP recorded and Excel sheet updated',
      record: newEntry,
      githubStatus,
    });
  } catch (err: any) {
    console.error('API /api/rsvp error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

app.get('/api/rsvp/download', (req: Request, res: Response) => {
  const isAdmin =
    req.query.admin === 'rsvp' ||
    req.query.host === 'rsvp' ||
    req.headers['x-admin-rsvp'] === 'true';

  if (!isAdmin) {
    return res.status(403).send('Access restricted: RSVP details require ?admin=rsvp');
  }

  if (fs.existsSync(EXCEL_PUBLIC_PATH)) {
    return res.download(EXCEL_PUBLIC_PATH, 'Basit-Ambiya-Wedding-RSVPs.xlsx');
  } else if (fs.existsSync(EXCEL_ROOT_PATH)) {
    return res.download(EXCEL_ROOT_PATH, 'Basit-Ambiya-Wedding-RSVPs.xlsx');
  }
  return res.status(404).send('Excel file not generated yet');
});

// Bulk RSVP update (used when importing or uploading Excel spreadsheet)
app.post('/api/rsvp/bulk', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || !Array.isArray(body.rsvps)) {
      return res.status(400).json({ success: false, error: 'rsvps array is required' });
    }

    const current = loadRsvps();
    const newItems: RsvpEntry[] = body.rsvps.map((item: any, idx: number) => ({
      id: item.id || `rsvp-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
      submitted_at: item.submitted_at || new Date().toISOString(),
      guest_name: String(item.guest_name).trim(),
      phone: item.phone ? String(item.phone).trim() : null,
      attending: item.attending === 'no' ? 'no' : 'yes',
      guest_count: Number(item.guest_count) || (item.attending === 'no' ? 0 : 1),
      events: Array.isArray(item.events) ? item.events : [],
      dietary: item.dietary ? String(item.dietary).trim() : null,
      message: item.message ? String(item.message).trim() : null,
    }));

    // Merge without duplicates
    const merged: RsvpEntry[] = [...current];
    for (const item of newItems) {
      const existingIdx = merged.findIndex(
        (m) => m.guest_name.toLowerCase() === item.guest_name.toLowerCase() &&
               (m.phone === item.phone || (!m.phone && !item.phone))
      );
      if (existingIdx >= 0) {
        merged[existingIdx] = { ...merged[existingIdx], ...item, id: merged[existingIdx].id };
      } else {
        merged.push(item);
      }
    }

    saveRsvps(merged);

    // Also update wishes with any messages in the imported list
    const currentWishes = loadWishes();
    let wishesUpdated = false;
    for (const item of merged) {
      if (item.message && item.message.trim().length > 0) {
        const wishId = `wish-rsvp-${item.id}`;
        if (!currentWishes.some((w) => w.id === wishId)) {
          currentWishes.unshift({
            id: wishId,
            name: item.guest_name,
            relationOrCity: item.events && item.events.length > 0 ? 'Attending Guest' : 'Wedding Guest',
            message: item.message.trim(),
            date: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
            timestamp: item.submitted_at,
            likes: 1,
            attending: item.attending,
          });
          wishesUpdated = true;
        }
      }
    }
    if (wishesUpdated) {
      saveWishes(currentWishes);
    }

    // Auto-commit to GitHub if env vars are present
    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo = process.env.GITHUB_REPO;
    const ghBranch = process.env.GITHUB_BRANCH || 'main';

    let githubStatus: string | null = null;
    if (ghToken && ghOwner && ghRepo) {
      try {
        const filePath = 'wedding-rsvps.xlsx';
        const buffer = fs.readFileSync(EXCEL_ROOT_PATH);
        const base64 = buffer.toString('base64');

        let sha: string | undefined = undefined;
        try {
          const getRes = await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
            {
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (getRes.ok) {
            const data = (await getRes.json()) as any;
            sha = data.sha;
          }
        } catch {}

        await fetch(
          `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Bulk import/update RSVP Excel registry (${merged.length} total entries)`,
              content: base64,
              sha,
              branch: ghBranch,
            }),
          }
        );
        githubStatus = 'Synced Excel workbook to GitHub repository';
      } catch (e) {
        console.warn('Bulk sync to GitHub failed:', e);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Registry updated with ${merged.length} total records`,
      total: merged.length,
      githubStatus,
    });
  } catch (err: any) {
    console.error('API /api/rsvp/bulk error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Wishes API Endpoints
app.get('/api/wishes', (_req: Request, res: Response) => {
  const wishes = loadWishes();
  res.json({ success: true, count: wishes.length, wishes });
});

app.post('/api/wishes', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    if (!body || !body.name || !body.message) {
      return res.status(400).json({ success: false, error: 'name and message are required' });
    }

    const currentWishes = loadWishes();
    const newWish: WeddingWishEntry = {
      id: body.id || `wish-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: String(body.name).trim(),
      relationOrCity: body.relationOrCity ? String(body.relationOrCity).trim() : 'Well-wisher',
      message: String(body.message).trim(),
      date: body.date || new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
      timestamp: body.timestamp || new Date().toISOString(),
      likes: Number(body.likes) || 1,
      attending: body.attending === 'no' ? 'no' : 'yes',
    };

    // Prepend new wish
    const updatedWishes = [newWish, ...currentWishes.filter((w) => w.id !== newWish.id)];
    saveWishes(updatedWishes);

    // Auto-commit wishes to GitHub if GitHub env vars are set
    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo = process.env.GITHUB_REPO;
    const ghBranch = process.env.GITHUB_BRANCH || 'main';

    let githubStatus: string | null = null;
    if (ghToken && ghOwner && ghRepo) {
      try {
        const jsonContent = JSON.stringify(updatedWishes, null, 2);
        const base64 = Buffer.from(jsonContent, 'utf-8').toString('base64');
        const targetPaths = ['public/wedding-wishes.json', 'wedding-wishes.json'];

        for (const filePath of targetPaths) {
          let sha: string | undefined = undefined;
          try {
            const getRes = await fetch(
              `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
              {
                headers: {
                  Authorization: `Bearer ${ghToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            );
            if (getRes.ok) {
              const fileData = (await getRes.json()) as any;
              sha = fileData.sha;
            }
          } catch {
            // New file
          }

          await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Update wedding wishes on GitHub: New message from ${newWish.name}`,
                content: base64,
                sha,
                branch: ghBranch,
              }),
            }
          );
        }
        githubStatus = 'Synced wishes to GitHub repository';
      } catch (ghErr) {
        console.warn('Server wishes GitHub commit error:', ghErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Wish recorded successfully and saved to JSON',
      wish: newWish,
      githubStatus,
    });
  } catch (err: any) {
    console.error('API /api/wishes error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Admin Delete RSVP Endpoint
app.delete('/api/rsvp/:id', async (req: Request, res: Response) => {
  const isAdmin =
    req.query.admin === 'rsvp' ||
    req.query.host === 'rsvp' ||
    req.headers['x-admin-rsvp'] === 'true';

  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required (?admin=rsvp)' });
  }

  try {
    const { id } = req.params;
    const current = loadRsvps();
    const existingIndex = current.findIndex((r) => r.id === id);

    if (existingIndex === -1) {
      return res.status(404).json({ success: false, error: 'RSVP record not found' });
    }

    const deletedEntry = current[existingIndex];
    const updatedRsvps = current.filter((r) => r.id !== id);
    saveRsvps(updatedRsvps);

    // Also remove any corresponding wish from this RSVP
    const currentWishes = loadWishes();
    const wishId = `wish-rsvp-${id}`;
    const updatedWishes = currentWishes.filter(
      (w) =>
        w.id !== wishId &&
        !(w.name.toLowerCase() === deletedEntry.guest_name.toLowerCase() && w.message === deletedEntry.message)
    );
    if (updatedWishes.length !== currentWishes.length) {
      saveWishes(updatedWishes);
    }

    // Auto-commit to GitHub if env vars are present
    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo = process.env.GITHUB_REPO;
    const ghBranch = process.env.GITHUB_BRANCH || 'main';

    let githubStatus: string | null = null;
    if (ghToken && ghOwner && ghRepo) {
      try {
        const filePath = 'wedding-rsvps.xlsx';
        const buffer = fs.readFileSync(EXCEL_ROOT_PATH);
        const base64 = buffer.toString('base64');

        let sha: string | undefined = undefined;
        try {
          const getRes = await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
            {
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json',
              },
            }
          );
          if (getRes.ok) {
            const data = (await getRes.json()) as any;
            sha = data.sha;
          }
        } catch {}

        const putRes = await fetch(
          `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}`,
          {
            method: 'PUT',
            headers: {
              Authorization: `Bearer ${ghToken}`,
              Accept: 'application/vnd.github.v3+json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: `Admin delete RSVP: ${deletedEntry.guest_name}`,
              content: base64,
              sha,
              branch: ghBranch,
            }),
          }
        );

        if (putRes.ok) {
          githubStatus = 'Updated Excel on GitHub';
        }
      } catch (ghErr) {
        console.warn('Server GitHub delete error:', ghErr);
      }
    }

    return res.json({
      success: true,
      message: `RSVP record for ${deletedEntry.guest_name} deleted successfully`,
      githubStatus,
    });
  } catch (err: any) {
    console.error('API DELETE /api/rsvp error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

// Admin Delete Wish Endpoint
app.delete('/api/wishes/:id', async (req: Request, res: Response) => {
  const isAdmin =
    req.query.admin === 'rsvp' ||
    req.query.host === 'rsvp' ||
    req.headers['x-admin-rsvp'] === 'true';

  if (!isAdmin) {
    return res.status(403).json({ success: false, error: 'Unauthorized: Admin access required (?admin=rsvp)' });
  }

  try {
    const { id } = req.params;
    const currentWishes = loadWishes();
    const existing = currentWishes.find((w) => w.id === id);

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Wish message not found' });
    }

    const updatedWishes = currentWishes.filter((w) => w.id !== id);
    saveWishes(updatedWishes);

    // If this wish was linked to an RSVP response, clear that RSVP's message
    const currentRsvps = loadRsvps();
    let rsvpsModified = false;
    for (const r of currentRsvps) {
      if (
        r.id === id.replace('wish-rsvp-', '') ||
        (r.guest_name.toLowerCase() === existing.name.toLowerCase() && r.message === existing.message)
      ) {
        r.message = null;
        rsvpsModified = true;
      }
    }
    if (rsvpsModified) {
      saveRsvps(currentRsvps);
    }

    // Push updated wishes to GitHub if configured
    const ghToken = process.env.GITHUB_TOKEN;
    const ghOwner = process.env.GITHUB_OWNER;
    const ghRepo = process.env.GITHUB_REPO;
    const ghBranch = process.env.GITHUB_BRANCH || 'main';

    let githubStatus: string | null = null;
    if (ghToken && ghOwner && ghRepo) {
      try {
        const jsonContent = JSON.stringify(updatedWishes, null, 2);
        const base64 = Buffer.from(jsonContent, 'utf-8').toString('base64');
        const targetPaths = ['public/wedding-wishes.json', 'wedding-wishes.json'];

        for (const filePath of targetPaths) {
          let sha: string | undefined = undefined;
          try {
            const getRes = await fetch(
              `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}?ref=${ghBranch}`,
              {
                headers: {
                  Authorization: `Bearer ${ghToken}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            );
            if (getRes.ok) {
              const fileData = (await getRes.json()) as any;
              sha = fileData.sha;
            }
          } catch {}

          await fetch(
            `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${filePath}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${ghToken}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `Delete wedding wish: Message by ${existing.name}`,
                content: base64,
                sha,
                branch: ghBranch,
              }),
            }
          );
        }
        githubStatus = 'Updated wishes on GitHub';
      } catch (ghErr) {
        console.warn('Server wishes GitHub delete error:', ghErr);
      }
    }

    return res.json({
      success: true,
      message: `Message by ${existing.name} deleted successfully`,
      githubStatus,
    });
  } catch (err: any) {
    console.error('API DELETE /api/wishes error:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
});

import { parseInvitedFunctionIds, getFunctionCardImage } from './src/utils/invitationConfig.js';

function injectDynamicOpenGraphTags(html: string, req: Request): string {
  try {
    const host = req.get('x-forwarded-host') || req.get('host') || `localhost:${PORT}`;
    const proto = req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
    const functionIds = parseInvitedFunctionIds(req.originalUrl);
    const cardInfo = getFunctionCardImage(functionIds);

    const fullImageUrl = `${proto}://${host}${cardInfo.path}`;
    const fullPageUrl = `${proto}://${host}${req.originalUrl}`;

    let title = 'Basit Ali and Ambiya Basher — Wedding Invitation';
    let desc = 'Sacred Rukhsati & Muslim Wedding Celebration - October 2026';

    if (functionIds.length === 1) {
      if (functionIds[0] === 1) {
        title = 'Basit Ali & Ambiya Basher — Rukhsati Invitation (29 Oct)';
        desc = 'You are cordially invited to the sacred Rukhsati ceremony on Thursday, 29th October 2026 at Shimla Resort.';
      } else if (functionIds[0] === 2) {
        title = 'Basit Ali & Ambiya Basher — Wedding Reception (30 Oct)';
        desc = 'You are cordially invited to the grand Wedding Reception on Friday, 30th October 2026 at Hotel Ramada.';
      } else if (functionIds[0] === 3) {
        title = 'Basit Ali & Ambiya Basher — Wedding Reception (2 Nov)';
        desc = 'You are cordially invited to the grand Wedding Reception on Monday, 2nd November 2026 at Radiant Resorts Gorakhpur.';
      }
    } else if (functionIds.length === 2) {
      if (functionIds.includes(1) && functionIds.includes(2)) {
        title = 'Basit Ali & Ambiya Basher — Rukhsati & Hotel Ramada Reception';
        desc = 'You are cordially invited to the Rukhsati (29 Oct) & Wedding Reception (30 Oct).';
      } else if (functionIds.includes(2) && functionIds.includes(3)) {
        title = 'Basit Ali & Ambiya Basher — Wedding Receptions (Ramada & Radiant)';
        desc = 'You are cordially invited to the Wedding Receptions on 30th Oct & 2nd Nov 2026.';
      } else {
        title = 'Basit Ali & Ambiya Basher — Rukhsati & Radiant Resorts Reception';
        desc = 'You are cordially invited to the Rukhsati (29 Oct) & Wedding Reception (2 Nov).';
      }
    }

    let modified = html;
    modified = modified.replace(/<title>.*?<\/title>/i, `<title>${title}</title>`);
    modified = modified.replace(
      /<meta property="og:title" content=".*?" \/>/i,
      `<meta property="og:title" content="${title}" />`
    );
    modified = modified.replace(
      /<meta property="og:description" content=".*?" \/>/i,
      `<meta property="og:description" content="${desc}" />`
    );
    modified = modified.replace(
      /<meta property="og:image" content=".*?" \/>/i,
      `<meta property="og:image" content="${fullImageUrl}" />\n    <meta property="og:image:secure_url" content="${fullImageUrl}" />\n    <meta property="og:image:type" content="image/png" />\n    <meta property="og:image:width" content="1200" />\n    <meta property="og:image:height" content="1800" />\n    <meta property="og:url" content="${fullPageUrl}" />`
    );
    modified = modified.replace(
      /<meta name="twitter:title" content=".*?" \/>/i,
      `<meta name="twitter:title" content="${title}" />`
    );
    modified = modified.replace(
      /<meta name="twitter:description" content=".*?" \/>/i,
      `<meta name="twitter:description" content="${desc}" />`
    );
    modified = modified.replace(
      /<meta name="twitter:image" content=".*?" \/>/i,
      `<meta name="twitter:image" content="${fullImageUrl}" />`
    );

    return modified;
  } catch (err) {
    console.warn('Error injecting OpenGraph tags:', err);
    return html;
  }
}

async function startServer() {
  if (!IS_PROD) {
    // In development, mount Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    // Intercept HTML requests in dev to inject dynamic OpenGraph tags with function images
    app.use(async (req, res, next) => {
      const url = req.originalUrl;
      const accept = req.headers.accept || '';
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.includes('.') &&
        (accept.includes('text/html') || req.path === '/')
      ) {
        try {
          const raw = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
          const viteTransformed = await vite.transformIndexHtml(url, raw);
          const finalHtml = injectDynamicOpenGraphTags(viteTransformed, req);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(finalHtml);
        } catch (e) {
          next(e);
        }
      } else {
        next();
      }
    });

    app.use(vite.middlewares);
  } else {
    // In production, serve dist folder
    const distPath = path.resolve(__dirname, 'dist');
    const indexHtmlPath = path.resolve(distPath, 'index.html');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (req: Request, res: Response) => {
      try {
        if (fs.existsSync(indexHtmlPath)) {
          const raw = fs.readFileSync(indexHtmlPath, 'utf-8');
          const finalHtml = injectDynamicOpenGraphTags(raw, req);
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          return res.send(finalHtml);
        }
      } catch (err) {
        console.warn('Error reading index.html:', err);
      }
      res.sendFile(indexHtmlPath);
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Wedding server running at http://localhost:${PORT} (${IS_PROD ? 'prod' : 'dev'})`);
  });
}

startServer();
