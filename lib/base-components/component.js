'use strict';
const path = require('path');
const _ = require('nami-utils/lodash-extra');
const Logger = require('nami-logger');
const delegate = require('nami-utils').delegate;
const ncrypt = require('nami-utils/crypto');
const nfile = require('nami-utils').file;
const tarballUtils = require('tarball-utils');
const cutils = require('compilation-utils');

/**
 * Class representing a Component
 * @namespace BaseComponents.Component
 * @class
 * @param {Object} metadata - {@link Recipe} metadata
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 * @property {string} id - Component ID
 * @property {string} version - Current version
 * @property {Object} source
 * @property {string} source.tarball - Path to the tarball of the component
 * @property {string} source.sha256 - SHA256 of the tarball
 * @property {Array} patches - Patch files to apply
 * @property {number} patchLevel - Patch level to use in the patches applied
 * @property {Array} extraFiles - Additional files to copy in the working directory
 * @property {Array} pick - Files to exclusively pick in the resulting artifact. All the installed files by default.
 * @property {Array} exclude=['.git', '.__empty_dir'] - Files to exclude in the resulting artifact
 * @property {Object} be - {@link Blacksmith.BuildEnvironment Build Environment} to use
 * @property {Object} logger - Logger to use
 * @property {Object} metadata - Metadata of the componentList
 */
class Component {
  constructor(id, version, source, metadata, options) {
    options = _.options(options, {
      patches: [],
      extraFiles: [],
      logger: null,
    });
    this.id = id;
    this.version = version;
    this.source = source;
    this.patches = options.patches;
    this.patchLevel = 0;
    this.extraFiles = options.extraFiles;
    this.pick = [];
    this.exclude = ['.git', '.__empty_dir'];
    this.be = null;
    this.logger = options.logger || new Logger();
    this.metadata = _.opts(metadata, {id: null, licenses: [], latest: null});
    this.mainLicense = {};
  }
  /**
  * Get build prefix
  * @returns {mixed}
  */
  get prefix() {
    return path.join(this.be.prefixDir, this.id);
  }
  /**
  * Get build srcDir
  * @returns {mixed}
  */
  get srcDir() {
    return path.join(this.be.sandboxDir, `${this.id.toLowerCase()}-${this.version}`);
  }
  /**
  * Get build workingDir
  * @returns {mixed}
  */
  get workingDir() {
    return this.srcDir;
  }
  /**
  * Get build licenseDir
  * @returns {mixed}
  */
  get licenseDir() {
    return path.join(this.prefix, 'licenses');
  }
  /**
  * Get build extraFilesDir
  * @returns {mixed}
  */
  get extraFilesDir() {
    return path.join(this.workingDir, 'extra-files');
  }

  /**
  * Get build depsDir
  * @returns {mixed}
  */
  get depsDir() {
    return [];
  }

  /**
  * Get build build dependencies of the component.
  * Note: This parameter is only used in containerized-builds
  * @returns {mixed}
  */
  get buildDependencies() {
    return [];
  }
  /**
   * Setup the Component environment
   * @function BaseComponents.Component~setup
   * @param {Object} be - {@link Blacksmith.BuildEnvironment}
   * @param {Object} [options]
   * @param {Object} [options.logger] - Logger to use
   */
  setup(componentList, options) {
    this.be = componentList.be;
    this.componentList = componentList;
    options = _.opts(options, {logger: null});
    this.logger = options.logger || this.logger || new Logger();
    // Convenience methods for easier access
    delegate(this, ['info', 'error', 'warn', 'trace'], this.logger);
  }
  /**
   * Validate the component. No validation will be performed by default
   * @function BaseComponents.Component~validate
   */
  validate() {
  }

