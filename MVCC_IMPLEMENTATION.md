# MVCC (Multi-Version Concurrency Control) Implementation Guide

## Overview

MVCC has been fully implemented across the Classroom Utilization System to prevent lost updates and data conflicts in concurrent editing scenarios. This implementation uses **optimistic locking** with version fields to detect conflicts and ensure data consistency.

## What is MVCC?

Multi-Version Concurrency Control allows multiple users to read and modify data simultaneously without blocking each other. When conflicts are detected (two users editing the same record), the system notifies the user instead of silently overwriting data.

## Key Components

### 1. Database Schema Changes

All MongoDB models now include automatic version tracking:

```javascript
// Before
}, {
  timestamps: true,
  versionKey: false
});

// After
}, {
  timestamps: true,
  versionKey: "version"  // Automatically incremented by MongoDB on updates
});
```

**Updated Models:**

- `Classroom.js`
- `User.js`
- `Schedule.js`
- `Instructor.js`
- `TimeIn.js`
- `Report.js`
- `ClassroomUsage.js`

### 2. Backend Utility Module (`utils/mvcc.js`)

Core MVCC functions shared across all routes:

```javascript
// Validate client sent a version
requireVersion(value);

// Prepare fields for update with automatic version increment
buildVersionedUpdateDoc(setFields, ops);

// Perform atomic versioned update
runVersionedUpdate(Model, id, version, updateDoc, options);

// Send standardized 409 Conflict response
respondWithConflict(res, entity);

// Check for version-related errors
isVersionError(error);
```

### 3. Route Updates

All write operations (PUT, PATCH) now follow the MVCC pattern:

**Updated Route Files:**

- `routes/classrooms.js` - PUT /:id
- `routes/users.js` - PUT /:id
- `routes/schedules.js` - PUT /:id (new real implementation)
- `routes/instructors.js` - PUT /:id
- `routes/timein.js` - PUT /:id/verify
- `routes/reports.js` - PUT /:id/comment
- `routes/usage.js` - PUT /:classroomId

### 4. Frontend Components

React components now include version management:

**Updated Components:**

- `ClassroomManagement.tsx`
- `UserManagement.tsx`

## Implementation Pattern

### Backend Route Handler

```javascript
router.put("/:id", async (req, res) => {
  try {
    // 1) Validate and extract version from client
    const version = requireVersion(req.body.version);

    // 2) Prepare sanitized update fields
    const { name, location, description } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;

    // 3) Build the versioned update document
    const updateDoc = buildVersionedUpdateDoc(updates);

    // 4) Perform the atomic versioned update
    const updated = await runVersionedUpdate(
      Model,
      req.params.id,
      version,
      updateDoc
    );

    // 5) Check if update succeeded
    if (!updated) {
      return respondWithConflict(res, "Record");
    }

    // 6) Send updated document with fresh version
    res.json(updated);
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(error.statusCode).json({ message: error.message });
    }
    res.status(500).json({ message: "Server Error" });
  }
});
```

### Frontend Component

```typescript
interface Classroom {
  _id: string;
  name: string;
  version: number; // Include version in interface
  // ... other fields
}

const [editingClassroom, setEditingClassroom] = useState<Classroom | null>(
  null
);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  try {
    if (editingClassroom) {
      // Always include version in update payload
      const updatePayload = {
        ...formData,
        version: editingClassroom.version,
      };
      await axios.put(`/api/classrooms/${editingClassroom._id}`, updatePayload);
    }
  } catch (error: any) {
    // Handle 409 Conflict response
    if (error.response?.status === 409) {
      const conflictMessage = error.response?.data?.message;
      alert("⚠️ CONFLICT DETECTED:\n\n" + conflictMessage);
      // Refresh data and let user retry
      fetchClassrooms();
      return;
    }
  }
};
```

## How It Works

### Successful Update Scenario

```
Client A                           Database                           Client B
    |                                 |                                 |
    |--- GET /classroom/1 ----------->|                                 |
    |<-- {_id, name, version: 5} ----|                                 |
    |                                 |                                 |
    |                                 |<--- GET /classroom/1 -----------|
    |                                 |----- {_id, name, version: 5} -->|
    |                                 |                                 |
    |--- PUT {version: 5, ...} ------>|                                 |
    |<-- Updated {version: 6} --------|                                 |
    |                                 |                                 |
    |                                 |<-- PUT {version: 5, ...} -------|
    |                                 |----- 409 Conflict Error ------->|
```

**Result:** Client A's update succeeds. Client B gets a 409 conflict and must refresh to get version 6 before retrying.

### Conflict Resolution Workflow

1. **User edits record** - gets current version (e.g., version 5)
2. **User submits update** - includes version 5 in request payload
3. **Server checks match** - finds record where `_id=X AND version=5`
4. **Update succeeds** - version auto-increments to 6
5. **Or conflict occurs** - another user already updated it, version is now 6
6. **409 response sent** - user notified: "Record was updated elsewhere"
7. **User refreshes** - gets latest version
8. **User retries** - with new version number

## HTTP Status Codes

- **200 OK** - Update successful, version incremented
- **400 Bad Request** - Version missing or invalid, validation errors
- **404 Not Found** - Record doesn't exist
- **409 Conflict** - Version mismatch, another user updated the record
- **500 Server Error** - Unexpected server error

## Version Field Behavior

