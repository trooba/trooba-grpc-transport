'use strict';

const Fs = require('fs');
const Grpc = require('@grpc/grpc-js');
const GrpcProtoLoader = require('@grpc/proto-loader');
const hello_proto = Grpc.loadPackageDefinition(GrpcProtoLoader.loadSync(require.resolve('./hello.proto')));

var lastServer;
/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
    if (call.request.name === 'disconnect') {
        lastServer.forceShutdown();
        return;
    }
    var meta = new Grpc.Metadata();
    meta.set('foo', 'bar');
    if (call.metadata.getMap().qaz) {
        meta.set('rfv', call.metadata.getMap().qaz);
    }
    // call.sendMetadata(meta);  // <<< this fails in linux/ubuntu
    callback(null, {message: 'Hello ' + call.request.name}, meta);
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
module.exports.start = async function start(port) {
    const server = new Grpc.Server();
    await new Promise((resolve, reject) => server.bindAsync('localhost:' + port, Grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            reject(err);
            return;
        }
        resolve({});
    }));
    server.addService(hello_proto.Hello.service, {sayHello: sayHello});
    server.start();
    lastServer = server;
    return server;
};

module.exports.startSsl = async function start(port) {
    var server = new Grpc.Server();
    console.log('listening on port:', port);
    const secOptions = Grpc.ServerCredentials.createSsl(
        Fs.readFileSync(require.resolve('./certs/ca.crt')),
        [{
            private_key: Fs.readFileSync(require.resolve('./certs/server.key')),
            cert_chain: Fs.readFileSync(require.resolve('./certs/server.crt'))
        }],
        false
    );

    server.addService(hello_proto.Hello.service, {sayHello: sayHello});
    await new Promise((resolve, reject) => server.bindAsync('localhost:' + port, secOptions, (err, port) => {
        if (err) {
            reject(err);
            return;
        }
        server.start();
        resolve({});
    }));

    return server;
};

module.exports.proto = hello_proto;

module.exports.clientCredentials = Grpc.credentials.createSsl(
    Fs.readFileSync(require.resolve('./certs/server.crt')),
    Fs.readFileSync(require.resolve('./certs/client.key')),
    Fs.readFileSync(require.resolve('./certs/client.crt'))
);

// module.exports.clientRaptorCredentials = Grpc.credentials.createSsl(
//     Fs.readFileSync(require.resolve('./certs/provide real pem')),
//     Fs.readFileSync(require.resolve('./certs/client.key')),
//     Fs.readFileSync(require.resolve('./certs/client.crt'))
// );

// module.exports.clientCredentials = Grpc.credentials.createSsl(
//     Fs.readFileSync(require.resolve('./certs/grpc-client.key')),
//     Fs.readFileSync(require.resolve('./certs/grpc-client.pem'))
// );
