import React from 'react';
import { Clock, CheckCircle2, Calendar, MapPin, Sparkles, ShieldCheck, History } from 'lucide-react';
import { formatDateTime, normalizeEventName } from '../services/rsvpExcelService';

interface CheckInTimelineProps {
  events: string[];
  checkedInMap?: Record<string, string>;
  guestCount?: number;
  passId?: string;
  className?: string;
  title?: string;
}

export const CheckInTimeline: React.FC<CheckInTimelineProps> = ({
  events = [],
  checkedInMap = {},
  guestCount = 1,
  passId,
  className = '',
  title = 'Check-In & Entry Timeline',
}) => {
  // Collect all events and their check-in details
  const timelineItems = events.map((rawEv) => {
    const norm = normalizeEventName(rawEv);
    const timestamp = checkedInMap[norm] || checkedInMap[rawEv] || null;
    const isCheckedIn = Boolean(timestamp);

    return {
      rawName: rawEv,
      normName: norm,
      timestamp,
      isCheckedIn,
    };
  });

  const checkedInCount = timelineItems.filter((item) => item.isCheckedIn).length;
  const hasAnyCheckIn = checkedInCount > 0;

  return (
    <div
      className={`rounded-2xl border bg-white/95 p-3.5 sm:p-4 text-left shadow-xs space-y-3 ${
        hasAnyCheckIn ? 'border-emerald-500/40 bg-gradient-to-b from-emerald-50/30 to-white' : 'border-gold-soft/60'
      } ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gold-soft/30 pb-2">
        <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs uppercase tracking-wider text-emerald-950">
          <History className="w-3.5 h-3.5 text-emerald-700" />
          <span>{title}</span>
        </div>
        <span
          className={`px-2 py-0.5 rounded-full font-cinzel text-[10px] font-bold ${
            hasAnyCheckIn
              ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              : 'bg-stone-100 text-stone-600 border border-stone-300'
          }`}
        >
          {checkedInCount} of {events.length} {events.length === 1 ? 'Ceremony' : 'Ceremonies'} Checked In
        </span>
      </div>

      {/* Timeline Stream */}
      {hasAnyCheckIn ? (
        <div className="relative pl-4 sm:pl-5 space-y-3 before:absolute before:left-1.5 sm:before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-emerald-600 before:via-emerald-400 before:to-stone-300">
          {timelineItems.map((item, idx) => {
            return (
              <div key={idx} className="relative group">
                {/* Checkpoint Node */}
                <div
                  className={`absolute -left-4 sm:-left-5 top-1 w-3.5 h-3.5 rounded-full border-2 transition-all flex items-center justify-center ${
                    item.isCheckedIn
                      ? 'bg-emerald-600 border-emerald-200 ring-2 ring-emerald-500/30 shadow-xs'
                      : 'bg-stone-200 border-stone-400'
                  }`}
                >
                  {item.isCheckedIn && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                </div>

                {/* Content Block */}
                <div
                  className={`p-2.5 rounded-xl border transition-all ${
                    item.isCheckedIn
                      ? 'bg-emerald-50/90 border-emerald-300/80 shadow-2xs'
                      : 'bg-stone-50/70 border-stone-200 opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <h5
                      className={`font-cinzel font-bold text-xs sm:text-[13px] ${
                        item.isCheckedIn ? 'text-emerald-950' : 'text-stone-700'
                      }`}
                    >
                      {item.rawName}
                    </h5>
                    {item.isCheckedIn ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-cinzel font-bold text-emerald-900 bg-emerald-100/90 px-2 py-0.5 rounded-full w-fit">
                        <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                        <span>Admitted ({guestCount} {guestCount === 1 ? 'Head' : 'Heads'})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-serif-display italic text-stone-500">
                        ⏳ Awaiting Entry
                      </span>
                    )}
                  </div>

                  {item.isCheckedIn && (
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] font-serif-display text-emerald-900/90">
                      <div className="flex items-center gap-1 font-semibold">
                        <Clock className="w-3 h-3 text-emerald-700 shrink-0" />
                        <span>Checked In: {formatDateTime(item.timestamp)}</span>
                      </div>
                      {passId && (
                        <span className="text-[10px] font-mono text-emerald-800/70">
                          Pass: {passId}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* First Arrival State */
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/80 text-left space-y-1">
          <div className="flex items-center gap-1.5 font-cinzel font-bold text-amber-950 text-[11px]">
            <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>First Arrival — No Prior Check-In Records</span>
          </div>
          <p className="text-[11px] font-serif-display text-amber-900/85 leading-relaxed">
            This guest has not yet entered any wedding functions. Once checked in at the gate, their entry timestamps will be recorded here in chronological order.
          </p>
        </div>
      )}
    </div>
  );
};
