/**
 * Decorative aurora mesh.
 *
 * Three oversized radial-gradient "clouds" drift on independent 26–38s loops
 * over a very faint grid and a grain overlay. Everything is CSS: no canvas, no
 * animation library, no timers, nothing to tear down.
 *
 * Purely decorative, so it is hidden from assistive technology and never
 * captures pointer events. Under `prefers-reduced-motion: reduce` the clouds
 * stay put (see index.css) — the composition still looks intentional.
 */

const BLOBS = [
  {
    // Indigo — anchored top-left, the densest area.
    className: 'aurora__blob aurora__blob--a -left-[18%] -top-[28%] h-[42rem] w-[42rem]',
    color: 'rgb(99 102 241 / 0.42)',
  },
  {
    // Violet — pushed right so the card has a bright edge to sit against.
    className: 'aurora__blob aurora__blob--b -right-[16%] -top-[12%] h-[36rem] w-[36rem]',
    color: 'rgb(139 92 246 / 0.34)',
  },
  {
    // Cyan — low and wide, gives the mesh a cool base and depth.
    className: 'aurora__blob aurora__blob--c left-[12%] -bottom-[32%] h-[38rem] w-[52rem]',
    color: 'rgb(6 182 212 / 0.24)',
  },
  {
    // Warm accent — a single small rose cloud stops the palette going monochrome.
    className: 'aurora__blob aurora__blob--a left-[46%] top-[24%] h-[24rem] w-[24rem]',
    color: 'rgb(244 114 182 / 0.16)',
  },
];

export const AuroraBackground = ({ className = '', grid = true, grain = true }) => (
  <div className={`aurora animate-fade-in ${className}`} aria-hidden="true">
    {BLOBS.map((blob, index) => (
      <div
        key={index}
        className={blob.className}
        style={{ '--aurora-color': blob.color }}
      />
    ))}
    {grid && <div className="aurora__grid" />}
    {grain && <div className="aurora__grain" />}
  </div>
);

export default AuroraBackground;
