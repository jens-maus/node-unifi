/* global describe, it, step */

const unifi = require('node-unifi');

let IP = '127.0.0.1';
if (process.env.IP) {
  IP = process.env.IP;
}

describe('Running tests', () => {
  it('login/logout', done => {
    const controller = new unifi.Controller(IP, 8443);
    if (controller != null) {
      controller.login('ubnt', 'ubnt', err => {
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
