'use strict';
// STATICS
var APP_NAME = 'ds-server';
var ADMIN_APP_USER = 'larkintuckerllc';
var ADMIN_APP_REPO = 'ds-admin';
var DS_SERVER_USER = 'larkintuckerllc';
var DS_SERVER_REPO = 'ds-server';
var THR0W_SERVER_USER = 'larkintuckerllc';
var THR0W_SERVER_REPO = 'thr0w-server';
var BLANK_STARTUP = 'about:blank';
var REDIRECT_BEGIN = [
  '<html>',
  '<head>',
  '<meta http-equiv="refresh" content="0; URL='
].join('\n');
var REDIRECT_END = [
  '" />',
  '</head>',
  '</html>'
].join('\n');
// REQUIREMENTS
var _ = require('lodash');
var BearerStrategy = require('passport-http-bearer').Strategy;
var config = require('config');
var decompress = require('decompress');
var express = require('express');
var flatfile = require('flat-file-db');
var fs = require('fs');
var GitHubApi = require('github');
var glob = require('glob');
var https = require('https');
var jwt = require('jwt-simple');
var LocalStrategy = require('passport-local').Strategy;
var multer = require('multer');
var ncp = require('ncp');
var passport = require('passport');
var path = require('path');
var rimraf = require('rimraf');
// VARIABLES
var adminPassword;
var apps;
var db;
var rootFolder;
var thr0wServerFolder;
var secret;
var startup;
var dsServerVersion;
var thr0wServerVersion;
ncp.limit = 16;
adminPassword = config.get('adminpassword');
rootFolder = config.get('rootfolder');
thr0wServerFolder = config.get('thr0wServerFolder');
secret = config.get('secret');
db = flatfile(path.join(rootFolder, APP_NAME + '.db'));
db.on('open', handleDbOpen);
function handleDbOpen() {
  apps = db.get('apps');
  if (apps !== undefined) {
    return ready();
  }
  // ONE TIME INITIALIZATION
  fs.mkdir(path.join(rootFolder, 'tmp'), handleTmpMkdir);
  function handleTmpMkdir(tmpMkdirErr) {
    if (tmpMkdirErr !== null) {
      process.exit(1);
    }
    fs.mkdir(path.join(rootFolder, 'upload'), handleUploadMkdir);
    function handleUploadMkdir(uploadMkdirErr) {
      if (uploadMkdirErr !== null) {
        process.exit(1);
      }
      writeStartupFile(BLANK_STARTUP, handleWriteStartupFile);
      function handleWriteStartupFile(writeStartupFileErr) {
        if (writeStartupFileErr !== null) {
          process.exit(1);
        }
        copyFile(path.join('apps', 'index.html'),
          path.join(rootFolder, 'index.html'),
          handleCopyFile);
        function handleCopyFile(copyFileErr) {
          if (copyFileErr !== null) {
            process.exit(1);
          }
          ncp(
            path.join('apps', ADMIN_APP_USER + '-' + ADMIN_APP_REPO),
            path.join(rootFolder, ADMIN_APP_USER + '-' + ADMIN_APP_REPO),
            handleNcp
          );
          function handleNcp(ncpErr) {
            if (ncpErr !== null) {
              process.exit(1);
            }
            fs.mkdir(path.join(rootFolder, 'upload',
              ADMIN_APP_USER + '-' + ADMIN_APP_REPO),
                handleAdminAppUploadMkdir);
            function handleAdminAppUploadMkdir(adminAppUploadMkdirErr) {
              if (adminAppUploadMkdirErr !== null) {
                process.exit(1);
              }
              apps = [];
              apps.push({
                user: ADMIN_APP_USER,
                repo: ADMIN_APP_REPO,
                version: '0.0.0'
              });
              db.put('apps', apps);
              db.put('startup', BLANK_STARTUP);
              ready();
            }
          }
        }
      }
    }
  }
}
function ready() {
  var app;
  var github = new GitHubApi({
    protocol: 'https',
    host: 'api.github.com',
    headers: {
      'User-Agent': APP_NAME
    }
  });
  startup = db.get('startup');
  dsServerVersion =
    JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
  try {
    thr0wServerVersion =
      JSON.parse(fs.readFileSync(
      path.join(thr0wServerFolder, 'package.json'), 'utf8')).version;
  }  catch (err) {
    process.exit(1);
  }
  // APP SETUP
  app = express();
  app.use(allowCrossDomain);
  app.use(noCache);
  app.use(require('body-parser').json());
  app.use(require('body-parser').urlencoded({extended: true}));
  passport.use(new LocalStrategy(localStrategyVerify));
  passport.use(new BearerStrategy(bearerStrategyVerify));
  app.use(passport.initialize());
  // ROUTES
  app.post('/api/login/',
    passport.authenticate('local', {session: false}),
    sendToken);
  app.post('/api/valid/',
    passport.authenticate('bearer', {session: false}),
    valid);
  app.post('/api/server_versions/',
    passport.authenticate('bearer', {session: false}),
    serverVersions);
  app.post('/api/install/',
    passport.authenticate('bearer', {session: false}),
    install);
  app.post('/api/uninstall/',
    passport.authenticate('bearer', {session: false}),
    uninstall);
  app.post('/api/update/',
    passport.authenticate('bearer', {session: false}),
    update);
  app.post('/api/upload/',
    passport.authenticate('bearer', {session: false}),
    multer({dest: path.join(rootFolder, 'tmp')}).single('file'),
    upload);
  app.post('/api/delete/',
    passport.authenticate('bearer', {session: false}),
    deleteFile);
  app.post('/api/files/',
    passport.authenticate('bearer', {session: false}),
    files);
  app.post('/api/list/',
    passport.authenticate('bearer', {session: false}),
    list);
  app.get('/api/startup/',
    passport.authenticate('bearer', {session: false}),
    getStartup);
  app.post('/api/startup/',
    passport.authenticate('bearer', {session: false}),
    setStartup);
  // START
  app.listen(3010, listen);
  function allowCrossDomain(req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers',
      'Content-Type, Authorization, Content-Length, X-Requested-With');
    if (req.method === 'OPTIONS') {
      res.send(200);
    } else {
      next();
    }
  }
  function noCache(req, res, next) {
    res.setHeader('cache-control',
      'private, max-age=0, no-cache, no-store, must-revalidate');
    res.setHeader('expires', '0');
    res.setHeader('pragma', 'no-cache');
    next();
  }
  function localStrategyVerify(username, password, done) {
    if (username === 'admin') {
      // EXPECTING ASYNC
      process.nextTick(function() {
        if (password === adminPassword) {
          return done(false, jwt.encode({_id: 'admin'}, secret));
        } else {
          return done(false, false);
        }
      });
    } else {
      return done(false, false);
    }
  }
  function bearerStrategyVerify(token, done) {
    // EXPECTING ASYNC
    process.nextTick(function() {
      var _id;
      try {
        _id = jwt.decode(token, secret)._id;
      } catch (error) {
        return done(null, false);
      }
      return done(null, _id);
    });
  }
  function sendToken(req, res) {
    res.send({
      'token': req.user
    });
  }
  function valid(req, res) {
    var _id = req.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      res.send({});
    }
  }
  function serverVersions(req, res) {
    var _id = req.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      res.send({
        dsServerVersion: dsServerVersion,
        thr0wServerVersion: thr0wServerVersion
      });
    }
  }
  function install(req, res) {
    var _id = req.user;
    var repo = req.body.repo;
    var user = req.body.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      if (_.findIndex(apps, isRepo) !== -1) {
        return res.status(409).send({});
      }
      currentDsServerVersion(handleCurrentDsServerVersion);
      function handleCurrentDsServerVersion(currentDsServerVersionErr,
        isDsCurrent) {
        if (currentDsServerVersionErr) {
          return res.status(503).send({});
        }
        if (!isDsCurrent) {
          return res.status(500).send({});
        }
        currentThr0wServerVersion(handleCurrentThr0wServerVersion);
        function handleCurrentThr0wServerVersion(currentThr0wServerVersionErr,
          isThr0wCurrent) {
          if (currentThr0wServerVersionErr) {
            return res.status(503).send({});
          }
          if (!isThr0wCurrent) {
            return res.status(500).send({});
          }
          github.repos.getLatestRelease(
            {user: user, repo: repo},
            handleGetLatestRelease
          );
          function handleGetLatestRelease(getLatestReleaseErr,
            getLatestReleaseRes) {
            var version;
            var code;
            if (getLatestReleaseErr !== null) {
              code = getLatestReleaseErr.code;
              code = code === 500 ? 503 : code;
              return res.status(code).send({});
            }
            // jscs: disable
            version = getLatestReleaseRes.tag_name;
            // jscs: enable
            apps.push({
              user: user,
              repo: repo,
              version: 'installing'
            });
            db.put('apps', apps);
            res.send({});
            fs.mkdir(path.join(rootFolder, 'upload',
              user + '-' + repo), handleUploadMkdir);
            function handleUploadMkdir(uploadMkdirErr) {
              if (uploadMkdirErr !== null) {
                saveFail();
                return;
              }
              download(user, repo, version, handleDownload);
            }
            function handleDownload(downloadErr) {
              var index = _.findIndex(apps, isRepo);
              if (downloadErr !== null) {
                saveFail();
                return;
              }
              if (index === -1) {
                return;
              }
              apps[index].version = version;
              db.put('apps', apps);
            }
            function saveFail() {
              var index = _.findIndex(apps, isRepo);
              if (index === -1) {
                return;
              }
              apps[index].version = 'failed';
              db.put('apps', apps);
            }
          }
        }
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function uninstall(req, res) {
    var _id = req.user;
    var repo = req.body.repo;
    var user = req.body.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var index;
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      index = _.findIndex(apps, isRepo);
      if (index === -1) {
        return res.status(404).send({});
      }
      if (user === ADMIN_APP_USER && repo === ADMIN_APP_REPO) {
        return res.status(409).send({});
      }
      remove(user, repo, handleRemove);
      function handleRemove(removeErr) {
        if (removeErr !== null) {
          return res.status(500).send({});
        }
        rimraf(path.join(rootFolder, 'upload', user + '-' + repo),
          handleRimRaf);
        function handleRimRaf(rimRafErr) {
          if (rimRafErr !== null) {
            return res.status(500).send({});
          }
          writeStartupFile(BLANK_STARTUP, handleWriteStartupFile);
          function handleWriteStartupFile(writeStartupFileErr) {
            if (writeStartupFileErr !== null) {
              return res.status(500).send({});
            }
            apps.splice(index, 1);
            db.put('apps', apps);
            startup = BLANK_STARTUP;
            db.put('startup', startup);
            res.send({});
          }
        }
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function update(req, res) {
    var _id = req.user;
    var repo = req.body.repo;
    var user = req.body.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var index;
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      index = _.findIndex(apps, isRepo);
      if (index === -1) {
        return res.status(404).send({});
      }
      currentDsServerVersion(handleCurrentDsServerVersion);
      function handleCurrentDsServerVersion(currentDsServerVersionErr,
        isDsCurrent) {
        if (currentDsServerVersionErr) {
          return res.status(503).send({});
        }
        if (!isDsCurrent) {
          return res.status(500).send({});
        }
        currentThr0wServerVersion(handleCurrentThr0wServerVersion);
        function handleCurrentThr0wServerVersion(currentThr0wServerVersionErr,
          isThr0wCurrent) {
          if (currentThr0wServerVersionErr) {
            return res.status(503).send({});
          }
          if (!isThr0wCurrent) {
            return res.status(500).send({});
          }
          github.repos.getLatestRelease(
            {user: user, repo: repo},
            handleGetLatestRelease
          );
          function handleGetLatestRelease(getLatestReleaseErr,
            getLatestReleaseRes) {
            var currentVersion = apps[index].version;
            var latestVersion;
            var code;
            if (getLatestReleaseErr !== null) {
              code = getLatestReleaseErr.code;
              code = code === 500 ? 503 : code;
              return res.status(code).send({});
            }
            // jscs: disable
            latestVersion = getLatestReleaseRes.tag_name;
            // jscs: enable
            if (currentVersion === latestVersion) {
              return res.send({});
            }
            apps[index].version = 'installing';
            db.put('apps', apps);
            remove(user, repo, handleRemove);
            res.send({});
            function handleRemove(handleRemoveErr) {
              if (handleRemoveErr !== null) {
                saveFail();
                return;
              }
              download(user, repo, latestVersion, handleDownload);
              function handleDownload(downloadErr) {
                var index = _.findIndex(apps, isRepo);
                if (downloadErr !== null) {
                  saveFail();
                  return;
                }
                if (index === -1) {
                  return;
                }
                apps[index].version = latestVersion;
                db.put('apps', apps);
              }
              function saveFail() {
                index = _.findIndex(apps, isRepo);
                if (index === -1) {
                  return;
                }
                apps[index].version = 'failed';
                db.put('apps', apps);
              }
            }
          }
        }
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function upload(req, res) {
    var _id = req.user;
    var repo = req.body.repo;
    var user = req.body.user;
    var filename = req.body.filename;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var sourcePath;
      var index;
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      index = _.findIndex(apps, isRepo);
      if (index === -1) {
        return res.status(404).send({});
      }
      if (!req.file) {
        return res.status(404).send({});
      }
      if (filename !== undefined &&
        typeof filename !== 'string') {
        return res.status(400).send({});
      }
      sourcePath = req.file.path;
      copyFile(sourcePath,
        path.join(rootFolder, 'upload', user + '-' + repo,
          filename !== undefined ? filename : req.file.originalname),
        handleCopyFile
      );
      function handleCopyFile(copyFileErr) {
        if (copyFileErr !== null) {
          return res.status(500).send({});
        }
        fs.unlink(sourcePath, handleUnlink);
        function handleUnlink(unlinkErr) {
          if (unlinkErr !== null) {
            return res.status(500).send({});
          }
          res.send({});
        }
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function deleteFile(req, res) {
    var _id = req.user;
    var filename = req.body.filename;
    var repo = req.body.repo;
    var user = req.body.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      if (filename === undefined ||
        typeof filename !== 'string') {
        return res.status(400).send({});
      }
      if (_.findIndex(apps, isRepo) === -1) {
        return res.status(404).send({});
      }
      fs.unlink(path.join(rootFolder, 'upload',
        user + '-' + repo, filename), handleUnlink);
      function handleUnlink(unlinkErr) {
        if (unlinkErr !== null && unlinkErr.code !== 'ENOENT') {
          return res.status(500).send({});
        }
        if (unlinkErr !== null) {
          return res.status(404).send({});
        }
        res.send({});
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function files(req, res) {
    var _id = req.user;
    var repo = req.body.repo;
    var user = req.body.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      if (_.findIndex(apps, isRepo) === -1) {
        return res.status(404).send({});
      }
      fs.readdir(
        path.join(rootFolder, 'upload', user + '-' + repo),
        handleReadDir);
      function handleReadDir(readDirErr, files) {
        if (readDirErr !== null) {
          return res.status(500).send({});
        }
        res.send(files);
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function list(req, res) {
    var _id = req.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      res.send(apps);
    }
  }
  function getStartup(req, res) {
    var _id = req.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      res.send({startup: startup});
    }
  }
  function setStartup(req, res) {
    var _id = req.user;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var value = req.body.startup;
      if (value === undefined ||
        typeof value !== 'string') {
        return res.status(400).send({});
      }
      writeStartupFile(value, handleWriteStartupFile);
      function handleWriteStartupFile(writeStartupFileErr) {
        if (writeStartupFileErr !== null) {
          return res.status(500).send({});
        }
        startup = value;
        db.put('startup', startup);
        res.send({});
      }
    }
  }
  function listen() {
    console.log('listening on *:3010');
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
  function download(user, repo, version, downloadCallback) {
    var apiReq;
    var options = {
      hostname: 'api.github.com',
      port: 443,
      path: '/repos/' +
        user +
        '/' +
        repo +
        '/zipball/' +
        version,
      method: 'GET',
      headers: {
        'User-Agent': APP_NAME
      }
    };
    apiReq = https.request(options, handleAPIRequest);
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
          downloadCallback(500);
      }
      function save(stream) {
        var tempFile;
        var tempFileName = path.join(rootFolder, 'download.zip');
        tempFile = fs.createWriteStream(tempFileName);
        tempFile.on('finish', handleFinish);
        stream.pipe(tempFile);
        function handleFinish() {
          tempFile.close(handleClose);
          function handleClose() {
            decompress(tempFileName, rootFolder).then(handleDecompress);
            function handleDecompress() {
              fs.unlink(tempFileName, handleUnlink);
              function handleUnlink(unlinkErr) {
                if (unlinkErr !== null) {
                  downloadCallback(500);
                  return;
                }
                glob(path.join(rootFolder, user + '-' + repo + '*'),
                  {}, handleGlob);
                function handleGlob(globErr, files) {
                  if (globErr !== null) {
                    downloadCallback(500);
                    return;
                  }
                  if (files.length !== 1) {
                    downloadCallback(500);
                    return;
                  }
                  fs.rename(
                    files[0],
                    path.join(rootFolder, user + '-' + repo),
                    handleRename
                  );
                  function handleRename(renameErr) {
                    if (renameErr !== null) {
                      downloadCallback(500);
                    } else {
                      downloadCallback(null);
                    }
                  }
                }
              }
            }
          }
        }
      }
      function handleRedirectGet(redirectRes) {
        if (redirectRes.statusCode !== 200) {
          downloadCallback(500);
        }
        save(redirectRes);
      }
    }
    function handleError() {
      downloadCallback(500);
    }
  }
  function remove(user, repo, removeCallback) {
    rimraf(path.join(rootFolder, user + '-' + repo), handleRimRaf);
    function handleRimRaf(rimRafErr) {
      if (rimRafErr) {
        removeCallback(500);
        return;
      }
      removeCallback(null);
    }
  }
  function currentDsServerVersion(currentDsServerVersionCallback) {
    github.repos.getLatestRelease(
      {user: DS_SERVER_USER, repo: DS_SERVER_REPO},
      handleGetLatestRelease
    );
    function handleGetLatestRelease(getLatestReleaseErr,
      getLatestReleaseRes) {
      if (getLatestReleaseErr !== null) {
        return currentDsServerVersionCallback(503, null);
      }
      // jscs: disable
      currentDsServerVersionCallback(null,
        getLatestReleaseRes.tag_name === dsServerVersion);
      // jscs: enable
    }
  }
  function currentThr0wServerVersion(currentThr0wServerVersionCallback) {
    github.repos.getLatestRelease(
      {user: THR0W_SERVER_USER, repo: THR0W_SERVER_REPO},
      handleGetLatestRelease
    );
    function handleGetLatestRelease(getLatestReleaseErr,
      getLatestReleaseRes) {
      if (getLatestReleaseErr !== null) {
        return currentThr0wServerVersionCallback(503, null);
      }
      // jscs: disable
      currentThr0wServerVersionCallback(null,
        getLatestReleaseRes.tag_name === thr0wServerVersion);
      // jscs: enable
    }
  }
}
function writeStartupFile(value, writeStartupFileCallback) {
  fs.writeFile(path.join(rootFolder, 'kiosk.html'),
  REDIRECT_BEGIN + value + REDIRECT_END, handleWriteFile);
  function handleWriteFile(writeFileErr) {
    if (writeFileErr) {
      writeStartupFileCallback(500);
      return;
    }
    writeStartupFileCallback(null);
  }
}
function copyFile(sourcePath, destinationPath, copyFileCallback) {
  var cancel = false;
  var source = fs.createReadStream(sourcePath);
  var destination = fs.createWriteStream(destinationPath);
  source.on('error', handleSourceErr);
  destination.on('error', handleDestinationErr);
  destination.on('close', handleDestinationClose);
  source.pipe(destination);
  function handleSourceErr() {
    if (!cancel) {
      cancel = true;
      copyFileCallback(500);
    }
  }
  function handleDestinationErr() {
    if (!cancel) {
      cancel = true;
      copyFileCallback(500);
    }
  }
  function handleDestinationClose() {
    if (!cancel) {
      copyFileCallback(null);
    }
  }
}
