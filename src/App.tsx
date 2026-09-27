import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import { FloatingPetals } from './components/FloatingPetals';
import { MusicPlayer } from './components/MusicPlayer';
import { IntroVideo } from './components/IntroVideo';
import { ScratchCard } from './components/ScratchCard';
import { CountdownTimer } from './components/CountdownTimer';
import { WeddingVideoSection } from './components/WeddingVideoSection';
import { EventCard } from './components/EventCard';
import { RsvpWishesSection } from './components/RsvpWishesSection';
import { RsvpForm } from './components/RsvpForm';
import { FamilySection } from './components/FamilySection';
import { Footer } from './components/Footer';
import { FlowerDivider, FloralCornerAccents, BlossomingFlower } from './components/Ornaments';
import { IslamicPatternOverlay } from './components/IslamicBackground';
import { AnimatedSection } from './components/AnimatedSection';
import { FloatingRsvpButton } from './components/FloatingRsvpButton';
import { InvitationPageCard } from './components/InvitationPageCard';
import { RsvpExcelManager } from './components/RsvpExcelManager';
import { AdminQrScannerModal } from './components/AdminQrScannerModal';
import {
  recordGuestCheckIn,
  toggleGuestEventCheckIn,
  getStoredRsvps,
  normalizeEventName,
  formatDateTime,
  RsvpRecord,
} from './services/rsvpExcelService';
import {
  parseInvitedFunctionIds,
  parseGuestName,
  ALL_FUNCTIONS,
} from './utils/invitationConfig';
import { getAssetPath } from './utils/assets';
import { EventDetails } from './types';

const EVENTS_SCHEDULE: EventDetails[] = [
  {
    title: 'Rukhsati',
    arabicTitle: 'رخصتی',
    description: 'The sacred Islamic marriage celebrations solemnized under the divine grace of Allah (SWT), followed by a celebratory royal dinner banquet.',
    day: 'THU',
    date: 'October 29, 2026',
    subtitle: 'Sacred Vows, Eternal Love & Divine Duas',
    dayOfWeek: 'Thursday',
    dayOfMonth: '29',
    monthName: 'October',
    year: '2026',
    time: 'Rukhsati at 07:30 PM ',
    venue: 'Shimla Resort',
    dressCode: 'Royal Traditional / Modest Luxury',
    directionsUrl: 'https://maps.app.goo.gl/oNb7LC2ZuKpFT9b7A?g_st=ac',
    couplePhoto: getAssetPath('assets/page 2(oct 29).png'),
    caricatureImage: getAssetPath('assets/page 2(oct 29).png'),
    caricatureBadge: 'Basit Ali and Ambiya Basher · Sacred Rukhsati 🕊️',
    fullCardImage: getAssetPath('assets/page 2(oct 29).png'),
    cardImageCandidates: [
      getAssetPath('assets/page 2(oct 29).png'),
      getAssetPath('assets/page 2(oct 29).webp'),
      getAssetPath('assets/function-1-rukhsati.png'),
    ],
  },
  {
    title: 'Wedding Reception',
    arabicTitle: 'وليمة العرس المباركة',
    description: 'The joyous feast and grand evening banquet honoring family and dear friends to celebrate the newlyweds.',
    day: 'FRI',
    date: 'October 30, 2026',
    subtitle: 'A Blessed Feast & Grand Celebration',
    dayOfWeek: 'Friday',
    dayOfMonth: '30',
    monthName: 'October',
    year: '2026',
    time: '07:30 PM Onwards',
    venue: 'Hotel Ramada',
    dressCode: 'Formal Evening Elegance',
    directionsUrl: 'https://maps.app.goo.gl/VC1HVfJNPzLf7CNy9',
    couplePhoto: getAssetPath('assets/page3( 30 oct).png'),
    caricatureImage: getAssetPath('assets/page3( 30 oct).png'),
    caricatureBadge: 'Basit Ali and Ambiya Basher · Wedding Reception 👑',
    fullCardImage: getAssetPath('assets/page3( 30 oct).png'),
    cardImageCandidates: [
      getAssetPath('assets/page3( 30 oct).png'),
      getAssetPath('assets/page3( 30 oct).webp'),
      getAssetPath('assets/function-2-ramada.png'),
    ],
  },
  {
    title: 'Wedding Reception',
    arabicTitle: 'وليمة العرس المباركة',
    description: 'The joyous feast and grand evening banquet honoring family and dear friends to celebrate the newlyweds.',
    day: 'MON',
    date: 'November 2, 2026',
    subtitle: 'A Blessed Feast & Grand Celebration',
    dayOfWeek: 'Monday',
    dayOfMonth: '2',
    monthName: 'November',
    year: '2026',
    time: '07:30 PM Onwards',
    venue: 'Radiant Resorts Gorakhpur',
    dressCode: 'Formal Evening Elegance',
    directionsUrl: 'https://maps.app.goo.gl/YeqWGNYWq3HWQegm9',
    couplePhoto: getAssetPath('assets/page 4 (2 Nov).png'),
    caricatureImage: getAssetPath('assets/page 4 (2 Nov).png'),
    caricatureBadge: 'Basit Ali and Ambiya Basher · Wedding Reception 👑',
    fullCardImage: getAssetPath('assets/page 4 (2 Nov).png'),
    cardImageCandidates: [
      getAssetPath('assets/page 4 (2 Nov).png'),
      getAssetPath('assets/page 4 (2 Nov).webp'),
      getAssetPath('assets/function-3-radiant.png'),
    ],
  }
];

