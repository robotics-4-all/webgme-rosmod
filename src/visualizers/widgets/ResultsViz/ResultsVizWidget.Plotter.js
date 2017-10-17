define(['plotly-js/plotly.min', 'd3'], function(Plotly,d3) {
    'use strict';
    return {
	plotData: function(container, plotId, data, onclick) {
	    // extent returns array: [min, max]
	    var maxXs = Object.keys(data).map(function(key) {
		return d3.extent(data[key].data, function(xy) { return xy[0]; })[1];
	    });
	    var maxYs = Object.keys(data).map(function(key) {
		return d3.extent(data[key].data, function(xy) { return xy[1]; })[1];
	    });
	    var xdomain = d3.max(maxXs);
	    var ydomain = d3.max(maxYs);

	    var pdata = [];
	    var annotations = [];
	    var tzOffset = new Date().getTimezoneOffset();
	    // convert from minutes to milliseconds
	    tzOffset = tzOffset * 60000;
	    //console.log(tzOffset);

	    var findAnnotations = function(key, x, y, floorAnn) {
		var foundAnnotations = annotations.filter(function(ann) {
		    //console.log('comparing x,y point ('+x+', '+y+')');
		    //console.log('           to ann   ('+ann.x+', '+ann.y+')');
                    if (ann.key != key)
                        return false;
		    if (floorAnn === undefined)
			floorAnn = false;
		    if (floorAnn)
			return Math.floor(ann.x) == x && ann.y == y;
		    return ann.x == x && ann.y == y;
		});
		return foundAnnotations;
	    };

	    Object.keys(data).map(function(key) {
		if (data[key].annotations.length) {
		    data[key].annotations.map(function(ann) {
			annotations.push({
			    x: ann.x,
			    y: ann.y,
			    xref: 'x',
			    yref: 'y',
                            key: key,
			    text: ann.text,
			    showarrow: true,
			    arrowhead: 7,
			    ax: 0,
			    ay: -40
			});
		    });
		}
		pdata.push({
		    x : data[key].data.map(function(xy) { return new Date(xy[0]); }),
		    y : data[key].data.map(function(xy) { return xy[1]; }),
		    mode: !data[key].annotations.length ? 'lines' : 'markers+lines',
                    type: 'scattergl',
		    name: key,
                    marker: {
                        maxdisplayed: 1000,
                        size: !data[key].annotations.length ? [] : data[key].data.map(function(xy) {
			    if (findAnnotations(key, xy[0], xy[1]).length > 0)
				return 15;
			    else
				return 1;
			}),
                        /*
                          color: "rgb(164, 194, 244)",
                          line: {
                          color: "white",
                          width: 0.5
                          }
                        */
                    }
		});
	    });

	    var layout = {
		xaxis: {
		    title: 'Time (s)'
		},
                legend: {
                    xanchor: 'right'
                },
		//annotations: annotations,
                margin: {
                    pad: 0,
                    l: 50,
                    r: 0,
                    b: 50,
                    t: 0
                },
                hovermode: 'closest',
                autosize: true,
                showlegend: true
	    };

	    var id = '#'+plotId;
	    Plotly.plot(d3.selectAll(container).select(id).node(), pdata, layout, {
		modeBarButtons: [[{
		    'name': 'toImage',
		    'title': 'Download plot as png',
		    'icon': Plotly.Icons.camera,
		    'click': function(gd) {
			var format = 'png';

			var n = $(container).find(id);
			Plotly.downloadImage(gd, {
			    'format': format,
			    'width': n.width(),
			    'height': n.height(),
			})
			    .then(function(filename) {
			    })
			    .catch(function() {
			    });
		    }
		}],[
		    'zoom2d',
		    'pan2d',
		    'select2d',
		    'lasso2d',
		    'zoomIn2d',
		    'zoomOut2d',
		    'autoScale2d',
		    'resetScale2d',
		    'hoverClosestCartesian',
		    'hoverCompareCartesian'
		]],
	    });

	    var myPlot = d3.selectAll(container).select(id).node();

	    myPlot.on('plotly_click', function(data){
		onclick();
                data.points.map(function(point) {
		    var foundAnnotations = findAnnotations(
                        point.data.name,
                        point.x + tzOffset,
		        point.y,
		        true
                    );
		    if (foundAnnotations.length) {
		        var yOffset = 0;
		        var yIncrement = 20;
		        foundAnnotations.map((foundAnn) => {
			    var newAnnotation = {
			        x: foundAnn.x,
			        y: foundAnn.y,
			        arrowhead: 6,
			        ax: 0,
			        ay: -80 - yOffset,
			        bgcolor: 'rgba(255, 255, 255, 0.9)',
			        //arrowcolor: point.fullData.marker.color,
			        font: {size:12},
			        //bordercolor: point.fullData.marker.color,
			        borderwidth: 3,
			        borderpad: 4,
			        text: foundAnn.text
			    },
			        divId = d3.selectAll(container).select(id).node(),
			        newIndex = (divId.layout.annotations || []).length;
			    // delete instead if clicked twice
			    if(newIndex) {
			        var foundCopy = false;
			        divId.layout.annotations.forEach(function(ann, sameIndex) {
				    if(ann.text === newAnnotation.text &&
				       ann.x == newAnnotation.x &&
				       ann.y == newAnnotation.y) {
				        Plotly.relayout(myPlot, 'annotations[' + sameIndex + ']', 'remove');
				        foundCopy = true;
				    }
			        });
			        if(foundCopy) return;
			    }
			    yOffset += yIncrement;
			    Plotly.relayout(myPlot, 'annotations[' + newIndex + ']', newAnnotation);
		        });
		    }

                });
	    })
		.on('plotly_clickannotation', function(event, data) {
		    Plotly.relayout(myPlot, 'annotations[' + data.index + ']', 'remove');
		});
	}
    };
});
