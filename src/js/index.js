// adapted from https://github.com/axismaps/contours/blob/master/contours.js
const d3 = require('d3');

// canvas on which contours will be drawn
let contourCanvas = document.createElement('canvas');
contourCanvas.id = 'contours';
let contourContext;
let buffer = 5;

// invisible canvas to which terrain tiles will be drawn for calculations to be made
let demCanvas = document.createElement('canvas');
let demContext;
let demImageData;
let demData;

contourContext = contourCanvas.getContext('2d');
demContext = demCanvas.getContext('2d');

let mapNode = d3.select('#map').node();
let width = mapNode.offsetWidth + 2 * buffer;
let height = mapNode.offsetHeight + 2 + buffer;
contourCanvas.width = width;
contourCanvas.height = height;
demCanvas.width = width;
demCanvas.height = height;

let path = d3.geoPath().contect(contourContext);
let svgPath = d3.geoPath();

let min,
		max,
		interval,
		majorInterval = 0;
		thresholds,
		contour = d3.contours().size([width, height]),
		contoursGeoData;

let wait;

// style variables
let type = 'lines',
		unit = 'ft';

let lineWidth = .75,
		lineWidthMajor = 1.5,
		lineColor = 'blue';

let highlightColor = 'rgba(177, 174, 164, .5)',
		shadowColor = 'red',
		shadowSize = 2;

let colorType = 'none',
		solidColor = '#fffcfa',
		hypsoColor = d3.scaleLinear()
			.domain([0, 6999])
			.range(['#486341', '#e5d9c9'])
			.interpolate(d3.interpolateHcl),
		oceanColor = 'orange',
		bathyColorType = 'none',
		bathyColor = d3.scaleLinear()
			.domain([0, 6000])
			.range(['#315d9b', '#d5f2ff']);

let contourSVG;

window.onresize = () => {
	width = mapNode.offsetWidth + 2 * buffer;
	height = mapNode.offsetHeight + 2 * buffer;
	contourCanvas.width = width;
	contourCanvas.height = height;
	demCanvas.width = width;
	demCanvas.height = height;
	contour.size([width, height]);
	clearTimeout(wait);
	wait = setTimeout(getRelief, 500);
}


























