const Slot    = require('../models/Slot.model');
const Salon   = require('../models/Salon.model');
const Stylist = require('../models/Stylist.model');

// ── Helper: generate time slots from working hours ────────────────────────────
/**
 * Generate slots for a stylist on a given date.
 * Slots are generated based on salon working hours with slotDuration intervals.
 * Default slot duration: 30 min. Salons can override.
 */
const generateSlotsForDate = async (salonId, stylistId, date) => {
  const salon = await Salon.findById(salonId).select('workingHours');
  if (!salon) throw new Error('Salon not found');

  const days = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const dayName = days[new Date(date + 'T00:00:00').getDay()];
  const wh = salon.workingHours?.find(h => h.day === dayName);

  if (!wh || !wh.isOpen) return []; // salon closed this day

  const [openH,  openM]  = wh.openTime.split(':').map(Number);
  const [closeH, closeM] = wh.closeTime.split(':').map(Number);
  const openMins  = openH  * 60 + openM;
  const closeMins = closeH * 60 + closeM;
  const slotDuration = 30; // minutes per slot

  const slots = [];
  for (let start = openMins; start + slotDuration <= closeMins; start += slotDuration) {
    const endMins = start + slotDuration;
    const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2,'0')}:${String(m % 60).padStart(2,'0')}`;
    slots.push({
      salon:     salonId,
      stylist:   stylistId,
      date,
      startTime: fmt(start),
      endTime:   fmt(endMins),
      duration:  slotDuration,
    });
  }
  return slots;
};

// ── Helper: ensure slots exist for a stylist on a date (lazy generation) ──────
const ensureSlotsExist = async (salonId, stylistId, date) => {
  const existing = await Slot.countDocuments({ salon: salonId, stylist: stylistId, date });
  if (existing > 0) return; // already generated

  const slots = await generateSlotsForDate(salonId, stylistId, date);
  if (slots.length === 0) return;

  // insertMany with ignore duplicates
  await Slot.insertMany(slots, { ordered: false }).catch(() => {});
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/slots/:salonId?date=YYYY-MM-DD&stylistId=xxx
// Returns availability for all stylists (or one stylist) on a given date
// ══════════════════════════════════════════════════════════════════════════════
const getSlots = async (req, res) => {
  try {
    const { date, stylistId } = req.query;
    const { salonId } = req.params;

    if (!date) return res.status(400).json({ success: false, message: 'date is required (YYYY-MM-DD).' });

    // Get all active stylists for this salon (or just the one requested)
    const stylistFilter = { salon: salonId, isActive: true };
    if (stylistId) stylistFilter._id = stylistId;
    const stylists = await Stylist.find(stylistFilter).select('name photo speciality experience');

    if (!stylists.length) {
      return res.status(200).json({ success: true, data: [] });
    }

    // Ensure slots exist for each stylist on this date (lazy generation)
    await Promise.all(stylists.map(sty => ensureSlotsExist(salonId, sty._id, date)));

    // Fetch all slots
    const slotFilter = { salon: salonId, date };
    if (stylistId) slotFilter.stylist = stylistId;

    const slots = await Slot.find(slotFilter)
      .sort({ stylist: 1, startTime: 1 })
      .populate('stylist', 'name photo speciality experience');

    // Group by stylist
    const grouped = {};
    for (const sty of stylists) {
      grouped[sty._id] = {
        stylist: sty,
        slots:   [],
      };
    }
    for (const slot of slots) {
      const key = slot.stylist?._id?.toString() || slot.stylist?.toString();
      if (grouped[key]) grouped[key].slots.push(slot);
    }

    res.status(200).json({ success: true, data: Object.values(grouped) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/slots/:salonId/dates?month=YYYY-MM
// Returns which dates in a month have at least one available slot
// Used to show green dots on calendar
// ══════════════════════════════════════════════════════════════════════════════
const getAvailableDates = async (req, res) => {
  try {
    const { month } = req.query; // "2026-06"
    const { salonId } = req.params;

    if (!month) return res.status(400).json({ success: false, message: 'month is required (YYYY-MM).' });

    const [year, mon] = month.split('-').map(Number);
    const daysInMonth = new Date(year, mon, 0).getDate();

    const salon = await Salon.findById(salonId).select('workingHours');
    const days  = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

    const availableDates = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      // Skip past dates
      if (new Date(dateStr) < new Date(new Date().toDateString())) continue;

      const dayName = days[new Date(dateStr + 'T00:00:00').getDay()];
      const wh = salon?.workingHours?.find(h => h.day === dayName);
      if (wh?.isOpen) availableDates.push(dateStr);
    }

    res.status(200).json({ success: true, data: availableDates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/slots/book  — block a slot when booking is created
// Called internally from booking.controller — not a public route
// ══════════════════════════════════════════════════════════════════════════════
const blockSlot = async ({ salonId, stylistId, date, startTime, bookingId }) => {
  if (!stylistId || !date || !startTime) return null; // slot booking is optional
  try {
    await ensureSlotsExist(salonId, stylistId, date);
    const slot = await Slot.findOneAndUpdate(
      { salon: salonId, stylist: stylistId, date, startTime, isBooked: false },
      { isBooked: true, booking: bookingId },
      { new: true }
    );
    return slot;
  } catch (err) {
    console.error('blockSlot error:', err.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Release slot — called from booking cancel / queue complete
// ══════════════════════════════════════════════════════════════════════════════
const releaseSlot = async (bookingId) => {
  try {
    await Slot.findOneAndUpdate(
      { booking: bookingId },
      { isBooked: false, booking: null }
    );
  } catch (err) {
    console.error('releaseSlot error:', err.message);
  }
};

module.exports = { getSlots, getAvailableDates, blockSlot, releaseSlot, ensureSlotsExist };