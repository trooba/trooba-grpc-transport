'use strict';

var Grpc = require('grpc');

var connections = {};

/**
 * Defines gRPC transport
*/
module.exports = function grpcFactory(config) {
    var proto = config.proto;
    if (typeof proto === 'string') {
        proto = Grpc.load(proto);
    }

    var serviceMethods = extractService(proto, config.serviceName);
    // find a client and setup connection and error handling
    var endpoint = config.hostname + ':' + config.port;

    var client = connections[endpoint] = connections[endpoint] ||
        new proto[config.serviceName](endpoint, config.credentials ||  Grpc.credentials.createInsecure());

    // TODO: handle error case when service is disconnected
    // * remove it from the list and let it re-connect inside grpc section below

    function grpcTransport(requestContext, responseContext) {
        var message = requestContext.request;
        var operation = requestContext.operation;
        client[operation](message, function onResponse(err, response) {
            responseContext.next(err, response);
        });
    }

    // TODO:
    //  * handle stream API

    grpcTransport.api = function api(pipe) {

        function genericRequest(operation, request, callback) {
            return pipe(function ctx(requestContext, responseContext) {
                requestContext.operation = operation;
                requestContext.request = request;
                requestContext.next(function onResponse(err, response) {
                    callback(err, response && response.message);
                });
            });
        }

        var client = serviceMethods.reduce(function reduce(memo, methodName) {
            methodName = methodName.charAt(0).toLowerCase() + methodName.slice(1);
            memo[methodName] = memo.request$.bind(memo, methodName);
            return memo;
        }, {
            // generic API
            request$: genericRequest
        });

        return client;
    };

    return grpcTransport;
};

function extractService(proto, serviceName) {
    var services = selectServices(proto);
    var servicesNumber = Object.keys(services).length;
    if (servicesNumber === 0) {
        throw new Error('Failed to detect services in proto: ' + proto);
    }

    var service;
    if (servicesNumber > 1) {
        if (!serviceName) {
            throw new Error('Service name should be provided in multi-service proto: ' + proto);
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
        return child.name;
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
