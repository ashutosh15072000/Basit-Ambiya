import React, { useState, useEffect } from 'react';

interface CountdownTimerProps {
  targetTimestamp?: number;
  eventLabel?: string;
}

const DEFAULT_WEDDING_TIME = new Date('2026-10-29T19:30:00').getTime();

const getRemainingTime = (targetTime: number) => {
  const diff = Math.max(0, targetTime - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60),
  };
};

export const CountdownTimer: React.FC<CountdownTimerProps> = ({
  targetTimestamp = DEFAULT_WEDDING_TIME,
  eventLabel,
}) => {
  const [timeLeft, setTimeLeft] = useState(() => getRemainingTime(targetTimestamp));

  useEffect(() => {
    setTimeLeft(getRemainingTime(targetTimestamp));
    const timer = setInterval(() => {
      setTimeLeft(getRemainingTime(targetTimestamp));
    }, 1000);
    return () => clearInterval(timer);
  }, [targetTimestamp]);

  const items = [
    { value: timeLeft.days, label: 'Days' },
    { value: timeLeft.hours, label: 'Hours' },
    { value: timeLeft.minutes, label: 'Minutes' },
    { value: timeLeft.seconds, label: 'Seconds' },
  ];

  return (
    <div className="flex flex-col items-center">
      {eventLabel && (
        <p className="font-cinzel text-[11px] tracking-widest text-[#a84c32] uppercase font-bold mb-3">
          Counting down to: {eventLabel}
        </p>
      )}
      <div className="flex justify-center gap-3 sm:gap-6">
        {items.map((item) => (
          <div
            key={item.label}
            className="flex flex-col items-center min-w-[68px] sm:min-w-[90px]"
          >
            <div className="w-full aspect-square rounded-2xl bg-cream border border-gold-soft shadow-soft flex items-center justify-center backdrop-blur-sm">
              <span className="font-cinzel text-2xl sm:text-4xl text-rose-deep tabular-nums font-bold">
                {String(item.value).padStart(2, '0')}
              </span>
            </div>
            <span className="mt-2 text-xs sm:text-sm tracking-widest uppercase font-cinzel text-[#2b1f1a]/70 font-semibold">
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
