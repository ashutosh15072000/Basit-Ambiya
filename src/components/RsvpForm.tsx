import React, { useState, useEffect } from 'react';
import { Heart, Loader2, QrCode, Ticket, Sparkles, CheckCircle2 } from 'lucide-react';
import { FlowerDivider } from './Ornaments';
import { RsvpData } from '../types';
import { addRsvpEntry } from '../services/rsvpExcelService';
import { addWeddingWish } from '../services/wishesService';
import {
  GuestCheckInPass,
  generatePassId,
  CheckInPassData,
} from './GuestCheckInPass';

interface RsvpEventItem {
  functionId: number;
  id: string;
  label: string;
  ceremony: string;
  date: string;
}

const ALL_RSVP_EVENTS: RsvpEventItem[] = [
  {
    functionId: 1,
    id: 'Rukhsati',
    label: 'Rukhsati (Shimla Resort)',
    ceremony: 'Rukhsati',
    date: 'Thursday, 29th October 2026',
  },
  {
    functionId: 2,
    id: 'Wedding Reception - Hotel Ramada',
    label: 'Wedding Reception (Hotel Ramada)',
    ceremony: 'Reception (Hotel Ramada)',
    date: 'Friday, 30th October 2026',
  },
  {
    functionId: 3,
    id: 'Wedding Reception - Radiant Resorts',
    label: 'Wedding Reception (Radiant Resorts Gorakhpur)',
    ceremony: 'Reception (Radiant Resorts)',
    date: 'Monday, 2nd November 2026',
  },
];

interface RsvpFormProps {
  invitedFunctionIds?: number[];
  initialGuestName?: string;
}

