#!/usr/bin/env node

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

    // GET SITE STATS
    const sites = await unifi.getSitesStats();
    console.log('getSitesStats: ' + sites[0].name + ':' + sites.length);
    console.log(JSON.stringify(sites));

    // GET SITE SYSINFO
    const sysinfo = await unifi.getSiteSysinfo();
    console.log('getSiteSysinfo: ' + sysinfo.length);
    console.log(JSON.stringify(sysinfo));

    // GET CLIENT DEVICES
    const clientData = await unifi.getClientDevices();
    console.log('getClientDevices: ' + clientData.length);
    console.log(JSON.stringify(clientData));

    // GET ALL USERS EVER CONNECTED
    const usersData = await unifi.getAllUsers();
    console.log('getAllUsers: ' + usersData.length);
    console.log(JSON.stringify(usersData));

    // LOGOUT
    const logoutData = await unifi.logout();
    console.log('logout: ' + JSON.stringify(logoutData));
  } catch (error) {
    console.log('ERROR: ' + error);
  }
})();
