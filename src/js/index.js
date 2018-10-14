// adapted from https://github.com/axismaps/contours/blob/master/contours.js

const d3 = require('d3');
const L = require('mapbox.js');

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
console.log('mapNode height: ', mapNode.offsetHeight)
let width = mapNode.offsetWidth + 2 * buffer;
// let height = mapNode.offsetHeight + 2 + buffer;
let height = 791;
contourCanvas.width = width;
contourCanvas.height = height;
demCanvas.width = width;
demCanvas.height = height;

let path = d3.geoPath().context(contourContext);
let svgPath = d3.geoPath();

let min,
		max,
		interval,
		majorInterval = 0,
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

var exampleLocations = [
  {name: 'Mount Fuji', coords: [35.3577, 138.7331, 13]},
  {name: 'Big Island, Hawaii', coords: [19.6801, -155.5132, 9]},
  {name: 'Grand Canyon', coords: [36.0469, -113.8416, 13]},
  {name: 'Mount Everest', coords: [27.9885, 86.9233, 12]},
  {name: 'Mount Rainier', coords:[46.8358, -121.7663, 11]},
  {name: 'White Mountains', coords:[44.0859, -71.4441, 11]}
];

var map_start_location = exampleLocations[Math.floor(Math.random()*exampleLocations.length)].coords;
var url_hash = window.location.hash.slice(1, window.location.hash.length).split('/');

if (url_hash.length == 3) {
    map_start_location = [url_hash[1],url_hash[2], url_hash[0]];
    map_start_location = map_start_location.map(Number);
}

/* Set up map */
L.mapbox.accessToken = 'pk.eyJ1IjoiZWxzYS1icm93biIsImEiOiJjam45N3V1YzIwNDg4M3JwYW5nbnRsbWh0In0.L5_WIDtQxlWSKiBXNO_ouw';

let map = L.mapbox.map('map', null, {scrollWheelZoom: false});
// let hash = new L.Hash(map);
map.setView(map_start_location.slice(0, 3), map_start_location[2]);

map.on('moveend', () => {
	// on move end, the contour layer is redrawn, so clear things

	contourContext.clearRect(0, 0, width, height);
	clearTimeout(wait);
	wait = setTimeout(getRelief, 500); // delay for redraw in case the map is moved again soon after [ie debounce]
});

map.on('move', () => {
	clearTimeout(wait); // stop things so the map doesn't redraw in the middle of panning
});

// custom tile layer for the Mapzen elevation tiles
// it returns div tiles but does not display anything; images are saved but only drawn to the invisible demCanvas
let CanvasLayer = L.GridLayer.extend({
	createTile: (coords) => {
		let tile = L.DomUtil.create('div', 'leaflet-tile');
		let img = new Image();
		let self = this;
		img.crossOrigin = '';
		tile.img = img;
		img.onload = () => {
			// wait for tile images to load before the map can be redrawn
			clearTimeout(wait);
			wait = setTimeout(getRelief, 500) // only draw after a delay so that things are not redrawn on every single tile load
		}

		img.src = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/'+coords.z+'/'+coords.x+'/'+coords.y+'.png';
		return tile;
	}
});

let demLayer = new CanvasLayer({ attribution: '<a href="https://aws.amazon.com/public-datasets/terrain/">Elevation tiles</a> by Mapzen'}).addTo(map);
console.log('demLayer._tiles: ', demLayer._tiles);

// custom map pane for contours above the other layers
let pane = map.createPane('contour');
pane.appendChild(contourCanvas);

// custom map pane for labels
let labelPane = map.createPane('labels');
// let referenceLayer = L.mapbox.styleLayer('mapbox://styles/awoodruff/cjggk1nwn000f2rjsi5x4iha1', {
// 	minZoom: 0,
// 	maxZoom: 15,
// 	pane: 'labels',
// }).addTo(map);

// resets canvas back to top left of window after panning the map
const reverseTransform = () => {
	let top_left = map.containerPointToLayerPoint([-buffer, -buffer]);
	L.DomUtil.setPosition(contourCanvas, top_left);
};

reverseTransform();



// shows the 'loading' message -- show message then do the function (usually getRelief or drawContour)
const load = (fn) => {
	requestAnimationFrame(() => {
		d3.select('#loading').style('display', 'flex');
		requestAnimationFrame(fn);
	});
};

// after terrain tiles are loaded, draw them to a canvas
const getRelief = () => {
	load(() => {
		// reset canvases
		demContext.clearRect(0, 0, width, height);
		reverseTransform();

		// reset DEM data by drawing elevation tiles to it
		for (var t in demLayer._tiles) {
			console.log('t: ', demLayer._tiles[t]);
			let rect = demLayer._tiles[t].el.getBoundingClientRect();
			console.log('img: ', demLayer._tiles[t].el.img);
			demContext.drawImage(demLayer._tiles[t].el.img, rect.left + buffer, rect.top + buffer);
		}
		console.log('width: ', width, 'height: ', height);

		demImageData = demContext.getImageData(0, 0, width, height);
		demData = demImageData.data;

		getContours();
	});
};

