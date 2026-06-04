import { Router } from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  updatePreferences,
  listAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  updateMe,
  getMyCompany,
  listCompanyMembers,
} from '../controllers/customer.controller.js';

const router = Router();

// All routes here operate on the currently-authenticated customer
// (req.user.type === 'customer'). Staff hitting these gets 401.

router.patch('/me', authenticate, updateMe);
router.patch('/me/preferences', authenticate, updatePreferences);

router.get('/me/addresses', authenticate, listAddresses);
router.post('/me/addresses', authenticate, createAddress);
router.patch('/me/addresses/:id', authenticate, updateAddress);
router.delete('/me/addresses/:id', authenticate, deleteAddress);

router.get('/me/company', authenticate, getMyCompany);
router.get('/me/company/members', authenticate, listCompanyMembers);

export default router;
