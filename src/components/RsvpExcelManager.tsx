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

interface RsvpExcelManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RsvpExcelManager: React.FC<RsvpExcelManagerProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'rsvps' | 'wishes'>('rsvps');
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
                    <th className="p-3 text-right">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gold-soft/20 font-serif-display">
                  {rsvps.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-foreground/60 italic text-sm">
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
          ) : (
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
    </div>
  );
};
