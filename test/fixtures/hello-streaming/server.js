'use strict';

const Grpc = require('@grpc/grpc-js');
const GrpcProtoLoader = require('@grpc/proto-loader');
const hello_proto = Grpc.loadPackageDefinition(GrpcProtoLoader.loadSync(require.resolve('./hello.proto')));

/**
 * Implements stream/response call
 */
function sayHello(call, callback) {
    var meta = new Grpc.Metadata();
    meta.set('foo', 'bar');
    if (call.metadata.getMap().qaz) {
        meta.set('rfv', call.metadata.getMap().qaz);
    }
    call.sendMetadata(meta);

    var names = [];
    call.on('data', function onData(message) {
        names.push(message.name);
    });
    call.on('end', function onEnd() {
        callback(null, {
            message: 'Hello ' + names.join(' and ')
        });
    });
}

/**
 * Implements request/stream call
 */
function beGreeted(call) {
    if (call.request.name === 'timeout') {
        return;
    }

    var reply = 'Hello ' + call.request.name;

    if (call.request.name === 'massive') {
        for (var j = 0; j < 1000; j++) {
            call.write({
                message: reply + ' from John' + j
            });
        }
        call.end();
        return;
    }

    var meta = new Grpc.Metadata();
    meta.set('foo', 'bar');
    call.sendMetadata(meta);

    var array = ['Bob', 'John'];
    for (var i = 0; i < array.length; i++) {
        if (i > 0 && call.request.name === 'timeout-after-first-chunk') {
            return;
        }
        if (call.request.name === 'slow') {
            setTimeout(call.write.bind(call, {
                message: reply + ' from ' + array[i]
            }), 100 * (i + 1));
        }
        else {
            call.write({
                message: reply + ' from ' + array[i]
            });
        }
    }
    if (call.request.name === 'no-end') {
        return;
    }
    if (call.request.name === 'slow') {
        setTimeout(call.end.bind(call), 100 * (i + 1));
        return;
    }

    call.end();
}

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
        call.write({
            message: 'Hello ' + message.name
        });
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
    const server = new Grpc.Server();
    server.addService(hello_proto.Hello.service, {
        sayHello,
        beGreeted,
        sayHelloAll
    });
    await new Promise((resolve, reject) => server.bindAsync('localhost:' + port, Grpc.ServerCredentials.createInsecure(), (err, port) => {
        if (err) {
            reject(err);
            return;
        }
        resolve({
            port
        });
    }));
    console.log('listening on port:', port);
    return server;
};

module.exports.proto = hello_proto;
