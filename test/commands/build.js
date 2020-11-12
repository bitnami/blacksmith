
'use strict';

const path = require('path');
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const fs = require('fs');
const helpers = require('../helpers');
const BlacksmithHandler = helpers.Handler;

chai.use(chaiSubset);
chai.use(chaiFs);

function _platform(component) {
  return `${component.buildSpec.platform.os}-${component.buildSpec.platform.arch}` +
  `-${component.buildSpec.platform.distro}-${component.buildSpec.platform.version}`;
}

describe('#build()', function() {
  this.timeout(120000);
  const blacksmithHandler = new BlacksmithHandler();
  const jobs = 3;
  beforeEach(helpers.cleanTestEnv);
  afterEach(helpers.cleanTestEnv);

  it('Should throw an error if JSON file doesn\'t exists', function() {
    const test = helpers.createTestEnv();
    expect(function() {
      blacksmithHandler.exec(`--config ${test.configFile} build /unexistent-path.json`);
    }).to.throw('File \'/unexistent-path.json\' does not exists');
  });

  it('Should throw an error if JSON file is not valid', function() {
    const test = helpers.createTestEnv();
    const wrongInputs = {a: 1};
    const inputsFile = path.join(test.buildDir, 'inputs.json');
    fs.writeFileSync(inputsFile, JSON.stringify(wrongInputs));
    expect(function() {
      blacksmithHandler.exec(`--config ${test.configFile} build ${inputsFile}`);
    }).to.throw(
      `Unable to parse ${inputsFile}. Received:\n` +
      `Invalid JSON for the schema build:\n` +
      `instance is not allowed to have the additional property "a"\n` +
      `instance requires property "components"\n`
    );
  });

  it('Builds a simple package from JSON with available options', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const componentFolder = `${component.id}-${component.version}`;
    const res = blacksmithHandler.javascriptExec(
      test.configFile,
      `--log-level trace --log-file ${path.join(test.buildDir, 'test.log')} ` +
      `--config ${test.configFile} ` +
      'build --force-rebuild ' +
      '--incremental-tracking ' +
      `--build-dir ${test.buildDir} ` +
      `--build-id ${component.buildSpec['build-id']} ` +
      `--prefix ${test.buildDir} ` +
      `--max-jobs ${jobs} ` +
      `${component.buildSpecFile}`
    );
    expect(res.code).to.be.eql(0, res.stderr);
    expect(res.stdout).to.contain('Build completed. Artifacts stored');
    // Modifies the log level
    expect(res.stdout).to.match(/blacksm.*TRACE.*ENVIRONMENT VARIABLES/);
    // Set the log file
    expect(path.join(test.buildDir, 'test.log')).to.be.file();
    // Modifies the build directory
    expect(res.stdout).to.contain(`Build completed. Artifacts stored under '${test.buildDir}`);
    // Uses incremental tracking
    expect(path.join(
      test.buildDir, 'artifacts/components', `${component.id}-${component.version}-${_platform(component)}.tar.gz`
    )).to.be.file();
    // Modifies the prefix
    expect(path.join(test.buildDir, 'common')).to.be.a.path();
    // Modifies the maximum number of jobs
    expect(res.stdout).to.contain(`"--jobs=${jobs}"`);
    // Forces rebuilding
    expect(res.stdout).to.contain(`Deleting ${path.join(test.sandbox, componentFolder)}`);
    // Strip components in the minify method
    expect(res.stdout).to.contain('Stripping binary file');
    // Modifies the build ID
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-${_platform(component)}.tar.gz`
      )
    ).to.be.file();
  });
});
