#!/usr/bin/env node
/* eslint-disable max-nested-callbacks */

// get necessary data from cmd-line
const ip = process.argv[2]; // Controller ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password

const Unifi = require('../unifi.js');

const unifi = new Unifi({
  host: ip,
  port,
  username,
  password
});

unifi.init()
  .then(result => {
    console.log('GOT IT1: ' + result);
    return unifi.getSitesStats();
  })
  .then(result => {
    console.log('GOT IT2: ' + JSON.stringify(result));
    return unifi.getSiteSysinfo();
  })
  .then(result => {
    console.log('GOT IT3: ' + JSON.stringify(result));
    return unifi.getAPGroups();
  })
  .then(result => {
    console.log('GOT IT4: ' + JSON.stringify(result));
    return unifi.logout();
  })
  .then(result => {
    console.log('GOT IT5: ' + JSON.stringify(result));
  })
  .catch(error => {
    console.log('ERROR: ' + error);
  });

console.log('DONE');

/*
// LOGIN
controller.login(username, password, error => {
  if (error) {
    console.log('ERROR: ' + error);
  }

  // GET SITE STATS
  controller.getSitesStats((error, sites) => {
    console.log('getSitesStats: ' + sites[0].name + ' : ' + sites.length);
    console.log(JSON.stringify(sites));

    // GET SITE SYSINFO
    controller.getSiteSysinfo(sites[0].name, (error, sysinfo) => {
      console.log('getSiteSysinfo: ' + sysinfo.length);
      console.log(JSON.stringify(sysinfo));

      // GET CLIENT DEVICES
      controller.getClientDevices(sites[0].name, (error, clientData) => {
        console.log('getClientDevices: ' + clientData[0].length);
        console.log(JSON.stringify(clientData));

        // GET ALL USERS EVER CONNECTED
        controller.getAllUsers(sites[0].name, (error, usersData) => {
          console.log('getAllUsers: ' + usersData[0].length);
          console.log(JSON.stringify(usersData));

          // FINALIZE, LOGOUT AND FINISH
          controller.logout();
        });
      });
    });
  });
});
*/
