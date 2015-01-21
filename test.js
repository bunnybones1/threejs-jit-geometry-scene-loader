function onReady() {
	var materialMatch = require('threejs-helper-material-assigner');
	var View = require('threejs-managed-view').View;
	var JITGeomSceneLoader = require('./');
	//all you really need
	var view = new View({
		stats: true
	});
	view.renderer.setClearColor(0x999999);

	var assetBasePath = '../../assets/models/parseTest/';
	var scenePath = assetBasePath + 'parse.autodesk';
	var geometryPath = assetBasePath + 'geometry';

	var materials = {
		carPaint: new THREE.MeshPhongMaterial({
			diffuse: 0x7f7f7f,
			emissive: 0xffddaa,
			lights: false,
			vertexColors: THREE.VertexColors
			//side: THREE.BackSide
		}),
		ball: new THREE.MeshPhongMaterial({
			diffuse: 0xff7f7f,
			emissive: 0xff6644,
			lights: false,
			vertexColors: THREE.VertexColors
			//side: THREE.BackSide
		}),
		pedestal: new THREE.MeshPhongMaterial({
			diffuse: 0x7f7f7f,
			emissive: 0xaaddcc,
			lights: false,
			vertexColors: THREE.VertexColors
			//side: THREE.BackSide
		}),
		vertexShadow: new THREE.MeshPhongMaterial({
			diffuse: 0x7f7f7f,
			emissive: 0xffffff,
			lights: false,
			vertexColors: THREE.VertexColors,

			//side: THREE.BackSide
		}),
		groundPlane: new THREE.MeshPhongMaterial({
			diffuse: 0x7f7f7f,
			emissive: 0xaa99aa,
			lights: false,
			vertexColors: THREE.VertexColors
			//side: THREE.BackSide
		})
	}
	materials.box = materials.carPaint;
	function onProgress(val) {
		console.log("Scene loading progress:", val);
	}
	function onComplete() {
		console.log("Scene loading complete.");
		//hierarchy loaded, so let's load and show some objects by name
		//first group


		function loadByName(name) {
			jitGeomSceneLoader.loadByName(
				name, 
				true, 
				function(value) {
					progressReporter(name, value);
				}, 
				onGeometriesComplete
			);
		};

		function progressReporter(name, value) {
			console.log(name, "Geometries loading progress:", value);
		};

		function onGeometriesComplete() {
			console.log(name, "Geometries loading complete.");
			jitGeomSceneLoader.showByName(name, true);
		};

		var name = 'all/groundPlane/niceTeapot';
		var alreadyLoaded = jitGeomSceneLoader.checkIfLoadedByName(name, true);
		console.log(name, 'alreadyLoaded?', alreadyLoaded);
		loadByName(name);
		//another group which includes some objects from the first group

		var tests = [];
		function registerTest(name, test) {
			tests.push([name, test]);
		}

		registerTest(
			'load all', 
			function() {
				loadByName('all');
			}
		);
		//another group
		registerTest(
			'load a subPart',
			function() {
				loadByName('Gengon001');
			}
		);

		//redundant group should already be loaded.
		registerTest(
			'load even though it might exist', 
			function() {
				name = 'all';
				var alreadyLoaded = jitGeomSceneLoader.checkIfLoadedByName(name, true);
				console.log(name, 'alreadyLoaded?', alreadyLoaded);
				if(!alreadyLoaded) {
					loadByName(name);
				};
			}
		);

		//redundant group should already be loaded.
		registerTest(
			'hide all but Ball1', 
			function() {
				jitGeomSceneLoader.hideByName('all/groundPlane', true, true);
				jitGeomSceneLoader.showByName('all/groundPlane/ball1', true);
			}
		);

		registerTest(
			'hide all but Ball2', 
			function() {
				jitGeomSceneLoader.hideByName('all/groundPlane', true, true);
				jitGeomSceneLoader.showByName('all/groundPlane/ball2', true);
			}
		);

		registerTest(
			'hide all but Ball3', 
			function() {
				jitGeomSceneLoader.hideByName('all/groundPlane', true, true);
				jitGeomSceneLoader.showByName('all/groundPlane/ball3', true);
			}
		);

		for (var i = 0; i < tests.length; i++) {
			function closure() {
				var i2 = i;
				setTimeout(function() {
					console.log("TEST: " + tests[i2][0]);
					tests[i2][1]();
				}, 1000*(i2+1));
			};
			closure();
		};
	}
	function onMeshComplete(mesh) {
		materialMatch(mesh, materials);
	}
	var jitGeomSceneLoader = new JITGeomSceneLoader({
		path: scenePath,
		geometryPath: geometryPath,
		targetParent: view.scene,
		materials: materials,
		onProgress: onProgress,
		onMeshComplete: onMeshComplete,
		onComplete: onComplete,
		debugLevel: 0
	});

}

var loadAndRunScripts = require('loadandrunscripts');
loadAndRunScripts(
	[
		'bower_components/three.js/three.js',
		'lib/stats.min.js',
		'lib/threex.rendererstats.js',
		'lib/gzip.js'
	],
	onReady
);