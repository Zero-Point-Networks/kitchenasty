import { Router } from 'express';
import {
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
} from '../controllers/location.controller.js';
import {
  listDeliveryZones,
  createDeliveryZone,
  updateDeliveryZone,
  deleteDeliveryZone,
  checkDeliveryZone,
} from '../controllers/delivery-zone.controller.js';
import {
  listTables,
  getTable,
  createTable,
  updateTable,
  deleteTable,
  resolveTableByToken,
  generateTableQr,
} from '../controllers/table.controller.js';
import { authenticate, requireStaff, requireRole } from '../middleware/auth.js';

const router = Router();

// Locations - read is open, write requires staff
router.get('/', listLocations);
router.get('/:id', getLocation);
router.post('/', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), createLocation);
router.patch('/:id', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), updateLocation);
router.delete('/:id', authenticate, requireStaff, requireRole('SUPER_ADMIN'), deleteLocation);

// Delivery zones - nested under locations
router.get('/:locationId/delivery-zones/check', checkDeliveryZone);
router.get('/:locationId/delivery-zones', listDeliveryZones);
router.post('/:locationId/delivery-zones', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), createDeliveryZone);
router.patch('/:locationId/delivery-zones/:zoneId', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), updateDeliveryZone);
router.delete('/:locationId/delivery-zones/:zoneId', authenticate, requireStaff, requireRole('SUPER_ADMIN'), deleteDeliveryZone);

// Public dine-in QR token resolution. The literal `tables/by-token` segments
// don't collide with `/:locationId/tables/:tableId` (which needs a literal
// `tables` in the second segment), but keeping it above the parameterised
// table routes makes the precedence obvious.
router.get('/tables/by-token/:qrToken', resolveTableByToken);

// Tables - nested under locations
router.get('/:locationId/tables', listTables);
router.get('/:locationId/tables/:tableId', getTable);
router.post('/:locationId/tables', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), createTable);
router.post('/:locationId/tables/:tableId/qr', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), generateTableQr);
router.patch('/:locationId/tables/:tableId', authenticate, requireStaff, requireRole('SUPER_ADMIN', 'MANAGER'), updateTable);
router.delete('/:locationId/tables/:tableId', authenticate, requireStaff, requireRole('SUPER_ADMIN'), deleteTable);

export default router;
