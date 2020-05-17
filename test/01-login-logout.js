/* global describe, it */
/* eslint-disable camelcase */

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
});
