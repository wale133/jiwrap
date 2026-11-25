# Jiwrap website — Phase 1 frontend

A responsive Next.js + TypeScript + CSS frontend starter for Jiwrap.

## Brand system
- Burgundy: `#651F35`
- Charcoal: `#25252A`
- Burnt Orange: `#F15A24`
- Ivory: `#F3EDE5`

## Run locally
1. Install Node.js 20.9 or newer.
2. Open this folder in VS Code.
3. Open the terminal and run:
   ```bash
   npm install
   npm run dev
   ```
4. Visit http://localhost:3000

## Phase 1 functionality included
- Responsive homepage, navigation and mobile menu
- Category section and category filtering
- Featured products and product search
- Add-to-cart counter (frontend demonstration only)
- Custom-order call to action
- Responsive footer and newsletter UI (not connected yet)

## Important implementation notes
- No database, authentication, real checkout, payment processing or admin dashboard is connected in Phase 1.
- Product names, prices and categories in `lib/products.ts` are sample content and must be confirmed before launch.
- Product photos currently use remote Unsplash image URLs. Replace these with approved Jiwrap product photography before production.
- The original supplied logo is preserved at `public/jiwrap-logo-original.png`. The header currently uses a text wordmark placeholder because the supplied logo artwork is green while the approved website palette is burgundy/charcoal/orange/ivory. Confirm whether a burgundy logo master exists before replacing the placeholder; do not recolour the supplied logo without approval.
- The WhatsApp custom-order URL contains a placeholder number (`2340000000000`) and must be replaced with Jiwrap's verified business number.
