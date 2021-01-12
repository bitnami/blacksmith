'use strict';

const _ = require('lodash');
const Debian = require('./debian.js');

/**
 * Interface representing a Debian Distro with the /lib folder symlinked to /usr/lib
 * This is the case of Distros like Ubuntu 20.04, and it requires a small adaptation in the
 * way the system packages are detected.
 * @namespace BitnamiContainerizedBuilder.ImageProvider.DebianLibSymlinked
 * @extends BitnamiContainerizedBuilder.ImageProvider.Debian
 * @class
 * @param {string} image - Docker image of the distro
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger
 * @property {Object} logger - Logger
 * @property {Object} image - Docker image of the distro
 * @property {Object} packageManagement - Package management tool of the distro
 */
class DebianLibSymlinked extends Debian {
  /**
   * Small fix for the `dpkg -S` command (used in the getRuntimePackages function) to work. As now all the `/lib` references will
   * point to /usr/lib, the dpkg -S command may fail. For example:
   *    dpkg -S libc.so
   *    libc6:amd64: /lib/x86_64-linux-gnu/libc.so.6
   * However, the _parseLibrariesInfo function would return this library path
   *    /usr/lib/x86_64-linux-gnu/libc.so.6
   * That makes dpkg -S fail
   *    dpkg -S /usr/lib/x86_64-linux-gnu/libc.so.6
   *    dpkg-query: no path found matching pattern /usr/lib/x86_64-linux-gnu/libc.so.6
   * It could happen the other way round, that a lib in `/lib` actually belongs to `/usr/lib`.
   * There is no easy way to know if the system packages had `/lib` (example: glibc) or `/usr/lib` (example: libssl)
   * so a way to workaround it is to substitute all `/usr/lib` and `/lib` references to `*\/lib`, which would match both paths
   *
   *    dpkg -S \*\/lib/x86_64-linux-gnu/libc.so.6
   *    libc6:amd64: /lib/x86_64-linux-gnu/libc.so.6
   *
   *    dpkg -S \*\/lib/x86_64-linux-gnu/libssl.so.1.1
   *    libssl1.1:amd64: /usr/lib/x86_64-linux-gnu/libssl.so.1.1
  */
  _parseLibrariesInfo(rawInfo) {
    return _.map(
      super._parseLibrariesInfo(rawInfo),
      path => path.replace(/^([/]usr)?[/]lib/, '*/lib')
    );
  }
}
module.exports = DebianLibSymlinked;
