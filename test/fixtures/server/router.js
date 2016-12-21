'use strict';

var pathToRegexp = require('path-to-regexp');

/*
* Route:
    {
        path: '/path/to/:resource/:id',
        handler: function (request, pipe),
        match: regexp matcher => { params: {}, path: 'string' }
    }
*/

module.exports.create = () => {
    const routes = [];
    return {
        use: route => {
            routes.push(route);
        },

        build: () => {
            return buildRouter(routes);
        }
    };
};

function buildRouter(routes) {
    routes = buildMatcher(routes);

    return function routeHandler(pipe) {
        pipe.on('request', (request) => {
            for (let route of routes) {
                if (route.match(request.path)) {
                    return route.handle(request, pipe);
                }
            }
            pipe.throw(new Error('No path matched for ' + request.path));
        });
    };
}

function buildMatcher(routes) {
    let _routes = routes.slice();

    return _routes.map(route => {
        const regExp = pathToRegexp(route.path);
        route.match = route.match || function (path) {
            const matchResult = path.match(regExp);
            if (matchResult) {
                const params = {};
                const base = matchResult.shift();
                for (let index = 0; index < regExp.keys; index++) {
                    const param = regExp.keys[index];
                    param.value = matchResult[index];
                    params[param.name] = param;
                }
                return {
                    params: params,
                    path: base
                };
            }
        };

        return route;
    });

}
