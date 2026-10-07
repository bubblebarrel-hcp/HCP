import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage, LEGAL_ENTITY, PRIVACY_EMAIL } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to delete your Shiggy Trails account and what happens to your data.',
};

export default function DeleteAccountPage() {
  return (
    <LegalPage title="Delete your Shiggy Trails account" updated="7 October 2026">
      <p>This page explains how to delete your account and your data in Shiggy Trails, operated by {LEGAL_ENTITY}. Deleting an account is permanent.</p>

      <h2>Delete it yourself</h2>
      <ul>
        <li>
          <strong>In the Android app:</strong> open Account &rarr; Privacy &rarr; Delete my account, enter your password and type DELETE.
        </li>
        <li>
          <strong>On the web:</strong> sign in, then go to <Link href="/account/privacy">Account &rarr; Privacy</Link> and choose Delete my account.
        </li>
      </ul>
      <p>If you still hold an office in a kennel (such as hare or scribe), resign it first so the kennel is not left with an empty seat.</p>

      <h2>Cannot sign in?</h2>
      <p>
        Email <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a> from the address on the account with the subject &ldquo;Delete my account&rdquo;. We will verify it is you and delete the
        account within 30 days.
      </p>

      <h2>What is deleted straight away</h2>
      <ul>
        <li>Your email address, password, sign-in sessions, hash handle, username, bio and profile and banner pictures.</li>
        <li>Your biodata: name, date of birth, phone, address, nationality, occupation, emergency contact and medical notes.</li>
        <li>Your photos, reels and other uploaded files.</li>
        <li>Your follows, followers, bookmarks, notifications, notification settings and push-notification devices.</li>
        <li>Your kennel memberships, which end as a resignation. Your Hash Passport sharing link stops working.</li>
        <li>Your posts, reels and comments are taken down and no longer shown to anyone.</li>
      </ul>

      <h2>What is kept</h2>
      <p>
        Hash history belongs to the kennel as well as to you. Runs you attended, and trail reports and Run Capsules that name you, remain as part of the kennel&apos;s record, showing
        &ldquo;Deleted hasher&rdquo; in place of you. They no longer link to a person, a name, an email or any biodata. We also keep a minimal security and audit record, with no personal
        contact details, where the law or abuse prevention requires it.
      </p>
    </LegalPage>
  );
}
