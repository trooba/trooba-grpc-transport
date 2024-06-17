'use strict';

var Assert = require('assert');
var Trooba = require('trooba');

var transport = require('..');
var routes = require('./fixtures/server/routes');
const { set } = require('lodash');

describe(__filename, () => {
    var svr;

    afterEach(function (next) {
        svr.close(next);
        svr = undefined;
    });

    it('should start the server and do request/reponse', async () => {
        const Server = require('./fixtures/hello/server');

        const pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, function (err, response) {
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should get error', async () => {
        const Server = require('./fixtures/hello/server');

        const pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'error'
            }, function (err, response) {
                try {
                    Assert.ok(err);
                    Assert.equal('10 ABORTED: Test Error', err.message);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should send and receive metadata', async () => {
        const Server = require('./fixtures/hello/server');

        const pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        let meta;
        const pipeClient = Trooba
            .use(function catchHeaders(pipe) {
                pipe.on('response', function (response, next) {
                    meta = response.headers;
                    next();
                });
            })
            .use(transport, {
                port: svr.port,
                hostname: 'localhost',
                proto: Server.proto,
                serviceName: 'Hello'
            });
        const client = pipeClient.build().create('client:default');

        return new Promise((resolve, reject) => {
            client.sayHello({
                name: 'John'
            }, {
                meta: true,
                qaz: 'edc'
            }, function (err, response) {
                try {
                    Assert.ok(!err);
                    Assert.deepEqual({
                        'content-type': 'application/grpc+proto',
                        date: new Date(Date.now()).toUTCString(),
                        qaz: 'edc',
                        foo: 'bar'
                    }, meta);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should start the server and do request/reponse with namespace', async () => {
        const Server = require('./fixtures/hello-pkg/server');

        const pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto.com.xyz.helloworld,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        return new Promise((resolve, reject) => {
            client.sayHello({name:  'John'}, function (err, response) {
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John', response);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });
        });
    });

    it('should start the server and do request/stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const pipeServer = Trooba.use(transport, {
            port: 0,
            hostname: 'localhost',
            proto: Server.proto
        })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        let messageCount = 0;
        return new Promise((resolve, reject) => {
            const call = client.beGreeted('Jack');
            call
                .on('data', function (data) {
                    messageCount++;
                    try {
                        Assert.ok([
                            'Hello Jack from John',
                            'Hello Jack from Bob'
                        ].indexOf(data) !== -1);
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('end', function () {
                    // reached the end
                    try {
                        Assert.equal(2, messageCount);
                        done();
                    }
                    catch (err) {
                        reject(err);
                    }
                })
                .on('error', reject);
        });
    });

    it('should start the server and do stream/response', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const pipeServer = Trooba
            .use(transport, {
                port: 0,
                hostname: 'localhost',
                proto: Server.proto
            })
            .use(function dummy(pipe) {
                // nothing, just to have a pipeline
            })
            .use(function routes(pipe) {
                const names = [];
                pipe.on('request', function onData(request, next) {
                    next();
                });
                pipe.on('request:data', function onData(data, next) {
                    data && names.push(data.name);
                    next();
                });
                pipe.on('request:end', function onEnd() {
                    pipe.respond({
                        body: 'Hello ' + names.join(' and ')
                    });
                });
            });

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        return new Promise((resolve, reject) => {
            const call = client.sayHello(function (err, response) {
                // getting reponse
                try {
                    Assert.ok(!err, err && err.stack);
                    Assert.equal('Hello John and Bob', response);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            });

            call.write({name: 'John'});
            call.write({name: 'Bob'});
            call.end();
        });
    });

    it('should start the server and do stream/stream', async () => {
        const Server = require('./fixtures/hello-streaming/server');

        const pipeServer = Trooba
            .use(transport, {
                port: 0,
                hostname: 'localhost',
                proto: Server.proto
            })
            .use(function dummy(pipe) {
                // nothing, just to have a pipeline
            })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();
        Assert.ok(svr.port);

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');

        let messageCount = 0;

        return new Promise((resolve, reject) => {
            const call = client.sayHelloAll();

            call.on('data', function (data) {
                messageCount++;
                try {
                    Assert.ok([
                        'Hello John',
                        'Hello Bob'
                    ].indexOf(data) !== -1);
                }
                catch (err) {
                    reject(err);
                }
            }).on('end', function () {
                try {
                    Assert.equal(2, messageCount);
                    resolve();
                }
                catch (err) {
                    reject(err);
                }
            })
                .on('error', reject);

            call.write('John');
            call.write('Bob');
            call.end();
        });
    });

    it('should fail to start server twice on the same endpoint when it is already running', async () => {
        const Server = require('./fixtures/hello-streaming/server');
        const pipeServer = Trooba
            .use(transport, {
                port: 40000,
                hostname: 'localhost',
                proto: Server.proto
            })
            .use(function dummy(pipe) {
                // nothing, just to have a pipeline
            })
            .use(routes());

        const app = pipeServer.build().create('server:default');
        svr = await app.listen();

        const app2 = Trooba
            .use(transport, {
                port: 40000,
                hostname: 'localhost',
                proto: Server.proto
            })
            .use(function dummy(pipe) {
                // nothing, just to have a pipeline
            })
            .use(routes()).build().create('server:default');

        await new Promise(resolve => setTimeout(resolve, 1000));
        const err = (await app2.listen().catch(err => err));
        Assert.ok(/No address added out of total/.test(err.message));
    });

    it('should force shutdown', async () =>  {
        const Server = require('./fixtures/hello-streaming/server');
        const pipeServer = Trooba
            .use(transport, {
                port: 40000,
                hostname: 'localhost',
                proto: Server.proto
            })
            .use(routes());

        const app = pipeServer.build().create('server:default');

        svr = await app.listen();

        const pipeClient = Trooba.use(transport, {
            port: svr.port,
            hostname: 'localhost',
            proto: Server.proto,
            serviceName: 'Hello'
        });
        const client = pipeClient.build().create('client:default');
        client.sayHelloAll();

        return new Promise((resolve) => {
            svr.close(function () {
                resolve();
            }, 1);
        })
    });
});
