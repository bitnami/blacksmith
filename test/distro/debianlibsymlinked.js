'use strict';

const Debian = require('../../lib/distro/debianlibsymlinked');
const chai = require('chai');
const expect = chai.expect;
const nos = require('nami-utils').os;
const path = require('path');
const sinon = require('sinon');

describe('Debian Lib Symlinked', () => {
  beforeEach(() => {
    sinon.stub(nos, 'isInPath').callsFake(() => true);
    sinon.stub(nos, 'runProgram').callsFake((command, args, options) => {
      options = options || {};
      let text = '';
      switch (command) {
        case 'file':
          text = `${args}: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, ` +
            `interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 2.6.32, BuildID[sha1]=12345, stripped`;
          break;
        case 'objdump':
          text = `${args}: file format elf64-x86-64\n\n` +
              `Dynamic Section:\n` +
              `NEEDED libc.so.6\n`;
          break;
        case 'readelf':
          text = `ELF Header:\n` +
              `Class: ELF64\n` +
              `0x0000000000000001 (NEEDED) Shared library: [libc.so.6]\n`;
          break;
        case 'ldd':
          text = 'libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f8526cd7000)' +
            '/lib64/ld-linux-x86-64.so.2 (0x000055e8c385d000)';
          break;
        case 'dpkg':
          text = 'libc6:amd64: /lib/x86_64-linux-gnu/libc.so.6\n';
          break;
        case 'dpkg-query':
          text = 'libc6:amd64 2.19-18+deb8u7,libcurl3:amd64 7.38.0-4+deb8u5,';
          break;
        default:

      }
      return options.retrieveStdStreams ? {stdout: text} : text;
    });
  });
  afterEach(() => {
    nos.isInPath.restore();
    nos.runProgram.restore();
  });
  it('provides an update command', () => {
    const debian = new Debian('x64');
    expect(debian.updateCommand).to.be.eql('apt-get update -y');
  });
  it('provides an install command', () => {
    const debian = new Debian('x64');
    expect(debian.installCommand('zlib')).to.be.eql('DEBIAN_FRONTEND="noninteractive" apt-get install -y --no-install-recommends zlib');
    expect(debian.installCommand(['zlib', 'openssl']))
      .to.be.eql('DEBIAN_FRONTEND="noninteractive" apt-get install -y --no-install-recommends zlib openssl');
  });
  describe('returns a list of system packages given a list of files', () => {
    ['x64', 'amd64'].forEach(arch => {
        it(`[${arch}] using "file"`, () => {
          nos.isInPath.restore();
          sinon.stub(nos, 'isInPath').callsFake(cmd => cmd === 'file');
          const debian = new Debian(arch);
          expect(debian.getRuntimePackages([path.join(__dirname, 'binary_sample')])).to.be.eql(['libc6']);
        });
        it(`[${arch}] using "objdump"`, () => {
          nos.isInPath.restore();
          sinon.stub(nos, 'isInPath').callsFake(cmd => cmd === 'objdump');
          const debian = new Debian(arch);
          expect(debian.getRuntimePackages([path.join(__dirname, 'binary_sample')])).to.be.eql(['libc6']);
        });
        it(`[${arch}] using "readelf"`, () => {
          nos.isInPath.restore();
          sinon.stub(nos, 'isInPath').callsFake(cmd => cmd === 'readelf');
          const debian = new Debian(arch);
          expect(debian.getRuntimePackages([path.join(__dirname, 'binary_sample')])).to.be.eql(['libc6']);
        });
    });
  });
  it('returns a list of system packages installed', () => {
    const debian = new Debian('x64');
    expect(debian.listPackages()).to.be.eql([
      {name: 'libc6:amd64', version: '2.19-18+deb8u7'},
      {name: 'libcurl3:amd64', version: '7.38.0-4+deb8u5'},
    ]);
  });
  it('/usr/lib references are changed to */lib', () => {
    const debian = new Debian('x64');
    const sampleRawOutput = `
    libcrypto.so.1.1 => /usr/lib/x86_64-linux-gnu/libcrypto.so.1.1 (0x00007f5d61d98000)
    libpthread.so.0 => /lib/x86_64-linux-gnu/libpthread.so.0 (0x00007f5d61d75000)
    `;
    const libInfo = debian._parseLibrariesInfo(sampleRawOutput);
    expect(libInfo.length).to.be.eql(2);
    expect(libInfo[0]).to.be.eql('*/lib/x86_64-linux-gnu/libcrypto.so.1.1');
  });
});
