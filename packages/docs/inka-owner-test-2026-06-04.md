---
title: Inka — Owner Test Sheet (2026-06-04 freeze)
---

# Inka — what to try, what to look for

This is the frozen demo build for `inka.kitchenasty.com` and the bundled
Android APK. Tag: `inka-freeze-2026-06-04`.

If something doesn't behave the way you expect, just send back the
section number + a one-line note (e.g. "3.b — discount didn't show").

## Login

| URL | inka.kitchenasty.com |
| Admin login | https://inka.kitchenasty.com/admin/login |
| Admin user | `admin@kitchenasty.com` / `admin123` (please change on first login) |
| Customer | Register a new account, or use the **Continue as guest** flow at checkout. |
| Social login | **Google** and **Microsoft** button is visible but needs the Azure AD app registration before it will land — leave it for now. |

---

## 1. Daily menu — what's on tomorrow

1. Open `/menu` on web or **Tomorrow** in the app.
2. The dishes shown there are whatever the admin published for **tomorrow**.
3. Days where no menu has been published should land on a friendly empty state, not a 500.

**What changed** — the menu is now date-keyed. Each weekday can carry a
different set of dishes. The admin can curate this from
`/admin/menu-publications`.

## 2. Multi-day cart — pre-pick the whole week

1. Open a dish. The day picker shows the next 5 working days (Mon–Fri).
2. Multi-select two or three days, then **Add to cart**.
3. Repeat for a different dish.
4. Open the cart — items are **grouped by day** with a per-day subtotal.
5. Web checkout should **not** ask for a delivery date again (each line
   already carries its own `forDate`).
6. Pickup orders should behave the same — no schedule step.

**Edge cases to try:**
- Add the same dish for **two** different days. Both lines should survive
  with the right `forDate` each.
- Hit "Remove" on one day; the other day's line should stay.

## 3. Coupon codes

Public test code (seeded): `WELCOME10` (10 % off), `FREESHIP` (free delivery — web only).
Admin can mint more at `/admin/coupons`.

1. **Web**: on Checkout, enter the code → **Apply**.
   - You should see a "−€X.XX applied" green line under the field.
   - The Summary should show a `Coupon WELCOME10  −€X.XX` row.
   - The total should drop accordingly.
   - **Clear** should remove it and restore the original total.
2. **Mobile**: same field on the Cart screen, above "Summary".
   - Apply works the same way; "You pay" updates.
   - The code is cleared once the order is placed (sanity).
3. Invalid / expired codes should surface a red error line, not crash.
4. `FREESHIP` should zero the delivery fee instead of carrying an amount.

## 4. Lock-in cutoff

The site has an order cutoff time (default **21:00 server-local**) for
"tomorrow" dishes. After cutoff:

1. Try adding a dish with `forDate = tomorrow` after 21:00.
2. The order should be **refused** with a 400 (web shows a banner, app
   shows the error inline) — not a 500 / silent fail.
3. The admin can adjust the cutoff in `/admin/settings → order settings →
   lockInCutoff` (24-hour `HH:mm`).

## 5. Company allowance — corporate-lunch math

If your customer is mapped to a company (e.g. Northwind, €8/day):

1. Build a cart that spans Mon + Tue + Wed.
2. On checkout / cart summary, the Total Due should reflect a
   per-weekday allowance (€24 in the Northwind case) — not just one.
3. Weekend dishes (if any get through) should **not** receive the
   allowance.
4. Loyalty discount + Coupon + Allowance should stack in this order:
   `Total = Subtotal + Tax + Delivery − Loyalty − Coupon − Allowance`.

## 6. Stripe checkout (test mode)

Use Stripe test cards:
- `4242 4242 4242 4242` — success
- `4000 0027 6000 3184` — requires 3D-Secure (auth prompt)
- `4000 0000 0000 9995` — payment declined

1. **Mobile**: PaymentSheet pops up natively.
2. **Web**: redirects to hosted Stripe Checkout.
3. After success, the Confirmation page should appear and the order
   should show as **CONFIRMED** within ~5 seconds (webhook).
4. If you dismiss the Stripe sheet on mobile, the cart should still be
   intact and no error toast should fire.
5. Guest checkout should land you on the same Confirmation screen.

## 7. Stripe → Refund

(Admin)

1. Open `/admin/orders → <a CONFIRMED order>`.
2. Issue a refund — it should appear in the Stripe Dashboard test data
   within a few seconds.
3. Order status flips to `REFUNDED`.

## 8. Mobile-only

1. **App icon + splash** — should be the official Eat Inka mark.
2. **Sign in with Google** — should work on a fresh install.
3. **Sign in with Apple** — will be wired before App Store submission;
   the button is hidden in this freeze.
4. **No splash on relaunch** — splash is a once-on-first-open thing now.
5. **Empty states** — pull the wifi mid-load and confirm you see a
   spinner / friendly retry, not a blank screen.
6. **Cart → location row** — tap the "Pickup / Delivery" row. The sheet
   should let you toggle Pickup vs Delivery; Delivery collects a free-
   form address (line 1, optional line 2, postcode, city, state). The
   chosen address shows back on the cart row.
7. **Profile → Payment & billing** — should show "Cards are handled by
   Stripe" plus your real past orders (not the mock card visual). Tap
   back arrow → should return to the profile screen.
8. **Guest order history** — place an order as a guest, force-quit the
   app, reopen → the order should still appear under /history and on
   Payment & billing receipts. Cached locally on this device only.

---

## What's intentionally not in this freeze

- Microsoft sign-in (Azure AD app registration is the gating item; the
  button appears but the route 404s until secrets are dropped into the
  Orca secret).
- Apple sign-in (mobile-only, needs Apple Developer account).
- Cookie banner / legal pages (separate task on the Inka TODO list).
- Driver role + delivery-card download (post-pitch follow-up).
- Kitchen-display test pass (waiting on owner walkthrough).
- Mobile geo-fenced delivery preview + "use my current location" GPS
  auto-fill (matches the website's ZonePreview — backlog).

---

## How to file a bug

For each finding, copy this:

```
Section: 3.b
Where: web Checkout, Safari iOS
What I did: applied WELCOME10 on a €18 cart
What I expected: see "−€1.80 applied"
What I saw: code stuck on "Checking…" and never returned
```

I'll pick those up from the freeze tag (`inka-freeze-2026-06-04`) so
nothing drifts mid-feedback.
