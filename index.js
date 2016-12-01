'use strict';

var NodeUtils = require('util');
var Grpc = require('grpc');
var Hoek = require('hoek');

var connections = {};

function debug() {
    module.exports.debug.apply(null, arguments);
}
/**
 * Defines gRPC transport
*/
module.exports = function grpcFactory(config) {
    console.log('# grpc factory init');
    var proto = config.proto;
    if (typeof proto === 'string') {
        proto = Grpc.load(proto);
    }

    var serviceMethods = extractService(proto, config.serviceName);
    debug('# resolved service', config.serviceName, ', methods:', serviceMethods);
    // find a client and setup connection and error handling
    var endpoint = config.hostname + ':' + config.port;

    debug('# connect: ', endpoint, config.credentials || '');
    var client = connections[endpoint] = connections[endpoint] ||
        new proto[config.serviceName](endpoint, config.credentials ||  Grpc.credentials.createInsecure(), config.options);

    function grpcTransport(requestContext, reply) {
        debug('# request context', requestContext);
        var readTimeout;
        var request = requestContext.request;
        // handle string operation name and operation attributes
        var operationMeta = typeof request.operation === 'string' ? {
            name: request.operation
        } : request.operation;

        var args = [];
        if (!operationMeta.requestStream) {
            args.push(request.message);
        }
        if (request.metadata) {
            args.push(request.metadata);
        }
        if (request.options) {
            args.push(request.options);
        }

        debug('# waiting for connection', endpoint);

        var waitForClientReady = process.domain ? process.domain.bind(waitForConnect) : waitForConnect;

        Grpc.waitForClientReady(client,
            Date.now() + (config.connectTimeout || 1000),
            waitForClientReady);

        function waitForConnect(err) {
            debug('# done waiting for connection', endpoint);
            var call;
            var timedReply = function timedReply(err, response) {
                if (readTimeout) {
                    clearTimeout(readTimeout);
                    readTimeout = undefined;
                }
                if (operationMeta.responseStream && response) {
                    // set new response timeout for the next chunk if not the end of stream
                    debug('# setting up timeout for the next chunk');
                    setupReadTimeout(call);
                }
                reply.apply(null, arguments);
            };
            if (!operationMeta.responseStream) {
                timedReply = Hoek.once(timedReply);
                setupReadTimeout();

                args.push(process.domain ? process.domain.bind(timedReply) : timedReply);
            }

            if (err) {
                err.code = 'ETIMEDOUT';
                debug('# got error while connecting', endpoint, err);
                return timedReply(err);
            }
            debug('# calling', operationMeta.name);
            call = client[operationMeta.name].apply(client, args);

            if (operationMeta.requestStream || operationMeta.responseStream) {
                debug('# detected streaming API request stream %s, response stream %s',
                    operationMeta.requestStream, operationMeta.responseStream);
                requestContext.connection.resolve(call);
            }

            if (operationMeta.responseStream) {
                var onceReply = Hoek.once(timedReply);

                call.on('data', timedReply.bind(null, null));
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

            function setupReadTimeout(emitter) {
                if (readTimeout) {
                    debug('# clearing current response timeout');
                    clearTimeout(readTimeout);
                }
                var responseTimeout = config.socketTimeout || 1000;
                debug('# setting up response timeout', responseTimeout);

                readTimeout = setTimeout(function _readTimeout() {
                    var err = new Error('Response timeout ' + endpoint + ', operation ' + request.operation.name);
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

    }

    grpcTransport.api = function api(pipe) {

        function genericRequest(operationMeta, message, callback) {
            var args = [].slice.call(arguments);
            operationMeta = args.shift();
            callback = args.pop();
            message = args.pop();

            debug('# pipe for', operationMeta.name, message);

            var requestContext = pipe(function ctx(requestContext, next) {
                requestContext.request = {
                    message: message,
                    operation: operationMeta
                };

                addConnection(requestContext);

                next(function onResponseContext(responseContext) {
                    debug('# got response context', responseContext);
                    if (responseContext === undefined) {
                        // detected end of stream
                        return callback();
                    }
                    callback(responseContext.error,
                        responseContext.response && responseContext.response.message);
                });
            });

            return requestContext;
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
    };

    return grpcTransport;
};

function addConnection(requestContext) {
    requestContext.connection = {
        MAX_LISTENERS: 10,
        listeners: [],
        resolve: function resolve(call) {
            this.call = call;
            this.listeners.forEach(function forEach(listener) {
                listener(call);
            });
            // clean
            this.listeners = [];
        },
        on: function on(listener) {
            if (this.call) {
                return listener(this.call);
            }

            debug('# waiting for connection');
            this.listeners = this.listeners;
            this.listeners.push(listener);
            if (this.listeners.length > this.MAX_LISTENERS) {
                    console.trace('Possible memory leak: Max number of listeners has been reached for the given connection, increase the limit by setting requestContext.connection.MAX_LISTENERS = {limit}');
                }
        }
    };
}

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

module.exports.Utils = {
    selectServices: selectServices,
    extractService: extractService
};

module.exports.debug = process &&
    process.env &&
    process.env.DEBUG &&
    process.env.DEBUG.indexOf('trooba-grpc-transport') !== -1 ? console.log : function noop() {};
