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
                // index += char.length;
                // console.log(index, count, str.substr(index));
                // if (count > 5) {
                //     break;
                // }
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
                var hash = href.substr(hashHead.length);
                var canLeave = checkLeave(hash, true);
            });
        },
        setCurrentRoute = function(route, routeData) {
            _current_route = route;
            _current_route_data = routeData;
        },
        invokeRoute = function(route, routeData) {
            console.log(_current_route, route);
            if (route.relate) {
                var relate = route.relate;
                if (relate == 'up') {
                    if (!route.name) {
                        action(route);
                    } else {
                        setCurrentRoute(route, routeData);
                    }
                } else if (relate === 'down' && _current_route.path != '/') {
                    var chainCaller = getRouteInvokeChain(
                        getRouteUtil(route, _current_route)
                    );
                    setCurrentRoute(route, routeData);
                    return chainCaller(routeData);
                } else if (relate === 'same') {
                    return action(route);
                }
            }
            if (route.parent && validRouteName.test(route.parent)) {
                var chainCaller = getRouteInvokeChain(getRouteChain(route));
                setCurrentRoute(route, routeData);
                return chainCaller(routeData);
            }
            function action(route) {
                var handle = route.handle;
                if (isFunction(handle)) {
                    handle(routeData);
                    setCurrentRoute(route, routeData);
                } else {
                    var enter = function(routeData) {
                        isFunction(handle.enter) && handle.enter(routeData);
                        setCurrentRoute(route, routeData);
                    };
                    // handle 是 hooks 对象
                    if (isFunction(handle.before)) {
                        var allow = handle.before(routeData, enter);
                        if (allow === false) {
                            return false;
                        }
                    }
                    enter(routeData);
                }
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
            console.log(hash, _current_route);
            var relate = checkRelation(hash, _current_route.path);
            console.log(relate);
            _next_route = getRouteByHash(hash);
            _next_route.relate = relate;
            function defaultNext(routeData) {
                console.log('defautlNext');
                DRIVED_BY_CLICK = click;
                setHash(hash);
            }
            // 当即将进入的是当前路由的下级路由, 不触发 leave
            if (relate === 'down' && _current_route.path !== '/') {
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
                    if (relate === 'same') {
                        if (_current_route && _current_route.handle) {
                            if (
                                isFunction(_current_route.handle.leave) &&
                                _current_route_data &&
                                _current_route_data.href != hash
                            ) {
                                return _current_route.handle.leave(
                                    _current_route_data,
                                    defaultNext
                                );
                            }
                            defaultNext(_current_route_data);
                        }
                    } else {
                        // 上级时, 找到终止路由, 并触发之间的 leave
                        leaveChain = getLeaveChain(
                            getRouteUtil(_current_route, _next_route.name),
                            defaultNext
                        );
                        leaveChain(_current_route_data);
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
                return 'down';
            } else if (hash2.substr(0, hash1.length) == hash1) {
                return 'up';
            }
            var last1 = getLastIndex(hash1, '/'),
                last2 = getLastIndex(hash2, '/');
            if (last1 === last2 && last1 !== -1) {
                if (hash1.substring(0, last1) == hash2.substring(0, last2)) {
                    return 'same';
                }
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
    // console.log(checkRelation('/user/2', '/user/config'));
    // console.log(checkRelation('/user/2', '/user/list'));
    // console.log(checkRelation('/user/2', '/'));
    // console.log(checkRelation('/user', '/user/3'));
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
    function getRouteUtil(router, par) {
        if (router.parent === par) {
            return [router, par];
        }
        var chain = [router];
        while ((router = RouteNamesMap[router.parent]) && router.name != par) {
            chain.push(router);
        }
        chain.push(par);
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
    function getRouteInvokeChain(chain) {
        // console.log(chain);
        // reduceRight 的执行结果, 必须返回一个以 route 为参数的函数
        return chain.reduce(function(accu, curr, i, arr) {
            // console.log(accu, curr, i);
            // return chain(curr, accu);
            return function(route) {
                curr = getRouteByName(curr);
                var handle = curr.handle;
                var next = function(route) {
                    isFunction(handle) ? handle(route) : handle.enter(route);
                    // curr.enter(route);
                    // console.log(accu);
                    // 如果不传 reduceRight 的第2个参数 null,
                    // 则第1个 accu会变成 chain 的最后一个元素
                    // 则这个判断要改一下
                    accu && accu(route);
                };
                if (handle.before) {
                    var can = handle.before(route, next);
                    if (can === false) {
                        return false;
                    }
                }
                next(route);
            };
        }, null);
    }
    function getLeaveChain(chain, done) {
        return chain.reduce(function(accu, curr, i) {
            return function(route) {
                curr = getRouteByName(curr);
                var leave = curr && curr.handle && curr.handle.leave;
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
        }, done);
    }
    return {
        on: function(options) {
            // new implement
            // 当只有 enter 时, 直接将其作为 handle
            var handle = (options.enter &&
                !options.leave &&
                !options.before &&
                options.enter) || {
                enter: options.enter,
                before: options.before,
                leave: options.leave
            };
            var path = normalizeHash(options.path);
            var routeObj = {
                path: path,
                name: options.name,
                parent: options.parent,
                // regexp: transObj.regexp,
                // paramNames: transObj.names,
                handle: handle
            };
            var isStatic = path.indexOf(':') < 0;
            if (isStatic) {
                if (staticRoutes[path]) {
                    throw new Error(
                        'the route path: ' + path + ' is already existed.'
                    );
                }
                routeObj.isStatic = true;
                staticRoutes[path] = routeObj;
                if (options.name) {
                    RouteNamesMap[options.name] = routeObj;
                }
            } else {
                var transObj = transferDynamic(path);
                // 动态路由特有的
                routeObj.regexp = transObj.regexp;
                routeObj.paramNames = transObj.names;

                dynamicRoutes.push(routeObj);
                if (options.name) {
                    RouteNamesMap[options.name] = routeObj;
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
