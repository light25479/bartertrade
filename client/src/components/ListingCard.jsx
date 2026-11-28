import { Link } from 'react-router-dom';
import { CONDITIONS, priceLabel, thumb } from '../constants';

export default function ListingCard({ listing }) {
  return (
    <Link to={`/listing/${listing.id}`} className="listing-card">
      <div className="thumb">
        {listing.image_url ? (
          <img src={thumb(listing.image_url, 400)} alt={listing.title} loading="lazy" />
        ) : (
          <div className="no-image">No photo</div>
        )}
      </div>
      <div className="info">
        <strong>{listing.title}</strong>
        <span className="price">{priceLabel(listing)}</span>
        {listing.wanted_in_exchange && <span className="wants">Wants: {listing.wanted_in_exchange}</span>}
        <span className="meta">
          {CONDITIONS[listing.item_condition]}
          {listing.county ? ` · ${listing.county}` : ''}
        </span>
      </div>
    </Link>
  );
}