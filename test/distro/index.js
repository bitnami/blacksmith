'use strict';

const distroFactory = require('../../lib/distro');
const chai = require('chai');
const expect = chai.expect;

describe('Distro', () => {
  describe('Factory', () => {
    it('obtains a distribution', () => {
      expect(() => distroFactory.getDistro({distro: 'debian', arch: 'x64'}).to.not.throw());
      expect(() => distroFactory.getDistro({distro: 'debian', arch: 'x64'}).to.not.throw());
      expect(() => distroFactory.getDistro({distro: 'debian', arch: 'x64'}).to.not.throw());
    });
    it('throws an error for an unknown distro', () => {
      expect(() => distroFactory.getDistro({distro: '??', arch: 'x64'}).to.throw('Distro type ?? is not supported'));
    });
  });
});