export const RsvpForm: React.FC<RsvpFormProps> = ({
  invitedFunctionIds = [1, 2, 3],
  initialGuestName = '',
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedHasMessage, setSubmittedHasMessage] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activePass, setActivePass] = useState<CheckInPassData | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem('wedding_guest_rsvp_pass');
      if (saved) return JSON.parse(saved);
    } catch {}
    return null;
  });
  const [viewingPass, setViewingPass] = useState(false);

  const visibleEvents = ALL_RSVP_EVENTS.filter((e) =>
    invitedFunctionIds.includes(e.functionId)
  );

  const [form, setForm] = useState<RsvpData>({
    guest_name: initialGuestName,
    phone: '',
    attending: 'yes',
    guest_count: 1,
    events: visibleEvents.length === 1 ? [visibleEvents[0].id] : [],
    dietary: '',
    message: '',
  });

  // Keep guest name in sync if URL param loaded
  useEffect(() => {
    if (initialGuestName && !form.guest_name) {
      setForm((prev) => ({ ...prev, guest_name: initialGuestName }));
    }
  }, [initialGuestName]);

  // If invited functions change, ensure selected events are valid
  useEffect(() => {
    if (visibleEvents.length === 1 && form.events.length === 0) {
      setForm((prev) => ({ ...prev, events: [visibleEvents[0].id] }));
    }
  }, [invitedFunctionIds.join(',')]);

  const toggleEvent = (eventId: string, isChecked: boolean) => {
    setForm((prev) => ({
      ...prev,
      events: isChecked
        ? [...prev.events, eventId]
        : prev.events.filter((id) => id !== eventId),
    }));
  };

  const handlePreviewPass = () => {
    const name = form.guest_name.trim() || initialGuestName.trim() || 'Honored Guest';
    const previewEvents = form.events.length > 0
      ? form.events.map((evId) => {
          const ev = ALL_RSVP_EVENTS.find((e) => e.id === evId);
          return ev ? ev.label : evId;
        })
      : visibleEvents.map((e) => e.label);

    const provisionalPass: CheckInPassData = {
      passId: generatePassId(name),
      guestName: name,
      guestCount: Math.max(1, Math.min(10, form.guest_count)),
      phone: form.phone.trim() || undefined,
      events: previewEvents,
      dietary: form.dietary?.trim() || undefined,
      timestamp: Date.now(),
      verified: true,
    };
    setActivePass(provisionalPass);
    setViewingPass(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.guest_name.trim()) {
      setError('Please enter your name');
      return;
    }

    setSubmitting(true);
    setError(null);
    const hasMsg = !!(form.message && form.message.trim().length > 0);

    try {
      // Silently saves and appends to the Excel spreadsheet (wedding-rsvps.xlsx)
      // and automatically pushes/commits the updated Excel file to GitHub in the background
      await addRsvpEntry({
        guest_name: form.guest_name.trim(),
        phone: form.phone.trim() || null,
        attending: form.attending,
        guest_count: form.attending === 'yes' ? Math.max(1, Math.min(10, form.guest_count)) : 0,
        events: form.attending === 'yes' ? form.events : [],
        dietary: form.dietary?.trim() || null,
        message: form.message?.trim() || null,
      });

      // If the guest provided a heartfelt blessing or message, also save it to the public wishes JSON
      if (hasMsg && form.message) {
        try {
          await addWeddingWish({
            name: form.guest_name.trim(),
            relationOrCity: form.attending === 'yes' ? 'Attending Guest' : 'Well-wisher',
            message: form.message.trim(),
            attending: form.attending,
          });
        } catch (wishErr) {
          console.warn('Could not post wish to JSON registry:', wishErr);
        }
      }

      // Generate personalized check-in pass for attending guests
      if (form.attending === 'yes') {
        const pass: CheckInPassData = {
          passId: generatePassId(form.guest_name),
          guestName: form.guest_name.trim(),
          guestCount: Math.max(1, Math.min(10, form.guest_count)),
          phone: form.phone.trim() || undefined,
          events: form.events.map((evId) => {
            const ev = ALL_RSVP_EVENTS.find((e) => e.id === evId);
            return ev ? ev.label : evId;
          }),
          dietary: form.dietary?.trim() || undefined,
          timestamp: Date.now(),
          verified: true,
        };
        try {
          localStorage.setItem('wedding_guest_rsvp_pass', JSON.stringify(pass));
        } catch {}
        setActivePass(pass);
        setViewingPass(true);
      }

      setSubmitting(false);
      setSubmittedHasMessage(hasMsg);
      setSubmitted(true);
    } catch (err: any) {
      console.error('RSVP submission error:', err);
      setSubmitting(false);
      setError('Could not complete submission. Please try again.');
    }
  };

  // If viewing active or generated check-in pass
  if (viewingPass && activePass) {
    return (
      <div className="space-y-6 max-w-xl mx-auto">
        {submitted && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-center space-y-1.5 shadow-sm">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-800 text-white font-cinzel text-xs font-bold uppercase tracking-wider">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>RSVP Confirmed</span>
            </div>
            <h3 className="font-serif-display text-lg font-bold text-emerald-950">
              Your response has been received with gratitude!
            </h3>
            <p className="font-serif-display text-xs text-emerald-900 italic">
              Please save or screenshot your digital check-in pass below for swift entry at the venue.
            </p>
          </div>
        )}

        <GuestCheckInPass
          passData={activePass}
          onBackOrEdit={() => {
            setViewingPass(false);
          }}
          showBackOption={true}
        />

        {submittedHasMessage && (
          <div className="p-4 rounded-xl bg-amber-50/90 border border-gold-soft/80 text-sm space-y-2 text-center">
            <p className="font-serif-display italic text-[#1b4332] font-semibold">
              ✨ Your blessing &amp; Duas have also been published to the Guest Wishes section below!
            </p>
            <button
              type="button"
              onClick={() => {
                const el = document.getElementById('guest-wishes');
                el?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#93203c] via-[#a84c32] to-[#c89b3c] text-white font-cinzel text-xs uppercase font-bold tracking-wider hover:brightness-110 shadow-sm transition-all cursor-pointer"
            >
              <span>View My Message in Guest Wishes ↓</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // If submitted with attending === 'no'
  if (submitted && form.attending === 'no') {
    return (
      <div className="bg-[#faf8f5]/90 backdrop-blur-sm border border-gold-soft/60 rounded-2xl p-10 shadow-soft text-center max-w-xl mx-auto space-y-4">
        <Heart className="mx-auto h-10 w-10 text-rose-deep animate-pulse" fill="currentColor" />
        <h3 className="font-script text-4xl text-rose-deep font-semibold">Thank you!</h3>
        <FlowerDivider />
        <p className="font-serif-display italic text-foreground/80 text-base leading-relaxed">
          Your response has been received. We will deeply miss your presence, but we warmly cherish your Duas &amp; blessings!
        </p>
        {submittedHasMessage && (
          <div className="p-4 rounded-xl bg-amber-50/90 border border-gold-soft/80 text-sm space-y-2.5 my-2">
            <p className="font-serif-display italic text-[#1b4332] font-semibold">
              ✨ Your blessing &amp; Duas have been published to the Guest Wishes section!
            </p>
            <div>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('guest-wishes');
                  el?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-[#93203c] via-[#a84c32] to-[#c89b3c] text-white font-cinzel text-xs uppercase font-bold tracking-wider hover:brightness-110 shadow-sm transition-all cursor-pointer"
              >
                <span>View My Message in Guest Wishes ↓</span>
              </button>
            </div>
          </div>
        )}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              setSubmittedHasMessage(false);
              setForm({
                guest_name: '',
                phone: '',
                attending: 'yes',
                guest_count: 1,
                events: [],
                dietary: '',
                message: '',
              });
            }}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-white border border-gold-soft/80 text-foreground font-cinzel text-xs uppercase font-semibold hover:bg-amber-50/50 transition-all cursor-pointer"
          >
            Submit Another RSVP
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-[#faf8f5]/90 backdrop-blur-sm border border-gold-soft/60 rounded-2xl p-6 sm:p-10 shadow-soft text-left space-y-6 max-w-xl mx-auto"
    >
      {/* Active Pass Banner (if already confirmed) */}
      {activePass && (
        <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-300 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-800 text-white flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="font-cinzel text-xs font-bold text-emerald-950 block truncate">
                Active Check-In Pass for {activePass.guestName}
              </span>
              <span className="font-serif-display text-[11px] text-emerald-800 italic block truncate">
                Pass ID: {activePass.passId} · {activePass.guestCount} {activePass.guestCount === 1 ? 'Guest' : 'Guests'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setViewingPass(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-cinzel text-xs font-bold transition-all shadow-xs cursor-pointer shrink-0"
          >
            <Ticket className="w-3.5 h-3.5" />
            <span>View QR Pass</span>
          </button>
        </div>
      )}

      <div className="relative border-b border-gold-soft/30 pb-4 mb-2">
        <h3 className="font-cinzel text-xs tracking-[0.25em] text-rose-deep font-bold text-center uppercase">
          Guest Details &amp; Check-In RSVP
        </h3>
      </div>

      {error && (
        <div className="p-3 bg-red-100 border border-red-300 text-red-700 text-xs rounded-xl text-center">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        <div className="space-y-2">
          <label
            htmlFor="guest_name"
            className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block"
          >
            Your name *
          </label>
          <input
            id="guest_name"
            required
            maxLength={100}
            value={form.guest_name}
            onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
            placeholder="Full name"
            className="w-full bg-white/80 border border-gold-soft/60 rounded-xl px-4 py-3 font-serif-display text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold h-12 text-[#2b1f1a]"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="phone"
            className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block"
          >
            Contact number
          </label>
          <input
            id="phone"
            type="tel"
            maxLength={20}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="Contact number"
            className="w-full bg-white/80 border border-gold-soft/60 rounded-xl px-4 py-3 font-serif-display text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold h-12 text-[#2b1f1a]"
          />
        </div>
      </div>

      <div className="space-y-3 pt-2">
        <label className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block text-center">
          Will you join us?
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setForm({ ...form, attending: 'yes' })}
            className={`py-3 px-4 rounded-full font-serif-display text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 font-bold border cursor-pointer ${
              form.attending === 'yes'
                ? 'bg-[#a84c32] border-[#a84c32] text-white shadow-md'
                : 'bg-white border-gold-soft/40 text-[#a84c32] hover:bg-[#faf6f0]'
            }`}
          >
            Joyfully Accept 🎉
          </button>
          <button
            type="button"
            onClick={() => setForm({ ...form, attending: 'no' })}
            className={`py-3 px-4 rounded-full font-serif-display text-xs sm:text-sm tracking-wider uppercase transition-all duration-300 font-bold border cursor-pointer ${
              form.attending === 'no'
                ? 'bg-[#a84c32] border-[#a84c32] text-white shadow-md'
                : 'bg-white border-gold-soft/40 text-[#a84c32] hover:bg-[#faf6f0]'
            }`}
          >
            Regretfully Decline
          </button>
        </div>
      </div>

      {form.attending === 'yes' && (
        <div className="space-y-5 pt-2 animate-fade-in duration-300">
          <div className="space-y-2">
            <label
              htmlFor="guest_count"
              className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block"
            >
              Party Size
            </label>
            <div className="relative">
              <select
                id="guest_count"
                value={form.guest_count}
                onChange={(e) =>
                  setForm({ ...form, guest_count: Number(e.target.value) || 1 })
                }
                className="w-full bg-white/80 border border-gold-soft/60 rounded-xl px-4 py-3 font-serif-display text-base appearance-none focus:outline-none focus:ring-1 focus:ring-gold h-12 text-[#2b1f1a]"
              >
                <option value={1}>1 (Just me)</option>
                <option value={2}>2 (Me + 1 guest)</option>
                <option value={3}>3 (Me + 2 guests)</option>
                <option value={4}>4 (Me + 3 guests)</option>
                <option value={5}>5 (Me + 4 guests)</option>
                <option value={6}>6 (Me + 5 guests)</option>
                <option value={7}>7 (Me + 6 guests)</option>
                <option value={8}>8 (Me + 7 guests)</option>
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gold text-xs">
                ▼
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block">
              {visibleEvents.length === 1 ? 'Invited Celebration' : "Events You'll Attend"}
            </label>
            <div className="grid grid-cols-1 gap-3">
              {visibleEvents.map((event, idx) => {
                const isSelected = form.events.includes(event.id);
                return (
                  <button
                    key={event.id}
                    type="button"
                    onClick={() => toggleEvent(event.id, !isSelected)}
                    className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all duration-300 w-full cursor-pointer ${
                      isSelected
                        ? 'bg-[#faf0e1] border-gold text-foreground shadow-sm'
                        : 'bg-white/60 border-gold-soft/40 text-foreground/80 hover:bg-[#faf6f0]'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="font-serif-display font-semibold text-sm sm:text-base text-rose-deep">
                        {visibleEvents.length > 1 ? `Celebration ${idx + 1}: ` : ''}{event.label}
                      </span>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ml-4 ${
                          isSelected
                            ? 'bg-[#a84c32] border-[#a84c32] text-white'
                            : 'border-gold-soft bg-white'
                        }`}
                      >
                        {isSelected && <span className="text-[10px] font-bold">✓</span>}
                      </div>
                    </div>
                    <span className="font-serif-display text-xs text-[#2b1f1a]/60 mt-1">
                      {event.date}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label
          htmlFor="message"
          className="font-cinzel text-[10px] tracking-widest text-[#a84c32] font-bold uppercase block"
        >
          A message for the couple
        </label>
        <textarea
          id="message"
          maxLength={1000}
          rows={3}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          placeholder="Leave a warm wish or note..."
          className="w-full bg-white/80 border border-gold-soft/60 rounded-xl px-4 py-3 font-serif-display text-base focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-gold text-[#2b1f1a]"
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
        <button
          type="submit"
          disabled={submitting}
          className="w-full sm:w-auto gradient-gold text-white border-0 hover:opacity-90 rounded-full px-10 py-4 shadow-gold font-cinzel text-xs tracking-wider uppercase font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-pointer inline-flex items-center justify-center"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Submitting...
            </>
          ) : (
            'Send RSVP & Get QR Pass'
          )}
        </button>

        {form.guest_name.trim().length > 0 && form.attending === 'yes' && (
          <button
            type="button"
            onClick={handlePreviewPass}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-6 py-4 rounded-full bg-white hover:bg-emerald-50 text-emerald-900 border border-emerald-400 font-cinzel text-xs uppercase font-bold tracking-wider transition-all cursor-pointer shadow-xs"
            title="Preview how your digital QR entry pass will look"
          >
            <QrCode className="w-4 h-4 text-emerald-700" />
            <span>Preview QR Pass</span>
          </button>
        )}
      </div>
    </form>
  );
};
