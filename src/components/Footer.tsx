import React from 'react';
import { IslamicPatternOverlay } from './IslamicBackground';

export const Footer: React.FC = () => {
  return (
    <footer className="relative bg-[#14281f] text-cream py-16 px-6 text-center overflow-hidden border-t-2 border-gold-soft/50">
      <IslamicPatternOverlay opacity={0.08} />

      <div className="relative z-10 max-w-xl mx-auto">
        <p className="font-cinzel text-xs tracking-[0.4em] text-gold-soft">WITH DUAS &amp; LOVE</p>
        <h3 className="font-script text-5xl sm:text-6xl text-cream mt-3">
          <span className="font-script-capital-a">B</span>asit{' '}
          <span className="font-script-capital-a">A</span>li 
          <br />
&amp;
<br />
          <span className="font-script-capital-a">A</span>mbiya{' '}
          <span className="font-script-capital-a">B</span>asher
        </h3>

        <div className="my-5 flex items-center justify-center gap-3">
          <span className="h-px w-16 bg-gold-soft/40" />
          <span className="text-xl text-gold-soft tracking-widest select-none">🌙 ✦ ۞ ✦ 🌙</span>
          <span className="h-px w-16 bg-gold-soft/40" />
        </div>

        <p className="font-arabic text-xl text-gold-soft/90 mb-2 select-none" style={{ fontFamily: "'Amiri', serif" }}>
          بارك الله لكما وبارك عليكما وجمع بينكما في خير
        </p>
        <p className="font-serif-display text-xs tracking-wider text-cream/70 italic mb-4">
          "May Allah bless for you, and shower His blessings upon you, and unite you in goodness."
        </p>

        <p className="font-serif-display text-lg italic text-gold-soft"></p>
        <p className="mt-3 font-cinzel text-xs tracking-widest text-cream/80 uppercase font-semibold">
          #BasitGotAmbitious
        </p>

        {/* Host & Gate Usher Portal Access */}
        <div className="mt-8 pt-6 border-t border-gold-soft/20 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_admin_qr_scanner'))}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-900/60 hover:bg-emerald-800 border border-emerald-400/40 text-emerald-200 hover:text-white font-cinzel text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
          >
            <span>📷</span>
            <span>Host Gate Scanner</span>
          </button>

          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('open_rsvp_excel_manager'))}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-amber-950/40 hover:bg-amber-900/60 border border-amber-400/30 text-amber-200 hover:text-white font-cinzel text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-xs"
          >
            <span>📊</span>
            <span>Host RSVP Registry</span>
          </button>
        </div>
      </div>
    </footer>
  );
};
