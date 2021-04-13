'use strict';

const nos = require('nami-utils').os;
const nfile = require('nami-utils').file;
const _ = require('nami-utils/lodash-extra');
const Component = require('./component.js');
const cutils = require('compilation-utils');

/**
* Class representing a Compilable Component
* @namespace BaseComponents.CompilableComponent
* @class
* @extends Component
* @param {Object} metadata - Metadata of the component
* @param {Object} [options]
* @param {Object} [options.logger] - Logger to use
* @property {boolean} supportsParallelBuild=true - Supports compilation using more than one job
* @property {number} maxParallelJobs=Infinity - Maximum number of parallel jobs
* @property {boolean} noDoc=true - Remove documentation from result
*/
class CompilableComponent extends Component {
  constructor(id, version, source, metadata, options) {
    super(id, version, source, metadata, options);
    this.noDoc = true;
    this.sandbox = {runProgram: (cmd, args, opts) => {
      opts = _.opts(opts, {cwd: this.workingDir});
      return cutils.runWithinEnvironment(opts.cwd, cmd, args, this._getCmdOpts(opts));
    }};
  }

  /**
   * Get minify settings:
   * - Regexps to remove
   * - Regexps to keep
   * - Documentation reg exps
   */
  get minifySettings() {
    return {
      toRemoveRegExps: [/.*\.a$/, /.*\.o$/, /.*\.la$/, /.*\.log$/],
      toKeepRegExps: [/.*ImageMagick.*/, /.*libruby-static\.a$/, /.*libv8.*\.a$/, /.*libpg.*\.a$/],
      docRegExps: [/.*\/docs?\//, /.*\/man\//],
    }
  }

  /**
  * Get build libDir
  * @returns {mixed}
  */
  get libDir() {
    return nfile.join(this.prefix, 'lib');
  }
  /**
  * Get build binDir
  * @returns {mixed}
  */
  get binDir() {
    return nfile.join(this.prefix, 'bin');
  }
  /**
  * Get build headersDir
  * @returns {mixed}
  */
  get headersDir() {
    return nfile.join(this.prefix, 'include');
  }
  /**
  * Get component specific environment variables. Empty by default
  * @function BaseComponents.CompilableComponent~getOwnEnvironmentVariables
  */
  getOwnEnvironmentVariables() {
    // return {LDFLAGS: ['-lz']};
    return {};
  }
  /**
  * Get component specific environment variables and values in the current environment
  * @function BaseComponents.CompilableComponent~getEnvVariables
  */
  getEnvVariables() {
    return this.be.getEnvVariables(this.getOwnEnvironmentVariables());
  }
  /**
  * Get general environment variables. Sets CPPFLAGS, LDFLAGS, PATH, DYLD_LIBRARY_PATH and LD_LIBRARY_PATH
  * @function BaseComponents.CompilableComponent~getExportableEnvironmentVariables
  */
  getExportableEnvironmentVariables() {
    const libraries = this.libDir;
    const binaries = this.binDir;
    const headers = this.headersDir;
    const flags = super.getExportableEnvironmentVariables();
    _.extend(flags, {
      CPPFLAGS: [`-I${headers}`],
      // We include the rpath to make sure dependency libraries are found
      LDFLAGS: [`-L${libraries}`, `-Wl,-rpath=${libraries}`],
      PATH: [binaries]
    });
    if (nos.isPlatform('osx')) {
      flags.DYLD_LIBRARY_PATH = [libraries];
    } else {
      flags.LD_LIBRARY_PATH = [libraries];
    }
    return flags;
  }
  /**
  * Clean up actions to reduce final size.
  * It will delelete any '.a', '.o', '.la' or '.log' and will strip any strip any binary found
  * @function BaseComponents.CompilableComponent~minify
  */
  minify() {
    this.logger.debug('Starting cleanup under', this.prefix);
    const files = nfile.glob(nfile.join(this.prefix, '**'));
    const toRemoveRegExps = this.minifySettings.toRemoveRegExps;
    const toKeepRegExps = this.minifySettings.toKeepRegExps;
    const docRegExps = this.minifySettings.docRegExps;
    const match = (str, regexps) => {
      // Return true if str matches with any of the regexps
      return !_.isEmpty(_.filter(regexps, r => str.match(new RegExp(r))));
    };
    _.each(_.compact(files), f => {
      if ((match(f, toRemoveRegExps) && !match(f, toKeepRegExps)) || (this.noDoc && match(f, docRegExps))) {
        // If file matches with regexps to delete and doesn't match with regexps to keep
        // Or documentation is disabled and 'f' matches with a doc folder
        // Delete the file and remove it from the list
        nfile.delete(f);
        _.pull(files, f);
      }
    });
    const filesToStrip = _.filter(files, f => {
      return !nfile.isLink(f) &&
        nfile.isBinary(f) &&
        !f.match(/.*fonts.*/) &&
        !match(f, toKeepRegExps) &&
        (nos.isInPath('file') ? // If 'file' command is not in the system it may strip a binary several times
          !!nos.runProgram('file', `"${f}"`).match('not stripped') // Checks that the file has not been already stripped
          : true);
    });
    if (nos.isInPath('strip')) {
      _.each(filesToStrip, b => {
        try {
          this.logger.trace('Stripping binary file ', b);
          nos.runProgram('strip', `"${b}"`, {logger: null});
        } catch (e) {
          // no-op
        }
      });
    } else {
      this.logger.warn('Error calling \'strip\'. Maybe the command is not available.');
    }
  }

  _getCmdOpts(options) {
    return super._getCmdOpts(_.opts(options, {env: this.getEnvVariables()}));
  }

}

module.exports = CompilableComponent;
