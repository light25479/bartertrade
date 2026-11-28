import { useEffect } from 'react';

// Sets the browser tab title, and the title search engines see after the page runs
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | BarterTrade` : 'BarterTrade – swap or sell items near you in Kenya';
  }, [title]);
}