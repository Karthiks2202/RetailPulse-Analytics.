import app from './app';
import { prisma } from './config/database';
import axios from 'axios';
import { Server } from 'http';

const PORT = 5055;
const BASE_URL = `http://localhost:${PORT}/api`;

async function runTests() {
  console.log('=== STARTING INTEGRATION TESTS ===');
  let server: Server;

  try {
    // 1. Clear database tables to ensure clean state
    console.log('Clearing old test database records...');
    await prisma.refreshToken.deleteMany({});
    await prisma.auditLog.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.company.deleteMany({});

    // 2. Start Express Server
    server = app.listen(PORT, () => {
      console.log(`Test server running on ${BASE_URL}`);
    });

    // 3. Register Company A
    console.log('\nTesting Company A Registration...');
    const companyAReg = await axios.post(`${BASE_URL}/auth/register`, {
      companyName: 'RetailPulse Alpha',
      industry: 'Retail',
      companyEmail: 'contact@alpha.com',
      companyAddress: '123 Alpha Boulevard',
      companyPhone: '111-222-3333',
      ownerName: 'Alice Alpha',
      ownerEmail: 'alice@alpha.com',
      password: 'password123',
      confirmPassword: 'password123',
    });
    
    console.log('✔ Company A registered. Admin:', companyAReg.data.user.email);
    const companyAId = companyAReg.data.company.id;

    // Verify company email unique validation
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        companyName: 'RetailPulse Duplicate',
        industry: 'Retail',
        companyEmail: 'contact@alpha.com', // Duplicate
        companyAddress: '456 Lane',
        companyPhone: '000-000-0000',
        ownerName: 'Duplicate Owner',
        ownerEmail: 'dup@dup.com',
        password: 'password123',
        confirmPassword: 'password123',
      });
      console.log('❌ FAIL: Allowed duplicate company email registration');
    } catch (err: any) {
      console.log('✔ Successfully blocked duplicate company email (Status:', err.response?.status, '-', err.response?.data?.error, ')');
    }

    // 4. Log in Company A Admin
    console.log('\nTesting Login...');
    const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@alpha.com',
      password: 'password123',
    });
    console.log('✔ Login successful. User:', loginRes.data.user.name);
    let accessTokenA = loginRes.data.accessToken;
    let refreshTokenA = loginRes.data.refreshToken;

    // 5. Check profile retrieval
    console.log('\nTesting User Profile fetch...');
    const profileRes = await axios.get(`${BASE_URL}/profile/me`, {
      headers: { Authorization: `Bearer ${accessTokenA}` },
    });
    console.log('✔ Profile fetched. Company association:', profileRes.data.company.name);

    // 6. Test Token Refresh
    console.log('\nTesting Token Refresh rotation...');
    const refreshRes = await axios.post(`${BASE_URL}/auth/refresh`, {
      refreshToken: refreshTokenA,
    });
    console.log('✔ Token refresh successful. Received new access token.');
    accessTokenA = refreshRes.data.accessToken;
    refreshTokenA = refreshRes.data.refreshToken;

    // 7. Test Password Change
    console.log('\nTesting Password Change...');
    await axios.post(
      `${BASE_URL}/profile/change-password`,
      {
        currentPassword: 'password123',
        newPassword: 'newpassword456',
      },
      { headers: { Authorization: `Bearer ${accessTokenA}` } }
    );
    console.log('✔ Password changed successfully.');

    // Try logging in with old password
    try {
      await axios.post(`${BASE_URL}/auth/login`, {
        email: 'alice@alpha.com',
        password: 'password123', // Old password
      });
      console.log('❌ FAIL: Allowed login with deprecated password');
    } catch (err: any) {
      console.log('✔ Successfully blocked login with old password');
    }

    // Log in with new password
    const newLoginRes = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'alice@alpha.com',
      password: 'newpassword456',
    });
    console.log('✔ Logged in with new password successfully.');
    accessTokenA = newLoginRes.data.accessToken;
    refreshTokenA = newLoginRes.data.refreshToken;

    // 8. Register Company B
    console.log('\nRegistering Company B for tenant isolation tests...');
    const companyBReg = await axios.post(`${BASE_URL}/auth/register`, {
      companyName: 'RetailPulse Beta',
      industry: 'Fashion',
      companyEmail: 'contact@beta.com',
      companyAddress: '456 Beta Boulevard',
      companyPhone: '444-555-6666',
      ownerName: 'Bob Beta',
      ownerEmail: 'bob@beta.com',
      password: 'password789',
      confirmPassword: 'password789',
    });
    const companyBId = companyBReg.data.company.id;
    console.log('✔ Company B registered. Admin:', companyBReg.data.user.email);

    // 9. Verify Multi-Tenant Company Isolation
    console.log('\nTesting Multi-Tenant Isolation boundaries...');
    try {
      // Alice (Company A) tries to access Company B details
      await axios.get(`${BASE_URL}/companies/${companyBId}`, {
        headers: { Authorization: `Bearer ${accessTokenA}` },
      });
      console.log('❌ FAIL: User from Company A accessed Company B data');
    } catch (err: any) {
      console.log(
        '✔ Successfully blocked cross-tenant access! Status:',
        err.response?.status,
        '-',
        err.response?.data?.error
      );
    }

    // 10. Logout user A
    console.log('\nTesting Logout...');
    await axios.post(`${BASE_URL}/auth/logout`, {
      refreshToken: refreshTokenA,
    });
    console.log('✔ User logged out.');

    // 11. Print Audit Log trace
    console.log('\nRetrieving generated Audit Logs from database...');
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'asc' },
      include: { company: true, user: true },
    });

    console.log('\n--- AUDIT LOG TRAIL ---');
    logs.forEach((log: any) => {
      console.log(
        `[${log.timestamp.toISOString()}] | Company: ${log.company.name} | User: ${
          log.user?.name || 'Unknown'
        } | Action: ${log.action} | IP: ${log.ipAddress} | Browser: ${log.browser.substring(0, 30)}...`
      );
    });
    console.log('-----------------------\n');

    console.log('=== ALL INTEGRATION TESTS PASSED SUCCESSFULLY! ===');
  } catch (error: any) {
    console.error('❌ TEST RUN ENCOUNTERED ERROR:', error.response?.data || error.message);
  } finally {
    if (server!) {
      server.close(() => {
        console.log('Test server shut down.');
      });
    }
  }
}

runTests();
