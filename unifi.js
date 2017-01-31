/**
 *
 * UniFi controller class (NodeJS)
 *
 * This nodejs class provides functionality to query a UniFi controller (www.ubnt.com) through
 * its Web-API. The functionality implemented here had been gathered through different
 * souces, namely:
 *
 *   UniFi-API-browser class: https://github.com/malle-pietje/UniFi-API-browser/blob/master/phpapi/class.unifi.php
 *   UniFi-API sh client: https://www.ubnt.com/downloads/unifi/5.4.9/unifi_sh_api
 *
 * The majority of the functions in here are actually based on the PHP UniFi-API-browser class
 * version 1.0.12 which defines compatibility to UniFi-Controller versions v4+
 *
 * Copyright (c) 2017 Jens Maus <mail@jens-maus.de>
 *
 * The source code is distributed under the MIT license
 *
 */
var request = require('request');
var async = require('async');

// make sure we setup request correctly for our
// processing
request = request.defaults({ jar: true,
                             json: true,
                             strictSSL: false
                          });

var Controller = function(hostname, port)
{
  var _self = this;

  /** INIT CODE **/

  _self._baseurl = 'https://127.0.0.1:8443';

  // format a new baseurl based on the arguments
  if(typeof(hostname) !== 'undefined' && typeof(port) !== 'undefined')
    _self._baseurl = 'https://' + hostname + ':' + port;

  /** PUBLIC FUNCTIONS **/

  /**
   * Login to UniFi Controller - login()
   */
  _self.login = function(username, password, cb)
  {
    _self._request('/api/login', { username: username, password: password }, null, cb);
  };

  /**
   * Logout from UniFi Controller - logout()
   */
  _self.logout = function(cb)
  {
    _self._request('/logout', null, null, cb);
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
  _self.authorizeGuest = function(sites, mac, minutes, cb, up, down, mbytes, ap_mac)
  {
    var json = { cmd: 'authorize-guest', mac: mac.toLowerCase() };
    if(typeof(minutes) !== 'undefined') json['minutes'] = minutes;
    if(typeof(up) !== 'undefined')      json['up'] = up;
    if(typeof(down) !== 'undefined')    json['down'] = down;
    if(typeof(mbytes) !== 'undefined')  json['bytes'] = mbytes;
    if(typeof(ap_mac) !== 'undefined')  json['ap_mac'] = ap_mac;

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Unauthorize a client device - unauthorize_guest()
   * ---------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.authorizeGuest = function(sites, mac, cb)
  {
    var json = { cmd: 'unauthorize-guest', mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Reconnect a client device - reconnect_sta()
   * -------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.reconnectClient = function(sites, mac, cb)
  {
    var json = { cmd: 'kick-sta', mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Block a client device - block_sta()
   * ---------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.blockClient = function(sites, mac, cb)
  {
    var json = { cmd: 'block-sta', mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Unblock a client device - unblock_sta()
   * -----------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.unblockClient = function(sites, mac, cb)
  {
    var json = { cmd: 'unblock-sta', mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Add/modify a client device note - set_sta_note()
   * -------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the user device to be modified
   * optional parameter <note>    = note to be applied to the user device
   *
   * NOTES:
   * - when note is empty or not set, the existing note for the user will be removed and "noted" attribute set to FALSE
   */
  _self.setClientNote = function(sites, user_id, cb, note)
  {
    var noted = 1;
    if(typeof(note) === 'undefined')
    {
      note = '';
      noted = 0;
    }

    _self._request('/api/s/<SITE>/upd/user/' + user_id, { note: note, noted: noted }, sites, cb);
  };

  /**
   * Add/modify a client device name - set_sta_name()
   * -------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <user_id> = id of the user device to be modified
   * optional parameter <name>    = name to be applied to the user device
   *
   * NOTES:
   * - when name is empty or not set, the existing name for the user will be removed
   */
  _self.setClientName = function(sites, user_id, cb, name)
  {
    if(typeof(name) === 'undefined')
      name = '';

    _self._request('/api/s/<SITE>/upd/user/' + user_id, { name: name }, sites, cb);
  };

  /**
   * Daily stats method - stat_daily_site()
   * ------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 52*7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  _self.getDailySiteStats = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(new Date());

    if(typeof(start) === 'undefined')
      start = end - (52*7*24*3600*1000);

    var json = { attrs: [ 'bytes',
                          'wan-tx_bytes',
                          'wan-rx_bytes',
                          'wlan_bytes',
                          'num_sta',
                          'lan-num_sta',
                          'wlan-num_sta',
                          'time' ],
                start: start,
                end: end };

    _self._request('/api/s/<SITE>/stat/report/daily.site', json, sites, cb);
  };

  /**
   * Hourly stats method - stat_hourly_site()
   * -------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - "bytes" are no longer returned with controller version 4.9.1 and later
   */
  _self.getHourlySiteStats = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(new Date());

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600*1000);

    var json = { attrs: [ 'bytes',
                          'wan-tx_bytes',
                          'wan-rx_bytes',
                          'wlan_bytes',
                          'num_sta',
                          'lan-num_sta',
                          'wlan-num_sta',
                          'time' ],
                 start: start,
                 end: end };

    _self._request('/api/s/<SITE>/stat/report/hourly.site', json, sites, cb);
  };

  /**
   * Hourly stats method for all access points - stat_hourly_aps()
   * -----------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  _self.getHourlyApStats = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(new Date());

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600*1000);

    var json = { attrs: [ 'bytes',
                          'num_sta',
                          'time' ],
                 start: start,
                 end: end };

    _self._request('/api/s/<SITE>/stat/report/hourly.ap', json, sites, cb);
  };

  /**
   * Show all login sessions - stat_sessions()
   * -----------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = client MAC address to return sessions for (can only be used when start and end are also provided)
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  _self.getSessions = function(sites, cb, start, end, mac)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(new Date());

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

    var json = { type: 'all',
                 start: start,
                 end: end };

    if(typeof(mac) !== 'undefined')
      json['mac'] = mac.toLowerCase();

    _self._request('/api/s/<SITE>/stat/session', json, sites, cb);
  };

  /**
   * Show latest 'n' login sessions for a single device - stat_sta_sessions_latest()
   * --------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * required parameter <mac>   = client MAC address
   * optional parameter <limit> = maximum number of sessions to get (defaults to 5)
   *
   */
  _self.getLatestSessions = function(sites, mac, cb, limit)
  {
    if(typeof(limit) === 'undefined')
      limit = 5;

    var json = { mac: mac.toLowerCase(),
                 _limit: limit,
                 _sort: '-assoc_time' };

    _self._request('/api/s/<SITE>/stat/session', json, sites, cb);
  };

  /**
   * Show all authorizations - stat_auths()
   * -----------------------
   *
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   */
  _self.getAllAuthorizations = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(new Date());

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

    _self._request('/api/s/<SITE>/stat/authorization', { start: start, end: end }, sites, cb);
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
  _self.getAllUsers = function(sites, cb, within)
  {
    if(typeof(within) === 'undefined')
      within = 8760;

    var json = { type: 'all',
                 conn: 'all',
                 within: within };

    _self._request('/api/s/<SITE>/stat/alluser', json, sites, cb);
  };

  /**
   * List guest devices - list_guests()
   * ------------------
   *
   * optional parameter <within> = time frame in hours to go back to list guests with valid access (default = 24*365 hours)
   *
   */
  _self.getGuests = function(sites, cb, within)
  {
    if(typeof(within) === 'undefined')
      within = 8760;

    _self._request('/api/s/<SITE>/stat/guest', { within: within }, sites, cb);
  };

  /**
   * List online client device(s) - list_clients()
   * ----------------------------
   * returns an array of online client device objects, or in case of a single device request, returns a single client device object
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  _self.getClientDevices = function(sites, cb, client_mac)
  {
    if(typeof(client_mac) === 'undefined')
      client_mac = '';

    _self._request('/api/s/<SITE>/stat/sta/' + client_mac.toLowerCase(), null, sites, cb);
  };

  /**
   * Get data for a single client device - stat_client()
   * -----------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  _self.getClientDevice = function(sites, cb, client_mac)
  {
    if(typeof(client_mac) === 'undefined')
      client_mac = '';

    _self._request('/api/s/<SITE>/stat/user/' + client_mac.toLowerCase(), null, sites, cb);
  };

  /**
   * List user groups - list_usergroups()
   * ----------------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getUserGroups = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/usergroup', null, sites, cb);
  };

  /**
   * Assign user device to another group - set_usergroup()
   * -----------------------------------
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <user_id>  = id of the user device to be modified
   * required parameter <group_id> = id of the user group to assign user to
   *
   */
  _self.setUserGroup = function(sites, user_id, group_id, cb)
  {
    _self._request('/api/s/<SITE>/upd/user/' + user_id, { usergroup_id: group_id }, sites, cb);
  };

  /**
   * List health metrics - list_health()
   * -------------------
   *
   * required paramater <sites> = name or array of site names
   */
  _self.getHealth = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/health', null, sites, cb);
  };

  /**
   * List dashboard metrics - list_dashboard()
   * ----------------------
   *
   * required paramater <sites> = name or array of site names
   */
  _self.getHealth = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/dashboard', null, sites, cb);
  };

  /**
   * List user devices - list_users()
   * -----------------
   *
   * required paramater <sites> = name or array of site names
   */
  _self.getUsers = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/user', null, sites, cb);
  };

  /**
   * List access points and other devices under management of the controller (USW and/or USG devices) - list_aps()
   * ------------------------------------------------------------------------------------------------
   *
   * required paramater <sites>      = name or array of site names
   * optional paramater <device_mac> = the MAC address of a single device for which the call must be made
   */
  _self.getAccessDevices = function(sites, cb, device_mac)
  {
    if(typeof(device_mac) === 'undefined')
      device_mac = '';

    _self._request('/api/s/<SITE>/stat/device/' + device_mac.toLowerCase(), null, sites, cb);
  };

  /**
   * List rogue access points - list_rogueaps()
   * ------------------------
   *
   * optional parameter <within> = hours to go back to list discovered "rogue" access points (default = 24 hours)
   *
   */
  _self.getRogueAccessPoints = function(sites, cb, within)
  {
    if(typeof(within) === 'undefined')
      within = 24;

    _self._request('/api/s/<SITE>/stat/rogueap', { within: within }, sites, cb);
  };

  /**
   * List sites
   * ----------
   * calls callback function(err, result) with an array of the sites
   * registered to the UniFi controller
   */
  _self.getSites = function(cb)
  {
    _self._request('/api/self/sites', null, null, cb);
  };

  /**
   * List sites stats
   * ----------------
   * calls callback function(err, result) with an array of sysinfo information
   * for all sites registered to the UniFi controller
   *
   * NOTE: endpoint was introduced with controller version 5.2.9
   */
  _self.getSitesStats = function(cb)
  {
    _self._request('/api/stat/sites', null, null, cb);
  };

  /**
   * Add a site - add_site()
   * ----------
   *
   * required parameter <description> = the long name for the new site
   *
   * NOTE: immediately after being added, the new site will be available in the output of the "list_sites" function
   */
  _self.addSite = function(site, cb, description)
  {
    if(typeof(description) === 'undefined')
      description = '';

    var json = { desc: description,
                 cmd: 'add-site' };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * List wlan_groups - list_wlan_groups()
   * ----------------
   *
   * required paramater <sites> = name or array of site names
   */
  _self.getWLanGroups = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/wlangroup', null, sites, cb);
  };

  /**
   * List site sysinfo
   * -----------------
   * returns an array of known sysinfo data via callback function(err, result)
   * for all sites specified as a function parameter
   */
  _self.getSiteSysinfo = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/sysinfo', null, sites, cb);
  };

  /**
   * List self - list_self()
   * ---------
   * returns an array of information about the logged in user
   */
  _self.getSelf = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/self', null, sites, cb);
  };

  /**
   * List networkconf - list_networkconf()
   * ----------------
   * returns an array of network configuration data
   */
  _self.getNetworkConf = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/networkconf', null, sites, cb);
  };

  /**
   * List vouchers - stat_voucher()
   * -------------
   *
   * optional parameter <create_time> = Unix timestamp in seconds
   */
  _self.getVouchers = function(sites, cb, create_time)
  {
    var json = {};
    if(typeof(create_time) !== 'undefined')
      json = { create_time: create_time };

    _self._request('/api/s/<SITE>/stat/voucher', json, sites, cb);
  };

  /**
   * List payments - stat_payment()
   * -------------
   * returns an array of hotspot payments
   */
  _self.getPayments = function(sites, cb, within)
  {
    if(typeof(within) !== 'undefined')
      within = '?within=' + within;
    else
      within = '';

    _self._request('/api/s/<SITE>/stat/payment' + within, null, sites, cb);
  };

  /**
   * Create hotspot operator - create_hotspotop()
   * -----------------------
   *
   * required parameter <name>       = name for the hotspot operator
   * required parameter <x_password> = clear text password for the hotspot operator
   * optional parameter <note>       = note to attach to the hotspot operator
   */
  _self.createHotspotOperator = function(sites, name, x_password, cb, note)
  {
    var json = { name: name,
                 x_password: x_password };

    if(typeof(note) !== 'undefined')
      json['note'] = note;

    _self._request('/api/s/<SITE>/rest/hotspotop', json, sites, cb);
  };

  /**
   * List hotspot operators - list_hotspotop()
   * ----------------------
   * returns an array of hotspot operators
   */
  _self.getHotspotOperators = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/hotspotop', null, sites, cb);
  };

  /**
   * Create voucher(s) - create_voucher()
   * -----------------
   * returns an array of voucher codes (NOTE: without the "-" in the middle) by calling the stat_voucher method
   *
   * required parameter <minutes> = minutes the voucher is valid after activation
   * optional parameter <count>   = number of vouchers to create, default value is 1
   * optional parameter <quota>   = single-use or multi-use vouchers, string value '0' is for multi-use, '1' is for single-use
   * optional parameter <note>    = note text to add to voucher when printing
   * optional parameter <up>      = upload speed limit in kbps
   * optional parameter <down>    = download speed limit in kbps
   * optional parameter <mbytes>  = data transfer limit in MB
   */
  _self.createVouchers = function(sites, minutes, cb, count, quota, note, up, down, mbytes)
  {
    if(typeof(count) === 'undefined') count = 1;
    if(typeof(quota) === 'undefined') quota = 0;

    var json = { cmd: 'create-voucher',
                 expire: minutes,
                 n: count,
                 quota: quota };

    if(typeof(note) !== 'undefined')   json['note'] = note;
    if(typeof(up) !== 'undefined')     json['up'] = up;
    if(typeof(down) !== 'undefined')   json['down'] = down;
    if(typeof(mbytes) !== 'undefined') json['bytes'] = mbytes;

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * Revoke voucher - revoke_voucher()
   *---------------
   * return TRUE on success
   *
   * required parameter <voucher_id> = _id of the voucher to revoke
   */
  _self.revokeVoucher = function(sites, voucher_id, cb)
  {
    var json = { cmd: 'delete-voucher',
                 _id: voucher_id };

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * List port forwarding stats - list_portforward_stats()
   * --------------------------
   * returns an array of port forwarding stats
   */
  _self.getPortForwardingStats = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/portforward', null, sites, cb);
  };

  /**
   * List port forwarding settings - list_portforwarding()
   * -----------------------------
   * returns an array of port forwarding settings
   */
  _self.getPortForwarding = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/portforward', null, sites, cb);
  };

  /**
   * List dynamic DNS settings - list_dynamicdns()
   * -------------------------
   * returns an array of dynamic DNS settings
   */
  _self.getDynamicDNS = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/dynamicdns', null, sites, cb);
  };

  /**
   * List port configuration - list_portconf()
   * -----------------------
   * returns an array of port configurations
   */
  _self.getPortConfig = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/portconf', null, sites, cb);
  };

  /**
   * List VoIP extensions - list_extensions()
   * --------------------
   * returns an array of VoIP extensions
   */
  _self.getVoipExtensions = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/extension', null, sites, cb);
  };

  /**
   * List site settings - list_settings()
   * ------------------
   * returns an array of site configuration settings
   */
  _self.getSiteSettings = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/get/setting', null, sites, cb);
  };

  /**
   * Reboot an access point - restart_ap()
   * ----------------------
   *
   * required parameter <mac> = device MAC address
   */
  _self.rebootAccessPoint = function(sites, mac, cb)
  {
    var json = { cmd: 'restart',
                 mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Disable/enable an access point - disable_ap()
   * ------------------------------
   *
   * required parameter <ap_id>   = value of _id for the access point which can be obtained from the device list
   * required parameter <disable> = boolean; TRUE will disable the device, FALSE will enable the device
   *
   * NOTES:
   * - a disabled device will be excluded from the dashboard status and device count and its LED and WLAN will be turned off
   * - appears to only be supported for access points
   * - available since controller versions 5.2.X
   */
  _self.disableAccessPoint = function(sites, ap_id, disable, cb)
  {
    _self._request('/api/s/<SITE>/rest/device/' + ap_id, { disabled: disabled }, sites, cb);
  };

  /**
   * Start flashing LED of an access point for locating purposes - set_locate_ap()
   * -----------------------------------------------------------
   *
   * required parameter <mac> = device MAC address
   */
  _self.setLocateAccessPoint = function(sites, mac, cb)
  {
    var json = { cmd: 'set-locate',
                 mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Stop flashing LED of an access point for locating purposes - unset_locate_ap()
   * -----------------------------------------------------------
   *
   * required parameter <mac> = device MAC address
   */
  _self.unsetLocateAccessPoint = function(sites, mac, cb)
  {
    var json = { cmd: 'unset-locate',
                 mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Switch LEDs of all the access points ON - site_ledson()
   * ---------------------------------------
   *
   */
  _self.enableSiteLEDs = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/set/setting/mgmt', { led_enabled: 1 }, sites, cb);
  };

  /**
   * Switch LEDs of all the access points OFF - site_ledson()
   * ----------------------------------------
   *
   */
  _self.disableSiteLEDs = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/set/setting/mgmt', { led_enabled: 0 }, sites, cb);
  };

  /**
   * Set access point radio settings - set_ap_radiosettings()
   * ------------------------------
   *
   * required parameter <ap_id>   = value of _id for the access point which can be obtained from the device list
   * required parameter <radio>   = (default=ng)
   * required parameter <channel>
   * required parameter <ht>      = (default=20)
   * required parameter <tx_power_mode>
   * required parameter <tx_power>= (default=0)
   *
   */
  _self.setAccessPointRadioSettings = function(sites, ap_id, radio, channel, ht, tx_power_mode, tx_power, cb)
  {
    var json = { radio_table: [{ radio: radio,
                 channel: channel,
                 ht: ht,
                 tx_power_mode: tx_power_mode,
                 tx_power: tx_power }] };

    _self._request('/api/s/<SITE>/upd/device/' + ap_id, json, sites, cb);
  };

  /**
   * Set guest login settings - set_guestlogin_settings()
   * ------------------------
   *
   * required parameter <portal_enabled>
   * required parameter <portal_customized>
   * required parameter <redirect_enabled>
   * required parameter <redirect_url>
   * required parameter <x_password>
   * required parameter <expire_number>
   * required parameter <expire_unit>
   * required parameter <site_id>
   *
   * NOTES:
   * - both portal parameters are set to the same value!
   *
   */
  _self.setGuestLoginSettings = function(sites, portal_enabled, portal_customized, redirect_enabled, redirect_url, x_password, expire_number, expire_unit, site_id, cb)
  {
    var json = { portal_enabled: portal_enabled,
                 portal_customized: portal_customized,
                 redirect_enabled: redirect_enabled,
                 redirect_url: redirect_url,
                 x_password: x_password,
                 expire_number: expire_number,
                 expire_unit: expire_unit,
                 site_id: site_id };

    _self._request('/api/s/<SITE>/set/setting/guest_access/', json, sites, cb);
  };

  /**
   * Rename access point - rename_ap()
   * -------------------
   *
   * required parameter <ap_id>  = value of _id for the access point which can be obtained from the device list
   * required parameter <apname> = New name
   *
   */
  _self.renameAccessPoint = function(sites, ap_id, apname, cb)
  {
    _self._request('/api/s/<SITE>/upd/device/' + ap_id, { name: apname }, sites, cb);
  };

  /**
   * Set wlan settings - set_wlansettings()
   * -----------------
   *
   * required parameter <wlan_id>
   * required parameter <x_passphrase> = new pre-shared key, minimal length is 8 characters, maximum length is 63
   * optional parameter <name>
   *
   */
  _self.setWLanSettings = function(sites, wlan_id, x_passphrase, cb, name)
  {
    var json = { x_passphrase: x_passphrase };

    if(typeof(name) !== 'undefined')
      json['name'] = name;

    _self._request('/api/s/<SITE>/upd/wlanconf/' + wlan_id, json, sites, cb);
  };

  /**
   * List events - list_events()
   * -----------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getEvents = function(sites, cb)
  {
    self._request('/api/s/<SITE>/stat/event', null, sites, cb);
  };

  /**
   * List wireless settings - list_wlanconf()
   * ----------------------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getWLanSettings = function(sites, cb)
  {
    self._request('/api/s/<SITE>/list/wlanconf', null, sites, cb);
  };

  /**
   * List alarms - list_alarms()
   * -----------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getAlarms = function(sites, cb)
  {
    self._request('/api/s/<SITE>/list/alarm', null, sites, cb);
  };

  /**
   * Create backup (5.4.9+)
   * -------------
   *
   * required paramater <sites>   = name or array of site names
   *
   */
  _self.createBackup = function(sites, cb)
  {
    self._request('/api/s/<SITE>/cmd/backup', { cmd: 'backup' }, sites, cb);
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
  _self.upgradeExternalFirmware = function(sites, mac, firmware_url, cb)
  {
    var json = { url: firmware_url,
                 mac: mac.toLowerCase() };

    self._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', json, sites, cb);
  };

  /** PRIVATE FUNCTIONS **/

  /**
   * Private function to send out a generic URL request to a UniFi-Controller
   * for multiple sites (if wanted) and returning data via the callback function
   */
  _self._request = function(url, json, sites, cb)
  {
    var proc_sites;

    if(sites === null)
      proc_sites = [{}];
    else if(Array.isArray(sites) === false)
      proc_sites = [ sites ];

    var count = 0;
    var results = [];
    async.whilst(
      function() { return count < proc_sites.length; },
      function(callback) {
        var reqfunc = request.get;
        var reqjson = {url: _self._baseurl + url.replace('<SITE>', proc_sites[count])};
        var req;

        // if the user specified json data we assume a
        // POST request instead.
        if(json !== null)
        {
          reqfunc = request.post;
          reqjson['json'] = json;
        }

        req = reqfunc(reqjson, function(error, response, body)
                      {
                        if(!error && body && response.statusCode >= 200 && response.statusCode < 400 &&
                           (typeof(body) !== 'undefined' && typeof(body.meta) !== 'undefined' && body.meta.rc === "ok"))
                        {
                          results.push(body.data);
                          callback(null);
                        }
                        else if(typeof(body) !== 'undefined' && typeof(body.meta) !== 'undefined' && body.meta.rc === 'error')
                          callback(body.meta.msg);
                        else
                          callback('ERROR: ' + reqjson);
                      });

        req.on('error', function(err)
        {
          callback(err.message);
        });

        count++;
      },
      function(err) {
        if(typeof(cb) === 'function')
        {
          if(sites === null)
            results = results[0];

          if(!err)
            cb(false, results);
          else
            cb(err, results);
        }
      }
    );
  };
};

exports.Controller = Controller;

/*
 ********************
 * TEST
 ********************
*/

/*
var controller = new Controller("127.0.0.1", 8443);

//////////////////////////////
// LOGIN
controller.login("admin", "XXXXXX", function(err) {

  if(err)
  {
    console.log.info('ERROR: ' + err);
    return;
  }

  //////////////////////////////
  // GET SITE STATS
  controller.getSitesStats(function(err, sites) {
    console.log('getSitesStats: ' + sites[0].name + ' : ' + sites.length);
    console.log(JSON.stringify(sites));

    //////////////////////////////
    // GET SITE SYSINFO
    controller.getSiteSysinfo(sites[0].name, function(err, sysinfo) {
      console.log('getSiteSysinfo: ' + sysinfo.length);
      console.log(JSON.stringify(sysinfo));

      //////////////////////////////
      // GET CLIENT DEVICES
      controller.getClientDevices(sites[0].name, function(err, client_data) {
        console.log('getClientDevices: ' + client_data[0].length);
        console.log(JSON.stringify(client_data));

        //////////////////////////////
        // GET ALL USERS EVER CONNECTED
        controller.getAllUsers(sites[0].name, function(err, users_data) {
          console.log('getAllUsers: ' + users_data[0].length);
          console.log(JSON.stringify(users_data));

          //////////////////////////////
          // FINALIZE

          // finalize, logout and finish
          controller.logout();
        });
      });
    });
  });
});
*/
