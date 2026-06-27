 
// const Salon   = require('../models/Salon.model');
// const Service = require('../models/Service.model');
// const Queue   = require('../models/Queue.model');
// const User    = require('../models/User.model');
// const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// // ─── Helper: attach live queue info ──────────────────────────────────────────
// const attachQueueInfo = async (salon) => {
//   const queue = await Queue.findOne({ salon: salon._id }).select('activeBookings avgServiceTime');
//   const count = queue?.activeBookings?.length || 0;
//   return { ...salon.toObject(), queueCount: count, estimatedWait: count * (queue?.avgServiceTime || 20) };
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/salons
// // ══════════════════════════════════════════════════════════════════════════════
// const getAllSalons = async (req, res) => {
//   try {
//     const { search, category, city, sortBy = 'rating', page = 1, limit = 12 } = req.query;

//     // During dev show all salons (including unverified).
//     // In production change to: { isActive: true, isVerified: true }
//     const filter = { isActive: true };

//     if (search)   filter.$text               = { $search: search };
//     if (category) filter.category            = category.toLowerCase();
//     if (city)     filter['address.city']     = new RegExp(city, 'i');

//     const sortOptions = {
//       rating: { rating: -1 },
//       newest: { createdAt: -1 },
//       name:   { name: 1 },
//     };
//     const sort  = sortOptions[sortBy] || sortOptions.rating;
//     const skip  = (Number(page) - 1) * Number(limit);
//     const total = await Salon.countDocuments(filter);

//     const salons = await Salon.find(filter)
//       .sort(sort).skip(skip).limit(Number(limit))
//       .select('name description category tags coverImage address rating totalReviews priceRangeMin priceRangeMax isOpen workingHours')
//       .lean();

//     const salonsWithQueue = await Promise.all(
//       salons.map(async (s) => {
//         const queue = await Queue.findOne({ salon: s._id }).select('activeBookings avgServiceTime');
//         const count = queue?.activeBookings?.length || 0;
//         return { ...s, queueCount: count, estimatedWait: count * (queue?.avgServiceTime || 20) };
//       })
//     );

//     res.status(200).json({ success: true, count: salonsWithQueue.length, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: salonsWithQueue });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/salons/:id
// // ══════════════════════════════════════════════════════════════════════════════
// const getSalonById = async (req, res) => {
//   try {
//     const salon = await Salon.findOne({ _id: req.params.id, isActive: true })
//       .populate('owner', 'name email phone');
//     if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

//     const services = await Service.find({ salon: salon._id, isAvailable: true })
//       .sort({ displayOrder: 1, category: 1, name: 1 });

//     const servicesByCategory = services.reduce((acc, s) => {
//       if (!acc[s.category]) acc[s.category] = [];
//       acc[s.category].push(s);
//       return acc;
//     }, {});

//     const queue         = await Queue.findOne({ salon: salon._id });
//     const queueCount    = queue?.activeBookings?.length || 0;
//     const estimatedWait = queueCount * (queue?.avgServiceTime || 20);

//     res.status(200).json({
//       success: true,
//       data: {
//         ...salon.toObject(),
//         services,
//         servicesByCategory,
//         queueCount,
//         estimatedWait,
//         isPaused: queue?.isPaused || false,
//       },
//     });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // POST /api/salons  — register new salon
// // ══════════════════════════════════════════════════════════════════════════════
// const createSalon = async (req, res) => {
//   try {
//     const { name, description, category, phone, email, tags, address, workingHours, longitude, latitude } = req.body;

//     // ── Parse JSON strings sent in multipart/form-data ────────────────────
//     let parsedAddress = {};
//     try { parsedAddress = address ? JSON.parse(address) : {}; } catch { parsedAddress = {}; }

//     let parsedWorkingHours;
//     try { parsedWorkingHours = workingHours ? JSON.parse(workingHours) : undefined; } catch { parsedWorkingHours = undefined; }

