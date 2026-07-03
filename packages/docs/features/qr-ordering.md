# 📱 QR / Dine-in Ordering

Diners scan a per-table QR code to open the menu pre-bound to their table, order without staff involvement, and either pay online or pay at the counter — freeing front-of-house staff from taking orders. It works for in-restaurant tables and for setups where guests order from elsewhere (e.g. a hotel room) and collect from the restaurant.

## How it works

1. An admin generates a QR code for each table (see below). Each code encodes an opaque, rotatable token in a storefront URL: `https://<your-storefront>/t/<token>`.
2. A diner scans the code. The storefront resolves the token, binds the session to that table, and opens the menu.
3. The diner builds an order and checks out as a **dine-in** order. No delivery address is required, and a guest can order anonymously.
4. At checkout the diner chooses **Pay at Counter** (the order is placed unpaid; staff settle it later) or an enabled online method.
5. The order appears in the admin order list and Kitchen Display with its table.

## Enabling dine-in

Dine-in is gated by the `dineInEnabled` flag in **Order Settings** (`orderSettings.dineInEnabled`). Enable it before sharing QR codes.

## Generating & printing table QR codes

In the admin app, open **Locations → (a location) → Tables**. Each table row has a **Generate QR** action:

- **Generate QR** creates the table's code and opens a printable QR modal.
- **Regenerate QR** rotates the token. ⚠️ This **invalidates any previously printed code** for that table — reprint and replace it.
- **Print** opens a print-friendly view (table name + QR) to print and place on the table.

## Order type & payment

| Aspect | Dine-in behaviour |
|--------|-------------------|
| Order type | `DINE_IN` (alongside `DELIVERY` / `PICKUP`) |
| Address | Not required |
| Guest contact | Optional (provide an email/phone for an order-ready update) |
| Delivery fee | None |
| Payment | Pay at counter (unpaid, settled by staff) or any enabled online provider |

## API reference

**Resolve a table from its QR token** (public):

```
GET /api/locations/tables/by-token/:qrToken
```

Returns `{ locationId, locationName, tableId, tableName }`, or `404` if the token is unknown or the table is inactive.

**Generate / rotate a table's QR token** (staff — `SUPER_ADMIN` / `MANAGER`):

```
POST /api/locations/:locationId/tables/:tableId/qr
Authorization: Bearer <staff-token>
```

Returns `{ qrToken, url }` where `url` is the storefront link the QR encodes (built from `PUBLIC_URL`).

**Create a dine-in order**: `POST /api/orders` with `orderType: "DINE_IN"` and `tableToken: "<qrToken>"`. See [Ordering](/features/ordering) for the full order payload.

::: tip Configure the storefront URL
The generated QR links use the server's `PUBLIC_URL` environment variable. Set it to your public storefront origin so printed codes resolve correctly.
:::