// calculate contours
const getContours = () => {
	let values = new Array(width * height);

	// get elevation values for pixels
	for (var y = 0; y < height; y++) {
		for (var x = 0; x < width; x++) {
			let i = getIndexForCoords(width, x, y);

			// x + y * width is the array position expected by the contours generator
			let scale = unit === 'ft' ? 3.28084 : 1;
			values[x + y * width] = Math.round(elev(i, demData) * scale);
		}
	}

	max = d3.max(values);
	min = d3.min(values);

	interval = 500; // +d3.select('#interval-input').node().value;

	max = Math.ceil(max/interval) * interval;
	min = Math.floor(min/interval) * interval;

	// contour line values
	thresholds = [];
	for (var i = min; i <= max; i += interval) {
		thresholds.push(i);
	}

	contour.thresholds(thresholds);

	contoursGeoData = contour(values); // this gets the contours geojson;

	hypsoColor.domain([min, max]);

	// update the index line options based on the current interval
	// options = 0, 2, 5, 10
	// [There is a function here that gets values options from the UI]
	let selectedOption = 5;
	majorInterval = selectedOption * interval;

	  // show bathymetry options if elevations include values below zero
  // d3.select('#bathymetry').style('display', min < 0 ? 'block' : 'none');
  // if (min < 0) {
  //   bathyColor.domain([min, -1]);
  //   if (bathyColorType != 'none') {
  //     hypsoColor.domain([0, max]);
  //   }
  // }

  drawContours();
};

// draws the map
const drawContours = (svg) => {
	// svg option is for export
	if (svg !== true) { // this is the normal canvas drawing
		contourContext.clearRect(0, 0, width, height);
		contourContext.save();
		if (type === 'illuminated') {
			contourContext.lineWidth = shadowSize + 1;
			contourContext.shadowBlur = shadowSize;
			contourContext.shadowOffsetX = shadowSize;
			contourContext.shadowOffsetY = shadowSize;

			contoursGeoData.forEach(c => {
				contourContext.beginPath();

				if (c.value >= 0 || bathyColorType === 'none') { // for values above sea level, or if we aren't styling bathymetry
					contourContext.shadowColor = shadowColor;
					contourContext.strokeStyle = highlightColor;
					if (colorType === 'hypso') contourContext.fillStyle = hypsoColor(c.value);
					else if(colorType === 'solid') contourContext.fillStyle = solidColor;
					else contourContext.fillStyle = '#fff' // white for transparent
				} else {
					// blue-ish shadow and highlight colors below sea level (no user options);
					contourContext.shadowColor = '#4e5c66';
					contourContext.strokeStyle = 'rgba(224, 242, 255, .5)';
					if (bathyColorType === 'bathy') contourContext.fillStyle = bathyColor(c.value);
					else if (bathyColorType === 'solid') contourContext.fillStyle = oceanColor;
					else contourContext.fillStyle = '#fff';
				}

				path(c); // draws the shape
				// draw the light stroke first, then fill with drop shadow
				// the effect is a light edge on one side, dark on the other, giving a raised/illuminated contour appearance
				contourContext.stroke();
				contourContext.fill();
			});
		} else { // regular contour lines
			contourContext.lineWidth = lineWidth;
			contourContext.strokeStyle = lineColor;
			if (colorType != 'hypso' && bathyColorType === 'none') {
				// no fill or solid fill -- don't need to fill/stroke individual contours, but can do them all at once
				contourContext.beginPath();
				contoursGeoData.forEach(c => {
					if (majorInterval === 0 || c.value % majorInterval !== 0) path(c);
				});
				if (colorType === 'solid') {
					contourContext.fillStyle = solidColor;
					contourContext.fill();
				}
				contourContext.stroke();
			} else {
				// for hypsometric tints or a separate bathymetric fill, fill contours one at a time
				contoursGeoData.forEach(c => {
					contourContext.beginPath();
					let fill;
					if (c.value >= 0 || bathyColorType === 'none') {
						if (colorType === 'hypso') fill = hypsoColor(c.value);
						else if (colorType === 'solid') fill = solidColor;
						else if (bathyColorType !== 'none') fill = '#fff'; // will mask out ocean if ocean is colored
					} else {
						if (bathyColorType === 'bathy') fill = bathyColor(c.value);
						else if (bathyColorType === 'solid') fill = oceanColor;
					}

					path(c);
					if (fill) {
						contourCOntext.fillStyle = fill;
						contourContext.fill();
					}

					contourContext.stroke();
				});
			}

			// draw thicker index lines, if desired
			if (majorInterval !== 0) {
				contourContext.lineWidth = lineWidthMajor;
				contourContext.beginPath();
				contoursGeoData.forEach(c => {
					if (c.value % majorInterval === 0) path(c);
				});
				contourContext.stroke();
			}

		}
		contourContext.restore();
	} else {
		// draw contours to SVG for export
		if (!contourSVG) {
			contourSVG = d3.select('body').append('svg');
		}

		contourSVG
			.attr('width', width)
			.attr('height', height)
			.selectAll('path').remove();

		contourSVG.selectAll('path.stroke')
			.data(contoursGeoData)
			.enter()
			.append('path')
			.attr('d', svgPath)
			.attr('stroke', type === 'lines' ? lineColor : highlightColor)
			attr('stroke-width', (d) => {
				return type === 'lines' ? (majorInterval !== 0 && d.value % majorInterval === 0 ? lineWidthMajor : lineWidth) : shadowSize;
			})
			attr('fill', (d) => {
				if (d.value >= 0 || bathyColorType === 'none') {
					if (colorType === 'hypso') return hypsoCOlor(d.value);
					else if (colorType === 'solid') return solidColor;
					else if (bathyColorType !== 'none') return '#fff';
				} else {
					if (bathyColorType === 'bathy') return bathyColor(d.value);
					else if (bathyColorType === 'solid' ) return oceanColor;
				}

				return 'none';
			})
			.attr('id', (d) => {
				return 'elev-' + d.value;
			});
	}
	d3.select('#loading').style('display', 'none');
}

