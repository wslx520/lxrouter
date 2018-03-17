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
    // 保存有别名的动态路由
    var dynamicRouteMap = {};
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
    var invokeRoute = function(handle, route) {
        _current_route_handle = handle;
        _current_route = route;
        if (isFunction(handle)) {
            handle(route);
        } else {
            // handle 是 hooks 对象
            if (isFunction(handle.before)) {
                handle.before(route, function(route) {
                    handle.enter(route);
                });
            } else if (isFunction(handle.enter)) {
                handle.enter(route);
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
                    invokeRoute(route.handle, {
                        href: hash,
                        path: hashPath,
                        search: searchObj,
                        qs: hashSearch,
                        params: params
                    });
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
            return "(\\w+)";
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
    win.onhashchange = hashChangeFn;
    return {
        on: function(path, fn, hooks) {
            if (fn && typeof fn === "object") {
                hooks = fn;
                fn = null;
            }
            if (isFunction(fn) && hooks) {
                if (!hooks.enter) {
                    hooks.enter = fn;
                } else {
                    var _enter = hooks.enter;
                    hooks.enter = function(route) {
                        fn(_enter(route));
                    };
                }
            }
            path = normalizeHash(path);
            var isStatic = path.indexOf(":") < 0;
            if (isStatic) {
                if (staticRoutes[path]) {
                    throw new Error(
                        "the route path: " + path + " is already existed."
                    );
                }
                staticRoutes[path] = fn || hooks;
            } else {
                var transObj = transferDynamic(path);
                dynamicRoutes.push({
                    path: path,
                    regexp: transObj.regexp,
                    paramNames: transObj.names,
                    handle: fn || hooks
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
