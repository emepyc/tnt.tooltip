var tooltip = require("../index.js");
var assert = require("chai").assert;

describe('Tooltip', function () {
    it('Exists', function () {
        assert.isDefined(tooltip);
        assert.isFunction(tooltip);
    });

    describe('Table tooltips', function () {
        it('Exists', function () {
            assert.isDefined(tooltip.table);
            assert.isFunction(tooltip.table);
        });

        describe('Plain tooltips', function () {
            it('Exists', function () {
                assert.isDefined(tooltip.plain);
                assert.isFunction(tooltip.plain);
            });
        });
    });
});

