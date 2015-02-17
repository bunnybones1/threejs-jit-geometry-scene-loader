function onReady() {
	var materialMatch = require('threejs-helper-material-assigner');
	var View = require('threejs-managed-view').View;
	var JITGeomSceneLoader = require('./');
	var MemoryStats = require('memory-stats');
	
	var memoryStats = new MemoryStats();

    memoryStats.domElement.style.position = 'fixed';
    memoryStats.domElement.style.right        = '0px';
    memoryStats.domElement.style['z-index']  = '1';
    memoryStats.domElement.style.bottom       = '0px';

    document.body.appendChild( memoryStats.domElement );

	//all you really need
	var view = new View({
		// stats: true
	});

	view.renderManager.onEnterFrame.add(function() {
        memoryStats.update();
	})
	view.renderer.setClearColor(0x999999);
	
	var assetBasePath = '../../assets/models/parseTest/';
	var scenePath = assetBasePath + 'parse.autodesk';
	var geometryPath = assetBasePath + 'geometry';
	var maxConcurrentXhr = 5;

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

		var baseObjectName = 'all';
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

		function unloadByName(name) {
			jitGeomSceneLoader.unloadByName(
				name,
				true
			)
		}

		function progressReporter(name, value) {
			console.log(name, "Geometries loading progress:", value);
		};

		function onGeometriesComplete() {
			console.log(baseObjectName, "Geometries loading complete.");
			jitGeomSceneLoader.showByName(baseObjectName, true);
		};

		function loop(repeat){
			repeat--;
			var delay = ~~(Math.random() * 100) + 100;
			console.log('LOAD -----------------------');
			console.log('delay', delay);
			loadByName(baseObjectName);
			setTimeout(function() {
				console.log('UNLOAD -----------------------');
				unloadByName(baseObjectName);
				console.log(baseObjectName, 'unloaded');
			}, delay);
			if(repeat > 0) {
				setTimeout( function(){
					loop(repeat)
				}, 1000);
			}
		}

		loop(20);

	}
	function onMeshComplete(mesh) {
		materialMatch(mesh, materials);
	}

	JITGeomSceneLoader.setMaxConcurrentXhr(maxConcurrentXhr);
	JITGeomSceneLoader.setXhrDebugLevel(0);

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