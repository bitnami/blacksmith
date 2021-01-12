'use strict';

const _ = require('nami-utils/lodash-extra');
const strftime = require('strftime');
const ncrypt = require('nami-utils').crypt;
const nfile = require('nami-utils').file;
const tarballUtils = require('tarball-utils');
const Artifact = require('./artifact');
const distroFactory = require('../../../distro');
const FsTracker = require('./fstracker');

/**
 * Class representing the build Summary
 * @namespace Blacksmith.BuildManager.Summary
 * @class
 * @param {Object} be - {@link Blacksmith.BuildEnvironment}
 * @param {Object} [options]
 * @param {Object} [options.buildId] - Build ID
 * @param {Object} [options.incrementalTracking] - Enable incremental tracking
 * @param {Object} [options.artifactsDir] - Directory used to store the artifacts
 * @property {string} platform - Build platform
 * @property {string} root - Root directory
 * @property {Date} builtOn - Date of build
 * @property {Array} artifacts - List of artifacts built
 * @property {string} startTime - Starting second
 * @property {string} endTime - Final second
 */
class Summary {
  constructor(be, options) {
    options = _.opts(options, {buildId: null, incrementalTracking: false, artifactsDir: null});
    this._fsTracker = options.incrementalTracking ? new FsTracker(be.prefixDir) : null;
    this._be = be;
    this._artifactsDir = options.artifactsDir;
    this.id = options.buildId || strftime('build-%Y%m%d%H%M');
    this.platform = be.platform;
    this.distro = distroFactory.getDistro(be.platform, {logger: options.logger});
    this.root = be.prefixDir;
    this.builtOn = new Date();
    this.artifacts = [];
    this.startTime = process.hrtime()[0];
    this.endTime = null;
    if (this._fsTracker) {
      if (!this._artifactsDir) {
        throw new Error(`Enabling 'incrementalTracking' requires specifying an 'artifactsDir' beforehand`);
      }
      this._fsTracker.init();
    }
  }

  /**
   * Start build time.
   * @function Blacksmith.BuildManager.Summary~start
   */
  start() {
    this.startTime = process.hrtime()[0];
  }

  /**
   * Stop build time.
   * @function Blacksmith.BuildManager.Summary~end
   */
  end() {
    this.endTime = process.hrtime()[0];
  }

  /**
   * Add a new {@link Artifact} to the list
   * @function Blacksmith.BuildManager.Summary~addArtifact
   * @param {Object} component - {@linkcode Component} to add
   */
  addArtifact(component, buildTime) {
    const compiledTarball = {};
    if (this._fsTracker) {
      const artifactId = `${component.id}-${component.version}-${this.platform.toString()}`;
      const artifactTarballTail = nfile.join('components', `${artifactId}.tar.gz`);
      const artifactTarball = nfile.join(this._artifactsDir, artifactTarballTail);
      this._fsTracker.captureDelta(artifactTarball, {
        pathsToInclude: [component.prefix],
        pick: component.pick,
        exclude: component.exclude
      });
      const commit = this._fsTracker.commit(artifactId);
      if (!_.isEmpty(commit) && nfile.exists(artifactTarball)) {
        compiledTarball.path = artifactTarballTail;
        compiledTarball.sha256 = ncrypt.sha256({file: artifactTarball});
      }
    }
    const artifactFiles = FsTracker.filterFiles(nfile.glob(nfile.join(component.prefix, '**')), {
      pick: component.pick,
      exclude: component.exclude,
    });
    const runtimePackages = this.distro.getRuntimePackages(artifactFiles, {
      // We are not interested in obtaining packages for the libraries we have just compiled
      skipLibrariesIn: [this._be.prefixDir]
    });
    this.artifacts.push(new Artifact({
      metadata: component.metadata,
      prefix: component.prefix,
      source: component.source,
      pick: component.pick,
      exclude: component.exclude,
      systemRuntimeDependencies: runtimePackages,
      buildTime,
      compiledTarball
    }));
  }

  /**
   * Compress the result
   * @function Blacksmith.BuildManager.Summary~compressArtifacts
   * @param {string} file - Destination file
   */
  compressArtifacts(file) {
    const pickedFiles = _.last(this.artifacts).pick || [];
    const excludedFiles = [];
    _.each(this.artifacts, artifact => {
      if (artifact.exclude) {
        _.each(artifact.exclude, f => {
          excludedFiles.push(nfile.join(artifact.prefix, f), nfile.join(artifact.prefix, '**', f));
        });
      }
    });
    if (this._fsTracker) {
      const res = this._fsTracker.captureDelta(file, {
        all: true,
        pathsToInclude: _.map(this.artifacts, a => a.prefix),
        pick: pickedFiles,
        exclude: excludedFiles
      });
      if (_.isEmpty(res)) throw new Error('Any file has being modified. Nothing to compress');
    } else {
      nfile.mkdir(nfile.dirname(file));
      const artifactFiles = _.isEmpty(pickedFiles) ? nfile.join(this.root, '*') : pickedFiles;
      tarballUtils.tar(artifactFiles, file, {
        cwd: this.root,
        exclude: excludedFiles});
    }
  }

  /**
  * Return artifact information as a JSON
  * @function Blacksmith.BuildManager.Summary~toJson
  * @param {Object} component - Component to add
  * @param {Object} [extra] - Extra information
  */
  toJson(extra) {
    const data = {
      buildTime: (this.endTime || process.hrtime()[0]) - this.startTime,
      prefix: this.root,
      platform: this.platform,
      builtOn: this.builtOn,
      artifacts: this.artifacts,
      systemRuntimeDependencies: _.uniq(_.flatten(_.map(this.artifacts, artifact => {
        return artifact.systemRuntimeDependencies;
      }))),
      buildTimePackages: this.distro.listPackages()
    };
    if (extra) _.extend(data, extra);
    return JSON.stringify(data, null, 4);
  }

  /**
  * Compress result and write the summary file
  * @function Blacksmith.BuildManager.Summary~serialize
  * @param {Object} directory - Output directory
  */
  serialize(directory) {
    nfile.mkdir(directory);
    const summaryFileId = `${this.id}-${this.platform.toString()}`;
    const tarFileTail = `${summaryFileId}.tar.gz`;
    const tarFile = nfile.join(directory, tarFileTail);
    this.compressArtifacts(tarFile);
    const sha256 = ncrypt.sha256({file: tarFile});
    nfile.write(nfile.join(directory, `${summaryFileId}-build.json`), this.toJson({
      tarball: tarFileTail, sha256: sha256
    }));
  }
}

module.exports = Summary;
