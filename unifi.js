/* eslint-disable max-params, max-lines, camelcase */

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
 * Based/Compatible to UniFi-API-client class: v1.1.80
 *
 * Copyright (c) 2017-2023 Jens Maus <mail@jens-maus.de>
 *
 * The source code is distributed under the MIT license
 *
 */

import EventEmitter2 from 'eventemitter2';
import WebSocket from 'ws';
import axios from 'axios';
import {CookieJar} from 'tough-cookie';
import {HttpCookieAgent, HttpsCookieAgent} from 'http-cookie-agent/http';

/// ///////////////////////////////////////////////////////////
// PUBLIC CLASS

class Controller extends EventEmitter2 {
  /** CONSTRUCTOR */
  constructor(options) {
    super({
      wildcard: true,
    });

    // Parse opts
    this.opts = options || {};
    this.opts.host = ((this.opts.host) === undefined ? 'unifi' : this.opts.host);
    this.opts.port = ((this.opts.port) === undefined ? 8443 : this.opts.port);
    this.opts.username = ((this.opts.username) === undefined ? 'admin' : this.opts.username);
    this.opts.password = ((this.opts.password) === undefined ? 'ubnt' : this.opts.password);
    this.opts.token2FA = ((this.opts.token2FA) === undefined ? null : this.opts.token2FA);
    this.opts.site = ((this.opts.site) === undefined ? 'default' : this.opts.site);
    this.opts.sslverify = ((this.opts.sslverify) === undefined ? true : this.opts.sslverify);
    this.opts.timeout = ((this.opts.timeout) === undefined ? 5000 : this.opts.timeout);
    this.opts.rememberMe = ((this.opts.rememberMe) === undefined ? true : this.opts.rememberMe);

    this._baseurl = new URL(`https://${options.host}:${options.port}`);
    this._cookieJar = new CookieJar();
    this._unifios = false;
    this._isClosed = true;
    this._autoReconnectInterval = 5 * 1000; // Ms
    this._pingPongInterval = 3 * 1000; // Ms
    this._isInit = false;
  }

  /** PUBLIC METHODS */

  /**
   * Login to the UniFi controller - login()
   *
   * returns true upon success
   */
  async login(username = null, password = null, token2FA = null) {
    // Allows to override username+password
    if (username !== null) {
      this.opts.username = username;
    }

    if (password !== null) {
      this.opts.password = password;
    }

    if (token2FA !== null) {
      this.opts.token2FA = token2FA;
    }

    // Make sure init() was called
    const result = await this._init();

    // If init() was already called
    // resolve immediately
    if (result === 2) {
      return true;
    }

    let endpointUrl = `${this._baseurl.href}api/login`;
    if (this._unifios) {
      endpointUrl = `${this._baseurl.href}api/auth/login`;
    }

    // Prepare payload data
    const data = {
      username: this.opts.username,
      password: this.opts.password,
      rememberMe: this.opts.rememberMe,
    };

    // Add 2FA token to payload
    if (this.opts.token2FA) {
      // On UniFiOS 2FA is in 'token' field, else in 'ubic_2fa_token'
      data[this._unifios ? 'token' : 'ubic_2fa_token'] = this.opts.token2FA;
    }

    // Perform the login to the Unifi controller
    const response = await this._instance.post(endpointUrl, data, {
      timeout: this.opts.timeout,
    });

    // Catch x-csrf-token if supplied in response
    if (response.headers['x-csrf-token']) {
      this._xcsrftoken = response.headers['x-csrf-token'];
      this._instance.defaults.headers.common['x-csrf-token'] = this._xcsrftoken;
    }

    return true;
  }

  /**
   * Logout from the UniFi controller - logout()
   *
   * returns true upon success
   */
  async logout() {
    if (this._unifios === true) {
      return this._request('/api/auth/logout', null, 'POST');
    }

    return this._request('/logout');
  }

