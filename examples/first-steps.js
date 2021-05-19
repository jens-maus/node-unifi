#!/usr/bin/env node

// Get necessary data from cmd-line
const host = process.argv[2]; // Controller host/ip
const port = process.argv[3]; // Controller port
const username = process.argv[4]; // Controller username
const password = process.argv[5]; // Controller password

const Unifi = require('../unifi.js');
const unifi = new Unifi.Controller({host, port, insecure: true});

// LOGIN
unifi.login(username, password)
  .then(result => {
    console.log('login: ' + result);
    return unifi.getSitesStats();
  })
  // GET SITE STATS
  .then(sites => {
    console.log('getSitesStats: ' + sites[0].name + ':' + sites.length);
    console.log(JSON.stringify(sites));
    return unifi.getSiteSysinfo();
  })
  // GET SITE SYSINFO
  .then(sysinfo => {
    console.log('getSiteSysinfo: ' + sysinfo.length);
    console.log(JSON.stringify(sysinfo));
    return unifi.getClientDevices();
  })
  // GET CLIENT DEVICES
  .then(clientData => {
    console.log('getClientDevices: ' + clientData.length);
    console.log(JSON.stringify(clientData));
    return unifi.getAllUsers();
  })
  // GET ALL USERS EVER CONNECTED
  .then(usersData => {
    console.log('getAllUsers: ' + usersData.length);
    console.log(JSON.stringify(usersData));
    return unifi.logout();
  })
  // LOGOUT
  .then(result => {
    console.log('logout: ' + JSON.stringify(result));
  })
  .catch(error => {
    console.log('ERROR: ' + error);
  });
