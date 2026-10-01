import type { UiState } from './engine';
import { feedbackLinks } from './feedback';

/* Feedback sheet: two links to GitHub issue forms. It is rendered only while
   open, so the place and the device are read at the moment the listener asks. */
export default function FeedbackSheet({ ui, reciterName, onClose }: {
  ui: UiState;
  reciterName: string;
  onClose: () => void;
}) {
  const { settings } = ui;
  const links = feedbackLinks({
    // The place, then the settings that shape playback.
    where: [
      `${ui.unitLabel} ${ui.unitValue}`, ui.surahEn, `${settings.mode} mode`, reciterName,
      `reps ${settings.reps}`, `pause ${settings.stepPause}s`, `gap ${settings.ayahGap}s`,
      `repeat ${settings.repeatPage ? 'on' : 'off'}`,
    ].filter(Boolean).join(' · '),
    device: [
      window.matchMedia('(display-mode: standalone)').matches ? 'Installed app' : 'Browser tab',
      `${window.innerWidth}×${window.innerHeight}`,
      navigator.userAgent,
    ].join(' · '),
  });

  return (
    <div className="sheet">
      <div className="sheet__backdrop" onClick={onClose}></div>
      <div className="sheet__panel" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="sheet__grip" aria-hidden="true"></div>
        <h2 className="feedback__title" id="feedback-title">Send feedback</h2>
        {/* What the tap sends is said before the buttons, not after them. */}
        <p className="feedback__lead">
          Each button opens a short form on GitHub. You need a free GitHub account.{' '}
          <strong>Report a bug</strong> sends your page, settings and device details to GitHub, to fill in the form.
        </p>
        <div className="feedback__actions">
          <a className="primary-btn primary-btn--accent" href={links.bug} target="_blank" rel="noopener" onClick={onClose}>Report a bug</a>
          <a className="primary-btn" href={links.feature} target="_blank" rel="noopener" onClick={onClose}>Suggest a feature</a>
        </div>
        <button className="feedback__cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
