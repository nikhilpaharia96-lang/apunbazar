# ApunBazar — Updated Audit Report

Branch: `audit/security-checkout-fixes` (based on `main`; `main` untouched).

## Verified results
| Gate | Result |
|---|---|
| Backend integration tests (real PostgreSQL 16) | **33 / 33** |
| Browser purchase journeys (headless Chrome, real API + DB) | **78 / 78** (mobile 390px, tablet 820px, desktop 1440px) |
| Typecheck · ESLint · frozen-lockfile install · builds | pass · 0 errors (48 warnings) · pass · pass |

## Critical defects found and fixed
**Security / money**
1. Product create/edit/delete, order list/update were unauthenticated → permission-checked (live DB check for staff).
2. Order totals trusted client prices → server computes price, shipping, coupon, total.
3. Razorpay payments were never verified server-side → order-bound HMAC verification, signed webhook, idempotent, amount-checked.
4. No stock reservation (overselling) → atomic reservation; cancel/expiry restocks once; full stock ledger.
5. Coupons/shipping lived in browser localStorage → database-backed, validated and applied server-side.
6. Hard-coded DB password in a public repo → removed (rotate it; it remains in git history).
7. Unvalidated image URLs (`javascript:` etc.) → strict validation; real upload endpoint checks magic bytes, size, dimensions, rejects SVG.
8. Unpaid online orders held stock forever → auto-expiry (gateway-checked, multi-instance safe); late payments become "refund needed".
9. Malformed JSON returned 500 → 400/413.
10. `trust proxy` hard-coded; rate limit counted image requests → configurable, images exempt.

**Customer-facing bugs found by real-browser testing**
11. **Checkout fields accepted only one character** (input component re-created on every render) — pre-existing on `main`. Fixed.
12. Admin/staff login called a hard-coded backend host → same-origin `/api`.
13. Payment: customer paying then closing the tab, dismissing the modal, or failing verification could not recover → retry from the order page.
14. Order tracking by email alone leaked every customer's orders (substring match) → email + phone, exact match.
15. Mobile checkout: no numeric keypad for phone/pincode, no autofill hints, 13.5px inputs (iOS zoom), small coupon tap target → fixed.
16. Admin analytics: revenue counted cancelled/unpaid orders, category sales double-counted, "top products" ranked by reviews, UTC days → corrected.

**New capabilities**: customer accounts (register/login/saved address/order history), admin Analytics, Customers, Inventory, Payments, Reports/CSV (formula-injection safe), order search/filters, image upload, per-page SEO + Product JSON-LD, responsive WebP images.

## Performance & accessibility (measured, mobile, throttled CPU)
- Product list transfer 2.2 MB → 1.3 MB; product page 972 → 509 KB. Storefront no longer downloads the 424 KB admin charts bundle.
- Accessibility (axe, WCAG A/AA): ~360 violating nodes incl. 77 critical → 69 (colour contrast only).

## Remaining issues / not done
- Customer accounts: no email verification or password reset (needs an email provider).
- The storefront is client-rendered: Google can index it, but social-share previews won't show per-product details without pre-rendering/SSR.
- The home page hot-links third-party images (several tourism sites, edgeone.app). Upload your own banners in Admin → Page Banners.
- Remaining contrast failures (~69 nodes, small gold/grey labels).
- Razorpay was exercised through a local stand-in; run one real test-mode payment with your keys before launch.
- Real-device testing (iOS Safari / Android Chrome) and Lighthouse on production URL not done.
- Categories API still admin-only and unvalidated; hero/banner admin pages not re-audited.
- Not every storefront page was visually redesigned; the existing design was kept and refined.
