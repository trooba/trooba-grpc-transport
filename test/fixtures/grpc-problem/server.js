'use strict';

var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./hello.proto'));

/**
 * Implements stream/stream call
 */
function sayHelloAll(call) {
    var meta = new Grpc.Metadata();
    meta.set('foo', 'bar');
    if (call.metadata.getMap().qaz) {
        meta.set('rfv', call.metadata.getMap().qaz);
    }
    call.sendMetadata(meta);

    call.on('data', function onData(message) {
        call.write('Hello ' + message.name);
    });
    call.on('end', function () {
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
    server.addService(hello_proto.Hello.service, {
        sayHelloAll: sayHelloAll
    });
    server.start();
    return server;
};

module.exports.proto = hello_proto;
