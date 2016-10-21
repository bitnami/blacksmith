'use strict';

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;
const helpers = require('blacksmith-test');
const BlacksmithHandler = helpers.Handler;
const blacksmithHandler = new BlacksmithHandler();
const spawnSync = require('child_process').spawnSync;
const configFile = path.join(__dirname, '../config.json');


describe('#configure', function() {
  this.timeout(20000);
  beforeEach(() => spawnSync('cp', [configFile, `${configFile}.bk`]));
  afterEach(() => spawnSync('mv', [`${configFile}.bk`, configFile]));
  it('Throw error when called with wrong arguments', function() {
    expect(() => blacksmithHandler.exec('configure')).to.throw('expects at least 1 argument');
    expect(
      () => blacksmithHandler.exec('configure paths')
    ).to.throw('paths is an Object, you need to specify one of its properties');
    expect(
      () => blacksmithHandler.exec('configure --action add paths.recipes')
    ).to.throw('You need to specify a value');
  });
  function check(property, value) {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf-8'}));
    const actualValue = _.get(config, property);
    return _.eq(actualValue, value);
  }
  function get(property) {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf-8'}));
    return _.get(config, property);
  }
  it('It set a string property', function() {
    blacksmithHandler.exec('configure compilation.prefix /tmp/test');
    expect(check('compilation.prefix', '/tmp/test')).to.be.eql(true);
  });
  it('It set an array property', function() {
    blacksmithHandler.exec('configure --action set paths.recipes /tmp/test');
    expect(check('paths.recipes', ['/tmp/test'])).to.be.eql(true);
  });

  it('It adds a value to an array property', function() {
    const previousValue = get('paths.recipes');
    blacksmithHandler.exec('configure --action add paths.recipes /tmp/test');
    expect(check('paths.recipes', previousValue.concat('/tmp/test'))).to.be.eql(true);
  });
  it('It unset a property', function() {
    blacksmithHandler.exec('configure --action unset compilation.prefix');
    expect(get('compilation.prefix')).to.be.eql(null);
  });
});
