/* eslint-disable max-params, camelcase */

/**
 *
 * UniFi controller class (NodeJS)
 *
 * This nodejs class provides functionality to query a UniFi controller (www.ubnt.com) through
 * its Web-API. The functionality implemented here had been gathered through different
 * souces, namely:
 *
 *   UniFi-API-client: https://github.com/Art-of-WiFi/UniFi-API-client/blob/master/src/Client.php
 *   UniFi-API sh: https://dl.ui.com/unifi/5.12.35/unifi_sh_api
 *   domwo: http://community.ubnt.com/t5/UniFi-Wireless/little-php-class-for-unifi-api/m-p/603051
 *   fbagnol: https://github.com/fbagnol/class.unifi.php
 *
 * The majority of the functions in here are actually based on the PHP UniFi-API-client class
 * which defines compatibility to UniFi-Controller versions v4 and v5+
 *
 * Based/Compatible to UniFi-API-client class: v1.1.56
 *
 * Copyright (c) 2017-2020 Jens Maus <mail@jens-maus.de>
 *
 * The source code is distributed under the MIT license
 *
 */
let request = require('request');
const async = require('async');

// Make sure we setup request correctly for our
// processing
request = request.defaults({jar: true,
  json: true,
  strictSSL: false
});

const Controller = function (hostname, port) {
  const _self = this;

  /** INIT CODE * */

  _self._baseurl = 'https://127.0.0.1:8443';
  _self._unifios = false;
  _self._csrfToken = null;
  _self._cookies = null;

  // Format a new baseurl based on the arguments
  if (typeof (hostname) !== 'undefined' && typeof (port) !== 'undefined') {
    _self._baseurl = 'https://' + hostname + ':' + port;
  }

  /** PUBLIC FUNCTIONS * */

  /**
   * Login to the UniFi controller - login()
   * -----------------------------
   * returns true upon success
   */
  _self.login = function (username, password, cb) {
    // Find out if this is a UnifiOS driven controller or not.
    async.series([
      function (callback) {
        // We have to use a custom cookie jar for this request - otherwise the login will fail on Unifi
        _self._cookies = request.jar();
        request({method: 'GET', followRedirect: false, uri: _self._baseurl + '/', jar: _self._cookies}, (err, res, body) => {
          if (!err) {
            // If the statusCode is 200 and a x-csrf-token is supplied this is a
            // UniFiOS device (e.g. UDM-Pro)
            if (res.statusCode === 200 && typeof (res.headers['x-csrf-token']) !== 'undefined') {
              _self._unifios = true;
              _self._csrfToken = res.headers['x-csrf-token'];
            } else {
              _self._unifios = false;
              _self._csrfToken = null;
            }
          }

          return callback(err, body);
        });
      },
      function () {
        // If this is a unifios system we use /api/auth instead
        _self._request(_self._unifios ? '/api/auth/login' : '/api/login', {
          username,
          password
        }, null, cb);
      }
    ]);
  };

  /**
   * Logout from the UniFi controller - logout()
   * --------------------------------
   * returns true upon success
   */
  _self.logout = function (cb) {
    _self._request(_self._unifios ? '/api/auth/logout' : '/logout', {}, null, (err, result) => {
      if (!err) {
        _self._cookies = null;
        _self._csrfToken = null;
        _self._unifios = false;
      }
      if (typeof (cb) === 'function') {
        cb(err, result);
      }
    });
  };

  /**
   * Authorize a client device - authorize_guest()
   * -------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   * required parameter <minutes> = minutes (from now) until authorization expires
   * required paramater <cb>      = the callback function that is called with the results
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <MBytes>  = data transfer limit in MB
   * optional parameter <ap_mac>  = AP MAC address to which client is connected, should result in faster authorization
   */
  _self.authorizeGuest = function (sites, mac, minutes, cb, up, down, mbytes, ap_mac) {
    const json = {cmd: 'authorize-guest', mac: mac.toLowerCase()};
    if (typeof (minutes) !== 'undefined') {
      json.minutes = minutes;
    }
    /**
     * If we have received values for up/down/MBytes/ap_mac we append them to the payload array to be submitted
     */
    if (typeof (up) !== 'undefined') {
      json.up = up;
    }
    if (typeof (down) !== 'undefined') {
      json.down = down;
    }
    if (typeof (mbytes) !== 'undefined') {
      json.bytes = mbytes;
    }
    if (typeof (ap_mac) !== 'undefined') {
      json.ap_mac = ap_mac.toLowerCase();
    }

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Unauthorize a client device - unauthorize_guest()
   * ---------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.unauthorizeGuest = function (sites, mac, cb) {
    const json = {cmd: 'unauthorize-guest', mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Reconnect a client device - reconnect_sta()
   * -------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.reconnectClient = function (sites, mac, cb) {
    const json = {cmd: 'kick-sta', mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Block a client device - block_sta()
   * ---------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.blockClient = function (sites, mac, cb) {
    const json = {cmd: 'block-sta', mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Unblock a client device - unblock_sta()
   * -----------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.unblockClient = function (sites, mac, cb) {
    const json = {cmd: 'unblock-sta', mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Forget one or more client devices - forget_sta()
   * ---------------------------------
   * return true on success
   * required parameter <macs> = array of client MAC addresses
   *
   * NOTE:
   * only supported with controller versions 5.9.X and higher, can be
   * slow (up to 5 minutes) on larger controllers
   */
  _self.forgetClient = function (sites, macs, cb) {
    const json = {cmd: 'forget-sta', macs};

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Create a new user/client-device - create_user()
   * -------------------------------
   * return an array with a single object containing details of the new user/client-device on success, else return false
   * required parameter <mac>           = client MAC address
   * required parameter <user_group_id> = _id value for the user group the new user/client-device should belong to which
   *                                      can be obtained from the output of list_usergroups()
   * optional parameter <name>          = name to be given to the new user/client-device
   * optional parameter <note>          = note to be applied to the new user/client-device
   * optional parameter <is_guest>      = boolean; defines whether the new user/client-device is a   guest or not
   * optional parameter <is_wired>      = boolean; defines whether the new user/client-device is wi  red or not
   */
  _self.createUser = function (sites, mac, user_group_id, cb, name, note, is_guest, is_wired) {
    const new_user = {mac: mac.toLowerCase(),
      user_group_id
    };

    if (typeof (name) !== 'undefined') {
      new_user.name = name;
    }

    if (typeof (note) !== 'undefined') {
      new_user.note = note;
      new_user.noted = true;
    }

    if (typeof (is_guest) !== 'undefined') {
      new_user.is_guest = is_guest;
    }

    if (typeof (is_wired) !== 'undefined') {
      new_user.is_wired = is_wired;
    }

    _self._request('/api/s/<SITE>/group/user', {objects: [{data: new_user}]}, sites, cb);
  };

  /**
   * Add/modify/remove a client device note - set_sta_note()
   * --------------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the client-device to be modified
   * optional parameter <note>    = note to be applied to the client-device
   *
   * NOTES:
   * - when note is empty or not set, the existing note for the client-device will be removed and "noted" attribute set to false
   */
  _self.setClientNote = function (sites, user_id, cb, note) {
    let noted = 1;
    if (typeof (note) === 'undefined') {
      note = '';
      noted = 0;
    }

    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {note, noted}, sites, cb);
  };

  /**
   * Add/modify/remove a client device name - set_sta_name()
   * --------------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the client device to be modified
   * optional parameter <name>    = name to be applied to the client device
   *
   * NOTES:
   * - when name is empty or not set, the existing name for the client device will be removed
   */
  _self.setClientName = function (sites, user_id, cb, name) {
    if (typeof (name) === 'undefined') {
      name = '';
    }

    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {name}, sites, cb);
  };

  /**
   * 5 minutes site stats method - stat_5minutes_site()
   * ---------------------------
   * returns an array of 5-minute stats objects for the current site
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   */
  _self.get5minSiteStats = function (sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/5minutes.site', json, sites, cb);
  };

  /**
   * Hourly site stats method - stat_hourly_site()
   * ------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  _self.getHourlySiteStats = function (sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/hourly.site', json, sites, cb);
  };

  /**
   * Daily site stats method - stat_daily_site()
   * -----------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 52*7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  _self.getDailySiteStats = function (sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/daily.site', json, sites, cb);
  };

  /**
   * 5 minutes stats method for a single access point or all access points - stat_5minutes_aps()
   * ---------------------------------------------------------------------
   * returns an array of 5-minute stats objects
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   */
  _self.get5minApStats = function (sites, cb, start, end, mac) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'num_sta',
      'time'],
      start,
      end};

    if (typeof (mac) !== 'undefined') {
      json.mac = mac.toLowerCase();
    }

    _self._request('/api/s/<SITE>/stat/report/5minutes.ap', json, sites, cb);
  };

  /**
   * Hourly stats method for a single access point or all access points - stat_hourly_aps()
   * ------------------------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  _self.getHourlyApStats = function (sites, cb, start, end, mac) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'num_sta',
      'time'],
      start,
      end};

    if (typeof (mac) !== 'undefined') {
      json.mac = mac.toLowerCase();
    }

    _self._request('/api/s/<SITE>/stat/report/hourly.ap', json, sites, cb);
  };

  /**
   * Daily stats method for a single access point or all access points - stat_daily_aps()
   * -----------------------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  _self.getDailyApStats = function (sites, cb, start, end, mac) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'num_sta',
      'time'],
      start,
      end};

    if (typeof (mac) !== 'undefined') {
      json.mac = mac.toLowerCase();
    }

    _self._request('/api/s/<SITE>/stat/report/daily.ap', json, sites, cb);
  };

  /**
   * 5 minutes stats method for a single user/client device - stat_5minutes_user()
   * ------------------------------------------------------
   * returns an array of 5-minute stats objects
   * required parameter <mac>     = MAC address of user/client device to return stats for
   * optional parameter <start>   = Unix timestamp in milliseconds
   * optional parameter <end>     = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid values are:
   *                                rx_bytes, tx_bytes, signal, rx_rate, tx_rate, rx_retries, tx_retries, rx_packets, tx_packets
   *                                default is ['rx_bytes', 'tx_bytes']
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - only supported with UniFi controller versions 5.8.X and higher
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   * - make sure that "Clients Historical Data" has been enabled in the UniFi controller settings in the Maintenance section
   */
  _self.get5minUserStats = function (sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'rx_bytes',
        'tx_bytes'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/stat/report/5minutes.user', json, sites, cb);
  };

  /**
   * Hourly stats method for a a single user/client device - stat_hourly_user()
   * -----------------------------------------------------
   * returns an array of hourly stats objects
   * required parameter <mac>     = MAC address of user/client device to return stats for
   * optional parameter <start>   = Unix timestamp in milliseconds
   * optional parameter <end>     = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid values are:
   *                                rx_bytes, tx_bytes, signal, rx_rate, tx_rate, rx_retries, tx_retries, rx_packets, tx_packets
   *                                default is ['rx_bytes', 'tx_bytes']
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - only supported with UniFi controller versions 5.8.X and higher
   * - make sure that "Clients Historical Data" has been enabled in the UniFi controller settings in the Maintenance section
   */
  _self.getHourlyUserStats = function (sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'rx_bytes',
        'tx_bytes'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/stat/report/hourly.user', json, sites, cb);
  };

  /**
   * Daily stats method for a single user/client device - stat_daily_user()
   * --------------------------------------------------
   * returns an array of daily stats objects
   * required parameter <mac>     = MAC address of user/client device to return stats for
   * optional parameter <start>   = Unix timestamp in milliseconds
   * optional parameter <end>     = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid values are:
   *                                rx_bytes, tx_bytes, signal, rx_rate, tx_rate, rx_retries, tx_retries, rx_packets, tx_packets
   *                                default is ['rx_bytes', 'tx_bytes']
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - only supported with UniFi controller versions 5.8.X and higher
   * - make sure that "Clients Historical Data" has been enabled in the UniFi controller settings in the Maintenance section
   */
  _self.getDailyUserStats = function (sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'rx_bytes',
        'tx_bytes'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/stat/report/daily.user', json, sites, cb);
  };

  /**
   * 5 minutes gateway stats method - stat_5minutes_gateway()
   * -------------------------------
   * returns an array of 5-minute stats objects for the gateway belonging to the current site
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid val  ues are:
   *                                mem, cpu, loadavg_5, lan-rx_errors, lan-tx_errors, lan-rx_bytes  ,
   *                                lan-tx_bytes, lan-rx_packets, lan-tx_packets, lan-rx_dropped, l  an-tx_dropped
   *                                default is ['time', 'mem', 'cpu', 'loadavg_5']
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   * - requires a USG
   */
  _self.get5minGatewayStats = function (sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'mem',
        'cpu',
        'loadavg_5'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/5minutes.gw', json, sites, cb);
  };

  /**
   * Hourly gateway stats method - stat_hourly_gateway()
   * ----------------------------
   * returns an array of hourly stats objects for the gateway belonging to the current site
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid val  ues are:
   *                                mem, cpu, loadavg_5, lan-rx_errors, lan-tx_errors, lan-rx_bytes  ,
   *                                lan-tx_bytes, lan-rx_packets, lan-tx_packets, lan-rx_dropped, l  an-tx_dropped
   *                                default is ['time', 'mem', 'cpu', 'loadavg_5']
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - requires a USG
   */
  _self.getHourlyGatewayStats = function (sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'mem',
        'cpu',
        'loadavg_5'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/hourly.gw', json, sites, cb);
  };

  /**
   * Daily gateway stats method - stat_daily_gateway()
   * ---------------------------
   * returns an array of daily stats objects for the gateway belonging to the current site
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid val  ues are:
   *                                mem, cpu, loadavg_5, lan-rx_errors, lan-tx_errors, lan-rx_bytes  ,
   *                                lan-tx_bytes, lan-rx_packets, lan-tx_packets, lan-rx_dropped, l  an-tx_dropped
   *                                default is ['time', 'mem', 'cpu', 'loadavg_5']
   *
   * NOTES:
   * - defaults to the past 52*7*24 hours
   * - requires a USG
   */
  _self.getDailyGatewayStats = function (sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    if (typeof (attribs) === 'undefined') {
      attribs = ['time',
        'mem',
        'cpu',
        'loadavg_5'];
    } else {
      attribs = ['time'].concat(attribs);
    }

    const json = {attrs: attribs,
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/daily.gw', json, sites, cb);
  };

  /**
   * Method to fetch speed test results - stat_speedtest_results()
   * ----------------------------------
   * returns an array of speed test result objects
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 24 hours
   * - requires a USG
   */
  _self.getSpeedTestResults = function (sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (24 * 3600 * 1000);
    }

    const json = {attrs: ['xput_download',
      'xput_upload',
      'latency',
      'time'],
      start,
      end};

    _self._request('/api/s/<SITE>/stat/report/archive.speedtest', json, sites, cb);
  };

  /**
   * Method to fetch IPS/IDS event - stat_ips_events
   * -----------------------------
   * returns an array of IPS/IDS event objects
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <limit> = Maximum number of events to return, defaults to 10000
   *
   * NOTES:
   * - defaults to the past 24 hours
   * - requires a USG
   * - supported in UniFi controller versions 5.9.X and higher
   */
  _self.getIPSEvents = function (sites, cb, start, end, limit) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (24 * 3600 * 1000);
    }

    if (typeof (limit) === 'undefined') {
      limit = 10000;
    }

    const json = {start,
      end,
      _limit: limit};

    _self._request('/api/s/<SITE>/stat/ips/event', json, sites, cb);
  };

  /**
   * Show all login sessions - stat_sessions()
   * -----------------------
   * returns an array of login session objects for all devices or a single device
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = client MAC address to return sessions for (can only be used when start and end are also provided)
   * optional parameter <type>  = client type to return sessions for, can be 'all', 'guest' or 'user'; default value is 'all'
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  _self.getSessions = function (sites, cb, start, end, mac, type) {
    if (typeof (end) === 'undefined') {
      end = Math.floor(Date.now() / 1000);
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600);
    }

    if (typeof (type) === 'undefined') {
      type = 'all';
    }

    const json = {type,
      start,
      end};

    if (typeof (mac) !== 'undefined') {
      json.mac = mac.toLowerCase();
    }

    _self._request('/api/s/<SITE>/stat/session', json, sites, cb);
  };

  /**
   * Show latest 'n' login sessions for a single client device - stat_sta_sessions_latest()
   * ---------------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * required parameter <mac>   = client MAC address
   * optional parameter <limit> = maximum number of sessions to get (defaults to 5)
   *
   */
  _self.getLatestSessions = function (sites, mac, cb, limit) {
    if (typeof (limit) === 'undefined') {
      limit = 5;
    }

    const json = {mac: mac.toLowerCase(),
      _limit: limit,
      _sort: '-assoc_time'};

    _self._request('/api/s/<SITE>/stat/session', json, sites, cb);
  };

  /**
   * Show all authorizations - stat_auths()
   * -----------------------
   *
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  _self.getAllAuthorizations = function (sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Math.floor(Date.now() / 1000);
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600);
    }

    _self._request('/api/s/<SITE>/stat/authorization', {start, end}, sites, cb);
  };

  /**
   * List all client devices ever connected to the site - stat_allusers()
   * --------------------------------------------------
   *
   * optional parameter <historyhours> = hours to go back (default is 8760 hours or 1 year)
   *
   * NOTES:
   * - <historyhours> is only used to select clients that were online within that period,
   *    the returned stats per client are all-time totals, irrespective of the value of <historyhours>
   */
  _self.getAllUsers = function (sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    const json = {type: 'all',
      conn: 'all',
      within};

    _self._request('/api/s/<SITE>/stat/alluser', json, sites, cb);
  };

  /**
   * List all blocked client devices ever connected to the site
   * ----------------------------------------------------------
   *
   * optional parameter <historyhours> = hours to go back (default is 8760 hours or 1 year)
   *
   * NOTES:
   * - <historyhours> is only used to select clients that were online within that period,
   *    the returned stats per client are all-time totals, irrespective of the value of <historyhours>
   */
  _self.getBlockedUsers = function (sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    const json = {type: 'blocked',
      conn: 'all',
      within};

    _self._request('/api/s/<SITE>/stat/alluser', json, sites, cb);
  };

  /**
   * List guest devices - list_guests()
   * ------------------
   *
   * optional parameter <within> = time frame in hours to go back to list guests with valid access (default = 24*365 hours)
   *
   */
  _self.getGuests = function (sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    _self._request('/api/s/<SITE>/stat/guest', {within}, sites, cb);
  };

  /**
   * List online client device(s) - list_clients()
   * ----------------------------
   * returns an array of online client device objects, or in case of a single device request, returns a single client device object
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  _self.getClientDevices = function (sites, cb, client_mac) {
    if (typeof (client_mac) === 'undefined') {
      client_mac = '';
    }

    _self._request('/api/s/<SITE>/stat/sta/' + client_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * Get details for a single client device - stat_client()
   * --------------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  _self.getClientDevice = function (sites, cb, client_mac) {
    if (typeof (client_mac) === 'undefined') {
      client_mac = '';
    }

    _self._request('/api/s/<SITE>/stat/user/' + client_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * Assign client device to another group - set_usergroup()
   * -------------------------------------
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <user_id>  = id of the user device to be modified
   * required parameter <group_id> = id of the user group to assign user to
   *
   */
  _self.setUserGroup = function (sites, user_id, group_id, cb) {
    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {usergroup_id: group_id}, sites, cb);
  };

  /**
   * Update client fixedip (using REST) - edit_client_fixedip()
   * ----------------------------------
   * returns an array containing a single object with attributes of the updated client on success
   * required parameter <client_id>   = _id of the client
   * required parameter <use_fixedip> = boolean defining whether if use_fixedip is true or false
   * optional parameter <network_id>  = _id value for the network where the ip belongs to
   * optional parameter <fixed_ip>    = value of client's fixed_ip field
   *
   */
  _self.editClientFixedIP = function (sites, client_id, use_fixedip, cb, network_id, fixed_ip) {
    const json = {_id: client_id,
      use_fixedip};

    if (use_fixedip === true) {
      if (typeof (network_id) !== 'undefined') {
        json.network_id = network_id;
      }

      if (typeof (fixed_ip) !== 'undefined') {
        json.fixed_ip = fixed_ip;
      }
    }

    _self._request('/api/s/<SITE>/rest/user/' + client_id.trim(), json, sites, cb);
  };

  /**
   * List user groups - list_usergroups()
   * ----------------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getUserGroups = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/usergroup', null, sites, cb);
  };

  /**
   * Create user group (using REST) - create_usergroup()
   * ------------------------------
   * returns an array containing a single object with attributes of the new usergroup ("_id", "name", "qos_rate_max_down", "qos_rate_max_up", "site_id") on success
   *
   * required paramater <sites>      = name or array of site names
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  _self.createUserGroup = function (sites, group_name, cb,
                                   group_dn, group_up) {
    const json = {name: group_name,
      qos_rate_max_down: typeof (group_dn) === 'undefined' ? -1 : group_dn,
      qos_rate_max_up: typeof (group_up) === 'undefined' ? -1 : group_up};

    _self._request('/api/s/<SITE>/rest/usergroup', json, sites, cb);
  };

  /**
   * Modify user group (using REST) - edit_usergroup()
   * ------------------------------
   * returns an array containing a single object with attributes of the updated usergroup on success
   *
   * required paramater <sites>      = name or array of site names
   * required parameter <group_id>   = _id of the user group
   * required parameter <site_id>    = _id of the site
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  _self.editUserGroup = function (sites, group_id, site_id, group_name, cb,
                                 group_dn, group_up) {
    const json = {_id: group_id,
      site_id,
      name: group_name,
      qos_rate_max_down: typeof (group_dn) === 'undefined' ? -1 : group_dn,
      qos_rate_max_up: typeof (group_up) === 'undefined' ? -1 : group_up};

    _self._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), json, sites, cb, 'PUT');
  };

  /**
   * Delete user group (using REST) - delete_usergroup()
   * ------------------------------
   * returns true on success
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <group_id> = _id value of the user group
   *
   */
  _self.deleteUserGroup = function (sites, group_id, cb) {
    _self._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * List firewall groups (using REST) - list_firewallgroups()
   * ---------------------------------
   * returns an array containing the current firewall groups or the selected firewall group on success
   * optional parameter <group_id> = _id value of the single firewall group to list
   */
  _self.getFirewallGroups = function (sites, cb, group_id) {
    if (typeof (group_id) === 'undefined') {
      group_id = '';
    }

    _self._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), null, sites, cb);
  };

  /**
   * Create firewall group (using REST) - create_firewallgroup()
   * ----------------------------------
   * returns an array containing a single object with attributes of the new firewall group on succe  ss
   * required parameter <group_name>    = name to assign to the firewall group
   * required parameter <group_type>    = firewall group type; valid values are address-group, ipv6  -address-group, port-group
   * optional parameter <group_members> = array containing the members of the new group (IPv4 addre  sses, IPv6 addresses or port numbers)
   *                                      (default is an empty array)
   */
  _self.createFirewallGroup = function (sites, group_name, group_type, cb, group_members) {
    if (typeof (group_members) === 'undefined') {
      group_members = [];
    }

    const json = {name: group_name,
      group_type,
      group_members};

    _self._request('/api/s/<SITE>/rest/firewallgroup', json, sites, cb);
  };

  /**
   * Modify firewall group (using REST) - edit_firewallgroup
   * ----------------------------------
   * returns an array containing a single object with attributes of the updated firewall group on s  uccess
   * required parameter <group_id>      = _id value of the firewall group to modify
   * required parameter <site_id>       = site_id value of the firewall group to modify
   * required parameter <group_name>    = name of the firewall group
   * required parameter <group_type>    = firewall group type; valid values are address-group, ipv6  -address-group, port-group,
   *                                      group_type cannot be changed for an existing firewall gro  up!
   * optional parameter <group_members> = array containing the members of the group (IPv4 addresses  , IPv6 addresses or port numbers)
   *                                      which will overwrite the existing group_members (default   is an empty array)
   *
   *
   */
  _self.editFirewallGroup = function (sites, group_id, site_id, group_name, group_type, cb, group_members) {
    if (typeof (group_members) === 'undefined') {
      group_members = [];
    }

    const json = {_id: group_id,
      name: group_name,
      group_type,
      group_members,
      site_id};

    _self._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), json, sites, cb, 'PUT');
  };

  /**
   * Delete firewall group (using REST) - delete_firewallgroup()
   * ----------------------------------
   * returns true on success
   * required parameter <group_id> = _id value of the firewall group to delete
   */
  _self.deleteFirewallGroup = function (sites, group_id, cb) {
    _self._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * List firewall rules (using REST) - list_firewallrules()
   * --------------------------------
   * returns an array containing the current firewall rules on success
   */
  _self.getFirewallRules = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/firewallrule', null, sites, cb);
  };

  /**
   * List static routing settings (using REST) - list_routing()
   * -----------------------------------------
   * returns an array of static routes and their settings
   * optional parameter <route_id> = string; _id value of the static route to get settings for
   */
  _self.getRouting = function (sites, cb, route_id) {
    if (typeof (route_id) === 'undefined') {
      route_id = '';
    }

    _self._request('/api/s/<SITE>/rest/routing/' + route_id.trim(), null, sites, cb);
  };

  /**
   * List health metrics - list_health()
   * -------------------
   *
   * required paramater <sites> = name or array of site names
   *
   */
  _self.getHealth = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/health', null, sites, cb);
  };

  /**
   * List dashboard metrics - list_dashboard()
   * ----------------------
   * returns an array of dashboard metric objects (available since controller version 4.9.1.alpha)
   * required paramater <sites> = name or array of site names
   * optional parameter <five_minutes> = boolean; if true, return stats based on 5 minute intervals,
   *                                     returns hourly stats by default (supported on controller versions 5.5.* and higher)
   */
  _self.getDashboard = function (sites, cb, five_minutes) {
    let url_suffix = '';
    if (typeof (five_minutes) !== 'undefined' && five_minutes === true) {
      url_suffix = '?scale=5minutes';
    }

    _self._request('/api/s/<SITE>/stat/dashboard' + url_suffix, null, sites, cb);
  };

  /**
   * List client devices - list_users()
   * -------------------
   * returns an array of known client device objects
   * required paramater <sites> = name or array of site names
   */
  _self.getUsers = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/user', null, sites, cb);
  };

  /**
   * List access points and other devices under management of the controller (USW and/or USG devices) - list_devices()
   * ------------------------------------------------------------------------------------------------
   *
   * required paramater <sites>      = name or array of site names
   * optional paramater <device_mac> = the MAC address of a single device for which the call must be made
   */
  _self.getAccessDevices = function (sites, cb, device_mac) {
    if (typeof (device_mac) === 'undefined') {
      device_mac = '';
    }

    _self._request('/api/s/<SITE>/stat/device/' + device_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * List (device) tags (using REST) - list_tags()
   * -------------------------------
   * returns an array of known device tag objects
   *
   * NOTES: this endpoint was introduced with controller versions 5.5.X
   */
  _self.listTags = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/tag', null, sites, cb);
  };

  /**
   * List rogue/neighboring access points - list_rogueaps()
   * ------------------------------------
   * returns an array of rogue/neighboring access point objects
   * optional parameter <within> = hours to go back to list discovered "rogue" access points (default = 24 hours)
   *
   */
  _self.getRogueAccessPoints = function (sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 24;
    }

    _self._request('/api/s/<SITE>/stat/rogueap', {within}, sites, cb);
  };

  /**
   * List known rogue access points - list_known_rogueaps()
   * ------------------------------
   * returns an array of known rogue access point objects
   */
  _self.getKnownRogueAccessPoints = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/rogueknown', null, sites, cb);
  };

  /**
   * Generate backup - generate_backup()
   * ---------------
   * returns a URL from where the backup file can be downloaded once generated
   *
   * NOTES:
   * this is an experimental function, please do not use unless you know exactly
   * what you're doing
   */
  _self.generateBackup = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/backup', {cmd: 'backup'}, sites, cb);
  };

  /**
   * List auto backups - list_backups()
   * -----------------
   * return an array containing objects with backup details on success
   */
  _self.getBackups = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/backup', {cmd: 'list-backups'}, sites, cb);
  };

  /**
   * Delete a backup file
   * --------------------
   * return true on success
   * required parameter <filename> = string; filename of backup to delete
   */
  _self.deleteBackup = function (sites, filename, cb) {
    _self._request('/api/s/<SITE>/cmd/backup', {cmd: 'delete-backup', filename}, sites, cb);
  };

  /**
   * List sites
   * ----------
   * calls callback function(err, result) with an array of the sites
   * registered to the UniFi controller
   */
  _self.getSites = function (cb) {
    _self._request('/api/self/sites', null, null, cb);
  };

  /**
   * List sites stats
   * ----------------
   * calls callback function(err, result) with an array of sysinfo information
   * for all sites registered to the UniFi controller
   *
   * NOTES: endpoint was introduced with controller version 5.2.9
   */
  _self.getSitesStats = function (cb) {
    _self._request('/api/stat/sites', null, null, cb);
  };

  /**
   * Create a site - create_site()
   * -------------
   *
   * required parameter <description> = the long name for the new site
   *
   * NOTES: immediately after being added, the new site will be available in the output of the "list_sites" function
   */
  _self.createSite = function (site, cb, description) {
    if (typeof (description) === 'undefined') {
      description = '';
    }

    const json = {desc: description,
      cmd: 'add-site'};

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  };

  /**
   * Delete a site - delete_site()
   * -------------
   * return true on success
   * required parameter <site_id> = 24 char string; _id value of the site to delete
   *
   */
  _self.deleteSite = function (site_id, cb) {
    // Lets get the _id first
    _self.getSites((err, result) => {
      if (!err && result && result.length > 0) {
        // Only if name or _id matches the site paramater
        if (result[0].name === site_id || result[0]._id === site_id) {
          const json = {site: result[0]._id,
            cmd: 'delete-site'};

          _self._request('/api/s/<SITE>/cmd/sitemgr', json, result[0].name, cb);
        }
      }
    });
  };

  /**
   * Change the current site's name - set_site_name()
   * ------------------------------
   * return true on success
   * required parameter <site_name> = string; the new long name for the current site
   *
   * NOTES: immediately after being changed, the site will be available in the output of the list_sites() function
   */
  _self.setSiteName = function (site, site_name, cb) {
    const json = {desc: site_name,
      cmd: 'update-site'};

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  };

  /**
   * Set site country - set_site_country()
   * ----------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "country" key.
   *                                Valid country codes can be obtained using the list_country_codes() function/method.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteCountry = function (site, country_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/country/' + country_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site locale - set_site_locale()
   * ---------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "locale" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteLocale = function (site, locale_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/locale/' + locale_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site snmp - set_site_snmp()
   * -------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "snmp" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteSNMP = function (site, snmp_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/snmp/' + snmp_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site mgmt - set_site_mgmt()
   * -------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "mgmt" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteMgmt = function (site, mgmt_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/mgmt/' + mgmt_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site guest access - set_site_guest_access()
   * ---------------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "guest_access" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteGuestAccess = function (site, guest_access_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/guest_access/' + guest_access_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site ntp - set_site_ntp()
   * ------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "ntp" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteNTP = function (site, ntp_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/ntp/' + ntp_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * Set site connectivity - set_site_connectivity()
   * ---------------------
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "connectivity" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteConnectivity = function (site, connectivity_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/setting/connectivity/' + connectivity_id.trim(), payload, site, cb, 'PUT');
  };

  /**
   * List admins - list_admins()
   * -----------
   *
   * required paramater <sites> = name or array of site names
   *
   */
  _self.listAdmins = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/sitemgr', {cmd: 'get-admins'}, sites, cb);
  };

  /**
   * List all admins - list_all_admins()
   * ---------------
   * returns an array containing administrator objects for all sites
   */
  _self.listAllAdmins = function (cb) {
    _self._request('/api/s/admin', {}, null, cb);
  };

  /**
   * Invite a new admin for access to the current site - invite_admin()
   * -------------------------------------------------
   * returns true on success
   * required parameter <name>           = string, name to assign to the new admin user
   * required parameter <email>          = email address to assign to the new admin user
   * optional parameter <enable_sso>     = boolean, whether or not SSO will be allowed for the new admin
   *                                       default value is true which enables the SSO capability
   * optional parameter <readonly>       = boolean, whether or not the new admin will have readonly
   *                                       permissions, default value is false which gives the new admin
   *                                       Administrator permissions
   * optional parameter <device_adopt>   = boolean, whether or not the new admin will have permissions to
   *                                       adopt devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   * optional parameter <device_restart> = boolean, whether or not the new admin will have permissions to
   *                                       restart devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   *
   * NOTES:
   * - after issuing a valid request, an invite will be sent to the email address provided
   * - issuing this command against an existing admin will trigger a "re-invite"
   */
  _self.inviteAdmin = function (sites, name, email, cb, enable_sso, readonly, device_adopt, device_restart) {
    if (typeof (enable_sso) === 'undefined') {
      enable_sso = true;
    }

    if (typeof (readonly) === 'undefined') {
      readonly = false;
    }

    if (typeof (device_adopt) === 'undefined') {
      device_adopt = false;
    }

    if (typeof (device_restart) === 'undefined') {
      device_restart = false;
    }

    const json = {name: name.trim(),
      email: email.trim(),
      for_sso: enable_sso,
      cmd: 'invite-admin',
      role: 'admin'
    };

    const permissions = [];
    if (readonly === true) {
      json.role = 'readonly';
    }

    if (device_adopt === true) {
      permissions.push('API_DEVICE_ADOPT');
    }

    if (device_restart === true) {
      permissions.push('API_DEVICE_RESTART');
    }

    json.permissions = permissions;

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * Assign an existing admin to the current site - assign_existing_admin()
   * --------------------------------------------
   * returns true on success
   * required parameter <admin_id>       = 24 char string; _id value of the admin user to assign, can be obtained using the
   *                                       list_all_admins() method/function
   * optional parameter <readonly>       = boolean, whether or not the new admin will have readonly
   *                                       permissions, default value is false which gives the new admin
   *                                       Administrator permissions
   * optional parameter <device_adopt>   = boolean, whether or not the new admin will have permissions to
   *                                       adopt devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   * optional parameter <device_restart> = boolean, whether or not the new admin will have permissions to
   *                                       restart devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   */
  _self.assignExistingAdmin = function (sites, admin_id, cb, readonly, device_adopt, device_restart) {
    if (typeof (readonly) === 'undefined') {
      readonly = false;
    }

    if (typeof (device_adopt) === 'undefined') {
      device_adopt = false;
    }

    if (typeof (device_restart) === 'undefined') {
      device_restart = false;
    }

    const json = {cmd: 'grant-admin',
      admin: admin_id.trim(),
      role: 'admin'
    };

    const permissions = [];
    if (readonly === true) {
      json.role = 'readonly';
    }

    if (device_adopt === true) {
      permissions.push('API_DEVICE_ADOPT');
    }

    if (device_restart === true) {
      permissions.push('API_DEVICE_RESTART');
    }

    json.permissions = permissions;

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * Revoke an admin from the current site - revoke_admin()
   * -------------------------------------
   * returns true on success
   * required parameter <admin_id> = _id value of the admin to revoke, can be obtained using the
   *                                 list_all_admins() method/function
   *
   * NOTES:
   * only non-superadmin accounts can be revoked
   */
  _self.revokeAdmin = function (sites, admin_id, cb) {
    const json = {cmd: 'revoke-admin',
      admin: admin_id
    };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * List wlan_groups - list_wlan_groups()
   * ----------------
   *
   * required paramater <sites> = name or array of site names
   */
  _self.getWLanGroups = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/wlangroup', null, sites, cb);
  };

  /**
   * Show sysinfo - stat_sysinfo()
   * ------------
   * returns an array of known sysinfo data via callback function(err, result)
   * for all sites specified as a function parameter
   */
  _self.getSiteSysinfo = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/sysinfo', null, sites, cb);
  };

  /**
   * Get controller status - stat_status()
   * ---------------------
   * returns true upon success (controller is online)
   *
   * NOTES: in order to get useful results (e.g. controller version) you can call get_last_results_raw()
   * immediately after this method
   */
  _self.getStatus = function (cb) {
    _self._request('/status', {}, null, cb);
  };

  /**
   * List self - list_self()
   * ---------
   * returns an array of information about the logged in user
   */
  _self.getSelf = function (sites, cb) {
    _self._request('/api/s/<SITE>/self', null, sites, cb);
  };

  /**
   * List vouchers - stat_voucher()
   * -------------
   *
   * optional parameter <create_time> = Unix timestamp in seconds
   */
  _self.getVouchers = function (sites, cb, create_time) {
    let json = {};
    if (typeof (create_time) !== 'undefined') {
      json = {create_time};
    }

    _self._request('/api/s/<SITE>/stat/voucher', json, sites, cb);
  };

  /**
   * List payments - stat_payment()
   * -------------
   * returns an array of hotspot payments
   */
  _self.getPayments = function (sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = '';
    } else {
      within = '?within=' + within.trim();
    }

    _self._request('/api/s/<SITE>/stat/payment' + within, null, sites, cb);
  };

  /**
   * Create hotspot operator (using REST) - create_hotspotop()
   * ------------------------------------
   *
   * required parameter <name>       = name for the hotspot operator
   * required parameter <x_password> = clear text password for the hotspot operator
   * optional parameter <note>       = note to attach to the hotspot operator
   */
  _self.createHotspotOperator = function (sites, name, x_password, cb, note) {
    const json = {name,
      x_password};

    if (typeof (note) !== 'undefined') {
      json.note = note;
    }

    _self._request('/api/s/<SITE>/rest/hotspotop', json, sites, cb);
  };

  /**
   * List hotspot operators (using REST) - list_hotspotop()
   * -----------------------------------
   * returns an array of hotspot operators
   */
  _self.getHotspotOperators = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/hotspotop', null, sites, cb);
  };

  /**
   * Create voucher(s) - create_voucher()
   * -----------------
   * returns an array containing a single object which contains the create_time(stamp) of the voucher(s) created
   *
   * required parameter <minutes> = minutes the voucher is valid after activation (expiration time)
   * optional parameter <count>   = number of vouchers to create, default value is 1
   * optional parameter <quota>   = single-use or multi-use vouchers, value '0' is for multi-use, '1' is for single-use,
   *                                'n' is for multi-use n times
   * optional parameter <note>    = note text to add to voucher when printing
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <mbytes>  = data transfer limit in MB
   *
   * NOTES: please use the stat_voucher() method/function to retrieve the newly created voucher(s) by create_time
   */
  _self.createVouchers = function (sites, minutes, cb, count, quota, note, up, down, mbytes) {
    if (typeof (count) === 'undefined') {
      count = 1;
    }
    if (typeof (quota) === 'undefined') {
      quota = 0;
    }

    const json = {cmd: 'create-voucher',
      expire: minutes,
      n: count,
      quota};

    if (typeof (note) !== 'undefined') {
      json.note = note;
    }
    if (typeof (up) !== 'undefined') {
      json.up = up;
    }
    if (typeof (down) !== 'undefined') {
      json.down = down;
    }
    if (typeof (mbytes) !== 'undefined') {
      json.bytes = mbytes;
    }

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * Revoke voucher - revoke_voucher()
   *---------------
   * return TRUE on success
   *
   * required parameter <voucher_id> = 24 char string; _id value of the voucher to revoke
   */
  _self.revokeVoucher = function (sites, voucher_id, cb) {
    const json = {cmd: 'delete-voucher',
      _id: voucher_id};

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * Extend guest validity - extend_guest_validity()
   * ---------------------
   * return TRUE on success
   *
   * required parameter <guest_id> = 24 char string; _id value of the guest to extend validity
   */
  _self.extendGuestValidity = function (sites, guest_id, cb) {
    const json = {cmd: 'extend',
      _id: guest_id};

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * List port forwarding stats - list_portforward_stats()
   * --------------------------
   * returns an array of port forwarding stats
   */
  _self.getPortForwardingStats = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/portforward', null, sites, cb);
  };

  /**
   * List DPI stats - list_dpi_stats()
   * --------------
   * returns an array of DPI stats
   */
  _self.getDPIStats = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/dpi', null, sites, cb);
  };

  /**
   * List filtered DPI stats
   * -----------------------
   * returns an array of fileterd DPI stats
   * optional parameter <type>       = whether to returns stats by app or by category, valid values  :
   *                                   'by_cat' or 'by_app'
   * optional parameter <cat_filter> = an array containing numeric category ids to filter by,
   *                                   only to be combined with a "by_app" value for $type
   */
  _self.getFilteredDPIStats = function (sites, cb, type, cat_filter) {
    if (typeof (type) === 'undefined') {
      type = 'by_cat';
    }

    const json = {type};

    if (typeof (cat_filter) !== 'undefined' && type === 'by_app') {
      json.cats = cat_filter;
    }

    _self._request('/api/s/<SITE>/stat/sitedpi', json, sites, cb);
  };

  /**
   * Clear DPI stats
   * --------------
   * clears stats of DPI
   */
  _self.ClearDPIStatus = function (sites, cb) {
    const json = {
      cmd: 'clear-dpi'
    };
    _self._request('/api/s/<SITE>/cmd/stat', json, sites, cb);
  };

  /**
   * List current channels - list_current_channels()
   * ---------------------
   * returns an array of currently allowed channels
   */
  _self.getCurrentChannels = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/current-channel', null, sites, cb);
  };

  /**
   * List country codes - list_country_codes()
   * ------------------
   * returns an array of available country codes
   *
   * NOTES:
   * these codes following the ISO standard:
   * https://en.wikipedia.org/wiki/ISO_3166-1_numeric
   */
  _self.getCountryCodes = function (sites, cb) {
    _self._request('/api/s/<SITE>/stat/ccode', null, sites, cb);
  };

  /**
   * List port forwarding settings - list_portforwarding()
   * -----------------------------
   * returns an array of port forwarding settings
   */
  _self.getPortForwarding = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/portforward', null, sites, cb);
  };

  /**
   * List dynamic DNS settings - list_dynamicdns()
   * -------------------------
   * returns an array of dynamic DNS settings
   */
  _self.getDynamicDNS = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/dynamicdns', null, sites, cb);
  };

  /**
   * List port configurations - list_portconf()
   * ------------------------
   * returns an array of port configurations
   */
  _self.getPortConfig = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/portconf', null, sites, cb);
  };

  /**
   * List VoIP extensions - list_extensions()
   * --------------------
   * returns an array of VoIP extensions
   */
  _self.getVoipExtensions = function (sites, cb) {
    _self._request('/api/s/<SITE>/list/extension', null, sites, cb);
  };

  /**
   * List site settings - list_settings()
   * ------------------
   * returns an array of site configuration settings
   */
  _self.getSiteSettings = function (sites, cb) {
    _self._request('/api/s/<SITE>/get/setting', null, sites, cb);
  };

  /**
   * Adopt a device to the selected site - adopt_device()
   * -----------------------------------
   *
   * required parameter <mac> = device MAC address
   */
  _self.adoptDevice = function (sites, mac, cb) {
    const json = {cmd: 'adopt',
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Reboot a device - restart_device()
   * ---------------
   * return true on success
   * required parameter <mac>  = device MAC address
   * optional parameter <type> = string; two options: 'soft' or 'hard', defaults to soft
   *                             soft can be used for all devices, requests a plain restart of that   device
   *                             hard is special for PoE switches and besides the restart also requ  ests a
   *                             power cycle on all PoE capable ports. Keep in mind that a 'hard' r  eboot
   *                             does *NOT* trigger a factory-reset, as it somehow could suggest.
   */
  _self.restartDevice = function (sites, mac, cb, type) {
    const json = {cmd: 'restart',
      mac: mac.toLowerCase()};

    if (typeof (type) !== 'undefined') {
      json.type = type.toLowerCase();
    }

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Force provision of a device - force_provision()
   * ---------------------------
   * return true on success
   * required parameter <mac> = device MAC address
   */
  _self.forceProvision = function (sites, mac, cb) {
    const json = {cmd: 'force-provision',
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Reboot a UniFi CloudKey - reboot_cloudkey()
   * -----------------------
   * return true on success
   *
   * This API call does nothing on UniFi controllers *not* running on a UniFi CloudKey device
   */
  _self.rebootCloudKey = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/system', {cmd: 'reboot'}, sites, cb);
  };

  /**
   * Disable/enable an access point (using REST) - disable_ap()
   * -------------------------------------------
   *
   * required parameter <ap_id>   = 24 char string; value of _id for the access point which can be obtained from the device list
   * required parameter <disable> = boolean; TRUE will disable the device, FALSE will enable the device
   *
   * NOTES:
   * - a disabled device will be excluded from the dashboard status and device count and its LED and WLAN will be turned off
   * - appears to only be supported for access points
   * - available since controller versions 5.2.X
   */
  _self.disableAccessPoint = function (sites, ap_id, disable, cb) {
    _self._request('/api/s/<SITE>/rest/device/' + ap_id.trim(), {disabled: disable}, sites, cb, 'PUT');
  };

  /**
   * Override LED mode for a device (using REST) - led_override()
   * -------------------------------------------
   *
   * required parameter <device_id>     = 24 char string; value of _id for the device which can be obtained from the device list
   * required parameter <override_mode> = string, off/on/default; "off" will disable the LED of the device,
   *                                      "on" will enable the LED of the device,
   *                                      "default" will apply the site-wide setting for device LEDs
   */
  _self.setLEDOverride = function (sites, device_id, override_mode, cb) {
    _self._request('/api/s/<SITE>/rest/device/' + device_id.trim(), {led_override: override_mode}, sites, cb, 'PUT');
  };

  /**
   * Toggle flashing LED of an access point for locating purposes - locate_ap()
   * ------------------------------------------------------------
   *
   * required parameter <mac> = device MAC address
   * required parameter <enable> = boolean; true will enable flashing LED, false will disable
   */
  _self.setLocateAccessPoint = function (sites, mac, enable, cb) {
    const json = {cmd: enable === true ? 'set-locate' : 'unset-locate',
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Toggle LEDs of all the access points ON or OFF - site_leds()
   * ----------------------------------------------
   *
   * required parameter <enable> = boolean; true will switch LEDs of all the access points ON, false will switch them OFF
   */
  _self.setSiteLEDs = function (sites, enable, cb) {
    _self._request('/api/s/<SITE>/set/setting/mgmt', {led_enabled: enable}, sites, cb);
  };

  /**
   * Update access point radio settings - set_ap_radiosettings()
   * ----------------------------------
   *
   * required parameter <ap_id>   = value of _id for the access point which can be obtained from the device list
   * required parameter <radio>   = (default=ng)
   * required parameter <channel>
   * required parameter <ht>      = (default=20)
   * required parameter <tx_power_mode>
   * required parameter <tx_power>= (default=0)
   *
   * NOTES:
   * - only supported on pre-5.X.X controller versions
   */
  _self.setAccessPointRadioSettings = function (sites, ap_id, radio, channel, ht, tx_power_mode, tx_power, cb) {
    const json = {radio_table: [{radio,
      channel,
      ht,
      tx_power_mode,
      tx_power}]};

    _self._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), json, sites, cb);
  };

  /**
   * Assign access point to another WLAN group - set_ap_wlangroup()
   * -----------------------------------------
   * return true on success
   * required parameter <type_id>   = string; WLAN type, can be either 'ng' (for WLANs 2G (11n/b/g)  ) or 'na' (WLANs 5G (11n/a/ac))
   * required parameter <device_id> = string; _id value of the access point to be modified
   * required parameter <group_id>  = string; _id value of the WLAN group to assign device to
   */
  _self.setAccessPointWLanGroup = function (sites, type_id, device_id, group_id, cb) {
    const json = {wlan_overrides: {}};

    if (type_id === 'ng') {
      json.wlangroup_id_ng = group_id;
    } else if (type_id === 'na') {
      json.wlangroup_id_na = group_id;
    }

    _self._request('/api/s/<SITE>/upd/device/' + device_id.trim(), json, sites, cb);
  };

  /**
   * Update guest login settings - set_guestlogin_settings()
   * ---------------------------
   * return true on success
   * required parameter <portal_enabled>    = boolean; enable/disable the captive portal
   * required parameter <portal_customized> = boolean; enable/disable captive portal customizations
   * required parameter <redirect_enabled>  = boolean; enable/disable captive portal redirect
   * required parameter <redirect_url>      = string; url to redirect to, must include the http/https prefix, no trailing slashes
   * required parameter <x_password>        = string; the captive portal (simple) password
   * required parameter <expire_number>     = numeric; number of units for the authorization expiry
   * required parameter <expire_unit>       = numeric; number of minutes within a unit (a value 60 is required for hours)
   * required parameter <section_id>        = 24 char string; value of _id for the site settings section where key = "guest_access", settings can be obtained
   *                                          using the list_settings() function
   *
   * NOTES:
   * - both portal parameters are set to the same value!
   *
   */
  _self.setGuestLoginSettings = function (sites, portal_enabled, portal_customized, redirect_enabled, redirect_url, x_password, expire_number, expire_unit, section_id, cb) {
    const json = {portal_enabled,
      portal_customized,
      redirect_enabled,
      redirect_url,
      x_password,
      expire_number,
      expire_unit,
      _id: section_id};

    _self._request('/api/s/<SITE>/set/setting/guest_access/', json, sites, cb);
  };

  /**
   * Update guest login settings, base - set_guestlogin_settings_base()
   * ---------------------------------
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the guest login, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "guest_access" section.
   */
  _self.setGuestLoginSettingsBase = function (sites, payload, cb) {
    _self._request('/api/s/<SITE>/set/setting/guest_access', payload, sites, cb);
  };

  /**
   * Update IPS/IDS settings, base - set_ips_settings_base()
   * -----------------------------
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the IPS/IDS settings to apply, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "ips" section.
   */
  _self.setIPSSettingsBase = function (sites, payload, cb) {
    _self._request('/api/s/<SITE>/set/setting/ips', payload, sites, cb);
  };

  /**
   * Update "Super Management" settings, base - set_super_mgmt_settings_base()
   * ----------------------------------------
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_mgmt", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super Management" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_mgmt" section.
   */
  _self.setSuperMgmtSettingsBase = function (sites, settings_id, payload, cb) {
    _self._request('/api/s/<SITE>/set/setting/super_mgmt/' + settings_id.trim(), payload, sites, cb);
  };

  /**
   * Update "Super SMTP" settings, base - set_super_smtp_settings_base()
   * ----------------------------------
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_smtp", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super SMTP" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_smtp" section.
   */
  _self.setSuperSMTPSettingsBase = function (sites, settings_id, payload, cb) {
    _self._request('/api/s/<SITE>/set/setting/super_smtp/' + settings_id.trim(), payload, sites, cb);
  };

  /**
   * Update "Super Controller Identity" settings, base - set_super_identity_settings_base()
   * -------------------------------------------------
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_identity", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super Controller Identity" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_identity" section.
   */
  _self.setSuperIdentitySettingsBase = function (sites, settings_id, payload, cb) {
    _self._request('/api/s/<SITE>/set/setting/super_identity/' + settings_id.trim(), payload, sites, cb);
  };

  /**
   * Rename access point - rename_ap()
   * -------------------
   *
   * required parameter <ap_id>  = value of _id for the access point which can be obtained from the device list
   * required parameter <apname> = New name
   *
   */
  _self.renameAccessPoint = function (sites, ap_id, apname, cb) {
    _self._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), {name: apname}, sites, cb);
  };

  /**
   * Move a device to another site - move_device()
   * -----------------------------
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   * required parameter <site_id> = 24 char string; _id of the site to move the device to
   */
  _self.moveDevice = function (sites, mac, site_id, cb) {
    const json = {site: site_id,
      mac: mac.toLowerCase(),
      cmd: 'move-device'
    };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * Delete a device from the current site - delete_device()
   * -------------------------------------
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   */
  _self.deleteDevice = function (sites, mac, cb) {
    const json = {mac: mac.toLowerCase(),
      cmd: 'delete-device'
    };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * List network settings (using REST) - list_networkconf()
   * ----------------------------------
   * returns an array of (non-wireless) networks and their settings
   * optional parameter <network_id> = string; _id value of the network to get settings for
   */
  _self.getNetworkConf = function (sites, cb, network_id) {
    if (typeof (network_id) === 'undefined') {
      network_id = '';
    }

    _self._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), null, sites, cb);
  };

  /**
   * Create a network (using REST) - create_network()
   * -----------------------------
   * return an array with a single object containing details of the new network on success, else return false
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_networkconf() for the specific network type.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   */
  _self.createNetwork = function (sites, payload, cb) {
    _self._request('/api/s/<SITE>/rest/networkconf', payload, sites, cb);
  };

  /**
   * Update network settings, base (using REST) - set_networksettings_base()
   * ------------------------------------------
   * return true on success
   * required parameter <network_id> = the "_id" value for the network you wish to update
   * required parameter <payload>    = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                   object/array structured in the same manner as is returned by list_networkconf() for the network.
   */
  _self.setNetworkSettingsBase = function (sites, network_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), payload, sites, cb, 'PUT');
  };

  /**
   * Delete a network (using REST) - delete_network()
   * -----------------------------
   * return true on success
   * required parameter <network_id> = 24 char string; _id value of the network which can be found with the list_networkconf() function
   */
  _self.deleteNetwork = function (sites, network_id, cb) {
    _self._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * List wlan settings (using REST) - list_wlanconf()
   * -------------------------------
   * returns an array of wireless networks and their settings, or an array containing a single wireless network when using
   * the <wlan_id> parameter
   * required paramater <sites>   = name or array of site names
   * optional parameter <wlan_id> = 24 char string; _id value of the wlan to fetch the settings for
   */
  _self.getWLanSettings = function (sites, cb, wlan_id) {
    if (typeof (wlan_id) === 'undefined') {
      wlan_id = '';
    }

    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), null, sites, cb);
  };

  /**
   * Create a wlan - create_wlan()
   * -------------
   *
   * required parameter <name>             = string; SSID
   * required parameter <x_passphrase>     = string; new pre-shared key, minimal length is 8 characters, maximum length is 63,
   *                                         assign a value of null when security = 'open'
   * required parameter <usergroup_id>     = string; user group id that can be found using the list_usergroups() function
   * required parameter <wlangroup_id>     = string; wlan group id that can be found using the list_wlan_groups() function
   * optional parameter <enabled>          = boolean; enable/disable wlan
   * optional parameter <hide_ssid>        = boolean; hide/unhide wlan SSID
   * optional parameter <is_guest>         = boolean; apply guest policies or not
   * optional parameter <security>         = string; security type (open, wep, wpapsk, wpaeap)
   * optional parameter <wpa_mode>         = string; wpa mode (wpa, wpa2, ..)
   * optional parameter <wpa_enc>          = string; encryption (auto, ccmp)
   * optional parameter <vlan_enabled>     = boolean; enable/disable vlan for this wlan
   * optional parameter <vlan>             = string; vlan id
   * optional parameter <uapsd_enabled>    = boolean; enable/disable Unscheduled Automatic Power Save Delivery
   * optional parameter <schedule_enabled> = boolean; enable/disable wlan schedule
   * optional parameter <schedule>         = string; schedule rules
   */
  _self.createWLan = function (sites, name, x_passphrase, usergroup_id, wlangroup_id, cb,
                              enabled, hide_ssid, is_guest, security, wpa_mode, wpa_enc, vlan_enabled, vlan, uapsd_enabled, schedule_enabled, schedule) {
    const json = {name,
      usergroup_id,
      wlangroup_id,
      enabled: typeof (enabled) === 'undefined' ? true : enabled,
      hide_ssid: typeof (hide_ssid) === 'undefined' ? false : hide_ssid,
      is_guest: typeof (is_guest) === 'undefined' ? false : is_guest,
      security: typeof (security) === 'undefined' ? 'open' : security,
      wpa_mode: typeof (wpa_mode) === 'undefined' ? 'wpa2' : wpa_mode,
      wpa_enc: typeof (wpa_enc) === 'undefined' ? 'ccmp' : wpa_enc,
      vlan_enabled: typeof (vlan_enabled) === 'undefined' ? false : vlan_enabled,
      uapsd_enabled: typeof (uapsd_enabled) === 'undefined' ? false : uapsd_enabled,
      schedule_enabled: typeof (schedule_enabled) === 'undefined' ? false : schedule_enabled,
      schedule: typeof (schedule) === 'undefined' ? {} : schedule
    };

    if (typeof (vlan) !== 'undefined' && typeof (vlan_enabled) !== 'undefined') {
      json.vlan = vlan;
    }

    if (x_passphrase !== '' && security !== 'open') {
      json.x_passphrase = x_passphrase;
    }

    _self._request('/api/s/<SITE>/add/wlanconf/', json, sites, cb);
  };

  /**
   * Update wlan settings, base (using REST) - set_wlansettings_base()
   * ---------------------------------------
   * return true on success
   * required paramater <sites>   = name or array of site names
   * required parameter <wlan_id> = the "_id" value for the WLAN you wish to update
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the wlan, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_wlanconf() for the wlan.
   */
  _self.setWLanSettingsBase = function (sites, wlan_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), payload, sites, cb, 'PUT');
  };

  /**
   * Update basic wlan settings - set_wlansettings()
   * --------------------------
   *
   * required parameter <wlan_id>
   * optional parameter <x_passphrase> = new pre-shared key, minimal length is 8 characters, maximum length is 63,
   *                                     will be ignored if set to null
   * optional parameter <name>
   *
   */
  _self.setWLanSettings = function (sites, wlan_id, cb, x_passphrase, name) {
    const json = { };

    if (typeof (x_passphrase) !== 'undefined') {
      json.x_passphrase = x_passphrase.trim();
    }

    if (typeof (name) !== 'undefined') {
      json.name = name.trim();
    }

    _self.setWLanSettingsBase(sites, wlan_id, json, cb);
  };

  /**
   * Disable/Enable wlan - disable_wlan()
   * -------------------
   *
   * required parameter <wlan_id>
   * required parameter <disable> = boolean; true disables the wlan, false enables it
   *
   */
  _self.disableWLan = function (sites, wlan_id, disable, cb) {
    const json = {enabled: disable !== true};

    _self.setWLanSettingsBase(sites, wlan_id, json, sites, cb);
  };

  /**
   * Delete a wlan (using REST) - delete_wlan()
   * --------------------------
   *
   * required parameter <wlan_id> = 24 char string; _id of the wlan that can be found with the list_wlanconf() function
   */
  _self.deleteWLan = function (sites, wlan_id, cb) {
    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), {}, sites, cb, 'DELETE');
  };

  /**
   * Update MAC filter for a wlan - set_wlan_mac_filter()
   * ----------------------------
   *
   * required parameter <wlan_id>            = the "_id" value for the WLAN you wish to update
   * required parameter <mac_filter_policy>  = string, "allow" or "deny"; default MAC policy to apply
   * required parameter <mac_filter_enabled> = boolean; true enables the policy, false disables it
   * required parameter <macs>               = array; must contain valid MAC strings to be placed in the MAC filter list,
   *                                           replacing existing values. Existing MAC filter list can be obtained
   *                                           through list_wlanconf().
   *
   */
  _self.setWLanMacFilter = function (sites, wlan_id, mac_filter_policy, mac_filter_enabled, macs, cb) {
    const json = {mac_filter_enabled,
      mac_filter_policy,
      mac_filter_list: macs
    };

    _self.setWLanSettingsBase(sites, wlan_id, json, cb);
  };

  /**
   * List events - list_events()
   * -----------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <historyhours> = hours to go back, default value is 720 hours
   * optional parameter <start>        = which event number to start with (useful for paging of results), default value is 0
   * optional parameter <limit>        = number of events to return, default value is 3000
   */
  _self.getEvents = function (sites, cb, historyhours, start, limit) {
    const json = {_sort: '-time',
      type: null};

    if (typeof (historyhours) === 'undefined') {
      json.within = 720;
    } else {
      json.within = historyhours;
    }

    if (typeof (start) === 'undefined') {
      json._start = 0;
    } else {
      json._start = start;
    }

    if (typeof (limit) === 'undefined') {
      json._limit = 3000;
    } else {
      json._limit = limit;
    }

    _self._request('/api/s/<SITE>/stat/event', json, sites, cb);
  };

  /**
   * List alarms - list_alarms()
   * -----------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <archived> = boolean; if true all alarms will be listed, if false only non-archived (active) alarms will be listed
   */
  _self.getAlarms = function (sites, cb, archived) {
    _self._request('/api/s/<SITE>/stat/alarm' + (archived === false ? '?archived=false' : ''), null, sites, cb);
  };

  /**
   * Count alarms - count_alarms()
   * ------------
   * returns an array containing the alarm count
   * required paramater <sites>   = name or array of site names
   * optional parameter <archived> = boolean; if true all alarms will be counted, if false only non-archived (active) alarms will be counted
   */
  _self.countAlarms = function (sites, cb, archived) {
    _self._request('/api/s/<SITE>/cnt/alarm' + (archived === false ? '?archived=false' : ''), null, sites, cb);
  };

  /**
   * Archive alarms(s) - archive_alarm()
   * -----------------
   * return true on success
   * optional parameter <alarm_id> = 24 char string; _id of the alarm to archive which can be found with the list_alarms() function,
   *                                 if not provided, *all* un-archived alarms for the current site will be archived!
   */
  _self.archiveAlarms = function (sites, cb, alarm_id) {
    const json = { };
    if (typeof (alarm_id) === 'undefined') {
      json.cmd = 'archive-all-alarms';
    } else {
      json.cmd = 'archive-alarm';
      json._id = alarm_id;
    }

    _self._request('/api/s/<SITE>/cmd/evtmgr', json, sites, cb);
  };

  /**
   * Upgrade a device to the latest firmware - upgrade_device()
   * ---------------------------------------
   * return true on success
   * required parameter <device_mac> = MAC address of the device to upgrade
   *
   * NOTES:
   * - updates the device to the latest firmware known to the controller
   */
  _self.upgradeDevice = function (sites, device_mac, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr/upgrade', {mac: device_mac.toLowerCase()}, sites, cb);
  };

  /**
   * Upgrade a device to a specific firmware file - upgrade_device_external()
   * --------------------------------------------
   * return true on success
   * required parameter <firmware_url> = URL for the firmware file to upgrade the device to
   * required parameter <device_mac>   = MAC address of the device to upgrade
   *
   * NOTES:
   * - updates the device to the firmware file at the given URL
   * - please take great care to select a valid firmware file for the device!
   */
  _self.upgradeDeviceExternal = function (sites, firmware_url, device_mac, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', {url: firmware_url, mac: device_mac.toLowerCase()}, sites, cb);
  };

  /**
   * Start rolling upgrade - start_rolling_upgrade()
   * ---------------------
   * return true on success
   *
   * NOTES:
   * - updates all access points to the latest firmware known to the controller in a
   *   staggered/rolling fashion
   */
  _self.startRollingUpgrade = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'set-rollupgrade'}, sites, cb);
  };

  /**
   * Cancel rolling upgrade - cancel_rolling_upgrade()
   * ----------------------
   * return true on success
   */
  _self.cancelRollingUpgrade = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'unset-rollupgrade'}, sites, cb);
  };

  /**
   * List firmware versions - list_firmware()
   * ----------------------
   * returns an array of firmware versions
   * optional parameter <type> = string; "available" or "cached", determines which firmware types to return
   */
  _self.getFirmware = function (sites, cb, type) {
    const payload = { };
    if (typeof (type) === 'undefined') {
      payload.cmd = 'available';
    }

    _self._request('/api/s/<SITE>/cmd/firmware', payload, sites, cb);
  };

  /**
   * Power-cycle the PoE output of a switch port - power_cycle_switch_port()
   * -------------------------------------------
   * return true on success
   * required parameter <switch_mac> = string; main MAC address of the switch
   * required parameter <port_idx>   = integer; port number/index of the port to be affected
   *
   * NOTES:
   * - only applies to switches and their PoE ports...
   * - port must be actually providing power
   */
  _self.powerCycleSwitchPort = function (sites, switch_mac, port_idx, cb) {
    const json = {mac: switch_mac.toLowerCase(),
      port_idx,
      cmd: 'power-cycle'
    };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Trigger an RF scan by an AP
   * ---------------------------
   * return true on success
   * required parameter <ap_mac> = MAC address of the AP
   */
  _self.runSpectrumScan = function (sites, ap_mac, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'spectrum-scan', mac: ap_mac.toLowerCase()}, sites, cb);
  };

  /**
   * Trigger a speedtest on a USG
   * ----------------------------
   * return true on success
   */
  _self.runSpeedTest = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest'}, sites, cb);
  };

  /**
   * Get the current state of a running speedtest on a USG
   * -----------------------------------------------------
   * returns status of speedtest
   */
  _self.getSpeedTestStatus = function (sites, cb) {
    _self._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest-status'}, sites, cb);
  };

  /**
   * Check the RF scanning state of an AP - spectrum_scan_state()
   * ------------------------------------
   * returns an object with relevant information (results if available) regarding the RF scanning state of the AP
   * required parameter <ap_mac> = MAC address of the AP
   */
  _self.getSpectrumScanState = function (sites, ap_mac, cb) {
    _self._request('/api/s/<SITE>/stat/spectrum-scan/' + ap_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * Update device settings, base (using REST) - set_device_settings_base()
   * -----------------------------------------
   * required paramater <sites>     = name or array of site names
   * required parameter <device_id> = 24 char string; _id of the device which can be found with the list_devices() function
   * required parameter <payload>   = stdClass object or associative array containing the configuration to apply to the device, must be a
   *                                  (partial) object/array structured in the same manner as is returned by list_devices() for the device.
   */
  _self.setDeviceSettingsBase = function (sites, device_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/device/' + device_id.trim(), payload, sites, cb, 'PUT');
  };

  /**
   * List Radius profiles (using REST) - list_radius_profiles()
   * -----------------------------------
   * returns an array of objects containing all Radius profiles for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.listRadiusProfiles = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/radiusprofile', null, sites, cb);
  };

  /**
   * List Radius user accounts (using REST) - list_radius_accounts()
   * --------------------------------------
   * returns an array of objects containing all Radius accounts for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.listRadiusAccounts = function (sites, cb) {
    _self._request('/api/s/<SITE>/rest/account', null, sites, cb);
  };

  /**
   * Create a Radius user account (using REST) - create_radius_account()
   * -----------------------------------------
   * returns an array containing a single object for the newly created account upon success, else returns false
   * required parameter <name>               = string; name for the new account
   * required parameter <x_password>         = string; password for the new account
   * required parameter <tunnel_type>        = integer; must be one of the following values:
   *                                              1      Point-to-Point Tunneling Protocol (PPTP)
   *                                              2      Layer Two Forwarding (L2F)
   *                                              3      Layer Two Tunneling Protocol (L2TP)
   *                                              4      Ascend Tunnel Management Protocol (ATMP)
   *                                              5      Virtual Tunneling Protocol (VTP)
   *                                              6      IP Authentication Header in the Tunnel-mode (AH)
   *                                              7      IP-in-IP Encapsulation (IP-IP)
   *                                              8      Minimal IP-in-IP Encapsulation (MIN-IP-IP)
   *                                              9      IP Encapsulating Security Payload in the Tunnel-mode (ESP)
   *                                              10     Generic Route Encapsulation (GRE)
   *                                              11     Bay Dial Virtual Services (DVS)
   *                                              12     IP-in-IP Tunneling
   *                                              13     Virtual LANs (VLAN)
   * required parameter <tunnel_medium_type> = integer; must be one of the following values:
   *                                              1      IPv4 (IP version 4)
   *                                              2      IPv6 (IP version 6)
   *                                              3      NSAP
   *                                              4      HDLC (8-bit multidrop)
   *                                              5      BBN 1822
   *                                              6      802 (includes all 802 media plus Ethernet "canonical format")
   *                                              7      E.163 (POTS)
   *                                              8      E.164 (SMDS, Frame Relay, ATM)
   *                                              9      F.69 (Telex)
   *                                              10     X.121 (X.25, Frame Relay)
   *                                              11     IPX
   *                                              12     Appletalk
   *                                              13     Decnet IV
   *                                              14     Banyan Vines
   *                                              15     E.164 with NSAP format subaddress
   * optional parameter <vlan>               = integer; VLAN to assign to the account
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.createRadiusAccount = function (sites, name, x_password, tunnel_type, tunnel_medium_type, cb, vlan) {
    const json = {name,
      x_password,
      tunnel_type,
      tunnel_medium_type
    };

    if (typeof (vlan) !== 'undefined') {
      json.vlan = vlan;
    }

    _self._request('/api/s/<SITE>/rest/account', json, sites, cb);
  };

  /**
   * Update Radius account, base (using REST) - set_radius_account_base()
   * ----------------------------------------
   * return true on success
   * required parameter <account_id> = 24 char string; _id of the account which can be found with the list_radius_accounts() function
   * required parameter <payload>    = stdClass object or associative array containing the new profile to apply to the account, must be a (partial)
   *                                   object/array structured in the same manner as is returned by list_radius_accounts() for the account.
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.setRadiusAccountBase = function (sites, account_id, payload, cb) {
    _self._request('/api/s/<SITE>/rest/account/' + account_id.trim(), payload, sites, cb, 'PUT');
  };

  /**
   * Delete a Radius account (using REST) - delete_radius_account()
   * ------------------------------------
   * return true on success
   * required parameter <account_id> = 24 char string; _id of the account which can be found with the list_radius_accounts() function
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.deleteRadiusAccount = function (sites, account_id, cb) {
    _self._request('/api/s/<SITE>/rest/account/' + account_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * Execute specific stats command - cmd_stat()
   * ------------------------------
   * return true on success
   * required parameter <command>  = string; command to execute, known valid values
   *                                 'reset-dpi': reset all DPI counters for the current site
   */
  _self.cmdStat = function (sites, command, cb) {
    const json = {cmd: command.trim()};

    _self._request('/api/s/<SITE>/cmd/stat', json, sites, cb);
  };

  /**
   * Upgrade External Firmware (5.4.9+)
   * -------------------------
   *
   * required paramater <sites>        = name or array of site names
   * required parameter <mac>          = device MAC address
   * required parameter <firmware_url> = external URL to firmware data
   *
   */
  _self.upgradeExternalFirmware = function (sites, mac, firmware_url, cb) {
    const json = {url: firmware_url,
      mac: mac.toLowerCase()};

    _self._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', json, sites, cb);
  };

  /**
   * Custom API request - custom_api_request()
   * ------------------
   * returns results as requested, returns false on incorrect parameters
   * required parameter <path>         = string; suffix of the URL (following the port number) to pass request to, *must* start with a "/" character
request to, *must* start with a "/" character
   * optional parameter <request_type> = string; HTTP request type, can be GET (default), POST, PUT, or DELETE
   * optional parameter <payload>      = stdClass object or associative array containing the payload to pass
   *
   * NOTE:
   * Only use this method when you fully understand the behavior of the UniFi controller API. No input validation is performed, to be used with care!
   */
  _self.customApiRequest = function (sites, path, cb, request_type, payload) {
    if (typeof (request_type) === 'undefined') {
      request_type = 'GET';
    }

    if (typeof (payload) === 'undefined') {
      payload = null;
    }

    _self._request(path, payload, sites, cb, request_type);
  };

  /** PRIVATE FUNCTIONS * */

  /**
   * Private function to send out a generic URL request to a UniFi-Controller
   * for multiple sites (if wanted) and returning data via the callback function
   */
  _self._request = function (url, json, sites, cb, method) {
    function getbaseurl() {
      if (_self._unifios === false || url.indexOf('login') > -1 || url.indexOf('logout') > -1) {
        return _self._baseurl;
      }
      return _self._baseurl + '/proxy/network';
    }

    let proc_sites;
    if (sites === null) {
      proc_sites = [{}];
    } else if (Array.isArray(sites) === false) {
      proc_sites = [sites];
    } else {
      proc_sites = sites;
    }

    let count = 0;
    let results = [];
    async.whilst(
      callback => {
        return callback(null, (count < proc_sites.length));
      },
      callback => {
        let reqfunc;
        const options = {
          url: getbaseurl() + url.replace('<SITE>', typeof (proc_sites[count]) === 'string' ? proc_sites[count] : ''),
          headers: _self._unifios === true ?
          {
            'Content-Type': 'application/json',
            'X-CSRF-Token': _self._csrfToken
          } : {
            'Content-Type': 'application/json'
          },
          jar: _self._cookies
        };

        // Identify which request method we are using (GET, POST, PUT, DELETE) based
        // on the json data supplied and the overriding method
        if (json !== null) {
          if (method === 'PUT') {
            reqfunc = request.put;
          } else {
            reqfunc = request.post;
          }
          options.json = json;
        } else if (typeof (method) === 'undefined') {
          reqfunc = request.get;
        } else if (method === 'DELETE') {
          reqfunc = request.del;
        } else if (method === 'POST') {
          reqfunc = request.post;
        } else if (method === 'PUT') {
          reqfunc = request.put;
        } else {
          reqfunc = request.get;
        }

        reqfunc(options, (error, response, body) => {
          if (error) {
            callback(error);
          } else if (body && response.statusCode >= 200 && response.statusCode < 400 &&
                     (typeof (body) !== 'undefined' && typeof (body.meta) !== 'undefined' && body.meta.rc === 'ok')) {
            results.push(body.data);
            callback(null);
          } else if (typeof (body) !== 'undefined' && typeof (body.meta) !== 'undefined' && body.meta.rc === 'error') {
            callback(body.meta.msg);
          } else {
            callback(null);
          }
        });

        count++;
      },
      err => {
        if (typeof (cb) === 'function') {
          if (sites === null) {
            results = results[0];
          }

          cb(err ? err : false, results);
        }
      }
    );
  };
};

exports.Controller = Controller;
