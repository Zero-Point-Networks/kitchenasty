import { Router } from 'express';
import { authenticate, optionalAuth, requireStaff, requireRole } from '../middleware/auth.js';
import { createOrder, listOrders, listCustomerOrders, getOrder, updateOrderStatus } from '../controllers/order.controller.js';

const router = Router();

// Customer creates order (optionalAuth - allows guest checkout)
router.post('/', optionalAuth, createOrder);

// Customer: view own orders
router.get('/my-orders', authenticate, listCustomerOrders);

// Staff: list and manage orders
router.get('/', authenticate, requireStaff, listOrders);
// Public by id. The cuid is unguessable (~130 bits of entropy), so it
// acts as a bearer token. Needed for guest-checkout confirmation polling
// — the storefront has no auth header to send post-checkout.
router.get('/:id', optionalAuth, getOrder);
router.patch('/:id/status', authenticate, requireStaff, updateOrderStatus);

export default router;
