[![Build Status](https://api.travis-ci.org/bitnami/blacksmith.svg?branch=master)](http://travis-ci.org/bitnami/blacksmith)

# Blacksmith

Blacksmith is a command line tool based on NodeJS designed to build third-party software and its dependencies on a Unix platform.

  * Compile a list of software components in a specific order.
  * Generate a Docker Image to compile components in an isolated environment.
  * Customize the compilation logic to modify the default behavior. E.g. customize the arguments to pass to the `configure` command.

>NOTE: Please note this library is currently under active development. Any major release is subject to backwards incompatible changes.

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
  * \<command>: Command to execute: `configure`, `build`, `containerized-build`, `shell`
  * \<command-options>: Options related to the command being executed.
  * \<command-arguments>: Command-specific arguments.

To get more information about a command, you can execute:
`blacksmith <command> --help`

### How to compile third party software
This example demonstrates how to compile the 'zlib' library with Blacksmith. We would need:

  * The source code of `zlib`. It can be found at the [zlib official page's download section](http://www.zlib.net/)
  * A JSON file that should contain:
    * [Optional] The platform you want to build the components for.
    * The list of components that you want to build. Each component should define:
      * Component ID and version
      * [Optional] Additional metadata of the component
      * The path to the tarball with the source code
      * The path to a JavaScript file defining the compilation instructions for `zlib`

#### /tmp/zlib.json
```json
{
  "components": [
    {
      "id": "zlib",
      "version": "1.2.11",
      "metadata": {
        "licenses": [
          {
            "type": "ZLIB",
            "licenseRelativePath": "README",
            "main": true
          }
        ]        
      },
      "recipeLogicPath": "/tmp/zlib.js",
      "source": {
        "tarball": "/tmp/zlib-1.2.11.tar.gz",
        "sha256": "c3e5e9fdd5004dcb542feda5ee4f0ff0744628baf8ed2dd5d66f8ca1197cb1a1"
      }
    }  
  ]
}
```

#### /tmp/zlib.js
```
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = Zlib;
```

#### Configuring Blacksmith

If this is the first time you run Blacksmith you will need to configure it with at least a base image. This image will be used by Blacksmith as the environment for its builds. For doing so you can run:

```bash
>$ blacksmith configure --action add baseImages '{
  "id": "bitnami/minideb-extras:jessie-buildpack",
  "platform": {"os": "linux", "arch": "x64", "distro": "debian", "version": "8"},
  "buildTools":[
    {"id": "build-essential", "type": "system"},
    {"id": "git", "type": "system"},
    {"id": "pkg-config", "type": "system"},
    {"id": "unzip", "type": "system"}
  ]
}'
```

Executing the previous command will configure Blacksmith to use the image `bitnami/minideb-extras:jessie-buildpack` by default. This is a base image based on Debian that has already installed `build-essential`, `git`, `pkg-config` and `unzip`. We should specify those properties in order to Blacksmith to handle build and component requirements.

#### Compilation action

Once you have Blacksmith configured you can call the actual compilation command:

```bash
$> blacksmith containerized-build /tmp/zlib.json
blacksm INFO  Preparing build environment
[...]
blacksm INFO  Running build inside docker image binami/minideb:jessie-extras
[...]
blacksm INFO  Command successfully executed. Find its results under {{blacksmith-output}}
blacksm INFO  logs: {{blacksmith-output}}/logs
blacksm INFO  artifacts: {{blacksmith-output}}/artifacts
blacksm INFO  config: {{blacksmith-output}}/config
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
