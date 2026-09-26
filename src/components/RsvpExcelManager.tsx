import React, { useState, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Upload,
  Github,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users,
  CalendarCheck,
  RefreshCw,
  ExternalLink,
  Settings,
  Sparkles,
  Trash2,
  MessageSquareHeart,
  Search,
  Link2,
  Share2,
  Copy,
  Check,
  UserCheck,
  Plus,
  Image as ImageIcon,
  QrCode,
} from 'lucide-react';
import {
  RsvpRecord,
  getStoredRsvps,
  downloadExcelFile,
  pushExcelToGitHub,
  importExcelFile,
  deleteRsvpEntry,
  getGitHubConfig,
  saveGitHubConfig,
  GitHubSyncConfig,
} from '../services/rsvpExcelService';
import {
  WeddingWish,
  getStoredWishes,
  deleteWeddingWish,
  pushWishesToGitHub,
} from '../services/wishesService';
import {
  ALL_FUNCTIONS,
  ALL_CARD_OPTIONS,
  CardImageOption,
  buildInviteUrl,
  buildWhatsAppMessage,
  getInvitedFunctionsDescription,
  getFunctionCardImage,
} from '../utils/invitationConfig';
import { getAssetPath } from '../utils/assets';
import {
  GuestCheckInPass,
  generatePassId,
  CheckInPassData,
} from './GuestCheckInPass';

export interface SavedGuestInvite {
  id: string;
  guestName: string;
  functionIds: number[];
  url: string;
  createdAt: string;
}

