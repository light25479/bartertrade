const pool = require('./db');
const { CATEGORIES } = require('./categories');

// Search engines and link-preview bots. Only these get the extra database lookups.
const CRAWLER = /(googlebot|bingbot|duckduckbot|yandexbot|baiduspider|applebot|facebookexternalhit|facebot|twitterbot|whatsapp|telegrambot|linkedinbot|slackbot|discordbot|skypeuripreview|embedly|pinterestbot)/i;
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const LISTING_PATH = new RegExp(`^/listing/(${UUID})$`, 'i');
const CATEGORY_PATH = /^\/category\/([a-z0-9-]+)$/i;
const NOINDEX_PATH = /^\/(admin|messages|account|my-listings|new|verify|verify-email|reset-password|forgot-password|login|signup|user)(\/|$)/i;

const CONDITIONS = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair', poor: 'Poor' };
const SCHEMA_CONDITION = {
  new: 'https://schema.org/NewCondition',
  like_new: 'https://schema.org/UsedCondition',
  good: 'https://schema.org/UsedCondition',
  fair: 'https://schema.org/UsedCondition',
  poor: 'https://schema.org/UsedCondition',
};

const STATIC_PAGES = {
  '/': {
    title: 'BarterTrade – swap or sell items near you in Kenya',
    description: 'Post items you no longer need and swap or sell them with people near you in Kenya. Free to use.',
  },
  '/terms': { title: 'Terms of Use | BarterTrade', description: 'The rules for using BarterTrade.' },
  '/privacy': { title: 'Privacy Policy | BarterTrade', description: 'How BarterTrade collects, uses and protects your personal data.' },
  '/rules': {
    title: 'Safety tips and rules | BarterTrade',
    description: 'How to trade safely on BarterTrade, common scams to avoid, and which items are not allowed.',
  },
};

// Listing and profile text is written by users, so it is always escaped before going into the page
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const slugify = (c) => c.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const categoryFromSlug = (slug) => CATEGORIES.find((c) => slugify(c) === String(slug).toLowerCase());

// Small memory cache so crawler visits don't hit the database every time
const cache = new Map();
async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.until > Date.now()) return hit.value;
  const value = await fn();
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, until: Date.now() + ttlMs });
  return value;
}

const previewImage = (url) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/c_fill,w_1200,h_630,q_auto:eco,f_jpg/') : url;
const bodyImage = (url) =>
  url.includes('/upload/') ? url.replace('/upload/', '/upload/c_limit,w_800,q_auto,f_auto/') : url;

function priceText(l) {
  const kes = l.price_kes != null ? `KES ${Number(l.price_kes).toLocaleString('en-KE')}` : '';
  if (l.listing_type === 'swap') return 'Swap only';
  return l.listing_type === 'both' ? `${kes} or swap` : kes;
}

const clip = (s, n) => {
  const t = String(s).replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).trim()}…` : t;
};

function headTags(m) {
  const lines = [`<meta name="description" content="${esc(m.description)}">`];
  if (m.noindex) {
    lines.push('<meta name="robots" content="noindex, follow">');
  } else {
    lines.push(`<link rel="canonical" href="${esc(m.url)}">`);
  }
  lines.push(
    '<meta property="og:site_name" content="BarterTrade">',
    '<meta property="og:locale" content="en_KE">',
    '<meta property="og:type" content="website">',
    `<meta property="og:url" content="${esc(m.url)}">`,
    `<meta property="og:title" content="${esc(m.title)}">`,
    `<meta property="og:description" content="${esc(m.description)}">`,
    `<meta name="twitter:title" content="${esc(m.title)}">`,
    `<meta name="twitter:description" content="${esc(m.description)}">`
  );
  if (m.image) {
    lines.push(
      `<meta property="og:image" content="${esc(m.image)}">`,
      '<meta property="og:image:width" content="1200">',
      '<meta property="og:image:height" content="630">',
      `<meta name="twitter:image" content="${esc(m.image)}">`,
      '<meta name="twitter:card" content="summary_large_image">'
    );
  } else {
    lines.push('<meta name="twitter:card" content="summary">');
  }
  for (const ld of m.jsonLd || []) {
    // "<" is escaped so user text can never close the script tag
    lines.push(`<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  }
  return lines.join('\n');
}

const breadcrumb = (items) => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: it.url })),
});

