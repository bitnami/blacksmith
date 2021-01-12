'use strict';

const Debian = require('./debian');
const Centos = require('./centos');
const Photon = require('./photon');
const DebianLibSymlinked = require('./debianlibsymlinked');

module.exports = {
  getDistro: (platform, options) => {
    let result = null;
    switch (platform.distro) {
      case 'ubuntu': {
        if (platform.version === '20') {
          // Ubuntu 20 has /lib symlinked to /usr/lib
          result = new DebianLibSymlinked(platform.arch, options);
        } else {
          result = new Debian(platform.arch, options);
        }
        break;
      }
      case 'debian': {
        result = new Debian(platform.arch, options);
        break;
      }
      case 'rhel': // RedHat
      case 'amazonlinux': // Amazon Linux
      case 'ol': // Oracle Linux
      case 'centos': {
        result = new Centos(platform.arch, options);
        break;
      }
      case 'photon': {
        result = new Photon(platform.arch, options);
        break;
      }
      default: {
        throw new Error(`Distro type ${platform.distro} is not supported`);
      }
    }
    return result;
  }
};
