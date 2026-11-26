const pool = require('./db');

// Link-preview crawlers (WhatsApp, Facebook, Telegram, X, LinkedIn, Slack, Discord...)
const BOT = /(whatsapp|facebookexternalhit|facebot|twitterbot|telegrambot|linkedinbot|slackbot|discordbot|skypeuripreview|embedly|pinterestbot)/i;
const LISTING_PATH = /^\/listing\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/?$/i;

// Listing text is written by users, so it must be escaped before going into the page
const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

// Ask Cloudinary for a 1200x630 lightweight copy, which is what preview cards want
function previewImage(url) {
  return url.includes('/upload/') ? url.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_auto:eco,f_jpg/') : url;
}

function metaTags({ title, description, url, image }) {
  const lines = [
    `<meta name="description" content="${esc(description)}">`,
    '<meta property="og:site_name" content="BarterTrade">',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta name="twitter:title" content="${esc(title)}">`,
    `<meta name="twitter:description" content="${esc(description)}">`,
  ];
  if (image) {
    lines.push(
      `<meta property="og:image" content="${esc(image)}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta name="twitter:image" content="${esc(image)}">`,
      '<meta name="twitter:card" content="summary_large_image">'
    );
  } else {
    lines.push('<meta name="twitter:card" content="summary">');
  }
  return lines.join('\n');
}

async function listingMeta(id, origin) {
  const { rows } = await pool.query(
    `SELECT l.title, l.description, l.listing_type, l.price_kes, l.county,
            (SELECT url FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS image_url
     FROM listings l JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.status IN ('active', 'traded') AND u.status = 'active'`,
    [id]
  );
  const l = rows[0];
  if (!l) return null;

  const kes = l.price_kes != null ? `KES ${Number(l.price_kes).toLocaleString('en-KE')}` : '';
  const price =
    l.listing_type === 'swap' ? 'Swap only' : l.listing_type === 'both' ? `${kes} or swap` : kes;
  const place = l.county ? ` · ${l.county}` : '';
  const description = `${price}${place} — ${l.description}`.replace(/\s+/g, ' ').slice(0, 200);

  return {
    title: `${l.title} – ${price}`,
    description,
    url: `${origin}/listing/${id}`,
    image: l.image_url ? previewImage(l.image_url) : null,
  };
}

// Returns the website's index.html with preview tags added to the <head>
async function renderPage(indexHtml, req, { origin, hasDefaultImage }) {
  let meta = {
    title: 'BarterTrade – swap or sell what you no longer need',
    description: 'Post items you no longer need, then sell or swap them with people near you in Kenya.',
    url: `${origin}${req.path}`,
    image: hasDefaultImage ? `${origin}/og-default.png` : null,
  };

  const match = req.path.match(LISTING_PATH);
  if (match && BOT.test(req.get('user-agent') || '')) {
    try {
      const found = await listingMeta(match[1], origin);
      if (found) meta = found;
    } catch (err) {
      console.error('Preview lookup failed:', err.message);
    }
  }

  // A function is used so "$" characters in listing text are never treated as special
  return indexHtml.replace('</head>', () => `${metaTags(meta)}\n</head>`);
}

module.exports = { renderPage };