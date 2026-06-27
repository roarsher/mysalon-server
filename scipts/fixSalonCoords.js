// # Script to fix all salons with [0,0] coordinates
// cat > /home/claude/mysalon-backend/scripts/fixSalonCoords.js << 'EOF'
/**
 * Run once to fill in missing coordinates for salons registered
 * before the map picker was added.
 *
 * Usage: node scripts/fixSalonCoords.js
 */
require('dotenv').config();
const mongoose      = require('mongoose');
const Salon         = require('../models/Salon.model');
const geocodeAddress = require('../utils/geocodeAddress');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  // Find all salons with missing or zero coordinates
  const salons = await Salon.find({
    $or: [
      { 'location.coordinates': [0, 0] },
      { 'location.coordinates': { $exists: false } },
    ],
  }).select('name address location');

  console.log(`Found ${salons.length} salons with missing coordinates`);

  for (const salon of salons) {
    const { street, area, city, state, pincode } = salon.address || {};
    const query = [area, city, state, 'India'].filter(Boolean).join(', ');

    if (!query.trim()) {
      console.log(`  ⚠ Skipped ${salon.name} — no address`);
      continue;
    }

    console.log(`  Geocoding: ${salon.name} → "${query}"`);
    const coords = await geocodeAddress(query);

    if (coords) {
      await Salon.findByIdAndUpdate(salon._id, {
        'location.type':        'Point',
        'location.coordinates': [coords.lng, coords.lat],
      });
      console.log(`  ✅ ${salon.name} → [${coords.lng}, ${coords.lat}]`);
    } else {
      console.log(`  ❌ ${salon.name} — geocode failed`);
    }

    // Respect Nominatim rate limit (1 request/second)
    await sleep(1100);
  }

  console.log('\nDone! Closing connection.');
  await mongoose.disconnect();
}

run().catch(console.error);
// EOF

// mkdir -p /home/claude/mysalon-backend/scripts
// mv /home/claude/mysalon-backend/scripts/fixSalonCoords.js /home/claude/mysalon-backend/scripts/fixSalonCoords.js 2>/dev/null || true
// echo "done"