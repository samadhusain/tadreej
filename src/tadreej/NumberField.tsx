import { useState } from 'react';
import { type Draft, isStale, typeDraft } from './numberDraft';

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
  const [draft, setDraft] = useState<Draft | null>(null);

  // A change from outside (the − / + buttons) drops the draft.
  if (draft && isStale(draft, value)) setDraft(null);

  return (
    <input
      {...rest}
      type="number" min={min} max={max}
      value={draft ? draft.text : value}
      onChange={(e) => {
        const typed = typeDraft(e.target.value, value, min, max, integer);
        setDraft(typed.draft);
        if (typed.commit !== null) onCommit(typed.commit);
      }}
      onBlur={() => setDraft(null)}
    />
  );
}
