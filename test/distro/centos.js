'use strict';

const Centos = require('../../lib/distro/centos');
const chai = require('chai');
const expect = chai.expect;
const nos = require('nami-utils').os;
const path = require('path');
const sinon = require('sinon');

describe('Centos', () => {
  beforeEach(() => {
    sinon.stub(nos, 'runProgram').callsFake((command, args, options) => {
      options = options || {};
      let text = '';
      switch (command) {
        case 'file':
          text = `${args}: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, ` +
            `interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 2.6.32, BuildID[sha1]=12345, stripped`;
          break;
        case 'ldd':
          text = 'libc.so.6 => /lib/x86_64-linux-gnu/libc.so.6 (0x00007f8526cd7000)' +
            '/lib64/ld-linux-x86-64.so.2 (0x000055e8c385d000)';
          break;
        case 'rpm':
          if (args[0] === '-qf') text = 'glibc-2.17-157.el7_3.1.x86_64\n';
          if (args[0] === '-aq') text = 'glibc 2.17-157,ncurses-libs 5.9,';
          break;
        default:

      }
      return options.retrieveStdStreams ? {stdout: text} : text;
    });
  });
  afterEach(() => {
    nos.runProgram.restore();
  });
  it('provides an update command', () => {
    const centos = new Centos('x64');
    expect(centos.updateCommand).to.be.eql('yum update -y');
  });
  it('provides an install command', () => {
    const centos = new Centos('x64');
    expect(centos.installCommand('zlib')).to.be.eql('yum --setopt=skip_missing_names_on_install=False install -y zlib');
    expect(centos.installCommand(['zlib', 'openssl']))
      .to.be.eql('yum --setopt=skip_missing_names_on_install=False install -y zlib openssl');
  });
  it('returns a list of system packages given a list of files', () => {
    const centos = new Centos('x64');
    expect(centos.getRuntimePackages([path.join(__dirname, 'binary_sample')])).to.be.eql(['glibc']);
  });
  it('returns a list of system packages installed', () => {
    const centos = new Centos('x64');
    expect(centos.listPackages()).to.be.eql([
      {name: 'glibc', version: '2.17-157'},
      {name: 'ncurses-libs', version: '5.9'},
    ]);
  });
});
