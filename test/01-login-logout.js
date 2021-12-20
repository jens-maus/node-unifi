/* global describe, it, beforeEach */
/* eslint-disable camelcase, import/no-unassigned-import, capitalized-comments */

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
      setTimeout(resolve, 1000);
    });
  });

  const controller = new unifi.Controller({host: CONTROLLER_IP, port: CONTROLLER_PORT, sslverify: false});

  // LOGIN
  it('login()', done => {
    if (controller !== null) {
      controller.login(CONTROLLER_USER, CONTROLLER_PASS)
        .then(() => {
          done();
        })
        .catch(error => {
          done(error);
        });
    }
  });

  // GET SITE SYSINFO
  it('getSiteSysinfo()', done => {
    controller.getSiteSysinfo()
      .then(sysinfo => {
        if (typeof (sysinfo) === 'undefined' || sysinfo.length <= 0) {
          done(new Error('getSiteSysinfo(): ' + JSON.stringify(sysinfo)));
        } else {
          console.log(`      UniFi-Controller: ${sysinfo[0].version} (${sysinfo[0].build})`);
          sysinfo[0].timezone.should.equal('Europe/Berlin');
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET SITE STATS
  let defaultSiteID = null;
  it('getSitesStats()', done => {
    controller.getSitesStats()
      .then(sites => {
        if (typeof (sites) === 'undefined' || sites.length <= 0) {
          done(new Error('getSitesStats(): ' + JSON.stringify(sites)));
        } else {
          sites[0].name.should.equal('default');
          sites[0].desc.should.equal('Default');
          defaultSiteID = sites[0]._id;
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // AUTHORIZE GUEST
  it('authorizeGuest()', done => {
    controller.authorizeGuest('aa:bb:CC:DD:EE:FF', 100, 20, 30, 40, 'aa:bb:cc:dd:ee:fa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('authorizeGuest(): ' + JSON.stringify(result)));
        } else {
          result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
          result[0].end.should.aboveOrEqual(result[0].start + (100 * 60));
          result[0].end.should.belowOrEqual(result[0].start + (140 * 60));
          result[0].qos_rate_max_up.should.equal(20);
          result[0].qos_rate_max_down.should.equal(30);
          result[0].qos_usage_quota.should.equal(40);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // UN-AUTHORIZE GUEST
  it('unauthorizeGuest()', done => {
    controller.unauthorizeGuest('aa:bb:CC:DD:EE:FF')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('unauthorizeGuest(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // RE-CONNECT CLIENT
  /* WONTWORK: requires active AP connection
  it('reconnectClient()', done => {
    controller.reconnectClient('aa:bb:CC:DD:EE:FF')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('reconnectClient(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });
  */

  // Block a client device
  it('blockClient()', done => {
    controller.blockClient('aa:bb:CC:DD:EE:FF')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('blockClient(): ' + JSON.stringify(result)));
        } else {
          result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
          result[0].blocked.should.equal(true);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // List blocked client devices
  it('getBlockedUsers()', done => {
    controller.getBlockedUsers()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('getBlockedUsers(): ' + JSON.stringify(result)));
        } else {
          result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
          result[0].blocked.should.equal(true);
          result[0].name.should.equal('Testdevice');
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Unblock a client device
  it('unblockClient()', done => {
    controller.unblockClient('aa:bb:CC:DD:EE:FF')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('unblockClient(): ' + JSON.stringify(result)));
        } else {
          result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
          result[0].blocked.should.equal(false);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Create user group
  let testGroupID = null;
  let dummyGroupID = null;
  it('createUserGroup()', done => {
    controller.createUserGroup('Testgroup')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('createUserGroup(): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('Testgroup');
          result[0].qos_rate_max_down.should.equal(-1);
          testGroupID = result[0]._id;
          // console.log(JSON.stringify(result));
          return controller.createUserGroup('DUMMYgroup');
        }
      })
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('createUserGroup(DUMMYgroup): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('DUMMYgroup');
          result[0].qos_rate_max_down.should.equal(-1);
          dummyGroupID = result[0]._id;
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Delete user group
  it('deleteUserGroup()', done => {
    controller.deleteUserGroup(dummyGroupID)
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('deleteUserGroup(): ' + JSON.stringify(result)));
        } else {
          dummyGroupID = null;
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Edit user group
  it('editUserGroup()', done => {
    controller.editUserGroup(testGroupID, defaultSiteID, 'Testgroup', 100, 200)
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('editUserGroup(): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('Testgroup');
          result[0].qos_rate_max_down.should.equal(100);
          result[0].qos_rate_max_up.should.equal(200);
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // List user groups
  let defaultGroupID = null;
  it('getUserGroups()', done => {
    controller.getUserGroups()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 2) {
          done(new Error('getUserGroups(): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('Default');
          result[0].attr_no_delete.should.equal(true);
          result[1].name.should.equal('Testgroup');
          result[1].qos_rate_max_down.should.equal(100);
          result[1].qos_rate_max_up.should.equal(200);
          defaultGroupID = result[0]._id;
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Create a new user/client-device
  let createdUserID = null;
  it('createUser()', done => {
    controller.createUser('FF:EE:DD:CC:bb:aa', defaultGroupID, 'createUserTest', 'createUserTest note', true, false)
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('createUser(): ' + JSON.stringify(result)));
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
          done();
        } else {
          done(result[0].meta.msg);
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Assign client device to another group
  it('setUserGroup()', done => {
    controller.setUserGroup(createdUserID, testGroupID)
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('setUserGroup(): ' + JSON.stringify(result)));
        } else {
          result[0].note.should.equal('createUserTest note');
          result[0].name.should.equal('createUserTest');
          result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
          result[0].is_wired.should.equal(true);
          result[0].is_guest.should.equal(false);
          result[0]._id.should.equal(createdUserID);
          result[0].usergroup_id.should.equal(testGroupID);
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Fetch AP groups
  it('getAPGroups()', done => {
    controller.getAPGroups()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('getAPGroups(): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('All APs');
          result[0].attr_no_delete.should.equal(true);
          result[0].attr_hidden_id.should.equal('default');
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Update client fixedip
  /* WONTWORK: Needs some active device
  it('editClientFixedIP()', done => {
    controller.editClientFixedIP(createdUserID, true, null, '192.168.1.1')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('editClientFixedIP(): ' + JSON.stringify(result)));
        } else {
          console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });
  */

  // Add/modify/remove a client device not
  it('setClientNote()', done => {
    controller.setClientNote(createdUserID, 'createUserTest note changed')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('setClientNote(): ' + JSON.stringify(result)));
        } else {
          result[0].note.should.equal('createUserTest note changed');
          result[0].name.should.equal('createUserTest');
          result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
          result[0].is_wired.should.equal(true);
          result[0].is_guest.should.equal(false);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Add/modify/remove a client device not
  it('setClientName()', done => {
    controller.setClientName(createdUserID, 'createUserTest changed')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('setClientName(): ' + JSON.stringify(result)));
        } else {
          result[0].note.should.equal('createUserTest note changed');
          result[0].name.should.equal('createUserTest changed');
          result[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
          result[0].is_wired.should.equal(true);
          result[0].is_guest.should.equal(false);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // 5 minutes site stats method
  it('get5minSiteStats()', done => {
    controller.get5minSiteStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('get5minSiteStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Hourly site stats method
  it('getHourlySiteStats()', done => {
    controller.getHourlySiteStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getHourlySiteStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Daily site stats method
  it('getDailySiteStats()', done => {
    controller.getDailySiteStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getDailySiteStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Monthly site stats method
  it('getMonthlySiteStats()', done => {
    controller.getMonthlySiteStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getMonthlySiteStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // 5 minutes stats method for a single access point or all access points
  it('get5minApStats()', done => {
    controller.get5minApStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('get5minApStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Hourly stats method for a single access point or all access points
  it('getHourlyApStats()', done => {
    controller.getHourlyApStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getHourlyApStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Daily stats method for a single access point or all access points
  it('getDailyApStats()', done => {
    controller.getDailyApStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getDailyApStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Monthly stats method for a single access point or all access points
  it('getMonthlyApStats()', done => {
    controller.getMonthlyApStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getMonthlyApStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // 5 minutes stats method for a single user/client device
  it('get5minUserStats()', done => {
    controller.get5minUserStats('ff:ee:dd:cc:bb:aa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('get5minUserStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Hourly stats method for a a single user/client device
  it('getHourlyUserStats()', done => {
    controller.getHourlyUserStats('ff:ee:dd:cc:bb:aa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getHourlyUserStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Daily stats method for a single user/client device
  it('getDailyUserStats()', done => {
    controller.getDailyUserStats('ff:ee:dd:cc:bb:aa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getDailyUserStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Monthly stats method for a single user/client device
  it('getMonthlyUserStats()', done => {
    controller.getMonthlyUserStats('ff:ee:dd:cc:bb:aa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getMonthlyUserStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // 5 minutes gateway stats method
  it('get5minGatewayStats()', done => {
    controller.get5minGatewayStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('get5minGatewayStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Hourly gateway stats method
  it('getHourlyGatewayStats()', done => {
    controller.getHourlyGatewayStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getHourlyGatewayStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Daily gateway stats method
  it('getDailyGatewayStats()', done => {
    controller.getDailyGatewayStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getDailyGatewayStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Monthly gateway stats method
  it('getMonthlyGatewayStats()', done => {
    controller.getMonthlyGatewayStats()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getMonthlyGatewayStats(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Method to fetch speed test results
  it('getSpeedTestResults()', done => {
    controller.getSpeedTestResults()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getSpeedTestResults(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Method to fetch IPS/IDS event
  it('getIPSEvents()', done => {
    controller.getIPSEvents()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getIPSEvents(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Show all login sessions
  it('getSessions()', done => {
    controller.getSessions()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getSessions(): ' + JSON.stringify(result)));
        } else {
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Show latest 'n' login sessions for a single client device
  it('getLatestSessions()', done => {
    controller.getLatestSessions('ff:ee:dd:cc:bb:aa')
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getLatestSessions(): ' + JSON.stringify(result)));
        } else {
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Show all authorizations
  it('getAllAuthorizations()', done => {
    controller.getAllAuthorizations()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('getAllAuthorizations(): ' + JSON.stringify(result)));
        } else {
          result[0].mac.should.equal('aa:bb:cc:dd:ee:ff');
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Forget one or more client devices
  it('forgetClient()', done => {
    controller.forgetClient(['aa:bb:cc:dd:ee:ff', 'FF:EE:DD:CC:bb:aa'])
      .then(result => {
        if (typeof (result) === 'undefined') {
          done(new Error('forgetClient(): ' + JSON.stringify(result)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // Fetch guest devices
  it('getGuests()', done => {
    controller.getGuests()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length < 0) {
          done(new Error('getGuests(): ' + JSON.stringify(result)));
        } else {
          // console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET CLIENT DEVICES
  it('getClientDevices()', done => {
    controller.getClientDevices()
      .then(client_data => {
        if (typeof (client_data) === 'undefined' || client_data.length < 0) {
          done(new Error('getClientDevices(): ' + JSON.stringify(client_data)));
        } else {
          // console.log(JSON.stringify(client_data));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET CLIENT DEVICE
  /* WONTWORK: No active client device
  it('getClientDevice()', done => {
    controller.getClientDevice()
      .then(client_data => {
        if (typeof (client_data) === 'undefined' || client_data.length < 0) {
          done(new Error('getClientDevice(): ' + JSON.stringify(client_data)));
        } else {
          console.log(JSON.stringify(client_data));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });
  */

  // GET ALL USERS EVER CONNECTED
  it('getAllUsers()', done => {
    controller.getAllUsers()
      .then(users_data => {
        if (typeof (users_data) === 'undefined' || users_data.length < 0) {
          done(new Error('getAllUsers(): ' + JSON.stringify(users_data)));
        } else {
          // console.log(JSON.stringify(users_data));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET ALL ACCESS DEVICES
  it('getAccessDevices()', done => {
    controller.getAccessDevices()
      .then(access_data => {
        if (typeof (access_data) === 'undefined' || access_data.length < 0) {
          done(new Error('getAccessDevices(): ' + JSON.stringify(access_data)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET ALL SESSIONS
  it('getSessions()', done => {
    controller.getSessions()
      .then(session_data => {
        if (typeof (session_data) === 'undefined' || session_data.length < 0) {
          done(new Error('getSessions(): ' + JSON.stringify(session_data)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET USERS
  it('getUsers()', done => {
    controller.getUsers()
      .then(user_data => {
        if (typeof (user_data) === 'undefined' || user_data.length < 0) {
          done(new Error('getUsers(): ' + JSON.stringify(user_data)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET SELF
  it('getSelf()', done => {
    controller.getSelf()
      .then(self_data => {
        if (typeof (self_data) === 'undefined' || self_data.length <= 0) {
          done(new Error('getSelf(): ' + JSON.stringify(self_data)));
        } else {
          self_data[0].email.should.equal('demo@ubnt.com');
          self_data[0].site_role.should.equal('admin');
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET STATUS
  it('getStatus()', done => {
    controller.getStatus()
      .then(status_data => {
        if (typeof (status_data) === 'undefined') {
          done(new Error('getStatus(): ' + JSON.stringify(status_data)));
        } else {
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET FULL STATUS
  it('getFullStatus()', done => {
    controller.getFullStatus()
      .then(status_data => {
        if (typeof (status_data) === 'undefined' || status_data.length <= 0) {
          done(new Error('getFullStatus(): ' + JSON.stringify(status_data)));
        } else {
          status_data.meta.rc.should.equal('ok');
          status_data.meta.up.should.equal(true);
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET DEVICE NAME MAPPINGS
  it('getDeviceNameMappings()', done => {
    controller.getDeviceNameMappings()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('getDeviceNameMappings(): ' + JSON.stringify(result)));
        } else {
          result.BZ2.base_model.should.equal('BZ2');
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // LOGOUT
  it('logout()', done => {
    controller.logout()
      .then(() => {
        done();
      })
      .catch(error => {
        done(error);
      });
  });
});
