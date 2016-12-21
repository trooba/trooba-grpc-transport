'use strict';

const Router = require('./router');

module.exports = function controller() {
    var router = Router.create();
    router.use({
        path: 'com/xyz/helloworld/Hello/sayHello',
        handle: require('./sayHello')
    });
    router.use({
        path: 'Hello/sayHello',
        handle: require('./sayHello')
    });
    router.use({
        path: 'Hello/sayHelloAll',
        handle: require('./sayHelloAll')
    });
    router.use({
        path: 'Hello/beGreeted',
        handle: require('./beGreeted')
    });

    return router.build();
};
