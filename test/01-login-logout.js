/* global describe, it */
/* eslint-disable camelcase, max-nested-callbacks */

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
  it('login/logout', done => {
    const controller = new unifi.Controller(CONTROLLER_IP, CONTROLLER_PORT);
    if (controller !== null) {
      controller.login(CONTROLLER_USER, CONTROLLER_PASS, err => {
        if (err) {
          done(err);
        } else {
          // GET SITE STATS
          controller.getSitesStats((err, sites) => {
            if (typeof (sites) === 'undefined' || sites.length <= 0) {
              done('ERROR: getSitesStats()');
            }
            if (err) {
              done(err);
            } else {
              // GET CLIENT DEVICES
              controller.getClientDevices(sites[0].name, (err, client_data) => {
                if (typeof (client_data) === 'undefined' || client_data.length < 0) {
                  done('ERROR: getClientDevices()');
                }
                if (err) {
                  done(err);
                } else {
                  controller.logout(err => {
                    if (err) {
                      done(err);
                    } else {
                      done();
                    }
                  });
                }
              });
            }
          });
        }
      });
    }
  });
});
