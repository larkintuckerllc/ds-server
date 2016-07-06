(function() {
  'use strict';
  var ADMIN_USER = 'larkintuckerllc';
  var ADMIN_REPO = 'ds-admin';
  // var BASE = 'http://localhost'; // DEV
  var BASE = 'http://192.168.1.2'; // PROD
  var ds = window.ds;
  document.addEventListener('DOMContentLoaded', ready);
  function ready() {
    ds.setBase(BASE);
    ds.addAdminTools(document.body, handleDsLogin);
    function handleDsLogin() {
      var dsToken = ds.getToken();
      var authorizedFailEl = document.getElementById('authorized__fail');
      document.getElementById('authorized').style.display = 'block';
      document.getElementById('authorized__logout')
        .addEventListener('click', handleAuthorizedLogout);
      document.getElementById('authorized__update')
        .addEventListener('click', handleAuthorizedUpdate);
      function handleAuthorizedLogout() {
        ds.logout();
      }
      function handleAuthorizedUpdate() {
        var authorizedProgressEl = document
          .getElementById('authorized__progress');
        var authorizedProgressBarEl = document
          .getElementById('authorized__progress__bar');
        authorizedFailEl.style.display = 'none';
        update(handleUpdate);
        function handleUpdate(updateErr) {
          var updateProgressInterval;
          var progressCount = 0;
          if (updateErr !== null) {
            authorizedFailEl.style.display = 'block';
            return;
          }
          authorizedProgressEl.style.display = 'block';
          updateProgressInterval = window.setInterval(updateProgress, 1000);
          function updateProgress() {
            progressCount++;
            if (progressCount === 10) {
              failed();
              return;
            }
            authorizedProgressBarEl.style.width =  progressCount * 10 + '%';
            list(handleList);
          }
          function handleList(listErr, apps) {
            if (listErr !== null) {
              failed();
              return;
            }
            if (apps[0].version === 'failed') {
              failed();
              return;
            }
            if (apps[0].version !== 'installing') {
              window.location.reload();
            }
          }
          function failed() {
            window.clearInterval(updateProgressInterval);
            authorizedProgressEl.style.display = 'none';
            window.console.log('failed');
            authorizedProgressBarEl.style.width = '0%';
            authorizedFailEl.style.display = 'block';
          }
          function list(callback) {
            var xmlhttp = new XMLHttpRequest();
            xmlhttp.open('POST', BASE + ':3010/api/list', true);
            xmlhttp.setRequestHeader('Authorization',
              'bearer ' + dsToken);
            xmlhttp.setRequestHeader('Content-type',
              'application/json');
            xmlhttp.onreadystatechange = handleOnreadystatechange;
            xmlhttp.send(JSON.stringify({}));
            function handleOnreadystatechange() {
              if (xmlhttp.readyState !== 4) {
                return;
              }
              if (xmlhttp.status !== 200) {
                return callback(xmlhttp.status ? xmlhttp.status : 500);
              }
              var apps;
              try {
                apps = JSON.parse(xmlhttp.responseText);
              } catch (error) {
                return callback(500);
              }
              return callback(null, apps);
            }
          }
        }
      }
      function update(callback) {
        var xmlhttp = new XMLHttpRequest();
        xmlhttp.open('POST', BASE + ':3010/api/update', true);
        xmlhttp.setRequestHeader('Authorization',
          'bearer ' + dsToken);
        xmlhttp.setRequestHeader('Content-type',
          'application/json');
        xmlhttp.onreadystatechange = handleOnreadystatechange;
        xmlhttp.send(JSON.stringify({
          user: ADMIN_USER,
          repo: ADMIN_REPO
        }));
        function handleOnreadystatechange() {
          if (xmlhttp.readyState !== 4) {
            return;
          }
          if (xmlhttp.status !== 200) {
            return callback(xmlhttp.status ? xmlhttp.status : 500);
          }
          return callback(null);
        }
      }
    }
  }
})();
