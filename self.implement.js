var lxr = (function(win, doc) {
    // util functions
    function isFunction(n) {
        return 'function' === typeof n;
    }
    function getLastIndex(str, char) {
        return str.lastIndexOf(char);
    }
    function getCharCount(str, char) {
        var index = str.indexOf(char);
        if (index > -1) {
            var count = 1;
            while ((index = str.indexOf(char, (index += char.length))) !== -1) {
                count += 1;
            }
        }
        return count || 0;
    }
    // console.log(getCharCount("/abb/bb/bbc/d/dbbd/e", "bb"));
    var addEvent = document.addEventListener
        ? function(elem, type, fn) {
              elem.addEventListener(type, fn, false);
          }
        : function(elem, type, fn) {
              elem.attachEvent('on' + type, fn);
          };
    // util functions end
    var hashHead = '#!',
        previousHash = null,
        // 嵌套路由关系常量
        _UP_ = '_UP_',
        _DOWN_ = '_DOWN_',
        _SAME_ = '_SAME_',
        // 当点击链接触发路由时, 此变量为 true
        DRIVED_BY_CLICK = false,
        normalizeHash = function(hash) {
            return hash
                .replace(/\/{2,}/g, '/')
                .replace(/(\w)\/$/, '$1')
                .replace('/?', '?');
        },
        formatSearch = function(search) {
            search = search.split('&');
            search.forEach(function(si) {
                var index = si.indexOf('=');
                if (index > 0) {
                    obj[si.substring(0, index)] = si.substr(index + 1);
                } else {
                    obj[si] = '';
                }
            });
            return obj;
        },
        // 静态路由:对象; 动态路由:数组
        staticRoutes = {},
        dynamicRoutes = [],
        // 保存有别名的路由
        RouteNamesMap = {},
        // hashchange 时, 保存上一条 hash
        _current_route_data = null,
        _current_route = null,
        _next_route = null,
        hijackHashClick = function() {
            // from 司徒正美的 <JS框架设计>
            addEvent(document, 'click', function(e) {
                e = e || window.event;
                // 1. 路由系统未启动, 不进入
                if (!lxr.started) {
                    return;
                }
                // 2.不是左键点击, 或带有组合键
                if (
                    e.ctrlKey ||
                    e.metaKey ||
                    e.shiftKey ||
                    e.which === 2 ||
                    e.button === 2
                ) {
                    return;
                }
                // 3.此事件已被阻止
                if (e.returnValue === false) {
                    return;
                }
                // 4. 目标不是A元素, 或不是A元素的子元素
                var el = e.target || e.srcElement;
                while (el.nodeName !== 'A') {
                    el = el.parentNode;
                    if (!el || el.tagName === 'BODY') {
                        return;
                    }
                }
                // 5. 没有定义 hash 或是空 hash
                var href = el.getAttribute('href');
                if (href.slice(0, 2) !== hashHead) {
                    return;
                }
                // 6. 目标链接是用于下载资源或指向外部
                if (el.hasAttribute('download') || el.rel === 'external') {
                    return;
                }
                // 7. 邮箱
                if (~href.indexOf('mailto:')) {
                    return;
                }
                // 8. 要开新窗口
                if (el.target && el.target !== '_self') {
                    return;
                }
                // if (canLeave === false) {
                e.preventDefault();
                // }
                DRIVED_BY_CLICK = true;
                console.log(href, previousHash);
                if (href != previousHash) {
                    var hash = href.substr(hashHead.length);
                    var canLeave = checkLeave(hash, true);
                }
            });
        },
        setCurrentRoute = function(route, routeData) {
            _current_route = route;
            _current_route_data = routeData;
            _next_route && (_next_route.relate = null);
        },
        invokeRoute = function(route, routeData) {
            console.log(_current_route, route);
            if (route.relate) {
                var relate = route.relate;
                if (relate == _UP_) {
                    if (!route.name) {
                        return action(route);
                    } else {
                        return setCurrentRoute(route, routeData);
                    }
                } else if (relate === _SAME_) {
                    return action(route);
                } else {
                    var name =
                        relate === _DOWN_ && _current_route.path != '/'
                            ? _current_route.name
                            : relate;
                    if (route.parent === name) {
                        return action(route);
                    }
                    var chainCaller = getRouteInvokeChain(
                        getRouteUtil(route, name, true),
                        function() {
                            setCurrentRoute(route, routeData);
                        }
                    );
                    return chainCaller(routeData);
                }
            }
            if (route.parent && validRouteName.test(route.parent)) {
                var chainCaller = getRouteInvokeChain(
                    getRouteChain(route),
                    function() {
                        setCurrentRoute(route, routeData);
                    }
                );

                return chainCaller(routeData);
            }
            function action(route) {
                var enter = function(routeData) {
                    isFunction(route.enter) && route.enter(routeData);
                    setCurrentRoute(route, routeData);
                };
                if (isFunction(route.before)) {
                    var allow = route.before(routeData, enter);
                    if (allow === false) {
                        return false;
                    }
                }
                enter(routeData);
            }
            action(route);
        },
        callRoute = function(hash) {
            var ifSearch = hash.indexOf('?');
            if (ifSearch > 0) {
                var hashPath = hash.substring(0, ifSearch),
                    hashSearch = hash.substr(ifSearch + 1),
                    searchObj = formatSearch(hashSearch);
            } else {
                hashPath = hash;
            }
            var routeData = {
                href: hash,
                path: hashPath,
                search: searchObj,
                qs: hashSearch
            };
            var route = _next_route || getRouteByHash(hashPath);
            if (!route.isStatic) {
                var params = {},
                    names = route.paramNames;
                names.forEach(function(name, n) {
                    params[name] = RegExp['$' + (n + 1)];
                });
                routeData.params = params;
            }
            previousHash = hashHead + hash;
            return invokeRoute(route, routeData);
        },
        // transfer /path/:id/:action
        transferDynamic = function(path) {
            var paramNames = [],
                regstr = path.replace(/:[a-z0-9]+/g, function(m) {
                    paramNames.push(m.substr(1));
                    return '([\\w-]+)';
                });
            regstr = regstr + '$';
            // console.log(regstr, RegExp(regstr));
            return {
                names: paramNames,
                regexp: RegExp(regstr)
            };
        },
        // transferDynamic("/path/:id/:action");
        // 在去下一个路由前, 检查上一个路由的 hooks , 并执行其中的 leave. 参数是要去的目的 hash
        checkLeave = function(hash, click) {
            console.log(hash, _current_route, _current_route_data);
            var relate = checkRelation(hash, _current_route_data.path);
            console.log(relate);
            _next_route = getRouteByHash(hash);
            _next_route.relate = relate;
            function defaultNext(routeData) {
                console.log('defautlNext');
                DRIVED_BY_CLICK = click;
                setHash(hash);
            }
            // 当即将进入的是当前路由的下级路由, 不触发 leave
            if (relate === _DOWN_ && _current_route.path !== '/') {
                defaultNext();
            } else {
                // 无关或下一个路由没有 name 时, 触发所有leave
                if (!relate) {
                    var leaveChain = getLeaveChain(
                        getRouteChain(_current_route),
                        defaultNext
                    );
                    leaveChain(_current_route_data);
                } else {
                    // 同级时, 只触发当前路由的 leave
                    if (relate === _SAME_) {
                        if (_current_route) {
                            if (
                                isFunction(_current_route.leave) &&
                                _current_route_data &&
                                _current_route_data.href != hash
                            ) {
                                var can = _current_route.leave(
                                    _current_route_data,
                                    defaultNext
                                );
                                if (can === false) return false;
                            }
                            defaultNext(_current_route_data);
                        }
                    } else if (relate === _UP_) {
                        // 上级时, 找到终止路由, 并触发之间的 leave
                        leaveChain = getLeaveChain(
                            getRouteUtil(_current_route, _next_route.name),
                            defaultNext
                        );
                        leaveChain(_current_route_data);
                    } else {
                        var commonParent = getRouteByHash(relate);
                        if (commonParent) {
                            leaveChain = getLeaveChain(
                                getRouteUtil(
                                    _current_route,
                                    commonParent.name,
                                    true
                                ),
                                defaultNext
                            );
                            leaveChain(_current_route_data);
                            _next_route.relate = commonParent.name;
                        }
                    }
                }
            }
        },
        // 在进入路由前, 判断 before ,如果返回 false, 则不进入
        checkBefore = function(hash) {},
        // 检查 hash 之间的层级关系
        checkRelation = function(hash1, hash2) {
            // if (hash1.length != hash2.length) {
            if (hash1.substr(0, hash2.length) == hash2) {
                // hash1 是 hash2 的下级路由
                return _DOWN_;
            } else if (hash2.substr(0, hash1.length) == hash1) {
                return _UP_;
            }
            var last1 = getLastIndex(hash1, '/'),
                last2 = getLastIndex(hash2, '/');
            if (last1 === last2 && last1 !== -1) {
                if (hash1.substring(0, last1) == hash2.substring(0, last2)) {
                    return _SAME_;
                }
            }
            // 还有一种有共同上级的情况: /user/config 与 /user/2/all, 同属 /user 之下
            if (hash1.charAt(0) === '/') {
                var slash = 0,
                    match = false;
                while ((slash = hash1.indexOf('/', slash + 1)) != -1) {
                    var part = hash1.substring(0, slash);
                    if (hash2.indexOf(part) === 0) {
                        match = part;
                    }
                }
                return match;
            }
            // }
        },
        // 通过 hash 获得路由
        getRouteByHash = function(hashPath) {
            return staticRoutes[hashPath] || getDynamicRoute(hashPath);
        },
        getDynamicRoute = function(hashPath) {
            var result = null;
            dynamicRoutes.some(function(route) {
                if (route.regexp.test(hashPath)) {
                    result = route;
                    return true;
                }
                return false;
            });
            return result;
        },
        setHash = function(hash, replace) {
            if (hash.substr(0, hashHead.length) !== hashHead) {
                hash = hashHead + hash;
            }
            if (location.hash !== hash) {
                if (replace) {
                    history.back();
                }
                location.hash = hash;
            }
        },
        validRouteName = /^[\w-\.]+$/,
        hashChangeFn = function(e) {
            e = e || win.event;
            // console.log(location.hash);
            var hash = location.hash;
            if (hash === previousHash) return;
            hash = hash.substr(hashHead.length);
            if (!hash) return;
            // console.log(hash);
            if (hash.charAt(0) !== '/') {
                throw new Error('route path must starts with /');
            }
            hash = normalizeHash(hash);
            if (DRIVED_BY_CLICK) {
                DRIVED_BY_CLICK = false;
            } else {
                checkLeave(hash);
            }

            callRoute(hash);
        };
    console.log(checkRelation('/user/1', '/user/1/all'));
    win.onhashchange = hashChangeFn;
    // 得到路由链
    function getRouteChain(router) {
        var chain = [router];
        while ((router = RouteNamesMap[router.parent])) {
            chain.push(router);
        }
        return chain;
    }
    // 一直取到对应的上级路由为止
    function getRouteUtil(router, par, stopbefore) {
        if (router.parent === par || router.parent === par.name) {
            return [router, par];
        }
        var chain = [router];
        while (
            (router = RouteNamesMap[router.parent]) &&
            (router.name != par && router != par)
        ) {
            chain.push(router);
        }
        if (!stopbefore) {
            chain.push(par);
        }
        return chain;
    }
    function getRouteByName(name) {
        if (typeof name !== 'string') {
            return name;
        }
        var curr = RouteNamesMap[name];
        if (!curr) {
            throw new Error('Can not find route: ' + name);
        }
        return curr;
    }
    // 得到路由的 hooks 链调用函数
    function getRouteInvokeChain(chain, done) {
        // console.log(chain);
        // reduce 的执行结果, 必须返回一个以 route 为参数的函数
        return chain.reduce(function(accu, curr, i, arr) {
            // console.log(accu, curr, i);
            // return chain(curr, accu);
            return function(route) {
                curr = getRouteByName(curr);
                var next = function(route) {
                    curr.enter(route);
                    // 如果不传 reduce 的第2个参数 null,
                    // 则第1个 accu会变成 chain 的最后一个元素
                    // 则这个判断要改一下
                    accu && accu(route);
                };
                if (curr.before) {
                    var can = curr.before(route, next);
                    if (can === false) {
                        return false;
                    }
                }
                next(route);
            };
        }, done || null);
    }
    function getLeaveChain(chain, done) {
        // leaveChain使用 reduceRight ,因为是最底层的leave最先执行

        return chain.reduceRight(function(accu, curr, i) {
            return function(route) {
                curr = getRouteByName(curr);
                var leave = curr && curr.leave;
                var go = function(route) {
                    // console.log(accu);
                    accu && accu(route);
                };
                if (isFunction(leave)) {
                    var canLeave = leave(route, go);
                    if (canLeave === false) {
                        return false;
                    }
                }
                go(route);
            };
        }, done || null);
    }
    return {
        on: function(options) {
            // new implement
            var path = normalizeHash(options.path);
            options.path = path;
            var isStatic = path.indexOf(':') < 0;
            if (isStatic) {
                if (staticRoutes[path]) {
                    throw new Error(
                        'the route path: ' + path + ' is already existed.'
                    );
                }
                options.isStatic = true;
                staticRoutes[path] = options;
                if (options.name) {
                    RouteNamesMap[options.name] = options;
                }
            } else {
                var transObj = transferDynamic(path);
                // 动态路由特有的
                options.regexp = transObj.regexp;
                options.paramNames = transObj.names;

                dynamicRoutes.push(options);
                if (options.name) {
                    RouteNamesMap[options.name] = options;
                }
            }
            if (options.children) {
                if (!options.name) {
                    throw new Error(
                        'You need a name for this route to add children to it'
                    );
                }
                options.children.forEach(function(ops) {
                    ops.parent = options.name;
                    lxr.on(ops);
                });
            }
        },
        go: function(url) {},
        start: function(hash) {
            hash = hash || location.hash;
            if (hash.charAt(0) == '#') {
                hash = hash.substr(hashHead.length);
            }

            if (!hash) {
                hash = '/';
                setHash(hash);
            } else {
                hash = normalizeHash(hash);
                callRoute(hash);
            }

            this.started = true;
            hijackHashClick();
        }
    };
})(window, document);
