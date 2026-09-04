import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../src/app';
import { User } from '../src/models/user.model';

const TEST_DB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017/smartmetrix_test';

// Track test record IDs to cleanly delete only records created during tests
const createdUserIds: mongoose.Types.ObjectId[] = [];

/**
 * Test Database Safety Guard:
 * Strictly ensures any delete, drop, or cleanup operation only executes
 * if the connected database is exactly 'smartmetrix_test'.
 * Aborts immediately otherwise to protect development/production databases.
 */
export const assertTestDatabaseSafety = (): void => {
  const currentDbName = mongoose.connection.db?.databaseName || mongoose.connection.name;
  if (currentDbName !== 'smartmetrix_test') {
    throw new Error(
      `SAFETY GUARD ABORT: Test operations are strictly restricted to 'smartmetrix_test'. Connected to '${currentDbName}'. Operation aborted.`
    );
  }
};

describe('Phase 2 Integration Tests: Authentication, JWT & RBAC', () => {
  let ownerToken: string;
  let adminToken: string;
  let inspectorToken: string;

  const testOwner = {
    name: 'Test Owner',
    email: `test_owner_${Date.now()}@example.com`,
    password: 'TestPassword123!'
  };

  const testAdmin = {
    name: 'Test Admin',
    email: `test_admin_${Date.now()}@example.com`,
    password: 'AdminPassword123!'
  };

  const testInspector = {
    name: 'Test Inspector',
    email: `test_inspector_${Date.now()}@example.com`,
    password: 'InspectorPassword123!'
  };

  beforeAll(async () => {
    // Set test secret if not set
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_key_minimum_32_characters_12345';
    process.env.JWT_EXPIRES_IN = '1h';

    // Connect to isolated test database
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(TEST_DB_URI);
    }

    // Verify guard immediately upon connection before any writes
    assertTestDatabaseSafety();

    // Seed a test admin account directly in test database
    const adminUser = new User({
      name: testAdmin.name,
      email: testAdmin.email,
      password: testAdmin.password,
      role: 'ADMIN',
      isActive: true,
      tokenVersion: 0
    });
    await adminUser.save();
    createdUserIds.push(adminUser._id as mongoose.Types.ObjectId);
  });

  afterAll(async () => {
    // Safety guard verification before any cleanup
    assertTestDatabaseSafety();

    // Clean up ONLY records created by the test suite
    if (createdUserIds.length > 0) {
      await User.deleteMany({ _id: { $in: createdUserIds } });
    }
    await mongoose.disconnect();
  });

  describe('0. Database Safety Guard', () => {
    it('strictly verifies connected database is smartmetrix_test and throws on mismatch', () => {
      const currentDb = mongoose.connection.db?.databaseName || mongoose.connection.name;
      expect(currentDb).toBe('smartmetrix_test');
      expect(() => {
        const checkDb = (db: string) => {
          if (db !== 'smartmetrix_test') {
            throw new Error(`SAFETY GUARD ABORT: Expected 'smartmetrix_test', got '${db}'`);
          }
        };
        checkDb('smartmetrix');
      }).toThrow(/SAFETY GUARD ABORT/);
    });
  });

  describe('1. Health Check Endpoint', () => {
    it('GET /api/health should return 200 with running status', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.message).toContain('SmartMetrix backend is running');
    });
  });

  describe('2. User Registration & Privilege Escalation Prevention', () => {
    it('POST /api/auth/register should create an OWNER account and ignore attempted role override', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: testOwner.name,
          email: testOwner.email,
          password: testOwner.password,
          role: 'ADMIN' // Attempt privilege escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe(testOwner.email);
      expect(res.body.data.user.role).toBe('OWNER'); // Must be forced to OWNER
      expect(res.body.data.user.password).toBeUndefined();
      expect(res.body.data.token).toBeDefined();

      createdUserIds.push(new mongoose.Types.ObjectId(res.body.data.user.id));
      ownerToken = res.body.data.token;
    });

    it('POST /api/auth/register should reject duplicate email registration with 409', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: testOwner.name,
          email: testOwner.email,
          password: testOwner.password
        });

      expect(res.status).toBe(409);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('already exists');
    });

    it('POST /api/auth/register should reject invalid inputs with 400', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: '',
          email: 'not-an-email',
          password: 'short'
        });

      expect(res.status).toBe(400);
      expect(res.body.status).toBe('error');
    });
  });

  describe('3. User Authentication (Login)', () => {
    it('POST /api/auth/login should reject incorrect password with 401', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testOwner.email,
          password: 'WrongPassword999!'
        });

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('POST /api/auth/login should successfully authenticate owner credentials with 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testOwner.email,
          password: testOwner.password
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.token).toBeDefined();
      expect(res.body.data.user.role).toBe('OWNER');
      expect(res.body.data.user.password).toBeUndefined();

      ownerToken = res.body.data.token;
    });

    it('POST /api/auth/login should authenticate seeded admin with 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testAdmin.email,
          password: testAdmin.password
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.role).toBe('ADMIN');

      adminToken = res.body.data.token;
    });
  });

  describe('4. Profile Retrieval (GET /api/auth/me)', () => {
    it('GET /api/auth/me should reject unauthenticated request with 401', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('GET /api/auth/me should reject invalid Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.value');
      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
    });

    it('GET /api/auth/me should return user profile with 200 for valid token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.email).toBe(testOwner.email);
      expect(res.body.data.user.role).toBe('OWNER');
    });
  });

  describe('5. Role-Based Administration: Inspector Creation', () => {
    it('POST /api/auth/inspector should reject non-admin request with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/auth/inspector')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: testInspector.name,
          email: testInspector.email,
          password: testInspector.password
        });

      expect(res.status).toBe(403);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Insufficient permissions');
    });

    it('POST /api/auth/inspector should allow ADMIN to create an INSPECTOR with 201', async () => {
      const res = await request(app)
        .post('/api/auth/inspector')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: testInspector.name,
          email: testInspector.email,
          password: testInspector.password
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.role).toBe('INSPECTOR');
      expect(res.body.data.user.email).toBe(testInspector.email);

      createdUserIds.push(new mongoose.Types.ObjectId(res.body.data.user._id));
    });

    it('POST /api/auth/login should allow created INSPECTOR to log in with 200', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: testInspector.email,
          password: testInspector.password
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.user.role).toBe('INSPECTOR');

      inspectorToken = res.body.data.token;
    });
  });

  describe('6. RBAC Middleware Route Authorization', () => {
    it('GET /api/test/owner should allow OWNER (200) and reject without valid role', async () => {
      const res = await request(app)
        .get('/api/test/owner')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('OWNER role verified');
    });

    it('GET /api/test/inspector should allow INSPECTOR (200) and forbid OWNER (403)', async () => {
      const forbiddenRes = await request(app)
        .get('/api/test/inspector')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(forbiddenRes.status).toBe(403);

      const allowedRes = await request(app)
        .get('/api/test/inspector')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(allowedRes.status).toBe(200);
      expect(allowedRes.body.message).toContain('INSPECTOR role verified');
    });

    it('GET /api/test/admin should allow ADMIN (200) and forbid OWNER (403) and INSPECTOR (403)', async () => {
      const ownerRes = await request(app)
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(ownerRes.status).toBe(403);

      const inspectorRes = await request(app)
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${inspectorToken}`);
      expect(inspectorRes.status).toBe(403);

      const adminRes = await request(app)
        .get('/api/test/admin')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(adminRes.status).toBe(200);
      expect(adminRes.body.message).toContain('ADMIN role verified');
    });
  });

  describe('7. Session Invalidation & Logout', () => {
    it('POST /api/auth/logout should successfully invalidate current token session with 200', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.message).toContain('Logged out successfully');
    });

    it('GET /api/auth/me should reject previously invalidated token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(401);
      expect(res.body.status).toBe('error');
      expect(res.body.message).toContain('Token has been invalidated');
    });
  });
});
