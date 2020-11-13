'use strict';

/* eslint-disable no-unused-expressions */
const docker = require('docker-utils');
const expect = require('chai').expect;
const ImageBuilder = require('../../../lib/containerized-builder/image-provider/image-builder');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const sinon = require('sinon');

describe('ImageBuilder', () => {
  describe('#build', () => {
    beforeEach(() => {
      sinon.stub(docker, 'build').callsFake((dir, id) => {
        return {code: 0, dir, id};
      });
    });
    afterEach(() => {
      docker.build.restore();
    });
    it('builds for centos an image with requirements', () => {
      const platform = {os: 'linux', distro: 'centos'};
      const imageBuilder = new ImageBuilder([{id: 'test-image', platform, buildTools: []}]);
      const buildDir = nos.createTempDir();
      const additionalRequirement = {
        id: 'test',
        type: 'test',
        installCommands: ['install test'],
        envVars: {PATH: `$PATH:/test/bin`}
      };
      const result = imageBuilder.build(
        'test-image-with-dependencies',
        [
          {id: 'zlib', type: 'system'},
          {id: 'zlib', type: 'system'},
          additionalRequirement
        ],
        platform,
        {buildDir}
      );
      expect(nfile.read(nfile.join(buildDir, 'Dockerfile'))).to.be.eql(
        `FROM test-image\n` +
        `RUN yum update -y\n` +
        `RUN yum --setopt=skip_missing_names_on_install=False install -y zlib\n` +
        `ENV PATH=$PATH:/test/bin\n` +
        `RUN install test\n`
      );
      expect(result).to.be.eql({
        id: 'test-image-with-dependencies',
        buildTools: [{id: 'zlib', type: 'system'}, additionalRequirement]
      });
    });
    it('builds an image for debian with requirements', () => {
      const platform = {os: 'linux', distro: 'debian'};
      const imageBuilder = new ImageBuilder([{id: 'test-image', platform, buildTools: []}]);
      const buildDir = nos.createTempDir();
      const additionalRequirement = {
        id: 'test',
        type: 'test',
        installCommands: ['install test'],
        envVars: {PATH: `$PATH:/test/bin`}
      };
      const result = imageBuilder.build(
        'test-image-with-dependencies',
        [
          {id: 'zlib', type: 'system'},
          additionalRequirement
        ],
        platform,
        {buildDir}
      );
      expect(nfile.read(nfile.join(buildDir, 'Dockerfile'))).to.be.eql(
        `FROM test-image\n` +
        `RUN apt-get update -y\n` +
        `RUN DEBIAN_FRONTEND="noninteractive" apt-get install -y --no-install-recommends zlib\n` +
        `ENV PATH=$PATH:/test/bin\n` +
        `RUN install test\n`
      );
      expect(result).to.be.eql({
        id: 'test-image-with-dependencies',
        buildTools: [{id: 'zlib', type: 'system'}, additionalRequirement]
      });
    });
  });
});
