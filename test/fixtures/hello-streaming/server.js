'use strict';

var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./hello.proto'));

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
    var names = [];
    call.on('data', function onData(message) {
        names.push(message.name);
    });
    call.on('end', function onEnd() {
        callback(null, {message: 'Hello ' + names.join(' and ')});
    });
}

function beGreeted(call, callback) {
    var reply = 'Hello ' + call.request.name;
    ['Bob', 'John'].map(function map(name) {
        call.write(reply + ' from ' + name);
    });
    call.end();
}

function sayHelloAll(call, callback) {
    call.on('data', function onData(message) {
        call.write('Hello ' + message.name);
    });
    call.end(function onEnd() {
        call.end();
    });
}
/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
module.exports.start = function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    server.bind('localhost:' + port, Grpc.ServerCredentials.createInsecure());
    server.addProtoService(hello_proto.Hello.service, {
        sayHello: sayHello,
        beGreeted: beGreeted,
        sayHelloAll: sayHelloAll
    });
    server.start();
    return server;
};

module.exports.proto = hello_proto;
