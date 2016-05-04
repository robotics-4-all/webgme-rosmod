/*globals define, WebGMEGlobal*/
/*jshint browser: true*/

/**
 * Generated by VisualizerGenerator 0.1.0 from webgme on Wed Apr 06 2016 14:15:27 GMT-0500 (CDT).
 */

define([
    'text!./Plot.html',
    './ResultsVizWidget.Parser',
    './ResultsVizWidget.Plotter',
    'css!./styles/ResultsVizWidget.css'
], function (
    PlotHtml,
    Parser,
    Plotter) {
    'use strict';

    var ResultsVizWidget,
        WIDGET_CLASS = 'results-viz';

    ResultsVizWidget = function (logger, container) {
        this._logger = logger.fork('Widget');

        this._el = container;

        this.nodes = {};
        this._initialize();

        this._logger.debug('ctor finished');
    };

    ResultsVizWidget.prototype._initialize = function () {
        var width = this._el.width(),
            height = this._el.height(),
            self = this;

        // set widget class
        this._el.addClass(WIDGET_CLASS);
    };

    ResultsVizWidget.prototype.onWidgetContainerResize = function (width, height) {
        console.log('Widget is resizing...');
    };

    // Adding/Removing/Updating items
    ResultsVizWidget.prototype.addNode = function (desc) {
        if (desc) {
	    for (var a in desc.attributes) {
		// setup the html
		this._el.append(PlotHtml);
		var container = this._el.find('#log');
		$(container).attr('id', 'log_'+a);
		
		var title = this._el.find('#title');
		$(title).attr('id','title_'+a);
		title.append('<b>'+a+'</b>');

		var p = this._el.find('#plot');
		$(p).attr('id',"plot_" + a);

		// parse the logs
		var data = Parser.getDataFromAttribute(desc.attributes[a]);
		if (!_.isEmpty(data))
		    Plotter.plotData('#plot_'+a, data);
		else
		    $(container).detach();
	    }

            this.nodes[desc.id] = desc;
        }
    };

    ResultsVizWidget.prototype.removeNode = function (gmeId) {
        var desc = this.nodes[gmeId];
        this._el.append('<div>Removing node "'+desc.name+'"</div>');
        delete this.nodes[gmeId];
    };

    ResultsVizWidget.prototype.updateNode = function (desc) {
        if (desc) {
            console.log('Updating node:', desc);
            this._el.append('<div>Updating node "'+desc.name+'"</div>');
        }
    };

    /* * * * * * * * Visualizer event handlers * * * * * * * */

    ResultsVizWidget.prototype.onNodeClick = function (id) {
        // This currently changes the active node to the given id and
        // this is overridden in the controller.
    };

    ResultsVizWidget.prototype.onBackgroundDblClick = function () {
    };

    /* * * * * * * * Visualizer life cycle callbacks * * * * * * * */
    ResultsVizWidget.prototype.destroy = function () {
    };

    ResultsVizWidget.prototype.onActivate = function () {
        console.log('ResultsVizWidget has been activated');
    };

    ResultsVizWidget.prototype.onDeactivate = function () {
        console.log('ResultsVizWidget has been deactivated');
    };

    return ResultsVizWidget;
});
