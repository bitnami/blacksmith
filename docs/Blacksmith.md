# Table of contents

* [Introduction](#introduction)
* [Configuration](#configuration)
  * [Useful configuration options](#useful-configuration-options)
* [Basic commands](#basic-commands)
  * [configure](#configure)
  * [inspect](#inspect)
  * [build](#build)
  * [containerized-build](#containerized-build)
  * [shell](#shell)
* [Compilation recipes](#compilation-recipes)
* [Examples](#examples)
  * [Build a single component](#build-a-single-component)
  * [Build a component and its dependencies](#build-a-component-and-its-dependencies)

# Introduction

Blacksmith is a command line tool based on NodeJS designed to build thirdparty software and its dependencies on a Unix platform.

# Configuration
Blacksmith will read its configuration options from the `config.json` file located at the root directory of the tool.

The configuration can be modified directly editing the file or using the command `blacksmith configure` that is explained below.

Those configuration options can be overriden anytime using the command line by passing options to the `blacksmith` command you are executing.

## Useful configuration options
### compilation.prefix
This option sets the prefix that will be used for the compilation. Every component will be compiled using that prefix.

### paths.recipes
This option sets the path to the recipes directory.

### paths.output
This option sets the path where Blacksmith will leave the output files and artifacts from the compilation.

### plugins
This option sets the plugins that will extend Blacksmith functionality in the form of new commands.
By default you will have `blacksmith-containerized-build-command` plugin enabled. It will allow you to build your component(s) inside an isolated Docker container.

### containerizedBuild.defaultImage
This option is only available when using the `blacksmith-containerized-build-command` plugin and lets you configure the base image that will be used to build the component(s).

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
$> blacksmith --log-level=trace build --json=php.json php@~7
```

In the above example, the different parts would be:

* `<global-options>`: `--log-level=trace`: setting the verbosity of the log output to the `trace` level.
* `<command>`: `build`: sub-command used to build packages.
* `<command-options>`: `--json=php.json`: provides the JSON file with the components that you want to build, in order.
* `<command-arguments>`: `php@~7`: the component you want to build. in addition to the components from the `--json` option.

Although we will be providing a detailed explanation of the most important commands, you can always get a quick summary of them using the help menu:


```
$> blacksmith --help
blacksmith --help

Usage: blacksmith <options> <command>

 where <options> include:
...
And <command> is one of: configure, inspect, build, containerized-build, shell

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


## inspect

Provide information about a component or a list of components based on a recipe or a tarball:

```
$> blacksmith inspect <options> <package[@version]:/path/to/tarball>
```

Example:

```
$> bs inspect zlib@1.2.8:/tmp/tarballs/zlib-1.2.8.tar.gz
{
    "platform": "linux-x64",
    "flavor": null,
    "components": [
        {
            "sourceTarball": "/tmp/tarballs/zlib-1.2.8.tar.gz",
            "patches": [],
            "extraFiles": [],
            "id": "zlib",
            "version": "1.2.8"
        }
    ]
}
```

The result is returned in JSON format so it is easily parseable by external tools.

## build

Build a component or a list of components in your system.

```
$> blacksmith build <options> <package[@version]:/path/to/tarball>
```

Example:

```
$> blacksmith build zlib@1.2.8:/tmp/tarballs/zlib-1.2.8.tar.gz
```

The result is a tarball that contains the component already built from its source tarball.

## containerized-build

Build a component or a list of components inside a Docker container.

>NOTE: This command is only available if the plugin `blacksmith-containerized-build-command` is enabled in `config.json`.

```
$> blacksmith containerized-build <options> <package[@version]:/path/to/tarball>
```

Example:

```
$> blacksmith containerized-build zlib@1.2.8:/tmp/tarballs/zlib-1.2.8.tar.gz
```

Aditionally, you can choose the container image that will be used to run the container where the compilation will take place with the option `--image-id`.

The result is a tarball that contains the component already built from its source tarball.

## shell
Opens a bash shell inside the container reproducing the build environment to inspect files and debug compilation issues.
The logs are still available outside the container

>NOTE: This command is only available if the plugin `blacksmith-containerized-build-command` is enabled in `config.json`.

```
$> shell <options> <build-dir>
```

Example:

```
$> blacksmith shell /tmp/blacksmith-output/2016-09-16-145643-php-linux-x64-standard/
```

# Compilation recipes
In order to build a component, Blacksmith needs a JSON file with minimum metadata definitions and the compilation instructions as a JavaScript file.

## metadata.json
The `metadata.json` file should contain at least the following fields:

  * id
  * latest
  * component.name
  * component.licenses
  * component.licenses[].type
  * component.licenses[].relativePath

By default, Blacksmith will look for the source code using the tarball name `<name>-<version>.tar.gz`, but it can be overriden with the `tarballName` property.

Example:

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

## index.js
In this file we should define a Javascript class, extending from a predefined compilation class, and export it.
It should extend from one the following classes:

  * `CompiledComponent`
  * `MakeComponent`
  * `Library`

All the classes will execute the following methods in order (they can be overriden or recalled with `super`):

  * `initialize` -- Can be overriden. Will prepare environment variables and configuration options for the entire workflow
  * `cleanup` -- Not need to override. Will remove files from previous builds if found
  * `extract` -- Not need to override. Will extract the source tarball
  * `copyExtraFiles` -- Not need to override. Will copy extra files defined in `stack.json` (explained at the end of the document)
  * `patch` -- Not need to override. Will apply the patch specified in `stack.json` (explained at the end of the document)
  * `postExtract` -- Can be overriden. Common tasks that execute after extract
  * `build` -- Can be overriden. Contain build instructions
  * `postBuild` -- Can be overriden. Common tasks that execute after the build
  * `install` -- Can be overriden. Copy the compiled files to the right directory
  * `fulfillLicenseRequirements` -- Not need to override. Check that the defined license is available and copy it in the component prefix in order to be included in the resulting tarball
  * `postInstall` -- Can be overriden. Common tasks that execute after the install
  * `minify` -- Not need to override. Remove unnecesary files or folders and strip binary files generated

### CompiledComponent

By default this class won't execute any additional methods and will have most methods blank as the component does not need to be compiled.

### MakeComponent
This class will modify the common methods and add compilation logic following this schema:

```
build()
  configure(configureOptions()) -- `configureOptions` is a 'getter' method that should return an array with the arguments that the configure script will use (see the example below)
    configure Unix command
  make() -- will call the
    make Unix command
install()
  make(install)
  make install Unix command
```

Every method can be overriden or recalled with `super` to set up specific configurations or build commands.

The default prefix path will be `<path.prefix>/<component_id>`.

### Library
This class behaves the same as `MakeComponent` but the default prefix path will be `<path.prefix>/common` as libraries would likely share the same prefix.

### Example

```
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = Zlib;
```

### configureOptions
When building several components (dependencies) that are required to compile another one (main component), the main component would need to read the prefix of the built dependencies from the configure flags in order to compile against them. For this situation, `populateFlagsFromDependencies` function would be needed.

It will populate the flags related to the dependencies with info about their prefix or other include directories like `libDir`, `headersDir` or `srcDir`.

Example:
```
configureOptions() {
    const list = ['--with-http_stub_status_module', '--with-http_gzip_static_module', '--with-mail',
      '--with-http_realip_module', '--with-http_stub_status_module', '--with-http_v2_module'];
    const components = {
      'openssl': ['--with-ld-opt=-L{{libDir}} -Wl,-rpath={{libDir}}', '--with-cc-opt=-I{{headersDir}}',
        '--with-http_ssl_module', '--with-mail_ssl_module'],
      'zlib': ['--with-zlib={{srcDir}}'],
      'pcre': ['--with-pcre={{srcDir}}']
    };
    return _.union(this.componentList.populateFlagsFromDependencies(components), list);
  }
```

# Examples
## Build a single component
In order to build the `zlib` library with Blacksmith, you would need:

  * The source code of `zlib`. It can be found at the [zlib official page's download section](http://www.zlib.net/)
  * A folder where to store the build instructions:
    * A `metadata.json` file for `zlib` component
    * A `index.js` file defining the compilation instructions for `zlib`

>NOTE: This example will assume you have the source tarballs in `/tmp/tarballs` and the recipes in `/tmp/blacksmith-recipes/<component>/`

>NOTE: The folder name should be the same as the id of the component to be built.

### metadata.json
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
### index.js
```
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = Zlib;
```
### Compilation action
We need to configure the Blacksmith default paths to the recipe and the source tarball (if not already configured in `config.json`) and then call the actual compilation command:

```
$> blacksmith configure paths.recipes /tmp/blacksmith-recipes/
$> blacksmith containerized-build zlib:/tmp/tarballs/zlib-1.2.8
blacksm INFO  Preparing build environment
[...]
blacksm INFO  Running build inside docker image <image_id>
[...]
blacksm INFO  Command successfully executed. Find its results under /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard
blacksm INFO  logs: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/logs
blacksm INFO  artifacts: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/artifacts
blacksm INFO  config: /tmp/blacksmith-output/2016-09-21-202036-zlib-linux-x64-standard/config
```

Blacksmith will generate the tarball with the built component in the `artifacts` folder.

## Build a component and its dependencies
There are components that depend on others to be able to build. For example, the [Nginx webserver](http://nginx.org/) requires `zlib`, `pcre` and `openssl` in order to be built. For more information check the document ["Building nginx from Sources"](http://nginx.org/en/docs/configure.html).

First of all, obtain the source code and the `metadata.json` and `index.js` (recipe) files for every component:

### File descriptions

#### zlib metadata.json
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
#### zlib index.js
```
'use strict';

class Zlib extends Library {
  configureOptions() {
    return ['--shared'];
  }
}

module.exports = Zlib;
```
#### pcre metadata.json
```
{
  "id": "pcre",
  "latest": "8.31",
  "licenses": [
    {
      "type": "BSD3",
      "licenseRelativePath": "README",
      "main": true
    }
  ]
}
```
#### pcre index.js
```
'use strict';

class Pcre extends Library {
  configureOptions() {
    return ['--disable-libtool-lock', '--disable-cpp', '--enable-utf'];
  }
}

module.exports = Pcre;
```
#### openssl metadata.json
```
{
  "id": "openssl",
  "latest": "1.0.2i",
  "licenses": [
    {
      "type": "OpenSSL",
      "licenseRelativePath": "LICENSE",
      "main": true
    }
  ]
}
```
#### openssl index.js
```
'use strict';

class OpenSSL extends Library {
  configureOptions() {
    return [`--openssldir=${this.prefix}/openssl`, 'no-idea', 'no-mdc2', 'no-rc5', 'shared'];
  }
  initialize() {
    this.supportsParallelBuild = false;
  }
  configure() {
    $file.substitute(this.srcDir,
                     '$dir/cacert.pem',
                     path.join(this.prefix, 'openssl/certs/ca-bundle.crt'),
                     {recursive: true});
    super.configure();
    this.make('depend');
  }
  postInstall() {
    $file.mkdir(path.join(this.prefix, 'openssl/certs/'));
    $file.copy(path.join(this.extraFilesDir, 'curl-ca-bundle-20100521.crt'),
               path.join(this.prefix, 'openssl/certs/ca-bundle.crt'));
  }
}

module.exports = OpenSSL;
```
#### nginx metadata.json
```
{
  "id": "nginx",
  "latest": "1.10.1",
  "licenses": [
    {
      "type": "BSD2",
      "licenseRelativePath": "LICENSE",
      "main": true
    }
  ]
}
```
#### nginx index.js
```
'use strict';

class Nginx extends MakeComponent {
  postExtract() {
    const configureFlags = '--disable-shared --disable-libtool-lock --disable-cpp';
    $file.substitute(path.join(this.srcDir, 'auto/lib/pcre/make'),
                     {'./configure --disable-shared': `./configure ${configureFlags}`});
    $file.substitute(path.join(this.srcDir, 'auto/options'), {'NGX_RPATH=NO': 'NGX_RPATH=YES'});
  }
  configureOptions() {
    const list = ['--with-http_stub_status_module', '--with-http_gzip_static_module', '--with-mail',
      '--with-http_realip_module', '--with-http_stub_status_module', '--with-http_v2_module'];
    const components = {
      'openssl': ['--with-ld-opt=-L{{libDir}} -Wl,-rpath={{libDir}}', '--with-cc-opt=-I{{headersDir}}',
        '--with-http_ssl_module', '--with-mail_ssl_module'],
      'zlib': ['--with-zlib={{srcDir}}'],
      'pcre': ['--with-pcre={{srcDir}}']
    };
    return _.union(this.componentList.populateFlagsFromDependencies(components), list);
  }
}

module.exports = Nginx;
```

### Compilation action
We need to configure the Blacksmith default paths to the recipe and the source tarball (if not already configured in `config.json`) and then call the actual compilation command:

```
$> blacksmith configure paths.recipes /tmp/blacksmith-recipes/
$> blacksmith containerized-build zlib:/tmp/tarballs/zlib-1.2.8.tar.gz pcre:/tmp/tarballs/pcre-8.31.tar.gz openssl:/tmp/tarballs/openssl-1.0.2i.tar.gz nginx:/tmp/tarballs/nginx-1.10.1.tar.gz
```

### Compilation definition file or `stack.json`
In order to reproduce a specific build, you can put up a JSON file describing the components you want to build and their versions, in order. Then pass it to the Blacksmith command line with the `--json` option.

#### nginx.json
```
{
  "platform": "linux-x64",
  "components": [
    {
      "version": "1.2.8",
      "id": "zlib",
      "sourceTarball": "/tmp/tarballs/zlib-1.2.8.tar.gz"
    },
    {
      "id": "pcre",
      "sourceTarball": "/tmp/tarballs/pcre-8.31.tar.gz"
    },
    {
      "id": "openssl",
      "sourceTarball": "/tmp/tarballs/openssl-1.0.2i.tar.gz"
    },
    {
      "extraFiles": [
        "/tmp/extraFiles/curl-ca-bundle-20100521.crt"
      ];
      "id": "nginx",
      "sourceTarball": "/tmp/tarballs/nginx-1.10.1.tar.gz"
    }
  ]
}
```

```
$> blacksmith containerized-build --json nginx.json
```
