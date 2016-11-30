# trooba-grpc-transport

gRPC transport for trooba pipeline

## Install

```
npm install trooba-grpc-transport --save
```

## Usage

#### Service invocation

```js
var grpcTransportFactory = require('trooba-grpc-transport');

require('trooba')
    .transport(grpcTransportFactory, {
        protocol: 'http:',
        hostname: 'grpc.service.my',
        port: 50001,
        proto: require.resolve('path/to/hello.proto')
    })
    .create()
    .hello('Bob', function (err, response) {
        console.log(err, response)
    });
```

#### hello.proto definition:

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

#### Sample server

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
module.exports.start = function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    server.bind('localhost:' + port, Grpc.ServerCredentials.createInsecure());
    server.addProtoService(hello_proto.Hello.service, {sayHello: sayHello});
    server.start();
    return server;
};

module.exports.proto = hello_proto;
```
