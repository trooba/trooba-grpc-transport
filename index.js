'use strict';

const NodeUtils = require('util');
const stream = require('stream');
const Grpc = require('grpc');
const Hoek = require('hoek');
const _ = require('lodash');

const Readable = stream.Readable;
const Writable = stream.Writable;
const Duplex = stream.Duplex;

function debug() {
    module.exports.debug.apply(null, arguments);
}

let endpoints = {};

/**
 * Defines gRPC transport
*/
module.exports = function grpcTransport(pipe, config) {
    debug('# grpc init');

    const proto = config.proto = typeof config.proto === 'string' ?
        Grpc.load(config.proto) : config.proto;
    let endpoint = config.hostname + ':' + config.port;

    pipe.set('client:default', clientApi);
    pipe.set('server:default', serverApi);

    pipe.on('request', function onRequest(request, next) {
        debug('# request context', pipe.context, request);

        if (pipe.context.service$) {
            // for service flow skip
            debug('# service request');
            next();
            return;
        }

        let readTimeout;

        const args = [];
        if (!pipe.context.requestStream) {
            args.push(request.body);
        }
        if (request.headers) {
            const meta = new Grpc.Metadata();
            Object.keys(request.headers).forEach(function forEach(name) {
                meta.set(name, ''+request.headers[name]);
            });
            args.push(meta);
        }
        if (request.options) {
            args.push(request.options);
        }

        debug('# waiting for connection', endpoint);

        const waitForClientReady = process.domain ? process.domain.bind(waitForConnect) : waitForConnect;

        Grpc.waitForClientReady(config.$client,
            Date.now() + (config.connectTimeout || 1000),
            waitForClientReady);

        function waitForConnect(err) {
            debug('# done waiting for connection', endpoint);
            let call;
            let responseStatus;
            let responseStream;
            let startResponseStream;

            let timedReply = function timedReply(err, data) {
                if (readTimeout) {
                    clearTimeout(readTimeout);
                    readTimeout = undefined;
                }

                if (err) {
                    pipe.throw(err);
                    return;
                }

                setImmediate(function defer() {
                    if (data && responseStatus) {
                        data.status = _.assignIn(data.status || {}, responseStatus.status);
                        data.headers = _.assignIn(data.headers || {}, responseStatus.headers);
                    }
                    // clear it
                    responseStatus = undefined;
                    if (data) {
                        data.body = data.message;
                        delete data.message;
                    }
                    if (pipe.context.responseStream) {
                        if (data) {
                            // set new response timeout for the next chunk if not the end of stream
                            debug('# setting up timeout for the next chunk');
                            setupReadTimeout(call);
                        }
                        responseStream.write(data ? data.body : null);
                    }
                    else {
                        pipe.respond(data);
                    }
                });

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

            call.on('status', function onStatus(status) {
                responseStatus = responseStatus || {};
                responseStatus.status = status;
                responseStatus.headers = _.assignIn(
                    responseStatus.headers || {}, status.metadata.getMap());
            });

            call.on('metadata', function onStatus(metadata) {
                responseStatus = responseStatus || {};
                responseStatus.headers = _.assignIn(
                    responseStatus.headers || {}, metadata.getMap());
            });

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
                startResponseStream = Hoek.once(function startResponseStream() {
                    responseStream = pipe.streamResponse(responseStatus || {});
                    responseStatus = undefined;
                });

                call.on('data', function onData(data) {
                    startResponseStream();
                    timedReply(null, data);
                });

                call.once('end', function () {
                    startResponseStream();
                    onceReply();
                });
                call.once('error', timedReply);
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

                setImmediate(function () {
                    pipe.send({
                        flow: 2, //Trooba.Types.RESPONSE = 2
                        type: 'connection',
                        ref: call
                    });
                });
            }

            function setupReadTimeout(emitter) {
                const responseTimeout = config.socketTimeout || 1000;
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

    function serverApi(pipe) {
        const credentials = config.serverCredentials || Grpc.ServerCredentials.createInsecure();

        const server = new Grpc.Server();
        config.port = server.bind(endpoint, credentials);
        endpoint = config.hostname + ':' + config.port;

        const services = selectServices(proto);
        pipe.context.service$ = true;
        const genericRequest = createGenericHandler(pipe);

        Object.keys(services).forEach(serviceName => {
            const methods = services[serviceName];

            let routes = methods.reduce((memo, methodMeta) => {
                var methodName = methodMeta.name;
                methodMeta.service = serviceName;
                methodMeta.name = methodName.charAt(0).toLowerCase() + methodName.slice(1);
                memo[methodMeta.name] = request$.bind(memo, methodMeta);
                return memo;
            }, {});

            debug('# service %s routes:', serviceName, routes);
            server.addProtoService(_.get(proto, serviceName).service, routes);
        });

        return {
            listen: (callback) => {
                if (endpoint && endpoints[endpoint]) {
                    let err = new Error('The service is already running:' + endpoint);
                    if (callback) {
                        return callback(err);
                    }
                    throw err;
                }
                endpoints[endpoint] = server;

                server.start();
                callback && setImmediate(callback);
                return {
                    port: config.port,
                    close: (cb, timeout) => {
                        const cleanup = Hoek.once(() => {
                            delete endpoints[endpoint];
                            cb();
                        });
                        server.tryShutdown(cleanup);
                        setTimeout(() => {
                            debug('# forced shutdown');
                            server.forceShutdown();
                            cleanup();
                        }, timeout || 1000);
                    }
                };
            }
        };

        function request$(operation, call, callback) {

            const session = genericRequest(operation,
                call.request, call.metadata.getMap());

            if (operation.responseStream) {
                session.pipe(call);
            }
            else {
                session
                .on('error', err => {
                    return callback(err);
                })
                .on('response', response => {
                    sendMetadata(response.headers);
                    callback(null, {
                        message: response.body
                    });
                });
            }

            if (operation.requestStream) {
                call.pipe(session);
            }

            if (operation.responseStream) {
                session.once('response', function onResponse(response) {
                    response && response.headers && sendMetadata(response.headers);
                });
                return new ClientReadableStream(pipe);
            }

            function sendMetadata(headers) {
                if (headers) {
                    const keys = Object.keys(headers);
                    if (keys.length) {
                        const meta = new Grpc.Metadata();
                        keys.forEach(name => {
                            meta.set(name, headers[name]);
                        });
                        call.sendMetadata(meta);
                    }
                }
            }

        }

    }

    function clientApi(pipe) {
        const credentials = config.credentials || Grpc.credentials.createInsecure();
        pipe.context.client$ = true;

        if (!config.$client) {
            debug('# connect: ', endpoint, config.credentials || '');
            config.$client = new proto[config.serviceName](endpoint, credentials, config.options);
        }

        const service = extractService(proto, config.serviceName);
        debug('# resolved service', service.name, ', methods:', service.methods);

        const client = service.methods.reduce(function reduce(memo, methodMeta) {
            methodMeta = Object.create(methodMeta);

            const methodName = methodMeta.name;
            methodMeta.service = service.name;
            methodMeta.name = methodName.charAt(0).toLowerCase() + methodName.slice(1);
            memo[methodMeta.name] = memo.request$.bind(memo, methodMeta);

            return memo;
        }, {
            // generic API
            request$: createGenericHandler(pipe)
        });

        return client;
    }

    function createGenericHandler(pipe) {
        return function genericRequest(operation, message, metadata, callback) {

            const args = [].slice.call(arguments);
            operation = args.shift();
            callback = operation.responseStream ? undefined : args.pop();
            message = args.shift();
            metadata = args.shift();
            if (typeof callback !== 'function') {
                metadata = callback;
                callback = undefined;
            }
            debug('# pipe for', operation.name, message);

            const requestMethod = operation.requestStream ? 'streamRequest' : 'request';

            pipe = pipe.create({
                requestStream: !!operation.requestStream,
                responseStream: !!operation.responseStream,
                operation: operation.name,
            });

            var servicePath = operation.service ?
                [operation.service.replace(/\./g, '/'), operation.name].join('/') :
                operation.name;
            pipe[requestMethod]({
                body: message,
                headers: metadata,
                path: servicePath
            });

            if (operation.responseStream && operation.requestStream) {
                return new ClientDuplexStream(pipe);
            }

            if (operation.responseStream) {
                return new ClientReadableStream(pipe);
            }
            else {
                if (callback) {
                    pipe
                    .once('response', function onResponse(response) {
                        callback(null, response.body);
                    })
                    .once('error', callback);
                }
            }

            if (operation.requestStream) {
                return new ClientWritableStream(pipe);
            }
            else {
                return pipe;
            }

        };
    }
};

function extractService(proto, serviceName) {
    const services = selectServices(proto);
    const servicesNumber = Object.keys(services).length;
    if (servicesNumber === 0) {
        throw new Error('Failed to detect services in proto: ' +
            NodeUtils.inspect(proto, ' ', 1));
    }

    let service;
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
        serviceName = Object.keys(services)[0];
        service = services[serviceName];
    }

    return {
        name: serviceName,
        methods: service
    };
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
        const path = base.slice();
        path.push(name);
        const member = proto[name];
        if (member.service) {
            const serviceName = path.join('.');
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
    this.$pipe = pipe;
    hookPipeEventsToStream(pipe, this);
}

NodeUtils.inherits(ClientWritableStream, Writable);

function _initWrite(pipe) {
    /*jshint validthis:true */
    if (pipe.context.client$) {
        pipe.on('connection', () => {
            this._requestStream = pipe.context.$requestStream;
            this._resume && this._requestStream.write(this._resume.message);
            this._resume && this._resume.done();
        });
    }
    else {
        this._requestStream = pipe.context.$requestStream;
    }

    this.on('finish', () => {
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
    this.$pipe = pipe;
    hookPipeEventsToStream(pipe, this);
}

NodeUtils.inherits(ClientReadableStream, Readable);

function hookPipeEventsToStream(pipe, stream) {
    pipe.on('*', message => {
        stream.emit(message.type, message.ref);
    });
}

function _initRead(pipe) {
    /*jshint validthis:true */
    this._responseBuffer = [];

    pipe.on('response:data', data => {
        if (this._paused) {
            this._responseBuffer.push(data);
            return;
        }
        // TODO: need to send signal back to the write side when then need to pause
        // and drain even on ready, for now use buffer
        debug('# reading response data', data);
        this._paused = !this.push(data || null);
    });

    pipe.on('error', err => {
        debug('# reading response error', err);
        this.emit('error', err);
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
    this.$pipe = pipe;
    hookPipeEventsToStream(pipe, this);
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
