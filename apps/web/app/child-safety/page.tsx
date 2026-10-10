import type { Metadata } from 'next';
import { LegalPage, LEGAL_ENTITY, SUPPORT_EMAIL } from '@/components/legal/LegalPage';

export const metadata: Metadata = {
  title: 'Child Safety Standards',
  description: 'How Shiggy Trails keeps children safe: adults only, no private messaging, reporting, and what we do when we are told.',
};

// The page Google Play's "Child safety standards" declaration points at. Every
// claim here matches what the product does: registration refuses under-18s
// (api/src/validators/common.ts), there is no direct messaging (D8), and a report
// goes to the moderation queue (services/moderation.service.ts). Keep it that way:
// change the product and this page together.
export default function ChildSafetyPage() {
  return (
    <LegalPage title="Child Safety Standards" updated="9 October 2026">
      <p>
        Shiggy Trails, operated by {LEGAL_ENTITY}, is a community app for adult Hash House Harriers. We have zero tolerance for child sexual abuse and exploitation (CSAE), including child
        sexual abuse material (CSAM), grooming, sextortion and trafficking. This page sets out our standards and what we do about them.
      </p>

      <h2>Adults only</h2>
      <ul>
        <li>You must be 18 or older to create an account. Registration asks for a date of birth and our server refuses anyone under 18.</li>
        <li>If we learn that someone under 18 has an account, we close it.</li>
        <li>The app is not designed for, or marketed to, children.</li>
      </ul>

      <h2>What is not allowed</h2>
      <ul>
        <li>Any content that sexualises or exploits a child, in any form: images, video, text, links or reels.</li>
        <li>Grooming, or any attempt to contact a child for a sexual purpose.</li>
        <li>Sharing, asking for or trading CSAM, or links to it.</li>
        <li>Using the app to arrange the abuse or trafficking of a child.</li>
      </ul>

      <h2>How the app limits the risk</h2>
      <ul>
        <li>There is no private one-to-one messaging. Conversations belong to kennels, events and runs, not to private inboxes.</li>
        <li>You choose who sees your posts, photos and reels: everyone, followers only, or only you. A locked profile means people must ask to follow you.</li>
        <li>You can block or mute anyone.</li>
        <li>Personal details such as date of birth, phone number and address are private and are never shown publicly.</li>
        <li>A post or reel is drafted, its media uploaded and only then published, so nothing half-uploaded reaches anyone&apos;s feed.</li>
      </ul>

      <h2>How to report a concern</h2>
      <ul>
        <li>
          <strong>In the app:</strong> open the report option on any post, reel, comment, photo or hasher, choose &ldquo;Nudity or sexual content&rdquo; (or &ldquo;Other&rdquo;), and say in the
          details that it involves a child.
        </li>
        <li>
          <strong>By email:</strong> write to <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> with a link or description. Do not attach or forward the material itself.
        </li>
        <li>If a child is in immediate danger, contact your local emergency services first.</li>
      </ul>

      <h2>What we do when we are told</h2>
      <ul>
        <li>Every report goes into a moderation queue. Kennel moderators handle what happens in their kennel and can hand a report up to platform staff.</li>
        <li>A report keeps a copy of what was reported, so the evidence is still there if the content is taken down.</li>
        <li>Moderators can remove a post, reel, comment or photo, warn the person, and (platform staff only) suspend the account, which ends every session and blocks login.</li>
        <li>
          Where content sexualises or exploits a child, we remove it, suspend the account, keep the evidence, and report it to the relevant authority, such as the National Center for Missing
          &amp; Exploited Children (NCMEC) or the national hotline or police where the account holder is, as the law requires.
        </li>
        <li>We cooperate with law enforcement requests that are made lawfully.</li>
      </ul>

      <h2>Laws we follow</h2>
      <p>
        We comply with the child safety and child protection laws that apply to us, including the obligation to report CSAM where one exists. These standards are part of our Terms of Service,
        and breaking them is grounds for permanent removal.
      </p>

      <h2>Our child safety contact</h2>
      <p>
        {LEGAL_ENTITY}
        <br />
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p>This is the person or team we have designated to talk to Google Play, regulators and law enforcement about child safety. We reply to child safety reports as a priority.</p>

      <h2>Changes</h2>
      <p>We review these standards regularly and update them when the app changes. The date at the top shows the latest version.</p>
    </LegalPage>
  );
}
