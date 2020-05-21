/* global describe, it */
/* eslint-disable camelcase, max-nested-callbacks, import/no-unassigned-import */

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
  const controller = new unifi.Controller(CONTROLLER_IP, CONTROLLER_PORT);

  // LOGIN
  it('login()', done => {
    if (controller !== null) {
      controller.login(CONTROLLER_USER, CONTROLLER_PASS, err => {
        if (err) {
          done(err);
        } else {
          done();
        }
      });
    }
  });

  // GET SITE STATS
  let controller_sites = null;
  it('getSitesStats()', done => {
    controller.getSitesStats((err, sites) => {
      if (err) {
        done(err);
      } else if (typeof (sites) === 'undefined' || sites.length <= 0) {
        done('ERROR: getSitesStats()');
      } else {
        controller_sites = sites;
        done();
      }
    });
  });

  // AUTHORIZE GUEST
  it('authorizeGuest()', done => {
    controller.authorizeGuest(controller_sites[0].name, 'aa:bb:CC:DD:EE:FF', 100, (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: authorizeGuest()');
      } else {
        result[0][0].mac.should.equal('aa:bb:cc:dd:ee:ff');
        result[0][0].end.should.aboveOrEqual(result[0][0].start + (100 * 60));
        result[0][0].end.should.belowOrEqual(result[0][0].start + (140 * 60));
        result[0][0].qos_rate_max_up.should.equal(20);
        result[0][0].qos_rate_max_down.should.equal(30);
        result[0][0].qos_usage_quota.should.equal(40);
        done();
      }
    }, 20, 30, 40, 'ff:ee:dd:cc:BB:AA');
  });

  // UN-AUTHORIZE GUEST
  it('unauthorizeGuest()', done => {
    controller.unauthorizeGuest(controller_sites[0].name, 'aa:bb:CC:DD:EE:FF', (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: unauthorizeGuest()');
      } else {
        done();
      }
    });
  });

  // Reconnect a client device
  it('reconnectClient()', done => {
    controller.unauthorizeGuest(controller_sites[0].name, 'aa:bb:CC:DD:EE:FF', (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: reconnectClient()');
      } else {
        done();
      }
    });
  });

  // Block a client device
  it('blockClient()', done => {
    controller.blockClient(controller_sites[0].name, 'aa:bb:CC:DD:EE:FF', (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: blockClient()');
      } else {
        result[0][0].mac.should.equal('aa:bb:cc:dd:ee:ff');
        result[0][0].blocked.should.equal(true);
        done();
      }
    });
  });

  // Unblock a client device
  it('unblockClient()', done => {
    controller.unblockClient(controller_sites[0].name, 'aa:bb:CC:DD:EE:FF', (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: unblockClient()');
      } else {
        result[0][0].mac.should.equal('aa:bb:cc:dd:ee:ff');
        result[0][0].blocked.should.equal(false);
        done();
      }
    });
  });

  // Forget one or more client devices
  it('forgetClient()', done => {
    controller.forgetClient(controller_sites[0].name, ['aa:bb:CC:DD:EE:FF'], (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: forgetClient()');
      } else {
        done();
      }
    });
  });

  // List user groups
  let defaultGroupID = null;
  it('getUserGroups()', done => {
    controller.getUserGroups(controller_sites[0].name, (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: getUserGroups()');
      } else {
        result[0][0].name.should.equal('Default');
        result[0][0].attr_no_delete.should.equal(true);
        defaultGroupID = result[0][0]._id;
        done();
      }
    });
  });

  // Create a new user/client-device
  it('createUser()', done => {
    controller.createUser(controller_sites[0].name, 'FF:EE:DD:CC:bb:aa', defaultGroupID, (err, result) => {
      if (err) {
        done(err);
      } else if (typeof (result) === 'undefined') {
        done('ERROR: createUser()');
      } else {
        result[0][0].meta.rc.should.equal('ok');
        result[0][0].data[0].mac.should.equal('ff:ee:dd:cc:bb:aa');
        result[0][0].data[0].name.should.equal('createUserTest');
        result[0][0].data[0].note.should.equal('createUserTest note');
        result[0][0].data[0].should.is_wired(true);
        result[0][0].data[0].should.is_guest(false);
        done();
      }
    }, 'createUserTest', 'createUserTest note', true, false);
  });

  // GET SITE SYSINFO
  it('getSiteSysinfo()', done => {
    controller.getSiteSysinfo(controller_sites[0].name, (err, sysinfo) => {
      if (err) {
        done(err);
      } else if (typeof (sysinfo) === 'undefined' || sysinfo.length <= 0) {
        done('ERROR: getSiteSysinfo()');
      } else {
        done();
      }
    });
  });

  // GET CLIENT DEVICES
  it('getClientDevices()', done => {
    controller.getClientDevices(controller_sites[0].name, (err, client_data) => {
      if (err) {
        done(err);
      } else if (typeof (client_data) === 'undefined' || client_data.length < 0) {
        done('ERROR: getClientDevices()');
      } else {
        done();
      }
    });
  });

  // GET ALL USERS EVER CONNECTED
  it('getAllUsers()', done => {
    controller.getAllUsers(controller_sites[0].name, (err, users_data) => {
      if (err) {
        done(err);
      } else if (typeof (users_data) === 'undefined' || users_data.length < 0) {
        done('ERROR: getAllUsers()');
      } else {
        done();
      }
    });
  });

  // GET ALL ACCESS DEVICES
  it('getAccessDevices()', done => {
    controller.getAccessDevices(controller_sites[0].name, (err, access_data) => {
      if (err) {
        done(err);
      } else if (typeof (access_data) === 'undefined' || access_data.length < 0) {
        done('ERROR: getAccessDevices()');
      } else {
        done();
      }
    });
  });

  // GET ALL SESSIONS
  it('getSessions()', done => {
    controller.getSessions(controller_sites[0].name, (err, session_data) => {
      if (err) {
        done(err);
      } else if (typeof (session_data) === 'undefined' || session_data.length < 0) {
        done('ERROR: getSessions()');
      } else {
        done();
      }
    });
  });

  // GET ALL AUTHORIZATIONS
  it('getAllAuthorizations()', done => {
    controller.getAllAuthorizations(controller_sites[0].name, (err, auth_data) => {
      if (err) {
        done(err);
      } else if (typeof (auth_data) === 'undefined' || auth_data.length < 0) {
        done('ERROR: getSessions()');
      } else {
        done();
      }
    });
  });

  // GET USERS
  it('getUsers()', done => {
    controller.getUsers(controller_sites[0].name, (err, user_data) => {
      if (err) {
        done(err);
      } else if (typeof (user_data) === 'undefined' || user_data.length < 0) {
        done('ERROR: getUsers()');
      } else {
        done();
      }
    });
  });

  // GET SELF
  it('getSelf()', done => {
    controller.getSelf(controller_sites[0].name, (err, self_data) => {
      if (err) {
        done(err);
      } else if (typeof (self_data) === 'undefined' || self_data.length < 0) {
        done('ERROR: getSelf()');
      } else {
        done();
      }
    });
  });

  // LOGOUT
  it('logout()', done => {
    controller.logout(err => {
      if (err) {
        done(err);
      } else {
        done();
      }
    });
  });
});
