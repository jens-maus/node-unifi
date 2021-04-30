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
 * Based/Compatible to UniFi-API-client class: v1.1.68
 *
 * Copyright (c) 2017-2021 Jens Maus <mail@jens-maus.de>
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

class Controller {
  /** CONSTRUCTOR */
  constructor(hostname, port) {
    this._baseurl = 'https://127.0.0.1:8443';
    this._unifios = false;
    this._csrfToken = null;
    this._cookies = null;

    // Format a new baseurl based on the arguments
    if (typeof (hostname) !== 'undefined' && typeof (port) !== 'undefined') {
      this._baseurl = 'https://' + hostname + ':' + port;
    }
  }

  /** PUBLIC METHODS */

  /**
   * Login to the UniFi controller - login()
   *
   * returns true upon success
   */
  login(username, password, cb) {
    // Find out if this is a UnifiOS driven controller or not.
    async.series([
      callback => {
        // We have to use a custom cookie jar for this request - otherwise the login fails on Unifi
        this._cookies = request.jar();
        request({method: 'GET', followRedirect: false, uri: this._baseurl + '/', jar: this._cookies}, (error, response, body) => {
          if (!error) {
            // If the statusCode is 200 and a x-csrf-token is supplied this is a
            // UniFiOS device (e.g. UDM-Pro)
            if (response.statusCode === 200 && typeof (response.headers['x-csrf-token']) !== 'undefined') {
              this._unifios = true;
              this._csrfToken = response.headers['x-csrf-token'];
            } else {
              this._unifios = false;
              this._csrfToken = null;
            }
          }

          return callback(error, body);
        });
      },
      () => {
        // If this is a unifios system we use /api/auth instead
        this._request(this._unifios ? '/api/auth/login' : '/api/login', {
          username,
          password
        }, null, cb);
      }
    ]);
  }

  /**
   * Logout from the UniFi controller - logout()
   *
   * returns true upon success
   */
  logout(cb) {
    this._request(this._unifios ? '/api/auth/logout' : '/logout', {}, null, (error, result) => {
      if (!error) {
        this._cookies = null;
        this._csrfToken = null;
        this._unifios = false;
      }

      if (typeof (cb) === 'function') {
        cb(error, result);
      }
    });
  }

