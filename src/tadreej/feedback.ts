/* ============================================================
   Tadreej — feedback links.
   Each link opens a GitHub issue form from .github/ISSUE_TEMPLATE/.
   A query parameter named after a field's id fills that field, so
   the bug form arrives with the listener's place and device typed
   in. feedback.test.ts fails when a name here has no match in a form.

   GitHub's phone app opens these links itself and drops the filled
   fields. The forms say what to type when a field arrives empty.
   ============================================================ */

import { REPO_URL } from './credits';

/** What the bug form's two filled fields say. */
export interface FeedbackContext {
  where: string;    // "Page 50 · Aal-i-Imraan · Ayah 33 · stepped mode · Mishari Al-Afasy · reps 1 · …"
  device: string;   // "Installed app · 440×956 · Mozilla/5.0 (iPhone; …"
}

export function feedbackLinks({ where, device }: FeedbackContext): { bug: string; feature: string } {
  const newIssue = `${REPO_URL}/issues/new`;
  return {
    bug: `${newIssue}?${new URLSearchParams({ template: 'bug_report.yml', where, device })}`,
    feature: `${newIssue}?template=feature_request.yml`,
  };
}
