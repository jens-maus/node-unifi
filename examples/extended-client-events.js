#!/usr/bin/env node
const util = require('util');

// Get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password

const Unifi = require('../unifi.js');

const unifi = new Unifi.Controller({host, port, sslverify: false});

(async () => {
  try {
    // LOGIN
    const loginData = await unifi.login(username, password);
    console.log('login: ' + loginData);

    // LISTEN for WebSocket events
    const listenData = await unifi.listen({urlParams: {clients: 'v2'}});
    console.log('listen: ' + listenData);

    // Listen for WebSocket events
    unifi.on('client:sync.*', function (data) {
      console.log('client:sync', util.inspect(data, false, null));
    });
  } catch (error) {
    console.log('ERROR: ' + error);
  }
})();
