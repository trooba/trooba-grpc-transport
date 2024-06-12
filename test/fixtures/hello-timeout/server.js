'use strict';

const Grpc = require('@grpc/grpc-js');
const GrpcProtoLoader = require('@grpc/proto-loader');
const hello_proto = Grpc.loadPackageDefinition(GrpcProtoLoader.loadSync(require.resolve('./hello.proto')));

/**
 * Implements the SayHello RPC method.
 */
function sayHello(call, callback) {
    // never respond to simulate the timeout
}

/**
 * Starts an RPC server that receives requests for the Greeter service at the
 * sample server port
 */
module.exports.start = async function start(port) {
    const server = new Grpc.Server();
    console.log('listening on port:', port);
    await new Promise((resolve, reject) => server.bindAsync('localhost:' + port, Grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            reject(err);
            return;
        }
        resolve({});
    }));
    server.addService(hello_proto.Hello.service, {sayHello: sayHello});
    server.start();
    return server;
};

module.exports.proto = hello_proto;
