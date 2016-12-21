# trooba-grpc-transport

[![codecov](https://codecov.io/gh/trooba/trooba-grpc-transport/branch/master/graph/badge.svg)](https://codecov.io/gh/trooba/trooba-grpc-transport)
[![Build Status](https://travis-ci.org/trooba/trooba-grpc-transport.svg?branch=master)](https://travis-ci.org/trooba/trooba-grpc-transport) [![NPM](https://img.shields.io/npm/v/trooba-grpc-transport.svg)](https://www.npmjs.com/package/trooba-grpc-transport)
[![Downloads](https://img.shields.io/npm/dm/trooba-grpc-transport.svg)](http://npm-stat.com/charts.html?package=trooba-grpc-transport)
[![Known Vulnerabilities](https://snyk.io/test/github/trooba/trooba/badge.svg)](https://snyk.io/test/github/trooba/trooba-grpc-transport)

gRPC transport for [trooba](https://github.com/trooba/trooba) pipeline.

The module provides a *client* and *service* side gRPC transport implementation.

## Get Involved

- **Contributing**: Pull requests are welcome!
    - Read [`CONTRIBUTING.md`](.github/CONTRIBUTING.md) and check out our [bite-sized](https://github.com/trooba/trooba-grpc-transport/issues?q=is%3Aissue+is%3Aopen+label%3Adifficulty%3Abite-sized) and [help-wanted](https://github.com/trooba/trooba-grpc-transport/issues?q=is%3Aissue+is%3Aopen+label%3Astatus%3Ahelp-wanted) issues
    - Submit github issues for any feature enhancements, bugs or documentation problems
- **Support**: Join our [gitter chat](https://gitter.im/trooba) to ask questions to get support from the maintainers and other Trooba developers
    - Questions/comments can also be posted as [github issues](https://github.com/trooba/trooba-grpc-transport/issues)

## Install

```
npm install trooba-grpc-transport --save
```

## Usage

#### Service invocation

```js
var port = 50001;
var grpcTransport = require('trooba-grpc-transport');

require('trooba')
    .use(grpcTransport, {
        protocol: 'http:',
        hostname: 'grpc.service.my',
        port: port,
        proto: require.resolve('path/to/hello.proto'),
        connectTimeout: 100,
        socketTimeout: 1000
    })
    .build('client:default')
    .hello('Bob', function (err, response) {
        console.log(err, response)
    });
```

#### Sample proto definition:

```js
syntax = "proto3";

option java_package = "com.app.sample.grpc";

// The hello service definition.
service Hello {
    // Sends a greeting
    rpc SayHello ( HelloRequest) returns (  HelloReply) {}
}

// The request message containing the user's name.
message HelloRequest {
    string name = 1;
}

// The response message containing the greetings
message HelloReply {
    string message = 1;
}

```

#### Trooba based service

```js
var pipeServer = Trooba.use(transport, {
    port: port,
    hostname: 'localhost',
    proto: Grpc.load(require.resolve('./path/to/hello.proto'))
})
.use(function handler(pipe) {
    pipe.on('request', (request, next) => {
        // do something with request
        console.log('gRPC request metadata:', request.headers);
        next();
    });
    pipe.on('request:data', (data, next) => {
        // do something with request
        console.log('request chunk:', data);
        next();
    });
    pipe.on('request:end', (data, next) => {
        // do something with request
        console.log('end of request stream');
        next();
    });

    pipe.on('response', (response, next) => {
        // do something with response
        console.log('gRPC response metadata:', response.headers);
        next();
    });
    pipe.on('response:data', (data, next) => {
        // do something with response
        console.log('response chunk:', data);
        next();
    });
    pipe.on('response:end', (data, next) => {
        // do something with response
        console.log('end of response stream');
        next();
    });
})
.use(function controller(pipe) {
    // handle request/response here
    pipe.on('request', request => {
        pipe.respond({
            body: 'Hello ' + request.body.name
        });
    });
});

var app = pipeServer.build('server:default');

svr = app.listen();
console.log('toorba service is listening on port:', port);
```

#### Generic non-trooba service

This version of service is for the sake of comparison

```js
var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./path/to/hello.proto'));

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
    callback(null, {message: 'Hello ' + call.request.name});
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
 var server = new Grpc.Server();
 server.bind('localhost:' + port, Grpc.ServerCredentials.createInsecure());
 server.addProtoService(hello_proto.Hello.service, {sayHello: sayHello});
 server.start();
 console.log('listening on port:', port);

```

#### Advanced examples

For more advanced examples, please take a look at [unit tests](test)
You can also find an implementation of service sample router [here](test/fixtures/server) and invoking the service [here](test/fixtures/server.js)
