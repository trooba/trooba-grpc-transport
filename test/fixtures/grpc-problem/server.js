'use strict';

var Grpc = require('@grpc/grpc-js');
var hello_proto = Grpc.loadPackageDefinition(GrpcProtoLoader.loadSync(require.resolve('./hello.proto')));

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
module.exports.start = async function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    await new Promise((resolve, reject) => server.bindAsync('localhost:' + port, Grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            reject(err);
            return;
        }
        resolve({});
    }));    
    server.addService(hello_proto.Hello.service, {
        sayHelloAll: sayHelloAll
    });
    server.start();
    return server;
};

module.exports.proto = hello_proto;
