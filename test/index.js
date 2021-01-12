'use strict';
/* eslint-disable no-unused-expressions */

// We need a function to run the tests in a logic order
function importTest(path) {
  require(path);
}

describe('Core', () => {
  importTest('./core/artifact');
  importTest('./core/fstracker');
  importTest('./core/build-environment');
  importTest('./core/build-manager');
  importTest('./core/component-provider');
  importTest('./core/component-provider/recipe-logic-provider');
  importTest('./core/component-list');
  importTest('./core/blacksmith');
});

describe('Base Components', () => {
  importTest('./base-components/compilable-component');
  importTest('./base-components/compiled-component');
  importTest('./base-components/component');
  importTest('./base-components/library');
  importTest('./base-components/make-component');
});

describe('Distributions', () => {
  importTest('./distro/debian');
  importTest('./distro/debiansymlinked');
  importTest('./distro/centos');
  importTest('./distro');
});

describe('Container Builder', () => {
  importTest('./containerized-builder/image-provider/image-registry');
  importTest('./containerized-builder/image-provider/image-builder');
  importTest('./containerized-builder/image-provider/image-provider');
  importTest('./containerized-builder');
});

describe('Commands', () => {
  importTest('./commands/help');
  importTest('./commands/configure');
  importTest('./commands/build');
  importTest('./commands/containerized-build');
});
