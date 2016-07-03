(function() {
  'use strict';
  var thr0w = window.thr0w;
  document.addEventListener('DOMContentLoaded', ready);
  function ready() {
    var accountEl = document.getElementById('account');
    var controlEl = document.getElementById('control');
    document.getElementById('account__form')
      .addEventListener('submit', login);
    document.getElementById('control__logout')
      .addEventListener('click', logout);
    document.getElementById('control__red')
      .addEventListener('click', red);
    document.getElementById('control__green')
      .addEventListener('click', green);
    document.getElementById('control__blue')
      .addEventListener('click', blue);
    // CONFIGURED FOR LOCAL DEVELOPMENT; CHANGE HOSTNAME AS REQUIRED
    thr0w.setBase('http://localhost');
    // CHECKS IF ONE IS AUTHENTICATED
    if (thr0w.authenticated()) {
      controlEl.style.display = 'block';
    } else {
      accountEl.style.display = 'block';
    }
    function login(e) {
      e.preventDefault();
      var passwordEl = document
        .getElementById('account__form__password');
      var username = document.getElementById('account__form__username')
        .value;
      var password = passwordEl.value;
      if (username && password) {
        // AUTHENTICATES USERNAME AND PASSWORD
        thr0w.login(username, password, callback);
      }
      function callback(error) {
        if (!error) {
          accountEl.style.display = 'none';
          controlEl.style.display = 'block';
        } else {
          passwordEl.value = '';
        }
      }
    }
    function logout() {
      // LOGOUT
      thr0w.logout();
      window.location.reload();
    }
    function red() {
      // SEND MESSAGE TO CHANNEL 0
      thr0w.thr0w([0], {color: 'red'});
    }
    function green() {
      // SEND MESSAGE TO CHANNEL 0
      thr0w.thr0w([0], {color: 'green'});
    }
    function blue() {
      // SEND MESSAGE TO CHANNEL 0
      thr0w.thr0w([0], {color: 'blue'});
    }
  }
})();