//     // Tags can come as comma-separated string or JSON array
//     let parsedTags = [];
//     if (tags) {
//       try { parsedTags = JSON.parse(tags); }
//       catch { parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean); }
//     }

//     // ── Upload cover image ────────────────────────────────────────────────
//     let coverImage = null;
//     if (req.files?.coverImage?.[0]) {
//       const result = await uploadToCloudinary(
//         req.files.coverImage[0].buffer,
//         'mysalon/salons/covers',
//         { transformation: [{ width: 900, height: 600, crop: 'fill' }] }
//       );
//       coverImage = { url: result.url, public_id: result.public_id, altText: name };
//     }

//     // ── Upload gallery images ─────────────────────────────────────────────
//     let gallery = [];
//     if (req.files?.gallery?.length) {
//       gallery = await Promise.all(
//         req.files.gallery.map((file) =>
//           uploadToCloudinary(file.buffer, 'mysalon/salons/gallery', {
//             transformation: [{ width: 800, height: 600, crop: 'fill' }],
//           }).then((r) => ({ url: r.url, public_id: r.public_id, altText: name }))
//         )
//       );
//     }

//     // ── Create salon ──────────────────────────────────────────────────────
//     const salon = await Salon.create({
//       owner:        req.user._id,
//       name:         name.trim(),
//       description:  description?.trim() || '',
//       category,
//       phone:        phone.trim(),
//       email:        email?.trim() || '',
//       tags:         parsedTags,
//       address:      parsedAddress,
//       location: {
//         type:        'Point',
//         coordinates: [parseFloat(longitude || 0), parseFloat(latitude || 0)],
//       },
//       coverImage,
//       gallery,
//       workingHours: parsedWorkingHours,
//       // New salons start as verified so they appear immediately (change to false in production)
//       isVerified: true,
//     });

//     // ── Create queue for this salon ───────────────────────────────────────
//     await Queue.create({ salon: salon._id });

//     // ── Auto-upgrade user role to salon_owner ─────────────────────────────
//     await User.findByIdAndUpdate(req.user._id, {
//       role:  'salon_owner',
//       $push: { salons: salon._id },
//     });

//     res.status(201).json({ success: true, message: 'Salon registered successfully!', data: salon });
//   } catch (err) {
//     console.error('Create salon error:', err);
//     if (err.code === 11000) {
//       return res.status(409).json({ success: false, message: 'A salon with this phone number already exists.' });
//     }
//     // Mongoose validation errors
//     if (err.name === 'ValidationError') {
//       const messages = Object.values(err.errors).map((e) => e.message).join('. ');
//       return res.status(400).json({ success: false, message: messages });
//     }
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // PUT /api/salons/:id
// // ══════════════════════════════════════════════════════════════════════════════
// const updateSalon = async (req, res) => {
//   try {
//     const salon = await Salon.findById(req.params.id);
//     if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

//     const { name, description, category, phone, email, tags, address, workingHours, isOpen, longitude, latitude } = req.body;

//     if (name)        salon.name        = name.trim();
//     if (description !== undefined) salon.description = description.trim();
//     if (category)    salon.category    = category;
//     if (phone)       salon.phone       = phone.trim();
//     if (email !== undefined)       salon.email       = email.trim();
//     if (isOpen !== undefined)      salon.isOpen      = isOpen === 'true' || isOpen === true;
//     if (tags)        salon.tags        = tags.split(',').map((t) => t.trim()).filter(Boolean);
//     if (address) {
//       try { salon.address = JSON.parse(address); } catch { /* ignore */ }
//     }
//     if (workingHours) {
//       try { salon.workingHours = JSON.parse(workingHours); } catch { /* ignore */ }
//     }
//     if (longitude && latitude) {
//       salon.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
//     }

//     if (req.files?.coverImage?.[0]) {
//       if (salon.coverImage?.public_id) await deleteFromCloudinary(salon.coverImage.public_id);
//       const result = await uploadToCloudinary(req.files.coverImage[0].buffer, 'mysalon/salons/covers', {
//         transformation: [{ width: 900, height: 600, crop: 'fill' }],
//       });
//       salon.coverImage = { url: result.url, public_id: result.public_id, altText: salon.name };
//     }

