'use strict';

var Assert = require('assert');
var Utils = require('..').Utils;

describe(__filename, function () {

    it('should extract service from single service definition', function () {
        var proto = require('./fixtures/hello/server').proto;
        var service = Utils.extractService(proto);
        Assert.deepEqual({
            name: 'Hello',
            methods: [
                {
                    name: 'sayHello',
                    requestStream: false,
                    responseStream: false
                }
            ]
        }, service);

        service = Utils.extractService(proto, 'Hello');
        Assert.deepEqual({
            name: 'Hello',
            methods: [
                {
                    name: 'sayHello',
                    requestStream: false,
                    responseStream: false
                }
            ]
        }, service);
    });

    it('should extract service from multi-method definition', function () {
        var proto = require('./fixtures/multi-hello/server').proto;
        var service = Utils.extractService(proto);
        Assert.deepEqual({
            name: 'Hello',
            methods: [
                {
                    name: 'sayHello',
                    requestStream: false,
                    responseStream: false
                },
                {
                    name: 'sayHi',
                    requestStream: false,
                    responseStream: false
                }
            ]
        }, service);

        service = Utils.extractService(proto, 'Hello');
        Assert.deepEqual({
            name: 'Hello',
            methods: [
                {
                    name: 'sayHello',
                    requestStream: false,
                    responseStream: false
                },
                {
                    name: 'sayHi',
                    requestStream: false,
                    responseStream: false
                }
            ]
        }, service);
    });

    it('should extract service multi-service definition', function () {
        var proto = require('./fixtures/multi/server').proto;

        Assert.throws(function () {
            Utils.extractService(proto);
        }, /Service name should be provided in multi-service proto: {[\s\n]*HelloRequest/);

        Assert.throws(function () {
            Utils.extractService(proto, 'doesNotExists');
        }, /Cannot detect required service doesNotExists among {"Hello"/);

        var service = Utils.extractService(proto, 'Hello');
        Assert.deepEqual({
            name: 'Hello',
            methods: [{
                name: 'sayHello',
                requestStream: false,
                responseStream: false
            }]
        }, service);

        service = Utils.extractService(proto, 'Hi');
        Assert.deepEqual({
            name: 'Hi',
            methods: [{
                name: 'sayHi',
                requestStream: false,
                responseStream: false
            }]
        }, service);
    });

    it('should extract service with stream response', function () {
        var proto = require('./fixtures/hello-streaming/server').proto;
        var services = Utils.extractService(proto, 'Hello');
        Assert.deepEqual({
            name: 'Hello',
            methods: [
                {
                    name: 'sayHello',
                    requestStream: true,
                    responseStream: false
                },
                {
                    name: 'beGreeted',
                    requestStream: false,
                    responseStream: true
                },
                {
                    name: 'sayHelloAll',
                    requestStream: true,
                    responseStream: true
                },

            ]
        }, services);
    });

    it('should handle package', function () {
        var proto = require('./fixtures/messages/index').proto;

        Assert.throws(function () {
            Utils.extractService(proto);
        }, /Failed to detect services in proto: {[\s\n]*HelloRequest/);
    });

});
