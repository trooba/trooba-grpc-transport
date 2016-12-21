'use strict';

var Grpc = require('grpc');
var hello_proto = Grpc.load(require.resolve('./hello.proto'));

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
        callback(null, {message: 'Hello ' + names.join(' and ')});
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
            call.write(reply + ' from John' + j);
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
            setTimeout(call.write.bind(call, reply + ' from ' + array[i]), 100 * (i + 1));
        }
        else {
            call.write(reply + ' from ' + array[i]);
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
    server.addProtoService(hello_proto.Hello.service, {
        sayHello: sayHello,
        beGreeted: beGreeted,
        sayHelloAll: sayHelloAll
    });
    server.start();
    return server;
};

module.exports.proto = hello_proto;