  /**
   * Authorize a client device - authorize_guest()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   * required parameter <minutes> = minutes (from now) until authorization expires
   * required paramater <cb>      = the callback function that is called with the results
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <megabytes>= data transfer limit in MB
   * optional parameter <ap_mac>  = AP MAC address to which client is connected, should result in faster authorization
   */
  authorizeGuest(sites, mac, minutes, cb, up, down, megabytes, ap_mac) {
    const json = {cmd: 'authorize-guest', mac: mac.toLowerCase()};
    if (typeof (minutes) !== 'undefined') {
      json.minutes = minutes;
    }

    /**
     * If we have received values for up/down/megabytes/ap_mac we append them to the payload array to be submitted
     */
    if (typeof (up) !== 'undefined') {
      json.up = up;
    }

    if (typeof (down) !== 'undefined') {
      json.down = down;
    }

    if (typeof (megabytes) !== 'undefined') {
      json.bytes = megabytes;
    }

    if (typeof (ap_mac) !== 'undefined') {
      json.ap_mac = ap_mac.toLowerCase();
    }

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Unauthorize a client device - unauthorize_guest()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  unauthorizeGuest(sites, mac, cb) {
    const json = {cmd: 'unauthorize-guest', mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Reconnect a client device - reconnect_sta()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  reconnectClient(sites, mac, cb) {
    const json = {cmd: 'kick-sta', mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Block a client device - block_sta()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  blockClient(sites, mac, cb) {
    const json = {cmd: 'block-sta', mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Unblock a client device - unblock_sta()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  unblockClient(sites, mac, cb) {
    const json = {cmd: 'unblock-sta', mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Forget one or more client devices - forget_sta()
   *
   * return true on success
   * required parameter <macs> = array of client MAC addresses
   *
   * NOTE:
   * only supported with controller versions 5.9.X and higher, can be
   * slow (up to 5 minutes) on larger controllers
   */
  forgetClient(sites, macs, cb) {
    const json = {cmd: 'forget-sta', macs};

    this._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  }

  /**
   * Create a new user/client-device - create_user()
   *
   * return an array with a single object containing details of the new user/client-device on success, else return false
   * required parameter <mac>           = client MAC address
   * required parameter <user_group_id> = _id value for the user group the new user/client-device should belong to which
   *                                      can be obtained from the output of list_usergroups()
   * optional parameter <name>          = name to be given to the new user/client-device
   * optional parameter <note>          = note to be applied to the new user/client-device
   * optional parameter <is_guest>      = boolean; defines whether the new user/client-device is a   guest or not
   * optional parameter <is_wired>      = boolean; defines whether the new user/client-device is wi  red or not
   */
  createUser(sites, mac, user_group_id, cb, name, note, is_guest, is_wired) {
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

    this._request('/api/s/<SITE>/group/user', {objects: [{data: new_user}]}, sites, cb);
  }

  /**
   * Add/modify/remove a client device note - set_sta_note()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the client-device to be modified
   * optional parameter <note>    = note to be applied to the client-device
   *
   * NOTES:
   * - when note is empty or not set, the existing note for the client-device is removed and "noted" attribute set to false
   */
  setClientNote(sites, user_id, cb, note) {
    let noted = 1;
    if (typeof (note) === 'undefined') {
      note = '';
      noted = 0;
    }

    this._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {note, noted}, sites, cb);
  }

  /**
   * Add/modify/remove a client device name - set_sta_name()
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the client device to be modified
   * optional parameter <name>    = name to be applied to the client device
   *
   * NOTES:
   * - when name is empty or not set, the existing name for the client device is removed
   */
  setClientName(sites, user_id, cb, name) {
    if (typeof (name) === 'undefined') {
      name = '';
    }

    this._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {name}, sites, cb);
  }

  /**
   * Fetch 5 minutes site stats method - stat_5minutes_site()
   *
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
  get5minSiteStats(sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wan2-tx_bytes',
      'wan2-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
    start,
    end};

    this._request('/api/s/<SITE>/stat/report/5minutes.site', json, sites, cb);
  }

  /**
   * Fetch Hourly site stats method - stat_hourly_site()
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  getHourlySiteStats(sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wan2-tx_bytes',
      'wan2-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
    start,
    end};

    this._request('/api/s/<SITE>/stat/report/hourly.site', json, sites, cb);
  }

  /**
   * Fetch Daily site stats method - stat_daily_site()
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 52*7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  getDailySiteStats(sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wan2-tx_bytes',
      'wan2-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
    start,
    end};

    this._request('/api/s/<SITE>/stat/report/daily.site', json, sites, cb);
  }

  /**
   * Fetch monthly site stats - stat_monthly_site()
   *
   * @param  int   $start optional, Unix timestamp in milliseconds
   * @param  int   $end   optional, Unix timestamp in milliseconds
   * @return array        returns an array of monthly stats objects for the current site
   *
   * NOTES:
   * - defaults to the past 52 weeks (52*7*24 hours)
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  getMonthlySiteStats(sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'wan-tx_bytes',
      'wan-rx_bytes',
      'wan2-tx_bytes',
      'wan2-rx_bytes',
      'wlan_bytes',
      'num_sta',
      'lan-num_sta',
      'wlan-num_sta',
      'time'],
    start,
    end};

    this._request('/api/s/<SITE>/stat/report/monthly.site', json, sites, cb);
  }

  /**
   * Fetch 5 minutes stats method for a single access point or all access points - stat_5minutes_aps()
   *
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
  get5minApStats(sites, cb, start, end, mac) {
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

    this._request('/api/s/<SITE>/stat/report/5minutes.ap', json, sites, cb);
  }

  /**
   * Fetch Hourly stats method for a single access point or all access points - stat_hourly_aps()
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
  getHourlyApStats(sites, cb, start, end, mac) {
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

    this._request('/api/s/<SITE>/stat/report/hourly.ap', json, sites, cb);
  }

  /**
   * Fetch Daily stats method for a single access point or all access points - stat_daily_aps()
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
  getDailyApStats(sites, cb, start, end, mac) {
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

    this._request('/api/s/<SITE>/stat/report/daily.ap', json, sites, cb);
  }

  /**
   * Fetch monthly stats for a single access point or all access points - stat_monthly_aps()
   *
   * NOTES:
   * - defaults to the past 52 weeks (52*7*24 hours)
   * - make sure that the retention policy for hourly stats is set to the correct value in
   *   the controller settings
   *
   * @param  int    $start optional, Unix timestamp in milliseconds
   * @param  int    $end   optional, Unix timestamp in milliseconds
   * @param  string $mac   optional, AP MAC address to return stats for, when empty,
   *                       stats for all APs are returned
   * @return array         returns an array of monthly stats objects
   */
  getMonthlyApStats(sites, cb, start, end, mac) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const json = {attrs: ['bytes',
      'num_sta',
      'time'],
    start,
    end};

    if (typeof (mac) !== 'undefined') {
      json.mac = mac.toLowerCase();
    }

    this._request('/api/s/<SITE>/stat/report/monthly.ap', json, sites, cb);
  }

  /**
   * Fetch 5 minutes stats method for a single user/client device - stat_5minutes_user()
   *
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
  get5minUserStats(sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'rx_bytes',
      'tx_bytes'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/stat/report/5minutes.user', json, sites, cb);
  }

  /**
   * Fetch Hourly stats method for a a single user/client device - stat_hourly_user()
   *
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
  getHourlyUserStats(sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'rx_bytes',
      'tx_bytes'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/stat/report/hourly.user', json, sites, cb);
  }

  /**
   * Fetch Daily stats method for a single user/client device - stat_daily_user()
   *
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
   * - make sure that the retention policy for daily stats is set to the correct value in
   *   the controller settings
   * - make sure that "Clients Historical Data" has been enabled in the UniFi controller settings in the Maintenance section
   */
  getDailyUserStats(sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'rx_bytes',
      'tx_bytes'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/stat/report/daily.user', json, sites, cb);
  }

  /**
   * Fetch monthly stats for a single user/client device - stat_monthly_user()
   *
   * NOTES:
   * - defaults to the past 13 weeks (52*7*24 hours)
   * - only supported with UniFi controller versions 5.8.X and higher
   * - make sure that the retention policy for monthly stats is set to the correct value in
   *   the controller settings
   * - make sure that "Clients Historical Data" has been enabled in the UniFi controller settings in the Maintenance section
   *
   * @param  string $mac     MAC address of user/client device to return stats for
   * @param  int    $start   optional, Unix timestamp in milliseconds
   * @param  int    $end     optional, Unix timestamp in milliseconds
   * @param  array  $attribs array containing attributes (strings) to be returned, valid values are:
   *                         rx_bytes, tx_bytes, signal, rx_rate, tx_rate, rx_retries, tx_retries, rx_packets, tx_packets
   *                         default is ['rx_bytes', 'tx_bytes']
   * @return array           returns an array of monthly stats objects
   */
  getMonthlyUserStats(sites, mac, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (13 * 7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'rx_bytes',
      'tx_bytes'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/stat/report/monthly.user', json, sites, cb);
  }

  /**
   * Fetch 5 minutes gateway stats method - stat_5minutes_gateway()
   *
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
  get5minGatewayStats(sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (12 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'mem',
      'cpu',
      'loadavg_5'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end};

    this._request('/api/s/<SITE>/stat/report/5minutes.gw', json, sites, cb);
  }

  /**
   * Fetch Hourly gateway stats method - stat_hourly_gateway()
   *
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
  getHourlyGatewayStats(sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'mem',
      'cpu',
      'loadavg_5'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end};

    this._request('/api/s/<SITE>/stat/report/hourly.gw', json, sites, cb);
  }

  /**
   * Fetch Daily gateway stats method - stat_daily_gateway()
   *
   * returns an array of daily stats objects for the gateway belonging to the current site
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <attribs> = array containing attributes (strings) to be returned, valid val  ues are:
   *                                mem, cpu, loadavg_5, lan-rx_errors, lan-tx_errors, lan-rx_bytes  ,
   *                                lan-tx_bytes, lan-rx_packets, lan-tx_packets, lan-rx_dropped, l  an-tx_dropped
   *                                default is ['time', 'mem', 'cpu', 'loadavg_5']
   *
   * NOTES:
   * - defaults to the past 52 weeks (52*7*24 hours)
   * - requires a USG
   */
  getDailyGatewayStats(sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'mem',
      'cpu',
      'loadavg_5'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end};

    this._request('/api/s/<SITE>/stat/report/daily.gw', json, sites, cb);
  }

  /**
   * Fetch monthly gateway stats - stat_monthly_gateway()
   *
   * NOTES:
   * - defaults to the past 52 weeks (52*7*24 hours)
   * - requires a USG
   *
   * @param  int   $start   optional, Unix timestamp in milliseconds
   * @param  int   $end     optional, Unix timestamp in milliseconds
   * @param  array $attribs array containing attributes (strings) to be returned, valid values are:
   *                        mem, cpu, loadavg_5, lan-rx_errors, lan-tx_errors, lan-rx_bytes,
   *                        lan-tx_bytes, lan-rx_packets, lan-tx_packets, lan-rx_dropped, lan-tx_dropped
   *                        default is ['time', 'mem', 'cpu', 'loadavg_5']
   * @return array          returns an array of monthly stats objects for the gateway belonging to the current site
   */
  getMonthlyGatewayStats(sites, cb, start, end, attribs) {
    if (typeof (end) === 'undefined') {
      end = Date.now();
    }

    if (typeof (start) === 'undefined') {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    attribs = typeof (attribs) === 'undefined' ? ['time',
      'mem',
      'cpu',
      'loadavg_5'] : ['time'].concat(attribs);

    const json = {attrs: attribs,
      start,
      end};

    this._request('/api/s/<SITE>/stat/report/monthly.gw', json, sites, cb);
  }

  /**
   * Fetch speed test results method - stat_speedtest_results()
   *
   * returns an array of speed test result objects
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 24 hours
   * - requires a USG
   */
  getSpeedTestResults(sites, cb, start, end) {
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

    this._request('/api/s/<SITE>/stat/report/archive.speedtest', json, sites, cb);
  }

  /**
   * Fetch IPS/IDS events methods - stat_ips_events
   *
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
  getIPSEvents(sites, cb, start, end, limit) {
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

    this._request('/api/s/<SITE>/stat/ips/event', json, sites, cb);
  }

  /**
   * Fetch login sessions - stat_sessions()
   *
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
  getSessions(sites, cb, start, end, mac, type) {
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

    this._request('/api/s/<SITE>/stat/session', json, sites, cb);
  }

  /**
   * Fetch latest 'n' login sessions for a single client device - stat_sta_sessions_latest()
   *
   * required paramater <sites> = name or array of site names
   * required parameter <mac>   = client MAC address
   * optional parameter <limit> = maximum number of sessions to get (defaults to 5)
   *
   */
  getLatestSessions(sites, mac, cb, limit) {
    if (typeof (limit) === 'undefined') {
      limit = 5;
    }

    const json = {mac: mac.toLowerCase(),
      _limit: limit,
      _sort: '-assoc_time'};

    this._request('/api/s/<SITE>/stat/session', json, sites, cb);
  }

  /**
   * Fetch authorizations - stat_auths()
   *
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  getAllAuthorizations(sites, cb, start, end) {
    if (typeof (end) === 'undefined') {
      end = Math.floor(Date.now() / 1000);
    }

    if (typeof (start) === 'undefined') {
      start = end - (7 * 24 * 3600);
    }

    this._request('/api/s/<SITE>/stat/authorization', {start, end}, sites, cb);
  }

  /**
   * Fetch client devices that connected to the site within given timeframe - stat_allusers()
   *
   * optional parameter <historyhours> = hours to go back (default is 8760 hours or 1 year)
   *
   * NOTES:
   * - <historyhours> is only used to select clients that were online within that period,
   *    the returned stats per client are all-time totals, irrespective of the value of <historyhours>
   */
  getAllUsers(sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    const json = {type: 'all',
      conn: 'all',
      within};

    this._request('/api/s/<SITE>/stat/alluser', json, sites, cb);
  }

  /**
   * List all blocked client devices ever connected to the site
   *
   * optional parameter <historyhours> = hours to go back (default is 8760 hours or 1 year)
   *
   * NOTES:
   * - <historyhours> is only used to select clients that were online within that period,
   *    the returned stats per client are all-time totals, irrespective of the value of <historyhours>
   */
  getBlockedUsers(sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    const json = {type: 'blocked',
      conn: 'all',
      within};

    this._request('/api/s/<SITE>/stat/alluser', json, sites, cb);
  }

  /**
   * Fetch guest devices - list_guests()
   *
   * optional parameter <within> = time frame in hours to go back to list guests with valid access (default = 24*365 hours)
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   *
   */
  getGuests(sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 8760;
    }

    this._request('/api/s/<SITE>/stat/guest', {within}, sites, cb);
  }

  /**
   * Fetch online client device(s) - list_clients()
   *
   * returns an array of online client device objects, or in case of a single device request, returns a single client device object
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  getClientDevices(sites, cb, client_mac) {
    if (typeof (client_mac) === 'undefined') {
      client_mac = '';
    }

    this._request('/api/s/<SITE>/stat/sta/' + client_mac.trim().toLowerCase(), null, sites, cb);
  }

  /**
   * Fetch details for a single client device - stat_client()
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  getClientDevice(sites, cb, client_mac) {
    if (typeof (client_mac) === 'undefined') {
      client_mac = '';
    }

    this._request('/api/s/<SITE>/stat/user/' + client_mac.trim().toLowerCase(), null, sites, cb);
  }

  /**
   * Assign client device to another group - set_usergroup()
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <user_id>  = id of the user device to be modified
   * required parameter <group_id> = id of the user group to assign user to
   *
   */
  setUserGroup(sites, user_id, group_id, cb) {
    this._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {usergroup_id: group_id}, sites, cb);
  }

  /**
   * Update client fixedip (using REST) - edit_client_fixedip()
   *
   * returns an array containing a single object with attributes of the updated client on success
   * required parameter <client_id>   = _id of the client
   * required parameter <use_fixedip> = boolean defining whether if use_fixedip is true or false
   * optional parameter <network_id>  = _id value for the network where the ip belongs to
   * optional parameter <fixed_ip>    = value of client's fixed_ip field
   *
   */
  editClientFixedIP(sites, client_id, use_fixedip, cb, network_id, fixed_ip) {
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

    this._request('/api/s/<SITE>/rest/user/' + client_id.trim(), json, sites, cb);
  }

  /**
   * Fetch user groups - list_usergroups()
   *
   * required paramater <sites>   = name or array of site names
   */
  getUserGroups(sites, cb) {
    this._request('/api/s/<SITE>/list/usergroup', null, sites, cb);
  }

  /**
   * Create user group (using REST) - create_usergroup()
   *
   * returns an array containing a single object with attributes of the new usergroup ("_id", "name", "qos_rate_max_down", "qos_rate_max_up", "site_id") on success
   *
   * required paramater <sites>      = name or array of site names
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  createUserGroup(sites, group_name, cb,
    group_dn, group_up) {
    const json = {name: group_name,
      qos_rate_max_down: typeof (group_dn) === 'undefined' ? -1 : group_dn,
      qos_rate_max_up: typeof (group_up) === 'undefined' ? -1 : group_up};

    this._request('/api/s/<SITE>/rest/usergroup', json, sites, cb);
  }

  /**
   * Modify user group (using REST) - edit_usergroup()
   *
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
  editUserGroup(sites, group_id, site_id, group_name, cb,
    group_dn, group_up) {
    const json = {_id: group_id,
      site_id,
      name: group_name,
      qos_rate_max_down: typeof (group_dn) === 'undefined' ? -1 : group_dn,
      qos_rate_max_up: typeof (group_up) === 'undefined' ? -1 : group_up};

    this._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), json, sites, cb, 'PUT');
  }

  /**
   * Delete user group (using REST) - delete_usergroup()
   *
   * returns true on success
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <group_id> = _id value of the user group to delete
   *
   */
  deleteUserGroup(sites, group_id, cb) {
    this._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), null, sites, cb, 'DELETE');
  }

  /**
   * Fetch AP groups - list_apgroups()
   *
   * @return array  containing the current AP groups on success
   */
  getAPGroups(sites, cb) {
    this._request('/v2/api/site/<SITE>/apgroups', null, sites, cb);
  }

  /**
   * Create AP group - create_apgroup()
   *
   * @param  string $group_name  name to assign to the AP group
   * @param  array  $device_macs optional, array containing the MAC addresses (strings) of the APs to add to the new group
   * @return object              returns a single object with attributes of the new AP group on success
   *
   */
  createAPGroup(sites, group_name, cb, device_macs) {
    const payload = {name: group_name};

    if (typeof (device_macs) !== 'undefined') {
      payload.device_macs = device_macs;
    }

    this._request('/v2/api/site/<SITE>/apgroups', payload, sites, cb);
  }

  /**
   * Modify AP group - edit_apgroup()
   *
   * @param  string $group_id    _id value of the AP group to modify
   * @param  string $group_name  name to assign to the AP group
   * @param  array  $device_macs array containing the members of the AP group which overwrites the existing
   *                             group_members (passing an empty array clears the AP member list)
   * @return object              returns a single object with attributes of the updated AP group on success
   *
   */
  editAPGroup(sites, group_id, group_name, device_macs, cb) {
    const payload = {_id: group_id,
      attr_no_delete: false,
      name: group_name,
      device_macs};

    this._request('/v2/api/site/<SITE>/apgroups/' + group_id.trim(), payload, sites, cb, 'PUT');
  }

  /**
   * Delete AP group - delete_apgroup()
   *
   * @param  string $group_id _id value of the AP group to delete
   * @return bool             returns true on success
   *
   */
  deleteAPGroup(sites, group_id, cb) {
    this._request('/v2/api/site/<SITE>/apgroups/' + group_id.trim(), null, sites, cb, 'DELETE');
  }

  /**
   * List firewall groups (using REST) - list_firewallgroups()
   *
   * returns an array containing the current firewall groups or the selected firewall group on success
   * optional parameter <group_id> = _id value of the single firewall group to list
   */
  getFirewallGroups(sites, cb, group_id) {
    if (typeof (group_id) === 'undefined') {
      group_id = '';
    }

    this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), null, sites, cb);
  }

  /**
   * Create firewall group (using REST) - create_firewallgroup()
   *
   * returns an array containing a single object with attributes of the new firewall group on succe  ss
   * required parameter <group_name>    = name to assign to the firewall group
   * required parameter <group_type>    = firewall group type; valid values are address-group, ipv6  -address-group, port-group
   * optional parameter <group_members> = array containing the members of the new group (IPv4 addre  sses, IPv6 addresses or port numbers)
   *                                      (default is an empty array)
   */
  createFirewallGroup(sites, group_name, group_type, cb, group_members) {
    if (typeof (group_members) === 'undefined') {
      group_members = [];
    }

    const json = {name: group_name,
      group_type,
      group_members};

    this._request('/api/s/<SITE>/rest/firewallgroup', json, sites, cb);
  }

  /**
   * Modify firewall group (using REST) - edit_firewallgroup
   *
   * returns an array containing a single object with attributes of the updated firewall group on s  uccess
   * required parameter <group_id>      = _id value of the firewall group to modify
   * required parameter <site_id>       = site_id value of the firewall group to modify
   * required parameter <group_name>    = name of the firewall group
   * required parameter <group_type>    = firewall group type; valid values are address-group, ipv6  -address-group, port-group,
   *                                      group_type cannot be changed for an existing firewall gro  up!
   * optional parameter <group_members> = array containing the members of the group (IPv4 addresses  , IPv6 addresses or port numbers)
   *                                      which overwrites the existing group_members (default   is an empty array)
   *
   *
   */
  editFirewallGroup(sites, group_id, site_id, group_name, group_type, cb, group_members) {
    if (typeof (group_members) === 'undefined') {
      group_members = [];
    }

    const json = {_id: group_id,
      name: group_name,
      group_type,
      group_members,
      site_id};

    this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), json, sites, cb, 'PUT');
  }

  /**
   * Delete firewall group (using REST) - delete_firewallgroup()
   *
   * returns true on success
   * required parameter <group_id> = _id value of the firewall group to delete
   */
  deleteFirewallGroup(sites, group_id, cb) {
    this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), null, sites, cb, 'DELETE');
  }

  /**
   * List firewall rules (using REST) - list_firewallrules()
   *
   * returns an array containing the current firewall rules on success
   */
  getFirewallRules(sites, cb) {
    this._request('/api/s/<SITE>/rest/firewallrule', null, sites, cb);
  }

  /**
   * List static routing settings (using REST) - list_routing()
   *
   * returns an array of static routes and their settings
   * optional parameter <route_id> = string; _id value of the static route to get settings for
   */
  getRouting(sites, cb, route_id) {
    if (typeof (route_id) === 'undefined') {
      route_id = '';
    }

    this._request('/api/s/<SITE>/rest/routing/' + route_id.trim(), null, sites, cb);
  }

  /**
   * List health metrics - list_health()
   *
   * required paramater <sites> = name or array of site names
   *
   */
  getHealth(sites, cb) {
    this._request('/api/s/<SITE>/stat/health', null, sites, cb);
  }

  /**
   * List dashboard metrics - list_dashboard()
   *
   * returns an array of dashboard metric objects (available since controller version 4.9.1.alpha)
   * required paramater <sites> = name or array of site names
   * optional parameter <five_minutes> = boolean; if true, return stats based on 5 minute intervals,
   *                                     returns hourly stats by default (supported on controller versions 5.5.* and higher)
   */
  getDashboard(sites, cb, five_minutes) {
    let url_suffix = '';
    if (typeof (five_minutes) !== 'undefined' && five_minutes === true) {
      url_suffix = '?scale=5minutes';
    }

    this._request('/api/s/<SITE>/stat/dashboard' + url_suffix, null, sites, cb);
  }

  /**
   * List client devices - list_users()
   *
   * returns an array of known client device objects
   * required paramater <sites> = name or array of site names
   */
  getUsers(sites, cb) {
    this._request('/api/s/<SITE>/list/user', null, sites, cb);
  }

  /**
   * List access points and other devices under management of the controller (USW and/or USG devices) - list_devices()
   *
   * required paramater <sites>      = name or array of site names
   * optional paramater <device_mac> = the MAC address of a single device for which the call must be made
   */
  getAccessDevices(sites, cb, device_mac) {
    if (typeof (device_mac) === 'undefined') {
      device_mac = '';
    }

    this._request('/api/s/<SITE>/stat/device/' + device_mac.trim().toLowerCase(), null, sites, cb);
  }

  /**
   * List (device) tags (using REST) - list_tags()
   *
   * returns an array of known device tag objects
   *
   * NOTES: this endpoint was introduced with controller versions 5.5.X
   */
  listTags(sites, cb) {
    this._request('/api/s/<SITE>/rest/tag', null, sites, cb);
  }

  /**
   * List rogue/neighboring access points - list_rogueaps()
   *
   * returns an array of rogue/neighboring access point objects
   * optional parameter <within> = hours to go back to list discovered "rogue" access points (default = 24 hours)
   *
   */
  getRogueAccessPoints(sites, cb, within) {
    if (typeof (within) === 'undefined') {
      within = 24;
    }

    this._request('/api/s/<SITE>/stat/rogueap', {within}, sites, cb);
  }

  /**
   * List known rogue access points - list_known_rogueaps()
   *
   * returns an array of known rogue access point objects
   */
  getKnownRogueAccessPoints(sites, cb) {
    this._request('/api/s/<SITE>/rest/rogueknown', null, sites, cb);
  }

  /**
   * Generate backup - generate_backup()
   *
   * returns a URL from where the backup file can be downloaded once generated
   *
   * NOTES:
   * this is an experimental function, please do not use unless you know exactly
   * what you're doing
   */
  generateBackup(sites, cb) {
    this._request('/api/s/<SITE>/cmd/backup', {cmd: 'backup'}, sites, cb);
  }

  /**
   * List auto backups - list_backups()
   *
   * return an array containing objects with backup details on success
   */
  getBackups(sites, cb) {
    this._request('/api/s/<SITE>/cmd/backup', {cmd: 'list-backups'}, sites, cb);
  }

  /**
   * Delete a backup file
   *
   * return true on success
   * required parameter <filename> = string; filename of backup to delete
   */
  deleteBackup(sites, filename, cb) {
    this._request('/api/s/<SITE>/cmd/backup', {cmd: 'delete-backup', filename}, sites, cb);
  }

  /**
   * List sites
   *
   * calls callback function(err, result) with an array of the sites
   * registered to the UniFi controller
   */
  getSites(cb) {
    this._request('/api/self/sites', null, null, cb);
  }

  /**
   * List sites stats
   *
   * calls callback function(err, result) with an array of sysinfo information
   * for all sites registered to the UniFi controller
   *
   * NOTES: endpoint was introduced with controller version 5.2.9
   */
  getSitesStats(cb) {
    this._request('/api/stat/sites', null, null, cb);
  }

  /**
   * Create a site - create_site()
   *
   * required parameter <description> = the long name for the new site
   *
   * NOTES: immediately after being added, the new site is available in the output of the "list_sites" function
   */
  createSite(site, cb, description) {
    if (typeof (description) === 'undefined') {
      description = '';
    }

    const json = {desc: description,
      cmd: 'add-site'};

    this._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  }

  /**
   * Delete a site - delete_site()
   *
   * return true on success
   * required parameter <site_id> = 24 char string; _id value of the site to delete
   *
   */
  deleteSite(site_id, cb) {
    // Lets get the _id first
    this.getSites((error, result) => {
      if (!error && result && result.length > 0 && (result[0].name === site_id || result[0]._id === site_id)) {
        const json = {site: result[0]._id,
          cmd: 'delete-site'};

        this._request('/api/s/<SITE>/cmd/sitemgr', json, result[0].name, cb);
      }
    });
  }

  /**
   * Change the current site's name - set_site_name()
   *
   * return true on success
   * required parameter <site_name> = string; the new long name for the current site
   *
   * NOTES: immediately after being changed, the site is available in the output of the list_sites() function
   */
  setSiteName(site, site_name, cb) {
    const json = {desc: site_name,
      cmd: 'update-site'};

    this._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  }

  /**
   * Set site country - set_site_country()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "country" key.
   *                                Valid country codes can be obtained using the list_country_codes() function/method.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteCountry(site, country_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/country/' + country_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site locale - set_site_locale()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "locale" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteLocale(site, locale_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/locale/' + locale_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site snmp - set_site_snmp()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "snmp" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteSNMP(site, snmp_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/snmp/' + snmp_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site mgmt - set_site_mgmt()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "mgmt" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteMgmt(site, mgmt_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/mgmt/' + mgmt_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site guest access - set_site_guest_access()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "guest_access" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteGuestAccess(site, guest_access_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/guest_access/' + guest_access_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site ntp - set_site_ntp()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "ntp" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteNTP(site, ntp_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/ntp/' + ntp_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Set site connectivity - set_site_connectivity()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "connectivity" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteConnectivity(site, connectivity_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/setting/connectivity/' + connectivity_id.trim(), payload, site, cb, 'PUT');
  }

  /**
   * Fetch admins - list_admins()
   *
   * @return array  containing administrator objects for selected site
   */
  listAdmins(sites, cb) {
    this._request('/api/s/<SITE>/cmd/sitemgr', {cmd: 'get-admins'}, sites, cb);
  }

  /**
   * Fetch all admins - list_all_admins()
   *
   * @return array  containing administrator objects for all sites
   */
  listAllAdmins(cb) {
    this._request('/api/s/admin', {}, null, cb);
  }

  /**
   * Invite a new admin for access to the current site - invite_admin()
   *
   * returns true on success
   * required parameter <name>           = string, name to assign to the new admin user
   * required parameter <email>          = email address to assign to the new admin user
   * optional parameter <enable_sso>     = boolean, whether or not SSO is allowed for the new admin
   *                                       default value is true which enables the SSO capability
   * optional parameter <readonly>       = boolean, whether or not the new admin has readonly
   *                                       permissions, default value is false which gives the new admin
   *                                       Administrator permissions
   * optional parameter <device_adopt>   = boolean, whether or not the new admin has permissions to
   *                                       adopt devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   * optional parameter <device_restart> = boolean, whether or not the new admin has permissions to
   *                                       restart devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   *
   * NOTES:
   * - after issuing a valid request, an invite is sent to the email address provided
   * - issuing this command against an existing admin triggers a "re-invite"
   */
  inviteAdmin(sites, name, email, cb, enable_sso, readonly, device_adopt, device_restart) {
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

    this._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  }

  /**
   * Assign an existing admin to the current site - assign_existing_admin()
   *
   * returns true on success
   * required parameter <admin_id>       = 24 char string; _id value of the admin user to assign, can be obtained using the
   *                                       list_all_admins() method/function
   * optional parameter <readonly>       = boolean, whether or not the new admin has readonly
   *                                       permissions, default value is false which gives the new admin
   *                                       Administrator permissions
   * optional parameter <device_adopt>   = boolean, whether or not the new admin has permissions to
   *                                       adopt devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   * optional parameter <device_restart> = boolean, whether or not the new admin has permissions to
   *                                       restart devices, default value is false. With versions < 5.9.X this only applies
   *                                       when readonly is true.
   */
  assignExistingAdmin(sites, admin_id, cb, readonly, device_adopt, device_restart) {
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

    this._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  }

  /**
   * Revoke an admin from the current site - revoke_admin()
   *
   * returns true on success
   * required parameter <admin_id> = _id value of the admin to revoke, can be obtained using the
   *                                 list_all_admins() method/function
   *
   * NOTES:
   * only non-superadmin accounts can be revoked
   */
  revokeAdmin(sites, admin_id, cb) {
    const json = {cmd: 'revoke-admin',
      admin: admin_id
    };

    this._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  }

  /**
   * Fetch wlan_groups - list_wlan_groups()
   *
   * @return array  containing known wlan_groups
   */
  getWLanGroups(sites, cb) {
    this._request('/api/s/<SITE>/list/wlangroup', null, sites, cb);
  }

  /**
   * Fetch sysinfo - stat_sysinfo()
   *
   * @return array  containing known sysinfo data
   */
  getSiteSysinfo(sites, cb) {
    this._request('/api/s/<SITE>/stat/sysinfo', null, sites, cb);
  }

  /**
   * Fetch controller status - stat_status()
   *
   * NOTES:
   * login not required
   *
   * @return bool true upon success (controller is online)
   */
  getStatus(cb) {
    this._request('/status', {}, null, cb);
  }

  /**
   * Fetch full controller status - stat_full_status()
   *
   * NOTES:
   * login not required
   *
   * @return bool|array  staus array upon success, false upon failure
   */
  getFullStatus(cb) {
    this._request('/status', {}, null, (error, result) => {
      result = this._last_results_raw;
      if (typeof (cb) === 'function') {
        cb(error, result);
      }
    });
  }

  /**
   * Fetch device name mappings - list_device_name_mappings()
   *
   * NOTES:
   * login not required
   *
   * @return bool|array  mappings array upon success, false upon failure
   */
  getDeviceNameMappings(cb) {
    this._request('/dl/firmware/bundles.json', {}, null, (error, result) => {
      result = this._last_results_raw;
      if (typeof (cb) === 'function') {
        cb(error, result);
      }
    });
  }

  /**
   * Fetch self - list_self()
   *
   * @return array  containing information about the logged in user
   */
  getSelf(sites, cb) {
    this._request('/api/s/<SITE>/self', null, sites, cb);
  }

  /**
   * Fetch vouchers - stat_voucher()
   *
   * @param  int   $create_time optional, create time of the vouchers to fetch in Unix timestamp in seconds
   * @return array              containing hotspot voucher objects
   */
  getVouchers(sites, cb, create_time) {
    let json = {};
    if (typeof (create_time) !== 'undefined') {
      json = {create_time};
    }

    this._request('/api/s/<SITE>/stat/voucher', json, sites, cb);
  }

  /**
   * List payments - stat_payment()
   *
   * returns an array of hotspot payments
   */
  getPayments(sites, cb, within) {
    within = typeof (within) === 'undefined' ? '' : '?within=' + within.trim();

    this._request('/api/s/<SITE>/stat/payment' + within, null, sites, cb);
  }

  /**
   * Create hotspot operator (using REST) - create_hotspotop()
   *
   * required parameter <name>       = name for the hotspot operator
   * required parameter <x_password> = clear text password for the hotspot operator
   * optional parameter <note>       = note to attach to the hotspot operator
   */
  createHotspotOperator(sites, name, x_password, cb, note) {
    const json = {name,
      x_password};

    if (typeof (note) !== 'undefined') {
      json.note = note;
    }

    this._request('/api/s/<SITE>/rest/hotspotop', json, sites, cb);
  }

  /**
   * Fetch hotspot operators (using REST) - list_hotspotop()
   *
   * @return array  containing hotspot operators
   */
  getHotspotOperators(sites, cb) {
    this._request('/api/s/<SITE>/rest/hotspotop', null, sites, cb);
  }

  /**
   * Create voucher(s) - create_voucher()
   *
   * returns an array containing a single object which contains the create_time(stamp) of the voucher(s) created
   *
   * required parameter <minutes> = minutes the voucher is valid after activation (expiration time)
   * optional parameter <count>   = number of vouchers to create, default value is 1
   * optional parameter <quota>   = single-use or multi-use vouchers, value '0' is for multi-use, '1' is for single-use,
   *                                'n' is for multi-use n times
   * optional parameter <note>    = note text to add to voucher when printing
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <megabytes>= data transfer limit in MB
   *
   * NOTES: please use the stat_voucher() method/function to retrieve the newly created voucher(s) by create_time
   */
  createVouchers(sites, minutes, cb, count, quota, note, up, down, megabytes) {
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

    if (typeof (megabytes) !== 'undefined') {
      json.bytes = megabytes;
    }

    this._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  }

  /**
   * Revoke voucher - revoke_voucher()
   *
   * return TRUE on success
   *
   * required parameter <voucher_id> = 24 char string; _id value of the voucher to revoke
   */
  revokeVoucher(sites, voucher_id, cb) {
    const json = {cmd: 'delete-voucher',
      _id: voucher_id};

    this._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  }

  /**
   * Extend guest validity - extend_guest_validity()
   *
   * return TRUE on success
   *
   * required parameter <guest_id> = 24 char string; _id value of the guest to extend validity
   */
  extendGuestValidity(sites, guest_id, cb) {
    const json = {cmd: 'extend',
      _id: guest_id};

    this._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  }

  /**
   * Fetch port forwarding stats - list_portforward_stats()
   *
   * @return array  containing port forwarding stats
   */
  getPortForwardingStats(sites, cb) {
    this._request('/api/s/<SITE>/stat/portforward', null, sites, cb);
  }

  /**
   * Fetch DPI stats - list_dpi_stats()
   *
   * @return array  containing DPI stats
   */
  getDPIStats(sites, cb) {
    this._request('/api/s/<SITE>/stat/dpi', null, sites, cb);
  }

  /**
   * List filtered DPI stats
   *
   * returns an array of fileterd DPI stats
   * optional parameter <type>       = whether to returns stats by app or by category, valid values  :
   *                                   'by_cat' or 'by_app'
   * optional parameter <cat_filter> = an array containing numeric category ids to filter by,
   *                                   only to be combined with a "by_app" value for $type
   */
  getFilteredDPIStats(sites, cb, type, cat_filter) {
    if (typeof (type) === 'undefined') {
      type = 'by_cat';
    }

    const json = {type};

    if (typeof (cat_filter) !== 'undefined' && type === 'by_app') {
      json.cats = cat_filter;
    }

    this._request('/api/s/<SITE>/stat/sitedpi', json, sites, cb);
  }

  /**
   * Clear DPI stats
   *
   * clears stats of DPI
   */
  clearDPIStatus(sites, cb) {
    const json = {
      cmd: 'clear-dpi'
    };
    this._request('/api/s/<SITE>/cmd/stat', json, sites, cb);
  }

  /**
   * Fetch current channels - list_current_channels()
   *
   * @return array  containing currently allowed channels
   */
  getCurrentChannels(sites, cb) {
    this._request('/api/s/<SITE>/stat/current-channel', null, sites, cb);
  }

  /**
   * Fetch country codes - list_country_codes()
   *
   * NOTES:
   * these codes following the ISO standard:
   * https://en.wikipedia.org/wiki/ISO_3166-1_numeric
   *
   * @return array  containing available country codes
   */
  getCountryCodes(sites, cb) {
    this._request('/api/s/<SITE>/stat/ccode', null, sites, cb);
  }

  /**
   * Fetch port forwarding settings - list_portforwarding()
   *
   * @return array  containing port forwarding settings
   */
  getPortForwarding(sites, cb) {
    this._request('/api/s/<SITE>/list/portforward', null, sites, cb);
  }

  /**
   * Fetch dynamic DNS settings - list_dynamicdns()
   *
   * @return array  containing dynamic DNS settings
   */
  getDynamicDNS(sites, cb) {
    this._request('/api/s/<SITE>/list/dynamicdns', null, sites, cb);
  }

  /**
   * Create dynamic DNS settings, base (using REST) - create_dynamicdns()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the site, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_dynamicdns() for the site.
   */
  createDynamicDNS(sites, payload, cb) {
    this._request('/api/s/<SITE>/rest/dynamicdns', payload, sites, cb);
  }

  /**
   * Update site dynamic DNS, base (using REST) - set_dynamicdns
   *
   * return true on success
   * required parameter <dynamicdns_id> = 24 char string; _id of the settings which can be found with the list_dynamicdns() function
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the site, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_dynamicdns() for the site.
   */
  setDynamicDNS(sites, dynamicdns_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/dynamicdns/' + dynamicdns_id.trim(), payload, sites, cb);
  }

  /**
   * Fetch port configurations - list_portconf()
   *
   * @return array  containing port configurations
   */
  getPortConfig(sites, cb) {
    this._request('/api/s/<SITE>/list/portconf', null, sites, cb);
  }

  /**
   * Fetch VoIP extensions - list_extensions()
   *
   * @return array  containing VoIP extensions
   */
  getVoipExtensions(sites, cb) {
    this._request('/api/s/<SITE>/list/extension', null, sites, cb);
  }

  /**
   * Fetch site settings - list_settings()
   *
   * @return array  containing site configuration settings
   */
  getSiteSettings(sites, cb) {
    this._request('/api/s/<SITE>/get/setting', null, sites, cb);
  }

  /**
   * Adopt a device to the selected site - adopt_device()
   *
   * required parameter <mac> = device MAC address
   */
  adoptDevice(sites, mac, cb) {
    const json = {cmd: 'adopt',
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  }

  /**
   * Reboot a device - restart_device()
   *
   * return true on success
   * required parameter <mac>  = device MAC address
   * optional parameter <reboot_type> = string; two options: 'soft' or 'hard', defaults to soft
   *                                    soft can be used for all devices, requests a plain restart of that   device
   *                                    hard is special for PoE switches and besides the restart also requ  ests a
   *                                    power cycle on all PoE capable ports. Keep in mind that a 'hard' r  eboot
   *                                    does *NOT* trigger a factory-reset.
   */
  restartDevice(sites, mac, cb, reboot_type) {
    const json = {cmd: 'restart',
      mac: mac.toLowerCase()};

    if (typeof (reboot_type) !== 'undefined') {
      json.reboot_type = reboot_type.toLowerCase();
    }

    this._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  }

  /**
   * Force provision of a device - force_provision()
   *
   * return true on success
   * required parameter <mac> = device MAC address
   */
  forceProvision(sites, mac, cb) {
    const json = {cmd: 'force-provision',
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  }

  /**
   * Reboot a UniFi CloudKey - reboot_cloudkey()
   *
   * return true on success
   *
   * This API call does nothing on UniFi controllers *not* running on a UniFi CloudKey device
   */
  rebootCloudKey(sites, cb) {
    this._request('/api/s/<SITE>/cmd/system', {cmd: 'reboot'}, sites, cb);
  }

  /**
   * Disable/enable an access point (using REST) - disable_ap()
   *
   * required parameter <ap_id>   = 24 char string; value of _id for the access point which can be obtained from the device list
   * required parameter <disable> = boolean; TRUE disables the device, FALSE enables the device
   *
   * NOTES:
   * - a disabled device is excluded from the dashboard status and device count and its LED and WLAN is turned off
   * - appears to only be supported for access points
   * - available since controller versions 5.2.X
   */
  disableAccessPoint(sites, ap_id, disable, cb) {
    this._request('/api/s/<SITE>/rest/device/' + ap_id.trim(), {disabled: disable}, sites, cb, 'PUT');
  }

  /**
   * Override LED mode for a device (using REST) - led_override()
   *
   * required parameter <device_id>     = 24 char string; value of _id for the device which can be obtained from the device list
   * required parameter <override_mode> = string, off/on/default; "off" disables the LED of the device,
   *                                      "on" enables the LED of the device,
   *                                      "default" applies the site-wide setting for device LEDs
   */
  setLEDOverride(sites, device_id, override_mode, cb) {
    this._request('/api/s/<SITE>/rest/device/' + device_id.trim(), {led_override: override_mode}, sites, cb, 'PUT');
  }

  /**
   * Toggle flashing LED of an access point for locating purposes - locate_ap()
   *
   * required parameter <mac> = device MAC address
   * required parameter <enable> = boolean; true enables flashing LED, false disables
   */
  setLocateAccessPoint(sites, mac, enable, cb) {
    const json = {cmd: enable === true ? 'set-locate' : 'unset-locate',
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  }

  /**
   * Toggle LEDs of all the access points ON or OFF - site_leds()
   *
   * required parameter <enable> = boolean; true switches LEDs of all the access points ON, false switches them OFF
   */
  setSiteLEDs(sites, enable, cb) {
    this._request('/api/s/<SITE>/set/setting/mgmt', {led_enabled: enable}, sites, cb);
  }

  /**
   * Update access point radio settings - set_ap_radiosettings()
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
  setAccessPointRadioSettings(sites, ap_id, radio, channel, ht, tx_power_mode, tx_power, cb) {
    const json = {radio_table: [{radio,
      channel,
      ht,
      tx_power_mode,
      tx_power}]};

    this._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), json, sites, cb);
  }

  /**
   * Assign access point to another WLAN group - set_ap_wlangroup()
   *
   * return true on success
   * required parameter <type_id>   = string; WLAN type, can be either 'ng' (for WLANs 2G (11n/b/g)  ) or 'na' (WLANs 5G (11n/a/ac))
   * required parameter <device_id> = string; _id value of the access point to be modified
   * required parameter <group_id>  = string; _id value of the WLAN group to assign device to
   */
  setAccessPointWLanGroup(sites, type_id, device_id, group_id, cb) {
    const json = {wlan_overrides: {}};

    if (type_id === 'ng') {
      json.wlangroup_id_ng = group_id;
    } else if (type_id === 'na') {
      json.wlangroup_id_na = group_id;
    }

    this._request('/api/s/<SITE>/upd/device/' + device_id.trim(), json, sites, cb);
  }

  /**
   * Update guest login settings - set_guestlogin_settings()
   *
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
  setGuestLoginSettings(sites, portal_enabled, portal_customized, redirect_enabled, redirect_url, x_password, expire_number, expire_unit, section_id, cb) {
    const json = {portal_enabled,
      portal_customized,
      redirect_enabled,
      redirect_url,
      x_password,
      expire_number,
      expire_unit,
      _id: section_id};

    this._request('/api/s/<SITE>/set/setting/guest_access/', json, sites, cb);
  }

  /**
   * Update guest login settings, base - set_guestlogin_settings_base()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the guest login, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "guest_access" section.
   */
  setGuestLoginSettingsBase(sites, payload, cb) {
    this._request('/api/s/<SITE>/set/setting/guest_access', payload, sites, cb);
  }

  /**
   * Update IPS/IDS settings, base - set_ips_settings_base()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the IPS/IDS settings to apply, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "ips" section.
   */
  setIPSSettingsBase(sites, payload, cb) {
    this._request('/api/s/<SITE>/set/setting/ips', payload, sites, cb);
  }

  /**
   * Update "Super Management" settings, base - set_super_mgmt_settings_base()
   *
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_mgmt", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super Management" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_mgmt" section.
   */
  setSuperMgmtSettingsBase(sites, settings_id, payload, cb) {
    this._request('/api/s/<SITE>/set/setting/super_mgmt/' + settings_id.trim(), payload, sites, cb);
  }

  /**
   * Update "Super SMTP" settings, base - set_super_smtp_settings_base()
   *
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_smtp", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super SMTP" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_smtp" section.
   */
  setSuperSMTPSettingsBase(sites, settings_id, payload, cb) {
    this._request('/api/s/<SITE>/set/setting/super_smtp/' + settings_id.trim(), payload, sites, cb);
  }

  /**
   * Update "Super Controller Identity" settings, base - set_super_identity_settings_base()
   *
   * return true on success
   * required parameter <settings_id> = 24 char string; value of _id for the site settings section where key = "super_identity", settings can be obtained
   *                                    using the list_settings() function
   * required parameter <payload>     = stdClass object or associative array containing the "Super Controller Identity" settings to apply, must be a (partial)
   *                                    object/array structured in the same manner as is returned by list_settings() for the "super_identity" section.
   */
  setSuperIdentitySettingsBase(sites, settings_id, payload, cb) {
    this._request('/api/s/<SITE>/set/setting/super_identity/' + settings_id.trim(), payload, sites, cb);
  }

  /**
   * Rename access point - rename_ap()
   *
   * required parameter <ap_id>  = value of _id for the access point which can be obtained from the device list
   * required parameter <apname> = New name
   *
   */
  renameAccessPoint(sites, ap_id, apname, cb) {
    this._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), {name: apname}, sites, cb);
  }

  /**
   * Move a device to another site - move_device()
   *
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   * required parameter <site_id> = 24 char string; _id of the site to move the device to
   */
  moveDevice(sites, mac, site_id, cb) {
    const json = {site: site_id,
      mac: mac.toLowerCase(),
      cmd: 'move-device'
    };

    this._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  }

  /**
   * Delete a device from the current site - delete_device()
   *
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   */
  deleteDevice(sites, mac, cb) {
    const json = {mac: mac.toLowerCase(),
      cmd: 'delete-device'
    };

    this._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  }

  /**
   * List network settings (using REST) - list_networkconf()
   *
   * returns an array of (non-wireless) networks and their settings
   * optional parameter <network_id> = string; _id value of the network to get settings for
   */
  getNetworkConf(sites, cb, network_id) {
    if (typeof (network_id) === 'undefined') {
      network_id = '';
    }

    this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), null, sites, cb);
  }

  /**
   * Create a network (using REST) - create_network()
   *
   * return an array with a single object containing details of the new network on success, else return false
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_networkconf() for the specific network type.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   */
  createNetwork(sites, payload, cb) {
    this._request('/api/s/<SITE>/rest/networkconf', payload, sites, cb);
  }

  /**
   * Update network settings, base (using REST) - set_networksettings_base()
   *
   * return true on success
   * required parameter <network_id> = the "_id" value for the network you wish to update
   * required parameter <payload>    = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                   object/array structured in the same manner as is returned by list_networkconf() for the network.
   */
  setNetworkSettingsBase(sites, network_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), payload, sites, cb, 'PUT');
  }

  /**
   * Delete a network (using REST) - delete_network()
   *
   * return true on success
   * required parameter <network_id> = 24 char string; _id value of the network which can be found with the list_networkconf() function
   */
  deleteNetwork(sites, network_id, cb) {
    this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), null, sites, cb, 'DELETE');
  }

  /**
   * List wlan settings (using REST) - list_wlanconf()
   *
   * returns an array of wireless networks and their settings, or an array containing a single wireless network when using
   * the <wlan_id> parameter
   * required paramater <sites>   = name or array of site names
   * optional parameter <wlan_id> = 24 char string; _id value of the wlan to fetch the settings for
   */
  getWLanSettings(sites, cb, wlan_id) {
    if (typeof (wlan_id) === 'undefined') {
      wlan_id = '';
    }

    this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), null, sites, cb);
  }

  /**
   * Create a wlan - create_wlan()
   *
   * @param  string  $name             SSID
   * @param  string  $x_passphrase     new pre-shared key, minimal length is 8 characters, maximum length is 63,
   *                                         assign a value of null when security = 'open'
   * @param  string  $usergroup_id     user group id that can be found using the list_usergroups() function
   * @param  string  $wlangroup_id     wlan group id that can be found using the list_wlan_groups() function
   * @param  boolean $enabled          optional, enable/disable wlan
   * @param  boolean $hide_ssid        optional, hide/unhide wlan SSID
   * @param  boolean $is_guest         optional, apply guest policies or not
   * @param  string  $security         optional, security type (open, wep, wpapsk, wpaeap)
   * @param  string  $wpa_mode         optional, wpa mode (wpa, wpa2, ..)
   * @param  string  $wpa_enc          optional, encryption (auto, ccmp)
   * @param  boolean $vlan_enabled     optional, enable/disable vlan for this wlan
   * @param  int     $vlan             optional, vlan id
   * @param  boolean $uapsd_enabled    optional, enable/disable Unscheduled Automatic Power Save Delivery
   * @param  boolean $schedule_enabled optional, enable/disable wlan schedule
   * @param  array   $schedule         optional, schedule rules
   * @param  array   $ap_group_ids     optional, array of ap group ids, required for UniFi controller versions 6.0.X and higher
   * @return bool                      true on success
   */
  createWLan(sites, name, x_passphrase, usergroup_id, wlangroup_id, cb,
    enabled, hide_ssid, is_guest, security, wpa_mode, wpa_enc, vlan_enabled, vlan, uapsd_enabled, schedule_enabled, schedule, ap_group_ids) {
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

    if (typeof (ap_group_ids) !== 'undefined') {
      json.ap_group_ids = ap_group_ids;
    }

    this._request('/api/s/<SITE>/add/wlanconf/', json, sites, cb);
  }

  /**
   * Update wlan settings, base (using REST) - set_wlansettings_base()
   *
   * return true on success
   * required paramater <sites>   = name or array of site names
   * required parameter <wlan_id> = the "_id" value for the WLAN you wish to update
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the wlan, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_wlanconf() for the wlan.
   */
  setWLanSettingsBase(sites, wlan_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), payload, sites, cb, 'PUT');
  }

  /**
   * Update basic wlan settings - set_wlansettings()
   *
   * required parameter <wlan_id>
   * optional parameter <x_passphrase> = new pre-shared key, minimal length is 8 characters, maximum length is 63,
   *                                     is ignored if set to null
   * optional parameter <name>
   *
   */
  setWLanSettings(sites, wlan_id, cb, x_passphrase, name) {
    const json = {};

    if (typeof (x_passphrase) !== 'undefined') {
      json.x_passphrase = x_passphrase.trim();
    }

    if (typeof (name) !== 'undefined') {
      json.name = name.trim();
    }

    this.setWLanSettingsBase(sites, wlan_id, json, cb);
  }

  /**
   * Disable/Enable wlan - disable_wlan()
   *
   * required parameter <wlan_id>
   * required parameter <disable> = boolean; true disables the wlan, false enables it
   *
   */
  disableWLan(sites, wlan_id, disable, cb) {
    const json = {enabled: disable !== true};

    this.setWLanSettingsBase(sites, wlan_id, json, sites, cb);
  }

  /**
   * Delete a wlan (using REST) - delete_wlan()
   *
   * required parameter <wlan_id> = 24 char string; _id of the wlan that can be found with the list_wlanconf() function
   */
  deleteWLan(sites, wlan_id, cb) {
    this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), {}, sites, cb, 'DELETE');
  }

  /**
   * Update MAC filter for a wlan - set_wlan_mac_filter()
   *
   * required parameter <wlan_id>            = the "_id" value for the WLAN you wish to update
   * required parameter <mac_filter_policy>  = string, "allow" or "deny"; default MAC policy to apply
   * required parameter <mac_filter_enabled> = boolean; true enables the policy, false disables it
   * required parameter <macs>               = array; must contain valid MAC strings to be placed in the MAC filter list,
   *                                           replacing existing values. Existing MAC filter list can be obtained
   *                                           through list_wlanconf().
   *
   */
  setWLanMacFilter(sites, wlan_id, mac_filter_policy, mac_filter_enabled, macs, cb) {
    const json = {mac_filter_enabled,
      mac_filter_policy,
      mac_filter_list: macs
    };

    this.setWLanSettingsBase(sites, wlan_id, json, cb);
  }

  /**
   * List events - list_events()
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <historyhours> = hours to go back, default value is 720 hours
   * optional parameter <start>        = which event number to start with (useful for paging of results), default value is 0
   * optional parameter <limit>        = number of events to return, default value is 3000
   */
  getEvents(sites, cb, historyhours, start, limit) {
    const json = {_sort: '-time',
      type: null};

    json.within = typeof (historyhours) === 'undefined' ? 720 : historyhours;

    json._start = typeof (start) === 'undefined' ? 0 : start;

    json._limit = typeof (limit) === 'undefined' ? 3000 : limit;

    this._request('/api/s/<SITE>/stat/event', json, sites, cb);
  }

  /**
   * List alarms - list_alarms()
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <payload> = json payload of flags to filter by
   *                                Example: {archived: 'false', key: 'EVT_GW_WANTransition'}
   *                                return only unarchived for a specific key
   */
  getAlarms(sites, cb, payload) {
    this._request('/api/s/<SITE>/stat/alarm', (typeof (payload) === 'undefined' ? null : payload), sites, cb);
  }

  /**
   * Count alarms - count_alarms()
   *
   * @param  bool  $archived optional, if true all alarms are counted, if false only non-archived (active) alarms are counted,
   *                         by default all alarms are counted
   * @return array           containing the alarm count
   */
  countAlarms(sites, cb, archived) {
    this._request('/api/s/<SITE>/cnt/alarm' + (archived === false ? '?archived=false' : ''), null, sites, cb);
  }

  /**
   * Archive alarms(s) - archive_alarm()
   *
   * @param  string $alarm_id optional, _id of the alarm to archive which can be found with the list_alarms() function,
   *                          by default all alarms are archived
   * @return bool             true on success
   */
  archiveAlarms(sites, cb, alarm_id) {
    const json = {};
    if (typeof (alarm_id) === 'undefined') {
      json.cmd = 'archive-all-alarms';
    } else {
      json.cmd = 'archive-alarm';
      json._id = alarm_id;
    }

    this._request('/api/s/<SITE>/cmd/evtmgr', json, sites, cb);
  }

  /**
   * Check controller update - check_controller_update()
   *
   * NOTE:
   * triggers an update of the controller cached known latest version.
   *
   * @return array returns an array with a single object containing details of the current known latest controller version info
   *               on success, else returns false
   */
  checkControllerUpdate(sites, cb) {
    this._request('/api/s/<SITE>/stat/fwupdate/latest-version', null, sites, cb);
  }

  /**
   * Check firmware update - check_firmware_update()
   *
   * NOTE:
   * triggers a Device Firmware Update in Classic Settings > System settings > Maintenance
   *
   * @return bool returns true upon success
   */
  checkFirmwareUpdate(sites, cb) {
    const payload = {cmd: 'check-firmware-update'};
    this._request('/api/s/<SITE>/cmd/productinfo', payload, sites, cb);
  }

  /**
   * Upgrade a device to the latest firmware - upgrade_device()
   *
   * return true on success
   * required parameter <device_mac> = MAC address of the device to upgrade
   *
   * NOTES:
   * - updates the device to the latest firmware known to the controller
   */
  upgradeDevice(sites, device_mac, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr/upgrade', {mac: device_mac.toLowerCase()}, sites, cb);
  }

  /**
   * Upgrade a device to a specific firmware file - upgrade_device_external()
   *
   * return true on success
   * required parameter <firmware_url> = URL for the firmware file to upgrade the device to
   * required parameter <device_mac>   = MAC address of the device to upgrade
   *
   * NOTES:
   * - updates the device to the firmware file at the given URL
   * - please take great care to select a valid firmware file for the device!
   */
  upgradeDeviceExternal(sites, firmware_url, device_mac, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', {url: firmware_url, mac: device_mac.toLowerCase()}, sites, cb);
  }

  /**
   * Start rolling upgrade - start_rolling_upgrade()
   *
   * return true on success
   *
   * NOTES:
   * - updates all access points to the latest firmware known to the controller in a
   *   staggered/rolling fashion
   */
  startRollingUpgrade(sites, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'set-rollupgrade'}, sites, cb);
  }

  /**
   * Cancel rolling upgrade - cancel_rolling_upgrade()
   *
   * return true on success
   */
  cancelRollingUpgrade(sites, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'unset-rollupgrade'}, sites, cb);
  }

  /**
   * Fetch firmware versions - list_firmware()
   *
   * @param  string $type optional, "available" or "cached", determines which firmware types to return,
   *                      default value is "available"
   * @return array        containing firmware versions
   */
  getFirmware(sites, cb, type) {
    const payload = {};
    if (typeof (type) === 'undefined') {
      payload.cmd = 'available';
    }

    this._request('/api/s/<SITE>/cmd/firmware', payload, sites, cb);
  }

  /**
   * Power-cycle the PoE output of a switch port - power_cycle_switch_port()
   *
   * return true on success
   * required parameter <switch_mac> = string; main MAC address of the switch
   * required parameter <port_idx>   = integer; port number/index of the port to be affected
   *
   * NOTES:
   * - only applies to switches and their PoE ports...
   * - port must be actually providing power
   */
  powerCycleSwitchPort(sites, switch_mac, port_idx, cb) {
    const json = {mac: switch_mac.toLowerCase(),
      port_idx,
      cmd: 'power-cycle'
    };

    this._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  }

  /**
   * Trigger an RF scan by an AP
   *
   * return true on success
   * required parameter <ap_mac> = MAC address of the AP
   */
  runSpectrumScan(sites, ap_mac, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'spectrum-scan', mac: ap_mac.toLowerCase()}, sites, cb);
  }

  /**
   * Trigger a speedtest on a USG
   *
   * return true on success
   */
  runSpeedTest(sites, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest'}, sites, cb);
  }

  /**
   * Get the current state of a running speedtest on a USG
   *
   * returns status of speedtest
   */
  getSpeedTestStatus(sites, cb) {
    this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest-status'}, sites, cb);
  }

  /**
   * Check the RF scanning state of an AP - spectrum_scan_state()
   *
   * returns an object with relevant information (results if available) regarding the RF scanning state of the AP
   * required parameter <ap_mac> = MAC address of the AP
   */
  getSpectrumScanState(sites, ap_mac, cb) {
    this._request('/api/s/<SITE>/stat/spectrum-scan/' + ap_mac.trim().toLowerCase(), null, sites, cb);
  }

  /**
   * Update device settings, base (using REST) - set_device_settings_base()
   *
   * required paramater <sites>     = name or array of site names
   * required parameter <device_id> = 24 char string; _id of the device which can be found with the list_devices() function
   * required parameter <payload>   = stdClass object or associative array containing the configuration to apply to the device, must be a
   *                                  (partial) object/array structured in the same manner as is returned by list_devices() for the device.
   */
  setDeviceSettingsBase(sites, device_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/device/' + device_id.trim(), payload, sites, cb, 'PUT');
  }

  /**
   * List Radius profiles (using REST) - list_radius_profiles()
   *
   * returns an array of objects containing all Radius profiles for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  listRadiusProfiles(sites, cb) {
    this._request('/api/s/<SITE>/rest/radiusprofile', null, sites, cb);
  }

  /**
   * List Radius user accounts (using REST) - list_radius_accounts()
   *
   * returns an array of objects containing all Radius accounts for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  listRadiusAccounts(sites, cb) {
    this._request('/api/s/<SITE>/rest/account', null, sites, cb);
  }

  /**
   * Create a Radius user account (using REST) - create_radius_account()
   *
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
  createRadiusAccount(sites, name, x_password, tunnel_type, tunnel_medium_type, cb, vlan) {
    const json = {name,
      x_password,
      tunnel_type,
      tunnel_medium_type
    };

    if (typeof (vlan) !== 'undefined') {
      json.vlan = vlan;
    }

    this._request('/api/s/<SITE>/rest/account', json, sites, cb);
  }

  /**
   * Update Radius account, base (using REST) - set_radius_account_base()
   *
   * return true on success
   * required parameter <account_id> = 24 char string; _id of the account which can be found with the list_radius_accounts() function
   * required parameter <payload>    = stdClass object or associative array containing the new profile to apply to the account, must be a (partial)
   *                                   object/array structured in the same manner as is returned by list_radius_accounts() for the account.
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  setRadiusAccountBase(sites, account_id, payload, cb) {
    this._request('/api/s/<SITE>/rest/account/' + account_id.trim(), payload, sites, cb, 'PUT');
  }

  /**
   * Delete a Radius account (using REST) - delete_radius_account()
   *
   * return true on success
   * required parameter <account_id> = 24 char string; _id of the account which can be found with the list_radius_accounts() function
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  deleteRadiusAccount(sites, account_id, cb) {
    this._request('/api/s/<SITE>/rest/account/' + account_id.trim(), null, sites, cb, 'DELETE');
  }

  /**
   * Execute specific stats command - cmd_stat()
   *
   * return true on success
   * required parameter <command>  = string; command to execute, known valid values
   *                                 'reset-dpi': reset all DPI counters for the current site
   */
  cmdStat(sites, command, cb) {
    const json = {cmd: command.trim()};

    this._request('/api/s/<SITE>/cmd/stat', json, sites, cb);
  }

  /**
   * Toggle Element Adoption ON or OFF - set_element_adoption()
   *
   * return true on success
   * required parameter <enable> = boolean; true enables Element Adoption, false disables Element Adoption
   */
  setElementAdoption(sites, enable, cb) {
    const payload = {enabled: enable};

    this._request('/api/s/<SITE>/set/setting/element_adopt', payload, sites, cb);
  }

  /**
   * Upgrade External Firmware (5.4.9+)
   *
   * required paramater <sites>        = name or array of site names
   * required parameter <mac>          = device MAC address
   * required parameter <firmware_url> = external URL to firmware data
   *
   */
  upgradeExternalFirmware(sites, mac, firmware_url, cb) {
    const json = {url: firmware_url,
      mac: mac.toLowerCase()};

    this._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', json, sites, cb);
  }

  /**
   * Custom API request - custom_api_request()
   *
   * NOTE:
   * Only use this method when you fully understand the behavior of the UniFi controller API. No input validation is performed, to be used with care!
   *
   * @param  string       $path           suffix of the URL (following the port number) to pass request to, *must* start with a "/" character
   * @param  string       $request_method optional, HTTP request type, can be GET (default), POST, PUT, PATCH, or DELETE
   * @param  object|array $payload        optional, stdClass object or associative array containing the payload to pass
   * @param  string       $return         optional, string; determines how to return results, when "boolean" the method must return a
   *                                      boolean result (true/false) or "array" when the method must return an array
   * @return bool|array                   returns results as requested, returns false on incorrect parameters
   */
  customApiRequest(sites, path, cb, request_method, payload) {
    if (typeof (request_method) === 'undefined') {
      request_method = 'GET';
    }

    if (typeof (payload) === 'undefined') {
      payload = null;
    }

    this._request(path, payload, sites, cb, request_method);
  }

  /** PRIVATE METHODS */

  /**
   * Private function to send out a generic URL request to a UniFi-Controller
   * for multiple sites (if wanted) and returning data via the callback function
   */
  _request(url, json, sites, cb, method) {
    const getbaseurl = () => {
      if (this._unifios === false || url.includes('login') || url.includes('logout')) {
        return this._baseurl;
      }

      return this._baseurl + '/proxy/network';
    };

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
          headers: this._unifios === true ?
            {
              'Content-Type': 'application/json',
              'X-CSRF-Token': this._csrfToken
            } : {
              'Content-Type': 'application/json'
            },
          jar: this._cookies
        };

        // Identify which request method we are using (GET, POST, PUT, DELETE) based
        // on the json data supplied and the overriding method
        if (json !== null) {
          reqfunc = method === 'PUT' ? request.put : request.post;

          options.json = json;
        } else if (typeof (method) === 'undefined') {
          reqfunc = request.get;
        } else {
          switch (method) {
            case 'DELETE': {
              reqfunc = request.del;

              break;
            }

            case 'POST': {
              reqfunc = request.post;

              break;
            }

            case 'PUT': {
              reqfunc = request.put;

              break;
            }

            case 'PATCH': {
              reqfunc = request.patch;

              break;
            }

            default: {
              reqfunc = request.get;
            }
          }
        }

        reqfunc(options, (error, response, body) => {
          this._last_results_raw = body;
          if (error) {
            callback(error);
          } else if (body && response.statusCode >= 200 && response.statusCode < 400 &&
                     (typeof (body) !== 'undefined' && typeof (body.meta) !== 'undefined' && body.meta.rc === 'ok')) {
            results.push(body.data);
            callback(null);
          } else if (typeof (body) !== 'undefined' && typeof (body.meta) !== 'undefined' && body.meta.rc === 'error') {
            callback(body.meta.msg);
          } else if (url.startsWith('/v2/api/') === true) {
            // To deal with a response coming from the new v2 API
            if (typeof (body) !== 'undefined' && typeof (body.errorCode) !== 'undefined') {
              if (typeof (body.message) === 'undefined') {
                callback(null);
              } else {
                callback(body.message);
              }
            } else {
              callback(body);
            }
          } else {
            callback(null);
          }
        });

        count++;
      },
      error => {
        if (typeof (cb) === 'function') {
          if (sites === null) {
            results = results[0];
          }

          cb(error ? error : false, results);
        }
      }
    );
  }
}

exports.Controller = Controller;
