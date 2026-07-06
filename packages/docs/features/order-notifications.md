# 🔔 Order Status Notifications

KitchenAsty notifies customers as their order moves through the [status lifecycle](/features/ordering#-order-status-lifecycle). Every status change sends a generic status email (when the order has an email address) and a push notification to mobile-app customers.

The **READY** transition on a collectable order gets special treatment.

## 🍽️ Ready-for-Collection Fan-out

When staff mark a `PICKUP` or `DINE_IN` order as `READY`, a dedicated "ready for collection" message is sent on every enabled channel the order has contact details for:

| Channel | Contact used | Default | Notes |
|---------|--------------|---------|-------|
| 📧 Email | Customer email, or `guestEmail` | ✅ On | Dedicated ready-for-collection template (not the generic status email) |
| 📱 SMS | Customer phone, or `guestPhone` | ❌ Off | Requires [Twilio configuration](/configuration/email-sms#-sms); per-message cost |
| 🔔 Push | Customer's Expo push token | ✅ On | Mobile app accounts only — guest web orders can't receive push |

The generic status email and push are **suppressed** for this transition, so customers never get two messages for the same READY event. `DELIVERY` orders and all other status transitions keep the generic behaviour.

If a `DINE_IN` order has a table, the message includes the table label — e.g. *"order KA-123 is ready for pickup — Table 4"* — so guests (like motel rooms ordering by QR code) know where collection applies.

Orders with no contact details at all are skipped gracefully; the storefront's realtime order-status page still updates via Socket.IO.

## ⚙️ Channel Toggles

Admins with `SUPER_ADMIN` or `MANAGER` roles configure the channels under **Settings → Notifications** in the admin dashboard, backed by:

```
GET  /api/settings/notifications
PUT  /api/settings/notifications
```

| Setting | Default |
|---------|---------|
| `readyEmailEnabled` | `true` |
| `readySmsEnabled` | `false` |
| `readyPushEnabled` | `true` |

Notification sends are best-effort: a failing channel (SMTP down, Twilio misconfigured) never blocks the status update or the other channels.