//     if (req.files?.gallery?.length) {
//       const newImages = await Promise.all(
//         req.files.gallery.map((file) =>
//           uploadToCloudinary(file.buffer, 'mysalon/salons/gallery').then(
//             (r) => ({ url: r.url, public_id: r.public_id, altText: salon.name })
//           )
//         )
//       );
//       salon.gallery = [...salon.gallery, ...newImages].slice(0, 10);
//     }

//     await salon.save();
//     res.status(200).json({ success: true, data: salon });
//   } catch (err) {
//     res.status(400).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // DELETE /api/salons/:id/gallery
// // ══════════════════════════════════════════════════════════════════════════════
// const deleteGalleryImage = async (req, res) => {
//   try {
//     const salon = await Salon.findById(req.params.id);
//     if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });
//     const { public_id } = req.body;
//     await deleteFromCloudinary(public_id);
//     salon.gallery = salon.gallery.filter((img) => img.public_id !== public_id);
//     await salon.save();
//     res.status(200).json({ success: true, message: 'Image removed.', data: salon.gallery });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // DELETE /api/salons/:id
// // ══════════════════════════════════════════════════════════════════════════════
// const deleteSalon = async (req, res) => {
//   try {
//     const salon = await Salon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
//     if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });
//     await User.findByIdAndUpdate(req.user._id, { $pull: { salons: salon._id } });
//     res.status(200).json({ success: true, message: 'Salon deleted.' });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// // ══════════════════════════════════════════════════════════════════════════════
// // GET /api/salons/owner/my
// // ══════════════════════════════════════════════════════════════════════════════
// const getMySalons = async (req, res) => {
//   try {
//     const salons = await Salon.find({ owner: req.user._id, isActive: true })
//       .populate('services', 'name price category isAvailable');
//     const salonsWithQueue = await Promise.all(salons.map(attachQueueInfo));
//     res.status(200).json({ success: true, data: salonsWithQueue });
//   } catch (err) {
//     res.status(500).json({ success: false, message: err.message });
//   }
// };

// module.exports = { getAllSalons, getSalonById, createSalon, updateSalon, deleteGalleryImage, deleteSalon, getMySalons };