async function latestListings(category) {
  const params = [];
  let where = "l.status = 'active' AND u.status = 'active'";
  if (category) {
    params.push(category);
    where += ' AND l.category = $1';
  }
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.listing_type, l.price_kes, l.county,
            (SELECT url FROM listing_images i WHERE i.listing_id = l.id ORDER BY position LIMIT 1) AS image_url
     FROM listings l JOIN users u ON u.id = l.user_id
     WHERE ${where} ORDER BY l.created_at DESC LIMIT 30`,
    params
  );
  return rows;
}

async function getListing(id) {
  const { rows } = await pool.query(
    `SELECT l.id, l.title, l.description, l.category, l.item_condition, l.listing_type, l.price_kes,
            l.county, l.status, l.created_at, u.name AS seller_name,
            COALESCE((SELECT json_agg(url ORDER BY position) FROM listing_images i WHERE i.listing_id = l.id), '[]') AS images
     FROM listings l JOIN users u ON u.id = l.user_id
     WHERE l.id = $1 AND l.status IN ('active', 'traded') AND u.status = 'active'`,
    [id]
  );
  return rows[0] || null;
}

function listHtml(heading, items) {
  const links = items
    .map(
      (l) =>
        `<li><a href="/listing/${l.id}">${esc(l.title)}</a> – ${esc(priceText(l))}${l.county ? ` · ${esc(l.county)}` : ''}</li>`
    )
    .join('');
  const cats = CATEGORIES.map((c) => `<a href="/category/${slugify(c)}">${esc(c)}</a>`).join(' · ');
  return `<main><h1>${esc(heading)}</h1><p>${cats}</p><ul>${links}</ul></main>`;
}

// Returns { status, html, noindex } for any page of the website
async function renderPage(indexHtml, req, { origin, hasDefaultImage }) {
  const path = req.path.replace(/\/+$/, '') || '/';
  const crawler = CRAWLER.test(req.get('user-agent') || '');
  const defaultImage = hasDefaultImage ? `${origin}/og-default.png` : null;

  const base = STATIC_PAGES[path] || STATIC_PAGES['/'];
  let page = { ...base, url: `${origin}${path === '/' ? '/' : path}`, image: defaultImage };
  let status = 200;
  let bodyHtml = '';

  if (NOINDEX_PATH.test(path)) page.noindex = true;

  try {
    if (path === '/') {
      page.jsonLd = [
        { '@context': 'https://schema.org', '@type': 'Organization', name: 'BarterTrade', url: origin, logo: `${origin}/logo.png` },
      ];
      if (crawler) {
        const items = await cached('home', 60000, () => latestListings(null));
        bodyHtml = listHtml('Swap or sell items near you in Kenya', items);
      }
    } else if (crawler && CATEGORY_PATH.test(path)) {
      const cat = categoryFromSlug(path.match(CATEGORY_PATH)[1]);
      if (!cat) {
        status = 404;
        page = { ...page, title: 'Page not found | BarterTrade', description: 'This page does not exist.', noindex: true };
      } else {
        const items = await cached(`cat:${cat}`, 60000, () => latestListings(cat));
        page = {
          title: `${cat} for sale or swap in Kenya | BarterTrade`,
          description: `Browse ${cat.toLowerCase()} that people near you want to sell or swap on BarterTrade.`,
          url: `${origin}/category/${slugify(cat)}`,
          image: items[0]?.image_url ? previewImage(items[0].image_url) : defaultImage,
          jsonLd: [
            breadcrumb([
              { name: 'Home', url: `${origin}/` },
              { name: cat, url: `${origin}/category/${slugify(cat)}` },
            ]),
          ],
        };
        bodyHtml = listHtml(`${cat} for sale or swap`, items);
      }
    } else if (crawler && LISTING_PATH.test(path)) {
      const id = path.match(LISTING_PATH)[1].toLowerCase();
      const l = await cached(`listing:${id}`, 120000, () => getListing(id));
      if (!l) {
        // Expired, removed or never existed: tell search engines properly
        status = 404;
        page = { ...page, title: 'Item not found | BarterTrade', description: 'This item is no longer available.', noindex: true };
        bodyHtml = '<main><h1>This item is no longer available</h1><p><a href="/">See what else is on BarterTrade</a></p></main>';
      } else {
        const price = priceText(l);
        const place = l.county ? ` · ${l.county}` : '';
        const images = (l.images || []).map(bodyImage);
        const url = `${origin}/listing/${l.id}`;

        const product = {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: l.title,
          description: clip(l.description, 500),
          category: l.category,
          url,
          itemCondition: SCHEMA_CONDITION[l.item_condition],
        };
        if (images.length) product.image = images;
        if (l.listing_type !== 'swap' && l.price_kes != null) {
          product.offers = {
            '@type': 'Offer',
            url,
            priceCurrency: 'KES',
            price: String(l.price_kes),
            availability: l.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
          };
        }

        page = {
          title: `${clip(l.title, 55)} – ${price} | BarterTrade`,
          description: clip(`${price}${place} — ${l.description}`, 155),
          url,
          image: l.images && l.images[0] ? previewImage(l.images[0]) : defaultImage,
          noindex: l.status === 'traded', // sold items are not worth showing in search results
          jsonLd: [
            product,
            breadcrumb([
              { name: 'Home', url: `${origin}/` },
              { name: l.category, url: `${origin}/category/${slugify(l.category)}` },
              { name: l.title, url },
            ]),
          ],
        };
        bodyHtml =
          `<main><p><a href="/">Home</a> › <a href="/category/${slugify(l.category)}">${esc(l.category)}</a></p>` +
          `<h1>${esc(l.title)}</h1><p>${esc(price)}</p>` +
          `<p>${esc(CONDITIONS[l.item_condition])}${esc(place)}</p>` +
          images.map((u) => `<img src="${esc(u)}" alt="${esc(l.title)}">`).join('') +
          `<p>${esc(l.description)}</p><p>Seller: ${esc(l.seller_name)}</p></main>`;
      }
    }
  } catch (err) {
    console.error('SEO render failed:', err.message);
  }

  let html = indexHtml
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(page.title)}</title>`)
    .replace('</head>', () => `${headTags(page)}\n</head>`);
  if (bodyHtml) html = html.replace('<div id="root"></div>', () => `<div id="root">${bodyHtml}</div>`);

  return { status, html, noindex: Boolean(page.noindex) };
}

