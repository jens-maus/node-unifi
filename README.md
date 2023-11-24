<img height="100px" src="unifi.png" align="left"><br/>
# node-unifi

[![Build](https://github.com/jens-maus/node-unifi/workflows/CI/badge.svg)](https://github.com/jens-maus/node-unifi/actions)
[![NPM version](https://img.shields.io/npm/v/node-unifi.svg?logo=npm)](https://www.npmjs.com/package/node-unifi)
[![Downloads](https://img.shields.io/npm/dm/node-unifi.svg)](https://www.npmjs.com/package/node-unifi)
[![License](https://img.shields.io/github/license/jens-maus/node-unifi.svg)](https://github.com/jens-maus/node-unifi/blob/master/LICENSE)
[![Donate](https://img.shields.io/badge/Donate-PayPal-green.svg)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=RAQSDY9YNZVCL)
[![GitHub stars](https://img.shields.io/github/stars/jens-maus/node-unifi.svg?style=social&label=Star)](https://github.com/jens-maus/node-unifi/stargazers/)

Node-UniFi is a NodeJS module that allows to query/control [UniFi devices](http://www.ubnt.com/) via the official UniFi-Controller API. It is developed to be compatible to the UniFi-Controller API version starting with v4.x.x up to v8.x.x

## Features
* Support all UniFi-Controller API features introduced with v4.x.x up to v8.x.x.
* Support CloudKey Gen1, CloudKey Gen2, UnifiOS-based UDM-Pro Controller as well as self-hostd UniFi controller software.
* Returns all data in well-defined JSON parsable strings/objects.
* Use of modern [axios](https://github.com/axios/axios)-based nodejs http library.
* API functions returning NodeJS [Promises](https://nodejs.dev/learn/understanding-javascript-promises) for modern nodejs uses via `async`/`await` or `then()`/`catch()`.
* Support for WebSocket-based push notifications of UniFi controllers for listening for state/object changes using [EventEmitter](https://github.com/EventEmitter2/EventEmitter2)-based nodejs functionality.
* Usable with local and UniFI cloud accounts and with 2FA authentication.

## Requirements
* Installed [UniFi-Controller/Network](https://www.ubnt.com/download/unifi) version v4 up to v8 (UDM-Pro, UDM-SE, UDM, UDR, UDW, CloudKey Gen1/Gen2).
* Direct network connectivity between the application using node-unifi and the host:port (normally TCP port 443 or 8443) where the UniFi controller is running on.
* Node.js version >= 16.x

## Installation
node-unifi can be installed using the following npm command:

```sh
npm install node-unifi
```

## Examples
node-unifi has been designed to be used quite straight forward and without introducing
ackward language constructs. The following example should give a brief introduction on
how to use node-unifi in your own applications using its Promises-based API interface:

```js
const Unifi = require('node-unifi');
const unifi = new Unifi.Controller({'<HOSTNAME>', '<PORT>', sslverify: false});

(async () => {
  try {
    // LOGIN
    const loginData = await unifi.login('<USERNAME>', '<PASSWORD>');
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
```

Please note that every `unifi.XXXXX()` function returns a `Promise`, thus `async`/`await` as well as `.then()`/`.catch()` can be used accordingly.

### Event-Emitter WebSockets Interface

Since version 2.0.0 node-unifi supports (thanks to [unifi-axios-events](https://github.com/worldwidewoogie/unifi-axios-events)) the WebSocket interface
of a UniFi controller. This new interface allows to listen for events using `unifi.listen()` and automatically receive events
as soon as the UniFi controller sends them out via its WebSocket functionality. For receiving these events in a nodejs-compatible
way node-unifi uses internally [EventEmitter2](https://github.com/EventEmitter2/EventEmitter2) which allows to execute actions based
on event filters defined by `unifi.on(...)`.

An example on how to use this EventEmitter-based functionality of node-unifi to immediately receive state changes rather than
regularly having to poll a unifi controller for changes can be seen here:

```js
const Unifi = require('node-unifi');
const unifi = new Unifi.Controller({'<HOSTNAME>', '<PORT>', sslverify: false});

(async () => {
  try {
    // LOGIN
    const loginData = await unifi.login('<USERNAME>', '<PASSWORD>');
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
  } catch (error) {
    console.log('ERROR: ' + error);
  }
})();
```

More examples can be found in the "examples" sub-directory of this GitHub repository.

## Moving from v1 of node-unifi to v2+
If you are having an application still using the obsolete v1 version of node-unifi and you want to port it to using the new/revised
v2 version, all you have to do is:

* make sure your application can deal with NodeJS [Promises](https://nodejs.dev/learn/understanding-javascript-promises) as all node-unifi API functions return proper Promises allowing to use `async`/`await` or `.then()`/`.catch()` logic for synchronous processing of events (see Examples) rather than expecting callback functions, forcing you to nest them properly.
* eliminate the previously necessary `site` function argument required when calling a node-unifi function. Now you can either use the `{ site: 'my site' }` argument when passing contructor options to node-unifi or you switch to a different site using `unifi.opts.site='my site'` before calling a node-unifi API function.
* as the API functions had been changed to work on a single site only, make sure your app is changed so that it expects a single site JSON return dataset only.
* The new version by default verifies SSL connections and certificates. To restore the behaviour of the old version set `sslverify: false` in the constructor options

## References
This nodejs package/class uses functionality/Know-How gathered from different third-party projects:

* [Art-of-WiFi/UniFi-API-client](https://github.com/Art-of-WiFi/UniFi-API-client)
* [worldwidewoogie/unifi-axios-events](https://github.com/worldwidewoogie/unifi-axios-events)
* [unifi_sh_api](https://dl.ui.com/unifi/5.12.35/unifi_sh_api)

## Use-Cases
The following projects are known to use this nodejs class for query/control UniFi devices:

* [ioBroker.unifi](https://github.com/iobroker-community-adapters/ioBroker.unifi)

## License
The MIT License (MIT)

Copyright (c) 2017-2023 Jens Maus &lt;mail@jens-maus.de&gt;

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