const downloadGeoJson = () => {
	let geojson = {type: 'FeatureCollecton', features: []};
	contoursGeoData.forEach(c => {
		let feature = 
			{ type: 'Feature',
				properties: { elevation: c.value },
				geometry: { type: c.type, coordinates: [] }
			};
		geojson.features.push(feature);
		c.coordinates.forEach(poly => {
			let polygon = [];
			feature.geometry.coordinates.push(polygon);
			poly.forEach(ring => {
				let polyRing = [];
				polygon.push(polyRing);
				ring.forEach(coord => {
					let ll = map.containerPointToLatLng(coord);
					polyRing.push([ll.lng, ll.lat]);
				});
			});
		})
	});
	download(JSON.stringify(geojson), 'contours.geojson');
}

const downloadPNG = () => {
	let newCanvas = document.createElement('canvas');
	newCanvas.width = width - 2 * buffer;
	newCanvas.height = height - 2 * buffer;
	newCanvas.getContext('2d').putImageData(contourContext.getImageData(0, 0, width, height), -buffer, -buffer);
	// https://stackoverflow.com/questions/12796513/html5-canvas-to-png-file
	let dt = newCanvas.toDataURL('image/png');
	/* Change MIME type to trick the browser to downlaod the file instead of displaying it */
	dt = dt.replace(/^data:image\/[^;]*/, 'data:application/octet-stream');

	/* In addition to <a>'s "download" attribute, you can define HTTP-style headers */
  dt = dt.replace(/^data:application\/octet-stream/, 'data:application/octet-stream;headers=Content-Disposition%3A%20attachment%3B%20filename=Canvas.png');

  let tempLink = document.createElement('a');
  tempLink.style.display = 'none';
  tempLink.href = dt;
  tempLink.setAttribute('download', 'contours.png');
  if (typeof tempLink.download === 'undefined') {
  	tempLink.setAttribute('target', '_blank');
  }

  document.body.appendChild(tempLink);
  tempLink.click();
  document.body.appendChild(tempLink);
}

const downloadSVG = () => {
	drawContours(true);
	let svgData = contourSCG.node().outerHTML;
	download(svgData, 'contours.svg', 'image/svg+xml;charset=utf-8');
}

// https://github.com/kennethjiang/js-file-download
function download(data, filename, mime) {
    var blob = new Blob([data], {type: mime || 'application/octet-stream'});
    if (typeof window.navigator.msSaveBlob !== 'undefined') {
        // IE workaround for "HTML7007: One or more blob URLs were 
        // revoked by closing the blob for which they were created. 
        // These URLs will no longer resolve as the data backing 
        // the URL has been freed."
        window.navigator.msSaveBlob(blob, filename);
    }
    else {
        var blobURL = window.URL.createObjectURL(blob);
        var tempLink = document.createElement('a');
        tempLink.style.display = 'none';
        tempLink.href = blobURL;
        tempLink.setAttribute('download', filename); 
        
        // Safari thinks _blank anchor are pop ups. We only want to set _blank
        // target if the browser does not support the HTML5 download attribute.
        // This allows you to download files in desktop safari if pop up blocking 
        // is enabled.
        if (typeof tempLink.download === 'undefined') {
            tempLink.setAttribute('target', '_blank');
        }
        
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
        window.URL.revokeObjectURL(blobURL);
    }
};

/* utils */
// convert elevation tile color to elevation value
const elev = (idx, demData) => {
	if (idx < 0 || demData[idx] === undefined) return undefined;
	return (demData[idx] * 256 + demData[idx + 1] + demData[idx + 2] / 256) - 32768;
}

// helper to get imageData for a given x/y
const getIndexForCoords = (width, x, y) => {
	return width * y * 4 + 4 * x;
}



















