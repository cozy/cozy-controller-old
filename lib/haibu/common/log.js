/*
 * log.js: Simple utilities for logging.
 *
 */

var haibu = require('../../haibu');


exports.initLog = function() {

  //
  // Log common information
  //
  var evNames = [ 'git:clone', 'git:pull', 'npm:install:load',
    'npm:install:start', 'drone:stop','drone:cleanAll:success',
    'repo:dir:user:create'];
  evNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name);
    });
  });

  var autoStartNames = ['drone:start','repo:dir:exists', 'autostart:checkApp'];
  autoStartNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      if (meta != undefined && meta.app != undefined){
        console.log(message + ": " + name + ":" + meta.app);
      } else {
        console.log(message + ": " + name)
      }
    });
  });

  //
  // Log stdout
  //
  var stdoutNames = ['brunch:build'];
  stdoutNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message + ": " + name + '  ' + meta.stdout); });
  });

  //
  // Log errors
  //
  var errNames = ['error:service' , 'error', 'drone:clean:warning',
    'npm:install:failure','brunch:build:failure', 'drone:cleanAll:warning',
    'git:clone:error']
  errNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(message.red.bold + ": "+ name.red.bold + ": \n" +
        JSON.stringify(meta) + "\n"); });
  });

  //
  // Log starts functions
  //
  var startNames = ['action:start', 'action:stop', 'action:brunch:build',
    'action:light:update','action:clean', 'action:cleanAll, action:restart',
    'action:update']
  startNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      datetime = new Date();
      console.log("[" + datetime + "]\n" +
        name.bold + ": " + meta.app.bold + "\n" + ">>> perform");
    });
  });

  //
  // Log succeded functions
  //
  var succNames = [ 'brunch:build:success', 'cleanAll:success',
  'start:success', 'stop:success', "restart:success", 'update:success',
  'light:update:success','clean:success'];
  succNames.forEach(function (name) {
    haibu.on(name, function (message, meta) {
      console.log(name.green.bold + ": " + meta.app + "\n" + "<<< perform\n");
    });
  });
}