interface RsvpExcelManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RsvpExcelManager: React.FC<RsvpExcelManagerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rsvps' | 'wishes' | 'invites'>('rsvps');
  const [rsvps, setRsvps] = useState<RsvpRecord[]>([]);
  const [wishes, setWishes] = useState<WeddingWish[]>([]);
  const [wishSearch, setWishSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [ghConfig, setGhConfig] = useState<GitHubSyncConfig>(getGitHubConfig());
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [syncFeedback, setSyncFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
    commitUrl?: string;
  }>({ type: null, message: '' });

  // Guest Invite Link Generator State
  const [inviteGuestName, setInviteGuestName] = useState('');
  const [inviteSelectedFunctions, setInviteSelectedFunctions] = useState<number[]>([1, 2]);
  const [copiedInviteUrl, setCopiedInviteUrl] = useState<string | null>(null);
  const [savedInvites, setSavedInvites] = useState<SavedGuestInvite[]>(() => {
    try {
      const raw = localStorage.getItem('wedding_saved_guest_invites');
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  });
  const [inviteSearch, setInviteSearch] = useState('');
  const [selectedCardImageId, setSelectedCardImageId] = useState<string>('auto');
  const [viewPassGuest, setViewPassGuest] = useState<CheckInPassData | null>(null);

  const resolveActiveCard = (
    functionIds: number[],
    chosenCardId: string
  ): { path: string; filename: string; title: string; subtitle: string } => {
    if (chosenCardId !== 'auto') {
      const found = ALL_CARD_OPTIONS.find((c) => c.id === chosenCardId);
      if (found) {
        return {
          path: found.path,
          filename: found.filename,
          title: found.title,
          subtitle: found.subtitle,
        };
      }
    }
    const autoCard = getFunctionCardImage(functionIds);
    return {
      path: autoCard.path,
      filename: autoCard.filename,
      title: autoCard.title,
      subtitle: 'Auto-matched to invited ceremonies',
    };
  };

  const currentInviteUrl = buildInviteUrl(
    typeof window !== 'undefined' ? window.location.href : '',
    inviteGuestName,
    inviteSelectedFunctions
  );

  const toggleInviteFunction = (id: number) => {
    setInviteSelectedFunctions((prev) => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id].sort((a, b) => a - b);
      }
    });
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteUrl(url);
      setTimeout(() => setCopiedInviteUrl(null), 2500);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleWhatsAppShare = async (
    name: string,
    functionIds: number[],
    url: string,
    customCard?: { path: string; filename: string; title: string }
  ) => {
    const cardInfo = customCard || resolveActiveCard(functionIds, selectedCardImageId);
    const assetUrl = getAssetPath(cardInfo.path);
    const text = buildWhatsAppMessage(name, functionIds, url);

    // 1. Try native Web Share API with image file attached (Android/iOS, Safari, supporting desktop)
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const response = await fetch(assetUrl);
        if (response.ok) {
          const blob = await response.blob();
          const file = new File([blob], cardInfo.filename, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: `Wedding Invitation - Basit & Ambiya (${cardInfo.title})`,
              text: text,
              files: [file],
            });
            return;
          }
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return;
        console.warn('Native share with image file attachment skipped/fallback:', err);
      }
    }

    // 2. Try copying ceremony card image directly to clipboard for instant Ctrl+V into WhatsApp Web
    try {
      const response = await fetch(assetUrl);
      if (response.ok) {
        const blob = await response.blob();
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': blob }),
        ]);
        setSyncFeedback({
          type: 'success',
          message: `"${cardInfo.title}" photo copied! Press Ctrl+V (or Paste) in WhatsApp to attach the photo.`,
        });
      }
    } catch {
      // clipboard image writing not supported everywhere, continue
    }

    // 3. Open WhatsApp link with pre-filled invitation text & location map links
    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleDownloadCardImage = async (
    functionIds: number[],
    customCard?: { path: string; filename: string; title: string }
  ) => {
    const cardInfo = customCard || resolveActiveCard(functionIds, selectedCardImageId);
    const assetUrl = getAssetPath(cardInfo.path);

    try {
      const response = await fetch(assetUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = cardInfo.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 2000);

      setSyncFeedback({
        type: 'success',
        message: `Card image "${cardInfo.filename}" downloaded! You can attach it directly into your WhatsApp chat.`,
      });
    } catch (err) {
      console.warn('Blob download error, falling back to direct open:', err);
      const link = document.createElement('a');
      link.href = assetUrl;
      link.download = cardInfo.filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleSaveInvite = () => {
    const newEntry: SavedGuestInvite = {
      id: `inv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      guestName: inviteGuestName.trim() || 'General Invitation',
      functionIds: inviteSelectedFunctions,
      url: currentInviteUrl,
      createdAt: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
    };

    const updated = [newEntry, ...savedInvites.filter((i) => i.guestName !== newEntry.guestName)];
    setSavedInvites(updated);
    try {
      localStorage.setItem('wedding_saved_guest_invites', JSON.stringify(updated));
    } catch {}

    setSyncFeedback({
      type: 'success',
      message: `Personal invitation for "${newEntry.guestName}" saved to list!`,
    });
  };

  const handleDeleteSavedInvite = (id: string) => {
    const updated = savedInvites.filter((i) => i.id !== id);
    setSavedInvites(updated);
    try {
      localStorage.setItem('wedding_saved_guest_invites', JSON.stringify(updated));
    } catch {}
  };

  const loadData = () => {
    setRsvps(getStoredRsvps());
    setWishes(getStoredWishes());
    setGhConfig(getGitHubConfig());
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('wedding_rsvp_updated', handleUpdate);
    window.addEventListener('wedding_wishes_updated', handleUpdate);
    return () => {
      window.removeEventListener('wedding_rsvp_updated', handleUpdate);
      window.removeEventListener('wedding_wishes_updated', handleUpdate);
    };
  }, []);

  if (!isOpen) return null;

  const totalGuests = rsvps.reduce(
    (sum, r) => sum + (r.attending === 'yes' ? r.guest_count : 0),
    0
  );
  const attendingCount = rsvps.filter((r) => r.attending === 'yes').length;
  const declinedCount = rsvps.filter((r) => r.attending === 'no').length;

  const handleDownload = () => {
    downloadExcelFile(rsvps);
  };

  const handleDeleteRsvp = async (id: string, name: string) => {
    if (
      !window.confirm(
        `Admin Action:\nAre you sure you want to delete the RSVP response for "${name}"?\nThis will remove their entry from the Excel sheet and update GitHub.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    setSyncFeedback({ type: null, message: '' });

    try {
      const res = await deleteRsvpEntry(id);
      loadData();
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
        commitUrl: res.githubSyncResult?.commitUrl,
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Error deleting RSVP response',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteWish = async (id: string, author: string) => {
    if (
      !window.confirm(
        `Admin Action:\nAre you sure you want to delete the wish message from "${author}"?\nIt will be permanently removed from public display and GitHub.`
      )
    ) {
      return;
    }

    setDeletingId(id);
    setSyncFeedback({ type: null, message: '' });

    try {
      const res = await deleteWeddingWish(id);
      loadData();
      setSyncFeedback({
        type: res.success ? 'success' : 'error',
        message: res.message,
        commitUrl: res.githubStatus?.startsWith('http') ? res.githubStatus : undefined,
      });
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Error deleting wish message',
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredWishes = wishes.filter((w) => {
    if (!wishSearch.trim()) return true;
    const q = wishSearch.toLowerCase();
    return (
      w.name.toLowerCase().includes(q) ||
      (w.relationOrCity && w.relationOrCity.toLowerCase().includes(q)) ||
      w.message.toLowerCase().includes(q)
    );
  });

  const processUploadedFile = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    setSyncFeedback({ type: null, message: '' });

    try {
      const res = await importExcelFile(file);
      if (res.success) {
        setSyncFeedback({
          type: 'success',
          message: res.message,
          commitUrl: res.githubSyncResult?.commitUrl,
        });
        loadData();
      } else {
        setSyncFeedback({
          type: 'error',
          message: res.message,
        });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Error uploading Excel file',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedFile(file);
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    saveGitHubConfig(ghConfig);
    setShowSettings(false);
    setSyncFeedback({
      type: 'success',
      message: 'GitHub settings saved successfully!',
    });
  };

  const handleSyncToGitHub = async () => {
    if (!ghConfig.owner || !ghConfig.repo || !ghConfig.token) {
      setShowSettings(true);
      setSyncFeedback({
        type: 'error',
        message: 'Please provide your GitHub Repository details and Personal Access Token first.',
      });
      return;
    }

    setIsSyncing(true);
    setSyncFeedback({ type: null, message: '' });

    const result = await pushExcelToGitHub(rsvps, ghConfig);
    const wishesResult = await pushWishesToGitHub(getStoredWishes(), ghConfig).catch(() => ({
      success: false,
      message: '',
      commitUrl: undefined as string | undefined,
    }));
    setIsSyncing(false);

    if (result.success || wishesResult.success) {
      setSyncFeedback({
        type: 'success',
        message: result.success ? `${result.message} & Wishes JSON synced!` : wishesResult.message,
        commitUrl: result.commitUrl || wishesResult.commitUrl,
      });
      setGhConfig(getGitHubConfig());
    } else {
      setSyncFeedback({
        type: 'error',
        message: result.message,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-[#faf8f5] border-2 border-[#e4c88a] rounded-2xl shadow-2xl overflow-hidden my-8 max-h-[90vh] flex flex-col text-left">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#163828] via-[#1d4d37] to-[#163828] text-white p-5 sm:p-6 flex items-center justify-between border-b border-[#e4c88a]/40 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-white/10 border border-[#e4c88a]/30 text-[#fcf6ba]">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-cinzel text-lg sm:text-xl font-bold tracking-wide text-[#fcf6ba]">
                RSVP Excel Registry &amp; GitHub Sync
              </h3>
              <p className="font-serif-display text-xs sm:text-sm text-white/80 italic">
                Basit Ali &amp; Ambiya Basher Wedding Guest Roster
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-[#fcf6ba] transition-colors"
              title="GitHub Settings"
              aria-label="GitHub Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-gold-soft/40 bg-[#f4ede2] px-6 pt-3 shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('rsvps')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-cinzel text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all cursor-pointer border-t-2 border-x-2 ${
              activeTab === 'rsvps'
                ? 'bg-[#faf8f5] text-[#1b4332] border-[#e4c88a] shadow-xs'
                : 'bg-transparent text-foreground/60 border-transparent hover:text-foreground hover:bg-black/5'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-[#1b4332]" />
            <span>RSVP Responses &amp; Excel</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#1b4332]/10 text-[#1b4332] font-mono">
              {rsvps.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('wishes')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-cinzel text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all cursor-pointer border-t-2 border-x-2 ${
              activeTab === 'wishes'
                ? 'bg-[#faf8f5] text-[#93203c] border-[#e4c88a] shadow-xs'
                : 'bg-transparent text-foreground/60 border-transparent hover:text-foreground hover:bg-black/5'
            }`}
          >
            <MessageSquareHeart className="w-4 h-4 text-[#93203c]" />
            <span>Guest Wishes &amp; Duas</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-[#93203c]/10 text-[#93203c] font-mono">
              {wishes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('invites')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 font-cinzel text-xs font-bold uppercase tracking-wider rounded-t-xl transition-all cursor-pointer border-t-2 border-x-2 ${
              activeTab === 'invites'
                ? 'bg-[#faf8f5] text-[#b45309] border-[#e4c88a] shadow-xs'
                : 'bg-transparent text-foreground/60 border-transparent hover:text-foreground hover:bg-black/5'
            }`}
          >
            <Link2 className="w-4 h-4 text-[#b45309]" />
            <span>Guest Invite Links</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 font-mono font-bold">
              {savedInvites.length > 0 ? savedInvites.length : 'New'}
            </span>
          </button>
        </div>

        {/* Content body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'rsvps' ? (
            <>
          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <div className="bg-white p-4 rounded-xl border border-gold-soft/50 shadow-xs">
              <span className="text-xs font-cinzel text-foreground/60 uppercase block">Total RSVPs</span>
              <span className="text-2xl sm:text-3xl font-bold font-serif-display text-rose-deep">
                {rsvps.length}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gold-soft/50 shadow-xs">
              <span className="text-xs font-cinzel text-foreground/60 uppercase block">Confirmed</span>
              <span className="text-2xl sm:text-3xl font-bold font-serif-display text-emerald-800">
                {attendingCount}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gold-soft/50 shadow-xs">
              <span className="text-xs font-cinzel text-foreground/60 uppercase block">Total Heads</span>
              <span className="text-2xl sm:text-3xl font-bold font-serif-display text-amber-700">
                {totalGuests}
              </span>
            </div>
            <div className="bg-white p-4 rounded-xl border border-gold-soft/50 shadow-xs">
              <span className="text-xs font-cinzel text-foreground/60 uppercase block">Declined</span>
              <span className="text-2xl sm:text-3xl font-bold font-serif-display text-foreground/50">
                {declinedCount}
              </span>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-[#f3ede2] rounded-xl border border-gold-soft/60">
            <div className="flex flex-wrap items-center gap-3">
              {/* Hidden File Input for Excel Upload */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileChange}
                className="hidden"
                aria-label="Upload Excel File"
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-700 to-amber-900 text-white font-cinzel text-xs uppercase font-bold tracking-wider hover:brightness-110 shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gold-soft" />
                ) : (
                  <Upload className="w-4 h-4 text-gold-soft" />
                )}
                {isUploading ? 'Importing Excel...' : 'Upload Excel (.xlsx)'}
              </button>

              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white font-cinzel text-xs uppercase font-bold tracking-wider hover:brightness-110 shadow-md transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 text-gold-soft" />
                Download Excel (.xlsx)
              </button>

              <button
                type="button"
                onClick={handleSyncToGitHub}
                disabled={isSyncing}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#24292f] hover:bg-[#1b1f23] text-white font-cinzel text-xs uppercase font-bold tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-gold-soft" />
                ) : (
                  <Github className="w-4 h-4 text-gold-soft" />
                )}
                {isSyncing ? 'Pushing to GitHub...' : 'Sync Excel to GitHub'}
              </button>
            </div>

            <div className="text-xs text-foreground/70 font-cinzel flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Excel updates in real-time as guests submit
            </div>
          </div>

          {/* Drag and Drop Excel Upload Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer ${
              isDraggingFile
                ? 'border-emerald-600 bg-emerald-50/80 scale-[1.01]'
                : 'border-gold-soft/70 hover:border-gold hover:bg-amber-50/40 bg-white/70'
            }`}
          >
            <div className="flex flex-col items-center justify-center gap-1.5">
              <Upload
                className={`w-7 h-7 transition-colors ${
                  isDraggingFile ? 'text-emerald-700 animate-bounce' : 'text-amber-800'
                }`}
              />
              <p className="font-cinzel text-xs sm:text-sm font-bold text-foreground tracking-wide">
                {isUploading
                  ? 'Importing and processing guest records...'
                  : 'Upload or Drag & Drop Excel Sheet (.xlsx, .xls, .csv)'}
              </p>
              <p className="font-serif-display text-xs text-foreground/60 italic">
                Automatically parses guest names, attendance, guest counts, and Duas &amp; syncs to GitHub
              </p>
            </div>
          </div>

          {/* Feedback Banner */}
          {syncFeedback.type && (
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                syncFeedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : 'bg-red-50 border-red-300 text-red-900'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {syncFeedback.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                )}
                <div className="text-sm">
                  <p className="font-semibold">{syncFeedback.message}</p>
                  {syncFeedback.commitUrl && (
                    <a
                      href={syncFeedback.commitUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-1 font-cinzel text-xs text-emerald-700 underline font-bold"
                    >
                      View updated Excel file on GitHub <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSyncFeedback({ type: null, message: '' })}
                className="text-foreground/40 hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>
          )}

          {/* GitHub Settings Drawer */}
          {showSettings && (
            <form
              onSubmit={handleSaveSettings}
              className="p-5 bg-white rounded-xl border-2 border-dashed border-gold-soft/80 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-gold-soft/30 pb-2">
                <div className="flex items-center gap-2">
                  <Github className="w-5 h-5 text-[#1b4332]" />
                  <h4 className="font-cinzel text-sm font-bold text-foreground">
                    GitHub Repository &amp; Auto-Sync Configuration
                  </h4>
                </div>
                <span className="text-[11px] text-foreground/60 italic">Stored locally in your browser</span>
              </div>

              <p className="text-xs text-foreground/75 leading-relaxed">
                Connect your GitHub repository to automatically commit and update the Excel spreadsheet
                (<code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono text-[11px]">{ghConfig.filePath}</code>)
                each time a guest fills out the RSVP form.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-cinzel font-semibold text-foreground/80 mb-1">
                    GitHub Username or Org
                  </label>
                  <input
                    type="text"
                    value={ghConfig.owner}
                    onChange={(e) => setGhConfig({ ...ghConfig, owner: e.target.value })}
                    placeholder="e.g. ashutoshs019"
                    className="w-full px-3 py-2 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-semibold text-foreground/80 mb-1">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    value={ghConfig.repo}
                    onChange={(e) => setGhConfig({ ...ghConfig, repo: e.target.value })}
                    placeholder="e.g. wedding-invitation"
                    className="w-full px-3 py-2 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-semibold text-foreground/80 mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    value={ghConfig.branch}
                    onChange={(e) => setGhConfig({ ...ghConfig, branch: e.target.value })}
                    placeholder="main or master"
                    className="w-full px-3 py-2 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-cinzel font-semibold text-foreground/80 mb-1">
                    Excel File Path in Repo
                  </label>
                  <input
                    type="text"
                    value={ghConfig.filePath}
                    onChange={(e) => setGhConfig({ ...ghConfig, filePath: e.target.value })}
                    placeholder="wedding-rsvps.xlsx"
                    className="w-full px-3 py-2 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-cinzel font-semibold text-foreground/80 mb-1">
                    GitHub Personal Access Token (PAT)
                  </label>
                  <input
                    type="password"
                    value={ghConfig.token}
                    onChange={(e) => setGhConfig({ ...ghConfig, token: e.target.value, enabled: true })}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx (Requires 'repo' or 'contents:write' permission)"
                    className="w-full px-3 py-2 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#1b4332]"
                  />
                  <p className="text-[11px] text-foreground/60 mt-1">
                    Create a token in GitHub Settings ➔ Developer Settings ➔ Personal Access Tokens (Classic or Fine-grained with Repository Contents Write permission).
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="autoSyncCheck"
                  checked={ghConfig.autoSyncOnSubmit}
                  onChange={(e) => setGhConfig({ ...ghConfig, autoSyncOnSubmit: e.target.checked })}
                  className="rounded text-emerald-800 focus:ring-emerald-700 w-4 h-4 cursor-pointer"
                />
                <label htmlFor="autoSyncCheck" className="text-xs font-cinzel text-foreground font-semibold cursor-pointer">
                  Automatically commit updated Excel to GitHub when a guest submits RSVP
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 text-xs font-cinzel font-bold text-foreground/70 hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-[#1b4332] hover:bg-[#163828] text-white font-cinzel text-xs font-bold uppercase tracking-wider"
                >
                  Save GitHub Settings
                </button>
              </div>
            </form>
          )}

          {/* Live Guest List Table */}
          <div className="bg-white rounded-xl border border-gold-soft/60 shadow-xs overflow-hidden">
            <div className="p-4 bg-gradient-to-r from-[#faf6f0] to-[#f4ede2] border-b border-gold-soft/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#1b4332]" />
                <h4 className="font-cinzel text-xs font-bold uppercase tracking-wider text-[#1b4332]">
                  Registered Guests in Excel Sheet ({rsvps.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={loadData}
                className="text-xs font-cinzel text-foreground/60 hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" /> Refresh
              </button>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#163828]/5 border-b border-gold-soft/30 font-cinzel text-foreground/80">
                    <th className="p-3">#</th>
                    <th className="p-3">Guest Name</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Guests</th>
                    <th className="p-3">Ceremonies</th>
                    <th className="p-3">Message</th>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-center">QR Pass</th>
                    <th className="p-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-soft/20 font-serif-display">
                  {rsvps.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="p-8 text-center text-foreground/60 italic text-sm">
                        No RSVP responses recorded yet. As guests submit the form, their names and details will appear here and in the Excel sheet!
                      </td>
                    </tr>
                  ) : (
                    rsvps.map((rsvp, idx) => (
                      <tr key={rsvp.id} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-3 font-mono text-[11px] text-foreground/50">{idx + 1}</td>
                        <td className="p-3 font-bold text-foreground text-sm">{rsvp.guest_name}</td>
                        <td className="p-3 text-foreground/75 font-mono text-[11px]">{rsvp.phone || '—'}</td>
                        <td className="p-3">
                          {rsvp.attending === 'yes' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Attending
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-100 text-rose-800 border border-rose-300">
                              Declined
                            </span>
                          )}
                        </td>
                        <td className="p-3 font-semibold text-foreground/90">
                          {rsvp.attending === 'yes' ? rsvp.guest_count : 0}
                        </td>
                        <td className="p-3 text-foreground/80 max-w-xs truncate" title={rsvp.events.join(', ')}>
                          {rsvp.events.length > 0 ? rsvp.events.join(', ') : 'All Celebrations'}
                        </td>
                        <td className="p-3 text-foreground/75 max-w-[150px] truncate italic" title={rsvp.message || undefined}>
                          {rsvp.message || '—'}
                        </td>
                        <td className="p-3 text-foreground/60 text-[11px] whitespace-nowrap">
                          {new Date(rsvp.submitted_at).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-center">
                          {rsvp.attending === 'yes' ? (
                            <button
                              type="button"
                              onClick={() => {
                                const pass: CheckInPassData = {
                                  passId: generatePassId(rsvp.guest_name, new Date(rsvp.submitted_at).getTime()),
                                  guestName: rsvp.guest_name,
                                  guestCount: rsvp.guest_count,
                                  phone: rsvp.phone || undefined,
                                  events: rsvp.events.length > 0 ? rsvp.events : ['Wedding Celebrations'],
                                  dietary: rsvp.dietary || undefined,
                                  timestamp: new Date(rsvp.submitted_at).getTime(),
                                  verified: true,
                                };
                                setViewPassGuest(pass);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-cinzel font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 transition-colors cursor-pointer"
                              title={`View/Print QR Check-In Pass for ${rsvp.guest_name}`}
                            >
                              <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Pass</span>
                            </button>
                          ) : (
                            <span className="text-foreground/40 text-[11px]">—</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteRsvp(rsvp.id, rsvp.guest_name)}
                            disabled={deletingId === rsvp.id}
                            className="p-1.5 rounded-lg text-rose-700 hover:text-rose-900 hover:bg-rose-100 transition-colors cursor-pointer disabled:opacity-40"
                            title={`Delete RSVP record for ${rsvp.guest_name}`}
                            aria-label={`Delete RSVP record for ${rsvp.guest_name}`}
                          >
                            {deletingId === rsvp.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
            </>
          ) : activeTab === 'wishes' ? (
            /* Wishes Moderation Tab */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f3ede2] rounded-xl border border-gold-soft/60">
                <div>
                  <h4 className="font-cinzel text-sm font-bold text-foreground">
                    Guest Book &amp; Duas Moderation ({wishes.length})
                  </h4>
                  <p className="font-serif-display text-xs text-foreground/70 italic">
                    Review, search, and delete inappropriate or test messages from the public wishes section.
                  </p>
                </div>

                <div className="relative min-w-[240px]">
                  <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={wishSearch}
                    onChange={(e) => setWishSearch(e.target.value)}
                    placeholder="Search by name or message..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#93203c]"
                  />
                </div>
              </div>

              {/* Feedback Banner */}
              {syncFeedback.type && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    syncFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {syncFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <p className="text-sm font-semibold">{syncFeedback.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSyncFeedback({ type: null, message: '' })}
                    className="text-foreground/40 hover:text-foreground text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Wishes List */}
              <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
                {filteredWishes.length === 0 ? (
                  <div className="p-12 text-center text-foreground/60 italic font-serif-display bg-white rounded-xl border border-gold-soft/40">
                    No guest wishes found {wishSearch ? 'matching your search' : 'yet'}.
                  </div>
                ) : (
                  filteredWishes.map((wish) => (
                    <div
                      key={wish.id}
                      className="p-4 rounded-xl bg-white border border-gold-soft/60 shadow-xs hover:border-gold transition-all flex flex-col sm:flex-row sm:items-start justify-between gap-3"
                    >
                      <div className="space-y-1.5 flex-1 text-left">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-serif-display text-base font-bold text-foreground">
                            {wish.name}
                          </span>
                          {wish.relationOrCity && (
                            <span className="text-xs text-foreground/60 font-serif-display italic">
                              ({wish.relationOrCity})
                            </span>
                          )}
                          {wish.attending === 'yes' ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ Attending
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-100 text-stone-700 border border-stone-300">
                              Well-wisher
                            </span>
                          )}
                          <span className="text-[11px] text-foreground/50 font-serif-display ml-auto">
                            {wish.date}
                          </span>
                        </div>
                        <p className="font-serif-display text-sm text-foreground/85 italic bg-[#faf8f5] p-3 rounded-lg border border-gold-soft/30 leading-relaxed">
                          "{wish.message}"
                        </p>
                      </div>

                      <div className="shrink-0 flex items-center gap-2 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteWish(wish.id, wish.name)}
                          disabled={deletingId === wish.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-300 transition-all cursor-pointer disabled:opacity-40"
                          title={`Delete message from ${wish.name}`}
                        >
                          {deletingId === wish.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-700" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5 text-rose-700" />
                          )}
                          <span>Delete Wish</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Invite Link Generator Tab */
            <div className="space-y-6">
              {/* Header Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-900/10 via-amber-800/5 to-transparent border border-gold-soft/80 space-y-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-5 h-5 text-amber-800" />
                  <h4 className="font-cinzel text-base font-bold text-foreground">
                    Function-Specific Guest Link Generator
                  </h4>
                </div>
                <p className="font-serif-display text-sm text-foreground/80 leading-relaxed">
                  Send customized invitation links using <strong>function names in the URL parameter</strong> (e.g.{' '}
                  <code className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-950 font-mono text-xs font-semibold">?function=rukhsati</code> or{' '}
                  <code className="px-1.5 py-0.5 rounded bg-amber-100/80 text-amber-950 font-mono text-xs font-semibold">?functions=rukhsati,ramada</code>).
                  When a guest opens their link, <strong>only those function details will appear on the website</strong> (Events Schedule, Countdown, and RSVP). All other functions are completely hidden!
                </p>
              </div>

              {/* Feedback Banner */}
              {syncFeedback.type && (
                <div
                  className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                    syncFeedback.type === 'success'
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                      : 'bg-rose-50 border-rose-300 text-rose-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {syncFeedback.type === 'success' ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                    )}
                    <p className="text-sm font-semibold">{syncFeedback.message}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSyncFeedback({ type: null, message: '' })}
                    className="text-foreground/40 hover:text-foreground text-sm cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Interactive Builder Card */}
              <div className="bg-white p-6 rounded-2xl border border-gold-soft/70 shadow-sm space-y-5">
                {/* 1. Guest Name Input */}
                <div className="space-y-1.5">
                  <label className="block font-cinzel text-xs font-bold uppercase tracking-wider text-foreground/80">
                    1. Guest or Family Name (Optional)
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-foreground/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inviteGuestName}
                      onChange={(e) => setInviteGuestName(e.target.value)}
                      placeholder="e.g. Dr. Salman Qureshi, Uncle Tariq & Family, Ayesha Khan..."
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#faf8f5] border border-gold-soft/80 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-amber-600 font-serif-display"
                    />
                  </div>
                  <p className="font-serif-display text-xs text-foreground/60 italic">
                    If entered, the invitation displays a royal welcome greeting card and auto-fills their name in the RSVP form.
                  </p>
                </div>

                {/* 2. Select Functions */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="block font-cinzel text-xs font-bold uppercase tracking-wider text-foreground/80">
                      2. Select Invited Functions (Only checked functions will show)
                    </label>
                    {/* Quick Presets */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-cinzel uppercase text-foreground/50 font-bold mr-1">
                        Presets:
                      </span>
                      <button
                        type="button"
                        onClick={() => setInviteSelectedFunctions([1, 2, 3])}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-cinzel cursor-pointer font-bold transition-all ${
                          inviteSelectedFunctions.length === 3
                            ? 'bg-amber-800 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        All 3 Functions
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteSelectedFunctions([1, 2])}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-cinzel cursor-pointer font-bold transition-all ${
                          inviteSelectedFunctions.length === 2 &&
                          inviteSelectedFunctions.includes(1) &&
                          inviteSelectedFunctions.includes(2)
                            ? 'bg-amber-800 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        Function 1 &amp; 2
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteSelectedFunctions([1])}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-cinzel cursor-pointer font-bold transition-all ${
                          inviteSelectedFunctions.length === 1 &&
                          inviteSelectedFunctions[0] === 1
                            ? 'bg-amber-800 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        Function 1 Only
                      </button>
                      <button
                        type="button"
                        onClick={() => setInviteSelectedFunctions([2, 3])}
                        className={`px-2.5 py-1 rounded-md text-[11px] font-cinzel cursor-pointer font-bold transition-all ${
                          inviteSelectedFunctions.length === 2 &&
                          inviteSelectedFunctions.includes(2) &&
                          inviteSelectedFunctions.includes(3)
                            ? 'bg-amber-800 text-white'
                            : 'bg-stone-100 hover:bg-stone-200 text-stone-800'
                        }`}
                      >
                        Function 2 &amp; 3
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {ALL_FUNCTIONS.map((f) => {
                      const isSelected = inviteSelectedFunctions.includes(f.id);
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => toggleInviteFunction(f.id)}
                          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'bg-amber-50/80 border-amber-500 shadow-xs ring-1 ring-amber-500'
                              : 'bg-white border-stone-200 hover:bg-stone-50 opacity-60'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-cinzel font-bold uppercase bg-stone-900 text-gold-light mb-1">
                                Function {f.id}
                              </span>
                              <h5 className="font-serif-display font-bold text-sm text-foreground">
                                {f.title}
                              </h5>
                            </div>
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? 'bg-amber-800 border-amber-800 text-white'
                                  : 'border-stone-300 bg-white'
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gold-soft/30 font-serif-display text-xs text-foreground/75 space-y-0.5">
                            <p className="font-semibold text-rose-deep">{f.dateLabel}</p>
                            <p className="text-foreground/60 truncate" title={f.venue}>
                              📍 {f.venue}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Generated Link & Actions */}
                <div className="pt-2 space-y-3">
                  <label className="block font-cinzel text-xs font-bold uppercase tracking-wider text-foreground/80">
                    3. Generated Personalized Link
                  </label>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={currentInviteUrl}
                      className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-[#f6f2ea] border border-gold-soft rounded-xl text-foreground select-all focus:outline-hidden"
                    />

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyUrl(currentInviteUrl)}
                        className={`inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-cinzel text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs ${
                          copiedInviteUrl === currentInviteUrl
                            ? 'bg-emerald-600 text-white'
                            : 'bg-amber-800 hover:bg-amber-900 text-white'
                        }`}
                      >
                        {copiedInviteUrl === currentInviteUrl ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>Copied! ✓</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleWhatsAppShare(
                            inviteGuestName,
                            inviteSelectedFunctions,
                            currentInviteUrl
                          )
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-cinzel text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
                        title="Share invitation directly via WhatsApp"
                      >
                        <Share2 className="w-4 h-4" />
                        <span>WhatsApp</span>
                      </button>

                      <a
                        href={currentInviteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-800 font-cinzel text-xs font-bold transition-all"
                        title="Open and preview in new tab"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span className="hidden sm:inline">Preview</span>
                      </a>

                      <button
                        type="button"
                        onClick={handleSaveInvite}
                        className="inline-flex items-center justify-center gap-1 px-3 py-2.5 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 font-cinzel text-xs font-bold transition-all cursor-pointer"
                        title="Save to directory below"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>

                  {/* Summary of what guest will see */}
                  <div className="p-3 rounded-xl bg-[#faf6f0] border border-gold-soft/40 flex items-center gap-2 text-xs font-serif-display text-foreground/80">
                    <Sparkles className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>
                      <strong>Guest will see:</strong>{' '}
                      {getInvitedFunctionsDescription(inviteSelectedFunctions)}
                      {inviteSelectedFunctions.length < 3 && (
                        <span className="text-rose-deep font-semibold ml-1">
                          (Other functions hidden)
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Card Image Selector for Functions */}
                  <div className="p-3.5 rounded-xl bg-stone-50 border border-gold-soft/50 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <label className="font-cinzel text-xs font-bold text-amber-950 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Select Card Image to Attach & Send:</span>
                      </label>
                      <span className="text-[11px] font-serif-display text-emerald-800 font-medium">
                        {selectedCardImageId === 'auto'
                          ? '⚡ Auto-matched to invited ceremonies'
                          : 'Custom card selected'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCardImageId('auto')}
                        className={`p-2 rounded-xl text-left border transition-all cursor-pointer flex flex-col justify-between ${
                          selectedCardImageId === 'auto'
                            ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-500/40'
                            : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                        }`}
                        title="Automatically attach ceremony card matching selected functions"
                      >
                        <span className="font-cinzel font-bold text-[11px] flex items-center gap-1">
                          <span>⚡</span> Auto Match
                        </span>
                        <span className="text-[10px] opacity-80 font-serif-display truncate">
                          Invited ceremonies
                        </span>
                      </button>

                      {ALL_CARD_OPTIONS.map((opt) => {
                        const isSelected = selectedCardImageId === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSelectedCardImageId(opt.id)}
                            className={`p-1.5 rounded-xl text-left border transition-all cursor-pointer flex items-center gap-2 ${
                              isSelected
                                ? 'bg-emerald-800 text-white border-emerald-900 shadow-xs ring-2 ring-emerald-500/40'
                                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
                            }`}
                            title={`Select ${opt.title}`}
                          >
                            <img
                              src={getAssetPath(opt.path)}
                              alt={opt.title}
                              className="w-7 h-9 object-cover rounded shrink-0 border border-black/10 bg-stone-100"
                            />
                            <div className="min-w-0">
                              <span className="font-cinzel font-bold text-[10px] block truncate">
                                {opt.title.replace(' Ceremony Card', '').replace(' Card', '')}
                              </span>
                              <span className="text-[9px] opacity-75 font-serif-display block truncate">
                                {opt.subtitle.split('·')[1]?.trim() || opt.subtitle}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Attached Function Card Image Box for WhatsApp */}
                  {(() => {
                    const cardInfo = resolveActiveCard(inviteSelectedFunctions, selectedCardImageId);
                    return (
                      <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-[#f8faf8] to-emerald-50/50 border-2 border-emerald-500/40 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="flex items-center gap-3.5 w-full sm:w-auto">
                          <div className="relative w-14 h-18 sm:w-16 sm:h-20 shrink-0 rounded-lg overflow-hidden border border-emerald-400 shadow-sm bg-white">
                            <img
                              src={getAssetPath(cardInfo.path)}
                              alt={cardInfo.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.currentTarget as HTMLImageElement).src = getAssetPath(`assets/${cardInfo.filename}`);
                              }}
                            />
                            <div className="absolute inset-0 bg-black/5" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-cinzel font-bold uppercase tracking-wider">
                                <ImageIcon className="w-3 h-3" />
                                <span>Attached Image</span>
                              </span>
                              <span className="font-serif-display font-semibold text-xs text-emerald-950">
                                {cardInfo.title}
                              </span>
                            </div>
                            <p className="font-serif-display text-xs text-foreground/75">
                              Attached automatically when sending via WhatsApp native share or clipboard photo paste.
                            </p>
                            <p className="font-mono text-[10px] text-foreground/50">
                              File: {cardInfo.filename}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                          <button
                            type="button"
                            onClick={() => handleDownloadCardImage(inviteSelectedFunctions, cardInfo)}
                            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-emerald-300 hover:bg-emerald-50 text-emerald-900 font-cinzel text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Download ceremony card image directly"
                          >
                            <Download className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Download Card</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleWhatsAppShare(
                                inviteGuestName,
                                inviteSelectedFunctions,
                                currentInviteUrl,
                                cardInfo
                              )
                            }
                            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-cinzel text-xs font-bold transition-all shadow-xs cursor-pointer"
                            title="Share on WhatsApp with attached card image and venue location link"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Function Names URL Parameter Cheatsheet */}
              <div className="bg-[#faf8f5] p-5 rounded-2xl border border-gold-soft/70 space-y-3">
                <div className="flex items-center justify-between">
                  <h5 className="font-cinzel text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center gap-2">
                    <span>💡 Supported Function Name Parameters Cheatsheet</span>
                  </h5>
                  <span className="text-[11px] font-serif-display italic text-foreground/60">
                    Use any of these in your link
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5 text-xs font-serif-display">
                  <div className="p-3 rounded-xl bg-white border border-gold-soft/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Function 1: Rukhsati</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">29 Oct</span>
                    </div>
                    <p className="text-[11px] text-foreground/70">Shimla Resort</p>
                    <code className="block p-1.5 rounded bg-stone-100 font-mono text-[11px] text-amber-900 font-semibold select-all">
                      ?function=rukhsati
                    </code>
                    <p className="text-[10px] text-foreground/50 italic">Also matches: ?function=shimla</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-gold-soft/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Function 2: Ramada</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">30 Oct</span>
                    </div>
                    <p className="text-[11px] text-foreground/70">Hotel Ramada</p>
                    <code className="block p-1.5 rounded bg-stone-100 font-mono text-[11px] text-amber-900 font-semibold select-all">
                      ?function=ramada
                    </code>
                    <p className="text-[10px] text-foreground/50 italic">Also matches: ?function=hotel-ramada</p>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-gold-soft/40 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground">Function 3: Radiant</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-[10px] font-bold">2 Nov</span>
                    </div>
                    <p className="text-[11px] text-foreground/70">Radiant Resorts Gorakhpur</p>
                    <code className="block p-1.5 rounded bg-stone-100 font-mono text-[11px] text-amber-900 font-semibold select-all">
                      ?function=radiant
                    </code>
                    <p className="text-[10px] text-foreground/50 italic">Also matches: ?function=gorakhpur</p>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2 flex-wrap text-xs font-serif-display text-foreground/75">
                  <span className="font-semibold text-foreground/90">Multiple Functions:</span>
                  <code className="px-2 py-0.5 rounded bg-white border border-gold-soft/60 font-mono text-[11px] text-amber-900 select-all">
                    ?functions=rukhsati,ramada
                  </code>
                  <code className="px-2 py-0.5 rounded bg-white border border-gold-soft/60 font-mono text-[11px] text-amber-900 select-all">
                    ?functions=ramada,radiant
                  </code>
                  <code className="px-2 py-0.5 rounded bg-white border border-gold-soft/60 font-mono text-[11px] text-amber-900 select-all">
                    ?functions=rukhsati,radiant
                  </code>
                </div>
              </div>

              {/* Saved Guest Directory */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-[#f3ede2] rounded-xl border border-gold-soft/60">
                  <div>
                    <h5 className="font-cinzel text-sm font-bold text-foreground">
                      Saved Guest Links Directory ({savedInvites.length})
                    </h5>
                    <p className="font-serif-display text-xs text-foreground/70 italic">
                      Quickly re-copy links or send reminders via WhatsApp anytime.
                    </p>
                  </div>

                  <div className="relative min-w-[220px]">
                    <Search className="w-4 h-4 text-foreground/40 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      placeholder="Search saved guest..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-gold-soft/80 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-amber-700 font-serif-display"
                    />
                  </div>
                </div>

                <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {savedInvites
                    .filter((item) => {
                      if (!inviteSearch.trim()) return true;
                      return item.guestName.toLowerCase().includes(inviteSearch.toLowerCase());
                    })
                    .map((item) => (
                      <div
                        key={item.id}
                        className="p-3.5 rounded-xl bg-white border border-gold-soft/60 shadow-xs hover:border-gold transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-serif-display font-bold text-base text-foreground">
                              {item.guestName}
                            </span>
                            <span className="text-[11px] text-foreground/50 font-serif-display">
                              · {item.createdAt}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 flex-wrap">
                            {item.functionIds.map((fId) => (
                              <span
                                key={fId}
                                className="px-2 py-0.5 rounded-full text-[10px] font-cinzel font-bold uppercase bg-amber-50 text-amber-900 border border-amber-300"
                              >
                                Function {fId}: {fId === 1 ? 'Rukhsati' : fId === 2 ? 'Ramada' : 'Radiant'}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                          <button
                            type="button"
                            onClick={() => handleCopyUrl(item.url)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold text-stone-800 bg-stone-100 hover:bg-stone-200 transition-colors cursor-pointer"
                            title="Copy invitation URL"
                          >
                            {copiedInviteUrl === item.url ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedInviteUrl === item.url ? 'Copied' : 'Copy'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleWhatsAppShare(item.guestName, item.functionIds, item.url)
                            }
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-cinzel font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors cursor-pointer"
                            title="Send on WhatsApp with attached function card image"
                          >
                            <Share2 className="w-3.5 h-3.5" />
                            <span>WhatsApp</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              const pass: CheckInPassData = {
                                passId: generatePassId(item.guestName),
                                guestName: item.guestName,
                                guestCount: 2,
                                events: item.functionIds.map((id) => {
                                  const f = ALL_FUNCTIONS.find((fn) => fn.id === id);
                                  return f ? `${f.title} (${f.venue})` : `Function ${id}`;
                                }),
                                timestamp: Date.now(),
                                verified: true,
                              };
                              setViewPassGuest(pass);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-cinzel font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 transition-colors cursor-pointer"
                            title="View / Print personalized QR Check-in Pass"
                          >
                            <QrCode className="w-3.5 h-3.5 text-emerald-700" />
                            <span>QR Pass</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDownloadCardImage(item.functionIds)}
                            className="p-1.5 rounded-lg text-emerald-800 hover:text-emerald-950 hover:bg-emerald-100 transition-colors cursor-pointer"
                            title="Download ceremony card image"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-colors"
                            title="Open link in new tab"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>

                          <button
                            type="button"
                            onClick={() => handleDeleteSavedInvite(item.id)}
                            className="p-1.5 rounded-lg text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Delete this saved link"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                  {savedInvites.length === 0 && (
                    <div className="p-8 text-center text-foreground/60 italic font-serif-display bg-white rounded-xl border border-gold-soft/40">
                      No personalized links saved yet. Use the generator above and click "Save" to build your guest invite directory!
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-[#f7f3ec] p-4 border-t border-gold-soft/40 flex items-center justify-between text-xs font-cinzel text-foreground/70 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-gold-soft" />
            <span>Excel File: <strong>wedding-rsvps.xlsx</strong></span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-lg bg-[#163828] hover:bg-[#112d20] text-[#fcf6ba] font-bold uppercase tracking-wider cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>

      {/* Guest Check-in Pass Preview Modal */}
      {viewPassGuest && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-fade-in">
          <div className="relative w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="sticky top-2 right-2 z-10 flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setViewPassGuest(null)}
                className="w-8 h-8 rounded-full bg-stone-900/80 text-white flex items-center justify-center hover:bg-stone-900 cursor-pointer shadow-lg"
              >
                ✕
              </button>
            </div>
            <GuestCheckInPass
              passData={viewPassGuest}
              onBackOrEdit={() => setViewPassGuest(null)}
              showBackOption={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
