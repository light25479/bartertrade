import LegalPage from '../components/LegalPage';
import { SITE } from '../siteConfig';

const sections = [
  {
    title: '1. What BarterTrade is',
    body: [
      `${SITE.name} is an online marketplace operated by ${SITE.operator} in Kenya. It lets people post items they no longer need, sell or swap them, and contact each other.`,
      'We only provide the platform. We are not a buyer or seller, we never hold goods or money, and we are not part of any deal between users. BarterTrade does not process payments.',
    ],
  },
  {
    title: '2. Who can use it',
    body: [
      {
        list: [
          'You must be 18 or older (or of legal age where you live).',
          'The information you give us must be true and kept up to date.',
          'One person, one account. Do not create extra or fake accounts.',
          'Keep your password secret and tell us if you think someone else is using your account.',
        ],
      },
    ],
  },
  {
    title: '3. Your listings',
    body: [
      'When you post an item you confirm that:',
      {
        list: [
          'you own it or have the right to sell or swap it;',
          'the description and photos are accurate and are yours (or you have the right to use them);',
          'it is not on the list of items that are not allowed (see Safety & rules).',
        ],
      },
      'We may hold a listing for review, remove it, or ask you to change it if it breaks these terms or looks unsafe.',
    ],
  },
  {
    title: '4. Trading is at your own risk',
    body: [
      'Deals happen directly between users. You are responsible for checking the item, agreeing the terms, and meeting safely. We do not guarantee the quality, legality or safety of any item, or the identity or honesty of any user, even when an account shows verification badges or good reviews.',
      'Never pay in advance, and never send "deposits" or "delivery fees". Read our Safety & rules page before you trade.',
    ],
  },
  {
    title: '5. Behaviour that is not allowed',
    body: [
      {
        list: [
          'Fraud, scams, fake listings or taking money without delivering.',
          'Harassment, threats, hate or abuse.',
          'Spam, adverts, or repeatedly contacting people who do not want to be contacted.',
          'Trying to get around our limits, verification or security, or collecting data from the site automatically.',
          'Posting other people\'s personal information without permission.',
          'Using BarterTrade for anything illegal in Kenya.',
        ],
      },
    ],
  },
  {
    title: '6. Messages, reviews and reports',
    body: [
      'Reviews must be honest and based on a real trade. Fake reviews, or swapping reviews with friends, are not allowed.',
      'We run automated checks on listings and messages to spot scam patterns. Where needed to investigate a report, fraud, or a legal request, an administrator may review the relevant messages and information.',
    ],
  },
  {
    title: '7. Our right to act',
    body: [
      `We may hold, remove or edit content, and suspend or end accounts, to keep the platform safe, including without notice where there is fraud or a safety risk. If you think we made a mistake, email ${SITE.contactEmail}.`,
    ],
  },
  {
    title: '8. Your content',
    body: [
      'You keep ownership of what you post. You give us a non-exclusive, worldwide, free licence to store, display and share it on BarterTrade so the service can work. This ends when you delete the content or your account, apart from short-term backups.',
    ],
  },
  {
    title: '9. The service',
    body: [
      'BarterTrade is free to use at the moment. It may be interrupted, changed or stopped, and we may introduce fees in future (we will tell you first).',
    ],
  },
  {
    title: '10. Limits on our responsibility',
    body: [
      'To the fullest extent allowed by Kenyan law, BarterTrade is provided "as is". We are not responsible for loss or damage from deals between users, for what users post, or for interruptions to the service. Nothing in these terms limits responsibility that cannot be limited by law.',
    ],
  },
  {
    title: '11. Ending your account',
    body: [
      'You can delete your account at any time from My account. We may suspend or end accounts that break these terms.',
    ],
  },
  {
    title: '12. Changes and governing law',
    body: [
      'We may update these terms. If we make an important change we will tell you by email or a notice on the site. Continuing to use BarterTrade after a change means you accept it.',
      'These terms are governed by the laws of Kenya, and the courts of Kenya have jurisdiction.',
    ],
  },
  {
    title: '13. Contact',
    body: [`${SITE.operator} · ${SITE.contactEmail}`],
  },
];

export default function Terms() {
  return <LegalPage title="Terms of Use" updated={SITE.updated} sections={sections} />;
}