const Salon   = require('../models/Salon.model');
const Service = require('../models/Service.model');
const Queue   = require('../models/Queue.model');
const User    = require('../models/User.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

// ─── Helper: attach live queue info ──────────────────────────────────────────
const attachQueueInfo = async (salon) => {
  const queue = await Queue.findOne({ salon: salon._id }).select('activeBookings avgServiceTime');
  const count = queue?.activeBookings?.length || 0;
  return { ...salon.toObject(), queueCount: count, estimatedWait: count * (queue?.avgServiceTime || 20) };
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/salons
// ══════════════════════════════════════════════════════════════════════════════
const getAllSalons = async (req, res) => {
  try {
    const { search, category, city, sortBy = 'rating', page = 1, limit = 12 } = req.query;

    // During dev show all salons (including unverified).
    // In production change to: { isActive: true, isVerified: true }
    const filter = { isActive: true };

    if (search)   filter.$text               = { $search: search };
    if (category) filter.category            = category.toLowerCase();
    if (city)     filter['address.city']     = new RegExp(city, 'i');

    const sortOptions = {
      rating: { rating: -1 },
      newest: { createdAt: -1 },
      name:   { name: 1 },
    };
    const sort  = sortOptions[sortBy] || sortOptions.rating;
    const skip  = (Number(page) - 1) * Number(limit);
    const total = await Salon.countDocuments(filter);

    const salons = await Salon.find(filter)
      .sort(sort).skip(skip).limit(Number(limit))
      .select('name description category tags coverImage address location rating totalReviews priceRangeMin priceRangeMax isOpen workingHours')
      .lean();

    const salonsWithQueue = await Promise.all(
      salons.map(async (s) => {
        const queue = await Queue.findOne({ salon: s._id }).select('activeBookings avgServiceTime');
        const count = queue?.activeBookings?.length || 0;
        return { ...s, queueCount: count, estimatedWait: count * (queue?.avgServiceTime || 20) };
      })
    );

    res.status(200).json({ success: true, count: salonsWithQueue.length, total, page: Number(page), pages: Math.ceil(total / Number(limit)), data: salonsWithQueue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/salons/:id
// ══════════════════════════════════════════════════════════════════════════════
const getSalonById = async (req, res) => {
  try {
    const salon = await Salon.findOne({ _id: req.params.id, isActive: true })
      .populate('owner', 'name email phone');
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

    const services = await Service.find({ salon: salon._id, isAvailable: true })
      .sort({ displayOrder: 1, category: 1, name: 1 });

    const servicesByCategory = services.reduce((acc, s) => {
      if (!acc[s.category]) acc[s.category] = [];
      acc[s.category].push(s);
      return acc;
    }, {});

    const queue         = await Queue.findOne({ salon: salon._id });
    const queueCount    = queue?.activeBookings?.length || 0;
    const estimatedWait = queueCount * (queue?.avgServiceTime || 20);

    res.status(200).json({
      success: true,
      data: {
        ...salon.toObject(),
        services,
        servicesByCategory,
        queueCount,
        estimatedWait,
        isPaused: queue?.isPaused || false,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/salons  — register new salon
// ══════════════════════════════════════════════════════════════════════════════
const createSalon = async (req, res) => {
  try {
    const { name, description, category, phone, email, tags, address, workingHours, longitude, latitude } = req.body;

    // ── Parse JSON strings sent in multipart/form-data ────────────────────
    let parsedAddress = {};
    try { parsedAddress = address ? JSON.parse(address) : {}; } catch { parsedAddress = {}; }

    let parsedWorkingHours;
    try { parsedWorkingHours = workingHours ? JSON.parse(workingHours) : undefined; } catch { parsedWorkingHours = undefined; }

    // Tags can come as comma-separated string or JSON array
    let parsedTags = [];
    if (tags) {
      try { parsedTags = JSON.parse(tags); }
      catch { parsedTags = tags.split(',').map((t) => t.trim()).filter(Boolean); }
    }

    // ── Upload cover image ────────────────────────────────────────────────
    let coverImage = null;
    if (req.files?.coverImage?.[0]) {
      const result = await uploadToCloudinary(
        req.files.coverImage[0].buffer,
        'mysalon/salons/covers',
        { transformation: [{ width: 900, height: 600, crop: 'fill' }] }
      );
      coverImage = { url: result.url, public_id: result.public_id, altText: name };
    }

    // ── Upload gallery images ─────────────────────────────────────────────
    let gallery = [];
    if (req.files?.gallery?.length) {
      gallery = await Promise.all(
        req.files.gallery.map((file) =>
          uploadToCloudinary(file.buffer, 'mysalon/salons/gallery', {
            transformation: [{ width: 800, height: 600, crop: 'fill' }],
          }).then((r) => ({ url: r.url, public_id: r.public_id, altText: name }))
        )
      );
    }

    // ── Create salon ──────────────────────────────────────────────────────
    const salon = await Salon.create({
      owner:        req.user._id,
      name:         name.trim(),
      description:  description?.trim() || '',
      category,
      phone:        phone.trim(),
      email:        email?.trim() || '',
      tags:         parsedTags,
      address:      parsedAddress,
      location: {
        type:        'Point',
        coordinates: [parseFloat(longitude || 0), parseFloat(latitude || 0)],
      },
      coverImage,
      gallery,
      workingHours: parsedWorkingHours,
      // New salons start as verified so they appear immediately (change to false in production)
      isVerified: true,
    });

    // ── Create queue for this salon ───────────────────────────────────────
    await Queue.create({ salon: salon._id });

    // ── Auto-upgrade user role to salon_owner ─────────────────────────────
    await User.findByIdAndUpdate(req.user._id, {
      role:  'salon_owner',
      $push: { salons: salon._id },
    });

    res.status(201).json({ success: true, message: 'Salon registered successfully!', data: salon });
  } catch (err) {
    console.error('Create salon error:', err);
    if (err.code === 11000) {
      return res.status(409).json({ success: false, message: 'A salon with this phone number already exists.' });
    }
    // Mongoose validation errors
    if (err.name === 'ValidationError') {
      const messages = Object.values(err.errors).map((e) => e.message).join('. ');
      return res.status(400).json({ success: false, message: messages });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// PUT /api/salons/:id
// ══════════════════════════════════════════════════════════════════════════════
const updateSalon = async (req, res) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });

    const { name, description, category, phone, email, tags, address, workingHours, isOpen, longitude, latitude } = req.body;

    if (name)        salon.name        = name.trim();
    if (description !== undefined) salon.description = description.trim();
    if (category)    salon.category    = category;
    if (phone)       salon.phone       = phone.trim();
    if (email !== undefined)       salon.email       = email.trim();
    if (isOpen !== undefined)      salon.isOpen      = isOpen === 'true' || isOpen === true;
    if (tags)        salon.tags        = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (address) {
      try { salon.address = JSON.parse(address); } catch { /* ignore */ }
    }
    if (workingHours) {
      try { salon.workingHours = JSON.parse(workingHours); } catch { /* ignore */ }
    }
    if (longitude && latitude) {
      salon.location.coordinates = [parseFloat(longitude), parseFloat(latitude)];
    }

    if (req.files?.coverImage?.[0]) {
      if (salon.coverImage?.public_id) await deleteFromCloudinary(salon.coverImage.public_id);
      const result = await uploadToCloudinary(req.files.coverImage[0].buffer, 'mysalon/salons/covers', {
        transformation: [{ width: 900, height: 600, crop: 'fill' }],
      });
      salon.coverImage = { url: result.url, public_id: result.public_id, altText: salon.name };
    }

    if (req.files?.gallery?.length) {
      const newImages = await Promise.all(
        req.files.gallery.map((file) =>
          uploadToCloudinary(file.buffer, 'mysalon/salons/gallery').then(
            (r) => ({ url: r.url, public_id: r.public_id, altText: salon.name })
          )
        )
      );
      salon.gallery = [...salon.gallery, ...newImages].slice(0, 10);
    }

    await salon.save();
    res.status(200).json({ success: true, data: salon });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/salons/:id/gallery
// ══════════════════════════════════════════════════════════════════════════════
const deleteGalleryImage = async (req, res) => {
  try {
    const salon = await Salon.findById(req.params.id);
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });
    const { public_id } = req.body;
    await deleteFromCloudinary(public_id);
    salon.gallery = salon.gallery.filter((img) => img.public_id !== public_id);
    await salon.save();
    res.status(200).json({ success: true, message: 'Image removed.', data: salon.gallery });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// DELETE /api/salons/:id
// ══════════════════════════════════════════════════════════════════════════════
const deleteSalon = async (req, res) => {
  try {
    const salon = await Salon.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!salon) return res.status(404).json({ success: false, message: 'Salon not found.' });
    await User.findByIdAndUpdate(req.user._id, { $pull: { salons: salon._id } });
    res.status(200).json({ success: true, message: 'Salon deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/salons/owner/my
// ══════════════════════════════════════════════════════════════════════════════
const getMySalons = async (req, res) => {
  try {
    const salons = await Salon.find({ owner: req.user._id, isActive: true })
      .populate('services', 'name price category isAvailable');
    const salonsWithQueue = await Promise.all(salons.map(attachQueueInfo));
    res.status(200).json({ success: true, data: salonsWithQueue });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getAllSalons, getSalonById, createSalon, updateSalon, deleteGalleryImage, deleteSalon, getMySalons };