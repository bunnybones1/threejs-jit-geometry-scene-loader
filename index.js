var loadJSON = require('load-json-xhr');
function noop() {}

var SHOULDNT_EVEN_EXIST = -2,
	LOAD_UNAVAILABLE = -1,
	LOAD_AVAILABLE = 0,
	LOADING = 1,
	LOADED = 2;

function JITGeometrySceneLoader(props) {
	if(props) this.load(props);
}

JITGeometrySceneLoader.prototype = {
	objectsByPath: undefined,
	geometries: undefined,
	meshesUsingGeometriesByGeometryPaths: undefined,
	objectsWaitingForGeometriesByGeometryPaths: undefined,
	loadersByGeometryPaths: undefined,
	load: function (props) {
		var _this = this;
		props = props || {};

		//defaults
		var defaults = {
			path: '',
			geometryPath: '',
			targetParent: undefined,
			onMeshComplete: function(mesh) { if(_this.debugLevel>=1) console.log("MESH COMPLETE"); },
			onMeshDestroy: function(mesh) { if(_this.debugLevel>=1) console.log("MESH DESTROYED"); },
			onComplete: function() { if(_this.debugLevel>=1) console.log('LOAD COMPLETE'); },
			onProgress: function(val) { if(_this.debugLevel>=1) console.log('LOAD PROGRESS:', val); },
			debugLevel: 0
		};

		for(var key in defaults) {
			this[key] = props[key] !== undefined ? props[key] : defaults[key];
		}
		

		this.pathBase = this.path.substring(0, this.path.lastIndexOf('/')+1);
		this.path = this.pathCropBase(this.path);
		this.objectsByPath = {};
		this.geometries = {};
		this.meshesUsingGeometriesByGeometryPaths = {};
		this.objectsWaitingForGeometriesByGeometryPaths = {};
		this.loadersByGeometryPaths = {};
		this.threeGeometryJSONLoader = new THREE.JSONLoader();
		this.threeObjectJSONLoader = new THREE.ObjectLoader();
		this.hierarchyRecieved = this.hierarchyRecieved.bind(this);
		this.geometryRecieved = this.geometryRecieved.bind(this);
		this.showByName = this.showByName.bind(this);
		this.hideByName = this.hideByName.bind(this);
		var url = this.pathBase + this.path;
		var loader = loadJSON(url + '.hierarchy.json', this.hierarchyRecieved.bind(this, url));
		var sceneProgress = 0;
		loader.onprogress = function(event) {
			if(event.lengthComputable) {
				sceneProgress = event.loaded / event.total;
			} else {
				sceneProgress = (1 - (1 - sceneProgress) * 0.5);
			}
			_this.onProgress(sceneProgress);
		};
	},

	hierarchyRecieved: function(path, err, jsonData) {
		if(err) {
			throw err;
		}
		this.root = new THREE.Object3D();
		for(var childName in jsonData) {
			this.root.add(this.createObject(jsonData[childName], path + '/' + childName));
		}
		if(this.targetParent) {
			this.targetParent.add(this.root);
		}
		this.onComplete();
	},

	geometryRecieved: function(path, err, jsonData) {
		if(err) {
			throw err;
		}
		path = this.pathCropGeometries(path);
		path = path.substring(0, path.lastIndexOf('.json'));
		// console.log(jsonData);
		if(this.debugLevel>=2) console.log('loaded', path);

		var geometry = this.threeGeometryJSONLoader.parse(jsonData).geometry;
		this.meshesUsingGeometriesByGeometryPaths[path] = [];
		this.integrateGeometry(geometry, path);
	},

	integrateGeometry: function(geometry, path) {
		if(this.debugLevel>=2) console.log('integrate geometry', path);
		this.geometries[path] = geometry;
		if(this.debugLevel>=2) console.log(Object.keys(this.geometries).length, 'geometries in memory');

		var objectsToPromote = this.objectsWaitingForGeometriesByGeometryPaths[path];
		var meshesUsingGeometry = this.meshesUsingGeometriesByGeometryPaths[path];
		for (var i = objectsToPromote.length - 1; i >= 0; i--) {
			var object = objectsToPromote[i];
			var mesh = this.promoteObjectToMesh(object, geometry);
			meshesUsingGeometry.push(mesh);
			if(object.geometryLoadCompleteCallback) {
				// if(i != 0) debugger;
				object.geometryLoadCompleteCallback();
				delete object.geometryLoadCompleteCallback;
			}
			// this.isolationTest(mesh);
		}
		delete this.loadersByGeometryPaths[object.geometryName];
		delete this.objectsWaitingForGeometriesByGeometryPaths[path];
	},

	loadGeometryOf: function(object, progressCallback, callback) {
		// object.add(new THREE.Mesh(new THREE.SphereGeometry(10)));
		var geometryName = object.geometryName;
		var geometryPath = this.geometryPath + '/' + geometryName;
		var geometry = this.geometries[geometryPath];
		if(this.debugLevel>=2) console.log('REQUEST', geometryName);
		if(geometry) {
			if(this.debugLevel>=2) console.log('reusing', geometryName);
			object = this.promoteObjectToMesh(object, geometry);
			var meshesUsingGeometry = this.meshesUsingGeometriesByGeometryPaths[geometryPath];
			meshesUsingGeometry.push(object);
			return false;
		} else {
			if(!this.objectsWaitingForGeometriesByGeometryPaths[geometryPath]) {
				if(this.debugLevel>=2) console.log('loading', geometryName);
				object.geometryLoadCompleteCallback = callback;
				this.objectsWaitingForGeometriesByGeometryPaths[geometryPath] = [object];
				var loader = loadJSON(geometryPath + '.json', this.geometryRecieved.bind(this, geometryPath + '.json'));
				loader.onprogress = progressCallback;
				this.loadersByGeometryPaths[geometryName] = loader;
				object.loadStatus = LOADING;
				return true;
			} else {
				if(this.debugLevel>=2) console.log('waiting for', geometryName);
				this.objectsWaitingForGeometriesByGeometryPaths[geometryPath].push(object);
				object.loadStatus = LOADING;
				return false;
			}
		}
	},

	unloadGeometryOf: function(object) {
		var geometryName = object.geometryName;
		var geometryPath = this.geometryPath + '/' + geometryName;
		var geometry = this.geometries[geometryPath];
		if(this.debugLevel>=2) console.log('UNLOAD', geometryName);
		if(geometry) {
			if(this.debugLevel>=2) console.log('unloading', geometryName);
			var meshesUsingGeometry = this.meshesUsingGeometriesByGeometryPaths[geometryPath];
			var index = meshesUsingGeometry.indexOf(object);
			meshesUsingGeometry.splice(index, 1);
			object = this.demoteMeshToObject(object, geometry);
			if(meshesUsingGeometry.length === 0) {
				if(this.debugLevel >= 2) console.log('disposing geometry', geometryName)
				geometry.dispose();
				delete this.meshesUsingGeometriesByGeometryPaths[geometryPath];
				delete this.geometries[geometryPath];
				if(this.debugLevel>=2) console.log(Object.keys(this.geometries).length, 'geometries in memory');
			} else {
				if(this.debugLevel >= 2) console.log('geometry', geometryName, 'still used in', meshesUsingGeometry.length, 'meshes');
			}
			return true;
		} else {
			if(this.debugLevel>=2) console.log('cancelling load of', geometryName);
			var objectsWaitingForGeometry = this.objectsWaitingForGeometriesByGeometryPaths[geometryPath];
			var index = objectsWaitingForGeometry.indexOf(object);
			objectsWaitingForGeometry.splice(index, 1);
			if(objectsWaitingForGeometry.length === 0) {
				delete this.objectsWaitingForGeometriesByGeometryPaths[geometryPath];
				var loader = this.loadersByGeometryPaths[geometryName];
				loader.abort();
				delete this.loadersByGeometryPaths[geometryName];
			}
			return true;
		}
	},

	storeObject: function(path, object) {

		//fix the alias for notFound
		var slices = path.split('/');
		if(slices[slices.length-1].indexOf("notFound") != -1){
			slices[slices.length-1] = "notFound";
		}
		path = slices.join('/');

		this.objectsByPath[path] = object;
	},

	createObject: function(jsonData, path) {
		var object = this.threeObjectJSONLoader.parseObject(jsonData);
		while(object.children.length > 0) object.remove(object.children[0]);	//I only want the object
		object.path = path;
		object.materialName = jsonData.material;
		this.storeObject(path, object);
		var name = path.substring(path.lastIndexOf('/')+1, path.length);
		object.name = name;

		for(var childName in jsonData.children) {
			object.add(this.createObject(jsonData.children[childName], path + '/' + childName));
		}

		var geometryName = jsonData.geometry;
		if(geometryName) {
			object.loadStatus = LOAD_AVAILABLE;
			object.geometryName = geometryName;
			var _this = this;
			object.load = function(progressCallback, callback) {
				if(object.loadStatus === LOAD_AVAILABLE) {
					var actuallyLoading = _this.loadGeometryOf(object, progressCallback, callback);
					object.loadStatus = LOADING;
					return actuallyLoading;
				}
				return false;
			};
		
		} else {
			object.loadStatus = LOAD_UNAVAILABLE;
		}
		
		if(jsonData.quaternion) {
			object.quaternion.x = jsonData.quaternion[0];
			object.quaternion.y = jsonData.quaternion[1];
			object.quaternion.z = jsonData.quaternion[2];
			object.quaternion.w = jsonData.quaternion[3];
		}
		return object;
	},

	promoteObjectToMesh: function(object, geometry) {
		var mesh = new THREE.Mesh(geometry);
		mesh.path = object.path;
		mesh.name = object.name;
		var parent = object.parent;
		object.loadStatus = SHOULDNT_EVEN_EXIST;
		mesh.loadStatus = LOADED;
		mesh.materialName = object.materialName;
		mesh.geometryName = object.geometryName;
		mesh.position.copy(object.position);
		mesh.scale.copy(object.scale);
		mesh.rotation.copy(object.rotation);
		mesh.visible = object.visible;
		if(parent) {
			parent.remove(object);
			parent.add(mesh);
		} else {
			throw new Error('wtf');
		}

		for (var i = object.children.length - 1; i >= 0; i--) {
			if(this.debugLevel >= 2) console.log('moving', object.children[i].path, 'to mesh');
			mesh.add(object.children[i]);
		}
		var path = object.path;
		this.storeObject(path, mesh);

		if(object === this.root) {
			this.root = mesh;
		}
		var _this = this;
		mesh.unload = function() {
			if(mesh.loadStatus === LOADED || mesh.loadStatus === LOADING) {
				var actuallyUnloading = _this.unloadGeometryOf(mesh);
				mesh.loadStatus = LOAD_AVAILABLE;
				return actuallyUnloading;
			}
			return false;
		};
		this.onMeshComplete(mesh); 
		return mesh;
	},

	demoteMeshToObject: function(mesh) {
		var object = new THREE.Object3D();
		object.path = mesh.path;
		object.name = mesh.name;
		var parent = mesh.parent;
		mesh.loadStatus = SHOULDNT_EVEN_EXIST;
		object.loadStatus = LOAD_AVAILABLE;
		object.materialName = mesh.materialName;
		object.geometryName = mesh.geometryName;
		object.position.copy(mesh.position);
		object.scale.copy(mesh.scale);
		object.rotation.copy(mesh.rotation);
		object.visible = mesh.visible;
		if(parent) {
			parent.remove(mesh);
			parent.add(object);
		} else {
			throw new Error('wtf');
		}

		for (var i = mesh.children.length - 1; i >= 0; i--) {
			if(this.debugLevel >= 2) console.log('moving', mesh.children[i].path, 'to object');
			object.add(mesh.children[i]);
		}
		var path = mesh.path;
		this.storeObject(path, object);

		if(mesh === this.root) {
			this.root = object;
		}

		var _this = this;
		object.load = function(progressCallback, callback) {
			if(object.loadStatus === LOAD_AVAILABLE) {
				var actuallyLoading = _this.loadGeometryOf(object, progressCallback, callback);
				object.loadStatus = LOADING;
				return actuallyLoading;
			}
			return false;
		};


		this.onMeshDestroy(mesh); 
		return object;
	},

	pathCropBase: function(path) {
		return path.substring(this.pathBase.length, path.length);
	},

	pathCropGeometries: function(path) {
		return path.substring(this.geometryPath + '/'.length, path.length);
	},

	notFound: function(name) {
		console.log(name, 'does not exist');
		if(name) {
			var slices = name.split('/');
			slices[slices.length-1] = 'notFound';
			name = slices.join('/');
		} else {
			name = 'notFound';
		}
		return this.objectsByPath[this.path + '/' + name];
	},

	showByName: function(name, recursive, childrenOnly) {
		this.setVisibilityByName(name, true, recursive, childrenOnly);
	},

	hideByName: function(name, recursive, childrenOnly) {
		this.setVisibilityByName(name, false, recursive, childrenOnly);
	},

	setVisibilityByName: function(name, state, recursive, childrenOnly) {
		var object = this.getObjectByName(name);
		if(!object) {
			object = this.notFound(name);
		}
		if(object) {
			if(!childrenOnly) {
				object.visible = state;
			}
			// if(state, console.log(name));
			if(recursive) {
				object.traverse(function(obj) {
					if(obj === object) return;
					obj.visible = state;
				});
			}
		}
	},

	loadByName: function(name, recursive, progressCallback, callback) {
		var object = this.getObjectByName(name);
		var geometriesToLoadCount = 0;
		var geometriesLoadedCount = 0;
		var loading = 0;
		var _this = this;
		var progressOfEachGeometry = [];
		function reportProgress() {
			var aggregatedProgress = 0;
			progressOfEachGeometry.forEach(function(val){
				aggregatedProgress += val;
			});
			aggregatedProgress /= geometriesToLoadCount;
			if(progressCallback) {
				progressCallback(aggregatedProgress);
			}
			if(_this.debugLevel>=1) console.log('geometry loading progress:', aggregatedProgress);
		}
		function geometryLoadProgressCallback(whichUniqueGeometry, event) {
			if(event.lengthComputable) {
				progressOfEachGeometry[whichUniqueGeometry] = event.loaded / event.total;
			} else {
				progressOfEachGeometry[whichUniqueGeometry] = event.loaded === 0 ? 0 : (1 - (1 - progressOfEachGeometry[whichUniqueGeometry]) * 0.5);
			}
			reportProgress();
		}
		function geometryLoadCompleteCallback(whichUniqueGeometry) {
			geometriesLoadedCount++;
			//courtesy progress
			progressOfEachGeometry[whichUniqueGeometry] = 1;
			reportProgress();

			if(_this.debugLevel>=1) console.log(name+'\'s geometry objects loaded:', geometriesLoadedCount + '/' + geometriesToLoadCount);
			if(geometriesToLoadCount === geometriesLoadedCount) {
				if(callback) {
					callback();
				}
			}
		}

		if(!object) {
			object = this.notFound(name);
		}

		function attemptToLoadGeometry(obj) {
			if(obj.load) {
				var actuallyGonnaLoad = obj.load(
					geometryLoadProgressCallback.bind(this, geometriesToLoadCount), 
					geometryLoadCompleteCallback.bind(this, geometriesToLoadCount)
				) ? 1 : 0;
				if(actuallyGonnaLoad) {
					geometriesToLoadCount ++;
					progressOfEachGeometry.push(0);
				}
			}
		}

		if(object) {
			if(recursive) {
				var collection = [];
				object.traverse(function(obj) {
					collection.push(obj);
				});
				collection.forEach(function(obj){
					attemptToLoadGeometry(obj);
				})
			} else {
				attemptToLoadGeometry(object);
			}
			if(this.debugLevel>=1) console.log('geometries to load:', geometriesToLoadCount);
			if(geometriesToLoadCount === 0 && callback) {
				callback();
			}
		}
	},

	unloadByName: function(name, recursive) {
		var object = this.getObjectByName(name);

		function attemptToUnloadGeometry(obj) {
			if(obj.unload) obj.unload();
		}

		if(object) {
			if(recursive) {
				var collection = [];
				object.traverse(function(obj) {
					collection.push(obj);
				});
				collection.forEach(function(obj){
					attemptToUnloadGeometry(obj);
				})
			} else {
				attemptToUnloadGeometry(object);
			}
		}
	},

	checkIfLoadedByName: function(name, recursive) {
		var object = this.getObjectByName(name);
		var loaded = object.loadStatus == LOADED || object.loadStatus == LOAD_UNAVAILABLE;
		var _this = this;
		if(loaded && recursive) {
			object.traverse(function(obj) {
				if(obj.loadStatus != LOADED && obj.loadStatus != LOAD_UNAVAILABLE) {
					if(_this.debugLevel > 0) {
						console.log('loaded?', obj.name, obj.loadStatus);
					}
					loaded = loaded && false;
				}
			});
		}
		return loaded;
	},

	getObjectByName: function(name) {
		var objPath = this.pathBase + this.path + '/' + name;
		return this.objectsByPath[objPath];
	}
};

module.exports = JITGeometrySceneLoader;