![Logo](unifi.png)
# node-unifi

[![Build Status](https://travis-ci.org/jens-maus/node-unifi.svg?branch=master)](https://travis-ci.org/jens-maus/node-unifi)
[![Code Climate](https://codeclimate.com/github/jens-maus/node-unifi/badges/gpa.svg)](https://codeclimate.com/github/jens-maus/node-unifi)
[![bitHound Score](https://www.bithound.io/github/jens-maus/node-unifi/badges/score.svg)](https://www.bithound.io/github/jens-maus/node-unifi)
[![NPM version](http://img.shields.io/npm/v/node-unifi.svg)](https://www.npmjs.com/package/node-unifi)
[![Downloads](https://img.shields.io/npm/dm/node-unifi.svg)](https://www.npmjs.com/package/node-unifi)
[![Github Issues](http://githubbadges.herokuapp.com/jens-maus/node-unifi/issues.svg)](https://github.com/jens-maus/node-unifi/issues)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RAQSDY9YNZVCL)

[![NPM](https://nodei.co/npm/node-unifi.png?downloads=true)](https://nodei.co/npm/node-unifi/)

Node-UniFi is a NodeJS module that allows to query/control [UniFi devices](http://www.ubnt.com/) via the official UniFi-Controller API. It is developed to be compatible to the latest UniFi-Controller API version starting with v4.x.x/v5.x.x.

## Features
* Supports all UniFi-Controller API features introduced with v4.x.x and v5.x.x.
* Returns all data in JSON parsable strings/objects.

## Requirements
* Installed [UniFi-Controller](https://www.ubnt.com/download/unifi) version v4 or v5
* Working UniFi-device environment

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
var unifi = require('node-unifi');

var controller = new unifi.Controller("127.0.0.1", 8443);

// LOGIN
controller.login("admin", "PASSWORD", function(err) {

  if(err) {
    console.log('ERROR: ' + err);
    return;
  }

  // GET SITE STATS
  controller.getSitesStats(function(err, sites) {
    console.log('getSitesStats: ' + sites[0].name + ' : ' + sites.length);
    console.log(JSON.stringify(sites));

    // GET SITE SYSINFO
    controller.getSiteSysinfo(sites[0].name, function(err, sysinfo) {
      console.log('getSiteSysinfo: ' + sysinfo.length);
      console.log(JSON.stringify(sysinfo));

      // GET CLIENT DEVICES
      controller.getClientDevices(sites[0].name, function(err, client_data) {
        console.log('getClientDevices: ' + client_data[0].length);
        console.log(JSON.stringify(client_data));

        // GET ALL USERS EVER CONNECTED
        controller.getAllUsers(sites[0].name, function(err, users_data) {
          console.log('getAllUsers: ' + users_data[0].length);
          console.log(JSON.stringify(users_data));

          // FINALIZE, LOGOUT AND FINISH
          controller.logout();
        });
      });
    });
  });
});
```

Please note that with every `controller.XXXXX()` function a callback function have to be specified which will be called with a potential error message and the result data (second argument) as soon as the request succeeded.

## References
This nodejs package/class uses functionality/Know-How gathered from different third-party projects:

* [UniFi-API-browser](https://github.com/malle-pietje/UniFi-API-browser)
* [unifi_sh_api](https://dl.ubnt.com/unifi/5.4.9/unifi_sh_api)

## Use-Cases
The following projects are known to use this nodejs class for query/control UniFi devices:

* [ioBroker.unifi](https://github.com/jens-maus/ioBroker.unifi)

## License
The MIT License (MIT)

Copyright (c) 2017 Jens Maus &lt;mail@jens-maus.de&gt;

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
