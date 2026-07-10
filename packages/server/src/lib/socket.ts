import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const expo = new Expo();

let io: Server | null = null;

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:5174'],
      credentials: true,
    },
  });

  io.on('connection', (socket: Socket) => {
    // Join order-specific room for customers tracking their order
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('leave:order', (orderId: string) => {
      socket.leave(`order:${orderId}`);
    });

    // Join kitchen room for staff viewing kitchen display
    socket.on('join:kitchen', () => {
      socket.join('kitchen');
    });

    socket.on('leave:kitchen', () => {
      socket.leave('kitchen');
    });
  });

  return io;
}

export function getIO(): Server | null {
  return io;
}

export function emitOrderStatusUpdate(
  order: {
    id: string;
    orderNumber: string;
    status: string;
    orderType: string;
    customerId?: string | null;
  },
  options?: { suppressPush?: boolean },
): void {
  if (!io) return;
  // Notify the specific order room (customer tracking)
  io.to(`order:${order.id}`).emit('order:statusUpdate', order);
  // Notify the kitchen display
  io.to('kitchen').emit('order:statusUpdate', order);

  // Send push notification to the customer, unless the caller sends a
  // dedicated notification for this transition (avoids double-push on READY)
  if (order.customerId && !options?.suppressPush) {
    sendPushNotification(order.customerId, order.orderNumber, order.status).catch(() => {});
  }
}

export async function sendExpoPush(
  token: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<void> {
  if (!Expo.isExpoPushToken(token)) return;

  const message: ExpoPushMessage = {
    to: token,
    title,
    body,
    data,
    sound: 'default',
  };

  await expo.sendPushNotificationsAsync([message]);
}

async function sendPushNotification(
  customerId: string,
  orderNumber: string,
  status: string,
): Promise<void> {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { expoPushToken: true },
  });

  if (!customer?.expoPushToken || !Expo.isExpoPushToken(customer.expoPushToken)) {
    return;
  }

  const statusLabels: Record<string, string> = {
    CONFIRMED: 'confirmed',
    PREPARING: 'being prepared',
    READY: 'ready',
    OUT_FOR_DELIVERY: 'out for delivery',
    DELIVERED: 'delivered',
    PICKED_UP: 'picked up',
    CANCELLED: 'cancelled',
  };

  const statusLabel = statusLabels[status] || status.toLowerCase();

  await sendExpoPush(
    customer.expoPushToken,
    `Order #${orderNumber}`,
    `Your order is ${statusLabel}.`,
    { orderId: customerId, status },
  );
}

export function emitNewOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  orderType: string;
}): void {
  if (!io) return;
  io.to('kitchen').emit('order:new', order);
}
