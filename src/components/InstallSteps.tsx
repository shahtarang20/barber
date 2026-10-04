/** Shows the "how to install" text as clear numbered steps (one line per step; a first line without a number is an intro). */
export function InstallSteps({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.split("\n").filter(Boolean);
  return (
    <div role="status" className={`space-y-1.5 text-sm leading-snug ${className}`}>
      {lines.map((line, i) => {
        const m = line.match(/^(\d)\.\s+(.*)$/);
        return m ? (
          <p key={i} className="flex gap-2">
            <span className="shrink-0 w-5 h-5 mt-px rounded-full bg-zinc-900 text-white text-xs font-semibold flex items-center justify-center" aria-hidden="true">{m[1]}</span>
            <span>{m[2]}</span>
          </p>
        ) : (
          <p key={i} className="font-medium">{line}</p>
        );
      })}
    </div>
  );
}
