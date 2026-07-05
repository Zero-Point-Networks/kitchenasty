import prisma from './db.js';
import { orderReadyEmail, sendEmail } from './email.js';
import { sendSMS } from './sms.js';
import { sendExpoPush } from './socket.js';

export interface OrderReadyInfo {
  orderNumber: string;
  customer?: { email: string | null; phone: string | null; expoPushToken: string | null } | null;
  guestEmail?: string | null;
  guestPhone?: string | null;
  table?: { name: string } | null;
}

export interface ReadyChannelToggles {
  readyEmailEnabled: boolean;
  readySmsEnabled: boolean;
  readyPushEnabled: boolean;
}

// SMS is opt-in (per-message cost); push stays on to preserve the READY
// push app customers already received before this feature existed.
export const READY_NOTIFICATION_DEFAULTS: ReadyChannelToggles = {
  readyEmailEnabled: true,
  readySmsEnabled: false,
  readyPushEnabled: true,
};

async function getReadyConfig(): Promise<{ toggles: ReadyChannelToggles; siteName: string }> {
  try {
    const settings = await prisma.siteSettings.findUnique({ where: { id: 'default' } });
    const stored = (settings?.notificationSettings as Partial<ReadyChannelToggles>) || {};
    return {
      toggles: { ...READY_NOTIFICATION_DEFAULTS, ...stored },
      siteName: settings?.siteName || 'KitchenAsty',
    };
  } catch {
    return { toggles: READY_NOTIFICATION_DEFAULTS, siteName: 'KitchenAsty' };
  }
}

/**
 * Fan out a "ready for collection" notification on every enabled channel the
 * order has contact details for. Each channel is best-effort: a failure is
 * swallowed and never blocks the status update or the other channels.
 */
export async function notifyOrderReady(order: OrderReadyInfo): Promise<void> {
  const { toggles, siteName } = await getReadyConfig();

  const email = order.customer?.email ?? order.guestEmail;
  const phone = order.customer?.phone ?? order.guestPhone;
  const pushToken = order.customer?.expoPushToken;
  const tableName = order.table?.name || undefined;
  const tableSuffix = tableName ? ` — ${tableName}` : '';

  const sends: Promise<void>[] = [];

  if (toggles.readyEmailEnabled && email) {
    const content = orderReadyEmail({ orderNumber: order.orderNumber, tableName });
    sends.push(sendEmail({ to: email, ...content }).catch(() => {}));
  }

  if (toggles.readySmsEnabled && phone) {
    sends.push(
      sendSMS(phone, `${siteName}: order ${order.orderNumber} is ready for pickup${tableSuffix}`).catch(() => {}),
    );
  }

  if (toggles.readyPushEnabled && pushToken) {
    sends.push(
      sendExpoPush(
        pushToken,
        `Order #${order.orderNumber}`,
        `Your order is ready for collection${tableSuffix}.`,
        { orderNumber: order.orderNumber, status: 'READY' },
      ).catch(() => {}),
    );
  }

  await Promise.all(sends);
}
