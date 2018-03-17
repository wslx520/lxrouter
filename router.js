/*兼容 IE8+*/
(function () {

	var storage = function () {
		var storageID, pname = 'msLastPath';
		return {
			getLastPath: function () {
				return localStorage.getItem();
			},
			setLastPath: function (path) {
				if (storageID) {
					clearTimeout(storageID);
					storageID = null;
				}
				localStorage.setItem(pname, path);
				// 设置路由保存一天, 过期清除
				storageID = setTimeout(function () {
					localStorage.removeItem(pname);
				}, 1000 * 60 * 60 * 24);
			}
		};
	}();
	var getHash = function (path) {
		if (path) {
			var index = path.indexOf('#');
			return index === -1 ? '' : decodeURI(path.substr(index));
		}
		return decodeURI(location.hash);
	};
	var extend = function (ori, newo) {
		if (Array.isArray(newo)) {
			newo.forEach(function (obj) {
				for (var n in newo) {
					ori[n] = newo[n];
				}
			});
			return ori;
		}
		for (var n in newo) {
			ori[n] = newo[n];
		}
		return ori;
	};
	var defaults = {
		root: '#/',
		html5: true
	};
	var supportPushState = history && 'function' === typeof history.pushState;
	var mmHistory = {
		hash: getHash(),
		start: function (options) {
			if (this.started) {
				throw new Error('history has already started.');
			}
			this.started = true;
			if (typeof options === 'boolean') {
				options = {
					html5: options
				}
			}
			options = extend({}, defaults, options || {});
			var root = options.root;
			var html5Mode = options.html5;
			this.options = options;
			this.mode = html5Mode ? 'popstate' : 'hashchange';
			if (!supportPushState) {
				console.log('浏览器不支持HTML5 pushState, 退化到 hashchange');
				this.mode = 'hashchange';
			}
			console.log('Router runs in `' + this.mode + '` mode.');
			if (this.mode == 'popstate') {
				// 延迟绑定, 避免古老 chrome 一进来就触发的问题
				setTimeout(function () {
					window.onpopstate = mmHistory.onHashChanged;
				}, 100);
			} else if (this.mode == 'hashchange') {
				window.onhashchange = mmHistory.onHashChanged;
			} else {
				throw new Error('浏览器太旧!');
			}
			//绑定 A 标签拦截事件
			hijackHashClick();
			// start 时触发一次
			this.onHashChanged();
		},
		stop: function () {
			
		},
		setHash: function (s, replace) {
			if (this.mode == 'popstate') {
				var path = (this.options.root + '/' + s).replace(/\/+/g, '/');
				var method = replace ? 'replaceState' : 'pushState';
				history[method]({}, document.title, path);
				// 手动触发 onpopstate 事件
				this.onHashChanged();
			} else {
				var newHash = this.options.hashPrefix + s;
				// 先后退, 再设置 hash, 就达到了"替换"当前 hash 的目的
				if (replace && location.hash !== newHash) {
					history.back();
				}
				location.hash = newHash;
			}
		},
		getPath: function () {
			return formatPath(getHash());
		},
		onHashChanged: function (hash, clickMode) {
			if (!clickMode) {
				hash = mmHistory.getPath();
			}
			hash = decodeURIComponent(hash);
			if (hash.charAt(0) != '/') {
				// hash = '/' + hash;
			}
			console.log(hash, mmHistory.hash)
			if (hash !== mmHistory.hash) {
				mmHistory.hash = hash;
				if (mmRouter) {
					mmRouter.navigate(hash, 0);
				}
				// 点击模式下, 默认行为(改变hash)会被阻止, 所以手动改变 hash
				if (clickMode) {
					mmHistory.setHash(hash);
					if (mmHistory.options.autoScroll) {
						autoScroll(hash.substr(1));
					}
				}
			}
		}
	};
	var formatPath = function (path) {
		return path.replace(/^#!?/, '').replace(/\/+/g, '/');
    };
	var addEvent = document.addEventListener ? function (elem, type, fn) {
		elem.addEventListener(type, fn, false);
	} : function (elem, type, fn) {
		elem.attachEvent('on' + type, fn);
	};
	var hijackHashClick = function () {
		addEvent(document, 'click', function (e) {
			e = e || window.event;
			// 1. 路由系统未启动, 不进入
			if (!mmHistory.started) {
				return;
			}
			// 2.不是左键点击, 或带有组合键
			if (e.ctrlKey || e.metaKey || e.shiftKey || e.which === 2 || e.button === 2) {
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
			if (href.slice(0, 2) !== '#!') {
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
			e.preventDefault();
			mmHistory.onHashChanged(href.replace('#!', ''), true);
		})
	};

	// 自动滚动到 指定锚点
	var autoScroll = (function () {
		function getFirstAnthor(name) {
			var list = document.links;
			for (var i = 0, el; el = list[i++];) {
				if (el.name === name) {
					return el;
				}
			}
		}
		function getOffset(el) {
			
		}
		return function (hash) {
			var el = document.getElementById(hash);
			if (!el) {
				el = getFirstAnthor(hash);
			}
			if (el) {
				el.scrollIntoView();
			}
		}
	})();

	// path-to-regexp
	var p2r = (function () {


        /**
         * Default configs.
         */
        var DEFAULT_DELIMITER = '/';
        var DEFAULT_DELIMITERS = './';

        /**
         * The main path matching regexp utility.
         *
         * @type {RegExp}
         */
        var PATH_REGEXP = new RegExp([
            // Match escaped characters that would otherwise appear in future matches.
            // This allows the user to escape special characters that won't transform.
            '(\\\\.)',
            // Match Express-style parameters and un-named parameters with a prefix
            // and optional suffixes. Matches appear as:
            //
            // "/:test(\\d+)?" => ["/", "test", "\d+", undefined, "?"]
            // "/route(\\d+)"  => [undefined, undefined, undefined, "\d+", undefined]
            '(?:\\:(\\w+)(?:\\(((?:\\\\.|[^\\\\()])+)\\))?|\\(((?:\\\\.|[^\\\\()])+)\\))([+*?])?'
        ].join('|'), 'g');

        /**
         * Parse a string for the raw tokens.
         *
         * @param  {string}  str
         * @param  {Object=} options
         * @return {!Array}
         */
        function parse (str, options) {
            var tokens = [];
            var key = 0;
            var index = 0;
            var path = '';
            var defaultDelimiter = (options && options.delimiter) || DEFAULT_DELIMITER;
            var delimiters = (options && options.delimiters) || DEFAULT_DELIMITERS;
            var pathEscaped = false;
            var res;

            while ((res = PATH_REGEXP.exec(str)) !== null) {
                var m = res[0];
                var escaped = res[1];
                var offset = res.index;
                path += str.slice(index, offset);
                index = offset + m.length;

                // Ignore already escaped sequences.
                if (escaped) {
                    path += escaped[1];
                    pathEscaped = true;
                    continue
                }

                var prev = '';
                var next = str[index];
                var name = res[2];
                var capture = res[3];
                var group = res[4];
                var modifier = res[5];

                if (!pathEscaped && path.length) {
                    var k = path.length - 1;

                    if (delimiters.indexOf(path[k]) > -1) {
                        prev = path[k];
                        path = path.slice(0, k)
                    }
                }

                // Push the current path onto the tokens.
                if (path) {
                    tokens.push(path);
                    path = '';
                    pathEscaped = false
                }

                var partial = prev !== '' && next !== undefined && next !== prev;
                var repeat = modifier === '+' || modifier === '*';
                var optional = modifier === '?' || modifier === '*';
                var delimiter = prev || defaultDelimiter;
                var pattern = capture || group;

                tokens.push({
                    name: name || key++,
                    prefix: prev,
                    delimiter: delimiter,
                    optional: optional,
                    repeat: repeat,
                    partial: partial,
                    pattern: pattern ? escapeGroup(pattern) : '[^' + escapeString(delimiter) + ']+?'
                })
            }

            // Push any remaining characters.
            if (path || index < str.length) {
                tokens.push(path + str.substr(index))
            }

            return tokens
        }

        /**
         * Compile a string to a template function for the path.
         *
         * @param  {string}             str
         * @param  {Object=}            options
         * @return {!function(Object=, Object=)}
         */
        function compile (str, options) {
            return tokensToFunction(parse(str, options))
        }

        /**
         * Expose a method for transforming tokens into the path function.
         */
        function tokensToFunction (tokens) {
            // Compile all the tokens into regexps.
            var matches = new Array(tokens.length);

            // Compile all the patterns before compilation.
            for (var i = 0; i < tokens.length; i++) {
                if (typeof tokens[i] === 'object') {
                    matches[i] = new RegExp('^(?:' + tokens[i].pattern + ')$')
                }
            }

            return function (data, options) {
                var path = '';
                var encode = (options && options.encode) || encodeURIComponent;

                for (var i = 0; i < tokens.length; i++) {
                    var token = tokens[i];

                    if (typeof token === 'string') {
                        path += token;
                        continue
                    }

                    var value = data ? data[token.name] : undefined;
                    var segment;

                    if (Array.isArray(value)) {
                        if (!token.repeat) {
                            throw new TypeError('Expected "' + token.name + '" to not repeat, but got array')
                        }

                        if (value.length === 0) {
                            if (token.optional) continue;

                            throw new TypeError('Expected "' + token.name + '" to not be empty')
                        }

                        for (var j = 0; j < value.length; j++) {
                            segment = encode(value[j]);

                            if (!matches[i].test(segment)) {
                                throw new TypeError('Expected all "' + token.name + '" to match "' + token.pattern + '"')
                            }

                            path += (j === 0 ? token.prefix : token.delimiter) + segment
                        }

                        continue
                    }

                    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                        segment = encode(String(value));

                        if (!matches[i].test(segment)) {
                            throw new TypeError('Expected "' + token.name + '" to match "' + token.pattern + '", but got "' + segment + '"')
                        }

                        path += token.prefix + segment;
                        continue
                    }

                    if (token.optional) {
                        // Prepend partial segment prefixes.
                        if (token.partial) path += token.prefix;

                        continue
                    }

                    throw new TypeError('Expected "' + token.name + '" to be ' + (token.repeat ? 'an array' : 'a string'))
                }

                return path
            }
        }

        /**
         * Escape a regular expression string.
         *
         * @param  {string} str
         * @return {string}
         */
        function escapeString (str) {
            return str.replace(/([.+*?=^!:${}()[\]|/\\])/g, '\\$1')
        }

        /**
         * Escape the capturing group by escaping special characters and meaning.
         *
         * @param  {string} group
         * @return {string}
         */
        function escapeGroup (group) {
            return group.replace(/([=!:$/()])/g, '\\$1')
        }

        /**
         * Get the flags for a regexp from the options.
         *
         * @param  {Object} options
         * @return {string}
         */
        function flags (options) {
            return options && options.sensitive ? '' : 'i'
        }

        /**
         * Pull out keys from a regexp.
         *
         * @param  {!RegExp} path
         * @param  {Array=}  keys
         * @return {!RegExp}
         */
        function regexpToRegexp (path, keys) {
            if (!keys) return path;

            // Use a negative lookahead to match only capturing groups.
            var groups = path.source.match(/\((?!\?)/g);

            if (groups) {
                for (var i = 0; i < groups.length; i++) {
                    keys.push({
                        name: i,
                        prefix: null,
                        delimiter: null,
                        optional: false,
                        repeat: false,
                        partial: false,
                        pattern: null
                    })
                }
            }

            return path
        }

        /**
         * Transform an array into a regexp.
         *
         * @param  {!Array}  path
         * @param  {Array=}  keys
         * @param  {Object=} options
         * @return {!RegExp}
         */
        function arrayToRegexp (path, keys, options) {
            var parts = [];

            for (var i = 0; i < path.length; i++) {
                parts.push(pathToRegexp(path[i], keys, options).source)
            }

            return new RegExp('(?:' + parts.join('|') + ')', flags(options))
        }

        /**
         * Create a path regexp from string input.
         *
         * @param  {string}  path
         * @param  {Array=}  keys
         * @param  {Object=} options
         * @return {!RegExp}
         */
        function stringToRegexp (path, keys, options) {
            return tokensToRegExp(parse(path, options), keys, options)
        }

        /**
         * Expose a function for taking tokens and returning a RegExp.
         *
         * @param  {!Array}  tokens
         * @param  {Array=}  keys
         * @param  {Object=} options
         * @return {!RegExp}
         */
        function tokensToRegExp (tokens, keys, options) {
            options = options || {};

            var strict = options.strict;
            var end = options.end !== false;
            var delimiter = escapeString(options.delimiter || DEFAULT_DELIMITER);
            var delimiters = options.delimiters || DEFAULT_DELIMITERS;
            var endsWith = [].concat(options.endsWith || []).map(escapeString).concat('$').join('|');
            var route = '';
            var isEndDelimited = false;

            // Iterate over the tokens and create our regexp string.
            for (var i = 0; i < tokens.length; i++) {
                var token = tokens[i];

                if (typeof token === 'string') {
                    route += escapeString(token);
                    isEndDelimited = i === tokens.length - 1 && delimiters.indexOf(token[token.length - 1]) > -1
                } else {
                    var prefix = escapeString(token.prefix);
                    var capture = token.repeat
                        ? '(?:' + token.pattern + ')(?:' + prefix + '(?:' + token.pattern + '))*'
                        : token.pattern;

                    if (keys) keys.push(token);

                    if (token.optional) {
                        if (token.partial) {
                            route += prefix + '(' + capture + ')?'
                        } else {
                            route += '(?:' + prefix + '(' + capture + '))?'
                        }
                    } else {
                        route += prefix + '(' + capture + ')'
                    }
                }
            }

            if (end) {
                if (!strict) route += '(?:' + delimiter + ')?';

                route += endsWith === '$' ? '$' : '(?=' + endsWith + ')'
            } else {
                if (!strict) route += '(?:' + delimiter + '(?=' + endsWith + '))?';
                if (!isEndDelimited) route += '(?=' + delimiter + '|' + endsWith + ')'
            }

            return new RegExp('^' + route, flags(options))
        }

        /**
         * Normalize the given path string, returning a regular expression.
         *
         * An empty array can be passed in for the keys, which will hold the
         * placeholder key descriptions. For example, using `/user/:id`, `keys` will
         * contain `[{ name: 'id', delimiter: '/', optional: false, repeat: false }]`.
         *
         * @param  {(string|RegExp|Array)} path
         * @param  {Array=}                keys
         * @param  {Object=}               options
         * @return {!RegExp}
         */
        function pathToRegexp (path, keys, options) {
            if (path instanceof RegExp) {
                return regexpToRegexp(path, keys)
            }

            if (Array.isArray(path)) {
                return arrayToRegexp(/** @type {!Array} */ (path), keys, options)
            }

            return stringToRegexp(/** @type {string} */ (path), keys, options)
        }
        return {
            /**
             * Expose `pathToRegexp`.
             */
            pathToRegexp: pathToRegexp,
        	parse: parse,
        	compile: compile,
        	tokensToFunction: tokensToFunction,
        	tokensToRegExp: tokensToRegExp
		};
	})();
	//	Router
	function Router() {
		this.rules = [];
    }
    Router.prototype = storage;
	extend(Router.prototype, {
		error: function (callback) {
			this.errorback = callback;
        },
        start: function () {
            mmHistory.start();
        },
		add: function (path, callback, opts) {
			var array = this.rules;
			if (path.charAt(0) !== '/') {
				console.error('路由 path 必须以 / 开头');
			}
			opts = opts || {};
			opts.callback = callback;
			if (path.length > 2 && path.charAt(path.length - 1) === '/') {
				// 去掉以 / 结尾的 path 的 /
				path = path.slice(0, -1);
				opts.last = '/';
			}
			var keys = [];
			var reg = p2r.pathToRegexp(path, keys);
			opts.keys = keys;
			opts.regexp = reg;
			// 最好添加之前除重, 暂时没做
			array.push(opts);
        },
		route: function (path, query) {
			path = path.trim();
			var rules = this.rules;
			console.log(rules)
			for (var i = 0, el; el = rules[i++];) {
				var args = path.match(el.regexp);
				console.log(el, args);
				if (args) {
					el.query = query || {};
					el.path = path;
					el.params = {};
					var keys = el.keys;
					args.shift();
					if (keys.length) {
						_parseArgs(args, el);
					}
					return el.callback.apply(el, args);
				}
				if (this.errorback) {
					this.errorback();
				}
			}
        },
		// 手动通过代码切换路由
		navigate: function (hash, mode) {
			hash = formatPath(hash);
			console.log('navigate', hash);
			var parsed = parseQuery(hash);
			var newHash = this.route(parsed.path, parsed.query);
			if (isLegalPath(newHash)) {
				hash = newHash;
			}
			// 保存 hash
			this.setLastPath(hash);
			if (mode === 1) {
				mmHistory.setHash(hash, true);
			} else if(mode === 2) {
				mmHistory.setHash(hash);
			}
			return hash;
        }
	});

	function _parseArgs(match, stateObj) {
		var keys = stateObj.keys;
		for (var j = 0, len = keys.length; j < len; j++) {
			var key = keys[j];
			var value = match[j] || '';
			match[j] = stateObj.params[key.name] = value;
		}
    }
    function parseQuery(url) {
		var index = url.indexOf('?');
		var path = index > -1 ? url.substring(0, index) : url;
        var res = {path: path};
		if (index > -1) {
			var query = url.substr( index + 1).split('&');
			var qo = {};
			query.forEach(function (t) {
				t = t.split('=');
				qo[t[0]] = decodeURIComponent(t[1]);
			});
			res.query = qo;
		}
		return res;
    }
	function isLegalPath(path) {
		return true;
    }
    var mmRouter = new Router();
    window.router = mmRouter;
})();