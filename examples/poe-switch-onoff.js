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

const unifi = new Unifi.Controller({host, port, sslverify: false});

(async () => {
  try {
    // LOGIN
    const loginData = await unifi.login(username, password);
    console.log('login: ' + loginData);

    // Get data from a specific unifi device based on MAC address
    const deviceData = await unifi.getAccessDevices(switchmac);
    // Console.log('getAccessDevices: ' + JSON.stringify(deviceData));

    // Get device id
    const deviceId = deviceData[0]._id;
    console.log('deviceId: ' + deviceId + ' ip: ' + deviceData[0].ip);

    // Get port_overrides section
    const portOverrides = deviceData[0].port_overrides;
    console.log('portOverrides before: ' + JSON.stringify(portOverrides));

    // Switch poe_mode to poeMode
    for (const item of portOverrides) {
      if (item.port_idx === Number.parseInt(portIdx, 10)) {
        item.poe_mode = poeMode.toLowerCase(); // [auto, off]
        console.log('switching port ' + portIdx + ' [' + item.name + '] to ' + poeMode);
      }
    }

    console.log('portOverrides after: ' + JSON.stringify(portOverrides));

    // Send the modified port_overrides and start provisioning
    await unifi.setDeviceSettingsBase(deviceId, {port_overrides: portOverrides});

    // Finalize, logout and finish
    const logoutData = await unifi.logout();
    console.log('logout: ' + JSON.stringify(logoutData));
  } catch (error) {
    console.log('ERROR: ' + error);
  }
})();