// ---------- robots.txt and sitemap.xml ----------
function robotsHandler(origin) {
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /admin',
    'Disallow: /messages',
    'Disallow: /account',
    'Disallow: /my-listings',
    'Disallow: /new',
    'Disallow: /verify',
    'Disallow: /reset-password',
    'Disallow: /forgot-password',
    'Disallow: /user/',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');
  return (req, res) => res.type('text/plain').send(body);
}

async function buildSitemap(origin) {
  const [listings, cats] = await Promise.all([
    pool.query(
      `SELECT l.id, l.created_at FROM listings l JOIN users u ON u.id = l.user_id
       WHERE l.status = 'active' AND u.status = 'active' ORDER BY l.created_at DESC LIMIT 5000`
    ),
    pool.query(
      `SELECT DISTINCT l.category FROM listings l JOIN users u ON u.id = l.user_id
       WHERE l.status = 'active' AND u.status = 'active'`
    ),
  ]);

  const urls = [
    { loc: `${origin}/`, changefreq: 'hourly', priority: '1.0' },
    // Only categories that actually have items, so there are no empty pages
    ...cats.rows
      .filter((r) => CATEGORIES.includes(r.category))
      .map((r) => ({ loc: `${origin}/category/${slugify(r.category)}`, changefreq: 'daily', priority: '0.8' })),
    { loc: `${origin}/rules`, changefreq: 'monthly', priority: '0.4' },
    { loc: `${origin}/terms`, changefreq: 'yearly', priority: '0.2' },
    { loc: `${origin}/privacy`, changefreq: 'yearly', priority: '0.2' },
    ...listings.rows.map((r) => ({
      loc: `${origin}/listing/${r.id}`,
      lastmod: new Date(r.created_at).toISOString().slice(0, 10),
      changefreq: 'weekly',
      priority: '0.6',
    })),
  ];

  const items = urls
    .map(
      (u) =>
        `  <url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}` +
        `<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

function sitemapHandler(origin) {
  return async (req, res) => {
    try {
      const xml = await cached('sitemap', 60 * 60 * 1000, () => buildSitemap(origin));
      res.type('application/xml').send(xml);
    } catch (err) {
      console.error('Sitemap failed:', err.message);
      res.status(500).type('text/plain').send('Sitemap unavailable');
    }
  };
}

module.exports = { renderPage, robotsHandler, sitemapHandler };