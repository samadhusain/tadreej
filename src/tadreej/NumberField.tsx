import { useState } from 'react';
import { parseDraft } from './numberDraft';

type Props = {
  value: number;
  min: number;
  max: number;
  integer?: boolean;
  onCommit: (n: number) => void;
  step?: number;
  className?: string;
  inputMode?: 'numeric' | 'decimal';
  'aria-label'?: string;
};

// A number input that keeps what the user types as a draft. It saves only
// complete numbers, so the user can clear the field or type "1." on a phone.
export default function NumberField({ value, min, max, integer = false, onCommit, ...rest }: Props) {
  // `base` is the saved value when the user last typed.
  const [draft, setDraft] = useState<{ text: string; base: number } | null>(null);

  // Show the draft while it still matches the saved value. A change from
  // outside (the − / + buttons) shows the new value instead.
  const parsed = draft && parseDraft(draft.text, min, max, integer);
  const showDraft = draft !== null && (value === draft.base || parsed === value);

  return (
    <input
      {...rest}
      type="number" min={min} max={max}
      value={showDraft ? draft.text : value}
      onChange={(e) => {
        const text = e.target.value;
        setDraft({ text, base: value });
        const n = parseDraft(text, min, max, integer);
        if (n !== null) onCommit(n);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
