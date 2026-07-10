import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindUnique = vi.hoisted(() => vi.fn());
const mockSendPushAsync = vi.hoisted(() => vi.fn().mockResolvedValue([]));

vi.mock('@prisma/client', () => ({
  PrismaClient: class {
    customer = { findUnique: mockFindUnique };
  },
}));

vi.mock('expo-server-sdk', () => {
  class Expo {
    static isExpoPushToken = (token: string): boolean => token.startsWith('ExponentPushToken');
    sendPushNotificationsAsync = mockSendPushAsync;
  }
  return { Expo };
});

vi.mock('socket.io', () => ({
  Server: class {
    on = vi.fn();
    to = vi.fn(() => ({ emit: vi.fn() }));
  },
}));

import { Server as HttpServer } from 'http';
import { initSocket, emitOrderStatusUpdate, sendExpoPush } from '../../lib/socket.js';

const order = {
  id: 'order-1',
  orderNumber: 'KA-1',
  status: 'READY',
  orderType: 'PICKUP',
  customerId: 'cust-1',
};

const flushAsync = () => new Promise((resolve) => setImmediate(resolve));

describe('emitOrderStatusUpdate push gating', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindUnique.mockResolvedValue({ expoPushToken: 'ExponentPushToken[abc]' });
    initSocket({} as HttpServer);
  });

  it('sends the generic push by default when the order has a customer', async () => {
    emitOrderStatusUpdate(order);
    await flushAsync();
    expect(mockFindUnique).toHaveBeenCalledTimes(1);
    expect(mockSendPushAsync).toHaveBeenCalledTimes(1);
  });

  it('skips the push entirely when suppressPush is set', async () => {
    emitOrderStatusUpdate(order, { suppressPush: true });
    await flushAsync();
    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(mockSendPushAsync).not.toHaveBeenCalled();
  });

  it('does not push for orders without a customer', async () => {
    emitOrderStatusUpdate({ ...order, customerId: null });
    await flushAsync();
    expect(mockSendPushAsync).not.toHaveBeenCalled();
  });
});

describe('sendExpoPush', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a message for a valid Expo token', async () => {
    await sendExpoPush('ExponentPushToken[abc]', 'Title', 'Body');
    expect(mockSendPushAsync).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[abc]', title: 'Title', body: 'Body' }),
    ]);
  });

  it('ignores invalid tokens without sending', async () => {
    await sendExpoPush('not-a-token', 'Title', 'Body');
    expect(mockSendPushAsync).not.toHaveBeenCalled();
  });
});
