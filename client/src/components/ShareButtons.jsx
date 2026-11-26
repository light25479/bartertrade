import { useState } from 'react';

export default function ShareButtons({ title, text }) {
  const [copied, setCopied] = useState(false);
  const url = window.location.href;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', url);
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text, url });
    } catch {
      /* the person closed the share sheet */
    }
  }

  return (
    <div className="share-row">
      <a
        className="share-btn wa"
        href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Share on WhatsApp
      </a>
      <button type="button" className="share-btn" onClick={copy}>
        {copied ? 'Link copied ✓' : 'Copy link'}
      </button>
      {typeof navigator.share === 'function' && (
        <button type="button" className="share-btn" onClick={nativeShare}>More...</button>
      )}
    </div>
  );
}