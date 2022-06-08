/* global describe, it, beforeEach */
/* eslint-disable import/no-unassigned-import, capitalized-comments */

require('should');
const unifi = require('../unifi.js');

let CONTROLLER_IP = '127.0.0.1';
if (process.env.CONTROLLER_IP) {
  CONTROLLER_IP = process.env.CONTROLLER_IP;
}

let CONTROLLER_PORT = 8443;
if (process.env.CONTROLLER_PORT) {
  CONTROLLER_PORT = process.env.CONTROLLER_PORT;
}

let CONTROLLER_USER = 'ubnt';
if (process.env.CONTROLLER_USER) {
  CONTROLLER_USER = process.env.CONTROLLER_USER;
}

let CONTROLLER_PASS = 'ubnt';
if (process.env.CONTROLLER_PASS) {
  CONTROLLER_PASS = process.env.CONTROLLER_PASS;
}

// Run the tests
describe('Running tests', () => {
  // Slow down tests a bit to get the unifi controller time to
  // process
  beforeEach(async () => {
    await new Promise(resolve => {
      setTimeout(resolve, 500);
    });
  });

  const controller = new unifi.Controller({host: CONTROLLER_IP, port: CONTROLLER_PORT, sslverify: false});

  // LOGIN
  it('login()', async () => {
    if (controller === null) {
      throw new Error('uninitialized controller');
    } else {
      return controller.login(CONTROLLER_USER, CONTROLLER_PASS);
    }
  });

  // GET SITE SYSINFO
  it('getSiteSysinfo()', async () => {
    const sysinfo = await controller.getSiteSysinfo();
    if (typeof (sysinfo) === 'undefined' || sysinfo.length <= 0) {
      throw new Error('getSiteSysinfo(): ' + JSON.stringify(sysinfo));
    } else {
      console.log(`      UniFi-Controller: ${sysinfo[0].version} (${sysinfo[0].build})`);
      sysinfo[0].timezone.should.equal('Europe/Berlin');
    }
  });

  // GET SITE STATS
  let defaultSiteID = null;
  it('getSitesStats()', async () => {
    const sites = await controller.getSitesStats();
    if (typeof (sites) === 'undefined' || sites.length <= 0) {
      throw new Error('getSitesStats(): ' + JSON.stringify(sites));
    } else {
      sites[0].name.should.equal('default');
      sites[0].desc.should.equal('Default');
      defaultSiteID = sites[0]._id;
    }
  });

  // AUTHORIZE GUEST
  it('authorizeGuest()', async () => {
    const result = await controller.authorizeGuest('aa:bb:CC:DD:EE:FF', 100, 20, 30, 40, 'aa:bb:cc:dd:ee:fa');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('authorizeGuest(): ' + JSON.stringify(result));
    } else {
      result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
      result[0].end.should.aboveOrEqual(result[0].start + (100 * 60));
      result[0].end.should.belowOrEqual(result[0].start + (140 * 60));
      result[0].qos_rate_max_up.should.equal(20);
      result[0].qos_rate_max_down.should.equal(30);
      result[0].qos_usage_quota.should.equal(40);
    }
  });

  // UN-AUTHORIZE GUEST
  it('unauthorizeGuest()', async () => {
    const result = await controller.unauthorizeGuest('aa:bb:CC:DD:EE:FF');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('unauthorizeGuest(): ' + JSON.stringify(result));
    }
  });

  // RE-CONNECT CLIENT
  /* WONTWORK: requires active AP connection
  it('reconnectClient()', async () => {
    const result = await controller.reconnectClient('aa:bb:CC:DD:EE:FF');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('reconnectClient(): ' + JSON.stringify(result));
    }
  });
  */

  // Block a client device
  it('blockClient()', async () => {
    const result = await controller.blockClient('aa:bb:CC:DD:EE:FF');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('blockClient(): ' + JSON.stringify(result));
    } else {
      result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
      result[0].blocked.should.equal(true);
    }
  });

  // List blocked client devices
  it('getBlockedUsers()', async () => {
    const result = await controller.getBlockedUsers();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getBlockedUsers(): ' + JSON.stringify(result));
    } else {
      result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
      result[0].blocked.should.equal(true);
      result[0].name.should.equal('Testdevice');
      // console.log(JSON.stringify(result));
    }
  });

  // Unblock a client device
  it('unblockClient()', async () => {
    const result = await controller.unblockClient('aa:bb:CC:DD:EE:FF');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('unblockClient(): ' + JSON.stringify(result));
    } else {
      result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
      result[0].blocked.should.equal(false);
    }
  });

  // Create user group
  let testGroupID = null;
  let dummyGroupID = null;
  it('createUserGroup()', async () => {
    const result = await controller.createUserGroup('Testgroup');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('createUserGroup(): ' + JSON.stringify(result));
    } else {
      result[0].name.should.equal('Testgroup');
      result[0].qos_rate_max_down.should.equal(-1);
      testGroupID = result[0]._id;
      // console.log(JSON.stringify(result));

      const result2 = await controller.createUserGroup('DUMMYgroup');
      if (typeof (result2) === 'undefined' || result2.length <= 0) {
        throw new Error('createUserGroup(DUMMYgroup): ' + JSON.stringify(result2));
      } else {
        result2[0].name.should.equal('DUMMYgroup');
        result2[0].qos_rate_max_down.should.equal(-1);
        dummyGroupID = result2[0]._id;
        // console.log(JSON.stringify(result));
      }
    }
  });

  // Delete user group
  it('deleteUserGroup()', async () => {
    const result = await controller.deleteUserGroup(dummyGroupID);
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('deleteUserGroup(): ' + JSON.stringify(result));
    } else {
      dummyGroupID = null;
      // console.log(JSON.stringify(result));
    }
  });

  // Edit user group
  it('editUserGroup()', async () => {
    const result = await controller.editUserGroup(testGroupID, defaultSiteID, 'Testgroup', 100, 200);
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('editUserGroup(): ' + JSON.stringify(result));
    } else {
      result[0].name.should.equal('Testgroup');
      result[0].qos_rate_max_down.should.equal(100);
      result[0].qos_rate_max_up.should.equal(200);
      // console.log(JSON.stringify(result));
    }
  });

  // List user groups
  let defaultGroupID = null;
  it('getUserGroups()', async () => {
    const result = await controller.getUserGroups();
    if (typeof (result) === 'undefined' || result.length < 2) {
      throw new Error('getUserGroups(): ' + JSON.stringify(result));
    } else {
      result[0].name.should.equal('Default');
      result[0].attr_no_delete.should.equal(true);
      result[1].name.should.equal('Testgroup');
      result[1].qos_rate_max_down.should.equal(100);
      result[1].qos_rate_max_up.should.equal(200);
      defaultGroupID = result[0]._id;
      // console.log(JSON.stringify(result));
    }
  });

  // Create a new user/client-device
  let createdUserID = null;
  it('createUser()', async () => {
    const result = await controller.createUser('FF:EE:DD:CC:bb:aa', defaultGroupID, 'createUserTest', 'createUserTest note', true, false);
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('createUser(): ' + JSON.stringify(result));
    } else if (typeof (result[0].meta.msg) === 'undefined') {
      result[0].meta.rc.should.equal('ok');
      result[0].data[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
      result[0].data[0].name.should.equal('createUserTest');
      result[0].data[0].note.should.equal('createUserTest note');
      result[0].data[0].is_wired.should.equal(true);
      result[0].data[0].is_guest.should.equal(false);
      result[0].data[0].usergroup_id.should.equal('');
      createdUserID = result[0].data[0]._id;
      // console.log(JSON.stringify(result));
    } else {
      throw result[0].meta.msg;
    }
  });

  // Assign client device to another group
  it('setUserGroup()', async () => {
    const result = await controller.setUserGroup(createdUserID, testGroupID);
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('setUserGroup(): ' + JSON.stringify(result));
    } else {
      result[0].note.should.equal('createUserTest note');
      result[0].name.should.equal('createUserTest');
      result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
      result[0].is_wired.should.equal(true);
      result[0].is_guest.should.equal(false);
      result[0]._id.should.equal(createdUserID);
      result[0].usergroup_id.should.equal(testGroupID);
      // console.log(JSON.stringify(result));
    }
  });

  // Fetch AP groups
  it('getAPGroups()', async () => {
    const result = await controller.getAPGroups();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getAPGroups(): ' + JSON.stringify(result));
    } else {
      result[0].name.should.equal('All APs');
      result[0].attr_no_delete.should.equal(true);
      result[0].attr_hidden_id.should.equal('default');
      // console.log(JSON.stringify(result));
    }
  });

  // Update client fixedip
  /* WONTWORK: Needs some active device
  it('editClientFixedIP()', async () => {
    const result = await controller.editClientFixedIP(createdUserID, true, null, '192.168.1.1');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('editClientFixedIP(): ' + JSON.stringify(result));
    } else {
      console.log(JSON.stringify(result));
    }
  });
  */

  // Add/modify/remove a client device not
  it('setClientNote()', async () => {
    const result = await controller.setClientNote(createdUserID, 'createUserTest note changed');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('setClientNote(): ' + JSON.stringify(result));
    } else {
      result[0].note.should.equal('createUserTest note changed');
      result[0].name.should.equal('createUserTest');
      result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
      result[0].is_wired.should.equal(true);
      result[0].is_guest.should.equal(false);
    }
  });

  // Add/modify/remove a client device not
  it('setClientName()', async () => {
    const result = controller.setClientName(createdUserID, 'createUserTest changed');
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('setClientName(): ' + JSON.stringify(result));
    } else {
      result[0].note.should.equal('createUserTest note changed');
      result[0].name.should.equal('createUserTest changed');
      result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
      result[0].is_wired.should.equal(true);
      result[0].is_guest.should.equal(false);
    }
  });

  // 5 minutes site stats method
  it('get5minSiteStats()', async () => {
    const result = await controller.get5minSiteStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('get5minSiteStats(): ' + JSON.stringify(result));
    }
  });

  // Hourly site stats method
  it('getHourlySiteStats()', async () => {
    const result = await controller.getHourlySiteStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getHourlySiteStats(): ' + JSON.stringify(result));
    }
  });

  // Daily site stats method
  it('getDailySiteStats()', async () => {
    const result = await controller.getDailySiteStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getDailySiteStats(): ' + JSON.stringify(result));
    }
  });

  // Monthly site stats method
  it('getMonthlySiteStats()', async () => {
    const result = await controller.getMonthlySiteStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getMonthlySiteStats(): ' + JSON.stringify(result));
    }
  });

  // 5 minutes stats method for a single access point or all access points
  it('get5minApStats()', async () => {
    const result = await controller.get5minApStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('get5minApStats(): ' + JSON.stringify(result));
    }
  });

  // Hourly stats method for a single access point or all access points
  it('getHourlyApStats()', async () => {
    const result = await controller.getHourlyApStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getHourlyApStats(): ' + JSON.stringify(result));
    }
  });

  // Daily stats method for a single access point or all access points
  it('getDailyApStats()', async () => {
    const result = await controller.getDailyApStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getDailyApStats(): ' + JSON.stringify(result));
    }
  });

  // Monthly stats method for a single access point or all access points
  it('getMonthlyApStats()', async () => {
    const result = await controller.getMonthlyApStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getMonthlyApStats(): ' + JSON.stringify(result));
    }
  });

  // 5 minutes stats method for a single user/client device
  it('get5minUserStats()', async () => {
    const result = await controller.get5minUserStats('ff:ee:dd:cc:bb:aa');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('get5minUserStats(): ' + JSON.stringify(result));
    }
  });

  // Hourly stats method for a a single user/client device
  it('getHourlyUserStats()', async () => {
    const result = await controller.getHourlyUserStats('ff:ee:dd:cc:bb:aa');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getHourlyUserStats(): ' + JSON.stringify(result));
    }
  });

  // Daily stats method for a single user/client device
  it('getDailyUserStats()', async () => {
    const result = await controller.getDailyUserStats('ff:ee:dd:cc:bb:aa');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getDailyUserStats(): ' + JSON.stringify(result));
    }
  });

  // Monthly stats method for a single user/client device
  it('getMonthlyUserStats()', async () => {
    const result = await controller.getMonthlyUserStats('ff:ee:dd:cc:bb:aa');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getMonthlyUserStats(): ' + JSON.stringify(result));
    }
  });

  // 5 minutes gateway stats method
  it('get5minGatewayStats()', async () => {
    const result = await controller.get5minGatewayStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('get5minGatewayStats(): ' + JSON.stringify(result));
    }
  });

  // Hourly gateway stats method
  it('getHourlyGatewayStats()', async () => {
    const result = await controller.getHourlyGatewayStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getHourlyGatewayStats(): ' + JSON.stringify(result));
    }
  });

  // Daily gateway stats method
  it('getDailyGatewayStats()', async () => {
    const result = await controller.getDailyGatewayStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getDailyGatewayStats(): ' + JSON.stringify(result));
    }
  });

  // Monthly gateway stats method
  it('getMonthlyGatewayStats()', async () => {
    const result = await controller.getMonthlyGatewayStats();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getMonthlyGatewayStats(): ' + JSON.stringify(result));
    }
  });

  // Method to fetch speed test results
  it('getSpeedTestResults()', async () => {
    const result = await controller.getSpeedTestResults();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getSpeedTestResults(): ' + JSON.stringify(result));
    }
  });

  // Method to fetch IPS/IDS event
  it('getIPSEvents()', async () => {
    const result = await controller.getIPSEvents();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getIPSEvents(): ' + JSON.stringify(result));
    }
  });

  // Show all login sessions
  it('getSessions()', async () => {
    const result = await controller.getSessions();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getSessions(): ' + JSON.stringify(result));
    }
  });

  // Show latest 'n' login sessions for a single client device
  it('getLatestSessions()', async () => {
    const result = await controller.getLatestSessions('ff:ee:dd:cc:bb:aa');
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getLatestSessions(): ' + JSON.stringify(result));
    }
  });

  // Show all authorizations
  it('getAllAuthorizations()', async () => {
    const result = await controller.getAllAuthorizations();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getAllAuthorizations(): ' + JSON.stringify(result));
    } else {
      result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
    }
  });

  // Forget one or more client devices
  it('forgetClient()', async () => {
    const result = await controller.forgetClient(['aa:bb:cc:dd:ee:ff', 'FF:EE:DD:CC:bb:aa']);
    if (typeof (result) === 'undefined') {
      throw new TypeError('forgetClient(): ' + JSON.stringify(result));
    }
  });

  // Fetch guest devices
  it('getGuests()', async () => {
    const result = await controller.getGuests();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getGuests(): ' + JSON.stringify(result));
    }
  });

  // GET CLIENT DEVICES
  it('getClientDevices()', async () => {
    const result = await controller.getClientDevices();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getClientDevices(): ' + JSON.stringify(result));
    }
  });

  // GET CLIENT DEVICE
  /* WONTWORK: No active client device
  it('getClientDevice()', async () => {
    const result = await controller.getClientDevice();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getClientDevice(): ' + JSON.stringify(result));
    } else {
      console.log(JSON.stringify(result));
    }
  });
  */

  // GET ALL USERS EVER CONNECTED
  it('getAllUsers()', async () => {
    const result = await controller.getAllUsers();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getAllUsers(): ' + JSON.stringify(result));
    }
  });

  // GET ALL ACCESS DEVICES
  it('getAccessDevices()', async () => {
    const result = await controller.getAccessDevices();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getAccessDevices(): ' + JSON.stringify(result));
    }
  });

  // GET ALL SESSIONS
  it('getSessions()', async () => {
    const result = await controller.getSessions();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getSessions(): ' + JSON.stringify(result));
    }
  });

  // GET USERS
  it('getUsers()', async () => {
    const result = await controller.getUsers();
    if (typeof (result) === 'undefined' || result.length < 0) {
      throw new Error('getUsers(): ' + JSON.stringify(result));
    }
  });

  // GET SELF
  it('getSelf()', async () => {
    const result = await controller.getSelf();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getSelf(): ' + JSON.stringify(result));
    } else {
      result[0].email.should.equal('demo@ubnt.com');
      result[0].site_role.should.equal('admin');
    }
  });

  // GET STATUS
  it('getStatus()', async () => {
    const result = await controller.getStatus();
    if (typeof (result) === 'undefined') {
      throw new TypeError('getStatus(): ' + JSON.stringify(result));
    }
  });

  // GET FULL STATUS
  it('getFullStatus()', async () => {
    const result = await controller.getFullStatus();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getFullStatus(): ' + JSON.stringify(result));
    } else {
      result.meta.rc.should.equal('ok');
      result.meta.up.should.equal(true);
    }
  });

  // GET DEVICE NAME MAPPINGS
  it('getDeviceNameMappings()', async () => {
    const result = await controller.getDeviceNameMappings();
    if (typeof (result) === 'undefined' || result.length <= 0) {
      throw new Error('getDeviceNameMappings(): ' + JSON.stringify(result));
    } else {
      result.BZ2.base_model.should.equal('BZ2');
    }
  });

  // LOGOUT
  it('logout()', async () => {
    await controller.logout();
  });
});
