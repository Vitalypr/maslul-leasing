/**
 * A vehicle photograph, or nothing at all.
 *
 * The photographs come from Wikimedia Commons and are normalised at build time
 * to one frame — 16:10, 1000x625, centre-cropped — and thirteen of them were
 * mirrored so the whole fleet faces the same way. That work is done before the
 * file lands here, so this component only has to place it.
 *
 * Two of the forty-three cars have no photograph: CITY 5, whose identity the
 * price list never states, and the Chery FX, which Commons does not cover.
 * They render the plate instead of a broken image. A missing photo must never
 * look like a loading failure, and must never borrow another car's picture.
 */

// Eager so a missing file is a build-time absence rather than a runtime 404.
const PHOTOS = import.meta.glob<{ default: string }>(
  '../data/assets/vehicles/*.jpg',
  { eager: true },
)

const BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(PHOTOS).map(([path, mod]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.jpg'.length),
    mod.default,
  ]),
)

export function hasPhoto(vehicleId: string): boolean {
  return vehicleId in BY_ID
}

export type VehicleImageProps = {
  vehicleId: string
  /** Read out to screen readers, so it must name the car, not the file. */
  altHe: string
  className?: string
  /** The detail view loads its image immediately; cards below the fold wait. */
  priority?: boolean
}

export function VehicleImage({ vehicleId, altHe, className, priority }: VehicleImageProps) {
  const src = BY_ID[vehicleId]

  if (src === undefined) {
    return (
      <div
        className={className}
        role="img"
        aria-label={`אין תצלום זמין ל${altHe}`}
        style={{
          aspectRatio: '16 / 10',
          display: 'grid',
          placeItems: 'center',
          background: 'var(--sunk)',
          color: 'var(--faint)',
          fontSize: '12px',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '12px',
        }}
      >
        אין תצלום זמין
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={altHe}
      className={className}
      loading={priority === true ? 'eager' : 'lazy'}
      decoding="async"
      width={1000}
      height={625}
      style={{ aspectRatio: '16 / 10', objectFit: 'cover', display: 'block', width: '100%' }}
    />
  )
}
