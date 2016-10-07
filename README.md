[![Build Status](https://api.travis-ci.org/bitnami/blacksmith.svg?branch=master)](http://travis-ci.org/bitnami/blacksmith)

# Blacksmith

Blacksmith is a command line tool based on NodeJS designed to build third-party software and its dependencies on a Unix platform.

  * Compile a list of software components in a specific order.
  * Compile software components in an isolated environment using Docker images.
  * Customise the compilation logic to modify the default behaviour. E.g. customize the arguments to pass to the `configure` command.

>NOTE: Please note this library is currently under active development. Any release versioned 0.x is subject to backwards incompatible changes.


## Installation

Blacksmith is supported in any 64-bit Linux distribution. OS X and Windows platforms are not supported right now. We are open to PRs to support other platforms.

### Development version
Blacksmith requires Node.js and npm already installed on the system. Clone the repo and install dependencies and runtime.

```
$ git clone https://github.com/bitnami/blacksmith
$ cd blacksmith
$ npm install
$ npm run install-runtime
$ bin/blacksmith --help
```

## Get started
Blacksmith provides different ways of operation through its multiple CLI commands, all of them following the format:

```
$ blacksmith [<global-options> | <command> [<command-options> [<command-arguments>]]]
```

  * \<global-options>: Global Blacksmith options that are not specific to any particular sub-command.
  * \<command>: Command to execute: `configure`, `inspect`, `build`, `containerized-build`, `shell`
  * \<command-options>: Options related to the command being executed.
  * \<command-arguments>: Command-specific arguments.

To get more information about a command, you can execute:
`blacksmith <command> --help`

### How to compile third party software
This example demonstrates how to compile the 'zlib' library with Blacksmith. We would need:

  * The source code of `zlib`. It can be found at the [zlib official page's download section](http://www.zlib.net/)
  * A folder where to store the build instructions:
    * A `metadata.json` file for `zlib` component
    * A `index.js` file defining the compilation instructions for `zlib`

>NOTE: This example will assume you have the source tarballs in `/tmp/tarballs` and the recipes in `/tmp/blacksmith-recipes/<component>/`


#### metadata.json
```
{
  "id": "zlib",
  "latest": "1.2.8",
  "licenses": [
    {
      "type": "ZLIB",
      "licenseRelativePath": "README",
      "main": true
    }
  ]
}
```

####index.js
```
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = Zlib;
```

####Compilation action

Configure the Blacksmith default paths to the recipe, if not already configured in `config.json`, and then call the actual compilation command:

```
$> blacksmith configure paths.recipes /tmp/blacksmith-recipes/
$> blacksmith containerized-build zlib@1.2.8:/tmp/tarballs/zlib-1.2.8.tar.gz
blacksm INFO  Preparing build environment
[...]
blacksm INFO  Running build inside docker image <image_id>
[...]
blacksm INFO  Command successfully executed. Find its results under /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard
blacksm INFO  logs: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/logs
blacksm INFO  artifacts: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/artifacts
blacksm INFO  config: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/config
Blacksmith generated the tarball with the component compiled in the artifacts folder.
```

Find more information about Blacksmith features in the [Blacksmith user guide](./docs/Blacksmith.md).

## Licensing
Blacksmith is licensed under the GPL, Version 2.0

See the [COPYING](./COPYING) file for the full license text.

## Contributing
Before submitting a pull request, please make sure the following is done:

  * Fork the repo and create your branch from master.
  * If you've added code that should be tested, please add a test
  * Ensure the test suite passes (`npm test`).
  * Make sure your code lints (`eslint`)
  * In order to accept your pull request, we need you to submit this [CLA](./CLA.txt)
