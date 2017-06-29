# Table of contents

* [Introduction](#introduction)
* [Configuration](#configuration)
  * [Useful configuration options](#useful-configuration-options)
* [Basic commands](#basic-commands)
  * [configure](#configure)
  * [build](#build)
  * [containerized-build](#containerized-build)
  * [shell](#shell)
* [Compilation recipes](#compilation-recipes)
* [Examples](#examples)
  * [Building NGINX compiling its dependencies](#building-nginx-compiling-its-dependencies)
  * [Building NGINX using system packages](#building-nginx-using-system-packages)


# Introduction

Blacksmith is a command line tool based on NodeJS designed to build thirdparty software and its dependencies on a Unix platform.

# Configuration
Blacksmith will read its configuration options from the `config.json` file located at the root directory of the tool. If no `config.json` is found and `config.json.sample` is present Blacksmith will install the default configuration.

The configuration can be modified directly editing the file or using the command `blacksmith configure` that is explained below.

Those configuration options can be overridden anytime using the command line by passing options to the `blacksmith` command you are executing.

## Useful configuration options
### compilation.prefix
This option sets the prefix that will be used for the compilation. Every component will be compiled using that prefix.

### paths.output
This option sets the path where Blacksmith will leave the output files and artifacts from the compilation.

### paths.sandbox
This option sets the path where Blacksmith will use for placing source files and compile them.

### plugins
This option sets the plugins that will extend Blacksmith functionality in the form of new commands.

### componentTypeCollections
This option sets the a list of NPM modules that can define one or more Component Types. Those component types allows you to define new types that are not include in the core of Blacksmith. Check the COMPONENT_TYPES Section for more information about the different component types available.

### baseImages
This option is only used when calling the `containerized-build` command. It allows you to define the base images that blacksmith will use to build the component(s). Each base image should define:
 * ID: Docker image name (including tag)
 * Platform: Platform of the base image including OS, architecture and the name and version of the distribution.
 * Build Tools: List of (system) packages available in the base image.

# Basic commands

Blacksmith provides different modes of operation through its multiple CLI commands, all of them following the format:

```bash
$> blacksmith [<global-options> | <command> [<command-options> [<command-arguments>]]]
```

* `<global-options>`: Global Blacksmith options that are not specific to any particular sub-command.
* `<command>`: Command to execute.
* `<command-options>`: Options related to the command being executed.
* `<command-arguments>`: Command-specific arguments.

Let's see the different parts in a real command:

```bash
$> blacksmith --log-level=trace build --build-dir=/tmp /tmp/php.json
```

In the above example, the different parts would be:

* `<global-options>`: `--log-level=trace`: Setting the verbosity of the tool log to the `trace` level.
* `<command>`: `build`: Sub-command used to build packages.
* `<command-options>`: `--build-dir=/tmp`: Option affecting to the sub-command. In this case it provides the path that blacksmith should use as build directory to place its output files.
* `<command-arguments>`: `/tmp/php.json`: Path to the build specification.

Although we will be providing a detailed explanation of the most important commands, you can always get a quick summary of them using the help menu:

```
$> blacksmith --help
blacksmith --help

Usage: blacksmith <options> <command>

 where <options> include:
...
And <command> is one of: configure, build, containerized-build, shell

To get more information about a command, you can execute:

   blacksmith <command> --help
```

## configure

Configure Blacksmith options stored in the `config.json` file:

```
$> blacksmith configure <options> <property> <value>
```

* `<options>`: Can be `--help` or `--action <action>`, where `<action>` can be one of the following: `set (default)`, `unset` or `add`.

Example:

```
$> blacksmith configure paths.output /tmp/blacksmith-output
```

## build

Build a component or a list of components in your system.

```
$> blacksmith build [options] </path/to/build-spec.json>
```

Example:

```
$> blacksmith build /tmp/zlib.json
```

The result is a tarball that contains the component already built from its source tarball and a summary of the build.

## containerized-build

Build a component or a list of components inside a Docker container.

```
$> blacksmith containerized-build <options> </path/to/build-spec.json>
```

Example:

```
$> blacksmith containerized-build /tmp/zlib.json
```

The result is the same than for the `build` command but it will also include all the files required to reproduce the build in another container.

## shell
Opens a bash shell inside the container reproducing the build environment to inspect files and debug compilation issues.
The logs are still available outside the container.

```
$> shell <options> <build-dir>
```

Example:

```
$> blacksmith shell /tmp/blacksmith-output/2016-09-16-145643-php-linux-x64-standard/
```

# Build specifications
In order to build a set of components, Blacksmith needs a JSON file with minimum metadata definitions, the path to the tarball with the source code and the compilation instructions as a JavaScript file.

## build-spec.json
The `build-spec.json` file can contain:

  * [platform] - (Optional) Object defining the target platform. If defined all the properties bellow should be defined as well.
  * [platform.os] - (Optional) Operative System. Default: 'linux'.
  * [platform.arch] - (Optional) Architecture of the platform. Default: 'x64'.
  * [platform.distro] - (Optional) Distribution of the platform. Default: 'debian'.
  * [platform.version] - (Optional) Distribution version. Default: '8'.
  * components - Array of components to build. Each component should define:
  * component.id - ID of the component. For example 'zlib'.
  * component.version - Version of the component. For example '1.2.11'.
  * component.recipeLogicPath - Path to the JavaScript file with the compilation logic.
  * component.source - Object defining the path to the tarball and its checksum.
  * [component.metadata] - (Optional) Additional metadata of the component
  * [component.metadata.licenses] - (Optional) Array of licenses of the component. If defined Blacksmith will copy the licenses specified in the resulting artifact.

Example:

```json
{
  "platform": {"os": "linux", "arch": "x64", "distro": "debian", "version": "8"},
  "components": [{
    "id": "zlib",
    "version": "1.2.11",
    "recipeLogicPath": "/tmp/zlib.js",
    "source": {
      "tarball": "/tmp/zlib-1.2.11.tar.gz",
      "sha256": "c3e5e9fdd5004dcb542feda5ee4f0ff0744628baf8ed2dd5d66f8ca1197cb1a1"
    },
    "metadata": {
      "licenses": [{
        "type": "ZLIB",
        "licenseRelativePath": "README",
        "main": true
      }]
    }
  }]
}
```

## Compilation recipes

This is the main file for defining the build steps that Blacksmith should follow. For doing so you need to implement and export a JavaScript class.

Blacksmith exposes several templates as Core Components so you don't need to implement all the required methods. The available classes are the following ones:

  * `Component`
  * `CompiledComponent`
  * `CompilableComponent`
  * `MakeComponent`
  * `Library`

All the classes will execute the following methods in order (they can be overridden or recalled with `super`):

  * `initialize` -- Can be overridden. Will prepare environment variables and configuration options for the entire workflow
  * `cleanup` -- Not need to override. Will remove files from previous builds if found
  * `extract` -- Not need to override. Will extract the source tarball
  * `copyExtraFiles` -- Not need to override. Will copy extra files defined in `stack.json` (explained at the end of the document)
  * `patch` -- Not need to override. Will apply the patch specified in `stack.json` (explained at the end of the document)
  * `postExtract` -- Can be overridden. Common tasks that execute after extract
  * `build` -- Can be overridden. Contain build instructions
  * `postBuild` -- Can be overridden. Common tasks that execute after the build
  * `install` -- Can be overridden. Copy the compiled files to the right directory
  * `fulfillLicenseRequirements` -- Not need to override. If the license information is defined it checks if it is available in the source code and copies it in the component prefix in order to be included in the resulting tarball
  * `postInstall` -- Can be overridden. Common tasks that execute after the install
  * `minify` -- Not need to override. Remove unnecesary files or folders and strip binary files generated

### Component

This is a basic interface that defines all the available hooks without any specific behavior.

### CompiledComponent

Interface for components that doesn't require compilation. By default this class will have most methods blank as the component does not need to be compiled. It will just copy the source files to the prefix. Inherits from `Component`.

### CompilableComponent

Generic interface for components that are meant to be compiled. It sets up the environment variables required for compiling and defines the method for minifying the resulting artifacts stripping its binaries. Inherits from `Component`.

### MakeComponent

Interface for components that are compiled using a Makefile. This class will modify the common methods adapting them to the most common hooks of a Makefile. This is the schema of the methods executed:

```
build()
  configure() -- Execute the `configure` script of the component setting by default as prefix the generic prefix (setted in the main configuration) + the ID of the component. The options to pass to the `configure` script can be modified redefining the `configureOptions` method (see the section bellow for more details).
  make() -- Call the `make` Unix command. By default it will auto-detect the number of CPUs available and adjust the number of parallel jobs to run. This value can be configured as well in the Blacksmith configuration (compilation.maxParallelJobs).
install()
  make(install) - Call the `make` Unix command with the argument 'install'
```

Every method can be overridden or recalled with `super` to set up specific configurations or build commands.

### Library

This class behaves the same as `MakeComponent` but the default prefix path will be `<conf.prefix>/common` as libraries would likely share the same prefix.

### Example

```javascript
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = zlib;
```

As explained before, `zlib` extends from `Library` so it will be a component compiled through a Makefile setting as prefix <conf.prefix>/common`. In this case we modify the `configureOptions` method to include the flag `--shared` when running the `configure` script.

### configureOptions

As we mentioned, the method `configureOptions` will be used to define the different options to pass to the `configure` script of the component we are compiling. There will be cases in which a component needs to set a configuration option pointing to other component directory. In this situation the method `populateFlagsFromDependencies` become handy. Using this method you can obtain the different paths that other components define. This would be an example:

```javascript
configureOptions() {
    const options = ['--shared'];
    const components = {
      'zlib': ['--with-zlib={{srcDir}}'],
      'pcre': ['--with-pcre={{libDir}}']
    };
    return list.concat(this.componentList.populateFlagsFromDependencies(components);
  }
```

Assuming that the `srcDir` of the `zlib` component is `/sandbox/zlib` and the `libDir` of `pcre` is `/usr/local/lib` the example above it will return an array with `['--shared', '--with-zlib=/sandbox/zlib', '--with-pcre=/usr/local/lib']`.

Note that any of the defined directories can be used. The available options are 'prefix', 'srcDir', 'libDir', 'binDir', 'headersDir', 'workingDir', 'licenseDir' and 'extraFilesDir'.

## Build dependencies

From Blacksmith 2.0 it is possible to specify build dependencies as part of the compilation recipe to define the build tools or libraries required to compile a component. These dependencies will be gathered and installed in a base image prior to the compilation so all the components can benefit from them.

Note that this feature is only available when running a containerized-build.

To specify a build dependency you will need to specify the getter method `buildDependencies` in the JavaScript recipe. For example:

```javascript
get buildDependencies() {
  return [
    {
      id: 'zlib1g-dev',
      type: 'system',
      distro: 'debian'
    },
    {
      id: 'go',
      type: 'go',
      installCommands: [
        'curl https://storage.googleapis.com/golang/go1.8.1.linux-amd64.tar.gz -o go1.8.1.linux-amd64.tar.gz',
        'tar -C /usr/local xf go1.8.1.linux-amd64.tar.gz'
      ],
      envVars: {
        PATH: '$PATH:/usr/local/go/bin'
      }
    }
  ]
}
```

In this example we are installing two different types of build dependencies:
 - First we define a system package. For system packages we just need to specify:
   - The package name.
   - The target distribution. If we are using that recipe in the distribution it sets Blacksmith will automatically handle the installation of the latest package available.

   **Note**: Currently the distributions supported to install system packages are **Centos** and **Debian**.

 - Then we specify a custom type (anything that is not a system package). For these dependencies we need to specify:
   - The dependency ID.
   - The dependency type.
   - The commands required to install the dependency.
   - (Optional) Any environment variable that is required to be set.

In the example above we are installing the system package 'zlib1g-dev', downloading the binary of GO and adding it to the system PATH.

# Examples
## Building NGINX compiling its dependencies
In this example we will build NGINX binaries compiling as well its required dependencies. In this case, the [Nginx webserver](http://nginx.org/) requires `zlib`, `pcre` and `openssl` in order to be built. For more information check the document ["Building nginx from Sources"](http://nginx.org/en/docs/configure.html).

First we will download the source code of all the components. For downloading the source tarballs of this guide you can run:

```sh
curl -SL https://downloads.sourceforge.net/project/libpng/zlib/1.2.11/zlib-1.2.11.tar.gz -o /tmp/zlib-1.2.11.tar.gz
curl -SL https://ftp.pcre.org/pub/pcre/pcre-8.31.tar.gz -o /tmp/pcre-8.31.tar.gz
curl -SL https://www.openssl.org/source/old/1.0.2/openssl-1.0.2i.tar.gz -o /tmp/openssl-1.0.2i.tar.gz
curl -SL http://nginx.org/download/nginx-1.13.0.tar.gz -o /tmp/nginx-1.13.0.tar.gz
```

Now we can write the compilation recipes:

#### zlib compilation recipe
`/tmp/zlib.js`:
```javascript
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = zlib;
```
#### PCRE compilation recipe
`/tmp/pcre.js`:
```javascript
'use strict';

class Pcre extends Library {
  configureOptions() {
    return ['--disable-libtool-lock', '--disable-cpp', '--enable-utf'];
  }
}

module.exports = Pcre;
```
#### OpenSSL compilation recipe
`/tmp/openssl.js`:
```javascript
'use strict';

class OpenSSL extends Library {
  configureOptions() {
    return [`--openssldir=${this.prefix}/openssl`, 'no-idea', 'no-mdc2', 'no-rc5', 'shared'];
  }
  initialize() {
    this.supportsParallelBuild = false;
  }
  configure() {
    super.configure();
    this.make('depend');
  }
}

module.exports = OpenSSL;
```

As we can see the compilation recipe of OpenSSL is a bit more complex:
 - It uses the `initialize` hook to disable parallel jobs when running `make`.
 - It modifies the `configure` hook to:
  - Call configure as in the parent class.
  - Call `make` again with the argument 'depend'

#### NGINX compilation recipe
`/tmp/nginx.js`
```javascript
'use strict';

class Nginx extends MakeComponent {
  postExtract() {
    const configureFlags = '--disable-shared --disable-libtool-lock --disable-cpp';
    $file.substitute(
      path.join(this.srcDir, 'auto/lib/pcre/make'),
      [{pattern: './configure --disable-shared', value: `./configure ${configureFlags}`}]
    );
    $file.substitute(
      path.join(this.srcDir, 'auto/options'),
      [{pattern: 'NGX_RPATH=NO', value: 'NGX_RPATH=YES'}]
    );
  }
  configureOptions() {
    const list = [
      '--with-http_stub_status_module',
      '--with-http_gzip_static_module',
      '--with-mail',
      '--with-http_realip_module',
      '--with-http_stub_status_module',
      '--with-http_v2_module'
    ];
    const componentOptions = {
      'openssl': [
        '--with-ld-opt=-L{{libDir}} -Wl,-rpath={{libDir}}',
        '--with-cc-opt=-I{{headersDir}}',
        '--with-http_ssl_module', '--with-mail_ssl_module'
      ],
      'zlib': ['--with-zlib={{srcDir}}'],
      'pcre': ['--with-pcre={{srcDir}}']
    };
    return list.concat(this.componentList.populateFlagsFromDependencies(componentOptions));
  }
}

module.exports = Nginx;
```

As you can see, in this example we are modifying source files in the `postExtract` hook and setting up the configuration options pointing to `openssl`, `zlib` and `pcre`.

Note that Blacksmith exposes a set of synchronous tools like `$file.substitute` that allows us to easily work with files and other system calls. You can find more information about these tools [here](https://github.com/bitnami/nami/blob/master/docs/Nami.md#built-in-modules).

### Build specification

Once we have all the files required to compile our stack of components we can write the build specification that will be the main input for Blacksmith:
`/tmp/nginx-build-spec.json`:
```json
{
  "components": [
    {
      "id": "zlib",
      "version": "1.2.11",
      "recipeLogicPath": "/tmp/zlib.js",
      "source": {
        "tarball": "/tmp/zlib-1.2.11.tar.gz",
        "sha256": "c3e5e9fdd5004dcb542feda5ee4f0ff0744628baf8ed2dd5d66f8ca1197cb1a1"
      }
    },
    {
      "id": "pcre",
      "version": "8.31",
      "recipeLogicPath": "/tmp/pcre.js",
      "source": {
        "tarball": "/tmp/pcre-8.31.tar.gz",
        "sha256": "4e1f5d462796fdf782650195050953b8503b2a2fc05c31b681c2d5d54d1f659b"
      }
    },
    {
      "id": "openssl",
      "version": "1.0.2i",
      "recipeLogicPath": "/tmp/openssl.js",
      "source": {
        "tarball": "/tmp/openssl-1.0.2i.tar.gz",
        "sha256": "9287487d11c9545b6efb287cdb70535d4e9b284dd10d51441d9b9963d000de6f"
      }
    },
    {
      "id": "nginx",
      "version": "1.13.0",
      "recipeLogicPath": "/tmp/nginx.js",
      "source": {
        "tarball": "/tmp/nginx-1.13.0.tar.gz",
        "sha256": "79f52ab6550f854e14439369808105b5780079769d7b8db3856be03c683605d7"
      }
    }
  ]
}
```

### Compilation action

If it is the first time you run Blacksmith first you need to configure its default base image. You can check how to do it [here](../README.md#configuring-blacksmith).

Now we just need to call blacksmith with the path to the build specification:

```
$> blacksmith containerized-build /tmp/nginx-build-spec.json
blacksm INFO  Running build inside docker image {{blacksmith-base-image}}
blacksm INFO  You can find the full build log under {{blacksmith-output}}/logs/build.log
blacksm INFO  Command successfully executed. Find its results under {{blacksmith-output}}
blacksm INFO  logs: {{blacksmith-output}}/logs
blacksm INFO  artifacts: {{blacksmith-output}}/artifacts
blacksm INFO  config: {{blacksmith-output}}/config
```

## Building NGINX using system packages

In this example we are going to compile the NGINX webserver but this time we won't compile its dependencies. We will rely on system packages to install them. Because of that we need to modify our recipe for NGINX:
`/tmp/nginx-system.js`:
```javascript
'use strict';

class Nginx extends MakeComponent {
  get buildDependencies() {
    return [
      {id: 'zlib1g-dev', type: 'system', distro: 'debian'},
      {id: 'libpcre3-dev', type: 'system', distro: 'debian'},
      {id: 'libssl-dev', type: 'system', distro: 'debian'}
    ]
  }
  postExtract() {
    const configureFlags = '--disable-shared --disable-libtool-lock --disable-cpp';
    $file.substitute(
      path.join(this.srcDir, 'auto/lib/pcre/make'),
      [{pattern: './configure --disable-shared', value: `./configure ${configureFlags}`}]
    );
    $file.substitute(
      path.join(this.srcDir, 'auto/options'),
      [{pattern: 'NGX_RPATH=NO', value: 'NGX_RPATH=YES'}]
    );
  }
  configureOptions() {
    return [
      '--with-http_stub_status_module',
      '--with-http_gzip_static_module',
      '--with-mail',
      '--with-http_realip_module',
      '--with-http_stub_status_module',
      '--with-http_v2_module',
      '--with-http_ssl_module',
      '--with-mail_ssl_module'
    ];
  }
}

module.exports = Nginx;
```

In this recipe we have added as buildDependencies the system packages that installs zlib, PCRE and OpenSSL for Debian and we have removed the configuration options related to those components since NGINX compilation logic will look by default in the system paths. Note that if we want to add support for Centos we would just need to add more buildDependencies setting the ID of the Centos package and specifying 'centos' as `distro`.

Now the build specification will be more simple but we should specify that we want to build NGINX for a Debian platform:
`/tmp/nginx-system-build-spec.json`
```json
{
  "platform": {"os": "linux", "arch": "x64", "distro": "debian", "version": "8"},
  "components": [{
    "id": "nginx",
    "version": "1.13.0",
    "recipeLogicPath": "/tmp/nginx-system.js",
    "source": {
      "tarball": "/tmp/nginx-1.13.0.tar.gz",
      "sha256": "79f52ab6550f854e14439369808105b5780079769d7b8db3856be03c683605d7"
    }
  }]
}
```

### Compilation action
Finally we can call blacksmith with the path to the new build specification:

```
$> blacksmith containerized-build /tmp/nginx-system-build-spec.json
blacksm INFO  Running build inside docker image {{blacksmith-base-image}}
blacksm INFO  You can find the full build log under {{blacksmith-output}}/logs/build.log
blacksm INFO  Command successfully executed. Find its results under {{blacksmith-output}}
blacksm INFO  logs: {{blacksmith-output}}/logs
blacksm INFO  artifacts: {{blacksmith-output}}/artifacts
blacksm INFO  config: {{blacksmith-output}}/config
```

In this case, if we take a look to the build summary that Blacksmith generates at ``{{blacksmith-output}}/artifacts/nginx-1.13.0-stack-linux-x64-debian-8-build.json` we can check that there is a field `systemRuntimeDependencies` that specifies the system packages required at runtime to execute the artifacts binaries.
