import LegalPage from '../components/LegalPage';
import { SITE } from '../siteConfig';

const sections = [
  {
    title: '1. Who is responsible for your data',
    body: [
      `${SITE.operator} operates ${SITE.name} and is the data controller for the personal data described here. Contact: ${SITE.contactEmail}.`,
      ...(SITE.odpcRegistration ? [`ODPC registration number: ${SITE.odpcRegistration}.`] : []),
    ],
  },
  {
    title: '2. What we collect',
    body: [
      {
        list: [
          'Account details: your name, email address, phone number, county or city, and your password (stored only as a one-way scrambled hash, never as plain text).',
          'What you post: listings (text and photos), offers, messages, reviews and reports.',
          'Security and verification data: verification codes (stored scrambled), when you accepted the terms, and failed-login counts.',
          'Technical data: your IP address and browser details, which appear in our hosting provider\'s server logs.',
        ],
      },
    ],
  },
  {
    title: '3. Why we use it',
    body: [
      {
        list: [
          'To run the marketplace and your account (to carry out our agreement with you).',
          'To verify accounts and prevent fraud, abuse and security problems (our legitimate interest in keeping the platform safe).',
          'To send you emails you need, such as verification, password reset and security notices.',
          'To handle reports, enforce our rules and respond to legal requests.',
        ],
      },
      'We do not sell your personal data and we do not use it for advertising.',
    ],
  },
  {
    title: '4. What other people can see',
    body: [
      {
        list: [
          'Public: your name, county or city, the date you joined, verification badges, your ratings and reviews, and your active listings.',
          'Only the two people in a conversation: messages and offers between them (plus administrators when needed, as explained in the Terms).',
          'Never shown to other users: your email address, phone number and password.',
        ],
      },
    ],
  },
  {
    title: '5. Who we share data with',
    body: [
      'We use trusted service providers who process data for us:',
      {
        list: [
          'Render: hosting of the website and server.',
          'Neon: database storage.',
          'Cloudinary: storage and delivery of listing photos.',
          'Brevo: sending emails.',
          'An SMS provider, if and when we turn on phone-number verification.',
        ],
      },
      'We may also share information with the police or other authorities when the law requires it.',
    ],
  },
  {
    title: '6. Data stored outside Kenya',
    body: [
      'Our providers keep data on servers outside Kenya, including in Europe and the United States. We choose established providers and rely on their security and contractual safeguards for these transfers.',
    ],
  },
  {
    title: '7. How long we keep it',
    body: [
      'We keep your data while your account is open. When you delete your account, we remove your profile, listings, photos, messages, offers, reviews and reports from our live systems, though copies may remain in our providers\' backups for a short time. We keep the data of suspended accounts so that the suspension can be enforced.',
    ],
  },
  {
    title: '8. How we protect it',
    body: [
      {
        list: [
          'Passwords are hashed, and connections use HTTPS.',
          'Login attempts, messages and sign-ups are rate-limited, and accounts lock after repeated failed logins.',
          'Administrator access is restricted and logged.',
        ],
      },
      'No system is perfectly secure. If a breach affects your data, we will tell you and the Office of the Data Protection Commissioner as the law requires.',
    ],
  },
  {
    title: '9. Your rights',
    body: [
      'Under the Kenya Data Protection Act, 2019 you can ask to see your data, correct it, delete it, restrict or object to how we use it, and receive a copy of it. You can also withdraw consent where we rely on it.',
      `Two of these are built in: on the My account page you can download your data and delete your account. For anything else, email ${SITE.contactEmail} and we will respond promptly and within the time the law requires.`,
    ],
  },
  {
    title: '10. Cookies',
    body: [
      'We use one essential cookie that keeps you logged in (it is HttpOnly and lasts up to 7 days). We do not use advertising or analytics cookies.',
    ],
  },
  {
    title: '11. Children',
    body: ['BarterTrade is for people aged 18 and over. If we learn that a child has an account, we will delete it.'],
  },
  {
    title: '12. Complaints and changes',
    body: [
      'Please contact us first so we can try to fix the problem. You also have the right to complain to the Office of the Data Protection Commissioner of Kenya (www.odpc.go.ke).',
      'If we change this policy in an important way, we will tell you by email or a notice on the site.',
    ],
  },
];

export default function Privacy() {
  return <LegalPage title="Privacy Policy" updated={SITE.updated} sections={sections} />;
}