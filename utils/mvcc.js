/**
 * MVCC (Multi-Version Concurrency Control) Utilities
 * 
 * This module provides utilities for implementing optimistic locking
 * and conflict detection using version fields. All route handlers
 * that modify data should use these helpers to ensure data consistency.
 */

/**
 * Validates that the client provided a version number
 * @param {*} value - The version value from request body
 * @returns {number} The parsed version number
 * @throws {Error} If version is missing or invalid
 */
export const requireVersion = (value) => {
  if (value === undefined || value === null) {
    const error = new Error("Version is required for optimistic locking");
    error.statusCode = 400;
    throw error;
  }

  const parsed = parseInt(value, 10);
  if (isNaN(parsed) || parsed < 0) {
    const error = new Error("Version must be a non-negative integer");
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

/**
 * Sanitizes and prepares fields for a $set operation
 * Removes internal fields that should not be updated
 * @param {Object} fields - The fields object from request body
 * @returns {Object} Sanitized fields object
 */
export const sanitizeSetFields = (fields = {}) => {
  const sanitized = { ...fields };

  // Remove fields that should never be updated via API
  delete sanitized._id;
  delete sanitized.version;
  delete sanitized.__v;
  delete sanitized.createdAt;
  delete sanitized.updatedAt;
  delete sanitized.passwordResetToken;
  delete sanitized.passwordResetExpires;
  delete sanitized.verificationCode;
  delete sanitized.verificationCodeExpires;

  return sanitized;
};

/**
 * Builds a MongoDB update document that includes version increments
 * This ensures every update atomically increments the version field
 * @param {Object} setFields - Fields to update in $set operation
 * @param {Object} ops - Additional MongoDB operators (e.g., $push, $pull)
 * @returns {Object} Complete MongoDB update document
 */
export const buildVersionedUpdateDoc = (setFields = {}, ops = {}) => {
  const updateDoc = {
    $inc: { version: 1 }, // Always increment version
  };

  // Add sanitized $set fields if any
  const cleanedFields = sanitizeSetFields(setFields);
  if (Object.keys(cleanedFields).length > 0) {
    updateDoc.$set = cleanedFields;
  }

  // Merge any additional operators
  return { ...updateDoc, ...ops };
};

/**
 * Performs a versioned update with optimistic locking
 * Only updates the document if the version matches the client's snapshot
 * @param {Model} Model - The Mongoose model to update
 * @param {string} id - The document _id
 * @param {number} version - The client's version (must match DB for update to proceed)
 * @param {Object} updateDoc - The MongoDB update document
 * @param {Object} options - Additional findOneAndUpdate options
 * @returns {Promise<Object|null>} Updated document or null if version conflict
 */
export const runVersionedUpdate = (Model, id, version, updateDoc, options = {}) => {
  return Model.findOneAndUpdate(
    { _id: id, version }, // Only match if version is still the same
    updateDoc,
    {
      new: true,
      runValidators: true,
      ...options
    }
  );
};

/**
 * Sends a standardized 409 Conflict response
 * Used when version mismatch indicates another editor has updated the record
 * @param {Object} res - Express response object
 * @param {string} entity - Entity name (e.g., "Classroom", "User") for error message
 * @returns {Object} Response object (for chaining)
 */
export const respondWithConflict = (res, entity = "Record") => {
  return res.status(409).json({
    message: `${entity} was updated by someone else. Refresh and try again.`,
    code: "VERSION_CONFLICT"
  });
};

/**
 * Checks if an error is a version-related validation error
 * @param {Error} error - The error object to check
 * @returns {boolean} True if error is version-related
 */
export const isVersionError = (error) => {
  return error.statusCode === 400 && error.message.includes("Version");
};

/**
 * Typical usage pattern in a route handler:
 * 
 * router.put("/:id", async (req, res) => {
 *   try {
 *     // 1) Validate and extract version from client
 *     const version = requireVersion(req.body.version);
 *     
 *     // 2) Prepare sanitized update fields
 *     const updates = sanitizeSetFields({ ...req.body });
 *     
 *     // 3) Build the versioned update document
 *     const updateDoc = buildVersionedUpdateDoc(updates);
 *     
 *     // 4) Perform the atomic versioned update
 *     const updated = await runVersionedUpdate(
 *       Model,
 *       req.params.id,
 *       version,
 *       updateDoc
 *     );
 *     
 *     // 5) Check if update succeeded
 *     if (!updated) {
 *       return respondWithConflict(res, "Record");
 *     }
 *     
 *     // 6) Send updated document with fresh version
 *     res.json(updated);
 *   } catch (error) {
 *     if (isVersionError(error)) {
 *       return res.status(error.statusCode).json({
 *         message: error.message
 *       });
 *     }
 *     res.status(500).json({ message: "Server Error" });
 *   }
 * });
 */