  _validateChecksum(file, checksum) {
    const actualChecksum = ncrypt.sha256({file});
    if (actualChecksum !== checksum) {
      throw new Error(
        `Calculated SHA256 of ${file} (${actualChecksum}) ` +
        `doesn't match the given one (${checksum})`
      );
    }
  }
  /**
   * Copy component extra files in extraFilesDir
   * @function BaseComponents.Component~copyExtraFiles
   */
  copyExtraFiles() {
    if (this.extraFiles.length > 0) {
      nfile.mkdir(this.extraFilesDir);
      _.each(this.extraFiles, f => {
        this._validateChecksum(f.path, f.sha256);
        nfile.copy(f.path, this.extraFilesDir);
      });
    }
  }
  /**
   * Copy installed dependencies in depsDir to sandbox
   * @function BaseComponents.Component~copyDependencies
   */
  copyDependencies() {
    if (this.depsDir.length > 0) {
      const sandboxDeps = path.join(this.be.sandboxDir, 'deps');
      nfile.mkdir(sandboxDeps);
      _.each(this.depsDir, d => {
        if (nfile.exists(d)) {
          nfile.copy(d, sandboxDeps);
        }
      });
    }
  }
  _getCmdOpts(options) {
    return _.opts(options, {logger: this.logger});
  }
  /**
   * Apply component patches
   * @function BaseComponents.Component~patch
   */
   /**
   * Applies a patch
   * @function BaseComponents.CompilableComponent~patch
   * @param {string} patchFile - Path to the patch to apply
   * @param {Object} [options] - Additional options to pass to runProgram method
   * @param {number} [options.patchLevel] - Patch level to apply
   * @param {string} [options.cwd=srcDir] - Working directory
   * @returns - LogExec output
   */
  patch(options) {
    options = _.opts(options, {cwd: this.srcDir});
    _.each(this.patches, p => {
      this._validateChecksum(p.path, p.sha256);
      this.logger.trace(`Applying patch ${p.path}`);
      cutils.patch(options.cwd, p.path, this._getCmdOpts({patchLevel: this.patchLevel || 0}));
    });
  }
  /**
   * Return filename for the components license
   * @function BaseComponents.Component~licenseFilename
   */
  get licenseFilename() {
    return `${this.id}-${this.version}.txt`;
  }
  /**
   * Check component license(s) and place them in the a folder inside the component prefix
   * @function BaseComponents.Component~fulfillLicenseRequirements
   */
  fulfillLicenseRequirements() {
    if (!_.isEmpty(this.metadata.licenses)) {
      if (this.metadata.licenses.length > 1) {
        if (_.filter(this.metadata.licenses, 'main', true).length !== 1) {
          throw new Error(`You should define a main license between ${_.pluck(this.metadata.licenses, 'type')}`);
        }
        this.mainLicense = _.filter(this.metadata.licenses, 'main', true)[0];
      } else if (this.metadata.licenses.length === 1) {
        this.mainLicense = this.metadata.licenses[0];
      }
      const destinationLicenseFile = path.join(this.licenseDir, this.licenseFilename);
      nfile.mkdir(this.licenseDir);
      if (this.mainLicense.licenseRelativePath) {
        const srcLicenseFile = path.join(this.srcDir, this.mainLicense.licenseRelativePath);
        if (!nfile.exists(srcLicenseFile)) {
          throw new Error(`License file '${srcLicenseFile}' does not exist`);
        }
        nfile.copy(srcLicenseFile, destinationLicenseFile);
      } else if (this.mainLicense.licenseUrl) {
        nfile.write(destinationLicenseFile, `${this.mainLicense.type}: ${this.mainLicense.licenseUrl}`);
      } else {
        if (this.mainLicense.type === 'CUSTOM') {
          nfile.write(destinationLicenseFile, `Distributed under ${this.mainLicense.type} license`);
        } else {
          throw new Error(`You should specify either a licenseRelativePath or a licenseUrl for a CUSTOM license`);
        }
      }
      if (this.mainLicense.type.match(/^agpl/gi)) {
        const agplLinksFile = path.join(this.licenseDir, 'agpl-source-links.txt');
        nfile.append(agplLinksFile, `${this.id}-${this.version},${this.mainLicense.type},${this.metadata.downloadURL}`);
      }
      if (this.mainLicense.type.match(/^gpl/gi)) {
        const gplLinksFile = path.join(this.licenseDir, 'gpl-source-links.txt');
        nfile.append(gplLinksFile, `${this.id}-${this.version},${this.mainLicense.type},${this.metadata.downloadURL}`);
      }
    } else {
      this.logger.debug(`Skipping license propagation. There is no license information available for ${this.id}`);
    }
  }
  /**
   * Extract component tarball in srcDir
   * @function BaseComponents.Component~extract
   */
  extract() {
    if (_.isEmpty(this.source.tarball)) {
      throw new Error(`The source tarball is missing. Received ${this.source.tarball}`);
    }
    if (!path.isAbsolute(this.source.tarball)) {
      throw new Error(`Path to source tarball should be absolute. Found ${this.source.tarball}`);
    }
    this._validateChecksum(this.source.tarball, this.source.sha256);
    tarballUtils.unpack(this.source.tarball, this.srcDir, {reRoot: true});
  }
  /**
   * After extract hook. No action will be taken by default.
   * @function BaseComponents.Component~postExtract
   */
  postExtract() {}
  /**
   * Delete srcDir
   * @function BaseComponents.Component~cleanup
   */
  cleanup() {
    this.logger.trace(`Deleting ${this.srcDir}`);
    nfile.delete(this.srcDir);
  }
  /**
   * Build hook. No action will be taken by default.
   * @function BaseComponents.Component~build
   */
  build() {}
  /**
   * Post build hook. No action will be taken by default.
   * @function BaseComponents.Component~postBuild
   */
  postBuild() {}
  /**
   * Install hook. No action will be taken by default.
   * @function BaseComponents.Component~install
   */
  install() {}
  /**
   * Post install hook. No action will be taken by default.
   * @function BaseComponents.Component~postInstall
   */
  postInstall() {}
  /**
   * Post install clean up hook. No action will be taken by default.
   * @function BaseComponents.Component~minify
   */
  minify() {}
  /**
   * Hook to initialize component properties. No action will be taken by default.
   * @function BaseComponents.Component~initialize
   */
  initialize() {}
  /**
   * Environment variables to export. None by default.
   * @function BaseComponents.Component~getExportableEnvironmentVariables
   * @returns {Object} Key/value defining the variable name and the value of it
   */
  getExportableEnvironmentVariables() {
    return {};
  }
}
module.exports = Component;