  /**
   * Authorize a client device - authorize_guest()
   *
   * required parameter <mac>     = client MAC address
   * optional parameter <minutes> = minutes (from now) until authorization expires
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <megabytes>= data transfer limit in MB
   * optional parameter <ap_mac>  = AP MAC address to which client is connected, should result in faster authorization
   */
  authorizeGuest(mac, minutes = null, up = null, down = null, megabytes = null, ap_mac = null) {
    const payload = {cmd: 'authorize-guest', mac: mac.toLowerCase()};

    if (minutes !== null) {
      payload.minutes = minutes;
    }

    if (up !== null) {
      payload.up = up;
    }

    if (down !== null) {
      payload.down = down;
    }

    if (megabytes !== null) {
      payload.bytes = megabytes;
    }

    if (ap_mac !== null) {
      payload.ap_mac = ap_mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/cmd/stamgr', payload);
  }

  /**
   * Unauthorize a client device - unauthorize_guest()
   *
   * required parameter <mac>     = client MAC address
   */
  unauthorizeGuest(mac) {
    return this._request('/api/s/<SITE>/cmd/stamgr', {cmd: 'unauthorize-guest', mac: mac.toLowerCase()});
  }

  /**
   * Reconnect a client device - reconnect_sta()
   *
   * required parameter <mac>     = client MAC address
   */
  reconnectClient(mac) {
    return this._request('/api/s/<SITE>/cmd/stamgr', {cmd: 'kick-sta', mac: mac.toLowerCase()});
  }

  /**
   * Block a client device - block_sta()
   *
   * required parameter <mac>     = client MAC address
   */
  blockClient(mac) {
    return this._request('/api/s/<SITE>/cmd/stamgr', {cmd: 'block-sta', mac: mac.toLowerCase()});
  }

  /**
   * Unblock a client device - unblock_sta()
   *
   * required parameter <mac>     = client MAC address
   */
  unblockClient(mac) {
    return this._request('/api/s/<SITE>/cmd/stamgr', {cmd: 'unblock-sta', mac: mac.toLowerCase()});
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
  forgetClient(macs) {
    return this._request('/api/s/<SITE>/cmd/stamgr', {cmd: 'forget-sta', macs});
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
  createUser(mac, user_group_id, name = null, note = null, is_guest = null, is_wired = null) {
    const new_user = {
      mac: mac.toLowerCase(),
      user_group_id,
    };

    if (name !== null) {
      new_user.name = name;
    }

    if (note !== null) {
      new_user.note = note;
    }

    if (is_guest !== null) {
      new_user.is_guest = is_guest;
    }

    if (is_wired !== null) {
      new_user.is_wired = is_wired;
    }

    return this._request('/api/s/<SITE>/group/user', {objects: [{data: new_user}]});
  }

  /**
   * Add/modify/remove a client device note - set_sta_note()
   *
   * required parameter <user_id> = id of the client-device to be modified
   * optional parameter <note>    = note to be applied to the client-device
   *
   * NOTES:
   * - when note is empty or not set, the existing note for the client-device is removed and "noted" attribute set to false
   */
  setClientNote(user_id, note = '') {
    return this._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {note});
  }

  /**
   * Add/modify/remove a client device name - set_sta_name()
   *
   * required parameter <user_id> = id of the client device to be modified
   * optional parameter <name>    = name to be applied to the client device
   *
   * NOTES:
   * - when name is empty or not set, the existing name for the client device is removed
   */
  setClientName(user_id, name = '') {
    return this._request('/api/s/<SITE>/upd/user/' + user_id.trim(), {name});
  }

  /**
   * Fetch 5 minutes site stats method - stat_5minutes_site()
   *
   * returns an array of 5-minute stats objects for the current site
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   */
  get5minSiteStats(start = null, end = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (12 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
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
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/5minutes.site', payload);
  }

  /**
   * Fetch Hourly site stats method - stat_hourly_site()
   *
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  getHourlySiteStats(start = null, end = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
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
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/hourly.site', payload);
  }

  /**
   * Fetch Daily site stats method - stat_daily_site()
   *
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   *
   * NOTES:
   * - defaults to the past 52*7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  getDailySiteStats(start = null, end = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
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
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/daily.site', payload);
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
  getMonthlySiteStats(start = null, end = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
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
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/monthly.site', payload);
  }

  /**
   * Fetch 5 minutes stats method for a single access point or all access points - stat_5minutes_aps()
   *
   * returns an array of 5-minute stats objects
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
  get5minApStats(start = null, end = null, mac = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (12 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
        'num_sta',
        'time'],
      start,
      end,
    };

    if (mac !== null) {
      payload.mac = mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/stat/report/5minutes.ap', payload);
  }

  /**
   * Fetch Hourly stats method for a single access point or all access points - stat_hourly_aps()
   *
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  getHourlyApStats(start = null, end = null, mac = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
        'num_sta',
        'time'],
      start,
      end,
    };

    if (mac !== null) {
      payload.mac = mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/stat/report/hourly.ap', payload);
  }

  /**
   * Fetch Daily stats method for a single access point or all access points - stat_daily_aps()
   *
   * optional parameter <start> = Unix timestamp in milliseconds
   * optional parameter <end>   = Unix timestamp in milliseconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  getDailyApStats(start = null, end = null, mac = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
        'num_sta',
        'time'],
      start,
      end,
    };

    if (mac !== null) {
      payload.mac = mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/stat/report/daily.ap', payload);
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
  getMonthlyApStats(start = null, end = null, mac = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['bytes',
        'num_sta',
        'time'],
      start,
      end,
    };

    if (mac !== null) {
      payload.mac = mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/stat/report/monthly.ap', payload);
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
  get5minUserStats(mac, start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (12 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'rx_bytes',
        'tx_bytes']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/stat/report/5minutes.user', payload);
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
  getHourlyUserStats(mac, start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'rx_bytes',
        'tx_bytes']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/stat/report/hourly.user', payload);
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
  getDailyUserStats(mac, start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'rx_bytes',
        'tx_bytes']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/stat/report/daily.user', payload);
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
  getMonthlyUserStats(mac, start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (13 * 7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'rx_bytes',
        'tx_bytes']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/stat/report/monthly.user', payload);
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
  get5minGatewayStats(start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (12 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'mem',
        'cpu',
        'loadavg_5']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/5minutes.gw', payload);
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
  getHourlyGatewayStats(start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'mem',
        'cpu',
        'loadavg_5']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/hourly.gw', payload);
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
  getDailyGatewayStats(start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'mem',
        'cpu',
        'loadavg_5']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/daily.gw', payload);
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
  getMonthlyGatewayStats(start = null, end = null, attribs = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (52 * 7 * 24 * 3600 * 1000);
    }

    attribs = attribs === null
      ? ['time',
        'mem',
        'cpu',
        'loadavg_5']
      : ['time', ...attribs];

    const payload = {
      attrs: attribs,
      start,
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/monthly.gw', payload);
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
  getSpeedTestResults(start = null, end = null) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (24 * 3600 * 1000);
    }

    const payload = {
      attrs: ['xput_download',
        'xput_upload',
        'latency',
        'time'],
      start,
      end,
    };

    return this._request('/api/s/<SITE>/stat/report/archive.speedtest', payload);
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
  getIPSEvents(start = null, end = null, limit = 10_000) {
    if (end === null) {
      end = Date.now();
    }

    if (start === null) {
      start = end - (24 * 3600 * 1000);
    }

    const payload = {
      start,
      end,
      _limit: limit,
    };

    return this._request('/api/s/<SITE>/stat/ips/event', payload);
  }

  /**
   * Fetch login sessions - stat_sessions()
   *
   * returns an array of login session objects for all devices or a single device
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = client MAC address to return sessions for (can only be used when start and end are also provided)
   * optional parameter <type>  = client type to return sessions for, can be 'all', 'guest' or 'user'; default value is 'all'
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  getSessions(start = null, end = null, mac = null, type = 'all') {
    if (end === null) {
      end = Math.floor(Date.now() / 1000);
    }

    if (start === null) {
      start = end - (7 * 24 * 3600);
    }

    const payload = {
      type,
      start,
      end,
    };

    if (mac !== null) {
      payload.mac = mac.toLowerCase();
    }

    return this._request('/api/s/<SITE>/stat/session', payload);
  }

  /**
   * Fetch latest 'n' login sessions for a single client device - stat_sta_sessions_latest()
   *
   * required parameter <mac>   = client MAC address
   * optional parameter <limit> = maximum number of sessions to get (defaults to 5)
   *
   */
  getLatestSessions(mac, limit = 5) {
    const payload = {
      mac: mac.toLowerCase(),
      _limit: limit,
      _sort: '-assoc_time',
    };

    return this._request('/api/s/<SITE>/stat/session', payload);
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
  getAllAuthorizations(start = null, end = null) {
    if (end === null) {
      end = Math.floor(Date.now() / 1000);
    }

    if (start === null) {
      start = end - (7 * 24 * 3600);
    }

    return this._request('/api/s/<SITE>/stat/authorization', {start, end});
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
  getAllUsers(within = 8760) {
    const payload = {
      type: 'all',
      conn: 'all',
      within,
    };

    return this._request('/api/s/<SITE>/stat/alluser', payload);
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
  getBlockedUsers(within = 8760) {
    const payload = {
      type: 'blocked',
      conn: 'all',
      within,
    };

    return this._request('/api/s/<SITE>/stat/alluser', payload);
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
  getGuests(within = 8760) {
    return this._request('/api/s/<SITE>/stat/guest', {within});
  }

  /**
   * Fetch online client device(s) - list_clients()
   *
   * returns an array of online client device objects, or in case of a single device request, returns a single client device object
   *
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  getClientDevices(client_mac = '') {
    return this._request('/api/s/<SITE>/stat/sta/' + client_mac.trim().toLowerCase());
  }

  /**
   * Fetch details for a single client device - stat_client()
   *
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  getClientDevice(client_mac = '') {
    return this._request('/api/s/<SITE>/stat/user/' + client_mac.trim().toLowerCase());
  }

  /**
   * Assign client device to another group - set_usergroup()
   *
   * @param string $client_id  _id value of the client device to be modified
   * @param string $group_id   _id value of the user group to assign client device to
   * @return bool returns true upon success
   */
  setUserGroup(client_id, group_id) {
    return this._request('/api/s/<SITE>/upd/user/' + client_id.trim(), {usergroup_id: group_id});
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
  editClientFixedIP(client_id, use_fixedip, network_id = null, fixed_ip = null) {
    const payload = {
      _id: client_id,
      use_fixedip,
    };

    if (use_fixedip === true) {
      if (network_id !== null) {
        payload.network_id = network_id;
      }

      if (fixed_ip !== null) {
        payload.fixed_ip = fixed_ip;
      }
    }

    return this._request('/api/s/<SITE>/rest/user/' + client_id.trim(), payload, 'PUT');
  }

  /**
   * Update client name (using REST) - edit_client_name()
   *
   * @param string $client_id   _id value for the client
   * @param bool   $name of the client
   * @return array|false returns an array containing a single object with attributes of the updated client on success
   */
  editClientName(client_id, name) {
    const payload = {
      _id: client_id,
      name,
    };

    return this._request('/api/s/<SITE>/rest/user/' + client_id.trim(), payload, 'PUT');
  }

  /**
   * Fetch user groups - list_usergroups()
   *
   */
  getUserGroups() {
    return this._request('/api/s/<SITE>/list/usergroup');
  }

  /**
   * Create user group (using REST) - create_usergroup()
   *
   * returns an array containing a single object with attributes of the new usergroup ("_id", "name", "qos_rate_max_down", "qos_rate_max_up", "site_id") on success
   *
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  createUserGroup(group_name, group_dn = -1, group_up = -1) {
    const payload = {
      name: group_name,
      qos_rate_max_down: group_dn,
      qos_rate_max_up: group_up,
    };

    return this._request('/api/s/<SITE>/rest/usergroup', payload);
  }

  /**
   * Modify user group (using REST) - edit_usergroup()
   *
   * returns an array containing a single object with attributes of the updated usergroup on success
   *
   * required parameter <group_id>   = _id of the user group
   * required parameter <site_id>    = _id of the site
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  editUserGroup(group_id, site_id, group_name, group_dn = -1, group_up = -1) {
    const payload = {
      _id: group_id,
      site_id,
      name: group_name,
      qos_rate_max_down: group_dn,
      qos_rate_max_up: group_up,
    };

    return this._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), payload, 'PUT');
  }

  /**
   * Delete user group (using REST) - delete_usergroup()
   *
   * returns true on success
   *
   * required parameter <group_id> = _id value of the user group to delete
   *
   */
  deleteUserGroup(group_id) {
    return this._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), null, 'DELETE');
  }

  /**
   * Fetch AP groups - list_apgroups()
   *
   * @return array  containing the current AP groups on success
   */
  getAPGroups() {
    return this._request('/v2/api/site/<SITE>/apgroups');
  }

  /**
   * Create AP group - create_apgroup()
   *
   * @param  string $group_name  name to assign to the AP group
   * @param  array  $device_macs optional, array containing the MAC addresses (strings) of the APs to add to the new group
   * @return object              returns a single object with attributes of the new AP group on success
   *
   */
  createAPGroup(group_name, device_macs = []) {
    const payload = {
      device_macs,
      name: group_name,
    };

    return this._request('/v2/api/site/<SITE>/apgroups', payload);
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
  editAPGroup(group_id, group_name, device_macs) {
    const payload = {
      _id: group_id,
      attr_no_delete: false,
      name: group_name,
      device_macs,
    };

    return this._request('/v2/api/site/<SITE>/apgroups/' + group_id.trim(), payload, 'PUT');
  }

  /**
   * Delete AP group - delete_apgroup()
   *
   * @param  string $group_id _id value of the AP group to delete
   * @return bool             returns true on success
   *
   */
  deleteAPGroup(group_id) {
    return this._request('/v2/api/site/<SITE>/apgroups/' + group_id.trim(), null, 'DELETE');
  }

  /**
   * List firewall groups (using REST) - list_firewallgroups()
   *
   * returns an array containing the current firewall groups or the selected firewall group on success
   * optional parameter <group_id> = _id value of the single firewall group to list
   */
  getFirewallGroups(group_id = '') {
    return this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim());
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
  createFirewallGroup(group_name, group_type, group_members = []) {
    const payload = {
      name: group_name,
      group_type,
      group_members,
    };

    return this._request('/api/s/<SITE>/rest/firewallgroup', payload);
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
  editFirewallGroup(group_id, site_id, group_name, group_type, group_members = []) {
    const payload = {
      _id: group_id,
      name: group_name,
      group_type,
      group_members,
      site_id,
    };

    return this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), payload, 'PUT');
  }

  /**
   * Delete firewall group (using REST) - delete_firewallgroup()
   *
   * returns true on success
   * required parameter <group_id> = _id value of the firewall group to delete
   */
  deleteFirewallGroup(group_id) {
    return this._request('/api/s/<SITE>/rest/firewallgroup/' + group_id.trim(), null, 'DELETE');
  }

  /**
   * List firewall rules (using REST) - list_firewallrules()
   *
   * returns an array containing the current firewall rules on success
   */
  getFirewallRules() {
    return this._request('/api/s/<SITE>/rest/firewallrule');
  }

  /**
   * List static routing settings (using REST) - list_routing()
   *
   * returns an array of static routes and their settings
   * optional parameter <route_id> = string; _id value of the static route to get settings for
   */
  getRouting(route_id = '') {
    return this._request('/api/s/<SITE>/rest/routing/' + route_id.trim());
  }

  /**
   * List health metrics - list_health()
   *
   */
  getHealth() {
    return this._request('/api/s/<SITE>/stat/health');
  }

  /**
   * List dashboard metrics - list_dashboard()
   *
   * returns an array of dashboard metric objects (available since controller version 4.9.1.alpha)
   * optional parameter <five_minutes> = boolean; if true, return stats based on 5 minute intervals,
   *                                     returns hourly stats by default (supported on controller versions 5.5.* and higher)
   */
  getDashboard(five_minutes = false) {
    const path_suffix = five_minutes === true ? '?scale=5minutes' : '';

    return this._request('/api/s/<SITE>/stat/dashboard' + path_suffix);
  }

  /**
   * List client devices - list_users()
   *
   * returns an array of known client device objects
   */
  getUsers() {
    return this._request('/api/s/<SITE>/list/user');
  }

  /**
   * List of site devices with a basic subset of fields (e.g., mac, state, adopted, disabled, type, model, name) - list_devices_basic()
   *
   * returns an array containing known UniFi device objects)
   */
  getAccessDevicesBasic() {
    return this._request('/api/s/<SITE>/stat/device-basic');
  }

  /**
   * List access points and other devices under management of the controller (USW and/or USG devices) - list_devices()
   *
   * optional paramater <device_mac> = the MAC address of a single device for which the call must be made
   */
  getAccessDevices(device_mac = '') {
    return this._request('/api/s/<SITE>/stat/device/' + device_mac.trim().toLowerCase());
  }

  /**
   * List (device) tags (using REST) - list_tags()
   *
   * returns an array of known device tag objects
   *
   * NOTES: this endpoint was introduced with controller versions 5.5.X
   */
  listTags() {
    return this._request('/api/s/<SITE>/rest/tag');
  }

  /**
   * List rogue/neighboring access points - list_rogueaps()
   *
   * returns an array of rogue/neighboring access point objects
   * optional parameter <within> = hours to go back to list discovered "rogue" access points (default = 24 hours)
   *
   */
  getRogueAccessPoints(within = 24) {
    return this._request('/api/s/<SITE>/stat/rogueap', {within});
  }

  /**
   * List known rogue access points - list_known_rogueaps()
   *
   * returns an array of known rogue access point objects
   */
  getKnownRogueAccessPoints() {
    return this._request('/api/s/<SITE>/rest/rogueknown');
  }

  /**
   * Generate a backup - generate_backup()
   *
   * returns a URL from where the backup file can be downloaded once generated
   *
   * NOTES: this is an experimental function, please do not use unless you know
   * exactly what you're doing
   */
  generateBackup() {
    return this._request('/api/s/<SITE>/cmd/backup', {cmd: 'backup'});
  }

  /**
   * List auto backups - list_backups()
   *
   * return an array containing objects with backup details on success
   */
  getBackups() {
    return this._request('/api/s/<SITE>/cmd/backup', {cmd: 'list-backups'});
  }

  /**
   * Generate a backup/export of the current site - generate_backup_site()
   *
   * NOTES: this is an experimental function, please do not use unless you know
   * exactly what you're doing
   */
  generateBackupSite() {
    return this._request('/api/s/<SITE>/cmd/backup', {cmd: 'export-site'});
  }

  /**
   * Delete a backup file
   *
   * return true on success
   * required parameter <filename> = string; filename of backup to delete
   */
  deleteBackup(filename) {
    return this._request('/api/s/<SITE>/cmd/backup', {cmd: 'delete-backup', filename});
  }

  /**
   * List sites
   *
   * calls callback function(err, result) with an array of the sites
   * registered to the UniFi controller
   */
  getSites() {
    return this._request('/api/self/sites');
  }

  /**
   * List sites stats
   *
   * calls callback function(err, result) with an array of sysinfo information
   * for all sites registered to the UniFi controller
   *
   * NOTES: endpoint was introduced with controller version 5.2.9
   */
  getSitesStats() {
    return this._request('/api/stat/sites');
  }

  /**
   * Create a site - create_site()
   *
   * required parameter <description> = the long name for the new site
   *
   * NOTES: immediately after being added, the new site is available in the output of the "list_sites" function
   */
  createSite(description) {
    const payload = {
      desc: description,
      cmd: 'add-site',
    };

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
  }

  /**
   * Delete a site - delete_site()
   *
   * return true on success
   * required parameter <site_id> = 24 char string; _id value of the site to delete
   *
   */
  deleteSite(site_id) {
    const payload = {
      site: site_id,
      cmd: 'delete-site',
    };

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
  }

  /**
   * Change the current site's name - set_site_name()
   *
   * return true on success
   * required parameter <site_name> = string; the new long name for the current site
   *
   * NOTES: immediately after being changed, the site is available in the output of the list_sites() function
   */
  setSiteName(site_name) {
    const payload = {
      desc: site_name,
      cmd: 'update-site',
    };

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
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
  setSiteCountry(country_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/country/' + country_id.trim(), payload, 'PUT');
  }

  /**
   * Set site locale - set_site_locale()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "locale" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteLocale(locale_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/locale/' + locale_id.trim(), payload, 'PUT');
  }

  /**
   * Set site snmp - set_site_snmp()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "snmp" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteSNMP(snmp_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/snmp/' + snmp_id.trim(), payload, 'PUT');
  }

  /**
   * Set site mgmt - set_site_mgmt()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "mgmt" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteMgmt(mgmt_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/mgmt/' + mgmt_id.trim(), payload, 'PUT');
  }

  /**
   * Set site guest access - set_site_guest_access()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "guest_access" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteGuestAccess(guest_access_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/guest_access/' + guest_access_id.trim(), payload, 'PUT');
  }

  /**
   * Set site ntp - set_site_ntp()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "ntp" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteNTP(ntp_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/ntp/' + ntp_id.trim(), payload, 'PUT');
  }

  /**
   * Set site connectivity - set_site_connectivity()
   *
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "connectivity" key.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   * return true on success
   */
  setSiteConnectivity(connectivity_id, payload) {
    return this._request('/api/s/<SITE>/rest/setting/connectivity/' + connectivity_id.trim(), payload, 'PUT');
  }

  /**
   * Fetch admins - list_admins()
   *
   * @return array  containing administrator objects for selected site
   */
  listAdmins() {
    return this._request('/api/s/<SITE>/cmd/sitemgr', {cmd: 'get-admins'});
  }

  /**
   * Fetch all admins - list_all_admins()
   *
   * @return array  containing administrator objects for all sites
   */
  listAllAdmins() {
    return this._request('/api/stat/admin');
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
  inviteAdmin(name, email, enable_sso = true, readonly = false, device_adopt = false, device_restart = false) {
    const payload = {
      name: name.trim(),
      email: email.trim(),
      for_sso: enable_sso,
      cmd: 'invite-admin',
      role: 'admin',
    };

    if (readonly === true) {
      payload.role = 'readonly';
    }

    const permissions = [];
    if (device_adopt === true) {
      permissions.push('API_DEVICE_ADOPT');
    }

    if (device_restart === true) {
      permissions.push('API_DEVICE_RESTART');
    }

    payload.permissions = permissions;

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
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
  assignExistingAdmin(admin_id, readonly = false, device_adopt = false, device_restart = false) {
    const payload = {
      cmd: 'grant-admin',
      admin: admin_id.trim(),
      role: 'admin',
    };

    if (readonly === true) {
      payload.role = 'readonly';
    }

    const permissions = [];
    if (device_adopt === true) {
      permissions.push('API_DEVICE_ADOPT');
    }

    if (device_restart === true) {
      permissions.push('API_DEVICE_RESTART');
    }

    payload.permissions = permissions;

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
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
  revokeAdmin(admin_id) {
    return this._request('/api/s/<SITE>/cmd/sitemgr', {cmd: 'revoke-admin', admin: admin_id});
  }

  /**
   * Fetch wlan_groups - list_wlan_groups()
   *
   * @return array  containing known wlan_groups
   */
  getWLanGroups() {
    return this._request('/api/s/<SITE>/list/wlangroup');
  }

  /**
   * Fetch sysinfo - stat_sysinfo()
   *
   * @return array  containing known sysinfo data
   */
  getSiteSysinfo() {
    return this._request('/api/s/<SITE>/stat/sysinfo');
  }

  /**
   * Fetch controller status - stat_status()
   *
   * NOTES:
   * login not required
   *
   * @return bool true upon success (controller is online)
   */
  getStatus() {
    return this._request('/status', {});
  }

  /**
   * Fetch full controller status - stat_full_status()
   *
   * NOTES:
   * login not required
   *
   * @return bool|array  staus array upon success, false upon failure
   */
  async getFullStatus() {
    const result = await this._request('/status', {}, null, true);
    if (result === null) {
      throw new Error('false');
    } else {
      return result;
    }
  }

  /**
   * Fetch device name mappings - list_device_name_mappings()
   *
   * NOTES:
   * login not required
   *
   * @return bool|array  mappings array upon success, false upon failure
   */
  async getDeviceNameMappings() {
    const result = await this._request('/dl/firmware/bundles.json', {}, null, true);
    if (result === null) {
      throw new Error('false');
    } else {
      return result;
    }
  }

  /**
   * Fetch self - list_self()
   *
   * @return array  containing information about the logged in user
   */
  getSelf() {
    return this._request('/api/s/<SITE>/self');
  }

  /**
   * Fetch vouchers - stat_voucher()
   *
   * @param  int   $create_time optional, create time of the vouchers to fetch in Unix timestamp in seconds
   * @return array              containing hotspot voucher objects
   */
  getVouchers(create_time = null) {
    const payload = {};
    if (create_time !== null) {
      payload.create_time = create_time;
    }

    return this._request('/api/s/<SITE>/stat/voucher', payload);
  }

  /**
   * List payments - stat_payment()
   *
   * returns an array of hotspot payments
   */
  getPayments(within = null) {
    within = within === null ? '' : '?within=' + within.trim();

    return this._request('/api/s/<SITE>/stat/payment' + within);
  }

  /**
   * Create hotspot operator (using REST) - create_hotspotop()
   *
   * required parameter <name>       = name for the hotspot operator
   * required parameter <x_password> = clear text password for the hotspot operator
   * optional parameter <note>       = note to attach to the hotspot operator
   */
  createHotspotOperator(name, x_password, note = null) {
    const payload = {
      name,
      x_password,
    };

    if (note !== null) {
      payload.note = note.trim();
    }

    return this._request('/api/s/<SITE>/rest/hotspotop', payload);
  }

  /**
   * Fetch hotspot operators (using REST) - list_hotspotop()
   *
   * @return array  containing hotspot operators
   */
  getHotspotOperators() {
    return this._request('/api/s/<SITE>/rest/hotspotop');
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
  createVouchers(minutes, count = 1, quota = 0, note = null, up = null, down = null, megabytes = null) {
    const payload = {
      cmd: 'create-voucher',
      expire: minutes,
      n: count,
      quota,
    };

    if (note !== null) {
      payload.note = note.trim();
    }

    if (up !== null) {
      payload.up = up;
    }

    if (down !== null) {
      payload.down = down;
    }

    if (megabytes !== null) {
      payload.bytes = megabytes;
    }

    return this._request('/api/s/<SITE>/cmd/hotspot', payload);
  }

  /**
   * Revoke voucher - revoke_voucher()
   *
   * return TRUE on success
   *
   * required parameter <voucher_id> = 24 char string; _id value of the voucher to revoke
   */
  revokeVoucher(voucher_id) {
    const payload = {
      cmd: 'delete-voucher',
      _id: voucher_id,
    };

    return this._request('/api/s/<SITE>/cmd/hotspot', payload);
  }

  /**
   * Extend guest validity - extend_guest_validity()
   *
   * return TRUE on success
   *
   * required parameter <guest_id> = 24 char string; _id value of the guest to extend validity
   */
  extendGuestValidity(guest_id) {
    const payload = {
      cmd: 'extend',
      _id: guest_id,
    };

    return this._request('/api/s/<SITE>/cmd/hotspot', payload);
  }

  /**
   * Fetch port forwarding stats - list_portforward_stats()
   *
   * @return array  containing port forwarding stats
   */
  getPortForwardingStats() {
    return this._request('/api/s/<SITE>/stat/portforward');
  }

  /**
   * Fetch DPI stats - list_dpi_stats()
   *
   * @return array  containing DPI stats
   */
  getDPIStats() {
    return this._request('/api/s/<SITE>/stat/dpi');
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
  getFilteredDPIStats(type = 'by_cat', cat_filter = null) {
    const payload = {type};

    if (cat_filter !== null && type === 'by_app') {
      payload.cats = cat_filter;
    }

    return this._request('/api/s/<SITE>/stat/sitedpi', payload);
  }

  /**
   * Clear DPI stats
   *
   * clears stats of DPI
   */
  clearDPIStatus() {
    return this._request('/api/s/<SITE>/cmd/stat', {cmd: 'clear-dpi'});
  }

  /**
   * Fetch current channels - list_current_channels()
   *
   * @return array  containing currently allowed channels
   */
  getCurrentChannels() {
    return this._request('/api/s/<SITE>/stat/current-channel');
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
  getCountryCodes() {
    return this._request('/api/s/<SITE>/stat/ccode');
  }

  /**
   * Fetch port forwarding settings - list_portforwarding()
   *
   * @return array  containing port forwarding settings
   */
  getPortForwarding() {
    return this._request('/api/s/<SITE>/list/portforward');
  }

  /**
   * Set port forwarding rule - set_port_forwarding()
   *
   * required parameter <rule_id> = id of port forwarding rule retrieved by getPortForwarding
   * required parameter <enable>  = enable (true) or disable (false) rule
   *
   * @return true on success
   */
  setPortForwarding(rule_id, enable) {
    return this._request('/api/s/<SITE>/rest/portforward/' + rule_id.trim(), {enabled: enable}, 'PUT');
  }

  /**
   * Fetch dynamic DNS settings - list_dynamicdns()
   *
   * @return array  containing dynamic DNS settings
   */
  getDynamicDNS() {
    return this._request('/api/s/<SITE>/list/dynamicdns');
  }

  /**
   * Create dynamic DNS settings, base (using REST) - create_dynamicdns()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the site, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_dynamicdns() for the site.
   */
  createDynamicDNS(payload) {
    return this._request('/api/s/<SITE>/rest/dynamicdns', payload);
  }

  /**
   * Update site dynamic DNS, base (using REST) - set_dynamicdns
   *
   * return true on success
   * required parameter <dynamicdns_id> = 24 char string; _id of the settings which can be found with the list_dynamicdns() function
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the site, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_dynamicdns() for the site.
   */
  setDynamicDNS(dynamicdns_id, payload) {
    return this._request('/api/s/<SITE>/rest/dynamicdns/' + dynamicdns_id.trim(), payload, 'PUT');
  }

  /**
   * Fetch port configurations - list_portconf()
   *
   * @return array  containing port configurations
   */
  getPortConfig() {
    return this._request('/api/s/<SITE>/list/portconf');
  }

  /**
   * Fetch VoIP extensions - list_extensions()
   *
   * @return array  containing VoIP extensions
   */
  getVoipExtensions() {
    return this._request('/api/s/<SITE>/list/extension');
  }

  /**
   * Fetch site settings - list_settings()
   *
   * @return array  containing site configuration settings
   */
  getSiteSettings() {
    return this._request('/api/s/<SITE>/get/setting');
  }

  /**
   * Adopt a device to the selected site - adopt_device()
   *
   * required parameter <mac> = device MAC address
   */
  adoptDevice(mac) {
    const payload = {
      cmd: 'adopt',
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Adopt a device using custom SSH credentials - advanced_adopt_device()
   *
   * @param string $mac            device MAC address
   * @param string $ip             IP to use for SSH connection
   * @param string $username       SSH username
   * @param string $password       SSH password
   * @param string $url            inform URL to point the device to
   * @param int    $port           optional, SSH port
   * @param bool   $ssh_key_verify optional, whether to verify device SSH key
   * @return bool true on success
   */
  advancedAdoptDevice(mac, ip, username, password, url, port = 22, ssh_key_verify = true) {
    const payload = {
      cmd: 'adv-adopt',
      mac: mac.toLowerCase(),
      ip,
      username,
      password,
      url,
      port,
      sshKeyVerify: ssh_key_verify,
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Reboot a device - restart_device()
   *
   * @param string $mac         device MAC address
   * @param string $reboot_type optional, two options: 'soft' or 'hard', defaults to soft
   *                            soft can be used for all devices, requests a plain restart of that device
   *                            hard is special for PoE switches and besides the restart also requests a
   *                            power cycle on all PoE capable ports. Keep in mind that a 'hard' reboot
   *                            does *NOT* trigger a factory-reset.
   * @return bool true on success
   */
  restartDevice(mac, reboot_type = 'soft') {
    const payload = {
      cmd: 'restart',
      mac: mac.toLowerCase(),
      reboot_type: reboot_type.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Force provision of a device - force_provision()
   *
   * return true on success
   * required parameter <mac> = device MAC address
   */
  forceProvision(mac) {
    const payload = {
      cmd: 'force-provision',
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Reboot a UniFi CloudKey - reboot_cloudkey()
   *
   * return true on success
   *
   * This API call does nothing on UniFi controllers *not* running on a UniFi CloudKey device
   */
  rebootCloudKey() {
    return this._request('/api/s/<SITE>/cmd/system', {cmd: 'reboot'});
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
  disableAccessPoint(ap_id, disable) {
    return this._request('/api/s/<SITE>/rest/device/' + ap_id.trim(), {disabled: disable}, 'PUT');
  }

  /**
   * Override LED mode for a device (using REST) - led_override()
   *
   * required parameter <device_id>     = 24 char string; value of _id for the device which can be obtained from the device list
   * required parameter <override_mode> = string, off/on/default; "off" disables the LED of the device,
   *                                      "on" enables the LED of the device,
   *                                      "default" applies the site-wide setting for device LEDs
   */
  setLEDOverride(device_id, override_mode) {
    return this._request('/api/s/<SITE>/rest/device/' + device_id.trim(), {led_override: override_mode}, 'PUT');
  }

  /**
   * Toggle flashing LED of an access point for locating purposes - locate_ap()
   *
   * required parameter <mac> = device MAC address
   * required parameter <enable> = boolean; true enables flashing LED, false disables
   */
  setLocateAccessPoint(mac, enable) {
    const payload = {
      cmd: enable === true ? 'set-locate' : 'unset-locate',
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Toggle LEDs of all the access points ON or OFF - site_leds()
   *
   * required parameter <enable> = boolean; true switches LEDs of all the access points ON, false switches them OFF
   */
  setSiteLEDs(enable) {
    return this._request('/api/s/<SITE>/set/setting/mgmt', {led_enabled: enable});
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
  setAccessPointRadioSettings(ap_id, radio, channel, ht, tx_power_mode, tx_power) {
    const payload = {
      radio_table: [{
        radio,
        channel,
        ht,
        tx_power_mode,
        tx_power,
      }],
    };

    return this._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), payload);
  }

  /**
   * Assign access point to another WLAN group - set_ap_wlangroup()
   *
   * return true on success
   * required parameter <type_id>   = string; WLAN type, can be either 'ng' (for WLANs 2G (11n/b/g)  ) or 'na' (WLANs 5G (11n/a/ac))
   * required parameter <device_id> = string; _id value of the access point to be modified
   * required parameter <group_id>  = string; _id value of the WLAN group to assign device to
   */
  setAccessPointWLanGroup(type_id, device_id, group_id) {
    const payload = {wlan_overrides: {}};

    if (type_id === 'ng') {
      payload.wlangroup_id_ng = group_id;
    } else if (type_id === 'na') {
      payload.wlangroup_id_na = group_id;
    }

    return this._request('/api/s/<SITE>/upd/device/' + device_id.trim(), payload);
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
  setGuestLoginSettings(portal_enabled, portal_customized, redirect_enabled, redirect_url, x_password, expire_number, expire_unit, section_id) {
    const payload = {
      portal_enabled,
      portal_customized,
      redirect_enabled,
      redirect_url,
      x_password,
      expire_number,
      expire_unit,
      _id: section_id,
    };

    return this._request('/api/s/<SITE>/set/setting/guest_access/' + section_id.trim(), payload);
  }

  /**
   * Update guest login settings, base - set_guestlogin_settings_base()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the guest login, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "guest_access" section.
   */
  setGuestLoginSettingsBase(payload, section_id = '') {
    if (section_id !== '') {
      section_id = '/' + section_id;
    }

    return this._request('/api/s/<SITE>/set/setting/guest_access' + section_id.trim(), payload);
  }

  /**
   * Update IPS/IDS settings, base - set_ips_settings_base()
   *
   * return true on success
   * required parameter <payload> = stdClass object or associative array containing the IPS/IDS settings to apply, must be a (partial)
   *                                object/array structured in the same manner as is returned by list_settings() for the "ips" section.
   */
  setIPSSettingsBase(payload) {
    return this._request('/api/s/<SITE>/set/setting/ips', payload);
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
  setSuperMgmtSettingsBase(settings_id, payload) {
    return this._request('/api/s/<SITE>/set/setting/super_mgmt/' + settings_id.trim(), payload);
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
  setSuperSMTPSettingsBase(settings_id, payload) {
    return this._request('/api/s/<SITE>/set/setting/super_smtp/' + settings_id.trim(), payload);
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
  setSuperIdentitySettingsBase(settings_id, payload) {
    return this._request('/api/s/<SITE>/set/setting/super_identity/' + settings_id.trim(), payload);
  }

  /**
   * Rename access point - rename_ap()
   *
   * required parameter <ap_id>  = value of _id for the access point which can be obtained from the device list
   * required parameter <apname> = New name
   *
   */
  renameAccessPoint(ap_id, apname) {
    return this._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), {name: apname});
  }

  /**
   * Move a device to another site - move_device()
   *
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   * required parameter <site_id> = 24 char string; _id of the site to move the device to
   */
  moveDevice(mac, site_id) {
    const payload = {
      site: site_id,
      mac: mac.toLowerCase(),
      cmd: 'move-device',
    };

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
  }

  /**
   * Delete a device from the current site - delete_device()
   *
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   */
  deleteDevice(mac) {
    const payload = {
      mac: mac.toLowerCase(),
      cmd: 'delete-device',
    };

    return this._request('/api/s/<SITE>/cmd/sitemgr', payload);
  }

  /**
   * List network settings (using REST) - list_networkconf()
   *
   * returns an array of (non-wireless) networks and their settings
   * optional parameter <network_id> = string; _id value of the network to get settings for
   */
  getNetworkConf(network_id = null) {
    if (network_id === null) {
      network_id = '';
    }

    return this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim());
  }

  /**
   * Create a network (using REST) - create_network()
   *
   * return an array with a single object containing details of the new network on success, else return false
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_networkconf() for the specific network type.
   *                                Do not include the _id property, it is assigned by the controller and returned upon success.
   */
  createNetwork(payload) {
    return this._request('/api/s/<SITE>/rest/networkconf', payload);
  }

  /**
   * Update network settings, base (using REST) - set_networksettings_base()
   *
   * return true on success
   * required parameter <network_id> = the "_id" value for the network you wish to update
   * required parameter <payload>    = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                   object/array structured in the same manner as is returned by list_networkconf() for the network.
   */
  setNetworkSettingsBase(network_id, payload) {
    return this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), payload, 'PUT');
  }

  /**
   * Delete a network (using REST) - delete_network()
   *
   * return true on success
   * required parameter <network_id> = 24 char string; _id value of the network which can be found with the list_networkconf() function
   */
  deleteNetwork(network_id) {
    return this._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), 'DELETE');
  }

  /**
   * List wlan settings (using REST) - list_wlanconf()
   *
   * returns an array of wireless networks and their settings, or an array containing a single wireless network when using
   * the <wlan_id> parameter
   * optional parameter <wlan_id> = 24 char string; _id value of the wlan to fetch the settings for
   */
  getWLanSettings(wlan_id = null) {
    if (wlan_id === null) {
      wlan_id = '';
    }

    return this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim());
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
   * @param  string  $wpa_encode          optional, encryption (auto, ccmp)
   * @param  boolean $vlan_enabled     optional, enable/disable vlan for this wlan
   * @param  int     $vlan             optional, vlan id
   * @param  boolean $uapsd_enabled    optional, enable/disable Unscheduled Automatic Power Save Delivery
   * @param  boolean $schedule_enabled optional, enable/disable wlan schedule
   * @param  array   $schedule         optional, schedule rules
   * @param  array   $ap_group_ids     optional, array of ap group ids, required for UniFi controller versions 6.0.X and higher
   * @return bool                      true on success
   */
  createWLan(
    name, x_passphrase, usergroup_id, wlangroup_id,
    enabled = true, hide_ssid = false, is_guest = false, security = 'open', wpa_mode = 'wpa2', wpa_encode = 'ccmp',
    vlan_enabled = false, vlan = null, uapsd_enabled = false, schedule_enabled = false, schedule = {}, ap_group_ids = null,
  ) {
    const payload = {
      name,
      usergroup_id,
      wlangroup_id,
      enabled,
      hide_ssid,
      is_guest,
      security,
      wpa_mode,
      wpa_enc: wpa_encode,
      vlan_enabled,
      uapsd_enabled,
      schedule_enabled,
      schedule,
    };

    if (vlan !== null && vlan_enabled === true) {
      payload.vlan = vlan;
    }

    if (x_passphrase !== '' && security !== 'open') {
      payload.x_passphrase = x_passphrase;
    }

    if (ap_group_ids !== null) {
      payload.ap_group_ids = ap_group_ids;
    }

    return this._request('/api/s/<SITE>/add/wlanconf/', payload);
  }

  /**
   * Update wlan settings, base (using REST) - set_wlansettings_base()
   *
   * return true on success
   * required parameter <wlan_id> = the "_id" value for the WLAN you wish to update
   * required parameter <payload> = stdClass object or associative array containing the configuration to apply to the wlan, must be a
   *                                (partial) object/array structured in the same manner as is returned by list_wlanconf() for the wlan.
   */
  setWLanSettingsBase(wlan_id, payload) {
    return this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), payload, 'PUT');
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
  setWLanSettings(wlan_id, x_passphrase = null, name = null) {
    const payload = {};

    if (x_passphrase !== null) {
      payload.x_passphrase = x_passphrase.trim();
    }

    if (name !== null) {
      payload.name = name.trim();
    }

    return this.setWLanSettingsBase(wlan_id, payload);
  }

  /**
   * Disable/Enable wlan - disable_wlan()
   *
   * required parameter <wlan_id>
   * required parameter <disable> = boolean; true disables the wlan, false enables it
   *
   */
  disableWLan(wlan_id, disable) {
    const payload = {enabled: disable !== true};

    return this.setWLanSettingsBase(wlan_id, payload);
  }

  /**
   * Delete a wlan (using REST) - delete_wlan()
   *
   * required parameter <wlan_id> = 24 char string; _id of the wlan that can be found with the list_wlanconf() function
   */
  deleteWLan(wlan_id) {
    return this._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), {}, 'DELETE');
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
  setWLanMacFilter(wlan_id, mac_filter_policy, mac_filter_enabled, macs) {
    const payload = {
      mac_filter_enabled,
      mac_filter_policy,
      mac_filter_list: macs,
    };

    return this.setWLanSettingsBase(wlan_id, payload);
  }

  /**
   * List events - list_events()
   *
   * optional parameter <historyhours> = hours to go back, default value is 720 hours
   * optional parameter <start>        = which event number to start with (useful for paging of results), default value is 0
   * optional parameter <limit>        = number of events to return, default value is 3000
   */
  getEvents(historyhours = 720, start = 0, limit = 3000) {
    const payload = {
      _sort: '-time',
      within: historyhours,
      type: null,
      _start: start,
      _limit: limit,
    };

    return this._request('/api/s/<SITE>/stat/event', payload);
  }

  /**
   * List alarms - list_alarms()
   *
   * optional parameter <payload> = json payload of flags to filter by
   *                                Example: {archived: 'false', key: 'EVT_GW_WANTransition'}
   *                                return only unarchived for a specific key
   */
  getAlarms(payload = null) {
    return this._request('/api/s/<SITE>/stat/alarm', payload);
  }

  /**
   * Count alarms - count_alarms()
   *
   * @param  bool  $archived optional, if true all alarms are counted, if false only non-archived (active) alarms are counted,
   *                         by default all alarms are counted
   * @return array           containing the alarm count
   */
  countAlarms(archived = true) {
    return this._request('/api/s/<SITE>/cnt/alarm' + (archived === true ? '' : '?archived=false'));
  }

  /**
   * Archive alarms(s) - archive_alarm()
   *
   * @param  string $alarm_id optional, _id of the alarm to archive which can be found with the list_alarms() function,
   *                          by default all alarms are archived
   * @return bool             true on success
   */
  archiveAlarms(alarm_id = null) {
    const payload = {};
    if (alarm_id === null) {
      payload.cmd = 'archive-all-alarms';
    } else {
      payload.cmd = 'archive-alarm';
      payload._id = alarm_id;
    }

    return this._request('/api/s/<SITE>/cmd/evtmgr', payload);
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
  checkControllerUpdate() {
    return this._request('/api/s/<SITE>/stat/fwupdate/latest-version');
  }

  /**
   * Check firmware update - check_firmware_update()
   *
   * NOTE:
   * triggers a Device Firmware Update in Classic Settings > System settings > Maintenance
   *
   * @return bool returns true upon success
   */
  checkFirmwareUpdate() {
    return this._request('/api/s/<SITE>/cmd/productinfo', {cmd: 'check-firmware-update'});
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
  upgradeDevice(device_mac) {
    return this._request('/api/s/<SITE>/cmd/devmgr/upgrade', {mac: device_mac.toLowerCase()});
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
  upgradeDeviceExternal(firmware_url, device_mac) {
    return this._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', {url: firmware_url, mac: device_mac.toLowerCase()});
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
  startRollingUpgrade() {
    return this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'set-rollupgrade'});
  }

  /**
   * Cancel rolling upgrade - cancel_rolling_upgrade()
   *
   * return true on success
   */
  cancelRollingUpgrade() {
    return this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'unset-rollupgrade'});
  }

  /**
   * Fetch firmware versions - list_firmware()
   *
   * @param  string $type optional, "available" or "cached", determines which firmware types to return,
   *                      default value is "available"
   * @return array        containing firmware versions
   */
  getFirmware(type = 'available') {
    return this._request('/api/s/<SITE>/cmd/firmware', {cmd: 'list-' + type});
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
  powerCycleSwitchPort(switch_mac, port_index) {
    const payload = {
      mac: switch_mac.toLowerCase(),
      port_idx: port_index,
      cmd: 'power-cycle',
    };

    return this._request('/api/s/<SITE>/cmd/devmgr', payload);
  }

  /**
   * Trigger an RF scan by an AP
   *
   * return true on success
   * required parameter <ap_mac> = MAC address of the AP
   */
  runSpectrumScan(ap_mac) {
    return this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'spectrum-scan', mac: ap_mac.toLowerCase()});
  }

  /**
   * Trigger a speedtest on a USG
   *
   * return true on success
   */
  runSpeedTest() {
    return this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest'});
  }

  /**
   * Get the current state of a running speedtest on a USG
   *
   * returns status of speedtest
   */
  getSpeedTestStatus() {
    return this._request('/api/s/<SITE>/cmd/devmgr', {cmd: 'speedtest-status'});
  }

  /**
   * Check the RF scanning state of an AP - spectrum_scan_state()
   *
   * returns an object with relevant information (results if available) regarding the RF scanning state of the AP
   * required parameter <ap_mac> = MAC address of the AP
   */
  getSpectrumScanState(ap_mac) {
    return this._request('/api/s/<SITE>/stat/spectrum-scan/' + ap_mac.trim().toLowerCase());
  }

  /**
   * Update device settings, base (using REST) - set_device_settings_base()
   *
   * required parameter <device_id> = 24 char string; _id of the device which can be found with the list_devices() function
   * required parameter <payload>   = stdClass object or associative array containing the configuration to apply to the device, must be a
   *                                  (partial) object/array structured in the same manner as is returned by list_devices() for the device.
   */
  setDeviceSettingsBase(device_id, payload) {
    return this._request('/api/s/<SITE>/rest/device/' + device_id.trim(), payload, 'PUT');
  }

  /**
   * List Radius profiles (using REST) - list_radius_profiles()
   *
   * returns an array of objects containing all Radius profiles for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  listRadiusProfiles() {
    return this._request('/api/s/<SITE>/rest/radiusprofile');
  }

  /**
   * List Radius user accounts (using REST) - list_radius_accounts()
   *
   * returns an array of objects containing all Radius accounts for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  listRadiusAccounts() {
    return this._request('/api/s/<SITE>/rest/account');
  }

  /**
   * Create a Radius user account (using REST) - create_radius_account()
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   *
   * @param  string $name               name for the new account
   * @param  string $x_password         password for the new account
   * @param  int    $tunnel_type        optional, must be one of the following values:
   *                                    1      Point-to-Point Tunneling Protocol (PPTP)
   *                                    2      Layer Two Forwarding (L2F)
   *                                    3      Layer Two Tunneling Protocol (L2TP)
   *                                    4      Ascend Tunnel Management Protocol (ATMP)
   *                                    5      Virtual Tunneling Protocol (VTP)
   *                                    6      IP Authentication Header in the Tunnel-mode (AH)
   *                                    7      IP-in-IP Encapsulation (IP-IP)
   *                                    8      Minimal IP-in-IP Encapsulation (MIN-IP-IP)
   *                                    9      IP Encapsulating Security Payload in the Tunnel-mode (ESP)
   *                                    10     Generic Route Encapsulation (GRE)
   *                                    11     Bay Dial Virtual Services (DVS)
   *                                    12     IP-in-IP Tunneling
   *                                    13     Virtual LANs (VLAN)
   * @param  int    $tunnel_medium_type optional, must be one of the following values:
   *                                    1      IPv4 (IP version 4)
   *                                    2      IPv6 (IP version 6)
   *                                    3      NSAP
   *                                    4      HDLC (8-bit multidrop)
   *                                    5      BBN 1822
   *                                    6      802 (includes all 802 media plus Ethernet "canonical format")
   *                                    7      E.163 (POTS)
   *                                    8      E.164 (SMDS, Frame Relay, ATM)
   *                                    9      F.69 (Telex)
   *                                    10     X.121 (X.25, Frame Relay)
   *                                    11     IPX
   *                                    12     Appletalk
   *                                    13     Decnet IV
   *                                    14     Banyan Vines
   *                                    15     E.164 with NSAP format subaddress
   * @param  int    $vlan               optional, VLAN to assign to the account
   * @return array                      containing a single object for the newly created account upon success, else returns false
   * @return bool|array                 containing a single object for the newly created account upon success, else returns false
   */
  createRadiusAccount(name, x_password, tunnel_type = null, tunnel_medium_type = null, vlan = null) {
    const payload = {
      name,
      x_password,
    };

    if (tunnel_type !== null) {
      payload.tunnel_type = tunnel_type;
    }

    if (tunnel_medium_type !== null) {
      payload.tunnel_medium_type = tunnel_medium_type;
    }

    if (vlan !== null) {
      payload.vlan = vlan;
    }

    return this._request('/api/s/<SITE>/rest/account', payload);
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
  setRadiusAccountBase(account_id, payload) {
    return this._request('/api/s/<SITE>/rest/account/' + account_id.trim(), payload, 'PUT');
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
  deleteRadiusAccount(account_id) {
    return this._request('/api/s/<SITE>/rest/account/' + account_id.trim(), null, 'DELETE');
  }

  /**
   * Execute specific stats command - cmd_stat()
   *
   * return true on success
   * required parameter <command>  = string; command to execute, known valid values
   *                                 'reset-dpi': reset all DPI counters for the current site
   */
  cmdStat(command) {
    const payload = {cmd: command.trim()};

    return this._request('/api/s/<SITE>/cmd/stat', payload);
  }

  /**
   * Toggle Element Adoption ON or OFF - set_element_adoption()
   *
   * return true on success
   * required parameter <enable> = boolean; true enables Element Adoption, false disables Element Adoption
   */
  setElementAdoption(enable) {
    const payload = {enabled: enable};

    return this._request('/api/s/<SITE>/set/setting/element_adopt', payload);
  }

  /**
   * List device states - list_device_states()
   *
   * NOTE:
   * this function returns a partial implementation of the codes listed here
   * https://help.ui.com/hc/en-us/articles/205231710-UniFi-UAP-Status-Meaning-Definitions
   *
   * @return array containing translations of UniFi device "state" values to humanized form
   */
  async getDeviceStates() {
    return {
      deviceState: {
        0: 'offline',
        1: 'connected',
        2: 'pending adoption',
        4: 'updating',
        5: 'provisioning',
        6: 'unreachable',
        7: 'adopting',
        9: 'adoption error',
        11: 'isolated',
      },
    };
  }

  /**
   * Upgrade External Firmware (5.4.9+)
   *
   * required parameter <mac>          = device MAC address
   * required parameter <firmware_url> = external URL to firmware data
   *
   */
  upgradeExternalFirmware(mac, firmware_url) {
    const payload = {
      url: firmware_url,
      mac: mac.toLowerCase(),
    };

    return this._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', payload);
  }

  /**
   * Custom API request - custom_api_request()
   *
   * NOTE:
   * Only use this method when you fully understand the behavior of the UniFi controller API. No input validation is performed, to be used with care!
   *
   * @param  string       $path           suffix of the URL (following the port number) to pass request to, *must* start with a "/" character
   * @param  string       $method         optional, HTTP request type, can be GET (default), POST, PUT, PATCH, or DELETE
   * @param  object|array $payload        optional, stdClass object or associative array containing the payload to pass
   * @param  string       $return         optional, string; determines how to return results, when "boolean" the method must return a
   *                                      boolean result (true/false) or "array" when the method must return an array
   * @return bool|array                   returns results as requested, returns false on incorrect parameters
   */
  customApiRequest(path, method = null, payload = null) {
    return this._request(path, payload, method);
  }

  /**
   * WebSocket listen function
   */
  async listen() {
    const cookies = await this._cookieJar.getCookieString(this._baseurl.href);

    let eventsUrl = new URL(`wss://${this._baseurl.host}/wss/s/${this.opts.site}/events`);
    if (this._unifios) {
      eventsUrl = new URL(`wss://${this._baseurl.host}/proxy/network/wss/s/${this.opts.site}/events`);
    }

    // Make sure we use clients=v2 URL parameter for the
    // more advanced version of the UniFi Websocket support
    eventsUrl.searchParams.set('clients', 'v2');

    // Create WebSocket
    this._ws = new WebSocket(eventsUrl.href, {
      perMessageDeflate: false,
      rejectUnauthorized: this.opts.sslverify,
      headers: {
        Cookie: cookies,
      },
    });

    const pingpong = setInterval(() => {
      this._ws.send('ping');
    }, this._pingPongInterval);

    this._ws.on('open', () => {
      this._isReconnecting = false;
      this.emit('ctrl.connect');
    });

    this._ws.on('message', (data, isBinary) => {
      const message = isBinary ? data : data.toString();
      if (message === 'pong') {
        this.emit('ctrl.pong');
        return;
      }

      try {
        const parsed = JSON.parse(message);
        if ('meta' in parsed && Array.isArray(parsed.data)) {
          for (const entry of parsed.data) {
            this._event(parsed.meta, entry);
          }
        }
      } catch (error) {
        this.emit('ctrl.error', error);
      }
    });

    this._ws.on('close', () => {
      this.emit('ctrl.close');
      clearInterval(pingpong);
      this._reconnect();
    });

    this._ws.on('error', error => {
      this.emit('ctrl.error', error);
      clearInterval(pingpong);
      this._reconnect();
    });

    return (true);
  }

  /** PRIVATE METHODS */

  /**
   * Init
   */
  async _init() {
    if (this._isInit === true) {
      return 2;
    }

    const jar = this._cookieJar;
    this._instance = this.opts.createAxiosInstance?.({cookies: {jar}}) ?? axios.create({
      httpAgent: new HttpCookieAgent({cookies: {jar}}),
      httpsAgent: new HttpsCookieAgent({cookies: {jar}, rejectUnauthorized: this.opts.sslverify, requestCert: true}),
    });

    // Identify if this is UniFiOS or not by calling the baseURL without
    // any path and then check for the return code, etc.
    const response = await this._instance.get(this._baseurl.toString(), {
      timeout: this.opts.timeout,
      maxRedirects: 0,
      validateStatus: () => true,
    });

    // Check for UniFiOS
    if (response.status === 302 && response.headers.location === '/manage') {
      this._unifios = false;
    } else if (response.status === 200) {
      this._unifios = true;
      if (response.headers['x-csrf-token']) {
        this._xcsrftoken = response.headers['x-csrf-token'];
        this._instance.defaults.headers.common['x-csrf-token'] = this._xcsrftoken;
      }
    } else {
      throw new Error('failed to detect UniFiOS status');
    }

    // DEBUG
    /*
      this._instance.interceptors.request.use(request => {
        console.dir({ 'Starting Request': request }, { depth: null })
        return request
      })
      this._instance.interceptors.response.use(response => {
        console.dir({ 'Response:': response }, { depth: null })
        return response
      })
      */

    this._isInit = true;
    try {
      this._isClosed = false;
      await this.login(null, null, null);

      return 1;
    } catch (error) {
      this._isInit = false;
      throw error;
    }
  }

  _reconnect() {
    if (this._isReconnecting === false && this._isClosed === false) {
      this._isReconnecting = true;
      setTimeout(async () => {
        this.emit('ctrl.reconnect');
        this._isReconnecting = false;
        try {
          await this.listen();
        } catch (error) {
          console.dir('_reconnect() encountered an error: ' + error);
        }
      }, this._autoReconnectInterval);
    }
  }

  /**
   * Private function to send out a generic URL request to a UniFi-Controller
   */
  async _request(path, payload = null, method = null, raw = false) {
    // Ensure that login() was used already
    await this._ensureLoggedIn();

    // Identify which request method we are using (GET, POST, PUT, DELETE) based
    // on the json data supplied and the overriding method
    if (payload !== null) {
      method = method === 'PUT' ? 'PUT' : 'POST';
    } else if (method === null) {
      method = 'GET';
    }

    // Perform HTTP request
    const response = await this._instance.request({
      url: this._url(path),
      method,
      data: payload,
      timeout: this.opts.timeout,
    });

    const body = response.data;
    if (response.headers['x-csrf-token']) {
      this._xcsrftoken = response.headers['x-csrf-token'];
      this._instance.defaults.headers.common['x-csrf-token'] = this._xcsrftoken;
    }

    if (body !== null && (body) !== undefined) {
      if ((body.meta) !== undefined) {
        if (response.status >= 200 && response.status < 400 && body.meta.rc === 'ok') {
          if (raw === true) {
            return body;
          }

          return body.data;
        }

        const error = (body.meta.msg) === undefined ? new Error('generic error') : new Error(body.meta.msg);
        throw error;
      } else if (response.status >= 200 && response.status < 400) {
        return body;
      } else {
        throw new Error('invalid status return');
      }
    } else {
      throw new Error('empty response data');
    }
  }

  _close() {
    this._isClosed = true;
    this._ws.site.close();
    this._ws.super.close();
    this._ws.system.close();
  }

  _event(meta, data) {
    if (meta && data && meta.message && meta.rc === 'ok') {
      const messageType = meta.message.toLowerCase();
      let keyType = 'generic';
      if (data.key) {
        keyType = data.key.toLowerCase();
      }

      // Emit the event
      this.emit([messageType, keyType].join('.'), [data, meta]);
    }
  }

  async _ensureLoggedIn() {
    if ((this._instance) === undefined) {
      await this._init();
      return true;
    }

    try {
      await this._instance.get(`${this._baseurl.href}api/${this._unifios ? 'users/' : ''}self`, {
        timeout: this.opts.timeout,
      });
      return true;
    } catch {
      await this.login();
      return true;
    }
  }

  _url(path) {
    if (this._unifios === true && path.endsWith('/logout') === false && path.endsWith('/login') === false) {
      return `${this._baseurl.href}proxy/network${path.replace('<SITE>', this.opts.site)}`;
    }

    return `${this._baseurl.href}${path.replace('<SITE>', this.opts.site).slice(1)}`;
  }
}

const Unifi = {Controller};
export default Unifi;
