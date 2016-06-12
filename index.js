'use strict';
// STATICS
var APP_NAME = 'ds-server';
// REQUIREMENTS
var path = require('path');
var config = require('config');
var secret = config.get('secret');
var adminPassword = config.get('adminpassword');
var rootFolder = config.get('rootfolder');
var express = require('express');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var BearerStrategy = require('passport-http-bearer').Strategy;
var jwt = require('jwt-simple');
var flatfile = require('flat-file-db');
var _ = require('lodash');
var GitHubApi = require('github');
var https = require('https');
var decompress = require('decompress');
var fs = require('fs');
var glob = require('glob');
var rimraf = require('rimraf');
var multer = require('multer');
// VARIABLES
var apps;
var db = flatfile(path.join(rootFolder,APP_NAME + '.db'));
var github = new GitHubApi({
  protocol: 'https',
  host: 'api.github.com',
  headers: {
    'User-Agent': APP_NAME
  }
});
var uploader = multer({dest: path.join(rootFolder,'tmp')});
// EXECUTION
db.on('open', handleDbOpen);
function handleDbOpen() {
  var app;
  // LOAD DATABASE
  apps = db.get('apps');
  if (apps === undefined) {
    apps = [];
    db.put('apps', apps);
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
    uploader.single('file'),
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
    var user = req.body.user;
    var repo = req.body.repo;
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
            user + '-' + repo + '-upload'), handleMkdir);
          function handleMkdir(mkdirErr) {
            if (mkdirErr) {
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
    var user = req.body.user;
    var repo = req.body.repo;
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
          apps.splice(index, 1);
          db.put('apps', apps);
          res.send({});
        }
      }
      function isRepo(obj) {
        return obj.user === user && obj.repo === repo;
      }
    }
  }
  function update(req, res) {
    var _id = req.user;
    var user = req.body.user;
    var repo = req.body.repo;
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
    var user = req.body.user;
    var repo = req.body.repo;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      var index;
      var sourcePath;
      var source;
      var destination;
      var cancel = false;
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
    var user = req.body.user;
    var repo = req.body.repo;
    var file = req.body.file;
    if (_id === 'admin') {
      success();
    } else {
      return res.status(401).send({});
    }
    function success() {
      if (!validUserRepo(user, repo)) {
        return res.status(400).send({});
      }
      if (file === undefined ||
        typeof file !== 'string') {
        return res.status(400).send({});
      }
      if (_.findIndex(apps, isRepo) === -1) {
        return res.status(404).send({});
      }
      fs.unlink(path.join(rootFolder,
        user + '-' + repo + '-upload', file), handleUnlink);
      function handleUnlink(unlinkErr) {
        if (unlinkErr) {
          return res.status(500).send({});
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
    var user = req.body.user;
    var repo = req.body.repo;
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
  function download(user, repo, version, callback) {
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
        var tempFileName = path.join(rootFolder, 'download.zip');
        var tempFile = fs.createWriteStream(tempFileName);
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
                  callback(500);
                }
                glob(path.join(rootFolder, user + '-' + repo + '*'),
                  {}, handleGlob);
                function handleGlob(globErr, files) {
                  if (globErr) {
                    callback(500);
                  }
                  if (files.length !== 1) {
                    callback(500);
                  }
                  fs.rename(
                    files[0],
                    path.join(rootFolder,user + '-' + repo),
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
  function remove(user, repo, callback) {
    rimraf(path.join(rootFolder, user + '-' + repo), handleRimRaf);
    function handleRimRaf(rimRafErr) {
      if (rimRafErr) {
        callback(500);
        return;
      }
      callback();
    }
  }
}
