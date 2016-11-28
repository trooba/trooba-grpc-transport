'use strict';

var Fs = require('fs');
var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./hello.proto'));

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

module.exports.startSsl = function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    server.bind('localhost:' + port, Grpc.ServerCredentials.createSsl(
        Fs.readFileSync(require.resolve('./certs/ca.crt')),
        [{
            private_key: Fs.readFileSync(require.resolve('./certs/server.key')),
            cert_chain: Fs.readFileSync(require.resolve('./certs/server.crt'))
        }],
        true
    ));
    server.addProtoService(hello_proto.Hello.service, {sayHello: sayHello});
    server.start();
    return server;
};

module.exports.proto = hello_proto;

module.exports.clientCredentials = Grpc.credentials.createSsl(
    Fs.readFileSync(require.resolve('./certs/server.crt')),
    Fs.readFileSync(require.resolve('./certs/client.key')),
    Fs.readFileSync(require.resolve('./certs/client.crt'))
);

module.exports.clientRaptorCredentials = Grpc.credentials.createSsl(
    Fs.readFileSync(require.resolve('./certs/raptor.pem')),
    Fs.readFileSync(require.resolve('./certs/client.key')),
    Fs.readFileSync(require.resolve('./certs/client.crt'))
);

// module.exports.clientCredentials = Grpc.credentials.createSsl(
//     Fs.readFileSync(require.resolve('./certs/grpc-client.key')),
//     Fs.readFileSync(require.resolve('./certs/grpc-client.pem'))
// );