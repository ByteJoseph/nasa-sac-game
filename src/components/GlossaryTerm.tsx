import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { SCIENCE_GLOSSARY } from '../data/nasaScienceData';

interface GlossaryTermProps {
  termKey: keyof typeof SCIENCE_GLOSSARY;
  label?: string;
}

export function GlossaryTerm({ termKey, label }: GlossaryTermProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const entry = SCIENCE_GLOSSARY[termKey];

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);

  if (!entry) {
    return <span>{label ?? termKey}</span>;
  }

  return (
    <span ref={containerRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className="inline-flex items-center gap-1 underline decoration-amber-400/70 decoration-dotted underline-offset-4 text-amber-200 hover:text-amber-100 focus-visible:outline-2 focus-visible:outline-amber-400 rounded-sm cursor-pointer"
        aria-expanded={open}
        aria-label={`Explain science term ${entry.term}`}
      >
        <span>{label ?? entry.term}</span>
        <HelpCircle className="w-3.5 h-3.5 text-amber-300 shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={entry.term}
          className="fixed z-50 left-1/2 -translate-x-1/2 top-24 w-[min(340px,calc(100vw-2rem))] rounded-xl bg-[#111A2E] border border-amber-400/40 shadow-2xl p-3.5 text-left text-slate-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <div>
              <p className="font-display font-bold text-sm text-amber-300">{entry.term}</p>
              <p className="text-xs text-slate-400">{entry.shortMeaning}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              aria-label="Close definition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-xs leading-relaxed text-slate-200 mb-2">{entry.kidExplanation}</p>
          <p className="text-[11px] leading-snug text-cyan-300 border-t border-slate-700/80 pt-2">
            NASA Fact: {entry.nasaFact}
          </p>
        </div>
      )}
    </span>
  );
}
