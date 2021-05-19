![Logo](unifi.png)
# node-unifi

[![Build](https://github.com/jens-maus/node-unifi/workflows/CI/badge.svg)](https://github.com/jens-maus/node-unifi/actions)
[![NPM version](http://img.shields.io/npm/v/node-unifi.svg)](https://www.npmjs.com/package/node-unifi)
[![Downloads](https://img.shields.io/npm/dm/node-unifi.svg)](https://www.npmjs.com/package/node-unifi)
[![License](https://img.shields.io/github/license/jens-maus/node-unifi.svg)](https://github.com/jens-maus/node-unifi/blob/master/LICENSE)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RAQSDY9YNZVCL)
[![GitHub stars](https://img.shields.io/github/stars/jens-maus/node-unifi.svg?style=social&label=Star)](https://github.com/jens-maus/node-unifi/stargazers/)

[![NPM](https://nodei.co/npm/node-unifi.png?downloads=true)](https://nodei.co/npm/node-unifi/)

Node-UniFi is a NodeJS module that allows to query/control [UniFi devices](http://www.ubnt.com/) via the official UniFi-Controller API. It is developed to be compatible to the UniFi-Controller API version starting with v4.x.x up to v6.x.x

## Features
* Supports all UniFi-Controller API features introduced with v4.x.x, v5.x.x or v6.x.x
* Supports CloudKey Gen1, CloudKey Gen2, UnifiOS-based UDM-Pro Controller as well as self-hostd UniFi Controller Software.
* Returns all data in JSON parsable strings/objects.

## Requirements
* Installed [UniFi-Controller](https://www.ubnt.com/download/unifi) version v4, v5 or v6, CloudKey Gen1, Gen2 or UDM-Pro.
* direct network connectivity between this server and the host and port (normally TCP port 8443 or 443) where the UniFi Controller is running
* you must use **local accounts**, not UniFi Cloud accounts nor 2FA, to access the UniFi Controller API through this class

## Installation
node-unifi can be installed using the following npm command:

```sh
npm install node-unifi
```

## Example
node-unifi has been designed to be used quite straight forward and without introducing
ackward language constructs. The following example should give a brief introduction on
how to use node-unifi in your own applications:

```js
const unifi = require('node-unifi');
const controller = new unifi.Controller('127.0.0.1', 8443);

// LOGIN
controller.login('admin', 'PASSWORD')
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
```

Please note that every `controller.XXXXX()` function returns a `Promise`, thus `.then()` and `.catch()` can be used accordingly.

## References
This nodejs package/class uses functionality/Know-How gathered from different third-party projects:

* [UniFi-API-client](https://github.com/Art-of-WiFi/UniFi-API-client)
* [unifi_sh_api](https://dl.ui.com/unifi/5.12.35/unifi_sh_api)

## Use-Cases
The following projects are known to use this nodejs class for query/control UniFi devices:

* [ioBroker.unifi](https://github.com/iobroker-community-adapters/ioBroker.unifi)

## License
The MIT License (MIT)

Copyright (c) 2017-2021 Jens Maus &lt;mail@jens-maus.de&gt;

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
