'use strict';

var Assert = require('assert');
var Utils = require('..').Utils;

describe(__filename, function () {

    it('should extract service from single service definition', function () {
        var proto = require('./fixtures/hello/server').proto;
        var name = Utils.extractService(proto);
        Assert.deepEqual([
            {
                name: 'SayHello',
                requestStream: false,
                responseStream: false
            }
        ], name);

        name = Utils.extractService(proto, 'Hello');
        Assert.deepEqual([
            {
                name: 'SayHello',
                requestStream: false,
                responseStream: false
            }
        ], name);
    });

    it('should extract service from multi-method definition', function () {
        var proto = require('./fixtures/multi-hello/server').proto;
        var name = Utils.extractService(proto);
        Assert.deepEqual([
            {
                name: 'SayHello',
                requestStream: false,
                responseStream: false
            },
            {
                name: 'SayHi',
                requestStream: false,
                responseStream: false
            }
        ], name);

        name = Utils.extractService(proto, 'Hello');
        Assert.deepEqual([
            {
                name: 'SayHello',
                requestStream: false,
                responseStream: false
            },
            {
                name: 'SayHi',
                requestStream: false,
                responseStream: false
            }
        ], name);
    });

    it('should extract service multi-service definition', function () {
        var proto = require('./fixtures/multi/server').proto;

        Assert.throws(function () {
            Utils.extractService(proto);
        }, /Service name should be provided in multi-service proto: { HelloRequest/);

        var name = Utils.extractService(proto, 'Hello');
        Assert.deepEqual([{
            name: 'SayHello',
            requestStream: false,
            responseStream: false
        }], name);

        name = Utils.extractService(proto, 'Hi');
        Assert.deepEqual([{
            name: 'SayHi',
            requestStream: false,
            responseStream: false
        }], name);
    });

    it('should extract service with stream response', function () {
        var proto = require('./fixtures/hello-streaming/server').proto;
        var services = Utils.extractService(proto, 'Hello');
        Assert.deepEqual([
            {
                name: 'SayHello',
                requestStream: true,
                responseStream: false
            },
            {
                name: 'BeGreeted',
                requestStream: false,
                responseStream: true
            },
            {
                name: 'SayHelloAll',
                requestStream: true,
                responseStream: true
            },

        ], services);
    });

    it('should handle package', function () {
        var proto = require('./fixtures/messages/index').proto;

        Assert.throws(function () {
            Utils.extractService(proto);
        }, /Failed to detect services in proto: { HelloRequest/);
    });

});
