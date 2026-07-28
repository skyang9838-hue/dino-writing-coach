// The 디노 mascot as an image instead of the 🦕 emoji, which renders as a flat
// lizard on Windows and looks nothing like the character in design-reference/.
// Poses are cropped from design-reference/디노 캐릭터.png into public/dino/.
// Decorative only — the surrounding heading always carries the real text.
export function DinoIcon({ pose = 'wave', size = 'md', className = '' }) {
  return (
    <img
      src={`/dino/pose-${pose}.png`}
      alt=""
      aria-hidden="true"
      className={`dino-icon dino-icon-${size} ${className}`.trim()}
    />
  )
}
