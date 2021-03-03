#!/usr/bin/env node
/* eslint-disable camelcase,eqeqeq */

// get necessary data from cmd-line
const ip = process.argv[2]; // Controller ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password
const switchmac = process.argv[6]; // MAC of switch
const portIdx = process.argv[7]; // Integer of switch port
const poeMode = process.argv[8]; // Auto, off

const unifi = require('../unifi.js');
const controller = new unifi.Controller(ip, port);

// Login
controller.login(username, password, () => {
  // Get first site
  controller.getSitesStats((_error, sites) => {
    // Get data from a specific unifi device based on MAC address
    controller.getAccessDevices(sites[0].name, (error, result) => {
      // Get device id
      const deviceId = result[0][0]._id;

      // Get port_overrides section
      const portOverrides = result[0][0].port_overrides;

      // Switch poe_mode to poeMode
      for (const item of portOverrides) {
        if (item.port_idx == portIdx) {
          item.poe_mode = poeMode;
        }
      }

      // Send the modified port_overrides and start provisioning
      controller.setDeviceSettingsBase(sites[0].name, deviceId, {port_overrides: portOverrides}, () => {
        // Finalize, logout and finish
        controller.logout();
      });
    }, switchmac);
  });
});
