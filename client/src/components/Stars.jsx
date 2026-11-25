export default function Stars({ value }) {
  const n = Math.round(Number(value) || 0);
  return <span className="stars">{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>;
}