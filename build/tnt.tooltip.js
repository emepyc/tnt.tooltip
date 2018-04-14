(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
if (typeof tnt === "undefined") {
    module.exports = tnt = {};
}
tnt.tooltip = require("./index.js");

},{"./index.js":2}],2:[function(require,module,exports){
module.exports = require("./src/tooltip.js");

},{"./src/tooltip.js":5}],3:[function(require,module,exports){
module.exports = require("./src/api.js");

},{"./src/api.js":4}],4:[function(require,module,exports){
var api = function (who) {

    var _methods = function () {
	var m = [];

	m.add_batch = function (obj) {
	    m.unshift(obj);
	};

	m.update = function (method, value) {
	    for (var i=0; i<m.length; i++) {
		for (var p in m[i]) {
		    if (p === method) {
			m[i][p] = value;
			return true;
		    }
		}
	    }
	    return false;
	};

	m.add = function (method, value) {
	    if (m.update (method, value) ) {
	    } else {
		var reg = {};
		reg[method] = value;
		m.add_batch (reg);
	    }
	};

	m.get = function (method) {
	    for (var i=0; i<m.length; i++) {
		for (var p in m[i]) {
		    if (p === method) {
			return m[i][p];
		    }
		}
	    }
	};

	return m;
    };

    var methods    = _methods();
    var api = function () {};

    api.check = function (method, check, msg) {
	if (method instanceof Array) {
	    for (var i=0; i<method.length; i++) {
		api.check(method[i], check, msg);
	    }
	    return;
	}

	if (typeof (method) === 'function') {
	    method.check(check, msg);
	} else {
	    who[method].check(check, msg);
	}
	return api;
    };

    api.transform = function (method, cbak) {
	if (method instanceof Array) {
	    for (var i=0; i<method.length; i++) {
		api.transform (method[i], cbak);
	    }
	    return;
	}

	if (typeof (method) === 'function') {
	    method.transform (cbak);
	} else {
	    who[method].transform(cbak);
	}
	return api;
    };

    var attach_method = function (method, opts) {
	var checks = [];
	var transforms = [];

	var getter = opts.on_getter || function () {
	    return methods.get(method);
	};

	var setter = opts.on_setter || function (x) {
	    for (var i=0; i<transforms.length; i++) {
		x = transforms[i](x);
	    }

	    for (var j=0; j<checks.length; j++) {
		if (!checks[j].check(x)) {
		    var msg = checks[j].msg || 
			("Value " + x + " doesn't seem to be valid for this method");
		    throw (msg);
		}
	    }
	    methods.add(method, x);
	};

	var new_method = function (new_val) {
	    if (!arguments.length) {
		return getter();
	    }
	    setter(new_val);
	    return who; // Return this?
	};
	new_method.check = function (cbak, msg) {
	    if (!arguments.length) {
		return checks;
	    }
	    checks.push ({check : cbak,
			  msg   : msg});
	    return this;
	};
	new_method.transform = function (cbak) {
	    if (!arguments.length) {
		return transforms;
	    }
	    transforms.push(cbak);
	    return this;
	};

	who[method] = new_method;
    };

    var getset = function (param, opts) {
	if (typeof (param) === 'object') {
	    methods.add_batch (param);
	    for (var p in param) {
		attach_method (p, opts);
	    }
	} else {
	    methods.add (param, opts.default_value);
	    attach_method (param, opts);
	}
    };

    api.getset = function (param, def) {
	getset(param, {default_value : def});

	return api;
    };

    api.get = function (param, def) {
	var on_setter = function () {
	    throw ("Method defined only as a getter (you are trying to use it as a setter");
	};

	getset(param, {default_value : def,
		       on_setter : on_setter}
	      );

	return api;
    };

    api.set = function (param, def) {
	var on_getter = function () {
	    throw ("Method defined only as a setter (you are trying to use it as a getter");
	};

	getset(param, {default_value : def,
		       on_getter : on_getter}
	      );

	return api;
    };

    api.method = function (name, cbak) {
	if (typeof (name) === 'object') {
	    for (var p in name) {
		who[p] = name[p];
	    }
	} else {
	    who[name] = cbak;
	}
	return api;
    };

    return api;
    
};

module.exports = exports = api;
},{}],5:[function(require,module,exports){
var apijs = require("tnt.api");

var tooltip = function () {
    "use strict";

    var drag = d3.behavior.drag();
    var tooltip_div;

    var conf = {
        container: undefined,
        position : "right",
        allow_drag : true,
        show_closer : true,
        fill : function () { throw "fill is not defined in the base object"; },
        width : 180,
        id : 1
    };

    var t = function (data, event) {
        drag
            .origin(function(){
                return {
                    x : parseInt(d3.select(this).style("left")),
                    y : parseInt(d3.select(this).style("top"))
                };
            })
            .on("drag", function() {
                if (conf.allow_drag) {
                    d3.select(this)
                        .style("left", d3.event.x + "px")
                        .style("top", d3.event.y + "px");
                }
            });

        // TODO: Why do we need the div element?
        // It looks like if we anchor the tooltip in the "body"
        // The tooltip is not located in the right place (appears at the bottom)
        // See clients/tooltips_test.html for an example
        var containerElem = conf.container;
        if (!containerElem) {
            containerElem = selectAncestor(this, "div");
            if (containerElem === undefined) {
                // We require a div element at some point to anchor the tooltip
                return;
            }
        }

        tooltip_div = d3.select(containerElem)
            .append("div")
            .attr("class", "tnt_tooltip")
            .classed("tnt_tooltip_active", true)  // TODO: Is this needed/used???
            .call(drag);

        // prev tooltips with the same header
        d3.select("#tnt_tooltip_" + conf.id).remove();

        if ((d3.event === null) && (event)) {
            d3.event = event;
        }
        var d3mouse = d3.mouse(containerElem);
        d3.event = null;

        var xoffset = 0;
        if (conf.position === "left") {
            xoffset = conf.width;
        }

        tooltip_div.attr("id", "tnt_tooltip_" + conf.id);

        // We place the tooltip
        tooltip_div
            .style("left", (d3mouse[0] - xoffset) + "px")
            .style("top", (d3mouse[1]) + "px");

        // Close
        if (conf.show_closer) {
            tooltip_div
                .append("div")
                .attr("class", "tnt_tooltip_closer")
                .on ("click", function () {
                    t.close();
                });
        }

        conf.fill.call(tooltip_div.node(), data);

        // return this here?
        return t;
    };

    // gets the first ancestor of elem having tagname "type"
    // example : var mydiv = selectAncestor(myelem, "div");
    function selectAncestor (elem, type) {
        type = type.toLowerCase();
        if (elem.parentNode === null) {
            console.log("No more parents");
            return undefined;
        }
        var tagName = elem.parentNode.tagName;

        if ((tagName !== undefined) && (tagName.toLowerCase() === type)) {
            return elem.parentNode;
        } else {
            return selectAncestor (elem.parentNode, type);
        }
    }

    var api = apijs(t)
        .getset(conf);

    api.check('position', function (val) {
        return (val === 'left') || (val === 'right');
    }, "Only 'left' or 'right' values are allowed for position");

    api.method('close', function () {
        if (tooltip_div) {
            tooltip_div.remove();
        }
    });

    return t;
};

tooltip.list = function () {
    // list tooltip is based on general tooltips
    var t = tooltip();
    var width = 180;

    t.fill (function (obj) {
        var tooltip_div = d3.select(this);
        var obj_info_list = tooltip_div
            .append("table")
            .attr("class", "tnt_zmenu")
            .attr("border", "solid")
            .style("width", t.width() + "px");

        // Tooltip header
        if (obj.header) {
            obj_info_list
                .append("tr")
                .attr("class", "tnt_zmenu_header")
                .append("th")
                .text(obj.header);
        }

        // Tooltip rows
        var table_rows = obj_info_list.selectAll(".tnt_zmenu_row")
            .data(obj.rows)
            .enter()
            .append("tr")
            .attr("class", "tnt_zmenu_row");

        table_rows
            .append("td")
            .style("text-align", "center")
            .html(function(d,i) {
                return obj.rows[i].value;
            })
            .each(function (d) {
                if (d.link === undefined) {
                    return;
                }
                d3.select(this)
                    .classed("link", 1)
                    .on('click', function (d) {
                        d.link(d.obj);
                        t.close.call(this);
                    });
            });
    });
    return t;
};

tooltip.table = function () {
    // table tooltips are based on general tooltips
    var t = tooltip();

    var width = 180;

    t.fill (function (obj) {
        var tooltip_div = d3.select(this);

        var obj_info_table = tooltip_div
            .append("table")
            .attr("class", "tnt_zmenu")
            .attr("border", "solid")
            .style("width", t.width() + "px");

        // Tooltip header
        if (obj.header) {
            obj_info_table
                .append("tr")
                .attr("class", "tnt_zmenu_header")
                .append("th")
                .attr("colspan", 2)
                .text(obj.header);
        }

        // Tooltip rows
        var table_rows = obj_info_table.selectAll(".tnt_zmenu_row")
            .data(obj.rows)
            .enter()
            .append("tr")
            .attr("class", "tnt_zmenu_row");

        table_rows
            .append("th")
            .attr("colspan", function (d, i) {
                if (d.value === "") {
                    return 2;
                }
                return 1;
            })
            .attr("class", function (d) {
                if (d.value === "") {
                    return "tnt_zmenu_inner_header";
                }
                return "tnt_zmenu_cell";
            })
            .html(function(d,i) {
                return obj.rows[i].label;
            });

        table_rows
            .append("td")
            .html(function(d,i) {
                if (typeof obj.rows[i].value === 'function') {
                    obj.rows[i].value.call(this, d);
                } else {
                    return obj.rows[i].value;
                }
            })
            .each(function (d) {
                if (d.value === "") {
                    d3.select(this).remove();
                }
            })
            .each(function (d) {
                if (d.link === undefined) {
                    return;
                }
                d3.select(this)
                .classed("link", 1)
                .on('click', function (d) {
                    d.link(d.obj);
                    t.close.call(this);
                });
            });
    });

    return t;
};

tooltip.plain = function () {
    // plain tooltips are based on general tooltips
    var t = tooltip();

    t.fill (function (obj) {
        var tooltip_div = d3.select(this);

        var obj_info_table = tooltip_div
            .append("table")
            .attr("class", "tnt_zmenu")
            .attr("border", "solid")
            .style("width", t.width() + "px");

        if (obj.header) {
            obj_info_table
                .append("tr")
                .attr("class", "tnt_zmenu_header")
                .append("th")
                .text(obj.header);
        }

        if (obj.body) {
            obj_info_table
                .append("tr")
                .attr("class", "tnt_zmenu_row")
                .append("td")
                .style("text-align", "center")
                .html(obj.body);
        }
    });

    return t;
};

module.exports = exports = tooltip;

},{"tnt.api":3}]},{},[1])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9Vc2Vycy9taWd1ZWxwaWduYXRlbGxpL3NyYy9yZXBvcy90bnQudG9vbHRpcC9ub2RlX21vZHVsZXMvYnJvd3Nlci1wYWNrL19wcmVsdWRlLmpzIiwiL1VzZXJzL21pZ3VlbHBpZ25hdGVsbGkvc3JjL3JlcG9zL3RudC50b29sdGlwL2Zha2VfZGZmZGFlZDEuanMiLCIvVXNlcnMvbWlndWVscGlnbmF0ZWxsaS9zcmMvcmVwb3MvdG50LnRvb2x0aXAvaW5kZXguanMiLCIvVXNlcnMvbWlndWVscGlnbmF0ZWxsaS9zcmMvcmVwb3MvdG50LnRvb2x0aXAvbm9kZV9tb2R1bGVzL3RudC5hcGkvaW5kZXguanMiLCIvVXNlcnMvbWlndWVscGlnbmF0ZWxsaS9zcmMvcmVwb3MvdG50LnRvb2x0aXAvbm9kZV9tb2R1bGVzL3RudC5hcGkvc3JjL2FwaS5qcyIsIi9Vc2Vycy9taWd1ZWxwaWduYXRlbGxpL3NyYy9yZXBvcy90bnQudG9vbHRpcC9zcmMvdG9vbHRpcC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDSkE7QUFDQTs7QUNEQTtBQUNBOztBQ0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FDeExBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsImlmICh0eXBlb2YgdG50ID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgbW9kdWxlLmV4cG9ydHMgPSB0bnQgPSB7fTtcbn1cbnRudC50b29sdGlwID0gcmVxdWlyZShcIi4vaW5kZXguanNcIik7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IHJlcXVpcmUoXCIuL3NyYy90b29sdGlwLmpzXCIpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKFwiLi9zcmMvYXBpLmpzXCIpO1xuIiwidmFyIGFwaSA9IGZ1bmN0aW9uICh3aG8pIHtcblxuICAgIHZhciBfbWV0aG9kcyA9IGZ1bmN0aW9uICgpIHtcblx0dmFyIG0gPSBbXTtcblxuXHRtLmFkZF9iYXRjaCA9IGZ1bmN0aW9uIChvYmopIHtcblx0ICAgIG0udW5zaGlmdChvYmopO1xuXHR9O1xuXG5cdG0udXBkYXRlID0gZnVuY3Rpb24gKG1ldGhvZCwgdmFsdWUpIHtcblx0ICAgIGZvciAodmFyIGk9MDsgaTxtLmxlbmd0aDsgaSsrKSB7XG5cdFx0Zm9yICh2YXIgcCBpbiBtW2ldKSB7XG5cdFx0ICAgIGlmIChwID09PSBtZXRob2QpIHtcblx0XHRcdG1baV1bcF0gPSB2YWx1ZTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdCAgICB9XG5cdFx0fVxuXHQgICAgfVxuXHQgICAgcmV0dXJuIGZhbHNlO1xuXHR9O1xuXG5cdG0uYWRkID0gZnVuY3Rpb24gKG1ldGhvZCwgdmFsdWUpIHtcblx0ICAgIGlmIChtLnVwZGF0ZSAobWV0aG9kLCB2YWx1ZSkgKSB7XG5cdCAgICB9IGVsc2Uge1xuXHRcdHZhciByZWcgPSB7fTtcblx0XHRyZWdbbWV0aG9kXSA9IHZhbHVlO1xuXHRcdG0uYWRkX2JhdGNoIChyZWcpO1xuXHQgICAgfVxuXHR9O1xuXG5cdG0uZ2V0ID0gZnVuY3Rpb24gKG1ldGhvZCkge1xuXHQgICAgZm9yICh2YXIgaT0wOyBpPG0ubGVuZ3RoOyBpKyspIHtcblx0XHRmb3IgKHZhciBwIGluIG1baV0pIHtcblx0XHQgICAgaWYgKHAgPT09IG1ldGhvZCkge1xuXHRcdFx0cmV0dXJuIG1baV1bcF07XG5cdFx0ICAgIH1cblx0XHR9XG5cdCAgICB9XG5cdH07XG5cblx0cmV0dXJuIG07XG4gICAgfTtcblxuICAgIHZhciBtZXRob2RzICAgID0gX21ldGhvZHMoKTtcbiAgICB2YXIgYXBpID0gZnVuY3Rpb24gKCkge307XG5cbiAgICBhcGkuY2hlY2sgPSBmdW5jdGlvbiAobWV0aG9kLCBjaGVjaywgbXNnKSB7XG5cdGlmIChtZXRob2QgaW5zdGFuY2VvZiBBcnJheSkge1xuXHQgICAgZm9yICh2YXIgaT0wOyBpPG1ldGhvZC5sZW5ndGg7IGkrKykge1xuXHRcdGFwaS5jaGVjayhtZXRob2RbaV0sIGNoZWNrLCBtc2cpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuO1xuXHR9XG5cblx0aWYgKHR5cGVvZiAobWV0aG9kKSA9PT0gJ2Z1bmN0aW9uJykge1xuXHQgICAgbWV0aG9kLmNoZWNrKGNoZWNrLCBtc2cpO1xuXHR9IGVsc2Uge1xuXHQgICAgd2hvW21ldGhvZF0uY2hlY2soY2hlY2ssIG1zZyk7XG5cdH1cblx0cmV0dXJuIGFwaTtcbiAgICB9O1xuXG4gICAgYXBpLnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChtZXRob2QsIGNiYWspIHtcblx0aWYgKG1ldGhvZCBpbnN0YW5jZW9mIEFycmF5KSB7XG5cdCAgICBmb3IgKHZhciBpPTA7IGk8bWV0aG9kLmxlbmd0aDsgaSsrKSB7XG5cdFx0YXBpLnRyYW5zZm9ybSAobWV0aG9kW2ldLCBjYmFrKTtcblx0ICAgIH1cblx0ICAgIHJldHVybjtcblx0fVxuXG5cdGlmICh0eXBlb2YgKG1ldGhvZCkgPT09ICdmdW5jdGlvbicpIHtcblx0ICAgIG1ldGhvZC50cmFuc2Zvcm0gKGNiYWspO1xuXHR9IGVsc2Uge1xuXHQgICAgd2hvW21ldGhvZF0udHJhbnNmb3JtKGNiYWspO1xuXHR9XG5cdHJldHVybiBhcGk7XG4gICAgfTtcblxuICAgIHZhciBhdHRhY2hfbWV0aG9kID0gZnVuY3Rpb24gKG1ldGhvZCwgb3B0cykge1xuXHR2YXIgY2hlY2tzID0gW107XG5cdHZhciB0cmFuc2Zvcm1zID0gW107XG5cblx0dmFyIGdldHRlciA9IG9wdHMub25fZ2V0dGVyIHx8IGZ1bmN0aW9uICgpIHtcblx0ICAgIHJldHVybiBtZXRob2RzLmdldChtZXRob2QpO1xuXHR9O1xuXG5cdHZhciBzZXR0ZXIgPSBvcHRzLm9uX3NldHRlciB8fCBmdW5jdGlvbiAoeCkge1xuXHQgICAgZm9yICh2YXIgaT0wOyBpPHRyYW5zZm9ybXMubGVuZ3RoOyBpKyspIHtcblx0XHR4ID0gdHJhbnNmb3Jtc1tpXSh4KTtcblx0ICAgIH1cblxuXHQgICAgZm9yICh2YXIgaj0wOyBqPGNoZWNrcy5sZW5ndGg7IGorKykge1xuXHRcdGlmICghY2hlY2tzW2pdLmNoZWNrKHgpKSB7XG5cdFx0ICAgIHZhciBtc2cgPSBjaGVja3Nbal0ubXNnIHx8IFxuXHRcdFx0KFwiVmFsdWUgXCIgKyB4ICsgXCIgZG9lc24ndCBzZWVtIHRvIGJlIHZhbGlkIGZvciB0aGlzIG1ldGhvZFwiKTtcblx0XHQgICAgdGhyb3cgKG1zZyk7XG5cdFx0fVxuXHQgICAgfVxuXHQgICAgbWV0aG9kcy5hZGQobWV0aG9kLCB4KTtcblx0fTtcblxuXHR2YXIgbmV3X21ldGhvZCA9IGZ1bmN0aW9uIChuZXdfdmFsKSB7XG5cdCAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gZ2V0dGVyKCk7XG5cdCAgICB9XG5cdCAgICBzZXR0ZXIobmV3X3ZhbCk7XG5cdCAgICByZXR1cm4gd2hvOyAvLyBSZXR1cm4gdGhpcz9cblx0fTtcblx0bmV3X21ldGhvZC5jaGVjayA9IGZ1bmN0aW9uIChjYmFrLCBtc2cpIHtcblx0ICAgIGlmICghYXJndW1lbnRzLmxlbmd0aCkge1xuXHRcdHJldHVybiBjaGVja3M7XG5cdCAgICB9XG5cdCAgICBjaGVja3MucHVzaCAoe2NoZWNrIDogY2Jhayxcblx0XHRcdCAgbXNnICAgOiBtc2d9KTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHR9O1xuXHRuZXdfbWV0aG9kLnRyYW5zZm9ybSA9IGZ1bmN0aW9uIChjYmFrKSB7XG5cdCAgICBpZiAoIWFyZ3VtZW50cy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gdHJhbnNmb3Jtcztcblx0ICAgIH1cblx0ICAgIHRyYW5zZm9ybXMucHVzaChjYmFrKTtcblx0ICAgIHJldHVybiB0aGlzO1xuXHR9O1xuXG5cdHdob1ttZXRob2RdID0gbmV3X21ldGhvZDtcbiAgICB9O1xuXG4gICAgdmFyIGdldHNldCA9IGZ1bmN0aW9uIChwYXJhbSwgb3B0cykge1xuXHRpZiAodHlwZW9mIChwYXJhbSkgPT09ICdvYmplY3QnKSB7XG5cdCAgICBtZXRob2RzLmFkZF9iYXRjaCAocGFyYW0pO1xuXHQgICAgZm9yICh2YXIgcCBpbiBwYXJhbSkge1xuXHRcdGF0dGFjaF9tZXRob2QgKHAsIG9wdHMpO1xuXHQgICAgfVxuXHR9IGVsc2Uge1xuXHQgICAgbWV0aG9kcy5hZGQgKHBhcmFtLCBvcHRzLmRlZmF1bHRfdmFsdWUpO1xuXHQgICAgYXR0YWNoX21ldGhvZCAocGFyYW0sIG9wdHMpO1xuXHR9XG4gICAgfTtcblxuICAgIGFwaS5nZXRzZXQgPSBmdW5jdGlvbiAocGFyYW0sIGRlZikge1xuXHRnZXRzZXQocGFyYW0sIHtkZWZhdWx0X3ZhbHVlIDogZGVmfSk7XG5cblx0cmV0dXJuIGFwaTtcbiAgICB9O1xuXG4gICAgYXBpLmdldCA9IGZ1bmN0aW9uIChwYXJhbSwgZGVmKSB7XG5cdHZhciBvbl9zZXR0ZXIgPSBmdW5jdGlvbiAoKSB7XG5cdCAgICB0aHJvdyAoXCJNZXRob2QgZGVmaW5lZCBvbmx5IGFzIGEgZ2V0dGVyICh5b3UgYXJlIHRyeWluZyB0byB1c2UgaXQgYXMgYSBzZXR0ZXJcIik7XG5cdH07XG5cblx0Z2V0c2V0KHBhcmFtLCB7ZGVmYXVsdF92YWx1ZSA6IGRlZixcblx0XHQgICAgICAgb25fc2V0dGVyIDogb25fc2V0dGVyfVxuXHQgICAgICApO1xuXG5cdHJldHVybiBhcGk7XG4gICAgfTtcblxuICAgIGFwaS5zZXQgPSBmdW5jdGlvbiAocGFyYW0sIGRlZikge1xuXHR2YXIgb25fZ2V0dGVyID0gZnVuY3Rpb24gKCkge1xuXHQgICAgdGhyb3cgKFwiTWV0aG9kIGRlZmluZWQgb25seSBhcyBhIHNldHRlciAoeW91IGFyZSB0cnlpbmcgdG8gdXNlIGl0IGFzIGEgZ2V0dGVyXCIpO1xuXHR9O1xuXG5cdGdldHNldChwYXJhbSwge2RlZmF1bHRfdmFsdWUgOiBkZWYsXG5cdFx0ICAgICAgIG9uX2dldHRlciA6IG9uX2dldHRlcn1cblx0ICAgICAgKTtcblxuXHRyZXR1cm4gYXBpO1xuICAgIH07XG5cbiAgICBhcGkubWV0aG9kID0gZnVuY3Rpb24gKG5hbWUsIGNiYWspIHtcblx0aWYgKHR5cGVvZiAobmFtZSkgPT09ICdvYmplY3QnKSB7XG5cdCAgICBmb3IgKHZhciBwIGluIG5hbWUpIHtcblx0XHR3aG9bcF0gPSBuYW1lW3BdO1xuXHQgICAgfVxuXHR9IGVsc2Uge1xuXHQgICAgd2hvW25hbWVdID0gY2Jhaztcblx0fVxuXHRyZXR1cm4gYXBpO1xuICAgIH07XG5cbiAgICByZXR1cm4gYXBpO1xuICAgIFxufTtcblxubW9kdWxlLmV4cG9ydHMgPSBleHBvcnRzID0gYXBpOyIsInZhciBhcGlqcyA9IHJlcXVpcmUoXCJ0bnQuYXBpXCIpO1xuXG52YXIgdG9vbHRpcCA9IGZ1bmN0aW9uICgpIHtcbiAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgIHZhciBkcmFnID0gZDMuYmVoYXZpb3IuZHJhZygpO1xuICAgIHZhciB0b29sdGlwX2RpdjtcblxuICAgIHZhciBjb25mID0ge1xuICAgICAgICBjb250YWluZXI6IHVuZGVmaW5lZCxcbiAgICAgICAgcG9zaXRpb24gOiBcInJpZ2h0XCIsXG4gICAgICAgIGFsbG93X2RyYWcgOiB0cnVlLFxuICAgICAgICBzaG93X2Nsb3NlciA6IHRydWUsXG4gICAgICAgIGZpbGwgOiBmdW5jdGlvbiAoKSB7IHRocm93IFwiZmlsbCBpcyBub3QgZGVmaW5lZCBpbiB0aGUgYmFzZSBvYmplY3RcIjsgfSxcbiAgICAgICAgd2lkdGggOiAxODAsXG4gICAgICAgIGlkIDogMVxuICAgIH07XG5cbiAgICB2YXIgdCA9IGZ1bmN0aW9uIChkYXRhLCBldmVudCkge1xuICAgICAgICBkcmFnXG4gICAgICAgICAgICAub3JpZ2luKGZ1bmN0aW9uKCl7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgICAgICAgeCA6IHBhcnNlSW50KGQzLnNlbGVjdCh0aGlzKS5zdHlsZShcImxlZnRcIikpLFxuICAgICAgICAgICAgICAgICAgICB5IDogcGFyc2VJbnQoZDMuc2VsZWN0KHRoaXMpLnN0eWxlKFwidG9wXCIpKVxuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLm9uKFwiZHJhZ1wiLCBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICBpZiAoY29uZi5hbGxvd19kcmFnKSB7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKFwibGVmdFwiLCBkMy5ldmVudC54ICsgXCJweFwiKVxuICAgICAgICAgICAgICAgICAgICAgICAgLnN0eWxlKFwidG9wXCIsIGQzLmV2ZW50LnkgKyBcInB4XCIpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuXG4gICAgICAgIC8vIFRPRE86IFdoeSBkbyB3ZSBuZWVkIHRoZSBkaXYgZWxlbWVudD9cbiAgICAgICAgLy8gSXQgbG9va3MgbGlrZSBpZiB3ZSBhbmNob3IgdGhlIHRvb2x0aXAgaW4gdGhlIFwiYm9keVwiXG4gICAgICAgIC8vIFRoZSB0b29sdGlwIGlzIG5vdCBsb2NhdGVkIGluIHRoZSByaWdodCBwbGFjZSAoYXBwZWFycyBhdCB0aGUgYm90dG9tKVxuICAgICAgICAvLyBTZWUgY2xpZW50cy90b29sdGlwc190ZXN0Lmh0bWwgZm9yIGFuIGV4YW1wbGVcbiAgICAgICAgdmFyIGNvbnRhaW5lckVsZW0gPSBjb25mLmNvbnRhaW5lcjtcbiAgICAgICAgaWYgKCFjb250YWluZXJFbGVtKSB7XG4gICAgICAgICAgICBjb250YWluZXJFbGVtID0gc2VsZWN0QW5jZXN0b3IodGhpcywgXCJkaXZcIik7XG4gICAgICAgICAgICBpZiAoY29udGFpbmVyRWxlbSA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UgcmVxdWlyZSBhIGRpdiBlbGVtZW50IGF0IHNvbWUgcG9pbnQgdG8gYW5jaG9yIHRoZSB0b29sdGlwXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdG9vbHRpcF9kaXYgPSBkMy5zZWxlY3QoY29udGFpbmVyRWxlbSlcbiAgICAgICAgICAgIC5hcHBlbmQoXCJkaXZcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfdG9vbHRpcFwiKVxuICAgICAgICAgICAgLmNsYXNzZWQoXCJ0bnRfdG9vbHRpcF9hY3RpdmVcIiwgdHJ1ZSkgIC8vIFRPRE86IElzIHRoaXMgbmVlZGVkL3VzZWQ/Pz9cbiAgICAgICAgICAgIC5jYWxsKGRyYWcpO1xuXG4gICAgICAgIC8vIHByZXYgdG9vbHRpcHMgd2l0aCB0aGUgc2FtZSBoZWFkZXJcbiAgICAgICAgZDMuc2VsZWN0KFwiI3RudF90b29sdGlwX1wiICsgY29uZi5pZCkucmVtb3ZlKCk7XG5cbiAgICAgICAgaWYgKChkMy5ldmVudCA9PT0gbnVsbCkgJiYgKGV2ZW50KSkge1xuICAgICAgICAgICAgZDMuZXZlbnQgPSBldmVudDtcbiAgICAgICAgfVxuICAgICAgICB2YXIgZDNtb3VzZSA9IGQzLm1vdXNlKGNvbnRhaW5lckVsZW0pO1xuICAgICAgICBkMy5ldmVudCA9IG51bGw7XG5cbiAgICAgICAgdmFyIHhvZmZzZXQgPSAwO1xuICAgICAgICBpZiAoY29uZi5wb3NpdGlvbiA9PT0gXCJsZWZ0XCIpIHtcbiAgICAgICAgICAgIHhvZmZzZXQgPSBjb25mLndpZHRoO1xuICAgICAgICB9XG5cbiAgICAgICAgdG9vbHRpcF9kaXYuYXR0cihcImlkXCIsIFwidG50X3Rvb2x0aXBfXCIgKyBjb25mLmlkKTtcblxuICAgICAgICAvLyBXZSBwbGFjZSB0aGUgdG9vbHRpcFxuICAgICAgICB0b29sdGlwX2RpdlxuICAgICAgICAgICAgLnN0eWxlKFwibGVmdFwiLCAoZDNtb3VzZVswXSAtIHhvZmZzZXQpICsgXCJweFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwidG9wXCIsIChkM21vdXNlWzFdKSArIFwicHhcIik7XG5cbiAgICAgICAgLy8gQ2xvc2VcbiAgICAgICAgaWYgKGNvbmYuc2hvd19jbG9zZXIpIHtcbiAgICAgICAgICAgIHRvb2x0aXBfZGl2XG4gICAgICAgICAgICAgICAgLmFwcGVuZChcImRpdlwiKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfdG9vbHRpcF9jbG9zZXJcIilcbiAgICAgICAgICAgICAgICAub24gKFwiY2xpY2tcIiwgZnVuY3Rpb24gKCkge1xuICAgICAgICAgICAgICAgICAgICB0LmNsb3NlKCk7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgIH1cblxuICAgICAgICBjb25mLmZpbGwuY2FsbCh0b29sdGlwX2Rpdi5ub2RlKCksIGRhdGEpO1xuXG4gICAgICAgIC8vIHJldHVybiB0aGlzIGhlcmU/XG4gICAgICAgIHJldHVybiB0O1xuICAgIH07XG5cbiAgICAvLyBnZXRzIHRoZSBmaXJzdCBhbmNlc3RvciBvZiBlbGVtIGhhdmluZyB0YWduYW1lIFwidHlwZVwiXG4gICAgLy8gZXhhbXBsZSA6IHZhciBteWRpdiA9IHNlbGVjdEFuY2VzdG9yKG15ZWxlbSwgXCJkaXZcIik7XG4gICAgZnVuY3Rpb24gc2VsZWN0QW5jZXN0b3IgKGVsZW0sIHR5cGUpIHtcbiAgICAgICAgdHlwZSA9IHR5cGUudG9Mb3dlckNhc2UoKTtcbiAgICAgICAgaWYgKGVsZW0ucGFyZW50Tm9kZSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc29sZS5sb2coXCJObyBtb3JlIHBhcmVudHNcIik7XG4gICAgICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgICB9XG4gICAgICAgIHZhciB0YWdOYW1lID0gZWxlbS5wYXJlbnROb2RlLnRhZ05hbWU7XG5cbiAgICAgICAgaWYgKCh0YWdOYW1lICE9PSB1bmRlZmluZWQpICYmICh0YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IHR5cGUpKSB7XG4gICAgICAgICAgICByZXR1cm4gZWxlbS5wYXJlbnROb2RlO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHNlbGVjdEFuY2VzdG9yIChlbGVtLnBhcmVudE5vZGUsIHR5cGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgdmFyIGFwaSA9IGFwaWpzKHQpXG4gICAgICAgIC5nZXRzZXQoY29uZik7XG5cbiAgICBhcGkuY2hlY2soJ3Bvc2l0aW9uJywgZnVuY3Rpb24gKHZhbCkge1xuICAgICAgICByZXR1cm4gKHZhbCA9PT0gJ2xlZnQnKSB8fCAodmFsID09PSAncmlnaHQnKTtcbiAgICB9LCBcIk9ubHkgJ2xlZnQnIG9yICdyaWdodCcgdmFsdWVzIGFyZSBhbGxvd2VkIGZvciBwb3NpdGlvblwiKTtcblxuICAgIGFwaS5tZXRob2QoJ2Nsb3NlJywgZnVuY3Rpb24gKCkge1xuICAgICAgICBpZiAodG9vbHRpcF9kaXYpIHtcbiAgICAgICAgICAgIHRvb2x0aXBfZGl2LnJlbW92ZSgpO1xuICAgICAgICB9XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdDtcbn07XG5cbnRvb2x0aXAubGlzdCA9IGZ1bmN0aW9uICgpIHtcbiAgICAvLyBsaXN0IHRvb2x0aXAgaXMgYmFzZWQgb24gZ2VuZXJhbCB0b29sdGlwc1xuICAgIHZhciB0ID0gdG9vbHRpcCgpO1xuICAgIHZhciB3aWR0aCA9IDE4MDtcblxuICAgIHQuZmlsbCAoZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgdG9vbHRpcF9kaXYgPSBkMy5zZWxlY3QodGhpcyk7XG4gICAgICAgIHZhciBvYmpfaW5mb19saXN0ID0gdG9vbHRpcF9kaXZcbiAgICAgICAgICAgIC5hcHBlbmQoXCJ0YWJsZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInRudF96bWVudVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJib3JkZXJcIiwgXCJzb2xpZFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwid2lkdGhcIiwgdC53aWR0aCgpICsgXCJweFwiKTtcblxuICAgICAgICAvLyBUb29sdGlwIGhlYWRlclxuICAgICAgICBpZiAob2JqLmhlYWRlcikge1xuICAgICAgICAgICAgb2JqX2luZm9fbGlzdFxuICAgICAgICAgICAgICAgIC5hcHBlbmQoXCJ0clwiKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfem1lbnVfaGVhZGVyXCIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcInRoXCIpXG4gICAgICAgICAgICAgICAgLnRleHQob2JqLmhlYWRlcik7XG4gICAgICAgIH1cblxuICAgICAgICAvLyBUb29sdGlwIHJvd3NcbiAgICAgICAgdmFyIHRhYmxlX3Jvd3MgPSBvYmpfaW5mb19saXN0LnNlbGVjdEFsbChcIi50bnRfem1lbnVfcm93XCIpXG4gICAgICAgICAgICAuZGF0YShvYmoucm93cylcbiAgICAgICAgICAgIC5lbnRlcigpXG4gICAgICAgICAgICAuYXBwZW5kKFwidHJcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfem1lbnVfcm93XCIpO1xuXG4gICAgICAgIHRhYmxlX3Jvd3NcbiAgICAgICAgICAgIC5hcHBlbmQoXCJ0ZFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwidGV4dC1hbGlnblwiLCBcImNlbnRlclwiKVxuICAgICAgICAgICAgLmh0bWwoZnVuY3Rpb24oZCxpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iai5yb3dzW2ldLnZhbHVlO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5lYWNoKGZ1bmN0aW9uIChkKSB7XG4gICAgICAgICAgICAgICAgaWYgKGQubGluayA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgZDMuc2VsZWN0KHRoaXMpXG4gICAgICAgICAgICAgICAgICAgIC5jbGFzc2VkKFwibGlua1wiLCAxKVxuICAgICAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGQubGluayhkLm9iaik7XG4gICAgICAgICAgICAgICAgICAgICAgICB0LmNsb3NlLmNhbGwodGhpcyk7XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgfSk7XG4gICAgcmV0dXJuIHQ7XG59O1xuXG50b29sdGlwLnRhYmxlID0gZnVuY3Rpb24gKCkge1xuICAgIC8vIHRhYmxlIHRvb2x0aXBzIGFyZSBiYXNlZCBvbiBnZW5lcmFsIHRvb2x0aXBzXG4gICAgdmFyIHQgPSB0b29sdGlwKCk7XG5cbiAgICB2YXIgd2lkdGggPSAxODA7XG5cbiAgICB0LmZpbGwgKGZ1bmN0aW9uIChvYmopIHtcbiAgICAgICAgdmFyIHRvb2x0aXBfZGl2ID0gZDMuc2VsZWN0KHRoaXMpO1xuXG4gICAgICAgIHZhciBvYmpfaW5mb190YWJsZSA9IHRvb2x0aXBfZGl2XG4gICAgICAgICAgICAuYXBwZW5kKFwidGFibGVcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfem1lbnVcIilcbiAgICAgICAgICAgIC5hdHRyKFwiYm9yZGVyXCIsIFwic29saWRcIilcbiAgICAgICAgICAgIC5zdHlsZShcIndpZHRoXCIsIHQud2lkdGgoKSArIFwicHhcIik7XG5cbiAgICAgICAgLy8gVG9vbHRpcCBoZWFkZXJcbiAgICAgICAgaWYgKG9iai5oZWFkZXIpIHtcbiAgICAgICAgICAgIG9ial9pbmZvX3RhYmxlXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcInRyXCIpXG4gICAgICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInRudF96bWVudV9oZWFkZXJcIilcbiAgICAgICAgICAgICAgICAuYXBwZW5kKFwidGhcIilcbiAgICAgICAgICAgICAgICAuYXR0cihcImNvbHNwYW5cIiwgMilcbiAgICAgICAgICAgICAgICAudGV4dChvYmouaGVhZGVyKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFRvb2x0aXAgcm93c1xuICAgICAgICB2YXIgdGFibGVfcm93cyA9IG9ial9pbmZvX3RhYmxlLnNlbGVjdEFsbChcIi50bnRfem1lbnVfcm93XCIpXG4gICAgICAgICAgICAuZGF0YShvYmoucm93cylcbiAgICAgICAgICAgIC5lbnRlcigpXG4gICAgICAgICAgICAuYXBwZW5kKFwidHJcIilcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfem1lbnVfcm93XCIpO1xuXG4gICAgICAgIHRhYmxlX3Jvd3NcbiAgICAgICAgICAgIC5hcHBlbmQoXCJ0aFwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjb2xzcGFuXCIsIGZ1bmN0aW9uIChkLCBpKSB7XG4gICAgICAgICAgICAgICAgaWYgKGQudmFsdWUgPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIDI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiAxO1xuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZC52YWx1ZSA9PT0gXCJcIikge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gXCJ0bnRfem1lbnVfaW5uZXJfaGVhZGVyXCI7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBcInRudF96bWVudV9jZWxsXCI7XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmh0bWwoZnVuY3Rpb24oZCxpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIG9iai5yb3dzW2ldLmxhYmVsO1xuICAgICAgICAgICAgfSk7XG5cbiAgICAgICAgdGFibGVfcm93c1xuICAgICAgICAgICAgLmFwcGVuZChcInRkXCIpXG4gICAgICAgICAgICAuaHRtbChmdW5jdGlvbihkLGkpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG9iai5yb3dzW2ldLnZhbHVlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgICAgICAgICAgIG9iai5yb3dzW2ldLnZhbHVlLmNhbGwodGhpcywgZCk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIG9iai5yb3dzW2ldLnZhbHVlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgICAuZWFjaChmdW5jdGlvbiAoZCkge1xuICAgICAgICAgICAgICAgIGlmIChkLnZhbHVlID09PSBcIlwiKSB7XG4gICAgICAgICAgICAgICAgICAgIGQzLnNlbGVjdCh0aGlzKS5yZW1vdmUoKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuICAgICAgICAgICAgLmVhY2goZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICBpZiAoZC5saW5rID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBkMy5zZWxlY3QodGhpcylcbiAgICAgICAgICAgICAgICAuY2xhc3NlZChcImxpbmtcIiwgMSlcbiAgICAgICAgICAgICAgICAub24oJ2NsaWNrJywgZnVuY3Rpb24gKGQpIHtcbiAgICAgICAgICAgICAgICAgICAgZC5saW5rKGQub2JqKTtcbiAgICAgICAgICAgICAgICAgICAgdC5jbG9zZS5jYWxsKHRoaXMpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSk7XG4gICAgfSk7XG5cbiAgICByZXR1cm4gdDtcbn07XG5cbnRvb2x0aXAucGxhaW4gPSBmdW5jdGlvbiAoKSB7XG4gICAgLy8gcGxhaW4gdG9vbHRpcHMgYXJlIGJhc2VkIG9uIGdlbmVyYWwgdG9vbHRpcHNcbiAgICB2YXIgdCA9IHRvb2x0aXAoKTtcblxuICAgIHQuZmlsbCAoZnVuY3Rpb24gKG9iaikge1xuICAgICAgICB2YXIgdG9vbHRpcF9kaXYgPSBkMy5zZWxlY3QodGhpcyk7XG5cbiAgICAgICAgdmFyIG9ial9pbmZvX3RhYmxlID0gdG9vbHRpcF9kaXZcbiAgICAgICAgICAgIC5hcHBlbmQoXCJ0YWJsZVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJjbGFzc1wiLCBcInRudF96bWVudVwiKVxuICAgICAgICAgICAgLmF0dHIoXCJib3JkZXJcIiwgXCJzb2xpZFwiKVxuICAgICAgICAgICAgLnN0eWxlKFwid2lkdGhcIiwgdC53aWR0aCgpICsgXCJweFwiKTtcblxuICAgICAgICBpZiAob2JqLmhlYWRlcikge1xuICAgICAgICAgICAgb2JqX2luZm9fdGFibGVcbiAgICAgICAgICAgICAgICAuYXBwZW5kKFwidHJcIilcbiAgICAgICAgICAgICAgICAuYXR0cihcImNsYXNzXCIsIFwidG50X3ptZW51X2hlYWRlclwiKVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoXCJ0aFwiKVxuICAgICAgICAgICAgICAgIC50ZXh0KG9iai5oZWFkZXIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG9iai5ib2R5KSB7XG4gICAgICAgICAgICBvYmpfaW5mb190YWJsZVxuICAgICAgICAgICAgICAgIC5hcHBlbmQoXCJ0clwiKVxuICAgICAgICAgICAgICAgIC5hdHRyKFwiY2xhc3NcIiwgXCJ0bnRfem1lbnVfcm93XCIpXG4gICAgICAgICAgICAgICAgLmFwcGVuZChcInRkXCIpXG4gICAgICAgICAgICAgICAgLnN0eWxlKFwidGV4dC1hbGlnblwiLCBcImNlbnRlclwiKVxuICAgICAgICAgICAgICAgIC5odG1sKG9iai5ib2R5KTtcbiAgICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHQ7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHMgPSB0b29sdGlwO1xuIl19
