/**
 * A vehicle photograph, or nothing at all.
 *
 * All forty-three are studio cutouts from icar.co.il, normalised offline by
 * scripts/normalise-vehicle-images.py to one frame — 16:10, 1000x625, each car
 * cropped to its own bounding box and then scaled to fill the same share of
 * that frame. Normalising on the car rather than on the canvas is the whole
 * point: icar pads them inconsistently, so scaling the canvas leaves cars at
 * visibly different sizes. Because the source is a cutout on white, the
 * padding is invisible and nothing is ever cropped. The set is 3.0 MB, and
 * test/data/images.test.ts holds the geometry.
 *
 * The empty branch is kept even though nothing uses it today. A catalogue row
 * added without a photograph must render as a stated absence, never as a broken
 * image, and never by borrowing another car's picture.
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
