const Service = require('../models/Service.model');
const Salon   = require('../models/Salon.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

/**
 * @desc    Get all services for a salon, grouped by category
 *          This is what shows on the salon detail page (like Zomato's menu)
 * @route   GET /api/salons/:salonId/services
 * @access  Public
 */
const getServicesBySalon = async (req, res) => {
  try {
    const { salonId } = req.params;
    const { category, available } = req.query;

    const filter = { salon: salonId };
    if (category)  filter.category    = category;
    if (available) filter.isAvailable = available === 'true';

    const services = await Service.find(filter).sort({ displayOrder: 1, category: 1, price: 1 });

    // Group by category for the menu-style display on the UI
    const grouped = services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});

    res.status(200).json({
      success:  true,
      count:    services.length,
      data:     services,   // flat list for booking
      grouped,              // grouped by category for UI display
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Add a new service to a salon (like adding a menu item in Zomato)
 * @route   POST /api/salons/:salonId/services
 * @access  Private (owner of this salon or admin)
 * @body    multipart/form-data
 *          Fields: name, description, category, price, duration, displayOrder, requiresAppointment
 *          File:   image (optional)
 */
const createService = async (req, res) => {
  try {
    const { salonId } = req.params;

    // Confirm the salon exists
    const salon = await Salon.findById(salonId);
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

    const {
      name, description, category, price,
      duration, displayOrder, requiresAppointment,
    } = req.body;

    // Upload service image to Cloudinary if provided
    let image = null;
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        `mysalon/services/${salonId}`,
        { transformation: [{ width: 600, height: 400, crop: 'fill' }] }
      );
      image = { url: result.url, public_id: result.public_id };
    }

    const service = await Service.create({
      salon:               salonId,
      name:                name.trim(),
      description:         description?.trim() || '',
      category,
      price:               parseFloat(price),
      duration:            parseInt(duration),
      displayOrder:        displayOrder ? parseInt(displayOrder) : 0,
      requiresAppointment: requiresAppointment === 'true' || requiresAppointment === true,
      image,
    });

    // Add service reference to the salon
    await Salon.findByIdAndUpdate(salonId, { $push: { services: service._id } });

    // Recalculate salon price range
    await salon.updatePriceRange();

    res.status(201).json({ success: true, data: service });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Update a service (edit menu item)
 * @route   PUT /api/salons/:salonId/services/:id
 * @access  Private (owner or admin)
 */
const updateService = async (req, res) => {
  try {
    const service = await Service.findOne({
      _id:   req.params.id,
      salon: req.params.salonId,
    });

    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });

    const { name, description, category, price, duration, displayOrder, isAvailable, requiresAppointment } = req.body;

    if (name        !== undefined) service.name        = name.trim();
    if (description !== undefined) service.description = description.trim();
    if (category    !== undefined) service.category    = category;
    if (price       !== undefined) service.price       = parseFloat(price);
    if (duration    !== undefined) service.duration    = parseInt(duration);
    if (displayOrder!== undefined) service.displayOrder= parseInt(displayOrder);
    if (isAvailable !== undefined) service.isAvailable = isAvailable === 'true' || isAvailable === true;
    if (requiresAppointment !== undefined) service.requiresAppointment = requiresAppointment === 'true';

    // Replace image if a new one is uploaded
    if (req.file) {
      if (service.image?.public_id) await deleteFromCloudinary(service.image.public_id);
      const result = await uploadToCloudinary(
        req.file.buffer,
        `mysalon/services/${req.params.salonId}`,
        { transformation: [{ width: 600, height: 400, crop: 'fill' }] }
      );
      service.image = { url: result.url, public_id: result.public_id };
    }

    await service.save();

    // Recalculate salon price range
    const salon = await Salon.findById(req.params.salonId);
    if (salon) await salon.updatePriceRange();

    res.status(200).json({ success: true, data: service });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Toggle service availability (on/off switch for each menu item)
 * @route   PATCH /api/salons/:salonId/services/:id/toggle
 * @access  Private (owner or admin)
 */
const toggleServiceAvailability = async (req, res) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, salon: req.params.salonId });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });

    service.isAvailable = !service.isAvailable;
    await service.save();

    res.status(200).json({
      success: true,
      message: `Service ${service.isAvailable ? 'enabled' : 'disabled'}.`,
      data:    service,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

/**
 * @desc    Delete a service (remove a menu item)
 * @route   DELETE /api/salons/:salonId/services/:id
 * @access  Private (owner or admin)
 */
const deleteService = async (req, res) => {
  try {
    const service = await Service.findOne({ _id: req.params.id, salon: req.params.salonId });
    if (!service) return res.status(404).json({ success: false, message: 'Service not found.' });

    // Delete image from Cloudinary
    if (service.image?.public_id) await deleteFromCloudinary(service.image.public_id);

    await service.deleteOne();

    // Remove from salon's services array
    await Salon.findByIdAndUpdate(req.params.salonId, { $pull: { services: service._id } });

    // Recalculate price range
    const salon = await Salon.findById(req.params.salonId);
    if (salon) await salon.updatePriceRange();

    res.status(200).json({ success: true, message: 'Service deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = {
  getServicesBySalon,
  createService,
  updateService,
  toggleServiceAvailability,
  deleteService,
};