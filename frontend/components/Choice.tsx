"use client";

interface Option<T extends string> {
  value: T;
  label: string;
  hint?: string;
}

interface Props<T extends string> {
  value: T | null;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export function Choice<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <div className="flex flex-col gap-3">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`flex flex-col items-start rounded-3xl border px-5 py-4 text-left transition ${
              selected
                ? "border-pink bg-pink/10 shadow-pop"
                : "border-white/10 bg-navy-soft"
            }`}
          >
            <span className="text-base font-semibold">{opt.label}</span>
            {opt.hint && (
              <span className="mt-1 text-xs text-white/60">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
