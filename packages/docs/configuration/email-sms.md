# 📧 Email & SMS

KitchenAsty can send transactional emails and SMS messages through the [Automation](/features/automation) system.

## 📬 SMTP Configuration

```dotenv
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM=noreply@kitchenasty.com
```

## 🧪 Development Email

For local development, use [Mailhog](https://github.com/mailhog/MailHog) to capture emails without sending them:

```bash
# Run Mailhog via Docker
docker run -d -p 1025:1025 -p 8025:8025 mailhog/mailhog
```

Then configure:

```dotenv
SMTP_HOST=localhost
SMTP_PORT=1025
```

View captured emails at http://localhost:8025.

## 📝 Email Templates

Emails are sent through automation rules. The automation action `type: "email"` supports template variables that are replaced at send time:

| Variable | Description |
|----------|------------|
| <code v-pre>{{customer.name}}</code> | Customer's name |
| <code v-pre>{{customer.email}}</code> | Customer's email |
| <code v-pre>{{order.orderNumber}}</code> | Order number |
| <code v-pre>{{order.total}}</code> | Order total |
| <code v-pre>{{order.status}}</code> | Current order status |
| <code v-pre>{{location.name}}</code> | Location name |

See [Automation](/features/automation) for details on creating email rules.

## 📱 SMS

SMS can be sent via automation actions with `type: "sms"`. Configure your SMS provider credentials:

```dotenv
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_FROM_NUMBER=+1234567890
```

SMS uses the same template variables as email.

## 🔔 Order-Ready Notifications

The [ready-for-collection fan-out](/features/order-notifications) reuses this configuration:

- **Email** works out of the box once SMTP is configured — enabled by default.
- **SMS** additionally requires the Twilio variables above **and** turning on `readySmsEnabled` under **Settings → Notifications** (off by default because each message costs money).
- **Push** needs no configuration — Expo push tokens are registered by the mobile app — and is enabled by default.

Channel toggles live at `PUT /api/settings/notifications` (`readyEmailEnabled`, `readySmsEnabled`, `readyPushEnabled`).
