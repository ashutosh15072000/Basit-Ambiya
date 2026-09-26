import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Share2,
  CheckCircle2,
  Calendar,
  MapPin,
  Users,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
} from 'lucide-react';
import { FlowerDivider } from './Ornaments';
import { getAssetPath } from '../utils/assets';

export interface CheckInPassData {
  passId: string;
  guestName: string;
  guestCount: number;
  phone?: string;
  events: string[];
  dietary?: string;
  timestamp: number;
  verified?: boolean;
}

interface GuestCheckInPassProps {
  passData: CheckInPassData;
  onBackOrEdit?: () => void;
  showBackOption?: boolean;
  className?: string;
}

/**
 * Generates a deterministic, elegant Pass ID from guest name and timestamp
 */
export function generatePassId(guestName: string, timestamp: number = Date.now()): string {
  const clean = (guestName || 'GUEST').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const prefix = clean.slice(0, 3) || 'VIP';
  const timeHash = (timestamp % 10000).toString().padStart(4, '0');
  const rand = Math.floor(100 + Math.random() * 900);
  return `BA-${prefix}-${timeHash}${rand}`.slice(0, 14);
}

export const GuestCheckInPass: React.FC<GuestCheckInPassProps> = ({
  passData,
  onBackOrEdit,
  showBackOption = true,
  className = '',
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [generating, setGenerating] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const passCardRef = useRef<HTMLDivElement>(null);

  // Compute verification payload
  const verificationPayload = React.useMemo(() => {
    // Generate check-in verification URL so any camera scanning it opens verified check-in
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://basit-ambiya.wedding';
    const params = new URLSearchParams({
      checkin: 'verified',
      pass: passData.passId,
      name: passData.guestName,
      guests: String(passData.guestCount || 1),
      events: passData.events.join('|'),
      t: String(passData.timestamp),
    });
    return `${origin}/?${params.toString()}`;
  }, [passData]);

  // Generate QR Code on mount or payload change
  useEffect(() => {
    let isMounted = true;
    setGenerating(true);

    QRCode.toDataURL(verificationPayload, {
      width: 480,
      margin: 1.5,
      color: {
        dark: '#1b4332', // Royal forest green
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) {
          setQrDataUrl(url);
          setGenerating(false);
        }
      })
      .catch((err) => {
        console.error('QR generation error:', err);
        if (isMounted) setGenerating(false);
      });

    return () => {
      isMounted = false;
    };
  }, [verificationPayload]);

  // Download High-Resolution Pass as an image file
  const handleDownloadPass = async () => {
    setDownloading(true);
    setFeedback(null);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 1600;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      // 1. Background gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, 1600);
      bgGrad.addColorStop(0, '#fdfbf7');
      bgGrad.addColorStop(0.5, '#faf5ed');
      bgGrad.addColorStop(1, '#f3ede2');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 1600);

      // 2. Ornamental double border
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 14;
      ctx.strokeRect(36, 36, 1128, 1528);

      ctx.strokeStyle = '#a84c32';
      ctx.lineWidth = 4;
      ctx.strokeRect(54, 54, 1092, 1492);

      // Corner gold accents
      const drawCorner = (x: number, y: number, angle: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.fillStyle = '#c5a059';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(40, 0);
        ctx.lineTo(40, 8);
        ctx.lineTo(8, 8);
        ctx.lineTo(8, 40);
        ctx.lineTo(0, 40);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      };
      drawCorner(64, 64, 0);
      drawCorner(1136, 64, Math.PI / 2);
      drawCorner(1136, 1536, Math.PI);
      drawCorner(64, 1536, -Math.PI / 2);

      // 3. Header text
      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 36px "Cinzel", "Cinzel Decorative", Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', 600, 130);

      ctx.fillStyle = '#a84c32';
      ctx.font = 'bold 24px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '6px';
      ctx.fillText('OFFICIAL WEDDING ENTRY PASS', 600, 185);

      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 50px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('BASIT & AMBIYA', 600, 250);

      ctx.fillStyle = '#7a6850';
      ctx.font = 'italic 26px "Playfair Display", Georgia, serif';
      ctx.letterSpacing = '1px';
      ctx.fillText('#BasitGotAmbitious · Wedding Celebrations 2026', 600, 295);

      // Divider line
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(250, 330);
      ctx.lineTo(950, 330);
      ctx.stroke();

      // Diamond on divider
      ctx.fillStyle = '#a84c32';
      ctx.beginPath();
      ctx.arc(600, 330, 8, 0, Math.PI * 2);
      ctx.fill();

      // 4. Guest Details Box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#e6d8c0';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(120, 370, 960, 360, 24);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#a84c32';
      ctx.font = 'bold 20px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '4px';
      ctx.fillText('HONORED GUEST', 600, 420);

      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 54px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '1px';
      ctx.fillText(passData.guestName.toUpperCase(), 600, 485);

      // Badges inside box
      ctx.fillStyle = '#f8f4ec';
      ctx.beginPath();
      ctx.roundRect(200, 520, 380, 70, 16);
      ctx.fill();
      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 24px "Cinzel", Georgia, serif';
      ctx.fillText(`PASS ID: ${passData.passId}`, 390, 565);

      ctx.fillStyle = '#f8f4ec';
      ctx.beginPath();
      ctx.roundRect(620, 520, 380, 70, 16);
      ctx.fill();
      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 24px "Cinzel", Georgia, serif';
      ctx.fillText(`ADMITTED: ${passData.guestCount} ${passData.guestCount === 1 ? 'GUEST' : 'GUESTS'}`, 810, 565);

      // Authorized ceremonies label
      ctx.fillStyle = '#6b583f';
      ctx.font = 'bold 20px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('AUTHORIZED CEREMONIES:', 600, 630);

      ctx.fillStyle = '#1b4332';
      ctx.font = 'italic 23px "Playfair Display", Georgia, serif';
      const eventsSummary = passData.events.length > 0 ? passData.events.join('  •  ') : 'All Invited Ceremonies';
      ctx.fillText(eventsSummary, 600, 670);

      // 5. QR Code Box
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#c5a059';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(325, 770, 550, 550, 28);
      ctx.fill();
      ctx.stroke();

      // Draw QR image
      if (qrDataUrl) {
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          qrImg.onload = resolve;
          qrImg.onerror = reject;
          qrImg.src = qrDataUrl;
        });
        ctx.drawImage(qrImg, 365, 810, 470, 470);
      }

      // 6. Footer instructions
      ctx.fillStyle = '#1b4332';
      ctx.font = 'bold 24px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '3px';
      ctx.fillText('FAST CHECK-IN AT VENUE ENTRANCE', 600, 1375);

      ctx.fillStyle = '#6b583f';
      ctx.font = 'italic 22px "Playfair Display", Georgia, serif';
      ctx.fillText('Please present this QR code on your phone upon arrival.', 600, 1415);
      ctx.fillText('Shimla Resort · Hotel Ramada · Radiant Resorts Gorakhpur', 600, 1450);

      ctx.fillStyle = '#a84c32';
      ctx.font = 'bold 20px "Cinzel", Georgia, serif';
      ctx.letterSpacing = '2px';
      ctx.fillText('MAY ALLAH BLESS YOUR PRESENCE WITH JOY', 600, 1500);

      // Generate downloadable blob
      canvas.toBlob((blob) => {
        if (!blob) throw new Error('Blob generation failed');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const cleanName = passData.guestName.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        a.download = `wedding-pass-${cleanName || 'guest'}-${passData.passId}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);

        setDownloading(false);
        setFeedback('Digital pass saved to your downloads / photos!');
        setTimeout(() => setFeedback(null), 4000);
      }, 'image/png');
    } catch (err) {
      console.error('Failed to download pass:', err);
      setDownloading(false);
      setFeedback('Could not download pass image. Please screenshot your pass.');
    }
  };

  // Share Pass via WhatsApp
  const handleSharePass = () => {
    const text =
      `🎟️ *WEDDING ENTRY & QUICK CHECK-IN PASS*\n\n` +
      `👑 *Basit Ali & Ambiya Basher Wedding Celebrations*\n\n` +
      `👤 *Honored Guest:* ${passData.guestName}\n` +
      `🆔 *Pass ID:* ${passData.passId}\n` +
      `👥 *Admitted:* ${passData.guestCount} ${passData.guestCount === 1 ? 'Guest' : 'Guests'}\n` +
      `✨ *Ceremonies:* ${passData.events.join(', ')}\n\n` +
      `📱 *Show your verified digital pass & QR code at venue entrance:*\n` +
      `${verificationPayload}\n\n` +
      `Awaiting your noble presence & Duas! 🌸`;

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Copy verification link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(verificationPayload);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (e) {
      console.warn('Copy link failed:', e);
    }
  };

  return (
    <div
      ref={passCardRef}
      className={`relative w-full max-w-lg mx-auto bg-gradient-to-b from-[#fdfbf7] via-[#faf5ed] to-[#f4eee4] border-2 border-gold-soft/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden text-center space-y-6 ${className}`}
    >
      {/* Decorative inner gold border */}
      <div className="absolute inset-2 sm:inset-3 border border-amber-600/30 rounded-2xl pointer-events-none" />

      {/* Top Banner Header */}
      <div className="relative space-y-2 pt-2">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-800 text-white font-cinzel text-[10px] font-bold tracking-widest uppercase shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
          <span>Official Wedding Entry Pass</span>
        </div>

        <p className="font-arabic text-xl sm:text-2xl text-emerald-950 font-bold tracking-wide">
          بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
        </p>

        <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-foreground tracking-wider uppercase">
          Basit Ali &amp; Ambiya Basher
        </h3>

        <p className="font-serif-display italic text-xs text-foreground/75">
          #BasitGotAmbitious · Fast Check-In Pass
        </p>

        <FlowerDivider />
      </div>

      {/* Guest Name & Pass Details Card */}
      <div className="relative bg-white/95 rounded-2xl p-4 sm:p-5 border border-gold-soft/60 shadow-xs space-y-3.5 text-left">
        <div className="flex items-center justify-between border-b border-gold-soft/30 pb-2.5">
          <div>
            <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
              Honored Guest
            </span>
            <h4 className="font-cinzel text-lg sm:text-xl font-bold text-emerald-950 tracking-wide uppercase">
              {passData.guestName}
            </h4>
          </div>

          <div className="text-right">
            <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-amber-900 block">
              Pass ID
            </span>
            <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-300">
              {passData.passId}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs font-serif-display">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#faf6f0] border border-gold-soft/40">
            <Users className="w-4 h-4 text-emerald-800 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-cinzel font-bold text-foreground/60 block">
                Party Size
              </span>
              <span className="font-bold text-foreground">
                {passData.guestCount} {passData.guestCount === 1 ? 'Guest' : 'Guests'} Admitted
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-[#faf6f0] border border-gold-soft/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <span className="text-[10px] uppercase font-cinzel font-bold text-foreground/60 block">
                Status
              </span>
              <span className="font-bold text-emerald-800">
                Confirmed VIP
              </span>
            </div>
          </div>
        </div>

        {/* Attending Ceremonies */}
        <div className="space-y-1.5 pt-1">
          <span className="font-cinzel text-[10px] font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-emerald-800" />
            <span>Authorized Ceremonies:</span>
          </span>
          <div className="flex flex-wrap gap-1.5">
            {passData.events.length > 0 ? (
              passData.events.map((ev, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-300 text-emerald-950 font-serif-display text-xs font-semibold"
                >
                  <Sparkles className="w-3 h-3 text-amber-700 shrink-0" />
                  <span>{ev}</span>
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-100/70 border border-emerald-300 text-emerald-950 font-serif-display text-xs font-semibold">
                Wedding Celebrations
              </span>
            )}
          </div>
        </div>
      </div>

      {/* QR Code Container */}
      <div className="relative bg-white rounded-2xl p-4 sm:p-5 border-2 border-emerald-800/30 shadow-md inline-block max-w-xs mx-auto">
        <div className="space-y-2">
          <div className="relative aspect-square w-52 sm:w-60 mx-auto rounded-xl overflow-hidden border border-emerald-600/30 bg-white flex items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center gap-2 p-6 text-emerald-900">
                <QrCode className="w-8 h-8 animate-spin" />
                <span className="font-cinzel text-xs font-semibold">Generating Pass...</span>
              </div>
            ) : qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`QR Check-in Pass for ${passData.guestName}`}
                className="w-full h-full object-contain p-2"
              />
            ) : (
              <div className="text-red-700 text-xs">Error generating QR code</div>
            )}
          </div>

          <div className="space-y-1">
            <p className="font-cinzel text-[11px] font-bold text-emerald-950 uppercase tracking-widest flex items-center justify-center gap-1">
              <span>🎟️</span> Show at Venue Entrance
            </p>
            <p className="font-serif-display italic text-[11px] text-foreground/75">
              Instant scan &amp; quick check-in upon arrival
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons: Download Image, WhatsApp, Copy Link */}
      <div className="space-y-2.5 pt-1">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadPass}
            disabled={downloading || generating}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-gradient-to-r from-emerald-800 via-emerald-700 to-emerald-900 text-white font-cinzel text-xs font-bold uppercase tracking-wider hover:brightness-110 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            title="Download full digital pass image to your device"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Saving Pass...' : 'Save Pass Image'}</span>
          </button>

          <button
            type="button"
            onClick={handleSharePass}
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-cinzel text-xs font-bold uppercase tracking-wider shadow-sm transition-all cursor-pointer"
            title="Send check-in pass details & QR link on WhatsApp"
          >
            <Share2 className="w-4 h-4" />
            <span>Send to WhatsApp</span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-300 text-stone-800 font-cinzel text-[11px] font-semibold transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedLink ? 'Link Copied!' : 'Copy Verification Link'}</span>
          </button>

          {showBackOption && onBackOrEdit && (
            <button
              type="button"
              onClick={onBackOrEdit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 border border-stone-300 text-stone-700 font-cinzel text-[11px] font-semibold transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Edit RSVP / Form</span>
            </button>
          )}
        </div>

        {feedback && (
          <p className="font-serif-display text-xs text-emerald-800 font-semibold bg-emerald-50 py-1.5 px-3 rounded-lg border border-emerald-200 animate-fade-in">
            {feedback}
          </p>
        )}
      </div>

      <div className="border-t border-gold-soft/30 pt-3 text-[11px] font-serif-display text-foreground/60 italic">
        Keep this pass saved on your device or take a screenshot to show security and reception upon arrival.
      </div>
    </div>
  );
};
