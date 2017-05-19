'use strict';

var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./hello.proto'));

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
    callback(null, {message: 'Hello ' + call.request.name});
}

function sayHi(call, callback) {
    callback(null, {message: 'Hi ' + call.request.name});
}
/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
module.exports.start = function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    server.bind('localhost:' + port, Grpc.ServerCredentials.createInsecure());
    server.addService(hello_proto.Hello.service, {
        sayHello: sayHello,
        sayHi: sayHi
    });
    server.start();
    return server;
};

module.exports.proto = hello_proto;
