(function() {(window.nunjucksPrecompiled = window.nunjucksPrecompiled || {})["home.njk"] = (function() {
function root(env, context, frame, runtime, cb) {
var lineno = null;
var colno = null;
var output = "";
try {
var parentTemplate = null;
output += "<div class=\"d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pb-2 mb-3 border-bottom\">\r\n\t<h1 class=\"h2\">Dashboard</h1>\r\n\t<div class=\"btn-toolbar mb-2 mb-md-0\">\r\n\t\t<div class=\"btn-group mr-2\">\r\n\t\t\t<button class=\"btn btn-sm btn-outline-secondary\">Share</button>\r\n\t\t\t<button class=\"btn btn-sm btn-outline-secondary\">Export</button>\r\n\t\t</div>\r\n\t\t<button class=\"btn btn-sm btn-outline-secondary dropdown-toggle\">\r\n\t\t\t<span data-feather=\"calendar\"></span>\r\n\t\t\tThis week\r\n\t\t</button>\r\n\t</div>\r\n</div>\r\n\r\n<canvas class=\"my-4\" id=\"myChart\" width=\"900\" height=\"380\"></canvas>\r\n\r\n<h2>Section title</h2>\r\n<div class=\"table-responsive\">\r\n\t<table class=\"table table-striped table-sm\">\r\n\t\t<thead>\r\n\t\t\t<tr>\r\n\t\t\t\t<th>#</th>\r\n\t\t\t\t<th>Name</th>\r\n\t\t\t\t<th>Type</th>\r\n\t\t\t\t<th>Memo</th>\r\n\t\t\t\t<th>goop</th>\r\n\t\t\t</tr>\r\n\t\t</thead>\r\n\t\t<tbody>\r\n\t\t\t";
frame = frame.push();
var t_3 = runtime.contextOrFrameLookup(context, frame, "data");
if(t_3) {t_3 = runtime.fromIterator(t_3);
var t_2 = t_3.length;
for(var t_1=0; t_1 < t_3.length; t_1++) {
var t_4 = t_3[t_1];
frame.set("row", t_4);
frame.set("loop.index", t_1 + 1);
frame.set("loop.index0", t_1);
frame.set("loop.revindex", t_2 - t_1);
frame.set("loop.revindex0", t_2 - t_1 - 1);
frame.set("loop.first", t_1 === 0);
frame.set("loop.last", t_1 === t_2 - 1);
frame.set("loop.length", t_2);
output += "\r\n\t\t\t<tr>\r\n\t\t\t\t<td>";
output += runtime.suppressValue(runtime.memberLookup((t_4),"id"), env.opts.autoescape);
output += "</td>\r\n\t\t\t\t<td>";
output += runtime.suppressValue(runtime.memberLookup((t_4),"name"), env.opts.autoescape);
output += "</td>\r\n\t\t\t\t<td>";
output += runtime.suppressValue(runtime.memberLookup((t_4),"type"), env.opts.autoescape);
output += "</td>\r\n\t\t\t\t<td>";
output += runtime.suppressValue(runtime.memberLookup((t_4),"memo"), env.opts.autoescape);
output += "</td>\r\n\t\t\t\t<td>";
output += runtime.suppressValue(runtime.memberLookup((t_4),"goop"), env.opts.autoescape);
output += "</td>\r\n\t\t\t</tr>\r\n\t\t\t";
;
}
}
frame = frame.pop();
output += "\r\n\t\t</tbody>\r\n\t</table>\r\n</div>";
if(parentTemplate) {
parentTemplate.rootRenderFunc(env, context, frame, runtime, cb);
} else {
cb(null, output);
}
;
} catch (e) {
  cb(runtime.handleError(e, lineno, colno));
}
}
return {
root: root
};

})();
})();
