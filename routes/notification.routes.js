const router = require('express').Router();
const { protect } = require('../middleware/auth.middleware');
const {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
} = require('../controllers/notification.controller');

router.get('/',                  protect, getNotifications);
router.get('/unread-count',      protect, getUnreadCount);
router.patch('/read-all',        protect, markAllAsRead);
router.patch('/:id/read',        protect, markAsRead);
router.delete('/:id',            protect, deleteNotification);

module.exports = router;