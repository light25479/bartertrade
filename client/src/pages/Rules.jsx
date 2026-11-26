import LegalPage from '../components/LegalPage';
import { SITE } from '../siteConfig';

const sections = [
  {
    title: 'Stay safe when you trade',
    body: [
      {
        list: [
          'Meet in a busy public place, in daylight, and bring a friend if you can.',
          'Inspect the item before you pay or hand over yours. Test electronics and check serial numbers.',
          'Never pay in advance. Real sellers do not need a "deposit", "booking fee" or "delivery fee" before you see the item.',
          'Keep conversations on BarterTrade. Be careful if someone pushes you to move to WhatsApp, Telegram or another app.',
          'Be wary of prices that are far too good to be true, and of anyone who refuses to meet or let you inspect the item.',
          'Do not share your ID, bank details, M-Pesa PIN or one-time codes with anyone. We will never ask for them.',
        ],
      },
    ],
  },
  {
    title: 'Common scams',
    body: [
      {
        list: [
          'The "overpayment": a buyer sends too much money and asks for the difference back.',
          'The "courier": a seller in another town asks you to pay for delivery first.',
          'The "fake payment message": a buyer shows a fake M-Pesa confirmation. Check your own balance, not a screenshot.',
          'The "verification code" trick: someone asks you to read out a code sent to your phone.',
        ],
      },
    ],
  },
  {
    title: 'Items that are not allowed',
    body: [
      {
        list: [
          'Firearms, ammunition, explosives and other weapons.',
          'Illegal drugs, prescription medicines, alcohol, tobacco and e-cigarettes.',
          'Stolen goods, phones with altered or missing IMEI numbers, and counterfeit or fake branded goods.',
          'Pirated software, films and music.',
          'Protected wildlife and wildlife products (such as ivory, skins or bushmeat).',
          'IDs, passports, bank cards, registered SIM cards, and other people\'s personal documents.',
          'Hacked accounts, stolen data, login details, and tools for fraud or hacking.',
          'Money, loans, betting accounts, investment schemes, and jobs that require a fee.',
          'Houses, land and rentals (they are a common target for fraud, so they are not supported for now).',
          'Adult sexual content or services, and human body parts.',
          'Dangerous chemicals, banned pesticides, and anything else illegal in Kenya.',
        ],
      },
    ],
  },
  {
    title: 'Reporting a problem',
    body: [
      'Use the Report button on any listing, conversation or profile. Reports are reviewed by our team. A listing reported by several different people is hidden automatically until we check it.',
      `If you were scammed, also report it to the police (and keep your messages as evidence), and email ${SITE.contactEmail}. We may suspend accounts that break these rules.`,
    ],
  },
];

export default function Rules() {
  return <LegalPage title="Safety & rules" updated={SITE.updated} sections={sections} />;
}