'use strict';
// STATICS
var APP_NAME = 'ds-server';
var ROOT_FOLDER = '/home/sckmkny/Documents/apps';
// REQUIREMENTS
var flatfile = require('flat-file-db');
var _ = require('lodash');
var GitHubApi = require('github');
var https = require('https');
var unzip = require('unzip');
var fs = require('fs');
var glob = require('glob');
// VARIABLES
var apps;
var db = flatfile(ROOT_FOLDER + '/' + APP_NAME + '.db');
var github = new GitHubApi({
  protocol: 'https',
  host: 'api.github.com',
  headers: {
    'User-Agent': APP_NAME
  }
});
// EXECUTION
db.on('open', handleDbOpen);
function handleDbOpen() {
  apps = db.get('apps');
  if (apps === undefined) {
    apps = [];
    db.put('apps', apps);
  }
  // TODO: REMOVE DEBUG
  install('larkintuckerllc', 'thr0w-client');
}
// TODO: CONVERT TO API
function install(user, repo) {
  if (apps === undefined) {
    // CHANGE TO FAILED STATUS CODE
    console.log('apps not loaded');
    return;
  }
  if (!validUserRepo(user, repo)) {
    console.log('invalid user repo');
  }
  if (_.findIndex(apps, isRepo) !== -1) {
    // CHANGE TO FAILED STATUS CODE
    console.log('already installed');
    return;
  }
  github.repos.getLatestRelease(
    {user: user, repo: repo},
    handleGetLatestRelease
  );
  function handleGetLatestRelease(getLatestReleaseErr, getLatestReleaseRes) {
    var version;
    if (getLatestReleaseErr) {
      // CHANGE TO FAILED STATUS CODE
      console.log(getLatestReleaseErr.code);
      return;
    }
    // jscs: disable
    version = getLatestReleaseRes.tag_name;
    // jscs: enable
    download(
      {user: user, repo: repo, version: version},
      handleDownload
    );
    function handleDownload(downloadErr) {
      if (downloadErr) {
        console.log(downloadErr);
      }
      apps.push({
        user: user,
        repo: repo,
        version: version
      });
      db.put('apps', apps);
    }
  }
  function isRepo(obj) {
    return obj.user === user && obj.repo === repo;
  }
}
// TODO: CONVERT TO API
function uninstall(user, repo) {
  var index;
  if (apps === undefined) {
    // CHANGE TO FAILED STATUS CODE
    console.log('apps not loaded');
    return;
  }
  if (!validUserRepo(user, repo)) {
    console.log('invalid user repo');
  }
  index = _.findIndex(apps, isRepo);
  if (index === -1) {
    // CHANGE TO FAILED STATUS CODE
    console.log('not installed');
    return;
  }
  apps.splice(index, 1);
  db.put('apps', apps);
  function isRepo(obj) {
    return obj.user === user && obj.repo === repo;
  }
}
// TODO: CONVERT TO API
function update(user, repo) {
  var index;
  if (apps === undefined) {
    // CHANGE TO FAILED STATUS CODE
    console.log('apps not loaded');
    return;
  }
  if (!validUserRepo(user, repo)) {
    console.log('invalid user repo');
  }
  index = _.findIndex(apps, isRepo);
  if (index === -1) {
    // CHANGE TO FAILED STATUS CODE
    console.log('not installed');
    return;
  }
  github.repos.getLatestRelease(
    {user: user, repo: repo},
    handleGetLatestRelease
  );
  function handleGetLatestRelease(err, res) {
    var currentVersion = apps[index].version;
    var latestVersion;
    if (err) {
      // CHANGE TO FAILED STATUS CODE
      console.log(err.code);
      return;
    }
    // jscs: disable
    latestVersion = res.tag_name;
    // jscs: enable
    if (currentVersion === latestVersion) {
      // CHANGE TO FAILED STATUS CODE
      console.log('already latest version');
      return;
    }
    apps[index].version = latestVersion;
    db.put('apps', apps);
  }
  function isRepo(obj) {
    return obj.user === user && obj.repo === repo;
  }
}
// TODO: CONVERT TO API
function list() {
  if (apps === undefined) {
    // CHANGE TO FAILED STATUS CODE
    return;
  }
  // TODO: CONVERT TO OUTPUT
  console.log(apps);
}
function validUserRepo(user, repo) {
  if (user === undefined ||
    typeof user !== 'string') {
    return false;
  }
  if (repo === undefined ||
    typeof repo !== 'string') {
    return false;
  }
  return true;
}
function download(userRepoVersion, callback) {
  var user = userRepoVersion.user;
  var repo = userRepoVersion.repo;
  var options = {
    hostname: 'api.github.com',
    port: 443,
    path: '/repos/' +
      user +
      '/' +
      repo +
      '/zipball/' +
      userRepoVersion.version,
    method: 'GET',
    headers: {
      'User-Agent': APP_NAME
    }
  };
  var apiReq = https.request(options, handleAPIRequest);
  apiReq.on('error', handleError);
  apiReq.end();
  function handleAPIRequest(apiRes) {
    var redirectReq;
    switch (apiRes.statusCode) {
      case 200:
        save(apiRes);
        break;
      case 302:
        redirectReq = https.get(apiRes.headers.location, handleRedirectGet);
        redirectReq.on('error', handleError);
        break;
      default:
        handleError();
    }
    function save(stream) {
      stream.pipe(unzip.Extract({path: ROOT_FOLDER})
        .on('close', handleExtractClose));
      function handleExtractClose() {
        glob(ROOT_FOLDER + '/' + user + '-' + repo + '*', {}, handleGlob);
        function handleGlob(globErr, files) {
          if (globErr) {
            callback(500);
          }
          if (files.length !== 1) {
            callback(500);
          }
          fs.rename(
            files[0],
            ROOT_FOLDER + '/' + user + '-' + repo,
            handleRename
          );
          function handleRename(renameErr) {
            if (renameErr) {
              callback(500);
            } else {
              callback();
            }
          }
        }
      }
    }
    function handleRedirectGet(redirectRes) {
      if (redirectRes.statusCode !== 200) {
        handleError();
      }
      save(redirectRes);
    }
  }
  function handleError() {
    callback(500);
  }
}
function remove(userRepo, callback) {
  callback(null);
}
