'use strict';

var Assert = require('assert');
var Async = require('async');
var Trooba = require('trooba');
var grpcTransport = require('..');

describe(__filename, function () {

    var server;

    afterEach(function () {
        server && server.forceShutdown();
    });

    it.only('should expose proto API', function (done) {
        var Server = require('./fixtures/hello/server');

        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it.only('should expose proto API with multiple methods, serial', function (done) {
        var Server = require('./fixtures/multi-hello/server');

        server = Server.start(50002);

        var client = Trooba.transport(grpcTransport, {
            port: 50002,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        Async.series({
            hello: function (next) {
                client.sayHello('John', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    next();
                });
            },

            hi: function (next) {
                client.sayHi('Bob', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hi Bob', response);
                    next();
                });
            }
        }, function validate(err, result) {
            Assert.ok(!err, err && err.stack);
            done();
        });

    });

    it.only('should expose proto API with multiple methods, parallel', function (done) {
        var Server = require('./fixtures/multi-hello/server');

        server = Server.start(50002);

        var client = Trooba.transport(grpcTransport, {
            port: 50002,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        Async.parallel({
            hello: function (next) {
                client.sayHello('John', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    next();
                });
            },

            hi: function (next) {
                client.sayHi('Bob', function (err, response) {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hi Bob', response);
                    next();
                });
            }
        }, function validate(err, result) {
            Assert.ok(!err, err && err.stack);
            done();
        });

    });

    it.skip('should expose proto API with multiple services', function (done) {
        var Server = require('./fixtures/multi-hello/server');
        server = Server.start(50001);

        var client = Trooba.transport(grpcTransport, {
            port: 50001,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        }).create();

        client.sayHello('John', function (err, response) {
            Assert.ok(!err, err && err.stack);
            Assert.equal('Hello John', response);
            done();
        });
    });

    it('should invoke grpc operation', function (done) {
    });

    it('should handle timeout', function (done) {
    });

    it('should propagate context', function (done) {
    });

    it('request/response', function (done) {
    });

    it('request stream/response, should expose streaming API', function (done) {
    });

    it('request/stream response, should expose streaming API', function (done) {
    });

    it('stream/stream, should expose streaming API', function (done) {
    });

    describe('negative', function () {
        it('should handle error in request/response flow', function (done) {
        });

        it('should handle error in request stream/response flow', function (done) {
        });

        it('should handle error in request/response stream flow', function (done) {
        });

        it('should handle error in stream/stream flow', function (done) {
        });
    });

    describe('parallel', function () {
        it('should handle request/response flow', function (done) {
        });

        it('should handle request stream/response flow', function (done) {
        });

        it('should handle request/response stream flow', function (done) {
        });

        it('should handle stream/stream flow', function (done) {
        });
    });
});
