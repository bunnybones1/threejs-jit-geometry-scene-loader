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
		var name = 'all/groundPlane/niceTeapot';
		var alreadyLoaded = jitGeomSceneLoader.checkIfLoadedByName(name, true);
		console.log(name, 'alreadyLoaded?', alreadyLoaded);
		jitGeomSceneLoader.loadByName(name, true, 
			function(value) {
				console.log(name, "Geometries loading progress:", value);
			},
			function() {
				console.log(name, "Geometries loading complete.");
				jitGeomSceneLoader.showByName(name, true);
			}
		);
		//another group which includes some objects from the first group
		setTimeout(function() {
			name = 'all';
			jitGeomSceneLoader.loadByName(name, true, 
				function(value) {
					console.log(name, "Geometries loading progress:", value);
				},
				function() {
					console.log(name, "Geometries loading complete.");
					jitGeomSceneLoader.showByName(name, true);
				}
			);

		}, 1000);
		//another group
		setTimeout(function() {
			name = 'Gengon001';
			jitGeomSceneLoader.loadByName(name, true, 
				function(value) {
					console.log(name, "Geometries loading progress:", value);
				},
				function() {
					console.log(name, "Geometries loading complete.");
					jitGeomSceneLoader.showByName(name, true);
				}
			);

		}, 2000);

		//redundant group should already be loaded.
		setTimeout(function() {
			name = 'all';
			var alreadyLoaded = jitGeomSceneLoader.checkIfLoadedByName(name, true);
			console.log(name, 'alreadyLoaded?', alreadyLoaded);
			if(!alreadyLoaded) {
				jitGeomSceneLoader.loadByName(name, true, 
					function(value) {
						console.log(name, "Geometries loading progress:", value);
					},
					function() {
						console.log(name, "Geometries loading complete.");
						jitGeomSceneLoader.showByName(name, true);
					}
				);
			};

		}, 3000);
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
	// setTimeout(function() {
	// }, 1000);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/niceTeapot', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2000);
	// setTimeout(function() {
	// 	multiLoadedObject.hideByName('all/groundPlane/niceTeapot', true);
	// }, 2030);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/niceTeapot', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2060);
	// setTimeout(function() {
	// 	multiLoadedObject.hideByName('all/groundPlane/niceTeapot', true);
	// }, 2090);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/niceTeapot', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2120);
	// setTimeout(function() {
	// 	multiLoadedObject.hideByName('all/groundPlane/niceTeapot', true);
	// }, 2150);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/niceTeapot', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2180);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/niceTeapot', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2180);
	// setTimeout(function() {
	// 	multiLoadedObject.showByName('all/groundPlane/somethingMissing', true, function(){
	// 		console.log('loaded!!!!');
	// 	});
	// }, 2280);

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