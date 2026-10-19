# PCForge parts catalog

This package is a data-first catalog seed for the PCForge builder. It includes a normalized JSON database and a browser interface for browsing parts and reviewing a prospective build's compatibility.

## Files

- `parts.json` is the canonical product catalog. Each record has a stable ID, category, normalized specifications, compatibility fields, a manufacturer source URL, and a verification date.
- `index.html` is a no-dependency catalog viewer and compatibility preview. It labels conflicts, missing required parts, passed checks, and manual review items separately.
- `assembly.js` builds a live, interactive 3D assembly from the selected parts without a third-party rendering library or network dependency.

## Run locally

The page loads `parts.json` with `fetch`, so serve this folder over HTTP instead of opening the HTML as a `file://` URL. From this folder, run a local static server such as `python -m http.server 8000`, then open `http://localhost:8000`.

## Catalog rules

- The catalog is a curated starter set, not a complete retailer inventory.
- Prices and stock are blank by design. Add a retailer or pricing feed before presenting current offers.
- Product specifications link to manufacturer pages and are marked with a verification date. Refresh product data as manufacturers update their pages.
- GPU dimensions can differ between reference cards and add-in-board partner models. Compatibility checks ask for a final exact-model clearance check when the dimensions are not known.
- The browser checks CPU socket, listed CPU family and chipset support, memory type and capacity, DIMM count, M.2 count, form factor and interface, cooler socket and fit, motherboard-to-case form factor, GPU and PSU case clearance, GPU power recommendations, and PSU-to-system clearance.
- The PSU planning estimate uses the listed CPU power, GPU board power, 150W for other components, and 20% headroom, rounded up to the next 50W. It is a sizing guide; the GPU maker's recommendation and the exact PSU/GPU connector requirements still need confirmation.
- Green checks mean the listed specifications agree. Red checks indicate a listed conflict. Amber items need a manual check, and missing-part items identify the components needed to complete the build. The overall result is based only on catalog data; it is not a guarantee of operation.
- The preview cannot verify exact motherboard BIOS revisions, memory QVL results, partner-card dimensions, radiator placement and thickness, M.2 lane sharing, or exact retailer SKUs. Confirm these in the manufacturer's support pages and manuals before purchase.
- The 3D view includes procedural models for the catalog's PC components and peripherals. Drag to orbit, scroll to zoom, use the part chips to focus a component, or switch to exploded view. Geometry uses published dimensions and specs when present; unknown dimensions and product-specific cosmetic details are illustrative, not manufacturer CAD models.

## Extending the catalog

Add records to the `parts` array in `parts.json`. Keep IDs stable, use one of the existing category IDs when possible, put physical values in metric units, and provide a primary manufacturer `sourceUrl`. Add compatibility data separately from display specifications so the builder can compare normalized values without parsing marketing text.
