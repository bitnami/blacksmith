'use strict';

const BuildManager = require('../../lib/core/build-manager');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const helpers = require('../helpers');
const DummyConfigHandler = helpers.DummyConfigHandler;
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Build Manager', () => {
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    expect(bm.config.conf).to.be.eql(config.conf);
    expect(bm.logger).to.not.be.empty; // eslint-disable-line no-unused-expressions
    expect(bm.componentProvider).to.not.be.empty; // eslint-disable-line no-unused-expressions
  });
  it('creates a BuildEnvironment with the default data', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const defaultConfig = {
      'outputDir': test.testDir,
      'prefixDir': test.prefix,
      'maxParallelJobs': Infinity,
      'sandboxDir': test.sandbox,
      'artifactsDir': path.join(test.testDir, 'artifacts'),
      'logsDir': path.join(test.testDir, 'logs'),
    };
    bm.createBuildEnvironment();
    _.each(defaultConfig, (v, k) => expect(bm.be[k]).to.be.eql(v));
  });
  it('creates a BuildEnvironment with modified options', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    bm.createBuildEnvironment({platform: {os: 'linux', arch: 'x86', distro: 'debian', version: '8'}});
    const modifiedTarget = {
      'platform': {os: 'linux', arch: 'x86', distro: 'debian', version: '8'},
      'isUnix': true
    };
    expect(bm.be.target).to.be.eql(modifiedTarget);
  });
  it('builds a sample package', function() {
    this.timeout(4000);
    const log = {};
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    const component = helpers.createComponent(test);
    bm.build(component.buildSpec);
    expect(log.text).to.contain(`Build completed. Artifacts stored under '${test.testDir}`);
  });
  it('forces the rebuild', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    bm.build(component.buildSpec);
    bm.build(component.buildSpec, {forceRebuild: true});
    expect(log.text).to.not.contain('Skipping build step');
  });
  it('builds a sample package modifying platform', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    bm.build(component.buildSpec, {platform: {os: 'linux', arch: 'x86', distro: 'debian', version: '8'}});
    const modifiedTarget = {
      platform: {os: 'linux', distro: 'debian', arch: 'x86', version: '8'},
      'isUnix': true
    };
    expect(bm.be.target).to.be.eql(modifiedTarget);
    expect(log.text).to.contain('Building for target {"arch":"x86","os":"linux","distro":"debian","version":"8"}');
  });
  it('continues at a different component', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'sample2'});
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    component.buildSpec.components = component.buildSpec.components.concat(component2.buildSpec.components);
    bm.build(component.buildSpec, {continueAt: component2.id});
    expect(log.text).to.contain(
      `Skipping component ${component.id} ${component.version} because of continueAt=${component2.id}`
    );
  });
  it('uses incrementalTracking and buildDir', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger()});
    bm.build(component.buildSpec, {
      incrementalTracking: true,
      buildDir: test.buildDir,
      platform: {os: 'linux', arch: 'x64', distro: 'debian', version: '8'}
    });
    expect(
      path.join(test.buildDir, 'artifacts/components', `${component.id}-${component.version}-linux-x64-debian-8.tar.gz`)
    ).to.be.file();
  });
  it('setup the buildId', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger()});
    bm.build(component.buildSpec, {
      buildDir: test.buildDir,
      buildId: 'blacksmith-test',
      platform: {os: 'linux', arch: 'x64', distro: 'debian', version: '8'}
    });
    expect(
      path.join(test.buildDir, 'artifacts/blacksmith-test-linux-x64-debian-8.tar.gz')
    ).to.be.file();
  });
});
