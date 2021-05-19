/* global describe, it, beforeEach */
/* eslint-disable camelcase, import/no-unassigned-import */

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

  const controller = new unifi.Controller({host: CONTROLLER_IP, port: CONTROLLER_PORT});

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

  // GET SITE STATS
  it('getSitesStats()', done => {
    controller.getSitesStats()
      .then(sites => {
        if (typeof (sites) === 'undefined' || sites.length <= 0) {
          done(new Error('getSitesStats(): ' + JSON.stringify(sites)));
        } else {
          sites[0].name.should.equal('default');
          sites[0].desc.should.equal('Default');
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
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('unauthorizeGuest(): ' + JSON.stringify(result)));
        } else {
          console.log(JSON.stringify(result));
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

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

  // List user groups
  let defaultGroupID = null;
  it('getUserGroups()', done => {
    controller.getUserGroups()
      .then(result => {
        if (typeof (result) === 'undefined' || result.length <= 0) {
          done(new Error('getUserGroups(): ' + JSON.stringify(result)));
        } else {
          result[0].name.should.equal('Default');
          result[0].attr_no_delete.should.equal(true);
          defaultGroupID = result[0]._id;
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
          createdUserID = result[0].data[0]._id;
          done();
        } else {
          done(result[0].meta.msg);
        }
      })
      .catch(error => {
        done(error);
      });
  });

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
          console.log(result.length);
          console.log(JSON.stringify(result));
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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
          console.log(result);
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

  // GET SITE SYSINFO
  it('getSiteSysinfo()', done => {
    controller.getSiteSysinfo()
      .then(sysinfo => {
        if (typeof (sysinfo) === 'undefined' || sysinfo.length <= 0) {
          done(new Error('getSiteSysinfo(): ' + JSON.stringify(sysinfo)));
        } else {
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
          done();
        }
      })
      .catch(error => {
        done(error);
      });
  });

  // GET ALL USERS EVER CONNECTED
  it('getAllUsers()', done => {
    controller.getAllUsers()
      .then(users_data => {
        if (typeof (users_data) === 'undefined' || users_data.length < 0) {
          done(new Error('getAllUsers(): ' + JSON.stringify(users_data)));
        } else {
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
