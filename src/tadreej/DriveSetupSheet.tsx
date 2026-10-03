import { useState } from 'react';
import {
  DRIVE_SETUP_LEAD,
  DRIVE_SETUP_NOTES,
  DRIVE_SETUP_STEPS,
  DRIVE_SETUP_TITLE,
  driveSetupLink,
} from './driveSetup';

/* Drive setup sheet: the steps that open Tadreej when the phone connects to the vehicle.
   It is rendered only while open, so the link is read from the address then. */
export default function DriveSetupSheet({ onClose }: { onClose: () => void }) {
  const link = driveSetupLink(window.location.href);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    // On failure, do nothing. The link stays selectable.
    navigator.clipboard?.writeText(link).then(() => setCopied(true), () => {});
  };

  return (
    <div className="sheet">
      <div className="sheet__backdrop" onClick={onClose}></div>
      <div className="sheet__panel drivesetup" role="dialog" aria-modal="true" aria-labelledby="drivesetup-title">
        <div className="sheet__grip" aria-hidden="true"></div>
        <h2 className="feedback__title" id="drivesetup-title">{DRIVE_SETUP_TITLE}</h2>
        <p className="feedback__lead">{DRIVE_SETUP_LEAD}</p>
        <ol className="drivesetup__steps">
          {DRIVE_SETUP_STEPS.map((step, n) => (
            <li key={step}>
              {step}
              {n === 4 && (
                <div className="drivesetup__link">
                  <code>{link}</code>
                  <button className="drivesetup__copy" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
                </div>
              )}
            </li>
          ))}
        </ol>
        {DRIVE_SETUP_NOTES.map((note) => <p className="drivesetup__note" key={note}>{note}</p>)}
        <button className="primary-btn primary-btn--accent drivesetup__close" onClick={onClose}>Got it</button>
      </div>
    </div>
  );
}
