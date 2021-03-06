/*
 * grunt-contrib-cssmin
 * http://gruntjs.com/
 *
 * Copyright (c) 2016 Tim Branyen, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {
  grunt.registerMultiTask('csslint', 'Lint CSS files with csslint', function() {
    var csslint = require('csslint').CSSLint;
    var stripJsonComments = require('strip-json-comments');
    var ruleset = {};
    var verbose = grunt.verbose;
    var externalOptions = {};
    var combinedResult = {};
    var options = this.options();
    var path = require('path');
    var _ = require('lodash');
    var chalk = require('chalk');
    var absoluteFilePaths = options.absoluteFilePathsForFormatters || false;

    // Read CSSLint options from a specified csslintrc file.
    if (options.csslintrc) {
      var contents = grunt.file.read(options.csslintrc);
      externalOptions = JSON.parse(stripJsonComments(contents));
      // delete csslintrc option to not confuse csslint if a future release
      // implements a rule or options on its own
      delete options.csslintrc;
    }

    // merge external options with options specified in gruntfile
    options = _.assign(options, externalOptions);

    var ruleset = csslint.getRuleset();

    // treat rules as ignored
    options.ignore && options.ignore.forEach(function(rule) {
      ruleset[rule] = 0;
    });

    // treat rules as warning
    options.warnings && options.warnings.forEach(function(rule) {
      ruleset[rule] = 1;
    });

    // treat rules as error
    options.errors && options.errors.forEach(function(rule) {
      ruleset[rule] = 2;
    });

    var hadErrors = false;

    this.filesSrc.forEach(function(filepath) {
      var file = grunt.file.read(filepath),
        message = 'Linting ' + chalk.cyan(filepath) + '...',
        result;

      // skip empty files
      if (file.length) {
        result = csslint.verify(file, ruleset);

        // store combined result for later use with formatters
        combinedResult[filepath] = result;

        hadErrors = result.messages.some(function(msg) {
          return msg.type === "error";
        });

        if (options.useBuiltInFormatter) {
          verbose.write(message);

          if (result.messages.length) {
            verbose.or.write(message);
            grunt.log.error();
          } else {
            verbose.ok();
          }

          result.messages.forEach(function(message) {
            var offenderMessage;
            if (!_.isUndefined(message.line)) {
              offenderMessage =
                chalk.yellow('L' + message.line) +
                chalk.red(':') +
                chalk.yellow('C' + message.col);
            } else {
              offenderMessage = chalk.yellow('GENERAL');
            }

            if (!options.quiet && !options.quiet_all || options.quiet && message.type === 'error' && !options.quiet_all) {
              grunt.log.writeln(chalk.red('[') + offenderMessage + chalk.red(']'));
              grunt.log[ message.type === 'error' ? 'error' : 'writeln' ](
                message.type.toUpperCase() + ': ' +
                message.message + ' ' +
                message.rule.desc +
                ' (' + message.rule.id + ')' +
                ' Browsers: ' + message.rule.browsers
              );
            }

          });
        }
      } else if (options.useBuiltInFormatter) {
        grunt.log.writeln('Skipping empty file ' + chalk.cyan(filepath) + '.');
      }

    });

    // formatted output
    if (options.formatters && Array.isArray(options.formatters)) {
      options.formatters.forEach(function (formatterDefinition) {
        var formatterId = formatterDefinition.id;

        if (formatterId) {
          if (!csslint.hasFormat(formatterId) && _.isObject(formatterId)) { // A custom formatter was supplied
            csslint.addFormatter(formatterId);

            formatterId = formatterId.id;
          }

          var formatter = csslint.getFormatter(formatterId);
          if (formatter) {
            var output = formatter.startFormat();
            _.each(combinedResult, function (result, filename) {
              if (absoluteFilePaths) {
                filename = path.resolve(filename);
              }
              output += formatter.formatResults(result, filename, {});
            });
            output += formatter.endFormat();

            if (formatterDefinition.dest) {
              grunt.file.write(formatterDefinition.dest, output);
            } else {
              grunt.log.writeln(output);
            }
          }
        }
      });
    }

    if (hadErrors) {
      return false;
    }
    
    grunt.log.ok(this.filesSrc.length + grunt.util.pluralize(this.filesSrc.length, ' file/ files') + ' lint free.');
  });
};
