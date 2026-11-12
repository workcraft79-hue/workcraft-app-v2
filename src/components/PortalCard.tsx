import React from 'react';
import { X } from 'lucide-react';

interface PortalCardProps {
  title: string;
  kicker: string;
  kickerColor?: string;
  className?: string;
  children: React.ReactNode;
  onClose?: () => void;
}

export const PortalCard: React.FC<PortalCardProps> = ({
  title,
  kicker,
  kickerColor,
  className = '',
  children,
  onClose,
}) => {
  return (
    <div
      className={`min-w-0 max-w-full overflow-hidden rounded-2xl border border-[#30363D] bg-[#161B22] p-5 transition hover:border-[#484F58] relative ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] font-mono font-bold uppercase tracking-[.18em] ${
              kickerColor || 'text-[#D29922]'
            }`}
          >
            {kicker}
          </p>
          <h3 className="mt-1 text-lg font-bold text-[#F0F6FC] tracking-tight break-words [overflow-wrap:break-word]">{title}</h3>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] grid place-items-center rounded-xl text-[#8B949E] hover:text-[#F0F6FC] hover:bg-[#21262D] transition shrink-0"
            aria-label="Close card"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
    </div>
  );
};
