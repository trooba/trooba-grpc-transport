'use strict';

var NodeUtils = require('util');
var stream = require('stream');
var Grpc = require('grpc');
var Hoek = require('hoek');

var Readable = stream.Readable;
var Writable = stream.Writable;
var Duplex = stream.Duplex;

function debug() {
    module.exports.debug.apply(null, arguments);
}
/**
 * Defines gRPC transport
*/
module.exports = function grpcTransport(pipe, config) {
    debug('# grpc init');
    // find a client and setup connection and error handling
    var endpoint = config.hostname + ':' + config.port;

    if (!config.$client) {
        var proto = typeof proto === 'string' ?
            Grpc.load(proto) : config.proto;

        var serviceMethods = extractService(proto, config.serviceName);
        debug('# resolved service', config.serviceName, ', methods:', serviceMethods);

        debug('# connect: ', endpoint, config.credentials || '');
        config.$client = new proto[config.serviceName](endpoint,
            config.credentials || Grpc.credentials.createInsecure(),
            config.options);
    }

    pipe.on('request', function onRequest(request) {
        debug('# request context', pipe.context, request);
        var readTimeout;

        var args = [];
        if (!pipe.context.requestStream) {
            args.push(request);
        }
        if (pipe.context.metadata) {
            args.push(pipe.context.metadata);
        }
        if (pipe.context.options) {
            args.push(pipe.context.options);
        }

        debug('# waiting for connection', endpoint);

        var waitForClientReady = process.domain ? process.domain.bind(waitForConnect) : waitForConnect;

        Grpc.waitForClientReady(config.$client,
            Date.now() + (config.connectTimeout || 1000),
            waitForClientReady);

        function waitForConnect(err) {
            debug('# done waiting for connection', endpoint);
            var call;
            var responseStream;
            var timedReply = function timedReply(err, data) {
                if (readTimeout) {
                    clearTimeout(readTimeout);
                    readTimeout = undefined;
                }

                if (err) {
                    pipe.throw(err);
                    return;
                }

                if (pipe.context.responseStream) {
                    if (data) {
                        // set new response timeout for the next chunk if not the end of stream
                        debug('# setting up timeout for the next chunk');
                        setupReadTimeout(call);
                    }
                    responseStream.write(data);
                }
                else {
                    pipe.respond(data);
                }
            };

            if (!pipe.context.responseStream) {
                timedReply = Hoek.once(timedReply);
                setupReadTimeout();

                args.push(process.domain ? process.domain.bind(timedReply) : timedReply);
            }

            if (err) {
                err.code = 'ETIMEDOUT';
                debug('# got error while connecting', endpoint, err);
                return timedReply(err);
            }

            debug('# calling', pipe.context.operation);
            call = config.$client[pipe.context.operation].apply(config.$client, args);

            if (pipe.context.requestStream) {
                pipe.on('request:data', function onRequestData(data) {
                    debug('# request data:', data);
                    if (data === undefined) {
                        call.end();
                        return;
                    }
                    call.write(data);
                });
            }

            if (pipe.context.responseStream) {
                var onceReply = Hoek.once(timedReply);
                responseStream = pipe.streamResponse({});

                call.on('status', function onStatus(status) {
                    pipe.send({
                        type: 'response:status',
                        flow: 2,
                        ref: status
                    });
                    pipe.send({
                        type: 'response:metadata',
                        flow: 2,
                        ref: status.metadata
                    });
                });

                call.on('data', function onData(data) {
                    timedReply(null, data.message);
                });

                call.once('end', onceReply);
                call.once('error', onceReply);
                call.on('error', Hoek.once(function cleanup(err) {
                    debug('# error', err);
                    call.removeListener('data', timedReply);
                    call.removeListener('end', onceReply);
                    call.removeListener('data', onceReply);
                }));

                setupReadTimeout(call);
            }

            if (pipe.context.requestStream || pipe.context.responseStream) {
                debug('# detected streaming API request stream %s, response stream %s',
                    pipe.context.requestStream, pipe.context.responseStream);

                pipe.send({
                    flow: 2, //Trooba.Types.RESPONSE = 2
                    type: 'connection',
                    ref: call
                });
            }

            function setupReadTimeout(emitter) {
                if (readTimeout) {
                    debug('# clearing current response timeout');
                    clearTimeout(readTimeout);
                }
                var responseTimeout = config.socketTimeout || 1000;
                debug('# setting up response timeout', responseTimeout);

                readTimeout = setTimeout(function _readTimeout() {
                    var err = new Error('Response timeout ' + endpoint + ', operation ' + pipe.context.operation);
                    err.code = 'ETIMEDOUT';
                    err.type = 'ESOCKTIMEDOUT';
                    if (emitter) {
                        emitter.emit('error', err);
                    }
                    else {
                        timedReply(err);
                    }
                }, responseTimeout);
            }
        }
    });

    pipe.set('client:default', api);

    function api(pipe) {

        function genericRequest(operation, message, callback) {
console.log('>>>>>>', arguments)
            var args = [].slice.call(arguments);
            operation = args.shift();
            callback = operation.responseStream ? undefined : args.pop();
            message = args.shift();

            debug('# pipe for', operation.name, message);

            var requestMethod = operation.requestStream ? 'streamRequest' : 'request';

            pipe = pipe.create({
                requestStream: !!operation.requestStream,
                responseStream: !!operation.responseStream,
                operation: operation.name
            });

            pipe[requestMethod](message);

            if (operation.responseStream && operation.requestStream) {
                return new ClientDuplexStream(pipe);
            }

            if (operation.responseStream) {
                return new ClientReadableStream(pipe);
            }
            else {
                pipe
                .once('response', function onResponse(response) {
                    callback(null, response.message);
                })
                .once('error', callback);
            }

            if (operation.requestStream) {
                return new ClientWritableStream(pipe);
            }

        }

        var client = serviceMethods.reduce(function reduce(memo, methodMeta) {
            var methodName = methodMeta.name;
            methodMeta.name = methodName.charAt(0).toLowerCase() + methodName.slice(1);
            memo[methodMeta.name] = memo.request$.bind(memo, methodMeta);
            return memo;
        }, {
            // generic API
            request$: genericRequest
        });

        return client;
    }
};

