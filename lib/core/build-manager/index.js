'use strict';
const _ = require('nami-utils/lodash-extra');
const nos = require('nami-utils').os;
const nfile = require('nami-utils').file;
const util = require('util');
const strftime = require('strftime');
const BuildSummary = require('./artifacts/summary');
const Logger = require('nami-logger');
const ComponentProvider = require('./component-provider');
const BuildEnvironment = require('./build-environment');
const ComponentList = require('./component-list');

/**
 * Class representing Build Manager
 * @namespace Blacksmith.BuildManager
 * @class
 * @param {Object} conf - {@link Blacksmith.ConfigurationHandler Configuration} object
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 * @property {Object} conf - {@link Blacksmith.ConfigurationHandler Configuration}
 * @property {Object} logger - Logger
 * @property {Object} - {@link ComponentProvider}
 */
class BuildManager {
  constructor(confObject, options) {
    options = _.opts(options, {logger: null});
    this.config = confObject;
    this.logger = options.logger || new Logger({
      prefix: 'blacksmith', prefixColor: 'magenta',
      level: this.config.get('logging.logLevel'),
      fileLogLevel: this.config.get('logging.fileLogLevel') || 'trace8',
      logFile: this.config.get('logging.logFile') || nos.getTempFile(util.format('blacksmith_%s.log', strftime('%s')))
    });
    this.componentProvider = new ComponentProvider(
      this.config.get('componentTypeCollections'),
      {
        logger: this.logger,
        metadataServer: this.config.get('metadataServer')
      }
    );
  }

  /**
   * Create a {@link BuildEnvironment} with current configuration
   * @function Blacksmith.BuildManager~createBuildEnvironment
   * @param {Object} [options]
   * @param {Object} [options.platform] - Build platform
   * @returns {@link BuildEnvironment}
   */
  createBuildEnvironment(options) {
    options = options || {};
    this.be = new BuildEnvironment(_.defaults(options, {
      sourcePaths: this.config.get('paths.sources'),
      maxParallelJobs: this.config.get('compilation.maxJobs'),
      platform: options.platform,
      outputDir: this.config.get('paths.output'),
      logsDir: this.config.get('paths.logs') || nfile.join(this.config.get('paths.output'), 'logs'),
      artifactsDir: nfile.join(this.config.get('paths.output'), 'artifacts'),
      prefixDir: this.config.get('compilation.prefix'),
      sandboxDir: this.config.get('paths.sandbox')
    }));
  }

  /**
   * Build a set of components and write a {@link Blacksmith.BuildManager.Summary Summary}
   * @function Blacksmith.BuildManager~build
   * @param {Array|Object} buildData - Array of objects to build or Object including:
   * @param {string} [buildData.platform] - Platform of the build
   * @param {Array} buildData.components - Array of components to build. Each component can be a string or
   * an object defining at least an 'id' (it can also inclde patches or additional files)
   * @param {Object} [options]
   * @param {string} [options.abortOnError=true] - Abort the process if an error validating the component is found
   * @param {string} [options.forceRebuild=false] - Force the complete build of all components
   * @param {string} [options.incrementalTracking=false] - (Under development) Create incremental tarballs per component
   * @param {string} [options.contineAt] - Component to continue the build at
   * @param {Object} [options.platform] - Platform of the build
   * @example
   * build(['zlib', 'openssl'], {buildId: 'my-openssl-stack'});
   */
  build(buildData, options) {
    options = options || {};
    let componentList = null;
    if (_.isReallyObject(buildData)) {
      componentList = buildData.components;
      const platform = options.platform || buildData.platform;
      options = _.opts({platform: platform, buildId: options.buildId}, options);
    } else {
      componentList = buildData;
    }
    this._buildComponents(componentList, options);
  }

  _buildComponent(obj, options) {
    options = _.opts(options, {forceRebuild: false});
    const objPrintableRef = `${obj.id} ${obj.version}`;
    const buildCompleteFile = nfile.join(obj.srcDir, '.buildcomplete');
    const componentAlreadyBuilt = nfile.exists(buildCompleteFile);
    if (componentAlreadyBuilt && !options.forceRebuild) {
      this.logger.info(`Skipping build step for ${objPrintableRef}`);
    } else {
      this.logger.info(`Building ${objPrintableRef}`);
      obj.cleanup();
      obj.extract();
      obj.copyExtraFiles();
      obj.patch();
      obj.postExtract();
      obj.build();
      obj.postBuild();
      nfile.touch(buildCompleteFile);
    }

    this.logger.info(`Installing ${objPrintableRef}`);
    obj.install();
    obj.fulfillLicenseRequirements();
    obj.postInstall();
    obj.copyComponentsWithDependencies();
  }

  _buildComponents(components, options) {
    options = _.opts(options, {platform: null, abortOnError: true, forceRebuild: false,
      continueAt: null, incrementalTracking: false, buildId: null, logger: this.logger});
    if (options.continueAt && options.incrementalTracking) {
      this.logger.warn('Continuing a previous build and tracking the changes is not supported. Disabling tracking');
      options.incrementalTracking = false;
    }
    this.createBuildEnvironment(options);
    const componentList = new ComponentList(
      components,
      this.componentProvider,
      this.be,
      this.config,
      this.logger,
      options
    );
    const componentObjs = componentList.getObjs();
    if (!options.buildId) {
      const lastComponent = _.last(componentObjs);
      options.buildId = `${lastComponent.id}-${lastComponent.version}-stack`;
    }
    if (!options.buildDir) {
      const buildTail = `${strftime('%F-%H%M%S')}-${options.buildId}-${this.be.target.platform.toString()}`;
      options.buildDir = nfile.join(this.be.outputDir, buildTail);
    }
    const artifactsDir = nfile.join(options.buildDir, 'artifacts');
    const buildSummary = new BuildSummary(this.be, {
      buildId: options.buildId, incrementalTracking: options.incrementalTracking, artifactsDir: artifactsDir});
    buildSummary.start();
    let continueAtIndex = 0;
    if (options.continueAt) {
      continueAtIndex = componentList.getIndex(options.continueAt);
      if (continueAtIndex === -1) {
        throw new Error(`Cannot find ${options.continueAt} in the list of components to build`);
      } else {
        this.logger.info(`Instructed to continue at ${options.continueAt}`);
      }
    }

    this.logger.info(`Building for target ${JSON.stringify(this.be.target.platform)}`);
    this.logger.info(`Components to Build: ${componentList.getPrintableList()}`);
    let componentIndex = 0;
    _.each(componentObjs, obj => {
      const startTime = process.hrtime()[0];
      const objPrintableRef = `${obj.id} ${obj.version}`;
      if (componentIndex >= continueAtIndex) {
        this._buildComponent(obj, options);
      } else {
        this.logger.info(`Skipping component ${objPrintableRef} because of continueAt=${options.continueAt}`);
      }
      componentIndex += 1;
      const endTime = process.hrtime()[0];
      // Keep track of available compiled components
      const buildTime = endTime - startTime;
      this.logger.debug(`${objPrintableRef} took ${buildTime} seconds to build`);
      buildSummary.addArtifact(obj, buildTime);
    });
    // Clean after finishing build
    _.each(componentObjs, obj => obj.minify());

    buildSummary.end();
    try {
      nfile.link(options.buildDir, nfile.join(nfile.dirname(options.buildDir), 'latest'), {force: true});
    } catch (e) {
      this.logger.debug('Unable to create symbolic link: ', e.message);
    }
    buildSummary.serialize(artifactsDir);
    this.logger.info(`Build completed. Artifacts stored under '${artifactsDir}'`);
  }
}

module.exports = BuildManager;