### Automatic Increment

The MongoDB `versionKey: "version"` option automatically increments on every successful update:

```javascript
// First creation (automatic fields added by MongoDB)
{ _id: ObjectId, name: "Lab A", version: 0, createdAt: Date, updatedAt: Date }

// After first update
{ _id: ObjectId, name: "Lab A", version: 1, createdAt: Date, updatedAt: Date }

// After second update
{ _id: ObjectId, name: "Lab A", version: 2, createdAt: Date, updatedAt: Date }
```

### Sanitization

The `sanitizeSetFields()` function prevents modification of sensitive fields:

- `_id` - Cannot be changed
- `version` - Managed by system only
- `__v` - Mongoose internal field
- `createdAt` - Set only on creation
- `updatedAt` - Set automatically
- `passwordResetToken` - Security field
- `passwordResetExpires` - Security field
- `verificationCode` - Security field
- `verificationCodeExpires` - Security field

## Testing the Implementation

### Manual Testing Steps

1. **Open two browser windows** with the same admin account
2. **Edit the same classroom** in both windows
3. **Submit update in Window A** - should succeed
4. **Submit update in Window B** - should show 409 conflict
5. **Click "Refresh"** - loads latest data
6. **Retry edit in Window B** - now with new version, should succeed

### Testing with cURL

```bash
# Get a classroom (note the version)
curl -s http://localhost:5000/api/classrooms/123 | jq .

# Simulate update with correct version
curl -X PUT http://localhost:5000/api/classrooms/123 \
  -H "Content-Type: application/json" \
  -d '{"name":"New Name", "version": 5}'

# Simulate update with stale version (will conflict)
curl -X PUT http://localhost:5000/api/classrooms/123 \
  -H "Content-Type: application/json" \
  -d '{"name":"Old Update", "version": 5}'
# Response: {"message":"Classroom was updated by someone else...","code":"VERSION_CONFLICT"}
```

## Frontend User Experience

### Conflict Detection UI

When a 409 conflict occurs, users see:

```
⚠️ CONFLICT DETECTED:

Classroom was updated by someone else. Refresh and try again.
```

With options to:

- **Refresh** - Reloads latest data
- **Retry** - With new version after refresh

### Key Features Implemented

1. **Version included in payloads** - All PUT/PATCH requests include current version
2. **409 conflict handling** - Explicit conflict messages shown to users
3. **Automatic refresh buttons** - Quick access to reload data
4. **Validation feedback** - Clear messages on missing versions

## Common Issues & Solutions

### Issue: "Version is required"

**Cause:** Client not sending version in update request
**Solution:** Ensure frontend includes `version: editingRecord.version` in all update payloads

### Issue: Always getting 409 conflicts

**Cause:** Version field not properly initialized in database
**Solution:** Re-create collections or ensure all documents have version field

### Issue: Version field not incrementing

**Cause:** Using `versionKey: false` instead of `versionKey: "version"`
**Solution:** Update schema definition to use `versionKey: "version"`

## Database Migration (if needed)

If you have existing data without version fields:

```javascript
// Add version field to all existing documents
db.classrooms.updateMany({}, { $set: { version: 0 } });
db.users.updateMany({}, { $set: { version: 0 } });
db.schedules.updateMany({}, { $set: { version: 0 } });
// ... for all other collections
```

## Performance Considerations

- **No performance penalty** - Version field is indexed by MongoDB
- **Minimal storage overhead** - Version is a single integer field
- **Atomicity guaranteed** - MongoDB ensures version check and update happen together
- **Optimistic locking** - Better than pessimistic locking for read-heavy workloads

## Files Modified

### Backend

1. `/models/Classroom.js` - Added versionKey
2. `/models/User.js` - Added versionKey
3. `/models/Schedule.js` - Added versionKey
4. `/models/Instructor.js` - Added versionKey
5. `/models/TimeIn.js` - Added versionKey
6. `/models/Report.js` - Added versionKey
7. `/models/ClassroomUsage.js` - Added versionKey
8. `/utils/mvcc.js` - New utility module (created)
9. `/routes/classrooms.js` - Updated PUT endpoint
10. `/routes/users.js` - Updated PUT endpoint
11. `/routes/schedules.js` - Updated PUT endpoint, implemented real database operations
12. `/routes/instructors.js` - Updated PUT endpoint
13. `/routes/timein.js` - Updated PUT /verify endpoint
14. `/routes/reports.js` - Updated PUT /comment endpoint
15. `/routes/usage.js` - Implemented real database operations, updated PUT endpoint

### Frontend

1. `/client/src/components/ClassroomManagement.tsx` - Added version handling
2. `/client/src/components/UserManagement.tsx` - Added version handling for classroom and user updates

## Next Steps

1. **Deploy changes** - Test MVCC in production with real concurrent users
2. **Monitor conflicts** - Track 409 responses to identify hot-spot records
3. **User training** - Educate admins about refresh workflow when conflicts occur
4. **Documentation** - Share conflict resolution procedure with team
5. **Extend to frontend** - Apply MVCC to other components (InstructorManagement, etc.)

## Additional Resources

- [MongoDB Versioning](https://mongoosejs.com/docs/guide.html#versionKey)
- [Optimistic Locking](https://en.wikipedia.org/wiki/Optimistic_concurrency_control)
- [HTTP 409 Conflict](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/409)

---