export default function App() {
  const [opened, setOpened] = useState(false);
  const [opening, setOpening] = useState(false);
  const [shouldPlayAudio, setShouldPlayAudio] = useState(false);
  const [dateRevealed, setDateRevealed] = useState(false);
  const [showAdminExcel, setShowAdminExcel] = useState(false);
  const [isAdminMode, setIsAdminMode] = useState(false);

  // Dynamic guest invitation parameters (?guest=Name&f=1,2)
  const [invitedFunctionIds, setInvitedFunctionIds] = useState<number[]>(() =>
    parseInvitedFunctionIds(typeof window !== 'undefined' ? window.location.search : '')
  );
  const [guestName, setGuestName] = useState<string>(() =>
    parseGuestName(typeof window !== 'undefined' ? window.location.search : '')
  );

  // Filter events schedule according to invited functions (1: Rukhsati, 2: Ramada, 3: Radiant)
  const visibleEventsSchedule = EVENTS_SCHEDULE.filter((_, idx) =>
    invitedFunctionIds.includes(idx + 1)
  );

  // Compute countdown target and scratch card text based on the earliest invited function
  const primaryFunction =
    ALL_FUNCTIONS.find((f) => invitedFunctionIds.includes(f.id)) || ALL_FUNCTIONS[0];
  const targetTimestamp = primaryFunction.timestamp;
  const scratchDateText = `${primaryFunction.dayOfMonth}${
    primaryFunction.dayOfMonth === '2' ? 'nd' : 'th'
  } ${primaryFunction.monthName} ${primaryFunction.year}`;
  const scratchEventLabel = `${primaryFunction.title} Mubarak · ${primaryFunction.dayOfWeek} (${primaryFunction.venue.split(' ')[0]})`;

  const [checkInScanInfo, setCheckInScanInfo] = useState<{
    passId: string;
    guestName: string;
    guestCount: number;
    events: string[];
    synced?: boolean;
    timestamp?: string;
    matchedRecord?: RsvpRecord | null;
    checkedInMap?: Record<string, string>;
    loadingEvent?: string | null;
    admitSuccessMsg?: string | null;
  } | null>(null);

  const [isUsherDeskUnlocked, setIsUsherDeskUnlocked] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const p = new URLSearchParams(window.location.search);
        if (
          p.get('admin') === 'rsvp' ||
          p.get('host') === 'rsvp' ||
          p.get('usher') === '2026' ||
          p.get('usher') === 'true'
        ) {
          return true;
        }
        return sessionStorage.getItem('wedding_usher_unlocked') === 'true';
      } catch {
        return false;
      }
    }
    return false;
  });

  const [showUsherPinModal, setShowUsherPinModal] = useState(false);
  const [usherPinInput, setUsherPinInput] = useState('');
  const [usherPinError, setUsherPinError] = useState<string | null>(null);
  const [showHostScanner, setShowHostScanner] = useState<boolean>(false);

  const handleUnlockUsherDesk = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = usherPinInput.trim().toLowerCase();
    if (cleanPin === '2026' || cleanPin === 'rsvp' || cleanPin === 'admin' || cleanPin === 'basit') {
      setIsUsherDeskUnlocked(true);
      setIsAdminMode(true);
      setShowUsherPinModal(false);
      setUsherPinInput('');
      setUsherPinError(null);
      try {
        sessionStorage.setItem('wedding_usher_unlocked', 'true');
      } catch {}
    } else {
      setUsherPinError('Incorrect Host/Usher PIN. Please enter 2026.');
    }
  };

  const handleLockUsherDesk = () => {
    setIsUsherDeskUnlocked(false);
    try {
      sessionStorage.removeItem('wedding_usher_unlocked');
    } catch {}
  };

  useEffect(() => {
    // Check if URL is a check-in scan from QR code
    if (typeof window !== 'undefined' && window.location?.search) {
      try {
        const p = new URLSearchParams(window.location.search);
        const checkinParam = p.get('checkin') || p.get('check_in') || p.get('verify') || '';
        const rawPass = p.get('pass') || p.get('passId') || p.get('pass_id') || p.get('p') || '';
        const rawName = p.get('name') || p.get('guest') || p.get('guest_name') || p.get('n') || '';

        const isCheckinScan =
          checkinParam.toLowerCase() === 'verified' ||
          checkinParam.toLowerCase() === 'true' ||
          checkinParam.toLowerCase() === 'yes' ||
          (rawPass.trim().length > 0 && rawName.trim().length > 0);

        if (isCheckinScan) {
          const passId = decodeURIComponent(rawPass || 'BA-VERIFIED').trim();
          const guestNameDecoded = decodeURIComponent(rawName || 'Honored Guest').trim();
          
          const rawGuests = p.get('guests') || p.get('count') || p.get('guest_count') || p.get('g') || '1';
          const parsedGuests = parseInt(rawGuests.replace(/[^0-9]/g, '') || '1', 10);
          const guestCount = isNaN(parsedGuests) || parsedGuests <= 0 ? 1 : parsedGuests;

          const eventsRaw = p.get('events') || p.get('e') || p.get('ceremonies') || '';
          const decodedEvents = decodeURIComponent(eventsRaw);
          const events = decodedEvents
            ? decodedEvents.split(/[|,]/).map((s) => s.trim()).filter(Boolean)
            : ['Wedding Celebrations'];

          // Look up existing check-in status from stored records if already available
          const stored = getStoredRsvps();
          const match = stored.find(
            (r) =>
              (r.checked_in_pass_id && r.checked_in_pass_id.toLowerCase() === passId.toLowerCase()) ||
              (r.guest_name && r.guest_name.toLowerCase() === guestNameDecoded.toLowerCase())
          );

          const existingCheckedInMap: Record<string, string> = { ...(match?.checked_in_events_map || {}) };
          if (match?.checked_in_events && match.checked_in_events.length > 0) {
            match.checked_in_events.forEach((ev) => {
              existingCheckedInMap[normalizeEventName(ev)] = existingCheckedInMap[normalizeEventName(ev)] || match.checked_in_at || new Date().toISOString();
            });
          }

          const scanPayload = {
            passId,
            guestName: guestNameDecoded,
            guestCount,
            events: events.length > 0 ? events : ['Wedding Celebrations'],
            synced: Boolean(match?.checked_in),
            timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            matchedRecord: match || null,
            checkedInMap: existingCheckedInMap,
            loadingEvent: null,
            admitSuccessMsg: null,
          };

          setCheckInScanInfo(scanPayload);
        }
      } catch (err) {
        console.warn('QR checkin parsing safe fallback:', err);
      }
    }
  }, []);

  const handleAdmitSpecificEvent = async (eventName: string) => {
    if (!checkInScanInfo) return;
    setCheckInScanInfo((prev) => (prev ? { ...prev, loadingEvent: eventName } : null));

    try {
      const res = await recordGuestCheckIn({
        passId: checkInScanInfo.passId,
        guestName: checkInScanInfo.guestName,
        guestCount: checkInScanInfo.guestCount,
        events: checkInScanInfo.events,
        specificEvent: eventName,
      });

      setCheckInScanInfo((prev) =>
        prev
          ? {
              ...prev,
              matchedRecord: res.record,
              checkedInMap: res.record.checked_in_events_map || {},
              synced: true,
              loadingEvent: null,
              admitSuccessMsg: `Guest admitted to "${eventName}"!`,
            }
          : null
      );

      confetti({
        particleCount: 65,
        spread: 70,
        origin: { y: 0.4 },
        colors: ['#10b981', '#c5a059', '#1b4332', '#e4c88a'],
      });
    } catch (e: any) {
      console.warn('Admit event error:', e);
      setCheckInScanInfo((prev) => (prev ? { ...prev, loadingEvent: null } : null));
    }
  };

  const handleAdmitAllEvents = async () => {
    if (!checkInScanInfo) return;
    setCheckInScanInfo((prev) => (prev ? { ...prev, loadingEvent: 'all' } : null));

    try {
      const res = await recordGuestCheckIn({
        passId: checkInScanInfo.passId,
        guestName: checkInScanInfo.guestName,
        guestCount: checkInScanInfo.guestCount,
        events: checkInScanInfo.events,
        checkInAll: true,
      });

      setCheckInScanInfo((prev) =>
        prev
          ? {
              ...prev,
              matchedRecord: res.record,
              checkedInMap: res.record.checked_in_events_map || {},
              synced: true,
              loadingEvent: null,
              admitSuccessMsg: 'Guest admitted for all invited celebrations!',
            }
          : null
      );

      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.4 },
        colors: ['#10b981', '#c5a059', '#93203c', '#e4c88a'],
      });
    } catch (e: any) {
      console.warn('Admit all events error:', e);
      setCheckInScanInfo((prev) => (prev ? { ...prev, loadingEvent: null } : null));
    }
  };

  const [verificationQrDataUrl, setVerificationQrDataUrl] = useState<string>('');
  const [copiedPassLink, setCopiedPassLink] = useState<boolean>(false);
  const [generatingQr, setGeneratingQr] = useState<boolean>(false);

  // Generate QR code for the current guest verification payload
  useEffect(() => {
    if (!checkInScanInfo) {
      setVerificationQrDataUrl('');
      return;
    }

    let isMounted = true;
    setGeneratingQr(true);

    let baseUrl = 'https://basit-ambiya.wedding/';
    if (typeof window !== 'undefined') {
      try {
        const cur = new URL(window.location.href);
        baseUrl = `${cur.origin}${cur.pathname}`;
      } catch {
        baseUrl = `${window.location.origin}${window.location.pathname || '/'}`;
      }
    }

    const params = new URLSearchParams();
    params.set('checkin', 'verified');
    params.set('pass', checkInScanInfo.passId || 'BA-PASS');
    params.set('name', checkInScanInfo.guestName || 'Honored Guest');
    params.set('guests', String(checkInScanInfo.guestCount || 1));
    params.set('events', (checkInScanInfo.events || []).join('|'));
    params.set('t', String(Date.now()));

    const separator = baseUrl.includes('?') ? '&' : '?';
    const fullVerificationUrl = `${baseUrl}${separator}${params.toString()}`;

    QRCode.toDataURL(fullVerificationUrl, {
      width: 420,
      margin: 1.5,
      color: {
        dark: '#1b4332', // Royal forest green
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        if (isMounted) {
          setVerificationQrDataUrl(url);
          setGeneratingQr(false);
        }
      })
      .catch((err) => {
        console.warn('QR code generation failed for verification modal:', err);
        if (isMounted) setGeneratingQr(false);
      });

    return () => {
      isMounted = false;
    };
  }, [checkInScanInfo]);

  const handleCopyPassLink = () => {
    if (!checkInScanInfo) return;
    let baseUrl = window.location.origin + window.location.pathname;
    const params = new URLSearchParams();
    params.set('checkin', 'verified');
    params.set('pass', checkInScanInfo.passId || 'BA-PASS');
    params.set('name', checkInScanInfo.guestName || 'Honored Guest');
    params.set('guests', String(checkInScanInfo.guestCount || 1));
    params.set('events', (checkInScanInfo.events || []).join('|'));
    params.set('t', String(Date.now()));
    const fullUrl = `${baseUrl}?${params.toString()}`;

    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopiedPassLink(true);
      setTimeout(() => setCopiedPassLink(false), 3000);
    }).catch(() => {});
  };

  const handleDownloadQrImage = () => {
    if (!verificationQrDataUrl || !checkInScanInfo) return;
    const link = document.createElement('a');
    link.href = verificationQrDataUrl;
    link.download = `VIP-Pass-${(checkInScanInfo.guestName || 'Guest').replace(/[^a-zA-Z0-9]/g, '-')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    // Secret trigger for host only: ?admin=rsvp
    if (typeof window !== 'undefined' && window.location?.search) {
      const p = new URLSearchParams(window.location.search);
      if (p.get('admin') === 'rsvp' || p.get('host') === 'rsvp') {
        setIsAdminMode(true);
        setShowAdminExcel(true);
      }
    }

    // Secret keyboard shortcut: Ctrl+Shift+E
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'E' || e.key === 'e')) {
        e.preventDefault();
        setIsAdminMode(true);
        setShowAdminExcel((prev) => !prev);
      }
    };

    const handleOpenManager = () => {
      setIsAdminMode(true);
      setShowAdminExcel(true);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('open_rsvp_excel_manager', handleOpenManager);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('open_rsvp_excel_manager', handleOpenManager);
    };
  }, []);

  useEffect(() => {
    document.title = 'Basit Ali and Ambiya Basher — Wedding Invitation · October 2026';
    const metaDesc =
      document.querySelector('meta[name="description"]') ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m;
      })();
    metaDesc.setAttribute(
      'content',
      'Join Basit Ali and Ambiya Basher for their sacred Rukhsati & wedding celebrations on Thursday, 29 October 2026.'
    );
  }, []);

  const handleOpen = () => {
    setOpening(true);
    setShouldPlayAudio(true);
    setTimeout(() => {
      setOpened(true);
    }, 320);
  };

  return (
    <div className="relative min-h-screen bg-cream selection:bg-rose-100 selection:text-rose-900">
      {/* Floating Rose Petals Animation */}
      <FloatingPetals count={28} />

      {/* Background Audio with toggle control */}
      <MusicPlayer play={shouldPlayAudio || opening || opened} />

      {/* Main Wedding Invitation Page - pre-mounted for instant zero-latency display */}
      <main className="relative bg-cream">
        {/* Invitation Suite Section - Clean presentation without background distractions */}
  
        <section className="relative w-full pt-4 sm:pt-10 pb-12 sm:pb-16 flex flex-col items-center justify-center px-1 sm:px-4 md:px-6 select-none border-b border-gold-soft/30">
          {/* Page 1 (Prelude: #BasitGotAmbitious Floral Swing - Constant for all functions) */}
          <AnimatedSection direction="up" durationMs={700}>
            <InvitationPageCard
              pageLabel="Wedding Suite · Page 1"
              pageTitle="#BasitGotAmbitious — Sacred Prelude & Blessing"
              defaultFilename="Basti&Ambiya11.webp"
              candidateFilenames={[
                'Basti&Ambiya11.webp',
              ]}
              altText="Basit Ali and Ambiya Basher — Wedding Suite Prelude Page"
              storageKey="suite_page_0"
            />
          </AnimatedSection>

          {/* Page 2 (Main Invitation: With Love, Joy & Gratitude - Constant for all functions) */}
          <AnimatedSection direction="up" durationMs={700} delayMs={150}>
            <InvitationPageCard
              pageLabel="Wedding Suite · Page 2"
              pageTitle="With Love, Joy & Gratitude — Basit & Ambiya"
              defaultFilename="page 1.webp"
              candidateFilenames={[
                'page 1.webp',
                'page 1.png',
                'function-all.png',
                'page1.png',
                'page 1.jpg',
                'page 1.jpeg',
              ]}
              altText="Basit Ali and Ambiya Basher — Sacred Wedding Invitation"
              storageKey="suite_page_1"
            />
          </AnimatedSection>
        </section>

          {/* Scratch Card & Countdown Section */}
          <section className="relative pt-10 pb-12 px-6 bg-[#faf6f0] border-t border-gold-soft/30 overflow-hidden">
            <IslamicPatternOverlay opacity={0.03} />
            <FloralCornerAccents />
            <div className="relative max-w-3xl mx-auto text-center z-10">
              <AnimatedSection direction="up" durationMs={650}>
                <FlowerDivider />
                <div className="mb-6">
                  <ScratchCard
                    revealed={dateRevealed}
                    onRevealed={() => setDateRevealed(true)}
                    dateText={scratchDateText}
                    eventLabel={scratchEventLabel}
                  />
                </div>
              </AnimatedSection>
              <div
                className={`transition-all duration-700 ${
                  dateRevealed
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden'
                }`}
                aria-hidden={!dateRevealed}
              >
                <CountdownTimer
                  targetTimestamp={targetTimestamp}
                  eventLabel={scratchEventLabel}
                />
              </div>
            </div>
          </section>

          {/* Wedding Invitation Film Section (Before Event Schedule) */}
          <WeddingVideoSection />

          {/* Events Schedule Section */}
          <section className="relative pt-12 pb-16 px-6 bg-gradient-to-b from-[#1b4332]/5 via-[#faf6f0] to-[#1b4332]/5 border-y border-gold-soft/40 overflow-hidden">
            <IslamicPatternOverlay opacity={0.05} />
            <FloralCornerAccents />
            <div className="relative max-w-7xl mx-auto z-10">
              <AnimatedSection direction="up" durationMs={650}>
                <div className="text-center mb-10">
                  <p className="font-cinzel text-xs text-[#1b4332] tracking-widest font-bold uppercase">
                    SACRED CELEBRATIONS &amp; CEREMONIES
                  </p>
                  <h2 className="font-script text-5xl sm:text-6xl text-rose-deep mt-2">
                    Events Schedule
                  </h2>
                  <FlowerDivider />
                </div>
              </AnimatedSection>
              <div
                className={`gap-8 mx-auto items-stretch ${
                  visibleEventsSchedule.length === 1
                    ? 'flex justify-center max-w-md'
                    : visibleEventsSchedule.length === 2
                    ? 'grid grid-cols-1 md:grid-cols-2 max-w-4xl'
                    : 'grid grid-cols-1 md:grid-cols-3 max-w-7xl'
                }`}
              >
                {visibleEventsSchedule.map((event, idx) => (
                  <AnimatedSection
                    key={`${event.title}-${event.date}-${event.venue}`}
                    direction={idx === 1 ? 'up' : idx === 0 ? 'right' : 'left'}
                    delayMs={idx * 150}
                    durationMs={700}
                    className="w-full flex"
                  >
                    <EventCard {...event} />
                  </AnimatedSection>
                ))}
              </div>
            </div>
          </section>

          {/* Guest Book & RSVP Wishes Section (Replaces Cherished Moments photo frames) */}
          <RsvpWishesSection isAdmin={isAdminMode} />

          {/* Awaiting your noble presence Section */}
          <section className="relative py-24 px-6 bg-cream text-center overflow-hidden">
            <IslamicPatternOverlay opacity={0.03} />
            <FloralCornerAccents />
            <div className="relative max-w-2xl mx-auto z-10">
              <AnimatedSection direction="up" durationMs={700}>
                <h2 className="font-script text-5xl sm:text-6xl text-rose-deep">
                  <span className="font-script-capital-a">A</span>waiting your noble presence &amp; Duas
                </h2>
                <FlowerDivider />
                <p className="font-serif-display italic text-lg sm:text-xl text-foreground/80 leading-relaxed">
                  May Allah (SWT) shower His infinite blessings, love, and peace upon this blessed union.
                  <br />
                  We humbly look forward to sharing this momentous day in your gracious company.
                </p>
              </AnimatedSection>
            </div>
          </section>

          {/* RSVP Section */}
          <section id="rsvp" className="relative py-20 px-6 bg-cream border-t border-gold-soft/30 overflow-hidden">
            <IslamicPatternOverlay opacity={0.04} />
            <FloralCornerAccents />
            <div className="relative max-w-2xl mx-auto z-10">
              <AnimatedSection direction="up" durationMs={650}>
                <div className="text-center">
                  <p className="font-cinzel text-xs text-[#1b4332] tracking-widest font-bold uppercase">
                    KINDLY RESPOND
                  </p>
                  <h2 className="font-script text-5xl sm:text-6xl text-rose-deep mt-2">
                    RSVP
                  </h2>
                  <FlowerDivider />
                  <p className="font-serif-display italic text-foreground/80 mb-8">
                    Please let us know by 15th October 2026.
                  </p>
                </div>
              </AnimatedSection>

              <AnimatedSection direction="zoom" delayMs={150} durationMs={750}>
                <RsvpForm
                  invitedFunctionIds={invitedFunctionIds}
                  initialGuestName={guestName}
                />
              </AnimatedSection>
            </div>
          </section>

          {/* The Families Section */}
          <FamilySection />

          {/* Footer Section */}
          <Footer />

          {/* Interactive Floating Blossom Prompt Widget */}
          <aside aria-label="Floral interaction prompt" className="fixed bottom-6 left-6 z-40 hidden sm:flex items-center gap-2.5 bg-white/90 backdrop-blur-md border border-gold-soft/70 px-4 py-2 rounded-full shadow-lg transition-all duration-300 hover:bg-white select-none">
            <BlossomingFlower size="sm" colorTheme="rose" title="Click to blossom flower 🌸" />
            <span className="font-cinzel text-[11px] text-[#1b4332] font-semibold tracking-wide">
              Tap any floral accent to blossom 🌸
            </span>
          </aside>

          {/* Floating RSVP Action Button at Bottom Right */}
          <FloatingRsvpButton targetId="rsvp" />
        </main>

      {/* Envelope / Video Intro Overlay */}
      {!opened && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-400 ease-out ${
            opening ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <IntroVideo
            onOpen={handleOpen}
            opening={opening}
            opened={opened}
            onStartPlay={() => setShouldPlayAudio(true)}
          />
        </div>
      )}

      {/* Private Admin Excel & GitHub Manager (Triggered only via ?admin=rsvp or Ctrl+Shift+E) */}
      {showAdminExcel && (
        <RsvpExcelManager
          isOpen={showAdminExcel}
          onClose={() => setShowAdminExcel(false)}
        />
      )}

      {/* Floating Host Quick-Toggle (Visible ONLY in Admin Mode when URL has ?admin=rsvp) */}
      {isAdminMode && !showAdminExcel && (
        <button
          type="button"
          onClick={() => setShowAdminExcel(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-stone-900/95 hover:bg-stone-900 text-[#f5efe6] text-xs font-cinzel tracking-wider uppercase font-bold shadow-2xl border-2 border-gold-soft cursor-pointer transition-all hover:scale-105"
          title="Click to open host RSVP registry & Excel manager"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Host RSVP Panel (?admin=rsvp)</span>
        </button>
      )}

      {/* Venue Check-in Verification Popup when QR is Scanned */}
      {checkInScanInfo && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          {/* 1. HOST / USHER DESK MODE (When Host PIN or ?admin=rsvp is active) */}
          {isUsherDeskUnlocked || isAdminMode ? (
            <div className="relative w-full max-w-lg bg-gradient-to-b from-[#fdfbf7] via-[#faf5ed] to-[#f4eee4] border-2 border-emerald-600 rounded-3xl p-5 sm:p-7 shadow-2xl text-center space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Header Badge */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-600 to-[#1b4332] text-white flex items-center justify-center mx-auto shadow-lg border-2 border-emerald-400">
                <span className="text-2xl font-bold">🏛️</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-400 font-cinzel text-xs font-bold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                <span>Host / Usher Admission Desk</span>
              </div>

              <div>
                <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-emerald-950 uppercase tracking-wide">
                  {checkInScanInfo.guestName}
                </h3>
                <p className="font-serif-display italic text-xs sm:text-sm text-foreground/75 mt-1">
                  Select function below to record entry &amp; update live RSVP Excel sheet.
                </p>
              </div>

              {/* Success Alert Banner */}
              {checkInScanInfo.admitSuccessMsg && (
                <div className="p-2.5 rounded-xl bg-emerald-100/95 border border-emerald-500 text-emerald-950 text-xs font-cinzel font-bold flex items-center justify-center gap-2 animate-bounce-short">
                  <span>✓</span>
                  <span>{checkInScanInfo.admitSuccessMsg}</span>
                </div>
              )}

              {/* Live RSVP Excel Status */}
              <div className="bg-white/95 rounded-2xl p-3.5 border border-gold-soft/60 shadow-xs space-y-2 text-left text-xs font-serif-display">
                <div className="flex justify-between border-b border-gold-soft/30 pb-1.5">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">Pass ID</span>
                  <span className="font-mono font-bold text-emerald-900">{checkInScanInfo.passId}</span>
                </div>
                <div className="flex justify-between border-b border-gold-soft/30 pb-1.5">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">Party Size</span>
                  <span className="font-bold text-foreground">
                    {checkInScanInfo.guestCount} {checkInScanInfo.guestCount === 1 ? 'Guest' : 'Guests'} Admitted
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">Live RSVP Excel</span>
                  <span className="inline-flex items-center gap-1.5 font-bold text-emerald-800">
                    <span className={`w-2 h-2 rounded-full ${checkInScanInfo.synced ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span>{checkInScanInfo.synced ? 'Auto-Synced to Excel ✅' : 'Ready for Check-In'}</span>
                  </span>
                </div>
              </div>

              {/* ⚡ ONE-TAP QUICK ADMIT ALL EVENTS HERO BUTTON */}
              <button
                type="button"
                disabled={Boolean(checkInScanInfo.loadingEvent)}
                onClick={handleAdmitAllEvents}
                className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-105 text-stone-950 font-cinzel text-xs sm:text-sm font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer border-2 border-amber-600 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <span>⚡</span>
                <span>
                  {checkInScanInfo.loadingEvent === 'all'
                    ? 'Admitting All Ceremonies...'
                    : `Quick Check-In (Admit All ${checkInScanInfo.events.length} Events)`}
                </span>
              </button>

              {/* Per-Ceremony Check-In Controls */}
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between px-1">
                  <span className="font-cinzel text-[11px] text-foreground/70 uppercase font-bold tracking-wider">
                    Ceremonies &amp; Gate Admission
                  </span>
                  <span className="text-[10px] font-cinzel text-emerald-900 bg-emerald-100/80 px-2 py-0.5 rounded-full font-bold">
                    {checkInScanInfo.events.length} {checkInScanInfo.events.length === 1 ? 'Function' : 'Functions'}
                  </span>
                </div>

                <div className="space-y-2">
                  {checkInScanInfo.events.map((rawEv, idx) => {
                    const normName = normalizeEventName(rawEv);
                    const isCheckedIn = Boolean(
                      checkInScanInfo.checkedInMap &&
                      (checkInScanInfo.checkedInMap[normName] || checkInScanInfo.checkedInMap[rawEv])
                    );

                    const checkInTime =
                      checkInScanInfo.checkedInMap?.[normName] ||
                      checkInScanInfo.checkedInMap?.[rawEv];

                    const isLoadingThis = checkInScanInfo.loadingEvent === rawEv || checkInScanInfo.loadingEvent === 'all';

                    return (
                      <div
                        key={idx}
                        className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          isCheckedIn
                            ? 'bg-emerald-50/90 border-emerald-400 shadow-xs'
                            : 'bg-white/95 border-gold-soft/70 hover:border-emerald-600 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${isCheckedIn ? 'bg-emerald-600' : 'bg-amber-400 animate-pulse'}`} />
                            <h4 className="font-cinzel font-bold text-xs sm:text-sm text-foreground">
                              {rawEv}
                            </h4>
                          </div>
                          <p className="text-[11px] font-serif-display pl-4.5">
                            {isCheckedIn ? (
                              <span className="text-emerald-800 font-semibold inline-flex items-center gap-1">
                                <span>✓</span>
                                <span>Admitted: {formatDateTime(checkInTime)}</span>
                              </span>
                            ) : (
                              <span className="text-amber-800 font-medium">
                                ⏳ Awaiting Admission • Click button to admit
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5 pl-4.5 sm:pl-0">
                          {isCheckedIn ? (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-cinzel font-bold uppercase bg-emerald-700 text-white shadow-2xs">
                              <span>Admitted ✓</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              disabled={isLoadingThis}
                              onClick={() => handleAdmitSpecificEvent(rawEv)}
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-cinzel font-bold uppercase tracking-wider bg-gradient-to-r from-emerald-800 to-[#1b4332] hover:brightness-110 text-white shadow-md cursor-pointer transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
                            >
                              {isLoadingThis ? (
                                <>
                                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Recording...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨</span>
                                  <span>Check In &amp; Admit</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setCheckInScanInfo(null);
                    setShowHostScanner(true);
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-gradient-to-r from-blue-700 via-indigo-700 to-[#1b4332] hover:brightness-110 text-white font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                >
                  <span className="text-base">📷</span>
                  <span>Scan Next Guest / Google Lens</span>
                </button>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {checkInScanInfo.events.length > 1 && (
                    <button
                      type="button"
                      disabled={Boolean(checkInScanInfo.loadingEvent)}
                      onClick={handleAdmitAllEvents}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs disabled:opacity-50"
                    >
                      {checkInScanInfo.loadingEvent === 'all' ? 'Admitting All...' : '🎟️ Admit for All Functions'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setCheckInScanInfo(null)}
                    className={`w-full py-2.5 px-3 rounded-xl font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer ${
                      checkInScanInfo.events.length > 1
                        ? 'bg-stone-800 hover:bg-stone-900 text-white'
                        : 'col-span-2 bg-gradient-to-r from-stone-800 to-stone-900 text-white py-3'
                    }`}
                  >
                    Done / Close
                  </button>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-gold-soft/30 px-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      setCheckInScanInfo(null);
                      setShowAdminExcel(true);
                    }}
                    className="font-cinzel font-bold text-emerald-900 hover:text-emerald-950 underline cursor-pointer"
                  >
                    Open Host RSVP Registry &amp; Excel Sheet →
                  </button>
                  <button
                    type="button"
                    onClick={handleLockUsherDesk}
                    className="text-stone-500 hover:text-stone-800 font-cinzel text-[10px] underline cursor-pointer"
                  >
                    Lock Usher Desk 🔒
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* 2. GUEST VERIFICATION & DIGITAL PASS VIEW (No Self Check-In) */
            <div className="relative w-full max-w-lg bg-gradient-to-b from-[#fdfbf7] via-[#faf5ed] to-[#f4eee4] border-2 border-gold rounded-3xl p-5 sm:p-7 shadow-2xl text-center space-y-4 max-h-[92vh] overflow-y-auto">
              {/* Header Badge */}
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#c5a059] to-[#8c6b2d] text-white flex items-center justify-center mx-auto shadow-lg border-2 border-[#e4c88a]">
                <span className="text-2xl font-bold">👑</span>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-amber-100/80 text-amber-950 border border-amber-300 font-cinzel text-xs font-bold uppercase tracking-wider">
                <span>VIP Wedding Guest Pass</span>
              </div>

              <div>
                <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-foreground uppercase tracking-wide">
                  {checkInScanInfo.guestName}
                </h3>
                <p className="font-serif-display italic text-xs sm:text-sm text-foreground/75 mt-1">
                  Official digital entry pass for the wedding celebrations of Basit &amp; Ambiya.
                </p>
              </div>

              {/* QR Code Container */}
              <div className="relative mx-auto w-56 sm:w-60 p-3.5 bg-white rounded-2xl border-2 border-gold-soft/80 shadow-md flex flex-col items-center space-y-2">
                {/* Decorative Frame Corners */}
                <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-gold" />
                <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-gold" />
                <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-gold" />
                <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-gold" />

                {verificationQrDataUrl ? (
                  <div className="p-1.5 bg-white rounded-xl">
                    <img
                      src={verificationQrDataUrl}
                      alt={`QR Code Pass for ${checkInScanInfo.guestName}`}
                      className="w-48 h-48 sm:w-52 sm:h-52 object-contain mx-auto"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs font-cinzel text-stone-500">
                    <span className="animate-pulse">Generating Secure QR...</span>
                  </div>
                )}

                <div className="text-center pt-0.5">
                  <span className="inline-flex items-center gap-1 font-cinzel text-[10px] font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span>🎟️</span> Show at Venue Entrance
                  </span>
                  <p className="font-mono text-[10px] text-foreground/60 mt-1 font-bold">
                    {checkInScanInfo.passId}
                  </p>
                </div>
              </div>

              {/* Quick Pass Actions (Copy Link & Save Image) */}
              <div className="grid grid-cols-2 gap-2 max-w-xs mx-auto">
                <button
                  type="button"
                  onClick={handleCopyPassLink}
                  className="py-2 px-3 rounded-xl border border-gold text-stone-800 bg-white/80 hover:bg-gold-soft/30 font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5"
                >
                  <span>{copiedPassLink ? '✓' : '📋'}</span>
                  <span>{copiedPassLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDownloadQrImage}
                  disabled={!verificationQrDataUrl}
                  className="py-2 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-cinzel text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-2xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <span>💾</span>
                  <span>Save QR</span>
                </button>
              </div>

              {/* Guest Details Overview */}
              <div className="bg-white/95 rounded-2xl p-4 border border-gold-soft/60 shadow-xs space-y-2.5 text-left text-xs font-serif-display">
                <div className="flex justify-between border-b border-gold-soft/30 pb-2">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">VIP Pass ID</span>
                  <span className="font-mono font-bold text-emerald-900 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    {checkInScanInfo.passId}
                  </span>
                </div>
                <div className="flex justify-between border-b border-gold-soft/30 pb-2">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">Admitted Party Size</span>
                  <span className="font-bold text-foreground">
                    {checkInScanInfo.guestCount} {checkInScanInfo.guestCount === 1 ? 'Guest' : 'Guests'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-cinzel text-foreground/60 uppercase text-[11px] font-semibold">Pass Status</span>
                  <span className="inline-flex items-center gap-1 font-bold text-emerald-800">
                    <span>✓ Verified &amp; Active</span>
                  </span>
                </div>
              </div>

              {/* Authorized Ceremonies List */}
              <div className="space-y-2 text-left">
                <span className="font-cinzel text-[11px] text-foreground/70 uppercase font-bold tracking-wider block px-1">
                  Invited Wedding Ceremonies:
                </span>
                <div className="space-y-1.5">
                  {checkInScanInfo.events.map((rawEv, idx) => {
                    const normName = normalizeEventName(rawEv);
                    const isCheckedIn = Boolean(
                      checkInScanInfo.checkedInMap &&
                      (checkInScanInfo.checkedInMap[normName] || checkInScanInfo.checkedInMap[rawEv])
                    );
                    const checkInTime =
                      checkInScanInfo.checkedInMap?.[normName] ||
                      checkInScanInfo.checkedInMap?.[rawEv];

                    return (
                      <div
                        key={idx}
                        className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                          isCheckedIn
                            ? 'bg-emerald-50/80 border-emerald-300'
                            : 'bg-white/90 border-gold-soft/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${isCheckedIn ? 'bg-emerald-600' : 'bg-amber-400'}`} />
                          <span className="font-cinzel font-bold text-xs text-foreground">
                            {rawEv}
                          </span>
                        </div>
                        <span className="text-[11px] font-serif-display font-medium">
                          {isCheckedIn ? (
                            <span className="text-emerald-800 font-semibold">
                              ✅ Admitted ({formatDateTime(checkInTime)})
                            </span>
                          ) : (
                            <span className="text-foreground/60 italic">
                              Show at Entrance Gate
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security & Gate Admission Instructions */}
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 text-left text-xs font-serif-display space-y-1">
                <div className="flex items-center gap-1.5 font-cinzel font-bold text-amber-950 text-[11px]">
                  <span>🛡️</span>
                  <span>Entrance Gate Notice</span>
                </div>
                <p className="text-amber-900/90 leading-relaxed text-[11px]">
                  Please present this pass on your phone upon arrival at the venue. Gate ushers and hosts will scan and process your entry check-in.
                </p>
              </div>

              {/* Guest Action Buttons */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCheckInScanInfo(null)}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-800 to-[#1b4332] hover:brightness-110 text-white font-cinzel text-xs font-bold uppercase tracking-wider transition-all shadow-md cursor-pointer"
                >
                  Proceed to Wedding Invitation
                </button>

                {/* Subtle Gate Staff Login */}
                <button
                  type="button"
                  onClick={() => setShowUsherPinModal(true)}
                  className="text-stone-500 hover:text-stone-800 font-cinzel text-[11px] underline pt-1 cursor-pointer"
                >
                  🔐 Gate Usher / Host Check-In Desk Login
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usher PIN Authentication Modal */}
      {showUsherPinModal && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in">
          <div className="relative w-full max-w-sm bg-white border-2 border-emerald-600 rounded-3xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-900 flex items-center justify-center mx-auto border border-emerald-300">
              <span className="text-xl">🔑</span>
            </div>

            <div>
              <h3 className="font-cinzel text-lg font-bold text-emerald-950 uppercase">
                Host / Gate Usher Login
              </h3>
              <p className="font-serif-display italic text-xs text-foreground/70 mt-1">
                Enter Host PIN to unlock guest admission and check-in controls.
              </p>
            </div>

            <form onSubmit={handleUnlockUsherDesk} className="space-y-3 text-left">
              <div>
                <label className="block font-cinzel text-[11px] font-bold text-foreground/70 uppercase mb-1">
                  Host / Usher PIN (2026)
                </label>
                <input
                  type="password"
                  value={usherPinInput}
                  onChange={(e) => setUsherPinInput(e.target.value)}
                  placeholder="Enter 4-digit PIN..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 font-mono text-center tracking-widest text-lg font-bold outline-none"
                />
              </div>

              {usherPinError && (
                <p className="text-rose-700 text-xs font-serif-display text-center font-semibold">
                  {usherPinError}
                </p>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowUsherPinModal(false);
                    setUsherPinInput('');
                    setUsherPinError(null);
                  }}
                  className="py-2.5 px-3 rounded-xl border border-stone-300 text-stone-700 font-cinzel text-xs font-bold uppercase cursor-pointer hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="py-2.5 px-3 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-cinzel text-xs font-bold uppercase cursor-pointer shadow-md"
                >
                  Unlock Desk
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin QR & Google Lens Scanner Modal */}
      <AdminQrScannerModal
        isOpen={showHostScanner}
        onClose={() => setShowHostScanner(false)}
      />
    </div>
  );
}
