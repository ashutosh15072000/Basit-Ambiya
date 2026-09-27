import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import confetti from 'canvas-confetti';
import {
  Camera,
  X,
  RefreshCw,
  Flashlight,
  Upload,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Check,
  ChevronRight,
  Zap,
} from 'lucide-react';
import {
  recordGuestCheckIn,
  getStoredRsvps,
  normalizeEventName,
  formatDateTime,
  RsvpRecord,
} from '../services/rsvpExcelService';
import { CheckInTimeline } from './CheckInTimeline';

interface AdminQrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckInSuccess?: (record: RsvpRecord, eventName: string) => void;
}

export interface DecodedScanData {
  raw: string;
  passId: string;
  guestName: string;
  guestCount: number;
  events: string[];
  matchedRecord?: RsvpRecord | null;
  checkedInMap?: Record<string, string>;
  autoAdmitted?: boolean;
}

export const AdminQrScannerModal: React.FC<AdminQrScannerModalProps> = ({
  isOpen,
  onClose,
  onCheckInSuccess,
}) => {
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [scannedResult, setScannedResult] = useState<DecodedScanData | null>(null);
  const [isProcessingCheckIn, setIsProcessingCheckIn] = useState(false);
  const [storedRsvps, setStoredRsvps] = useState<RsvpRecord[]>(() => getStoredRsvps());

  const refreshStoredRsvps = () => {
    setStoredRsvps(getStoredRsvps());
  };

  useEffect(() => {
    if (isOpen) {
      refreshStoredRsvps();
    }
    const handleUpdate = () => refreshStoredRsvps();
    window.addEventListener('wedding_rsvp_updated', handleUpdate);
    return () => {
      window.removeEventListener('wedding_rsvp_updated', handleUpdate);
    };
  }, [isOpen]);

  // Compute Today's Check-In Counter & Heads
  const todayStr = new Date().toDateString();
  const checkedInTodayList = storedRsvps.filter((r) => {
    if (!r.checked_in) return false;
    if (r.checked_in_at) {
      const d = new Date(r.checked_in_at);
      if (!isNaN(d.getTime()) && d.toDateString() === todayStr) return true;
    }
    if (r.checked_in_events_map && Object.keys(r.checked_in_events_map).length > 0) {
      const hasToday = Object.values(r.checked_in_events_map).some((ts) => {
        const d = new Date(ts);
        return !isNaN(d.getTime()) && d.toDateString() === todayStr;
      });
      if (hasToday) return true;
    }
    return Boolean(r.checked_in);
  });

  const checkedInTodayCount = checkedInTodayList.length;
  const checkedInTodayHeads = checkedInTodayList.reduce(
    (sum, r) => sum + (Number(r.checked_in_guest_count) || Number(r.guest_count) || 1),
    0
  );
  
  // Quick Check-In Mode (1-Tap Auto-Admit for all scheduled ceremonies)
  const [quickCheckInMode, setQuickCheckInMode] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('wedding_quick_checkin_mode');
      return saved !== null ? saved === 'true' : true; // Default ON for fastest processing at busy entrance
    } catch {
      return true;
    }
  });

  const [checkInFeedback, setCheckInFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lensCaptureInputRef = useRef<HTMLInputElement>(null);

  const toggleQuickMode = () => {
    setQuickCheckInMode((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('wedding_quick_checkin_mode', String(next));
      } catch {}
      return next;
    });
  };

  // Parse QR text / URL into guest payload
  const parseQrContent = (text: string): DecodedScanData | null => {
    try {
      let passId = 'BA-PASS';
      let guestName = 'Honored Guest';
      let guestCount = 1;
      let events: string[] = ['Wedding Celebrations'];

      // 1. Try URL parameter parsing
      if (text.includes('?') || text.includes('&') || text.includes('checkin=') || text.includes('pass=')) {
        let queryString = text;
        if (text.includes('?')) {
          queryString = text.split('?')[1];
        }
        const params = new URLSearchParams(queryString);
        if (params.get('pass') || params.get('name') || params.get('guest')) {
          passId = decodeURIComponent(params.get('pass') || params.get('p') || passId);
          guestName = decodeURIComponent(params.get('name') || params.get('guest') || params.get('n') || guestName);
          const rawCount = params.get('guests') || params.get('count') || params.get('g') || '1';
          guestCount = Math.max(1, parseInt(rawCount.replace(/[^0-9]/g, '') || '1', 10));

          const rawEvents = params.get('events') || params.get('e') || '';
          if (rawEvents) {
            events = decodeURIComponent(rawEvents)
              .split(/[|,]/)
              .map((s) => s.trim())
              .filter(Boolean);
          }
        }
      } else if (text.startsWith('{') && text.endsWith('}')) {
        // 2. Try JSON payload
        const parsed = JSON.parse(text);
        passId = parsed.passId || parsed.pass || passId;
        guestName = parsed.guestName || parsed.name || guestName;
        guestCount = Number(parsed.guestCount || parsed.guests) || 1;
        if (Array.isArray(parsed.events) && parsed.events.length > 0) {
          events = parsed.events;
        }
      } else {
        // 3. Raw text string
        passId = text.trim();
        guestName = text.trim();
      }

      // Look up existing matching RSVP record
      const stored = getStoredRsvps();
      const match = stored.find(
        (r) =>
          (r.checked_in_pass_id && r.checked_in_pass_id.toLowerCase() === passId.toLowerCase()) ||
          (r.guest_name && r.guest_name.toLowerCase() === guestName.toLowerCase())
      );

      const checkedInMap: Record<string, string> = { ...(match?.checked_in_events_map || {}) };
      if (match?.checked_in_events && match.checked_in_events.length > 0) {
        match.checked_in_events.forEach((ev) => {
          checkedInMap[normalizeEventName(ev)] = checkedInMap[normalizeEventName(ev)] || match.checked_in_at || new Date().toISOString();
        });
      }

      return {
        raw: text,
        passId,
        guestName: match?.guest_name || guestName,
        guestCount: match ? Math.max(match.guest_count, guestCount) : guestCount,
        events: match?.events && match.events.length > 0 ? match.events : events,
        matchedRecord: match || null,
        checkedInMap,
        autoAdmitted: false,
      };
    } catch (err) {
      console.warn('QR parse failed:', err);
      return null;
    }
  };

  // Immediate Auto Quick-Admit for All Scheduled Events
  const executeInstantQuickAdmit = async (data: DecodedScanData) => {
    setIsProcessingCheckIn(true);
    setCheckInFeedback({ type: null, message: '' });

    try {
      const res = await recordGuestCheckIn({
        passId: data.passId,
        guestName: data.guestName,
        guestCount: data.guestCount,
        events: data.events,
        checkInAll: true,
      });

      setIsProcessingCheckIn(false);

      if (res.success) {
        setScannedResult({
          ...data,
          matchedRecord: res.record,
          checkedInMap: res.record.checked_in_events_map || {},
          autoAdmitted: true,
        });

        setCheckInFeedback({
          type: 'success',
          message: `⚡ Quick Admitted: ${data.guestName} (${data.guestCount} heads) for ALL functions!`,
        });

        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.35 },
          colors: ['#10b981', '#c5a059', '#1b4332', '#e4c88a'],
        });

        if (onCheckInSuccess) {
          onCheckInSuccess(res.record, 'All Events');
        }
        refreshStoredRsvps();
      }
    } catch (err: any) {
      setIsProcessingCheckIn(false);
      setScannedResult(data);
      setCheckInFeedback({
        type: 'error',
        message: err.message || 'Auto check-in failed.',
      });
    }
  };

  // Handle whenever a QR payload is detected
  const handleDecodedPass = (parsed: DecodedScanData) => {
    stopCamera();

    // Haptic vibration feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(80);
    }

    if (quickCheckInMode) {
      // ⚡ Bypasses manual ceremony selection flow and instantly admits for all events!
      executeInstantQuickAdmit(parsed);
    } else {
      setScannedResult(parsed);
    }
  };

  // Start video camera stream
  const startCamera = async () => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported by this browser. Use "Upload / Snap Photo" instead.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // Required for iOS
        await videoRef.current.play();
        setCameraActive(true);

        // Check flashlight / torch capability
        const track = stream.getVideoTracks()[0];
        if (track) {
          const capabilities = (track.getCapabilities ? track.getCapabilities() : {}) as any;
          setTorchSupported(Boolean(capabilities?.torch));
        }

        requestScanFrame();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      setCameraError(
        err.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in browser settings or use Google Lens / Photo Capture.'
          : err.message || 'Unable to open camera.'
      );
      setCameraActive(false);
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setCameraActive(false);
    setTorchOn(false);
  };

  // Toggle flashlight / torch
  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && (track.applyConstraints as any)) {
      try {
        const nextState = !torchOn;
        await (track.applyConstraints as any)({
          advanced: [{ torch: nextState }],
        });
        setTorchOn(nextState);
      } catch (err) {
        console.warn('Torch toggle error:', err);
      }
    }
  };

  // Switch between front and rear cameras
  const toggleFacingMode = () => {
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  // Continuous frame scanner loop using jsQR
  const requestScanFrame = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    if (video.readyState === video.HAVE_ENOUGH_DATA && ctx) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: 'dontInvert',
      });

      if (code && code.data && code.data.trim().length > 0) {
        const parsed = parseQrContent(code.data);
        if (parsed) {
          handleDecodedPass(parsed);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(requestScanFrame);
  };

  // Process uploaded or camera snapped image
  const handleImageFile = (file: File) => {
    if (!file) return;
    setCheckInFeedback({ type: null, message: '' });

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const parsed = parseQrContent(code.data);
          if (parsed) {
            handleDecodedPass(parsed);
          } else {
            setCheckInFeedback({
              type: 'error',
              message: 'QR code detected, but content was not a valid Wedding VIP Pass.',
            });
          }
        } else {
          setCheckInFeedback({
            type: 'error',
            message: 'No QR code found in the image. Please ensure the QR code is clearly visible and well-lit.',
          });
        }
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Manual check-in for specific ceremony or all
  const handlePerformCheckIn = async (eventName?: string, checkInAll = false) => {
    if (!scannedResult) return;
    setIsProcessingCheckIn(true);
    setCheckInFeedback({ type: null, message: '' });

    try {
      const targetEvent = eventName || scannedResult.events[0] || 'Wedding Celebrations';
      const res = await recordGuestCheckIn({
        passId: scannedResult.passId,
        guestName: scannedResult.guestName,
        guestCount: scannedResult.guestCount,
        events: scannedResult.events,
        specificEvent: targetEvent,
        checkInAll,
      });

      setIsProcessingCheckIn(false);

      if (res.success) {
        setScannedResult((prev) =>
          prev
            ? {
                ...prev,
                matchedRecord: res.record,
                checkedInMap: res.record.checked_in_events_map || {},
                autoAdmitted: checkInAll || prev.autoAdmitted,
              }
            : null
        );

        setCheckInFeedback({
          type: 'success',
          message: checkInAll
            ? `⚡ ${scannedResult.guestName} admitted for ALL functions!`
            : `✅ Admitted to "${targetEvent}" (${scannedResult.guestCount} heads)!`,
        });

        confetti({
          particleCount: 75,
          spread: 75,
          origin: { y: 0.4 },
          colors: ['#10b981', '#c5a059', '#1b4332', '#e4c88a'],
        });

        if (onCheckInSuccess) {
          onCheckInSuccess(res.record, targetEvent);
        }
        refreshStoredRsvps();
      }
    } catch (err: any) {
      setIsProcessingCheckIn(false);
      setCheckInFeedback({
        type: 'error',
        message: err.message || 'Check-in failed. Please try again.',
      });
    }
  };

  // Reset and scan next guest
  const handleScanNext = () => {
    setScannedResult(null);
    setCheckInFeedback({ type: null, message: '' });
    startCamera();
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setScannedResult(null);
      setCheckInFeedback({ type: null, message: '' });
    }

    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-[#fdfbf7] via-[#faf5ed] to-[#f4eee4] border-2 border-emerald-600 rounded-3xl p-5 sm:p-7 shadow-2xl text-center space-y-4 max-h-[94vh] flex flex-col my-auto">
        {/* Header with Title and Quick Check-In Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gold-soft/40 pb-3 gap-2.5 shrink-0 text-left">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-[#1b4332] text-white flex items-center justify-center shadow-md shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-emerald-950 uppercase leading-tight">
                Host Gate Scanner
              </h3>
              <p className="font-serif-display text-[11px] text-foreground/70 italic">
                Google Lens &amp; QR Live Verification Desk
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2">
            {/* Quick Check-In Mode Pill Button */}
            <button
              type="button"
              onClick={toggleQuickMode}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer border shadow-xs ${
                quickCheckInMode
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 border-amber-300 ring-2 ring-amber-400/40 shadow-amber-500/20'
                  : 'bg-stone-100 text-stone-600 border-stone-300 hover:bg-stone-200'
              }`}
              title="When ON: scanning immediately admits the guest for ALL ceremonies in 1 tap without extra steps."
            >
              <Zap className={`w-3.5 h-3.5 ${quickCheckInMode ? 'fill-amber-950 text-amber-950 animate-bounce' : 'text-stone-500'}`} />
              <span>Quick Check-In: {quickCheckInMode ? 'ON ⚡' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer shrink-0"
              aria-label="Close scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Today's Check-In Counter Banner */}
        <div className="bg-gradient-to-r from-[#163828] via-[#1d4d37] to-[#163828] rounded-2xl p-2.5 sm:p-3 text-white border border-[#e4c88a]/40 shadow-sm flex items-center justify-between gap-3 text-left shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 text-[#fcf6ba] flex items-center justify-center border border-[#e4c88a]/30 shrink-0">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-cinzel text-[11px] sm:text-xs font-bold uppercase tracking-wider text-[#fcf6ba]">
                  Guests Checked In Today
                </span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="font-serif-display text-[10px] sm:text-[11px] text-white/75 italic">
                Live entrance arrivals &amp; attendance tally
              </p>
            </div>
          </div>

          <div className="text-right shrink-0 bg-black/25 px-3 py-1.5 rounded-xl border border-white/10">
            <div className="font-serif-display text-lg sm:text-xl font-bold text-[#fcf6ba] leading-none">
              {checkedInTodayCount} <span className="text-[11px] font-sans font-normal text-white/80">VIPs</span>
            </div>
            <div className="font-cinzel text-[10px] text-emerald-200 tracking-wide mt-0.5">
              {checkedInTodayHeads} {checkedInTodayHeads === 1 ? 'Guest Head' : 'Guest Heads'}
            </div>
          </div>
        </div>

        {/* Hidden File Inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Google Lens / Direct Environment Camera Trigger Input */}
        <input
          ref={lensCaptureInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageFile(file);
            e.target.value = '';
          }}
        />

        {/* Body Content */}
        <div className="overflow-y-auto space-y-4">
          {!scannedResult ? (
            /* CAMERA SCANNING VIEW */
            <div className="space-y-3.5">
              {/* Quick Mode Status Banner */}
              {quickCheckInMode ? (
                <div className="bg-gradient-to-r from-amber-50 via-amber-100/90 to-amber-50 border border-amber-300 rounded-xl p-2 px-3 flex items-center justify-between text-left">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-700 fill-amber-700 shrink-0" />
                    <span className="font-cinzel text-[11px] font-bold text-amber-950 uppercase">
                      Quick Check-In Active
                    </span>
                  </div>
                  <span className="text-[10px] font-serif-display text-amber-900 italic">
                    Auto-admits for all ceremonies on scan
                  </span>
                </div>
              ) : (
                <div className="bg-stone-100 border border-stone-300/80 rounded-xl p-2 px-3 flex items-center justify-between text-left">
                  <span className="font-cinzel text-[11px] font-bold text-stone-700 uppercase">
                    Manual Selection Mode
                  </span>
                  <span className="text-[10px] font-serif-display text-stone-600 italic">
                    Choose individual ceremony after scan
                  </span>
                </div>
              )}

              {/* Viewfinder Frame */}
              <div className="relative w-full aspect-square max-w-[340px] mx-auto rounded-2xl overflow-hidden bg-black border-2 border-emerald-600 shadow-lg">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  autoPlay
                  playsInline
                  muted
                />
                <canvas ref={canvasRef} className="hidden" />

                {/* Animated Targeting Overlay */}
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 border-2 border-emerald-400/80 rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
                    {/* Corner Reticles */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />

                    {/* Laser Scanning Line */}
                    <div className="absolute left-0 right-0 h-1 bg-gradient-to-r from-transparent via-emerald-300 to-transparent shadow-[0_0_8px_#10b981] animate-laser-sweep" />
                  </div>
                </div>

                {/* Viewfinder Controls Bar (Flip Camera / Torch) */}
                <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm p-1 rounded-full border border-white/20">
                  {torchSupported && (
                    <button
                      type="button"
                      onClick={toggleTorch}
                      className={`p-2 rounded-full transition-colors ${
                        torchOn ? 'bg-amber-400 text-stone-900' : 'text-white hover:bg-white/20'
                      }`}
                      title={torchOn ? 'Turn Flash Off' : 'Turn Flash On'}
                    >
                      <Flashlight className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleFacingMode}
                    className="p-2 rounded-full text-white hover:bg-white/20 transition-colors"
                    title="Switch Camera (Front/Back)"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Viewfinder status text */}
                <div className="absolute bottom-3 inset-x-0 text-center pointer-events-none">
                  <span className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-sm text-emerald-300 font-cinzel text-[11px] font-bold tracking-wider uppercase border border-emerald-500/40">
                    Align QR Pass in box
                  </span>
                </div>
              </div>

              {cameraError && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs text-left flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold font-cinzel">Camera Notice</p>
                    <p className="font-serif-display mt-0.5">{cameraError}</p>
                  </div>
                </div>
              )}

              {/* Quick Launch Buttons (Google Lens, Camera Snap & Photo Upload) */}
              <div className="space-y-2 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {/* Google Lens / Camera direct launch */}
                  <button
                    type="button"
                    onClick={() => lensCaptureInputRef.current?.click()}
                    className="w-full py-3 px-3 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 hover:brightness-110 text-white font-cinzel text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                  >
                    <span className="text-base">📷</span>
                    <span>Open Camera / Google Lens</span>
                  </button>

                  {/* Upload / Gallery Image */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-3 px-3 rounded-xl bg-white hover:bg-stone-50 text-stone-800 border-2 border-stone-300 hover:border-emerald-600 font-cinzel text-xs font-bold uppercase tracking-wider transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Upload className="w-4 h-4 text-emerald-700" />
                    <span>Upload QR Image / Pass</span>
                  </button>
                </div>

                <p className="text-[11px] font-serif-display text-foreground/70 italic text-center">
                  Point at guest's phone screen or printed card to scan their VIP QR code.
                </p>
              </div>
            </div>
          ) : (
            /* SCANNED GUEST RESULT & ADMISSION ACTIONS */
            <div className="space-y-3.5 text-left animate-fade-in">
              {/* Badge & Guest Overview Card */}
              <div className="bg-white/95 rounded-2xl p-4 border-2 border-emerald-600/70 shadow-md space-y-2.5">
                <div className="flex items-center justify-between border-b border-gold-soft/30 pb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-cinzel text-[11px] font-bold uppercase">
                    <span>✓ VIP Pass Verified</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    {scannedResult.passId}
                  </span>
                </div>

                <div>
                  <h4 className="font-cinzel text-xl sm:text-2xl font-bold text-emerald-950 uppercase">
                    {scannedResult.guestName}
                  </h4>
                  <div className="flex items-center gap-3 text-xs font-serif-display text-foreground/80 mt-1">
                    <span className="font-bold text-emerald-900">
                      👥 {scannedResult.guestCount} {scannedResult.guestCount === 1 ? 'Guest' : 'Guests'} Admitted
                    </span>
                    <span>•</span>
                    <span className="text-stone-600">
                      {scannedResult.events.length} {scannedResult.events.length === 1 ? 'Ceremony' : 'Ceremonies'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Instant Check-In Feedback Alert */}
              {checkInFeedback.message && (
                <div
                  className={`p-3 rounded-xl border text-xs font-cinzel font-bold flex items-center gap-2 ${
                    checkInFeedback.type === 'success'
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-950 animate-bounce-short'
                      : 'bg-rose-100 border-rose-400 text-rose-950'
                  }`}
                >
                  <span className="text-base">{checkInFeedback.type === 'success' ? '⚡' : '⚠️'}</span>
                  <span>{checkInFeedback.message}</span>
                </div>
              )}

              {/* ⚡ ONE-TAP HERO QUICK ADMIT BUTTON */}
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 border-2 border-amber-600 shadow-md text-stone-950 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-cinzel text-xs font-bold uppercase tracking-wide">
                    <Zap className="w-4 h-4 fill-stone-950" />
                    <span>Quick Check-In (1-Tap)</span>
                  </div>
                  <span className="text-[10px] font-cinzel font-semibold bg-stone-950 text-amber-300 px-2 py-0.5 rounded-full">
                    Fastest
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isProcessingCheckIn}
                  onClick={() => handlePerformCheckIn(undefined, true)}
                  className="w-full py-3 px-4 rounded-xl bg-stone-950 hover:bg-stone-900 text-white font-cinzel text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 hover:scale-[1.01] active:scale-[0.99]"
                >
                  <Zap className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span>
                    {isProcessingCheckIn
                      ? 'Recording All Functions...'
                      : `⚡ Instantly Admit for All ${scannedResult.events.length} Events`}
                  </span>
                </button>
              </div>

              {/* Granular Ceremony Admission List */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between px-1">
                  <span className="font-cinzel text-[11px] text-foreground/70 uppercase font-bold tracking-wider">
                    Or Select Specific Ceremony:
                  </span>
                </div>

                <div className="space-y-1.5">
                  {scannedResult.events.map((rawEv, idx) => {
                    const normName = normalizeEventName(rawEv);
                    const isCheckedIn = Boolean(
                      scannedResult.checkedInMap &&
                      (scannedResult.checkedInMap[normName] || scannedResult.checkedInMap[rawEv])
                    );
                    const checkInTime =
                      scannedResult.checkedInMap?.[normName] ||
                      scannedResult.checkedInMap?.[rawEv];

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
                          isCheckedIn
                            ? 'bg-emerald-50/90 border-emerald-400'
                            : 'bg-white/95 border-gold-soft/80 hover:border-emerald-600 shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full ${isCheckedIn ? 'bg-emerald-600' : 'bg-amber-400'}`} />
                            <h5 className="font-cinzel font-bold text-xs sm:text-sm text-foreground">
                              {rawEv}
                            </h5>
                          </div>
                          <p className="text-[11px] font-serif-display pl-4.5 mt-0.5">
                            {isCheckedIn ? (
                              <span className="text-emerald-800 font-semibold">
                                ✅ Admitted: {formatDateTime(checkInTime)}
                              </span>
                            ) : (
                              <span className="text-amber-800 font-medium">
                                ⏳ Awaiting Admission
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="shrink-0 pl-4.5 sm:pl-0">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-cinzel font-bold uppercase bg-emerald-700 text-white">
                              <span>Admitted ✓</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessingCheckIn}
                              onClick={() => handlePerformCheckIn(rawEv)}
                              className="w-full sm:w-auto px-3.5 py-1.5 rounded-lg text-xs font-cinzel font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-800 to-[#1b4332] hover:brightness-110 text-white shadow-xs cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                            >
                              <span>Admit Event</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Guest Visit History & Timeline */}
              <CheckInTimeline
                events={scannedResult.events}
                checkedInMap={scannedResult.checkedInMap || {}}
                guestCount={scannedResult.guestCount}
                passId={scannedResult.passId}
                title="Guest Check-In &amp; Entry History"
              />

              {/* Navigation & Reset for Next Scan */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleScanNext}
                  className="py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-800 to-[#1b4332] hover:brightness-110 text-white font-cinzel text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5 hover:scale-102 active:scale-98"
                >
                  <RefreshCw className="w-4 h-4 animate-spin-hover" />
                  <span>⚡ Scan Next Guest</span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="py-3 px-4 rounded-xl border border-stone-300 text-stone-700 font-cinzel text-xs font-bold uppercase tracking-wider hover:bg-stone-100 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <span>Done</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
