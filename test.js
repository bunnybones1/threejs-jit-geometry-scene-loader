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
		jitGeomSceneLoader.loadByName('all', function() {
			console.log("Geometries loading complete.");
			jitGeomSceneLoader.showByName('all', true);
		});
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
		debug: true
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