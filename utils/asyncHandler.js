 
/**
 * asyncHandler
 * ------------
 * Wraps every async controller function so we don't need
 * try/catch in every single controller.
 *
 * Before:
 *   const getAll = async (req, res) => {
 *     try { ... } catch(err) { res.status(500).json(...) }
 *   }
 *
 * After:
 *   const getAll = asyncHandler(async (req, res) => { ... })
 *
 * Any thrown error or rejected promise is passed to next(err)
 * which is caught by the global error handler in error.middleware.js
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;