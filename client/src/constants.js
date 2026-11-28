export const CATEGORIES = [
  'Electronics',
  'Phones & Tablets',
  'Home & Furniture',
  'Clothing & Shoes',
  'Books & Education',
  'Vehicles & Parts',
  'Sports & Fitness',
  'Baby & Kids',
  'Tools & Equipment',
  'Farming & Agriculture',
  'Other',
];

export const CONDITIONS = {
  new: 'New',
  like_new: 'Like new',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

export function priceLabel(l) {
  if (l.listing_type === 'swap') return 'Swap only';
  const price = `KES ${Number(l.price_kes).toLocaleString()}`;
  return l.listing_type === 'both' ? `${price} or swap` : price;
}
// Smaller, lighter copies of photos from Cloudinary. This saves a lot of mobile data.
export function thumb(url, width = 400) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_fill,w_${width},h_${Math.round(width * 0.75)},q_auto,f_auto/`);
}

export function fit(url, width = 1000) {
  if (!url || !url.includes('/upload/')) return url;
  return url.replace('/upload/', `/upload/c_limit,w_${width},q_auto,f_auto/`);
}
export const slugify = (c) =>
  c.toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const categoryFromSlug = (slug) => CATEGORIES.find((c) => slugify(c) === slug);