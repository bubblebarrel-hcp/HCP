// The Terms of Service and Privacy Policy as data, so the public pages
// (/terms, /privacy-policy) and the sign-up reader render the same text.
// apps/mobile/src/lib/legal.ts carries a copy for the app's reader: change one,
// change the other, and bump LEGAL_VERSION so people are asked again.

export const LEGAL_ENTITY = 'Bubble Barrel Commerce Limited';
export const SUPPORT_EMAIL = 'support@shiggytrails.com';
export const PRIVACY_EMAIL = 'privacy@shiggytrails.com';

// What the API records against the account when someone accepts at sign-up.
export const LEGAL_VERSION = '2026-10-07';
export const LEGAL_EFFECTIVE_DATE = '7 October 2026';

export type LegalBlock = string | { list: string[] };
export type LegalSection = { id: string; heading: string; body: LegalBlock[] };
export type LegalDoc = { slug: 'terms' | 'privacy'; title: string; summary: string; sections: LegalSection[] };

export const TERMS: LegalDoc = {
  slug: 'terms',
  title: 'Terms of Service',
  summary: `These terms are between you and ${LEGAL_ENTITY} ("we"), who operate Shiggy Trails. By creating an account or using the app you agree to them and to our Privacy Policy.`,
  sections: [
    {
      id: 'who',
      heading: 'Who can use it',
      body: ['You must be 18 or older. Give accurate information, keep your password to yourself, and tell us if you think your account has been used by someone else. You are responsible for what happens under your account.'],
    },
    {
      id: 'content',
      heading: 'Your content',
      body: [
        "You keep ownership of what you post. You give us permission to store, display and distribute it within the app in line with the audience you choose. You promise you have the right to post it. Trail reports and run capsules belong to a kennel's shared history and may remain after you leave, credited to \"Deleted hasher\" if you delete your account.",
      ],
    },
    {
      id: 'behaviour',
      heading: 'How to behave',
      body: [
        "Do not post anything that is unlawful, hateful, harassing, sexually explicit, or that exposes someone's private information. Do not impersonate others, spam, or attempt to access trail details before they are released to you. Do not scrape the service or interfere with it.",
        'Hashing involves drinking and running. Alcohol is for adults: drink responsibly, never drive after drinking, and run within your abilities. Kennels organise their own runs; we do not organise, supervise or insure them.',
      ],
    },
    {
      id: 'moderation',
      heading: 'Reporting and moderation',
      body: [
        "You can report posts, reels, comments and people from within the app, and block people you do not want to hear from. We review reports and may remove content, restrict features or suspend accounts that break these terms. Kennel officers can moderate their own kennel's spaces.",
      ],
    },
    {
      id: 'safety',
      heading: 'Safety information',
      body: ['Emergency contacts and medical notes you provide are for the benefit of run organisers in an emergency. They are only as good as the information you keep up to date.'],
    },
    {
      id: 'ending',
      heading: 'Ending your account',
      body: ['You can delete your account at any time from Account, then Privacy, in the app or on the web. We may suspend or end accounts that break these terms.'],
    },
    {
      id: 'responsibility',
      heading: 'Our responsibility',
      body: [
        'The app is provided "as is". To the extent the law allows, we are not liable for indirect or consequential loss, or for injury or loss at runs organised by kennels. Nothing in these terms limits liability that cannot be limited by law.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes',
      body: ['We may update these terms. If a change matters, we will tell you in the app or by email. Continuing to use the app after that means you accept the change.'],
    },
    { id: 'contact', heading: 'Contact', body: [`${LEGAL_ENTITY} - ${SUPPORT_EMAIL}`] },
  ],
};

export const PRIVACY: LegalDoc = {
  slug: 'privacy',
  title: 'Privacy Policy',
  summary: `Shiggy Trails (the "app", on the web and on Android) is operated by ${LEGAL_ENTITY}. It is a home for Hash House Harriers kennels: find kennels, join runs, share trail reports, and keep a Hash Passport. This policy explains what we collect and what we do with it.`,
  sections: [
    {
      id: 'collect',
      heading: 'What we collect',
      body: [
        'You give us:',
        {
          list: [
            'Account details: email address and a password (stored only as a salted hash).',
            'Your profile: name, date of birth, gender, phone number, nationality, country, state or province, city, and optionally a street address, occupation and languages.',
            'Safety details, which you choose to give: an emergency contact (name, phone, relationship) and optional medical notes.',
            'Your hash name, handle, username, bio, profile and banner pictures.',
            'What you post: posts, comments, photos, reels (video with sound), trail reports and run capsules.',
            'Your kennel memberships, run attendance, follows, likes, bookmarks and notification settings.',
            'Your location, only when you ask the app to drop a pin where your kennel hashes. We do not track your location in the background.',
          ],
        },
        'Collected automatically:',
        {
          list: [
            'A push-notification token for your device, if you allow notifications.',
            'Security records such as sign-in times and an audit trail of account changes.',
          ],
        },
        'We do not run advertising or third-party analytics in the app, and we do not sell your personal data.',
      ],
    },
    {
      id: 'use',
      heading: 'How we use it',
      body: [
        {
          list: [
            'To run your account, kennel memberships and runs, and to send notifications you have asked for.',
            'To keep runs safe: emergency contact and medical notes are shown only to the kennel officers who need them for a run you join.',
            'To show your public identity. Your public name is your hash handle, or "Just <first name>" if you have not been named. Your biodata is private and is never shown publicly.',
            'To prevent abuse, moderate reported content and meet legal obligations.',
            'To draft a trail report if a scribe asks the optional AI assistant to. AI output is a suggestion a human reviews; the text for that request is sent to our AI provider, Anthropic, for that request only.',
          ],
        },
      ],
    },
    {
      id: 'sees',
      heading: 'Who sees what',
      body: [
        'You control who sees your posts, photos and reels: everyone, followers only, or only you. Individual posts and reels can be narrowed further. Kennels and runs have their own privacy settings, set by the kennel. We do not offer direct one-to-one messaging.',
      ],
    },
    {
      id: 'share',
      heading: 'Who we share it with',
      body: [
        'We use service providers who process data on our behalf and may not use it for their own purposes:',
        {
          list: [
            'Cloudflare R2 for photo, video and audio storage.',
            'Resend for email (verification, password reset and notification emails).',
            'Expo for push notifications.',
            'Anthropic, for the optional trail-report drafting described above.',
            'Our hosting and database providers.',
          ],
        },
        'We may also disclose information where the law requires it, or to protect people from harm.',
      ],
    },
    {
      id: 'where',
      heading: 'Where it is kept',
      body: [
        'Hashers are worldwide, so your data may be processed in countries other than your own. Where required, we rely on appropriate safeguards for international transfers. Data is encrypted in transit.',
      ],
    },
    {
      id: 'keep',
      heading: 'How long we keep it',
      body: [
        "We keep your data while your account is open. When you delete your account we remove your sign-in, profile biodata, emergency and medical details, uploaded pictures and media files, follows, bookmarks, notifications and devices, and we take down your posts, reels and comments. What stays is what other people's history is made of: runs you attended and the trail reports and capsules that name you, which then read \"Deleted hasher\". How to delete your account is at shiggytrails.com/delete-account.",
      ],
    },
    {
      id: 'rights',
      heading: 'Your rights',
      body: [
        `Depending on where you live, you may have the right to access, correct, export or delete your data, object to or restrict processing, and complain to your data-protection authority. You can edit your profile and privacy settings in the app, and delete your account in the app or on the web. For anything else, email ${PRIVACY_EMAIL} and we will answer within 30 days.`,
      ],
    },
    {
      id: 'age',
      heading: 'Age',
      body: ['Shiggy Trails is for adults. You must be 18 or older to create an account. If we learn that someone younger has signed up, we will delete the account.'],
    },
    {
      id: 'security',
      heading: 'Security',
      body: [
        'Passwords are hashed, sessions use short-lived tokens, and trail secrets are enforced on the server. No system is perfectly secure; if a breach affects you we will tell you as the law requires.',
      ],
    },
    {
      id: 'changes',
      heading: 'Changes',
      body: ['If we change this policy in a way that matters, we will tell you in the app or by email before it takes effect. The date at the top shows the latest version.'],
    },
    { id: 'contact', heading: 'Contact', body: [`${LEGAL_ENTITY} - ${PRIVACY_EMAIL}`] },
  ],
};

export const LEGAL_DOCS = { terms: TERMS, privacy: PRIVACY } as const;
