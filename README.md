# trooba-grpc-transport

[![Greenkeeper badge](https://badges.greenkeeper.io/trooba/trooba-grpc-transport.svg)](https://greenkeeper.io/)

[![codecov](https://codecov.io/gh/trooba/trooba-grpc-transport/branch/master/graph/badge.svg)](https://codecov.io/gh/trooba/trooba-grpc-transport)
[![Build Status](https://travis-ci.org/trooba/trooba-grpc-transport.svg?branch=master)](https://travis-ci.org/trooba/trooba-grpc-transport) [![NPM](https://img.shields.io/npm/v/trooba-grpc-transport.svg)](https://www.npmjs.com/package/trooba-grpc-transport)
[![Downloads](https://img.shields.io/npm/dm/trooba-grpc-transport.svg)](http://npm-stat.com/charts.html?package=trooba-grpc-transport)
[![Known Vulnerabilities](https://snyk.io/test/github/trooba/trooba-grpc-transport/badge.svg)](https://snyk.io/test/github/trooba/trooba-grpc-transport)

gRPC transport for [trooba](https://github.com/trooba/trooba) pipeline.

The module provides a *client* and *service* side gRPC transport implementation for [trooba](https://github.com/trooba/trooba) pipeline.

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
        hostname: 'localhost',
        port: port,
        proto: require.resolve('path/to/hello.proto'),
        connectTimeout: 100,
        socketTimeout: 1000
    })
    .build()
    .create('client:default')
    .hello({
        name: 'Bob'
    }, function (err, response) {
        console.log(err, response)
    });
```

#### Sample proto definition:

```js
syntax = "proto3";

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
    proto: Grpc.loadPackageDefinition(GrpcProtoLoader.loadSync(require.resolve('./path/to/hello.proto')))
})
.use(function handler(pipe) {
    pipe.on('request', (request, next) => {
        // do something with request
        console.log('gRPC request metadata:', request.headers);
        next();
    });
    pipe.on('request:data', (data, next) => {
        // do something with request stream data chunk
        console.log('request chunk:', data);
        next();
    });
    pipe.on('request:end', (data, next) => {
        // do something with stream end
        console.log('end of request stream');
        next();
    });

    pipe.on('response', (response, next) => {
        // do something with response
        console.log('gRPC response metadata:', response.headers);
        next();
    });
    pipe.on('response:data', (data, next) => {
        // do something with response stream data chunk
        console.log('response chunk:', data);
        next();
    });
    pipe.on('response:end', (data, next) => {
        // do something with end of response stream
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

const app = pipeServer.build('server:default');

svr = app.listen();
console.log('toorba service is listening on port:', port);
```

## Architecture

The module exports service and client API which matches exactly the API provided by [gRPC](https://github.com/grpc/grpc/tree/master/src/node) module.

Once request/response/data chunk enters the trooba pipeline, it assumes more generic API and request like data structures.

Trooba framework does not dictate specific data structures that should be used for request/response/messages/stream objects. It assumes basic requirements and leaves everything else to the implementor of the transport.

This transport goes further and defines some specifics for data it operates with:
* Possible flows:
  * request/response is a basic interaction between client and service
  * request/stream is a flow where for a single request it results in response stream
  * stream/response is a flow where for request stream the backend generates a single response
  * stream/stream is a flow where for the request stream the backend generates a response stream
* All the above flows use request and response object to initiate the flow and streaming uses arbitrary data chunks
* Request object structure:
  * **body** contains request data which is a message object in gRPC terms
  * **headers** contains request headers that match gRPC metadata
  * **path** matches gRPC package namespace and service name separated by '/'. For example:
  ```
  'foo.bar.v1.Hello.sayHello' => '/foo/bar/v1/Hello/sayHello'
  ```
* Response object structure:
  * **body** contains response data which is a message object in gRPC terms
  * **headers** contains response headers that match gRPC metadata
  * **status** is gRPC status
* Data chunk matches gRPC streaming data

The client transport uses two timeouts:
* connectTimeout sets the deadline for establishing the connection
* socketTimeout sets the deadline for response or any further response chunk; whenever a new chunk is received the transport resets the socket timeout

#### Advanced examples

For more advanced examples, please take a look at [unit tests](test)
You can also find an implementation of simple service router [here](test/fixtures/server).

* Router example:

```js
module.exports = function routes() {
    var router = Router.create();
    router.use({
        path: 'com/xyz/helloworld/Hello/sayHello',
        handle: require('./sayHello')
    });
    router.use({
        path: 'Hello/sayHello',
        handle: require('./sayHello')
    });
    router.use({
        path: 'Hello/sayHelloAll',
        handle: require('./sayHelloAll')
    });
    router.use({
        path: 'Hello/beGreeted',
        handle: require('./beGreeted')
    });

    return router.build();
};
```

* Service:

```js
var pipeServer = Trooba
.use(transport, {
    port: 40000,
    hostname: 'localhost',
    proto: Server.proto
})
.use(routes());

// create an app
var app = pipeServer.build().create('server:default');

// start it
app.listen(() => {
    console.log('The server is ready');
});
```
