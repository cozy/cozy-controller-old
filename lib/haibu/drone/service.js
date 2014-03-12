/*
 * service.js: RESTful JSON-based web service for the drone module.
 *
 * (C) 2010, Nodejitsu Inc.
 *
 */

var haibu = require('../../haibu');
var fs = require('fs');
var os = require('os');
var exec = require('child_process').exec;


//
// ### function createRouter (dron, logger)
// #### @drone {Drone} Instance of the Drone resource to use in this router.
//
// Creates the Journey router which represents the `haibu` Drone webservice.
//
exports.createRouter = function (drone) {
  //
  // TODO (indexzero): Setup token-based auth for Drone API servers
  //
  haibu.router.strict = false;

  var authToken;
  if (authToken = haibu.config.get('authToken')) {
    //
    // Check if X-Auth-Token header matches with one in options
    //
    haibu.router.every.before = function (next) {

      next = arguments[arguments.length - 1];
      if (this.req.headers['x-auth-token'] === authToken) {
        next();
        return true;
      }

      haibu.sendResponse(this.res, 403, { error: 'Wrong auth token' });
      return false;
    };
  }

  function preventTimeout(next) {
    next = arguments[arguments.length - 1];
    this.req.connection.setTimeout(haibu.config.get('service:timeout') || 60 * 1000 * 15);
    next();
  }

  haibu.router.every.before = haibu.router.every.before ? [
    haibu.router.every.before
  ] : [];

  haibu.router.every.before.push(preventTimeout);

  //
  // ### Default Root
  // `GET /` responds with default JSON message
  //
  haibu.router.get('/', function () {
    haibu.sendResponse(this.res, 400, { message: 'No drones specified' });
  });

  //
  // ### Version Binding
  // `GET /version` returns the version string for this webservice
  //
  haibu.router.get('/version', function () {
    haibu.sendResponse(this.res, 200, { version: 'haibu ' + haibu.version });
  });

  //
  // ### Disk usage information
  //
  //
  haibu.router.get('/diskinfo', function () {
    var res = this.res;
    var freeMemCmd =
      "free | grep cache: | cut -d':' -f2 | sed -e 's/^ *[0-9]* *//'";

    var extractValueFromDfValue = function(val) {
        var unit = val[val.length - 1];
        val = val.substring(0, val.length - 1);
        val = val.replace(',', '.');
        if(unit === 'M') {
          val = "" + (parseFloat(val) / 1000);
        }
        if(unit === 'T') {
          val = "" + (parseFloat(val) * 1000);
        }
        return val;
    }

    var extractDataFromDfResult = function(dir, resp) {
      var currentMountPoint, data, line, lineData, lines, mountPoint, _i, _len;
      data = {};
      lines = resp.split('\n');
      currentMountPoint = '';
      for (_i = 0, _len = lines.length; _i < _len; _i++) {
        line = lines[_i];
        line = line.replace(/[\s]+/g, ' ');
        lineData = line.split(' ');

        if (lineData.length > 5) {
          mountPoint = lineData[5];
          if (dir.indexOf(mountPoint) === 0
              && currentMountPoint.length < mountPoint.length
              && mountPoint.length <= dir.length
              && mountPoint[0] === '/') {
            currentMountPoint = mountPoint;
            data.freeDiskSpace = extractValueFromDfValue(lineData[3]);
            data.usedDiskSpace = extractValueFromDfValue(lineData[1]);
            data.totalDiskSpace = extractValueFromDfValue(lineData[2]);
          }
        }
      }
      return data;
    }

    var getCouchStoragePlace = function(callback) {
      var couchConfigFile, databaseDirLine;

      couchConfigFile = "/usr/local/etc/couchdb/local.ini";
      databaseDirLine = "database_dir";

      fs.readFile(couchConfigFile, function(err, data) {
        var dir, line, lines;
        dir = '/';
        if (!err) {
          lines = data.toString().split('\n');
          for (i = 0; i < lines.length; i++) {
            line = lines[i];
            if (line.indexOf(databaseDirLine) === 0) {
              dir = line.split('=')[1];
            }
          }
        }
        callback(null, dir.trim());
      });
    }

    getCouchStoragePlace(function(err, dir) {
      exec('df -h', function(err, resp) {
        if (err) {
          haibu.sendResponse(res, 500, err);
        } else {
          haibu.sendResponse(res, 200, extractDataFromDfResult(dir, resp));
        }
      });
    });
  });


  //
  // ### Deploys App
  // 'POST /deploy/:userid/:appid'
  //
  haibu.router.post('/deploy/:userid/:appid', { stream: true }, function (userId, appId) {
    var res = this.res;
    drone.deploy(userId, appId, this.req, function (err, result) {
      if (err) {
        haibu.emit(['error', 'service'], 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }
      haibu.sendResponse(res, 200, { drone: result });
    })
  });


  //
  // ### Drones Resource
  // Routes for RESTful access to the Drone resource.
  //
  haibu.router.path('/drones', function () {
    //
    // ### List Apps
    // `GET /drones` returns list of all drones managed by the
    // Drone associated with this router.
    //
    this.get(function () {
      var res = this.res,
          data = { drones: drone.list() };

      haibu.sendResponse(res, 200, data);
    });

    //
    // ### List Drone Processes
    // `GET /drones/running` returns with a list of formatted
    // drone processes.
    //
    this.get('/running', function () {
      haibu.sendResponse(this.res, 200, drone.running());
    });

    //
    // ### Show App
    // `GET /drones/:id` shows details of a drone managed by the
    // Drone associated with this router.
    //
    this.get('/:id', function (id) {
      var data = drone.show(id);
      if (typeof data === 'undefined') {
        haibu.sendResponse(this.res, 404, { message: 'No drone(s) found for application ' + id });
      }
      else {
        haibu.sendResponse(this.res, 200, data);
      }
    });

    //
    // ### Start Drone for App
    // `POST /drone/:id/start` starts a new drone for app with :id on this server.
    //
    this.post('/:id/start', function (id) {
      var res = this.res;

      // Timeout required for long installation on cheap boards like the
      // Rapsberry Pi.
      this.req.connection.setTimeout(3600 * 1000);

      haibu.emit('action:start', 'info', {
        app : id
      })
      // Check if body has a property start
      if (!this.req.body.start) {
        err = new Error("Body hasn't property start");
        haibu.emit('error:service', 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }

      drone.start(this.req.body.start, function (err, result) {
        if (err) {
          haibu.emit(['error', 'service'], 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }
        haibu.emit('start:success', 'info', {
          app : id
        })
        haibu.sendResponse(res, 200, { drone: result });
      });
    });

    //
    // ### Stop Drone for App
    // `POST /drone/:id/stop` stops all drones for app with :id on this server.
    //
    this.post('/:id/stop', function (id) {
      var res = this.res;
      haibu.emit('action:stop', 'info', {
        app : id
      })

      // Check if body has a property stop.name
      if (!this.req.body.stop || !this.req.body.stop.name) {
        err = new Error("Body hasn't property stop.name");
        haibu.emit('error:service', 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }

      drone.stop(this.req.body.stop.name, function (err, result) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }
        haibu.emit('stop:success', 'info', {
          app : id
        })
        haibu.sendResponse(res, 200, {});
      });
    });

    //
    // ### Restart Drone for App
    // `POST /drone/:id/restart` restarts all drones for app with :id on this server.
    //
    this.post('/:id/restart', function (id) {
      var res = this.res;
      haibu.emit('action:restart', 'info', {
        app : id
      })

      // Check if body has a property restart.name
      if (!this.req.body.restart|| !this.req.body.restart.name) {
        err = new Error("Body hasn't property restart.name");
        haibu.emit('error:service', 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }

      drone.restart(this.req.body.restart.name, function (err, drones) {
        if (err) {
          haibu.emit(['error', 'service'], 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }
        haibu.emit('restart:success', 'info', {
          app : id
        })
        haibu.sendResponse(res, 200, { drones: drones });
      });
    });

    //
    // ### Clean Drone for App
    // `POST /drones/:id/clean` removes all of the dependencies and source files for
    // the app with :id on this server.
    //
    this.post('/:id/clean', function (id) {
      var res = this.res;
      haibu.emit('action:clean', 'info', {
        app : id
      })

      drone.clean(this.req.body, function (err, drones) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }
        haibu.emit('clean:success', 'info', {
          app : id
        })
        haibu.sendResponse(res, 200, { clean: true });
      });
    });

    //
    // ### Update Drone for App
    // `POST /drones/:id/update` cleans and starts
    // the app with :id on this server.
    //
    this.post('/:id/update', function (id) {
      var res = this.res;
      haibu.emit('action:update', 'info', {
        app : id
      })

      drone.update(this.req.body, function (err, drones) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }
        haibu.emit('update:success', 'info', {
          app: id
        })
        haibu.sendResponse(res, 200, { update: true });
      });
    });

    //
    // ### Light update
    // `POST /drones/:id/light-update`.
    //
    this.post('/:id/light-update', function (id) {
      var res = this.res;
      haibu.emit('action:light:update', 'info', {
        app : id
      })

      // Check if body has a property update
      if (!this.req.body.update) {
        err = new Error("Body hasn't property update");
        haibu.emit('error:service', 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }

      drone.lightUpdate(this.req.body.update, function (err, result) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        } else {
          haibu.emit('light:update:success', 'info', {
            app : id
          })
          return haibu.sendResponse(res, 200, { drone: result });
        }
      });
    });

    //
    // ### Clean All Drones
    // `POST /drones/cleanall` removes all of the dependencies and source files for
    // all apps on this server.
    //
    this.post('/cleanall', function (response) {
      var res = this.res;
      haibu.emit('action:cleanAll', 'info', {
        app : "all"
      })

      drone.cleanAll(function (err, drones) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        }

        haibu.emit('cleanAll:success', 'info', {
          app: "all"
        })
        haibu.sendResponse(res, 200, { clean: true });
      });
    });

    //
    // ### Build brunch
    // `POST /drones/:id/brunch`. Build brunch for the drone 'id'
    //
    this.post('/:id/brunch', function (id) {
      var res = this.res;
      haibu.emit('action:brunch:build', 'info', {
        app : id
      })

      // Check if body has a property brunch
      if (!this.req.body.brunch) {
        err = new Error("Body hasn't property brunch");
        haibu.emit('error:service', 'error', err);
        return haibu.sendResponse(res, 500, { error: err });
      }

      drone.buildBrunch(this.req.body.brunch, function (isBuild, err) {
        if (err) {
          haibu.emit('error:service', 'error', err);
          return haibu.sendResponse(res, 500, { error: err });
        } else {
          haibu.emit('brunch:build:success', 'info',{
            app: id
          });
          return haibu.sendResponse(res, 200, { brunch: isBuild });
        };
      });
    });
  });
};
