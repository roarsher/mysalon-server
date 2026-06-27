/**
 * Pricing Calculator
 * ------------------
 * Calculates the complete price breakdown for a booking:
 *   subtotal + GST + platform fee - discount = total
 *
 * Rules:
 *   GST:          18% on subtotal (CGST 9% + SGST 9%)
 *   Platform fee: ₹10 flat (waived on first booking)
 *   First booking discount: ₹100 off (one-time per user)
 */

const GST_RATE        = 18;      // %
const PLATFORM_FEE    = 10;      // ₹ flat
const FIRST_DISCOUNT  = 100;     // ₹ off on first booking
const MIN_AMOUNT_AFTER_DISCOUNT = 1; // Never go below ₹1

/**
 * calculatePricing
 * @param {number}  subtotal      - sum of all service prices
 * @param {boolean} isFirstBooking - whether this is user's first booking ever
 * @param {string}  couponCode    - optional coupon code (future use)
 * @returns {object} full pricing breakdown
 */
const calculatePricing = (subtotal, isFirstBooking = false, couponCode = '') => {
  // GST on subtotal only (not on platform fee or discounts — per Indian GST rules)
  const gstAmount    = Math.round((subtotal * GST_RATE) / 100);

  // Platform fee — waived on first booking as a welcome gesture
  const platformFee  = isFirstBooking ? 0 : PLATFORM_FEE;

  // First booking discount
  let discountAmount = 0;
  let discountCode   = '';
  let discountLabel  = '';

  if (isFirstBooking) {
    discountAmount = FIRST_DISCOUNT;
    discountCode   = 'FIRST100';
    discountLabel  = '🎁 First booking — ₹100 off';
  }

  // Total = subtotal + GST + platformFee - discount
  let totalAmount = subtotal + gstAmount + platformFee - discountAmount;

  // Ensure total never goes below minimum (prevents negative amounts)
  totalAmount = Math.max(MIN_AMOUNT_AFTER_DISCOUNT, totalAmount);

  return {
    subtotal,
    gstPercent:   GST_RATE,
    gstAmount,
    platformFee,
    discountCode,
    discountLabel,
    discountAmount,
    totalAmount,
  };
};

/**
 * formatPricingForDisplay
 * Returns an array of line items for the checkout UI
 */
const formatPricingForDisplay = (pricing) => {
  const lines = [
    { label: 'Services subtotal', amount: pricing.subtotal,    type: 'base'     },
    { label: `GST (${pricing.gstPercent}%)`, amount: pricing.gstAmount,   type: 'tax'      },
  ];
  if (pricing.platformFee > 0) {
    lines.push({ label: 'Platform fee',   amount: pricing.platformFee,  type: 'fee'      });
  } else {
    lines.push({ label: 'Platform fee',   amount: 0, note: 'Waived',   type: 'waived'   });
  }
  if (pricing.discountAmount > 0) {
    lines.push({ label: pricing.discountLabel, amount: -pricing.discountAmount, type: 'discount' });
  }
  lines.push({ label: 'Total payable',   amount: pricing.totalAmount,  type: 'total'    });
  return lines;
};

module.exports = { calculatePricing, formatPricingForDisplay, GST_RATE, PLATFORM_FEE, FIRST_DISCOUNT };