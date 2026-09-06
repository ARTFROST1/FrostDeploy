# Images

Put real project images here and reference them by absolute path
(`/images/gallery/1.webp`).

## Conventions
- **Format:** WebP (or AVIF). Convert JPEG/PNG before committing.
- **Sizing:** export at the size actually rendered (don't ship a 4000px image
  into a 400px card). Provide 2× for retina at most.
- **Naming:** lowercase, kebab-case, or numbered (`1.webp`, `2.webp`).
- **Alt text:** always set meaningful `alt` in the markup — never leave empty
  for content images (empty alt is only for decorative images).

## Suggested folders
- `hero/` — hero backgrounds (large, preloaded)
- `gallery/` — gallery grid
- `blog/` — blog post images
- `og/` → actually lives in `/public/og/` (1200×630 social preview images)

`placeholder.svg` ships with the template — delete it once real images are in.