function extractService(proto, serviceName) {
    var services = selectServices(proto);
    var servicesNumber = Object.keys(services).length;
    if (servicesNumber === 0) {
        throw new Error('Failed to detect services in proto: ' +
            NodeUtils.inspect(proto, ' ', 1));
    }

    var service;
    if (servicesNumber > 1) {
        if (!serviceName) {
            throw new Error('Service name should be provided in multi-service proto: ' + NodeUtils.inspect(proto, ' ', 1));
        }
        service = services[serviceName];
        if (!service) {
            throw new Error('Cannot detect required service ' + serviceName + ' among ' + JSON.stringify(services));
        }
    }
    else {
        service = services[Object.keys(services)[0]];
    }

    return service;
}

function selectMethods(serviceMeta) {
    return serviceMeta.service.children.map(function map(child) {
        return {
            name: child.name,
            requestStream: child.requestStream,
            responseStream: child.responseStream
        };
    });
}

function selectServices(proto, base, collection) {
    collection = collection || {};
    base = base || [];
    Object.keys(proto).forEach(function forEach(name) {
        var path = base.slice();
        path.push(name);
        var member = proto[name];
        if (member.service) {
            var serviceName = path.join('.');
            collection[serviceName] = selectMethods(member);
        }
        else if (typeof member === 'object') {
            selectServices(member, path, collection);
        }
    });

    return collection;
}

/**
 * A stream that the client can write to. It will buffer data till it is ready
 */
function ClientWritableStream(pipe) {
    Writable.call(this, {objectMode: true});
    this._init(pipe);
}

NodeUtils.inherits(ClientWritableStream, Writable);

function _initWrite(pipe) {
    /*jshint validthis:true */
    var self = this;

    pipe.on('connection', function onConnection() {
        self._requestStream = pipe.context.$requestStream;
        self._requestStream.write(self._resume.message);
        self._resume && self._resume.done();
    });

    self.on('finish', function onStreamFinish() {
        this._requestStream.end();
    });
}

function _write(message, encoding, callback) {
    /*jshint validthis:true */
    if (this._requestStream) {
        this._requestStream.write(message);
        return callback();
    }

    this._resume = {
        message: message,
        done: callback
    };
}

ClientWritableStream.prototype._write = _write;
ClientWritableStream.prototype._init = _initWrite;

/**
 * A stream that the client can read from.
 */
function ClientReadableStream(pipe) {
    Readable.call(this, {objectMode: true});

    this._init(pipe);
}

NodeUtils.inherits(ClientReadableStream, Readable);

function _initRead(pipe) {
    /*jshint validthis:true */
    var self = this;
    self._responseBuffer = [];

    pipe.on('response:data', function onData(data) {
        if (self._paused) {
            self._responseBuffer.push(data);
            return;
        }
        // TODO: need to send signal back to the write side when then need to pause
        // and drain even on ready, for now use buffer
        self._paused = !self.push(data === undefined ? null : data);
    });

    pipe.on('error', function onErr(err) {
        self.emit('error', err);
    });
}

function _read() {
    /*jshint validthis:true */
    this._paused = false;
    while (this._responseBuffer.length) {
        this._paused = !this.push(this._responseBuffer.shift());
        if (this._paused) {
            return;
        }
    }
}

ClientReadableStream.prototype._read = _read;
ClientReadableStream.prototype._init = _initRead;

function ClientDuplexStream(pipe) {
    Duplex.call(this, {objectMode: true});
    this._initWrite(pipe);
    this._initRead(pipe);
}

NodeUtils.inherits(ClientDuplexStream, Duplex);

ClientDuplexStream.prototype._initRead = _initRead;
ClientDuplexStream.prototype._initWrite = _initWrite;
ClientDuplexStream.prototype._read = _read;
ClientDuplexStream.prototype._write = _write;

module.exports.Utils = {
    selectServices: selectServices,
    extractService: extractService
};

module.exports.debug = process &&
    process.env &&
    process.env.DEBUG &&
    process.env.DEBUG.indexOf('trooba-grpc-transport') !== -1 ? console.log : function noop() {};
