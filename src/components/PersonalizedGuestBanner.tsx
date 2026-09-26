import React from 'react';
import { Sparkles, Calendar, Heart } from 'lucide-react';
import { ALL_FUNCTIONS } from '../utils/invitationConfig';

interface PersonalizedGuestBannerProps {
  guestName: string;
  invitedFunctionIds: number[];
  isAdmin?: boolean;
  onSelectFunctions?: (functionIds: number[]) => void;
}

export const PersonalizedGuestBanner: React.FC<PersonalizedGuestBannerProps> = ({
  guestName,
  invitedFunctionIds,
  isAdmin = false,
  onSelectFunctions,
}) => {
  const isPersonalized = !!guestName.trim() || invitedFunctionIds.length < 3;

  if (!isPersonalized && !isAdmin) {
    return null;
  }

  const invitedFunctions = ALL_FUNCTIONS.filter((f) =>
    invitedFunctionIds.includes(f.id)
  );

  return (
    <div className="w-full max-w-4xl mx-auto px-4 pt-6 pb-2">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#1b4332]/90 via-[#2d5a45] to-[#1b4332]/90 text-white p-5 sm:p-7 shadow-xl border-2 border-gold-soft">
        {/* Subtle Decorative Pattern */}
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#d4af37_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />
        <div className="absolute top-2 right-2 text-gold-soft/30 font-serif-display text-4xl select-none pointer-events-none">
          ﷽
        </div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <div className="space-y-1.5 flex-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/20 border border-gold-soft/40 text-gold-light text-[11px] font-cinzel font-bold tracking-widest uppercase">
              <Sparkles className="w-3.5 h-3.5 text-gold" />
              <span>Personalized Invitation</span>
            </div>

            {guestName ? (
              <h3 className="font-serif-display text-2xl sm:text-3xl font-bold text-[#faf6f0] tracking-wide">
                Welcome, <span className="text-gold-light">{guestName}</span>
              </h3>
            ) : (
              <h3 className="font-serif-display text-xl sm:text-2xl font-bold text-[#faf6f0]">
                Honored Guest Invitation
              </h3>
            )}

            <p className="font-serif-display italic text-sm text-[#faf6f0]/85 max-w-2xl leading-relaxed">
              We joyfully request the pleasure of your gracious company and prayers for the wedding of{' '}
              <span className="font-semibold text-gold-light">Basit Ali &amp; Ambiya Basher</span>.
            </p>

            {/* List of Invited Ceremonies */}
            <div className="pt-2 flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="text-[11px] font-cinzel uppercase text-gold-soft font-semibold tracking-wider flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Invited To:
              </span>
              {invitedFunctions.map((f) => (
                <span
                  key={f.id}
                  className="px-2.5 py-0.5 rounded-full text-xs font-serif-display bg-white/15 border border-gold-soft/40 text-white font-medium shadow-xs"
                >
                  {f.title} ({f.dayOfMonth} {f.monthName.slice(0, 3)} · {f.venue.split(' ')[0]})
                </span>
              ))}
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center justify-center p-3 rounded-xl bg-black/20 border border-gold-soft/30 min-w-[130px]">
            <Heart className="w-5 h-5 text-rose-300 fill-rose-300/40 mb-1" />
            <span className="font-cinzel text-[10px] tracking-widest uppercase text-gold-soft font-bold">
              {invitedFunctionIds.length === 1
                ? '1 Ceremony'
                : `${invitedFunctionIds.length} Ceremonies`}
            </span>
            <span className="font-serif-display text-[11px] text-[#faf6f0]/70 italic mt-0.5">
              Custom Guest View
            </span>
          </div>
        </div>

        {/* Admin Quick-Simulator (Visible only in admin mode) */}
        {isAdmin && onSelectFunctions && (
          <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between gap-2 flex-wrap text-xs">
            <span className="font-cinzel text-[10px] uppercase tracking-wider text-gold-light font-bold">
              Host View Simulator:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => onSelectFunctions([1, 2, 3])}
                className={`px-2 py-1 rounded-md text-[10px] font-cinzel font-semibold cursor-pointer transition-all ${
                  invitedFunctionIds.length === 3
                    ? 'bg-gold text-stone-900 font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                All 3
              </button>
              <button
                type="button"
                onClick={() => onSelectFunctions([1])}
                className={`px-2 py-1 rounded-md text-[10px] font-cinzel font-semibold cursor-pointer transition-all ${
                  invitedFunctionIds.length === 1 && invitedFunctionIds[0] === 1
                    ? 'bg-gold text-stone-900 font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Function 1 Only
              </button>
              <button
                type="button"
                onClick={() => onSelectFunctions([1, 2])}
                className={`px-2 py-1 rounded-md text-[10px] font-cinzel font-semibold cursor-pointer transition-all ${
                  invitedFunctionIds.length === 2 &&
                  invitedFunctionIds.includes(1) &&
                  invitedFunctionIds.includes(2)
                    ? 'bg-gold text-stone-900 font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Function 1 &amp; 2
              </button>
              <button
                type="button"
                onClick={() => onSelectFunctions([2, 3])}
                className={`px-2 py-1 rounded-md text-[10px] font-cinzel font-semibold cursor-pointer transition-all ${
                  invitedFunctionIds.length === 2 &&
                  invitedFunctionIds.includes(2) &&
                  invitedFunctionIds.includes(3)
                    ? 'bg-gold text-stone-900 font-bold'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                Function 2 &amp; 3
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
