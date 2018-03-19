var lxr = (function(win, doc) {
    // util functions
    function isFunction(n) {
        return "function" === typeof n;
    }
    var addEvent = document.addEventListener
        ? function(elem, type, fn) {
              elem.addEventListener(type, fn, false);
          }
        : function(elem, type, fn) {
              elem.attachEvent("on" + type, fn);
          };
    // util functions end
    var hashHead = "#!";
    var normalizeHash = function(hash) {
        return hash
            .replace(/\/{2,}/g, "/")
            .replace(/(\w)\/$/, "$1")
            .replace("/?", "?");
    };
    var formatSearch = function(search) {
        var obj = {};
        search = search.split("&");
        for (var i = 0; i < search.length; i++) {
            var si = search[i];
            var index = si.indexOf("=");
            if (index > 0) {
                obj[si.substring(0, index)] = si.substr(index + 1);
            } else {
                obj[si] = "";
            }
        }
        return obj;
    };
    // 静态路由:对象; 动态路由:数组
    var staticRoutes = {},
        dynamicRoutes = [];
    // 保存有别名的路由
    var RouteNamesMap = {};
    // hashchange 时, 保存上一条 hash
    var _current_route = null,
        _current_route_handle = null;
    var hijackHashClick = function() {
        // from 司徒正美的 <JS框架设计>
        addEvent(document, "click", function(e) {
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
            while (el.nodeName !== "A") {
                el = el.parentNode;
                if (!el || el.tagName === "BODY") {
                    return;
                }
            }
            // 5. 没有定义 hash 或是空 hash
            var href = el.getAttribute("href");
            if (href.slice(0, 2) !== hashHead) {
                return;
            }
            // 6. 目标链接是用于下载资源或指向外部
            if (el.hasAttribute("download") || el.rel === "external") {
                return;
            }
            // 7. 邮箱
            if (~href.indexOf("mailto:")) {
                return;
            }
            // 8. 要开新窗口
            if (el.target && el.target !== "_self") {
                return;
            }

            var hash = href.substr(hashHead.length);
            var canLeave = checkLeave(hash);
            if (canLeave === false) {
                e.preventDefault();
            }
            // mmHistory.onHashChanged(href.replace(hashHead, ''), true);
        });
    };
    var invokeRoute = function(route, routeData) {
        _current_route_handle = route;
        _current_route = routeData;
        if (route.parent && validRouteName.test(route.parent)) {
            var chainCaller = getRouteInvokeChain(getRouteChain(route));
            return chainCaller(routeData);
        }
        var handle = route.handle;
        if (isFunction(handle)) {
            handle(routeData);
        } else {
            // handle 是 hooks 对象
            if (isFunction(handle.before)) {
                handle.before(routeData, function(routeData) {
                    handle.enter(routeData);
                });
            } else if (isFunction(handle.enter)) {
                handle.enter(routeData);
            }
        }
    };
    var callRoute = function(hash) {
        var ifSearch = hash.indexOf("?");
        if (ifSearch > 0) {
            var hashPath = hash.substring(0, ifSearch);
            var hashSearch = hash.substr(ifSearch + 1);
            var searchObj = formatSearch(hashSearch);
        } else {
            hashPath = hash;
        }
        if (staticRoutes[hashPath]) {
            invokeRoute(staticRoutes[hashPath], {
                href: hash,
                path: hashPath,
                search: searchObj,
                qs: hashSearch
            });
        } else {
            for (var i = 0, len = dynamicRoutes.length; i < len; i++) {
                var route = dynamicRoutes[i];
                var matched = route.regexp.test(hashPath);
                if (matched) {
                    var params = {};
                    var names = route.paramNames;
                    for (var n = 0, name; n < names.length; n++) {
                        name = names[n];
                        params[name] = RegExp["$" + (n + 1)];
                    }
                    invokeRoute(route, {
                        href: hash,
                        path: hashPath,
                        search: searchObj,
                        qs: hashSearch,
                        params: params
                    });
                    break;
                }
                // console.log(route, params);
            }
        }
    };
    // transfer /path/:id/:action
    var transferDynamic = function(path) {
        var paramNames = [];
        var regstr = path.replace(/:[a-z0-9]+/g, function(m) {
            paramNames.push(m.substr(1));
            return "([\\w-]+)";
        });
        regstr = regstr + "$";
        console.log(regstr, RegExp(regstr));
        return {
            names: paramNames,
            regexp: RegExp(regstr)
        };
    };
    transferDynamic("/path/:id/:action");
    // 在去下一个路由前, 检查上一个路由的 hooks , 并执行其中的 leave. 参数是要去的目的 hash
    var checkLeave = function(hash) {
        if (
            _current_route_handle &&
            isFunction(_current_route_handle.leave) &&
            _current_route &&
            _current_route.href != hash
        ) {
            return _current_route_handle.leave(_current_route, function(
                _current_route
            ) {
                setHash(hash);
            });
        }
    };
    var setHash = function(hash, replace) {
        if (hash.substr(0, hashHead.length) !== hashHead) {
            hash = hashHead + hash;
        }
        if (location.hash !== hash) {
            if (replace) {
                history.back();
            }
            location.hash = hash;
        }
    };
    var hashChangeFn = function(e) {
        e = e || win.event;
        console.log(location.hash);
        var hash = location.hash;
        hash = hash.substr(hashHead.length);
        if (!hash) return;
        console.log(hash);
        if (hash.charAt(0) !== "/") {
            throw new Error("route path must starts with /");
        }
        hash = normalizeHash(hash);
        callRoute(hash);
    };
    win.onhashchange = hashChangeFn;
    var validRouteName = /^[\w-\.]+$/;
    // 得到路由链
    function getRouteChain(router) {
        var chain = [router];
        while ((router = router.parent)) {
            chain.push(router);
        }
        return chain;
    }
    // 得到路由的 hooks 链调用函数
    function getRouteInvokeChain(chain) {
        console.log(chain);
        // reduceRight 的执行结果, 必须返回一个以 route 为参数的函数
        return chain.reduce(function(accu, curr, i, arr) {
            // console.log(accu, curr, i);
            // return chain(curr, accu);
            return function(route) {
                if (typeof curr === "string") {
                    var name = curr;
                    curr = RouteNamesMap[name];
                    if (!curr) {
                        throw new Error("Can not find route: " + name);
                    }
                }
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
                    handle.before(route, next);
                } else {
                    next(route);
                }
            };
        }, null);
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
            var isStatic = path.indexOf(":") < 0;
            if (isStatic) {
                if (staticRoutes[path]) {
                    throw new Error(
                        "the route path: " + path + " is already existed."
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
                        "You need a name for this route to add children to it"
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
            if (hash.charAt(0) == "#") {
                hash = hash.substr(hashHead.length);
            }

            if (!hash) {
                hash = "/";
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
