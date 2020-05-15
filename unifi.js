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
 *
 * The majority of the functions in here are actually based on the PHP UniFi-API-client class
 * which defines compatibility to UniFi-Controller versions v4 and v5+
 *
 * Based/Compatible to UniFi-API-client class: v1.1.24
 *
 * Copyright (c) 2017-2020 Jens Maus <mail@jens-maus.de>
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
   * -------------------------
   * returns true upon success
   */
  _self.login = function(username, password, cb)
  {
    _self._request('/api/login', { username: username, password: password }, null, cb);
  };

  /**
   * Logout from UniFi Controller - logout()
   * ----------------------------
   * returns true upon success
   */
  _self.logout = function(cb)
  {
    _self._request('/logout', {}, null, cb);
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
    if(typeof(minutes) !== 'undefined') json.minutes = minutes;
    /**
     * if we have received values for up/down/MBytes/ap_mac we append them to the payload array to be submitted
     */
    if(typeof(up) !== 'undefined')      json.up = up;
    if(typeof(down) !== 'undefined')    json.down = down;
    if(typeof(mbytes) !== 'undefined')  json.bytes = mbytes;
    if(typeof(ap_mac) !== 'undefined')  json.ap_mac = ap_mac.toLowerCase();

    _self._request('/api/s/<SITE>/cmd/stamgr', json, sites, cb);
  };

  /**
   * Unauthorize a client device - unauthorize_guest()
   * ---------------------------
   *
   * required paramater <sites>   = name or array of site names
   * required parameter <mac>     = client MAC address
   */
  _self.unauthorizeGuest = function(sites, mac, cb)
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
   * Add/modify/remove a client device note - set_sta_note()
   * --------------------------------------
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

    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), { note: note, noted: noted }, sites, cb);
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
  _self.setClientName = function(sites, user_id, cb, name)
  {
    if(typeof(name) === 'undefined')
      name = '';

    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), { name: name }, sites, cb);
  };

  /**
   * 5 minutes site stats method - stat_5minutes_site()
   * ---------------------------
   * returns an array of 5 minutes stats objects for the current site
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   */
  _self.get5minSiteStats = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (12*3600);

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

    _self._request('/api/s/<SITE>/stat/report/5minutes.site', json, sites, cb);
  };

  /**
   * Hourly site stats method - stat_hourly_site()
   * ------------------------
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
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

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
   * Daily site stats method - stat_daily_site()
   * -----------------------
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
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (52*7*24*3600);

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
   * 5 minutes stats method for a single access point or all access points - stat_5minutes_aps()
   * ---------------------------------------------------------------------
   * returns an array of 5 minutes stats objects
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 12 hours
   * - this function/method is only supported on controller versions 5.5.* and later
   * - make sure that the retention policy for 5 minutes stats is set to the correct value in
   *   the controller settings
   */
  _self.get5minApStats = function(sites, cb, start, end, mac)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (12*3600);

    var json = { attrs: [ 'bytes',
                          'num_sta',
                          'time' ],
                 start: start,
                 end: end };

    if(typeof(mac) !== 'undefined')
      json.mac = mac.toLowerCase();

    _self._request('/api/s/<SITE>/stat/report/5minutes.ap', json, sites, cb);
  };

  /**
   * Hourly stats method for a single access point or all access points - stat_hourly_aps()
   * ------------------------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  _self.getHourlyApStats = function(sites, cb, start, end, mac)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

    var json = { attrs: [ 'bytes',
                          'num_sta',
                          'time' ],
                 start: start,
                 end: end };

    if(typeof(mac) !== 'undefined')
      json.mac = mac.toLowerCase();

    _self._request('/api/s/<SITE>/stat/report/hourly.ap', json, sites, cb);
  };

  /**
   * Daily stats method for a single access point or all access points - stat_daily_aps()
   * -----------------------------------------------------------------
   *
   * required paramater <sites> = name or array of site names
   * optional parameter <start> = Unix timestamp in seconds
   * optional parameter <end>   = Unix timestamp in seconds
   * optional parameter <mac>   = AP MAC address to return stats for
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   * - UniFi controller does not keep these stats longer than 5 hours with versions < 4.6.6
   */
  _self.getDailyApStats = function(sites, cb, start, end, mac)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

    var json = { attrs: [ 'bytes',
                          'num_sta',
                          'time' ],
                 start: start,
                 end: end };

    if(typeof(mac) !== 'undefined')
      json.mac = mac.toLowerCase();

    _self._request('/api/s/<SITE>/stat/report/daily.ap', json, sites, cb);
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
  _self.getSessions = function(sites, cb, start, end, mac, type)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

    if(typeof(start) === 'undefined')
      start = end - (7*24*3600);

    if(typeof(type) === 'undefined')
      type = 'all';

    var json = { type: type,
                 start: start,
                 end: end };

    if(typeof(mac) !== 'undefined')
      json.mac = mac.toLowerCase();

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
   *
   * NOTES:
   * - defaults to the past 7*24 hours
   */
  _self.getAllAuthorizations = function(sites, cb, start, end)
  {
    if(typeof(end) === 'undefined')
      end = Math.floor(Date.now() / 1000);

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
   * List all blocked client devices ever connected to the site
   * ----------------------------------------------------------
   *
   * optional parameter <historyhours> = hours to go back (default is 8760 hours or 1 year)
   *
   * NOTES:
   * - <historyhours> is only used to select clients that were online within that period,
   *    the returned stats per client are all-time totals, irrespective of the value of <historyhours>
   */
  _self.getBlockedUsers = function(sites, cb, within)
  {
    if(typeof(within) === 'undefined')
      within = 8760;

    var json = { type: 'blocked',
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

    _self._request('/api/s/<SITE>/stat/sta/' + client_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * Get details for a single client device - stat_client()
   * --------------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <client_mac> = the MAC address of a single online client device for which the call must be made
   */
  _self.getClientDevice = function(sites, cb, client_mac)
  {
    if(typeof(client_mac) === 'undefined')
      client_mac = '';

    _self._request('/api/s/<SITE>/stat/user/' + client_mac.trim().toLowerCase(), null, sites, cb);
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
   * Assign client device to another group - set_usergroup()
   * -------------------------------------
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <user_id>  = id of the user device to be modified
   * required parameter <group_id> = id of the user group to assign user to
   *
   */
  _self.setUserGroup = function(sites, user_id, group_id, cb)
  {
    _self._request('/api/s/<SITE>/upd/user/' + user_id.trim(), { usergroup_id: group_id }, sites, cb);
  };

  /**
   * Update user group (using REST) - edit_usergroup()
   * ------------------------------
   * returns an array containing a single object with attributes of the updated usergroup on success
   *
   * required paramater <sites>      = name or array of site names
   * required parameter <group_id>   = id of the user group
   * required parameter <site_id>    = id of the site
   * required parameter <group_name> = name of the user group
   * optional parameter <group_dn>   = limit download bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   * optional parameter <group_up>   = limit upload bandwidth in Kbps (default = -1, which sets bandwidth to unlimited)
   *
   */
  _self.editUserGroup = function(sites, group_id, site_id, group_name, cb,
                                 group_dn, group_up)
  {
    var json = { _id: group_id,
                 site_id: site_id,
                 name: group_name,
                 qos_rate_max_down: typeof(group_dn) !== 'undefined' ? group_dn : -1,
                 qos_rate_max_up:   typeof(group_up) !== 'undefined' ? group_up : -1 };

    _self._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), json, sites, cb, 'PUT');
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
  _self.createUserGroup = function(sites, group_name, cb,
                                   group_dn, group_up)
  {
    var json = { name: group_name,
                 qos_rate_max_down: typeof(group_dn) !== 'undefined' ? group_dn : -1,
                 qos_rate_max_up:   typeof(group_up) !== 'undefined' ? group_up : -1 };

    _self._request('/api/s/<SITE>/rest/usergroup', json, sites, cb);
  };

  /**
   * Delete user group (using REST) - delete_usergroup()
   * ------------------------------
   * returns true on success
   *
   * required paramater <sites>    = name or array of site names
   * required parameter <group_id> = id of the user group
   *
   */
  _self.deleteUserGroup = function(sites, group_id, cb)
  {
    _self._request('/api/s/<SITE>/rest/usergroup/' + group_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * List health metrics - list_health()
   * -------------------
   *
   * required paramater <sites> = name or array of site names
   *
   */
  _self.getHealth = function(sites, cb)
  {
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
  _self.getDashboard = function(sites, cb, five_minutes)
  {
    var url_suffix = '';
    if(typeof(five_minutes) !== 'undefined' && five_minutes === true)
      url_suffix = '?scale=5minutes';

    _self._request('/api/s/<SITE>/stat/dashboard' + url_suffix, null, sites, cb);
  };

  /**
   * List client devices - list_users()
   * -------------------
   * returns an array of known client device objects
   * required paramater <sites> = name or array of site names
   */
  _self.getUsers = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/user', null, sites, cb);
  };

  /**
   * List access points and other devices under management of the controller (USW and/or USG devices) - list_devices()
   * ------------------------------------------------------------------------------------------------
   *
   * required paramater <sites>      = name or array of site names
   * optional paramater <device_mac> = the MAC address of a single device for which the call must be made
   */
  _self.getAccessDevices = function(sites, cb, device_mac)
  {
    if(typeof(device_mac) === 'undefined')
      device_mac = '';

    _self._request('/api/s/<SITE>/stat/device/' + device_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * List (device) tags (using REST) - list_tags()
   * -------------------------------
   * returns an array of known device tag objects
   *
   * NOTES: this endpoint was introduced with controller versions 5.5.X
   */
  _self.listTags = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/rest/tag', null, sites, cb);
  }

  /**
   * List rogue/neighboring access points - list_rogueaps()
   * ------------------------------------
   * returns an array of rogue/neighboring access point objects
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
   * List known rogue access points - list_known_rogueaps()
   * ------------------------------
   * returns an array of known rogue access point objects
   */
  _self.getKnownRogueAccessPoints = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/rest/rogueknown', null, sites, cb);
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
   * NOTES: endpoint was introduced with controller version 5.2.9
   */
  _self.getSitesStats = function(cb)
  {
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
  _self.createSite = function(site, cb, description)
  {
    if(typeof(description) === 'undefined')
      description = '';

    var json = { desc: description,
                 cmd: 'add-site' };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  };

  /**
   * Delete a site - delete_site()
   * -------------
   * return true on success
   * required parameter <site_id> = 24 char string; _id of the site to delete
   *
   */
  _self.deleteSite = function(site_id, cb)
  {
    // lets get the _id first
    _self.getSites(function(err, result) {
      if(!err && result && result.length > 0) {
        // only if name or _id matches the site paramater
        if(result[0].name === site_id || result[0]._id === site_id) {
          var json = { site: result[0]._id,
                       cmd: 'delete-site' };

          _self._request('/api/s/<SITE>/cmd/sitemgr', json, result[0].name, cb);
        }
      }
    });
  };

  /**
   * Change a site's name - set_site_name()
   * --------------------
   * return true on success
   * required parameter <site_name> = string; the long name for the site
   *
   * NOTES: immediately after being changed, the site will be available in the output of the list_sites() function
   */
  _self.setSiteName = function(site, site_name, cb)
  {
    var json = { desc: site_name,
                 cmd: 'update-site' };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, site, cb);
  };

  /**
   * Set site country - set_site_country()
   * ----------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "country" key.
   *                                Valid country codes can be obtained using the list_country_codes() function/method.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteCountry = function(site, country_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/country/' + country_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site locale - set_site_locale()
   * ---------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "locale" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteLocale = function(site, locale_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/locale/' + locale_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site snmp - set_site_snmp()
   * -------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "snmp" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteSNMP = function(site, snmp_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/snmp/' + snmp_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site mgmt - set_site_mgmt()
   * -------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "mgmt" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteMgmt = function(site, mgmt_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/mgmt/' + mgmt_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site guest access - set_site_guest_access()
   * ---------------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                object structured in the same manner as is returned by list_settings() for the "guest_access" key.
   *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteGuestAccess = function(site, guest_access_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/guest_access/' + guest_access_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site ntp - set_site_ntp()
   * ------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
     *                                object structured in the same manner as is returned by list_settings() for the "ntp" key.
     *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteNTP = function(site, ntp_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/ntp/' + ntp_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * Set site connectivity - set_site_connectivity()
   * ---------------------
   * required parameter <setting> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
     *                                object structured in the same manner as is returned by list_settings() for the "connectivity" key.
     *                                Do not include the _id property, it will be assigned by the controller and returned upon success.
   * return true on success
   */
  _self.setSiteConnectivity = function(site, connectivity_id, setting, cb)
  {
    _self._request('/api/s/<SITE>/rest/setting/connectivity/' + connectivity_id.trim(), setting, site, cb, 'PUT');
  };

  /**
   * List admins - list_admins()
   * -----------
   *
   * required paramater <sites> = name or array of site names
   *
   */
  _self.listAdmins = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/cmd/sitemgr', { cmd: 'get-admins' }, sites, cb);
  };

  /**
   * List all admins - list_all_admins()
   * ---------------
   * returns an array containing administrator objects for all sites
   */
  _self.listAllAdmins = function(cb)
  {
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
   *                                       permissions, default value is true which gives the new admin
   *                                       administrator permissions
   * optional parameter <device_adopt>   = boolean, whether or not the new admin will have permissions to
   *                                       adopt devices, default value is false. Only applies when readonly
   *                                       is true.
   * optional parameter <device_restart> = boolean, whether or not the new admin will have permissions to
   *                                       restart devices, default value is false. Only applies when readonly
   *                                       is true.
   *
   * NOTES:
   * - after issuing a valid request, an invite will be sent to the email address provided
   * - issuing this command against an existing admin will trigger a "re-invite"
   */
  _self.inviteAdmin = function(sites, name, email, cb, enable_sso, readonly, device_adopt, device_restart)
  {
    if(typeof(enable_sso) === 'undefined')
      enable_sso = true;

    if(typeof(readonly) === 'undefined')
      readonly = false;

    if(typeof(device_adopt) === 'undefined')
      device_adopt = false;

    if(typeof(device_restart) === 'undefined')
      device_restart = false;

    var json = { name: name.trim(),
                 email: email.trim(),
                 for_sso: enable_sso,
                 cmd: 'invite-admin'
               };

    if(readonly === true)
    {
      json.role = 'readonly';

      var permissions = [ ];
      if(device_adopt === true)
        permissions.push('API_DEVICE_ADOPT');

      if(device_restart === true)
        permissions.push('API_DEVICE_RESTART');

      if(permissions.length > 0)
        json.permissions = permissions;
    }

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * Revoke an admin - revoke_admin()
   * ---------------
   * returns true on success
   * required parameter <admin_id> = id of the admin to revoke which can be obtained using the
   *                                 list_all_admins() method/function
   *
   * NOTES:
   * only non-superadmins account can be revoked
   */
  _self.revokeAdmin = function(sites, admin_id, cb)
  {
    var json = { admin: admin_id,
                 cmd: 'revoke-admin'
               };

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
   * Show sysinfo - stat_sysinfo()
   * ------------
   * returns an array of known sysinfo data via callback function(err, result)
   * for all sites specified as a function parameter
   */
  _self.getSiteSysinfo = function(sites, cb)
  {
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
  _self.getStatus = function(cb)
  {
    _self._request('/status', {}, null, cb);
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
      within = '?within=' + within.trim();
    else
      within = '';

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
  _self.createHotspotOperator = function(sites, name, x_password, cb, note)
  {
    var json = { name: name,
                 x_password: x_password };

    if(typeof(note) !== 'undefined')
      json.note = note;

    _self._request('/api/s/<SITE>/rest/hotspotop', json, sites, cb);
  };

  /**
   * List hotspot operators (using REST) - list_hotspotop()
   * -----------------------------------
   * returns an array of hotspot operators
   */
  _self.getHotspotOperators = function(sites, cb)
  {
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
  _self.createVouchers = function(sites, minutes, cb, count, quota, note, up, down, mbytes)
  {
    if(typeof(count) === 'undefined') count = 1;
    if(typeof(quota) === 'undefined') quota = 0;

    var json = { cmd: 'create-voucher',
                 expire: minutes,
                 n: count,
                 quota: quota };

    if(typeof(note) !== 'undefined')   json.note = note;
    if(typeof(up) !== 'undefined')     json.up = up;
    if(typeof(down) !== 'undefined')   json.down = down;
    if(typeof(mbytes) !== 'undefined') json.bytes = mbytes;

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * Revoke voucher - revoke_voucher()
   *---------------
   * return TRUE on success
   *
   * required parameter <voucher_id> = 24 char string; _id of the voucher to revoke
   */
  _self.revokeVoucher = function(sites, voucher_id, cb)
  {
    var json = { cmd: 'delete-voucher',
                 _id: voucher_id };

    _self._request('/api/s/<SITE>/cmd/hotspot', json, sites, cb);
  };

  /**
   * Extend guest validity - extend_guest_validity()
   * ---------------------
   * return TRUE on success
   *
   * required parameter <guest_id> = 24 char string; _id of the guest to extend validity
   */
  _self.extendGuestValidity = function(sites, guest_id, cb)
  {
    var json = { cmd: 'extend',
                 _id: guest_id };

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
   * List DPI stats - list_dpi_stats()
   * --------------
   * returns an array of DPI stats
   */
  _self.getDPIStats = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/dpi', null, sites, cb);
  };

  /**
   * clear DPI stats 
   * --------------
   * clears stats of DPI
   */
  _self.ClearDPIStatus = function (sites, cb) {
    var json = {
      cmd: 'clear-dpi'
    }
    _self._request('/api/s/<SITE>/cmd/stat', json, sites, cb);
  };

  /**
   * List current channels - list_current_channels()
   * ---------------------
   * returns an array of currently allowed channels
   */
  _self.getCurrentChannels = function(sites, cb)
  {
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
  _self.getCountryCodes = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/stat/ccode', null, sites, cb);
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
   * List port configurations - list_portconf()
   * ------------------------
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
   * Adopt a device to the selected site - adopt_device()
   * -----------------------------------
   *
   * required parameter <mac> = device MAC address
   */
  _self.adoptDevice = function(sites, mac, cb)
  {
    var json = { cmd: 'adopt',
                 mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
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
  _self.disableAccessPoint = function(sites, ap_id, disable, cb)
  {
    _self._request('/api/s/<SITE>/rest/device/' + ap_id.trim(), { disabled: disabled }, sites, cb, 'PUT');
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
  _self.setLEDOverride = function(sites, device_id, override_mode, cb)
  {
    _self._request('/api/s/<SITE>/rest/device/' + device_id.trim(), { led_override: override_mode }, sites, cb, 'PUT');
  };

  /**
   * Toggle flashing LED of an access point for locating purposes - locate_ap()
   * ------------------------------------------------------------
   *
   * required parameter <mac> = device MAC address
   * required parameter <enable> = boolean; true will enable flashing LED, false will disable
   */
  _self.setLocateAccessPoint = function(sites, mac, enable, cb)
  {
    var json = { cmd: enable === true ? 'set-locate' : 'unset-locate',
                 mac: mac.toLowerCase() };

    _self._request('/api/s/<SITE>/cmd/devmgr', json, sites, cb);
  };

  /**
   * Toggle LEDs of all the access points ON or OFF - site_leds()
   * ----------------------------------------------
   *
   * required parameter <enable> = boolean; true will switch LEDs of all the access points ON, false will switch them OFF
   */
  _self.setSiteLEDs = function(sites, enable, cb)
  {
    _self._request('/api/s/<SITE>/set/setting/mgmt', { led_enabled: enable }, sites, cb);
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
  _self.setAccessPointRadioSettings = function(sites, ap_id, radio, channel, ht, tx_power_mode, tx_power, cb)
  {
    var json = { radio_table: [{ radio: radio,
                 channel: channel,
                 ht: ht,
                 tx_power_mode: tx_power_mode,
                 tx_power: tx_power }] };

    _self._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), json, sites, cb);
  };

  /**
   * Assign access point to another WLAN group - set_ap_wlangroup()
   * -----------------------------------------
   * return true on success
   * required parameter <wlantype_id>  = string; WLAN type, can be either 'ng' (for WLANs 2G (11n/b/g)) or 'na' (WLANs 5G (11n/a/ac))
   * required parameter <device_id>    = string; id of the access point to be modified
   * required parameter <wlangroup_id> = string; id of the WLAN group to assign device to
   *
   * NOTES:
   * - can for example be used to turn WiFi off
   */
  _self.setAccessPointWLanGroup = function(sites, wlantype_id, device_id, wlangroup_id, cb)
  {
    var json = { wlan_overrides: '' };

    if(wlantype_id === 'ng')
      json.wlangroup_id_ng = wlangroup_id;
    else if(wlantype_id === 'na')
      json.wlangroup_id_na = wlangroup_id;

    _self._request('/api/s/<SITE>/upd/device/' + device_id.trim(), json, sites, cb);
  };

  /**
   * Update guest login settings - set_guestlogin_settings()
   * ---------------------------
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
   * Update guestlogin settings, base - set_guestlogin_settings_base()
   * --------------------------------
   * return true on success
   * required parameter <network_settings> = stdClass object or associative array containing the configuration to apply to the guestlogin, must be a (partial)
   *                                         object/array structured in the same manner as is returned by list_settings() for the guest_access.
   */
  _self.setGuestLoginSettingsBase = function(sites, guestlogin_settings, cb)
  {
    _self._request('/api/s/<SITE>/set/setting/guest_access', guestlogin_settings, sites, cb);
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
    _self._request('/api/s/<SITE>/upd/device/' + ap_id.trim(), { name: apname }, sites, cb);
  };

  /**
   * Move a device to another site - move_device()
   * -----------------------------
   * return true on success
   * required parameter <mac>     = string; MAC address of the device to move
   * required parameter <site_id> = 24 char string; _id of the site to move the device to
   */
  _self.moveDevice = function(sites, mac, site_id, cb)
  {
    var json = { site: site_id,
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
  _self.deleteDevice = function(sites, mac, cb)
  {
    var json = { mac: mac.toLowerCase(),
                 cmd: 'delete-device'
               };

    _self._request('/api/s/<SITE>/cmd/sitemgr', json, sites, cb);
  };

  /**
   * List network settings (using REST) - list_networkconf()
   * ----------------------------------
   * returns an array of network configuration data
   */
  _self.getNetworkConf = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/rest/networkconf', null, sites, cb);
  };

  /**
   * Create a network (using REST) - create_network()
   * -----------------------------
   *
   * required parameter <network_settings> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                         object structured in the same manner as is returned by list_networkconf() for the specific network type.
   *                                         Do not include the _id property, it will be assigned by the controller and returned upon success.
   *
   */
  _self.createNetwork = function(sites, network_settings, cb)
  {
    _self._request('/api/s/<SITE>/rest/networkconf', network_settings, sites, cb, 'POST');
  };

  /**
   * Update network settings, base (using REST) - set_networksettings_base()
   * ------------------------------------------
   * return true on success
   * required parameter <network_id>
   * required parameter <network_settings> = stdClass object or associative array containing the configuration to apply to the network, must be a (partial)
   *                                         object structured in the same manner as is returned by list_networkconf() for the specific network type.
   *
   */
  _self.createNetwork = function(sites, network_id, network_settings, cb)
  {
    _self._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), network_settings, sites, cb, 'PUT');
  };

  /**
   * Delete a network (using REST) - delete_network()
   * -----------------------------
   * return true on success
   * required parameter <network_id> = 24 char string; _id of the network which can be found with the list_networkconf() function
   *
   */
  _self.deleteNetwork = function(sites, network_id, cb)
  {
    _self._request('/api/s/<SITE>/rest/networkconf/' + network_id.trim(), null, sites, cb, 'DELETE');
  };

  /**
   * List wlan settings (using REST) - list_wlanconf()
   * -------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <wlan_id> = 24 char string; _id of the wlan to fetch the settings for
   *
   */
  _self.getWLanSettings = function(sites, wlan_id, cb)
  {
    if(typeof(wlan_id) === 'undefined')
      wlan_id = '';

    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), null, sites, cb);
  };

  /**
   * Create a wlan - create_wlan()
   * -------------
   *
   * required parameter <name>             = string; SSID
   * required parameter <x_passphrase>     = string; new pre-shared key, minimal length is 8 characters, maximum length is 63
   * required parameter <usergroup_id>     = string; user group id that can be found using the list_usergroups() function
   * required parameter <wlangroup_id>     = string; wlan group id that can be found using the list_wlan_groups() function
   * optional parameter <enabled>          = boolean; enable/disable wlan
   * optional parameter <hide_ssid>        = boolean; hide/unhide wlan SSID
   * optional parameter <is_guest>         = boolean; apply guest policies or not
   * optional parameter <security>         = string; security type
   * optional parameter <wpa_mode>         = string; wpa mode (wpa, wpa2, ..)
   * optional parameter <wpa_enc>          = string; encryption (auto, ccmp)
   * optional parameter <vlan_enabled>     = boolean; enable/disable vlan for this wlan
   * optional parameter <vlan>             = string; vlan id
   * optional parameter <uapsd_enabled>    = boolean; enable/disable Unscheduled Automatic Power Save Delivery
   * optional parameter <schedule_enabled> = boolean; enable/disable wlan schedule
   * optional parameter <schedule>         = string; schedule rules
   */
  _self.createWLan = function(sites, name, x_passphrase, usergroup_id, wlangroup_id, cb,
                              enabled, hide_ssid, is_guest, security, wpa_mode, wpa_enc, vlan_enabled, vlan, uapsd_enabled, schedule_enabled, schedule)
  {
    var json = { name: name,
                 x_passphrase:     x_passphrase,
                 usergroup_id:     usergroup_id,
                 wlangroup_id:     wlangroup_id,
                 enabled:          typeof(enabled) !== 'undefined' ? enabled : true,
                 hide_ssid:        typeof(hide_ssid) !== 'undefined' ? hide_ssid : false,
                 is_guest:         typeof(is_guest) !== 'undefined' ? is_guest : false,
                 security:         typeof(security) !== 'undefined' ? security : 'open',
                 wpa_mode:         typeof(wpa_mode) !== 'undefined' ? wpa_mode : 'wpa2',
                 wpa_enc:          typeof(wpa_enc) !== 'undefined' ? wpa_enc : 'ccmp',
                 vlan_enabled:     typeof(vlan_enabled) !== 'undefined' ? vlan_enabled : false,
                 uapsd_enabled:    typeof(uapsd_enabled) !== 'undefined' ? uapsd_enabled : false,
                 schedule_enabled: typeof(schedule_enabled) !== 'undefined' ? schedule_enabled : false,
                 schedule:         typeof(schedule) !== 'undefined' ? schedule : {}
               };

    if(typeof(vlan) !== 'undefined' && typeof(vlan_enabled) !== 'undefined')
      json.vlan = vlan;

    _self._request('/api/s/<SITE>/add/wlanconf/', json, sites, cb);
  };

  /**
   * Update wlan settings, base (using REST) - set_wlansettings_base()
   * ---------------------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <wlan_id> = 24 char string; _id of the wlan to fetch the settings for
   * required parameter <wlan_settings> = stdClass object or associative array containing the configuration to apply to the wlan, must be a
   *                                      (partial) object/array structured in the same manner as is returned by list_wlanconf() for the wlan.
   *
   */
  _self.setWLanSettingsBase = function(sites, wlan_id, wlan_settings, cb)
  {
    if(typeof(wlan_id) === 'undefined')
      wlan_id = '';

    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), wlan_settings, sites, cb, 'PUT');
  };

  /**
   * Update basic wlan settings - set_wlansettings()
   * --------------------------
   *
   * required paramater <sites>   = name or array of site names
   * optional parameter <wlan_id> = 24 char string; _id of the wlan to fetch the settings for
   * required parameter <wlan_settings> = stdClass object or associative array containing the configuration to apply to the wlan, must be a
   *                                      (partial) object/array structured in the same manner as is returned by list_wlanconf() for the wlan.
   *
   */
  _self.setWLanSettingsBase = function(sites, wlan_id, wlan_settings, cb)
  {
    if(typeof(wlan_id) === 'undefined')
      wlan_id = '';

    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), wlan_settings, sites, cb);
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
  _self.setWLanSettings = function(sites, wlan_id, cb, x_passphrase, name)
  {
    var json = { };

    if(typeof(x_passphrase) !== 'undefined')
      json.x_passphrase = x_passphrase.trim();

    if(typeof(name) !== 'undefined')
      json.name = name.trim();

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
  _self.disableWLan = function(sites, wlan_id, disable, cb)
  {
    var json = { enabled: disable == true ? false : true };

    _self.setWLanSettingsBase(sites, wlan_id, json, sites, cb);
  };

  /**
   * Delete a wlan (using REST) - delete_wlan()
   * --------------------------
   *
   * required parameter <wlan_id> = 24 char string; _id of the wlan that can be found with the list_wlanconf() function
   */
  _self.deleteWLan = function(sites, wlan_id, cb)
  {
    _self._request('/api/s/<SITE>/rest/wlanconf/' + wlan_id.trim(), {}, sites, cb, 'DELETE');
  };

  /**
   * Update MAC filter for a wlan - set_wlan_mac_filter()
   * ----------------------------
   *
   * required parameter <wlan_id>
   * required parameter <mac_filter_policy>  = string, "allow" or "deny"; default MAC policy to apply
   * required parameter <mac_filter_enabled> = boolean; true enables the policy, false disables it
   * required parameter <macs>               = array; must contain valid MAC strings to be placed in the MAC filter list,
   *                                           replacing existing values. Existing MAC filter list can be obtained
   *                                           through list_wlanconf().
   *
   */
  _self.setWLanMacFilter = function(sites, wlan_id, mac_filter_policy, mac_filter_enabled, macs, cb)
  {
    var json = { mac_filter_enabled: mac_filter_enabled,
                 mac_filter_policy: mac_filter_policy,
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
  _self.getEvents = function(sites, cb, historyhours, start, limit)
  {
    var json = { _sort: '-time',
                 type: null };

    if(typeof(historyhours) !== 'undefined')
      json.within = historyhours;
    else
      json.within = 720;

    if(typeof(start) !== 'undefined')
      json._start = start;
    else
      json._start = 0;

    if(typeof(limit) !== 'undefined')
      json._limit = limit;
    else
      json._limit = 3000;

    _self._request('/api/s/<SITE>/stat/event', json, sites, cb);
  };

  /**
   * List alarms - list_alarms()
   * -----------
   *
   * required paramater <sites>   = name or array of site names
   */
  _self.getAlarms = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/list/alarm', null, sites, cb);
  };

  /**
   * Count alarms - count_alarms()
   * ------------
   * returns an array containing the alarm count
   * required paramater <sites>   = name or array of site names
   * optional parameter <archived> = boolean; if true all alarms will be counted, if false only non-archived (active) alarms will be counted
   */
  _self.getAlarms = function(sites, cb, archived)
  {
    _self._request('/api/s/<SITE>/cnt/alarm' + archived === false ? '?archived=false' : '', null, sites, cb);
  };

  /**
   * Archive alarms(s) - archive_alarm()
   * -----------------
   * return true on success
   * optional parameter <alarm_id> = 24 char string; _id of the alarm to archive which can be found with the list_alarms() function,
   *                                 if not provided, *all* un-archived alarms for the current site will be archived!
   */
  _self.archiveAlarms = function(sites, cb, alarm_id)
  {
    var json = { };
    if(typeof(alarm_id) === 'undefined')
      json.cmd = 'archive-all-alarms';
    else
    {
      json.cmd = 'archive-alarm';
      json._id = alarm_id;
    }

    _self._request('/api/s/<SITE>/cmd/evtmgr', json, sites, cb);
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
  _self.upgradeDeviceExternal = function(sites, firmware_url, device_mac, cb)
  {
    _self._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', { url: firmware_url, mac: device_mac.toLowerCase() }, sites, cb);
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
  _self.startRollingUpgrade = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/cmd/devmgr', { cmd: 'set-rollupgrade' }, sites, cb);
  };

  /**
   * Cancel rolling upgrade - cancel_rolling_upgrade()
   * ----------------------
   * return true on success
   */
  _self.cancelRollingUpgrade = function(sites, cb)
  {
    _self._request('/api/s/<SITE>/cmd/devmgr', { cmd: 'unset-rollupgrade' }, sites, cb);
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
   */
  _self.powerCycleSwitchPort = function(sites, switch_mac, port_idx, cb)
  {
    var json = { mac: switch_mac.toLowerCase(),
                 port_idx: port_idx,
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
  _self.runSpectrumScan = function(sites, ap_mac, cb)
  {
    _self._request('/api/s/<SITE>/cmd/devmgr', { cmd: 'spectrum-scan', mac: ap_mac.toLowerCase() }, sites, cb);
  };

  /**
   * Check the RF scanning state of an AP - spectrum_scan_state()
   * ------------------------------------
   * returns an object with relevant information (results if available) regarding the RF scanning state of the AP
   * required parameter <ap_mac> = MAC address of the AP
   */
  _self.getSpectrumScanState = function(sites, ap_mac, cb)
  {
    _self._request('/api/s/<SITE>/stat/spectrum-scan/' + ap_mac.trim().toLowerCase(), null, sites, cb);
  };

  /**
   * Update device settings, base (using REST) - set_device_settings_base()
   * -----------------------------------------
   * required paramater <sites>           = name or array of site names
   * required parameter <device_id>       = 24 char string; _id of the device which can be found with the list_devices() function
   * required parameter <device_settings> = stdClass object or associative array containing the configuration to apply to the device, must be a
   *                                        (partial) object/array structured in the same manner as is returned by list_devices() for the device.
   * optional paramater <cb>              = the callback function that is called with the results
   */
  _self.setDeviceSettingsBase = function(sites, device_id, device_settings, cb)
  {
    _self._request('/api/s/<SITE>/rest/device/' + device_id.trim(), device_settings, sites, cb, 'PUT');
  };

  /**
   * List Radius profiles (using REST) - list_radius_profiles()
   * -----------------------------------
   * returns an array of objects containing all Radius profiles for the current site
	 *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.listRadiusProfiles = function(sites, cb)
  {
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
  _self.listRadiusAccounts = function(sites, cb)
  {
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
  _self.createRadiusAccount = function(sites, name, x_password, tunnel_type, tunnel_medium_type, cb, vlan)
  {
    var json = { name: name,
                 x_password: x_password,
                 tunnel_type: tunnel_type,
                 tunnel_medium_type: tunnel_medium_type
               };

    if(typeof(vlan) !== 'undefined')
      json.vlan = vlan;

    _self._request('/api/s/<SITE>/rest/account', json, sites, cb, 'POST');
  };

  /**
   * Update Radius account, base (using REST) - set_radius_account_base()
   * ----------------------------------------
   * return true on success
   * required parameter <account_id>      = 24 char string; _id of the account which can be found with the list_radius_accounts() function
   * required parameter <account_details> = stdClass object or associative array containing the new profile to apply to the account, must be a (partial)
   *                                        object/array structured in the same manner as is returned by list_radius_accounts() for the account.
   *
   * NOTES:
   * - this function/method is only supported on controller versions 5.5.19 and later
   */
  _self.setRadiusAccountBase = function(sites, account_id, account_details, cb)
  {
    var json = { account_details: account_details };

    _self._request('/api/s/<SITE>/rest/account/' + account_id.trim(), json, sites, cb, 'PUT');
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
  _self.deleteRadiusAccount = function(sites, account_id, cb)
  {
    _self._request('/api/s/<SITE>/rest/account/' + account_id.trim(), json, sites, cb, 'DELETE');
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
    _self._request('/api/s/<SITE>/cmd/backup', { cmd: 'backup' }, sites, cb);
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

    _self._request('/api/s/<SITE>/cmd/devmgr/upgrade-external', json, sites, cb);
  };


  /** PRIVATE FUNCTIONS **/

  /**
   * Private function to send out a generic URL request to a UniFi-Controller
   * for multiple sites (if wanted) and returning data via the callback function
   */
  _self._request = function(url, json, sites, cb, method)
  {
    var proc_sites;

    if(sites === null)
      proc_sites = [{}];
    else if(Array.isArray(sites) === false)
      proc_sites = [ sites ];
    else
      proc_sites = sites;

    var count = 0;
    var results = [];
    async.whilst(
      function() { return count < proc_sites.length; },
      function(callback) {
        var reqfunc;
        var reqjson = {url: _self._baseurl + url.replace('<SITE>', proc_sites[count])};
        var req;

        // identify which request method we are using (GET, POST, DELETE) based
        // on the json data supplied and the overriding method
        if(json !== null)
        {
          if(method === 'PUT')
            reqfunc = request.put;
          else
            reqfunc = request.post;
          reqjson.json = json;
        }
        else if(typeof(method) === 'undefined')
          reqfunc = request.get;
        else if(method === 'DELETE')
          reqfunc = request.del;
        else if(method === 'POST')
          reqfunc = request.post;
        else if(method === 'PUT')
          reqfunc = request.put;
        else
          reqfunc = request.get;

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
                          callback(error);
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
var controller = new Controller("192.168.5.66", 8443);

//////////////////////////////
// LOGIN
controller.login("admin", "XXXXXXXX", function(err) {

  if(err)
  {
    console.log.info('ERROR: ' + err);
    return;
  }

  //////////////////////////////
  // GET SITE STATS
  controller.getSitesStats(function(err, site_data) {
    var sites = site_data.map(function(s) { return s.name; });

    console.log('getSitesStats: ' + sites + ' : ' + sites.length);
    console.log(JSON.stringify(site_data));

    //////////////////////////////
    // GET SITE SYSINFO
    controller.getSiteSysinfo(sites, function(err, sysinfo) {
      console.log('getSiteSysinfo: ' + sysinfo.length);
      console.log(JSON.stringify(sysinfo));

      //////////////////////////////
      // GET CLIENT DEVICES
      controller.getClientDevices(sites, function(err, client_data) {
        console.log('getClientDevices: ' + client_data[0].length);
        console.log(JSON.stringify(client_data));

        //////////////////////////////
        // GET ALL USERS EVER CONNECTED
        controller.getAllUsers(sites, function(err, users_data) {
          console.log('getAllUsers: ' + users_data[0].length);
          console.log(JSON.stringify(users_data));

          //////////////////////////////
          // GET ALL ACCESS DEVICES
          controller.getAccessDevices(sites, function(err, access_data) {
            console.log('getAccessDevices: ' + access_data[0].length);
            console.log(JSON.stringify(access_data));

            //////////////////////////////
            // GET ALL SESSIONS
            controller.getSessions(sites, function(err, session_data) {
              console.log('getSessions: ' + session_data[0].length);
              console.log(JSON.stringify(session_data));

              //////////////////////////////
              // GET ALL AUTHORIZATIONS
              controller.getAllAuthorizations(sites, function(err, auth_data) {
                console.log('getAllAuthorizations: ' + auth_data[0].length);
                console.log(JSON.stringify(auth_data));

                //////////////////////////////
                // GET USERS
                controller.getUsers(sites, function(err, user_data) {
                  console.log('getUsers: ' + user_data[0].length);
                  console.log(JSON.stringify(user_data));

                  //////////////////////////////
                  // GET SELF
                  controller.getSelf(sites, function(err, self_data) {
                    console.log('getSelf: ' + self_data[0].length);
                    console.log(JSON.stringify(self_data));

                    //////////////////////////////
                    // FINALIZE

                    // finalize, logout and finish
                    controller.logout();
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});
*/
