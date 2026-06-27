 
/**
 * geocodeAddress
 * --------------
 * Forward geocodes an address string to lat/lng using Nominatim (free).
 * Used to fill in coordinates for existing salons that were registered
 * before the map picker was added.
 *
 * Call: node scripts/fixSalonCoords.js
 */
const https = require('https');

const geocodeAddress = (query) =>
  new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=in`;
    https.get(url, { headers: { 'User-Agent': 'MySalon/1.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.length > 0) {
            resolve({ lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', reject);
  });

module.exports = geocodeAddress;
EOF

