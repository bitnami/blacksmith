'use strict';

const distroFactory = require('../../lib/distro');
const chai = require('chai');
const expect = chai.expect;

describe('Distro', () => {
  describe('Factory', () => {
    it('obtains a distribution', () => {
      expect(() => distroFactory.getDistro('debian', 'x64')).to.not.throw();
      expect(() => distroFactory.getDistro('debian', 'amd64')).to.not.throw();
      expect(() => distroFactory.getDistro('centos', 'x86')).to.not.throw();
    });
    it('throws an error for an unknown distro', () => {
      expect(() => distroFactory.getDistro('??', 'x64')).to.throw('Distro type ?? is not supported');
    });
  });
});
