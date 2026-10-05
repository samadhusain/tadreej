import { useRef, useState } from 'react';
import {
  DRIVE_SETUP_LEAD,
  DRIVE_SETUP_NOTES,
  DRIVE_SETUP_STEPS,
  DRIVE_SETUP_TITLE,
  driveSetupLink,
} from './driveSetup';
import {
  HOME_SCREEN_LEAD,
  HOME_SCREEN_NOTES,
  HOME_SCREEN_STEPS,
  HOME_SCREEN_TITLE,
  dismissLabel,
  primaryLabel,
  type SetupPage,
} from './homeScreenSetup';

/* Setup sheet: one page at a time. "Add to Home Screen", then "Play when you start driving".
   It is rendered only while open, so the link is read from the address then. */
export default function SetupSheet({ pages, onClose }: { pages: SetupPage[]; onClose: () => void }) {
  const link = driveSetupLink(window.location.href);
  const [copied, setCopied] = useState(false);
  const [index, setIndex] = useState(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const page = pages[index];
  const isHome = page === 'home';
  const last = index === pages.length - 1;

  const copy = () => {
    // On failure, do nothing. The link stays selectable.
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {});
  };

  // The panel scrolls and stays mounted, so page 2 would open part-way down without this.
  const next = () => {
    setIndex(index + 1);
    if (panelRef.current) panelRef.current.scrollTop = 0;
  };

  const title = isHome ? HOME_SCREEN_TITLE : DRIVE_SETUP_TITLE;
  const lead = isHome ? HOME_SCREEN_LEAD : DRIVE_SETUP_LEAD;
  const steps = isHome ? HOME_SCREEN_STEPS : DRIVE_SETUP_STEPS;
  const notes = isHome ? HOME_SCREEN_NOTES : DRIVE_SETUP_NOTES;

  return (
    <div className="sheet">
      <div className="sheet__backdrop" onClick={onClose}></div>
      <div ref={panelRef} className="sheet__panel drivesetup" role="dialog" aria-modal="true" aria-labelledby="drivesetup-title">
        <div className="sheet__grip" aria-hidden="true"></div>
        <button className="drivesetup__dismiss" onClick={onClose}>{dismissLabel(pages.length)}</button>
        <h2 className="feedback__title" id="drivesetup-title">{title}</h2>
        <p className="feedback__lead">{lead}</p>
        <ol className="drivesetup__steps">
          {steps.map((step, n) => (
            <li key={step}>
              {step}
              {!isHome && n === 4 && (
                <div className="drivesetup__link">
                  <code>{link}</code>
                  <button className="drivesetup__copy" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {notes.map((note) => <p className="drivesetup__note" key={note}>{note}</p>)}
        <button
          className="primary-btn primary-btn--accent drivesetup__close"
          onClick={last ? onClose : next}
        >
          {primaryLabel(last)}
        </button>
      </div>
    </div>
  );
}
