#!/usr/bin/env node

// Get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password

const Unifi = require('../unifi.js');
const unifi = new Unifi.Controller({host, port, sslverify: false});

// LOGIN
unifi.login(username, password)
  .then(result => {
    console.log('login: ' + result);

    // LISTEN for WebSocket events
    return unifi.listen();
  })
  .then(result => {
    console.log('listen: ' + result);
    // Listen for alert.client_connected
    unifi.on('alert.client_connected', function (data) {
      const ts = new Date(data[0].timestamp).toISOString();
      console.log(`${ts} - ${this.event}: ${data[0].parameters.CLIENT.id} (${data[0].parameters.CLIENT.name})`);
    });

    // Listen for alert.client_disconnected
    unifi.on('alert.client_disconnected', function (data) {
      const ts = new Date(data[0].timestamp).toISOString();
      console.log(`${ts} - ${this.event}: ${data[0].parameters.CLIENT.id} (${data[0].parameters.CLIENT.name})`);
    });

    // Listen for ctrl.* events
    unifi.on('ctrl.*', function () {
      console.log(`${this.event}`);
    });
  })
  .catch(error => {
    console.log('ERROR: ' + error);
  });
