const init = () => {
	const audio = new Audio();
	audio.src = '../../assets/audio/i-built-utopia.mp3';
	audio.controls = true;
	document.body.append(audio);

	let context = new (window.AudioContext || window.webkitAudioContext)();
	let analyser = context.createAnalyser();

	window.addEventListener('load', () => {
	let source = context.createMediaElementSource(audio);
	source.connect(analyser);
	analyser.connect(context.destination);
}, false);

	const canvas = document.getElementById('canvas');
	canvas.height = 400;
	canvas.width = 400;
	const canvasCtx = canvas.getContext('2d');

	analyser.fftSize = 1024; // size of Fast Fourier Transform used to get frequency domain data (determines window size)
	let bufferLength = analyser.frequencyBinCount; // half the fftSize - the number of data points available for visualization
	// buffer is the asset in memory that holds audio data
	let dataArray = new Uint8Array(bufferLength); // an array of unsigned integers the length of frequencyBinCount
	console.log('dataArray: ', dataArray);

	// timeDomain(canvas, canvasCtx, analyser, bufferLength, dataArray);
	frequencyDomain(canvas, canvasCtx, analyser, bufferLength, dataArray);
}

const timeDomain = (canvas, canvasCtx, analyser, bufferLength, dataArray) => {

	const draw = () => {
		requestAnimationFrame(draw);

		analyser.getByteTimeDomainData(dataArray); // Copies the current frequency data into the unsigned byte array (Uint8Array) passed in
		console.log('dataArray: ', dataArray);

		canvasCtx.fillStyle = 'rgb(200, 200, 200)';
		canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

		canvasCtx.lineWidth = 2;
		canvasCtx.strokeStyle = 'rgb(0, 0, 0)'; // this could increment to change the color of the line as they progress

		let sliceWidth = canvas.width * 1.0 / bufferLength;
		let x = 0;

		for (var i = 0; i < bufferLength; i++) {
			let v = dataArray[i] / 128.0;
			let y = v * canvas.height / 2;

			if (i === 0) {
				canvasCtx.moveTo(x, y);
			} else {
				canvasCtx.lineTo(x, y);
			}

			x += sliceWidth;
		}

		canvasCtx.lineTo(canvas.width, canvas.height / 2);
		canvasCtx.stroke();
	}

	draw();

};

const frequencyDomain = (canvas, canvasCtx, analyser, bufferLength, dataArray) => {
	// console.log('dataArray: ', dataArray);
	// analyser.minDecibels = -90;
	// analyser.maxDecibels = -10;

	canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

	const draw = () => {
		requestAnimationFrame(draw);

		analyser.getByteFrequencyData(dataArray); // Copies the current frequency data into the unsigned byte array (Uint8Array) passed in

		// this happens every frame. The dataArray updates with the set of frequency data for each sample frame, at each point in time
		// We would want to provide a stream of this data to Leaflet/d3contour in order to get a map that redraws each frame as the song/animation progresses in time
		console.log('dataArray: ', dataArray);

		canvasCtx.fillStyle = 'rgb(253, 197, 190)';
		canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

		let barWidth = (canvas.width / bufferLength) * 2.5 - 1; // bar width calculated as a ratio of canvas width / number of data points (frequency data);
		let barHeight;
		let x = 0;

		// This loop redraws the canvas in each animation frame
		// Instead of drawing, we want to visualize the data via d3, but we likely still want to use requestAnimationFrame in order to make a visualization that changes over time
		for (var i = 0; i < bufferLength; i++) {
			barHeight = dataArray[i]; // barHeight === frequency data point

			canvasCtx.fillStyle = 'rgb(' + barHeight + ', 140, 140)'; // style based on barheight
			canvasCtx.fillRect(x, canvas.height - barHeight / 2, barWidth, barHeight / 2);

			x += barWidth;
		}
	};

	draw();

}

init();