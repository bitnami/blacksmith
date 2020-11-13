'use strict';

/* eslint-disable no-unused-expressions */

const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const helpers = require('../helpers');
const BlacksmithHandler = helpers.Handler;

chai.use(chaiSubset);
chai.use(chaiFs);

function _platform(component) {
  return `${component.buildSpec.platform.os}-${component.buildSpec.platform.arch}` +
  `-${component.buildSpec.platform.distro}-${component.buildSpec.platform.version}`;
}

describe('#containerized-build()', function() {
  this.timeout(240000);
  const blacksmithHandler = new BlacksmithHandler();
  beforeEach(helpers.cleanTestEnv);
  afterEach(helpers.cleanTestEnv);

  it('Should throw an error if JSON file is not valid', function() {
    const test = helpers.createTestEnv();
    const wrongInputs = {a: 1};
    const inputsFile = path.join(test.buildDir, 'inputs.json');
    fs.writeFileSync(inputsFile, JSON.stringify(wrongInputs));
    expect(function() {
      blacksmithHandler.exec(`--config ${test.configFile} containerized-build ${inputsFile}`);
    }).to.throw(
      `Unable to parse ${inputsFile}. Received:\n` +
      `Invalid JSON for the schema containerized-build:\n` +
      `instance is not allowed to have the additional property "a"\n` +
      `instance requires property "components"\n`
    );
  });

  it('Builds a simple package from JSON with available options', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const jobs = 3;
    const buildResult = blacksmithHandler.javascriptExec(
      test.configFile,
      `--log-level trace --log-file ${path.join(test.buildDir, 'test.log')} ` +
      `--config ${test.configFile} ` +
      'containerized-build ' +
      '--incremental-tracking ' +
      `--prefix ${test.buildDir} ` +
      `--build-id ${component.buildSpec['build-id']} ` +
      `--build-dir ${test.buildDir} ` +
      `--max-jobs ${jobs} ` +
      `${component.buildSpecFile}`
    );
    expect(buildResult.code).to.be.eql(0, buildResult.stderr);
    // Modifies the build ID
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-${_platform(component)}.tar.gz`
      )
    ).to.be.file();
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-${_platform(component)}-build.json`
      )
    ).to.be.file();
    // Basic summary content test
    const summary = JSON.parse(fs.readFileSync(path.join(
      test.buildDir,
      'artifacts',
      `${component.buildSpec['build-id']}-${_platform(component)}-build.json`
    )));
    expect(summary).to.include.keys(['prefix', 'platform', 'artifacts', 'tarball', 'sha256']);
    // Modifies the log level
    expect(buildResult.stdout).to.match(/blacksm.*TRACE.*ENVIRONMENT VARIABLES/);
    // Set the log file
    expect(path.join(test.buildDir, 'test.log')).to.be.file();
    // Modifies the build directory - T12761
    expect(buildResult.stdout).to.contain(`Command successfully executed. Find its results under ${test.buildDir}`);
    // Uses incremental tracking
    expect(path.join(
      test.buildDir, 'artifacts/components', `${component.id}-${component.version}-${_platform(component)}.tar.gz`
    )).to.be.file();
    // Modifies the prefix
    expect(buildResult.stdout).to.contain(`--prefix=${test.buildDir}`);
    // Modifies the maximum number of jobs
    expect(buildResult.stdout).to.contain(`"--jobs=${jobs}"`);
  });
  it('Continues a previous build', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {
      id: 'sample2',
    });
    const result = blacksmithHandler.javascriptExec(
      test.configFile,
      `containerized-build --build-dir ${test.buildDir} ` +
      `${component.buildSpecFile}`);
    expect(result.code).to.be.eql(0,
      `Build failed: \n` +
      `stdout:\n` +
      `${result.stdout}\n` +
      `stderr:\n` +
      `${result.stderr}`
    );
    component.buildSpec.components = component.buildSpec.components.concat(component2.buildSpec.components);
    fs.writeFileSync(component.buildSpecFile, JSON.stringify(component.buildSpec));
    const continueBuildRes = blacksmithHandler.javascriptExec(
      test.configFile,
      '--log-level trace ' +
      `--config ${test.configFile} ` +
      'containerized-build ' +
      `--build-dir ${test.buildDir} ` +
      `--build-id ${component2.id} ` +
      `--continue-at ${component2.id} ` +
      `${component.buildSpecFile}`);
    expect(continueBuildRes.stdout).
    to.contain(`Skipping component ${component.id} ${component.version} because of continueAt=${component2.id}`);
    expect(
      path.join(test.buildDir, 'artifacts', `${component2.id}-${_platform(component2)}.tar.gz`)
    ).to.be.file();
  });
  it('Can open a shell and list component content', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const result = blacksmithHandler.javascriptExec(
      test.configFile,
      `containerized-build --build-dir ${test.buildDir} ` +
      `${component.buildSpecFile}`);
    expect(result.code).to.be.eql(0,
      `Build failed: \n` +
      `stdout:\n` +
      `${result.stdout}\n` +
      `stderr:\n` +
      `${result.stderr}`
    );
    blacksmithHandler.asyncExec(`--config ${test.configFile} shell ${test.buildDir}`);
    // Wait 50 seconds for the container to start
    let running = false;
    let retries = 0;
    let blacksmithContainer = null;
    while (!running && retries < 10) {
      const dt = new Date();
      while ((new Date()) - dt <= 5000); // Wait 5 seconds synchronously
      const runningContainers = spawnSync('docker', ['ps']).stdout.toString();
      const printableDate = dt.toISOString().split('T')[0];
      blacksmithContainer = runningContainers.match(new RegExp(`(blacksmith-shell-${printableDate}-[0-9]*)$`, 'm'));
      if (blacksmithContainer) running = true;
      retries++;
    }
    expect(blacksmithContainer).to.not.be.null;
    const blacksmithContainerName = blacksmithContainer[1];
    const content = spawnSync('docker', ['exec', blacksmithContainerName, 'ls', test.prefix]).stdout.toString();
    spawnSync('docker', ['stop', blacksmithContainerName]);
    spawnSync('docker', ['rm', blacksmithContainerName]);
    expect(content).to.contain('common');
  });
});
