const router = require('express').Router();
const { protect, ownerOrAdmin } = require('../middleware/auth.middleware');
const { getSalonRevenue, getSalonCustomers, getCustomerHistory } = require('../controllers/owner.controller');

router.use(protect, ownerOrAdmin);

// Revenue reports
router.get('/:salonId/revenue',                          getSalonRevenue);

// Customer history
router.get('/:salonId/customers',                        getSalonCustomers);
router.get('/:salonId/customers/:userId/history',        getCustomerHistory);

module.exports = router;