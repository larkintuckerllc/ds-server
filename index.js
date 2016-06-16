'use strict';
// STATICS
var APP_NAME = 'ds-server';
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
var passport = require('passport');
var path = require('path');
var rimraf = require('rimraf');
// VARIABLES
var adminPassword;
var apps;
var db;
var rootFolder;
var secret;
var startup;
// INITIALIZE
adminPassword = config.get('adminpassword');
rootFolder = config.get('rootfolder');
secret = config.get('secret');
fs.mkdir(path.join(rootFolder, 'tmp'), handleTmpMkdir);
function handleTmpMkdir(tmpMkdirErr) {
  if (tmpMkdirErr && tmpMkdirErr.code !== 'EEXIST') {
    process.exit(1);
  }
  db = flatfile(path.join(rootFolder,APP_NAME + '.db'));
  db.on('open', handleDbOpen);
  function handleDbOpen() {
    // NO DOCUMENTED ERROR HANDLING
    apps = db.get('apps');
    if (apps === undefined) {
      apps = [];
      db.put('apps', apps);
    }
    startup = db.get('startup');
    if (startup === undefined) {
      writeStartupFile(BLANK_STARTUP, handleInitialWriteFile);
    } else {
      ready();
    }
    function handleInitialWriteFile(writeStartupFileErr) {
      if (writeStartupFileErr) {
        process.exit(1);
      }
      startup = BLANK_STARTUP;
      db.put('startup', startup);
      ready();
    }
  }
}
// EXECUTION
function ready() {
  var app;
  var github = new GitHubApi({
    protocol: 'https',
    host: 'api.github.com',
    headers: {
      'User-Agent': APP_NAME
    }
  });
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
    multer({dest: path.join(rootFolder,'tmp')}).single('file'),
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
      github.repos.getLatestRelease(
        {user: user, repo: repo},
        handleGetLatestRelease
      );
      function handleGetLatestRelease(getLatestReleaseErr,
        getLatestReleaseRes) {
        var version;
        if (getLatestReleaseErr) {
          return res.status(getLatestReleaseErr.code).send({});
        }
        // jscs: disable
        version = getLatestReleaseRes.tag_name;
        // jscs: enable
        download(user, repo, version, handleDownload);
        function handleDownload(downloadErr) {
          if (downloadErr) {
            return res.status(500).send({});
          }
          fs.mkdir(path.join(rootFolder,
            user + '-' + repo + '-upload'), handleUploadMkdir);
          function handleUploadMkdir(uploadMkdirErr) {
            if (uploadMkdirErr) {
              return res.status(500).send({});
            }
            apps.push({
              user: user,
              repo: repo,
              version: version
            });
            db.put('apps', apps);
            res.send({});
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
      remove(user, repo, handleRemove);
      function handleRemove(removeErr) {
        if (removeErr) {
          return res.status(500).send({});
        }
        rimraf(path.join(rootFolder, user + '-' + repo + '-upload'),
          handleRimRaf);
        function handleRimRaf(rimRafErr) {
          if (rimRafErr) {
            return res.status(500).send({});
          }
          writeStartupFile(BLANK_STARTUP, handleWriteStartupFile);
          function handleWriteStartupFile(writeStartupFileErr) {
            if (writeStartupFileErr) {
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
      github.repos.getLatestRelease(
        {user: user, repo: repo},
        handleGetLatestRelease
      );
      function handleGetLatestRelease(getLatestReleaseErr,
        getLatestReleaseRes) {
        var currentVersion = apps[index].version;
        var latestVersion;
        if (getLatestReleaseErr) {
          return res.status(getLatestReleaseErr.code).send({});
        }
        // jscs: disable
        latestVersion = getLatestReleaseRes.tag_name;
        // jscs: enable
        if (currentVersion === latestVersion) {
          return res.send({});
        }
        remove(user, repo, handleRemove);
        function handleRemove(handleRemoveErr) {
          if (handleRemoveErr) {
            return res.status(500).send({});
          }
          download(user, repo, latestVersion, handleDownload);
          function handleDownload(downloadErr) {
            if (downloadErr) {
              return res.status(500).send({});
            }
            apps[index].version = latestVersion;
            db.put('apps', apps);
            res.send({});
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
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var cancel = false;
      var destination;
      var index;
      var source;
      var sourcePath;
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
      sourcePath = req.file.path;
      source = fs.createReadStream(sourcePath);
      source.on('error', handleSourceErr);
      destination = fs.createWriteStream(
        path.join(rootFolder, user + '-' + repo + '-upload',
        req.file.originalname));
      destination.on('error', handleDesinationErr);
      destination.on('close', handleDestinationClose);
      source.pipe(destination);
      function handleSourceErr() {
        if (!cancel) {
          cancel = true;
          return res.status(500).send({});
        }
      }
      function handleDesinationErr() {
        if (!cancel) {
          cancel = true;
          return res.status(500).send({});
        }
      }
      function handleDestinationClose() {
        if (!cancel) {
          fs.unlink(sourcePath, handleUnlink);
        }
        function handleUnlink(unlinkErr) {
          if (unlinkErr) {
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
      fs.unlink(path.join(rootFolder,
        user + '-' + repo + '-upload', filename), handleUnlink);
      function handleUnlink(unlinkErr) {
        if (unlinkErr && unlinkErr.code !== 'ENOENT') {
          return res.status(500).send({});
        }
        if (unlinkErr) {
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
        path.join(rootFolder, user + '-' + repo + '-upload'),
        handleReadDir);
      function handleReadDir(readDirErr, files) {
        if (readDirErr) {
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
        if (writeStartupFileErr) {
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
          handleError();
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
                if (unlinkErr) {
                  downloadCallback(500);
                }
                glob(path.join(rootFolder, user + '-' + repo + '*'),
                  {}, handleGlob);
                function handleGlob(globErr, files) {
                  if (globErr) {
                    downloadCallback(500);
                  }
                  if (files.length !== 1) {
                    downloadCallback(500);
                  }
                  fs.rename(
                    files[0],
                    path.join(rootFolder,user + '-' + repo),
                    handleRename
                  );
                  function handleRename(renameErr) {
                    if (renameErr) {
                      downloadCallback(500);
                    } else {
                      downloadCallback();
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
          handleError();
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
      removeCallback();
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
    writeStartupFileCallback();
  }
}
