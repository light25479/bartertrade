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