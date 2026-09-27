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
} from 'lucide-react';
import {
  recordGuestCheckIn,
  getStoredRsvps,
  normalizeEventName,
  formatDateTime,
  RsvpRecord,
} from '../services/rsvpExcelService';

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
      };
    } catch (err) {
      console.warn('QR parse failed:', err);
      return null;
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
          // Play haptic feedback if available on mobile
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(80);
          }

          setScannedResult(parsed);
          stopCamera();
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
            setScannedResult(parsed);
            stopCamera();
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

  // Execute check-in for specific ceremony
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
              }
            : null
        );

        setCheckInFeedback({
          type: 'success',
          message: checkInAll
            ? `✅ ${scannedResult.guestName} admitted for ALL functions!`
            : `✅ Admitted to "${targetEvent}" (${scannedResult.guestCount} heads)!`,
        });

        confetti({
          particleCount: 70,
          spread: 70,
          origin: { y: 0.4 },
          colors: ['#10b981', '#c5a059', '#1b4332'],
        });

        if (onCheckInSuccess) {
          onCheckInSuccess(res.record, targetEvent);
        }
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gold-soft/40 pb-3 shrink-0">
          <div className="flex items-center gap-2.5 text-left">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-700 to-[#1b4332] text-white flex items-center justify-center shadow-md">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-base sm:text-lg font-bold text-emerald-950 uppercase">
                Admin QR Scanner &amp; Google Lens
              </h3>
              <p className="font-serif-display text-xs text-foreground/70 italic">
                Scan guest VIP passes for instant gate check-in &amp; Excel sync
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-stone-200/80 hover:bg-stone-300 text-stone-700 transition-colors cursor-pointer"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
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
            <div className="space-y-4">
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
                    <span>Open Phone Camera / Lens</span>
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
                  Point at guest's phone screen or printed card to scan their VIP QR code automatically.
                </p>
              </div>
            </div>
          ) : (
            /* SCANNED GUEST RESULT & ADMISSION ACTIONS */
            <div className="space-y-4 text-left animate-fade-in">
              {/* Badge & Guest Overview */}
              <div className="bg-white/95 rounded-2xl p-4 border-2 border-emerald-600/70 shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-gold-soft/30 pb-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-cinzel text-[11px] font-bold uppercase">
                    <span>✓ VIP Pass Verified</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-emerald-900">
                    {scannedResult.passId}
                  </span>
                </div>

                <div>
                  <h4 className="font-cinzel text-xl font-bold text-emerald-950 uppercase">
                    {scannedResult.guestName}
                  </h4>
                  <div className="flex items-center gap-3 text-xs font-serif-display text-foreground/80 mt-1">
                    <span className="font-semibold text-emerald-900">
                      👥 {scannedResult.guestCount} {scannedResult.guestCount === 1 ? 'Guest' : 'Guests'} Admitted
                    </span>
                    <span>•</span>
                    <span className="text-stone-600">
                      {scannedResult.events.length} {scannedResult.events.length === 1 ? 'Ceremony' : 'Ceremonies'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Check-In Feedback Alert */}
              {checkInFeedback.message && (
                <div
                  className={`p-3 rounded-xl border text-xs font-cinzel font-bold flex items-center gap-2 ${
                    checkInFeedback.type === 'success'
                      ? 'bg-emerald-100 border-emerald-500 text-emerald-950 animate-bounce-short'
                      : 'bg-rose-100 border-rose-400 text-rose-950'
                  }`}
                >
                  <span>{checkInFeedback.type === 'success' ? '🎉' : '⚠️'}</span>
                  <span>{checkInFeedback.message}</span>
                </div>
              )}

              {/* Ceremony Admission Actions */}
              <div className="space-y-2">
                <span className="font-cinzel text-xs text-foreground/70 uppercase font-bold tracking-wider block px-1">
                  Select Ceremony to Admit:
                </span>

                <div className="space-y-2">
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
                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 ${
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
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-cinzel font-bold uppercase bg-emerald-700 text-white">
                              <span>Admitted ✓</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isProcessingCheckIn}
                              onClick={() => handlePerformCheckIn(rawEv)}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-cinzel font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-800 to-[#1b4332] hover:brightness-110 text-white shadow-md cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                            >
                              <span>✨ Check In &amp; Admit</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons: Check In All / Scan Next */}
              <div className="space-y-2 pt-2">
                {scannedResult.events.length > 1 && (
                  <button
                    type="button"
                    disabled={isProcessingCheckIn}
                    onClick={() => handlePerformCheckIn(undefined, true)}
                    className="w-full py-3 px-4 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-cinzel text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <span>🎟️</span>
                    <span>Admit for All {scannedResult.events.length} Ceremonies</span>
                  </button>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleScanNext}
                    className="py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-cinzel text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Scan Next Guest</span>
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
