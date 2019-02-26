'use strict';

const _ = require('lodash');
const distroFactory = require('../../distro');
const docker = require('docker-utils');
const Logger = require('nami-logger');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;

/**
 * Class representing the Image Builder
 * @namespace Blacksmith.ImageProvider.ImageBuilder
 * @class
 * @param {Array} baseImages - Array of base images available. Each one should be identified with an ID and a platform
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 */
class ImageBuilder {
  constructor(baseImages, options) {
    options = _.defaults({}, options, {logger: new Logger()});
    this.baseImages = baseImages;
    this.logger = options.logger;
  }

  _buildImage(id, buildDir) {
    let result = {code: 100};
    try {
      let cont = 0;
      while (cont < 3 && result.code === 100) {
        result = docker.build(buildDir, id, {retrieveStdStreams: true, noCache: true});
        if (result.code === 100) {
          console.log(`apt-get install failed, retrying`);
        } else if (result.code !== 0) {
          throw new Error(result.stderr);
        }
        cont++;
      }
    } catch (e) {
      this.logger.debug(`Error building Dockerfile:\n${nfile.read(nfile.join(buildDir, 'Dockerfile'))}`);
      this.logger.debug(`== stdout ==\n${result.stdout}\n\n== stderr ==\n${result.stderr}`);
      throw new Error(`Image build failed, files remains at ${buildDir} for inspection:\n${e.message}`);
    }
  }

  _writeDockerfile(dockerfile, baseImageID, buildTools, platform) {
    const distro = distroFactory.getDistro(platform.distro, platform.arch);
    let dockerfileText = `FROM ${baseImageID}\n`;
    if (_.some(buildTools, {type: 'system'})) {
      const systemPackages = _.map(_.filter(buildTools, {type: 'system'}), p => p.id);
      dockerfileText += `RUN ${distro.updateCommand}\n`;
      dockerfileText += `RUN ${distro.installCommand(systemPackages)}\n`;
    }
    if (_.some(buildTools, t => t.type !== 'system')) {
      const nonSystemPackages = _.filter(buildTools, t => t.type !== 'system');
      _.each(nonSystemPackages, pkg => {
        _.each(pkg.envVars, (value, name) => {
          dockerfileText += `ENV ${name}=${value}\n`;
        });
        _.each(pkg.installCommands, command => {
          dockerfileText += `RUN ${command}\n`;
        });
      });
    }
    nfile.write(dockerfile, dockerfileText);
  }

  /**
   * Builds an image that satisfies the given requirements
   * @function  BitnamiContainerizedBuilder.ImageProvider.ImageBuilder~build
   * @param {string} id - ID of the image to build
   * @param {Array|Object} requirements - Array or object with the components to be included
   * @param {Object} platform - Platform of the image to build
   * @param {string} [options.buildDir] - Directory to place files to build
   * @returns {Object} - Object containing the id and the build tools installed
   * @example
   * build('debian-buildpack', [
   *    {'type': 'system', 'id': 'zlib1g'},
   *    {'type': 'nami', 'id': 'ruby', 'installCommands': 'bitnami-pkg install ruby'}
   *  ],
   *  {os: 'linux', distro: 'debian'});
   * // => {
   * //     id: 'debian-buildpack',
   * //     buildTools: [{id: 'ruby', type: 'nami'}, {id: 'zlib1g', type: 'system'}]
   * //    }
   */
  build(id, requirements, platform, options) {
    options = _.defaults({}, options, {buildDir: null});
    this.logger.debug(`Building base image ${id}`);
    const buildDir = options.buildDir || nos.createTempDir({cleanup: false});
    const baseImage = _.find(this.baseImages, {platform});
    if (_.isEmpty(baseImage)) {
      throw new Error(`There is not an available base image satisfying ${JSON.stringify(platform)}`);
    }
    // The new base image should have the new requirements + the tools already available in the base image
    const imageBuildTools = _.uniqBy(baseImage.buildTools.concat(requirements), 'id');
    this._writeDockerfile(nfile.join(buildDir, 'Dockerfile'), baseImage.id, imageBuildTools, platform);
    this._buildImage(id, buildDir);
    this.logger.debug(`Image ${id} succesfully built`);
    return {id, buildTools: imageBuildTools};
  }
}

module.exports = ImageBuilder;
