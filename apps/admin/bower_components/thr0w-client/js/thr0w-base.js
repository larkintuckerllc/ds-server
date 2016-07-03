(function() {
  // jscs:disable
  /**
  * This module provides the core functionality.
  * @module thr0w-base
  */
  // jscs:enable
  'use strict';
  var io = window.io;
  var baseref;
  var socket = null;
  var channel = null;
  var service = {};
  service.setBase = setBase;
  service.addLoginTools = addLoginTools;
  service.addAdminTools = addAdminTools;
  service.getChannel = getChannel;
  service.login = login;
  service.logout = logout;
  service.authenticated = authenticated;
  service.getToken = getToken;
  service.loginToken = loginToken;
  service.thr0w = thr0w;
  service.connect = connect;
  service.onMessage = onMessage;
  service.offMessage = offMessage;
  service.thr0wChannel = thr0wChannel;
  service.Grid = Grid;
  service.FlexGrid = FlexGrid;
  service.Sync = Sync;
  // jscs:disable
  /**
  * This object provides the base functionality on the window object.
  * @class thr0w
  * @static
  */
  // jscs:enable
  window.thr0w = service;
  // jscs:disable
  /**
  * This function is used to set the base URI for the thr0w service.
  * @method setBase
  * @static
  * @param base {String} The URI.
  */
  // jscs:enable
  function setBase(base) {
    baseref = base;
  }
  // jscs:disable
  /**
  * This function is used to add the login tools.
  * @method addLoginTools
  * @static
  * @param base {Object} The frame DOM element.
  * @param loginCallback {Function} The callback function called when authenticated.
  * ```
  * function()
  * ```
  */
  // jscs:enable
  function addLoginTools(frameEl, loginCallback) {
    if (frameEl === undefined || typeof frameEl !== 'object') {
      throw 400;
    }
    if (loginCallback === undefined ||
      typeof loginCallback !== 'function') {
      throw 400;
    }
    if (authenticated()) {
      return loginCallback();
    }
    var loginEl = document.createElement('form');
    loginEl.id = 'thr0w_base_login';
    // jscs:disable
    loginEl.innerHTML = [
      '<input id="thr0w_base_login__username" type="text" placeholder="Username">',
      '<input id="thr0w_base_login__password" type="password" placeholder="Password">',
      '<button type="submit">Login</button>'
    ].join('\n');
    // jscs:enable
    loginEl.addEventListener('submit', loginElSubmit);
    frameEl.appendChild(loginEl);
    function loginElSubmit(e) {
      e.preventDefault();
      var username = loginEl
        .querySelector('#thr0w_base_login__username').value;
      var password = loginEl
        .querySelector('#thr0w_base_login__password').value;
      if (username && password) {
        login(username, password, callback);
      }
      function callback(error) {
        if (!error) {
          loginEl.style.display = 'none';
          loginCallback();
        }
      }
    }
  }
  // jscs:disable
  /**
  * This function is used to add the administration tools (login, etc.) and ESC key reloads.
  * @method addAdminTools
  * @static
  * @param base {Object} The frame DOM element.
  * @param connectCallback {Function} The callback function called when connected.
  * ```
  * function()
  * ```
  * @param messageCallback {Function} The callback function called for messages.
  * ```
  * function(data)
  *
  * Parameters:
  *
  * data Object
  * The message data.
  * ```
  */
  // jscs:enable
  function addAdminTools(frameEl, connectCallback, messageCallback) {
    if (frameEl === undefined || typeof frameEl !== 'object') {
      throw 400;
    }
    if (connectCallback === undefined ||
      typeof connectCallback !== 'function') {
      throw 400;
    }
    if (messageCallback === undefined ||
      typeof messageCallback !== 'function') {
      throw 400;
    }
    var channel = window.localStorage.getItem('thr0w_channel');
    if (channel !== null) {
      channel = parseInt(channel);
      adminToolsConnect();
    } else if (authenticated()) {
      addConnectTools();
    } else {
      addLoginTools(frameEl, addConnectTools);
    }
    function adminToolsConnect() {
      connect(channel, callback, messageCallback);
      function callback(error) {
        if (!error) {
          window.localStorage.setItem('thr0w_channel', channel);
          document.addEventListener('keydown', checkEsc);
          connectCallback();
        } else {
          abort();
        }
        function checkEsc(e) {
          if (e.keyCode === 27) {
            abort();
          }
        }
      }
    }
    function addConnectTools() {
      var connectEl = document.createElement('div');
      connectEl.id = 'thr0w_base_connect';
      connectEl.innerHTML = [
        '<form id="thr0w_base_connect__connect">',
        '<input id="thr0w_base_connect__connect__channel" type="number" />',
        '<button type="submit">Connect</button>',
        '</form>',
        '<button id="thr0w_base_connect__logout">Logout</button>'
      ].join('\n');
      connectEl.querySelector('#thr0w_base_connect__logout')
        .addEventListener('click', handleLogout);
      connectEl.querySelector('#thr0w_base_connect__connect')
        .addEventListener('submit', connectConnectElSubmit);
      frameEl.appendChild(connectEl);
      function handleLogout() {
        logout();
      }
      function connectConnectElSubmit(e) {
        e.preventDefault();
        connectEl.style.display = 'none';
        channel = parseInt(connectEl
          .querySelector('#thr0w_base_connect__connect__channel').value);
        if (!channel || channel < 0) {
          channel = 0;
        }
        adminToolsConnect();
      }
    }
  }
  // jscs:disable
  /**
  * This function returns the channel number.
  * @method getChannel
  * @static
  * @return {Integer} The channel number.
  */
  // jscs:enable
  function getChannel() {
    return channel;
  }
  // jscs:disable
  /**
  * This function logs in a user.
  * @method login
  * @static
  * @param username {String} The user's name.
  * @param password {String} The user's password.
  * @param callback {Function} The function callback.
  * ```
  * function(error)
  *
  * Parameters:
  *
  * error Integer
  * The error code; null is success.
  * ```
  */
  // jscs:enable
  function login(username, password, callback) {
    if (username === undefined || typeof username !== 'string') {
      throw 400;
    }
    if (password === undefined || typeof password !== 'string') {
      throw 400;
    }
    if (callback === undefined || typeof callback !== 'function') {
      throw 400;
    }
    var ref = baseref + ':3000/api/login';
    var params = 'username=' + username + '&password=' + password;
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('POST', ref, true);
    xmlhttp.setRequestHeader('Content-type',
      'application/x-www-form-urlencoded');
    xmlhttp.onreadystatechange = onChange;
    xmlhttp.send(params);
    function onChange() {
      if (xmlhttp.readyState === 4) {
        if (xmlhttp.status === 200) {
          var token;
          try {
            token = JSON.parse(xmlhttp.responseText).token;
          } catch (error) {
            return callback(500);
          }
          if (!token) {
            return callback(500);
          }
          window.localStorage.setItem('thr0w_token',
            token);
          return callback(null);
        } else {
          return callback(xmlhttp.status ? xmlhttp.status : 500);
        }
      }
    }
  }
  // jscs:disable
  /**
  * This function logs out a user.
  * @method logout
  * @static
  */
  // jscs:enable
  function logout() {
    window.localStorage.removeItem('thr0w_token');
    abort();
  }
  // jscs:disable
  /**
  * This function returns if authenticated.
  * @method authenticated
  * @static
  * @return {Boolean} If authenticated.
  */
  // jscs:enable
  function authenticated() {
    return window.localStorage.getItem('thr0w_token') !== null;
  }
  // jscs:disable
  /**
  * This function returns the authentication token.
  * @method getToken
  * @static
  * @return {String} Token
  */
  // jscs:enable
  function getToken() {
    return window.localStorage.getItem('thr0w_token');
  }
  // jscs:disable
  /**
  * This function is used to login using a token.
  * @method loginToken
  * @static
  * @param token {String} The token.
  * @param loginTokenCallback {Function} The callback function.
  * ```
  * function(error)
  *
  * Parameters:
  *
  * error Integer
  * The error code; null is success.
  * ```
  **/
  // jscs:enable
  function loginToken(token, loginTokenCallback) {
    if (token === undefined || typeof token !== 'string') {
      throw 400;
    }
    if (loginTokenCallback === undefined ||
      typeof loginTokenCallback !== 'function') {
      throw 400;
    }
    var ref = baseref + ':3000/api/valid';
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('POST', ref, true);
    xmlhttp.setRequestHeader('Authorization',
      'bearer ' + token);
    xmlhttp.setRequestHeader('Content-type',
      'application/json');
    xmlhttp.onreadystatechange = handleOnreadystatechange;
    xmlhttp.send(JSON.stringify({}));
    function handleOnreadystatechange() {
      if (xmlhttp.readyState !== 4) {
        return;
      }
      if (xmlhttp.status !== 200) {
        return loginTokenCallback(xmlhttp.status ? xmlhttp.status : 500);
      }
      window.localStorage.setItem('thr0w_token',
        token);
      return loginTokenCallback(null);
    }
  }
  // jscs:disable
  /**
  * This function is used send messages to channels.
  * @method thr0w
  * @static
  * @param channels {Array} Array of Integers; channel ids.
  * @param data {Object} The message data.
  */
  // jscs:enable
  function thr0w(channels, data) {
    // RELYING ON SERVER FOR PARAMETER VALIDATION FOR PERFORMANCE
    var ref = baseref + ':3000/api/thr0w';
    var token = window.localStorage.getItem('thr0w_token');
    var xmlhttp = new XMLHttpRequest();
    xmlhttp.open('POST', ref, true);
    xmlhttp.setRequestHeader('Authorization',
      'bearer ' + token);
    xmlhttp.setRequestHeader('Content-type',
      'application/json');
    xmlhttp.send(JSON.stringify({channels: channels, message: data}));
  }
  // jscs:disable
  /**
  * This function is used to connect to a channel.
  * @method connect
  * @static
  * @param chn {Integer} The channel id.
  * @param connectCallback {Function} The callback function called when connected.
  * ```
  * function()
  * ```
  * @param messageCallback {Function} The callback function called for messages.
  * ```
  * function(data)
  *
  * Parameters:
  *
  * data Object
  * The message data.
  * ```
  */
  // jscs:enable
  function connect(chn, connectCallback, messageCallback) {
    var token;
    var authTimeout;
    if (socket) {
      return;
    }
    if (!authenticated()) {
      throw 400;
    }
    if (chn === undefined || typeof chn !== 'number') {
      throw 400;
    }
    if (connectCallback === undefined ||
      typeof connectCallback !== 'function') {
      throw 400;
    }
    if (messageCallback === undefined ||
      typeof messageCallback !== 'function') {
      throw 400;
    }
    channel = chn;
    token = window.localStorage.getItem('thr0w_token');
    authTimeout = window.setTimeout(fail, 5000);
    socket = io(baseref + ':3001');
    socket.on('authenticated', success);
    socket.emit('authenticate',
      JSON.stringify({token: token, channel: channel})
    );
    function fail() {
      socket.disconnect();
      connectCallback(500);
    }
    function success() {
      window.clearTimeout(authTimeout);
      socket.on('message', messageCallback);
      socket.on('duplicate', duplicateCallback);
      connectCallback(null);
      function duplicateCallback() {
        abort();
      }
    }
  }
  // jscs:disable
  /**
  * This function is add a message listener.
  * @method onMessage
  * @static
  * @param messageCallback {Function} The callback function called for messages.
  * ```
  * function(data)
  *
  * Parameters:
  *
  * data Object
  * The message data.
  * ```
  */
  // jscs:enable
  function onMessage(messageCallback) {
    if (!authenticated()) {
      throw 400;
    }
    if (channel === null) {
      throw 400;
    }
    if (messageCallback === undefined ||
      typeof messageCallback !== 'function') {
      throw 400;
    }
    socket.on('message', messageCallback);
  }
  // jscs:disable
  /**
  * This function is removes a message listener.
  * @method offMessage
  * @static
  * @param messageCallback {Function} The callback function called for messages.
  * ```
  * function(data)
  *
  * Parameters:
  *
  * data Object
  * The message data.
  * ```
  */
  // jscs:enable
  function offMessage(messageCallback) {
    if (!authenticated()) {
      throw 400;
    }
    if (channel === null) {
      throw 400;
    }
    if (messageCallback === undefined ||
      typeof messageCallback !== 'function') {
      throw 400;
    }
    socket.off('message', messageCallback);
  }
  // jscs:disable
  /**
  * This function is used to send messages via the channel.
  * @method thr0wChannel
  * @static
  * @param channels {Array} Array of Integers; channel ids.
  * @param data {Object} The message data.
  */
  // jscs:enable
  function thr0wChannel(channels, data) {
    if (!socket) {
      throw 400;
    }
    if (channels === undefined || !Array.isArray(channels)) {
      throw 400;
    }
    if (channels.length === 0) {
      return;
    }
    socket.emit('thr0w', JSON.stringify({channels: channels, message: data}));
  }
  // jscs:disable
  /**
  * This class is used to create grids.
  * @namespace thr0w
  * @class Grid
  * @constructor
  * @param {Object} frameEl The frame DOM element.
  * @param {Object} contentEl The content DOM element.
  * @param {Array} matrix An array of arrays of integers defining the channels for the grid; an array of a single empty array for single screen.
  */
  // jscs:enable
  function Grid(frameEl, contentEl, matrix) {
    if (!socket) {
      throw 400;
    }
    if (frameEl === undefined || typeof frameEl !== 'object') {
      throw 400;
    }
    if (contentEl === undefined || typeof contentEl !== 'object') {
      throw 400;
    }
    if (matrix === undefined || !Array.isArray(matrix)) {
      throw 400;
    }
    var hpos = 0;
    var vpos = 0;
    for (var i = 0; i < matrix.length; i++) {
      for (var j = 0; j < matrix[i].length; j++) {
        if (channel === matrix[i][j]) {
          hpos = j;
          vpos = i;
        }
      }
    }
    contentEl.style.left = '-' + hpos * frameEl.clientWidth + 'px';
    contentEl.style.top = '-' + vpos * frameEl.clientHeight + 'px';
    this.getFrame = getFrame;
    this.getContent = getContent;
    this.getMatrix = getMatrix;
    this.getWidth = getWidth;
    this.getHeight = getHeight;
    this.getRowScale = getRowScale;
    this.frameXYToContentXY = frameXYToContentXY;
    // jscs:disable
    /**
    * This function returns the grid's frame.
    * @method getFrame
    * @return {Object} The grid's frame DOM object.
    */
    // jscs:enable
    function getFrame() {
      return frameEl;
    }
    // jscs:disable
    /**
    * This function returns the grid's content.
    * @method getContent
    * @return {Object} The grid's content DOM object.
    */
    // jscs:enable
    function getContent() {
      return contentEl;
    }
    // jscs:disable
    /**
    * This function returns the grid's matrix.
    * @method getMatrix
    * @return {Array} An array of arrays of integers defining the channels for the grid.
    */
    // jscs:enable
    function getMatrix() {
      return matrix;
    }
    // jscs:disable
    /**
    * This function returns the grid's width.
    * @method getWidth
    * @return {Integer} The width of the grid.
    */
    // jscs:enable
    function getWidth() {
      return contentEl.clientWidth;
    }
    // jscs:disable
    /**
    * This function returns the grid's height.
    * @method getHeight
    * @return {Integer} The height of the grid.
    */
    // jscs:enable
    function getHeight() {
      return contentEl.clientHeight;
    }
    // jscs:disable
    /**
    * This function returns the current row's scale.
    * @method getRowScale
    * @return {Integer} The scale of the current row.
    */
    // jscs:enable
    function getRowScale() {
      return 1;
    }
    // jscs:disable
    /**
    * This function, given xy coordinates in the frame, returns the xy coordinates in the content.
    * @method frameXYToContentXY
    * @param {Array} coordinates The frame xy coordinates.
    * @return {Array} The content xy coordinates.
    */
    // jscs:enable
    function frameXYToContentXY(coordinates) {
      if (coordinates === undefined ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates[0] === undefined ||
        coordinates[1] === undefined ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number'
      ) {
        throw 400;
      }
      return [
        coordinates[0] + hpos * frameEl.clientWidth,
        coordinates[1] + vpos * frameEl.clientHeight
      ];
    }
  }
  // jscs:disable
  /**
  * This class is used to create flexible grids.
  * @namespace thr0w
  * @class FlexGrid
  * @constructor
  * @param {Object} frameEl The frame DOM element.
  * @param {Object} contentEl The content DOM element.
  * @param {Array} matrix An array of arrays of integers defining the channels for the grid.
  * @param {Array} dimensions An array of objects consisting of width and height (and optional scale, spacing, padding, and bottom margin) of the frames in each row.
  */
  // jscs:enable
  function FlexGrid(frameEl, contentEl, matrix, dimensions) {
    if (!socket) {
      throw 400;
    }
    if (frameEl === undefined || typeof frameEl !== 'object') {
      throw 400;
    }
    if (contentEl === undefined || typeof contentEl !== 'object') {
      throw 400;
    }
    if (matrix === undefined || !Array.isArray(matrix)) {
      throw 400;
    }
    if (dimensions === undefined || !Array.isArray(dimensions)) {
      throw 400;
    }
    var i;
    var j;
    var hpos = 0;
    var vpos = 0;
    var width = 0;
    var height = 0;
    var shiftLeft = 0;
    var shiftTop = 0;
    for (i = 0; i < matrix.length; i++) {
      dimensions[i].spacing = dimensions[i].spacing ? dimensions[i].spacing : 0;
      dimensions[i].scale = dimensions[i].scale ? dimensions[i].scale : 1;
      dimensions[i].padding = dimensions[i].padding ? dimensions[i].padding : 0;
      dimensions[i].margin = dimensions[i].margin ? dimensions[i].margin : 0;
      width = Math.max(dimensions[i].scale * dimensions[i].width *
        matrix[i].length + // FRAMES
        dimensions[i].padding * 2 * dimensions[i].scale + // PADDING
        dimensions[i].spacing * (matrix[i].length - 1) * // SPACING
        dimensions[i].scale,
        width);
      height += dimensions[i].scale * dimensions[i].height +
        dimensions[i].scale * dimensions[i].margin;
      for (j = 0; j < matrix[i].length; j++) {
        if (channel === matrix[i][j]) {
          hpos = j;
          vpos = i;
        }
      }
    }
    frameEl.style.width = (dimensions[vpos].scale *
      dimensions[vpos].width) + 'px';
    frameEl.style.height = (dimensions[vpos].scale *
      dimensions[vpos].height) + 'px';
    frameEl.style.transform =
      'translate(' +
      (dimensions[vpos].width * (1 - dimensions[vpos].scale) / 2) + 'px' +
      ',' +
      (dimensions[vpos].height * (1 - dimensions[vpos].scale) / 2) + 'px' +
      ')' +
      ' ' +
      'scale(' + (1 / dimensions[vpos].scale) +
      ', ' + (1 / dimensions[vpos].scale) + ')';
    contentEl.style.width = width + 'px';
    contentEl.style.height = height + 'px';
    for (i = 0; i < vpos; i++) {
      shiftTop += dimensions[i].scale * dimensions[i].height +
        dimensions[i].scale * dimensions[i].margin;
    }
    // TODO: COLLAPSE VARS
    var shiftLeftPadding = dimensions[vpos].padding * dimensions[vpos].scale;
    var shiftLeftWindows = hpos * dimensions[vpos].scale *
      dimensions[vpos].width;
    var shiftLeftSpacing = hpos * dimensions[vpos].spacing *
      dimensions[vpos].scale;
    shiftLeft = shiftLeftPadding + shiftLeftWindows + shiftLeftSpacing;
    contentEl.style.left = '-' + shiftLeft + 'px';
    contentEl.style.top = '-' + shiftTop + 'px';
    this.getFrame = getFrame;
    this.getContent = getContent;
    this.getMatrix = getMatrix;
    this.getWidth = getWidth;
    this.getHeight = getHeight;
    this.getRowScale = getRowScale;
    this.frameXYToContentXY = frameXYToContentXY;
    // jscs:disable
    /**
    * This function returns the grid's frame.
    * @method getFrame
    * @return {Object} The grid's frame DOM object.
    */
    // jscs:enable
    function getFrame() {
      return frameEl;
    }
    // jscs:disable
    /**
    * This function returns the grid's content.
    * @method getContent
    * @return {Object} The grid's content DOM object.
    */
    // jscs:enable
    function getContent() {
      return contentEl;
    }
    // jscs:disable
    /**
    * This function returns the grid's matrix.
    * @method getMatrix
    * @return {Array} An array of arrays of integers defining the channels for the grid.
    */
    // jscs:enable
    function getMatrix() {
      return matrix;
    }
    // jscs:disable
    /**
    * This function returns the grid's width.
    * @method getWidth
    * @return {Integer} The width of the grid.
    */
    // jscs:enable
    function getWidth() {
      return width;
    }
    // jscs:disable
    /**
    * This function returns the grid's height.
    * @method getHeight
    * @return {Integer} The height of the grid.
    */
    // jscs:enable
    function getHeight() {
      return height;
    }
    // jscs:disable
    /**
    * This function returns the current row's scale.
    * @method getRowScale
    * @return {Integer} The scale of the current row.
    */
    // jscs:enable
    function getRowScale() {
      return dimensions[vpos].scale;
    }
    // jscs:disable
    /**
    * This function, given xy coordinates in the frame, returns the xy coordinates in the content.
    * @method frameXYToContentXY
    * @param {Array} coordinates The frame xy coordinates.
    * @return {Array} The content xy coordinates.
    */
    // jscs:enable
    function frameXYToContentXY(coordinates) {
      if (coordinates === undefined ||
        !Array.isArray(coordinates) ||
        coordinates.length !== 2 ||
        coordinates[0] === undefined ||
        coordinates[1] === undefined ||
        typeof coordinates[0] !== 'number' ||
        typeof coordinates[1] !== 'number'
      ) {
        throw 400;
      }
      return [
        coordinates[0] * dimensions[vpos].scale + shiftLeft,
        coordinates[1] * dimensions[vpos].scale + shiftTop
      ];
    }
  }
  // jscs:disable
  /**
  * This class is used to create syncs.
  * @namespace thr0w
  * @class Sync
  * @constructor
  * @param {Object} grid The grid, {{#crossLink "thr0w.Grid"}}thr0w.Grid{{/crossLink}} or {{#crossLink "thr0w.FlexGrid"}}thr0w.FlexGrid{{/crossLink}} object.
  * @param {String} _id The identifier for the sync.
  * @param {Function} message The function that generates the message.
  * ```
  * function()
  *
  * Returns:
  * Object
  * The message data.
  * ```
  * @param {Function} receive The function that handles received messages.
  * ```
  * function(data)
  *
  * Parameters:
  *
  * data Object
  * The message data.
  * ```
  * @param {Boolean} automated Optional flag to prevent interaction on all screens.
  */
  // jscs:enable
  function Sync(grid, _id, message, receive, automated) {
    if (grid === undefined || typeof grid !== 'object') {
      throw 400;
    }
    if (_id === undefined || typeof _id !== 'string') {
      throw 400;
    }
    if (message === undefined || typeof message !== 'function') {
      throw 400;
    }
    if (receive === undefined || typeof receive !== 'function') {
      throw 400;
    }
    if (automated !== undefined && typeof automated !== 'boolean') {
      throw 400;
    }
    var channels = [];
    var hpos;
    var vpos;
    var active = false;
    var locked = false;
    var lastActive = false;
    var matrix = grid.getMatrix();
    var coverEl = document.createElement('div');
    var frameEl = grid.getFrame();
    coverEl.id = 'thr0w_base_cover--' + _id;
    coverEl.classList.add('thr0w_base_cover');
    coverEl.style.visibility = 'hidden';
    frameEl.appendChild(coverEl);
    for (var i = 0; i < matrix.length; i++) {
      for (var j = 0; j < matrix[i].length; j++) {
        channels.push(matrix[i][j]);
        if (channel === matrix[i][j]) {
          hpos = j;
          vpos = i;
        }
      }
    }
    socket.on('message', syncMessageCallback);
    thr0wChannel(channels, {thr0w: {type: 'sync', _id: _id, hello: true}});
    this.update = update;
    this.idle = idle;
    this.destroy = destroy;
    // jscs:disable
    /**
    * This function is used to trigger an update message.
    * @method update
    */
    // jscs:enable
    function update() {
      if (locked) {
        return;
      }
      if (!active) {
        active = true;
        lastActive = true;
        if (automated) {
          coverEl.style.visibility = 'visible';
        }
        thr0wChannel(channels, {thr0w: {type: 'sync', _id: _id, lock: true}});
      }
      thr0wChannel(channels, {thr0w: {type: 'sync',
        _id: _id, message: message()}});
    }
    // jscs:disable
    /**
    * This function is used to release control to other channels.
    * @method idle
    */
    // jscs:enable
    function idle() {
      if (locked) {
        return;
      }
      active = false;
      if (automated) {
        coverEl.style.visibility = 'hidden';
      }
      thr0wChannel(channels, {thr0w: {type: 'sync', _id: _id, unlock: true}});
    }
    function syncMessageCallback(rawMsg) {
      var msg = rawMsg.message;
      if (msg === undefined || rawMsg.source === channel) {
        return;
      }
      var thr0wMsg = msg.thr0w;
      if (thr0wMsg === undefined || thr0wMsg.type !== 'sync' ||
        thr0wMsg._id !== _id) {
        return;
      }
      if (thr0wMsg.hello) {
        if (active) {
          thr0wChannel(channels, {thr0w: {type: 'sync', _id: _id, lock: true}});
        }
        if (lastActive) {
          thr0wChannel(channels, {thr0w: {type: 'sync',
            _id: _id, message: message()}});
        }
        return;
      }
      if (active) {
        return;
      }
      if (thr0wMsg.lock && !active) {
        lastActive = false;
        locked = true;
        coverEl.style.visibility = 'visible';
        return;
      }
      if (thr0wMsg.unlock && !active) {
        locked = false;
        coverEl.style.visibility = 'hidden';
        return;
      }
      receive(thr0wMsg.message);
    }
    function destroy() {
      frameEl.removeChild(coverEl);
      socket.off('message', syncMessageCallback);
    }
  }
  function abort() {
    window.localStorage.removeItem('thr0w_channel', channel);
    window.location.reload();
  }
})();
