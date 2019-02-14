'use strict';

const _ = require('lodash');
const Distro = require('./distro.js');
const nos = require('nami-utils').os;

/**
 * Interface representing a Debian Distro
 * @namespace BitnamiContainerizedBuilder.ImageProvider.Debian
 * @extends BitnamiContainerizedBuilder.ImageProvider.Distro
 * @class
 * @param {string} image - Docker image of the distro
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger
 * @property {Object} logger - Logger
 * @property {Object} image - Docker image of the distro
 * @property {Object} packageManagement - Package management tool of the distro
 */
class Centos extends Distro {
  constructor(image, options) {
    super(image, options);
    this._packageManagementTool = 'yum';
    this._pkgProviderCommand = ['rpm', '-qf'];
  }
  _versionRegexp(pkg) {
    return new RegExp(
      `Available Packages\\s*\\nName\\s*:\\s*${this._escapeRegExp(pkg)}\\s*\\n(?:.*:.*\\n)*Version\\s*:\\s*(.*)`,
      'm'
    );
  }
  _yumOptions() {
    if (this._packageManagementTool === 'yum') {
      return ['--setopt=skip_missing_names_on_install=False'];
    }
    return [];
  }
  installCommand(pkgs) {
    return `${this._packageManagementTool} ${this._yumOptions().join(' ')} install -y ${_.flatten([pkgs]).join(' ')}`;
  }
  _getPkgNameFromDescriptor(descriptor) {
    return descriptor.match(/(.*?)-[0-9]/m)[1];
  }
  listPackages() {
    const packagesInfo = nos.runProgram('rpm', ['-aq', '--queryformat=%{NAME} %{VERSION},']);
    const packages = _.compact(packagesInfo.split(','));
    return _.map(packages, pkg => {
      const splittedPkg = pkg.split(' ');
      if (splittedPkg.length !== 2) {
        throw new Error(`Failed to parse system packages information. Expected {{name}} {{version}}, received: ${pkg}`);
      }
      return {
        name: splittedPkg[0],
        version: splittedPkg[1],
      };
    });
  }
}

module.exports = Centos;
