// The BarterTrade symbol (bag and box with swap arrows)
export default function LogoMark({ size = 40 }) {
  return (
    <img
      src="/logo-mark.png"
      alt=""
      height={size}
      style={{ height: size, width: 'auto', display: 'block' }}
    />
  );
}