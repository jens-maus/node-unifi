#!/usr/bin/env node

import {inspect} from 'node:util';
import process from 'node:process';
import Unifi from '../unifi.js';

// Get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password

const unifi = new Unifi.Controller({host, port, sslverify: false});

try {
  // LOGIN
  const loginData = await unifi.login(username, password);
  console.log('login: ' + loginData);

  // LISTEN for WebSocket events
  const listenData = await unifi.listen();
  console.log('listen: ' + listenData);

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

  // Listen for client:sync.* events
  unifi.on('client:sync.*', function (data) {
    console.log(`${this.event}`, inspect(data, false, null));
  });
} catch (error) {
  console.log('ERROR: ' + error);
}
