#!/usr/bin/env node
/* eslint-disable camelcase */

// get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password
const switchmac = process.argv[6]; // MAC of switch
const portIdx = process.argv[7]; // Integer of switch port
const poeMode = process.argv[8]; // Auto, off

const Unifi = require('../unifi.js');
const unifi = new Unifi.Controller({host, port, insecure: true});

// Login
unifi.login(username, password)
  .then(() => {
    // Get data from a specific unifi device based on MAC address
    return unifi.getAccessDevices(switchmac);
  })
  .then(result => {
    // Get device id
    const deviceId = result[0]._id;

    // Get port_overrides section
    const portOverrides = result[0].port_overrides;

    // Switch poe_mode to poeMode
    for (const item of portOverrides) {
      if (item.port_idx === Number.parseInt(portIdx, 10)) {
        item.poe_mode = poeMode.toLowerCase(); // [auto, off]
        console.log('switching port ' + portIdx + ' [' + item.name + '] to ' + poeMode);
      }
    }

    // Send the modified port_overrides and start provisioning
    return unifi.setDeviceSettingsBase(deviceId, {port_overrides: portOverrides});
  })
  .then(() => {
    // Finalize, logout and finish
    return unifi.logout();
  })
  .then(result => {
    console.log(JSON.stringify(result));
  })
  .catch(error => {
    console.log('ERROR: ' + error);
  });
