var xhr = require("xhr");

var __xhrDebugLevel = 0;
var __xhrPoolSize = 0,
	__xhrPoolFree = [],
	__totalConcurrentXhr = 0,
	__maxConcurrentXhr = 5;

function abortXhr(xhr) {
	if(__xhrDebugLevel >= 1) console.warn('Abort status.', xhr.readyState, xhr.status);
	if(xhr.readyState === 1 || xhr.readyState === 3) {
		if(__xhrDebugLevel >= 2) console.warn('Aborted.', xhr.url);
		xhr.abort();
	} else {
		if(__xhrDebugLevel >= 2) console.warn('Aborted before it started.', xhr.url);
		xhr.onload(new Error('Aborted before it started.'), null, xhr.url);
	}
}

function getXhrLoader(opt, cb) {
	cb = typeof cb === 'function' ? cb : noop;

	if (typeof opt === 'string')
		opt = { uri: opt };
	else if (!opt)
		opt = { };

	if (!opt.headers)
		opt.headers = { "Content-Type": "application/json" };

	var jsonResponse = /^json$/i.test(opt.responseType);

	if(__xhrPoolFree.length > 0) {
		if(__xhrDebugLevel >= 2) console.log('XHR reusing pool for', opt.uri);
		opt.xhr = __xhrPoolFree.shift();
	} else {
		if(__xhrDebugLevel >= 2) console.log('XHR creating new for', opt.uri);
		__xhrPoolSize++;
	}
	function callback(err, res, body) {
		if(__xhrDebugLevel >= 2) console.log('XHR return to pool', _xhr.url);
		__totalConcurrentXhr--;
		__xhrPoolFree.push(_xhr);
		if (err)
			return cb(err, null, _xhr.url);
		if (!/^2/.test(res.statusCode))
			return cb(new Error('http status code: ' + res.statusCode));

		if (jsonResponse) { 
			cb(null, body, _xhr.url);
		} else {
			var data;
			try {
				data = JSON.parse(body);
			} catch (e) {
				cb(new Error('cannot parse json: ' + e), null, _xhr.url);
			}
			if(data) {
				if(__xhrDebugLevel >= 2) console.log("xhr complete", _xhr.url);
				cb(null, data, _xhr.url);
			}
		}
	}

	var _xhr = xhr(opt, callback);
	// _xhr.onabort = function() {
	// 	// callback(new Error('Aborted.'));
	// }
	__totalConcurrentXhr++;
	return _xhr;
}

function noop() {}

var statuses = {
	IMPOSTER : -3,
	SHOULDNT_EVEN_EXIST : -2,
	LOAD_UNAVAILABLE : -1,
	LOAD_AVAILABLE : 0,
	LOADING : 1,
	LOADED : 2,
	LOAD_DEFERRED : 3
}

var __deferredLoadGeometryOf = [];

function JITGeometrySceneLoader(props) {
	if(props) this.load(props);
}

function deferLoadGeometryOf(jitInstace, args) {
	var isUniqueGeometry = true;
	__deferredLoadGeometryOf.forEach(function(deferredLoad) {
		if(deferredLoad.args[0].geometryName == args[0].geometryName) isUniqueGeometry = false;
	});
	__deferredLoadGeometryOf.push({
		jitInstace: jitInstace,
		args: args
	});
	return isUniqueGeometry;
}

function cancelDeferredLoadGeometryOf(object) {
	var index = -1;
	for (var i = 0, len = __deferredLoadGeometryOf.length; i < len; i++) {
		if(object === __deferredLoadGeometryOf[i].args[0]) {
			index = i;
			break;
		}
	}
	if(index != -1) {
		__deferredLoadGeometryOf.splice(index, 1);
	} else {
		console.warn('deferred object was already cancelled');
		// debugger;
	}
}

function attemptToLoadDeferredObjects() {
	if(__totalConcurrentXhr < __maxConcurrentXhr && __deferredLoadGeometryOf.length > 0) {
		var next = __deferredLoadGeometryOf.shift();
		// setTimeout(function() {
		if (next.jitInstace.debugLevel >= 2) {
			console.log('undeferring', next.args[0].name);
			console.log('deferred objects remaining', __deferredLoadGeometryOf.length);
		}
		JITGeometrySceneLoader.prototype.loadGeometryOf.apply(next.jitInstace, next.args);
		// }, 100);
	}
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
		var loader = getXhrLoader(url + '.hierarchy.json', this.hierarchyRecieved);
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

	hierarchyRecieved: function(err, jsonData, path) {
		if(err) {
			throw err;
		}
		path = path.split('.hierarchy.json')[0];
		this.root = new THREE.Object3D();
		for(var childName in jsonData) {
			this.root.add(this.createObject(jsonData[childName], path + '/' + childName));
		}
		if(this.targetParent) {
			this.targetParent.add(this.root);
		}
		this.onComplete();
	},

	geometryRecieved: function(err, jsonData, path) {
		delete this.loadersByGeometryPaths[path.split('.json')[0]];
		if(this.debugLevel>=2) console.log('total loaders', Object.keys(this.loadersByGeometryPaths).length);
		
		if(err) {
			if(this.debugLevel>=1) console.warn(err);
		} else {
			path = this.pathCropGeometries(path);
			path = path.substring(0, path.lastIndexOf('.json'));
			// console.log(jsonData);
			if(this.debugLevel>=2) console.log('loaded', path);

			var geometry = this.threeGeometryJSONLoader.parse(jsonData).geometry;
			this.meshesUsingGeometriesByGeometryPaths[path] = [];
			this.integrateGeometry(geometry, path);
		}
		attemptToLoadDeferredObjects();
	},

	integrateGeometry: function(geometry, path) {
		if(this.debugLevel>=2) console.log('integrate geometry', path, this.objectsWaitingForGeometriesByGeometryPaths[path].length, this.meshesUsingGeometriesByGeometryPaths[path].length);
		this.geometries[path] = geometry;
		if(this.debugLevel>=2) console.log(Object.keys(this.geometries).length, 'geometries in memory');

		var objectsToPromote = this.objectsWaitingForGeometriesByGeometryPaths[path];
		var meshesUsingGeometry = this.meshesUsingGeometriesByGeometryPaths[path];
		for (var i = objectsToPromote.length - 1; i >= 0; i--) {
			var object = objectsToPromote[i];
			var mesh = this.promoteObjectToMesh(object, geometry);
			mesh.loadStatus = statuses.LOADED;
			meshesUsingGeometry.push(mesh);
			if(object.geometryLoadCompleteCallback) {
				// if(i != 0) debugger;
				object.geometryLoadCompleteCallback();
				delete object.geometryLoadCompleteCallback;
			}
			// this.isolationTest(mesh);
		}
		delete this.objectsWaitingForGeometriesByGeometryPaths[path];
	},

	loadGeometryOf: function(object, progressCallback, callback) {
		var loadStatus = object.loadStatus;
		if(loadStatus !== statuses.LOAD_AVAILABLE && loadStatus !== statuses.LOAD_DEFERRED) return false;
		// object.add(new THREE.Mesh(new THREE.SphereGeometry(10)));
		var geometryName = object.geometryName;
		var geometryPath = this.geometryPath + '/' + geometryName;
		if(this.debugLevel>=2) console.log('REQUEST', geometryName);
		switch(loadStatus) {
			// case statuses.LOAD_UNAVAILABLE:
			// 	break;
			case statuses.LOAD_AVAILABLE:
			case statuses.LOAD_DEFERRED:
				var geometry = this.geometries[geometryPath];
				if(geometry) {
					if(this.debugLevel>=2) console.log('reusing', geometryName);
					object = this.promoteObjectToMesh(object, geometry);
					object.loadStatus = statuses.LOADED;
					this.meshesUsingGeometriesByGeometryPaths[geometryPath].push(object);
					if(this.debugLevel>=2) console.log('counting', geometryName, this.meshesUsingGeometriesByGeometryPaths[geometryPath].length);
					attemptToLoadDeferredObjects();
					return false;
				} else if(this.objectsWaitingForGeometriesByGeometryPaths[geometryPath]) {
					if(this.debugLevel>=2) console.log('waiting for', geometryName);
					this.objectsWaitingForGeometriesByGeometryPaths[geometryPath].push(object);
					object.loadStatus = statuses.LOADING;
					attemptToLoadDeferredObjects();
					return false;
				} else if(__totalConcurrentXhr < __maxConcurrentXhr) {
					if(this.debugLevel>=2) console.log('loading', geometryName);
					object.geometryLoadCompleteCallback = callback;
					this.objectsWaitingForGeometriesByGeometryPaths[geometryPath] = [object];
					var loader = getXhrLoader(geometryPath + '.json', this.geometryRecieved);
					loader.onprogress = progressCallback;
					this.loadersByGeometryPaths[geometryPath] = loader;
					if(this.debugLevel>=2) console.log('total loaders', Object.keys(this.loadersByGeometryPaths).length);
					object.loadStatus = statuses.LOADING;
					return true;
				} else {
					if(this.debugLevel>=2) console.log('deferring', geometryName);
					var isUniqueGeometry = deferLoadGeometryOf(this, arguments);
					object.loadStatus = statuses.LOAD_DEFERRED;
					return isUniqueGeometry;
				}
			default:
				return false;
		}
	},

	unloadGeometryOf: function(object) {
		var loadStatus = object.loadStatus;
		if(loadStatus !== statuses.LOADED && loadStatus !== statuses.LOADING && loadStatus !== statuses.LOAD_DEFERRED) return;
		var geometryName = object.geometryName;
		var geometryPath = this.geometryPath + '/' + geometryName;
		if(this.debugLevel>=2) console.log('UNLOAD', geometryName);
		switch(loadStatus) {
			case statuses.IMPOSTER:
				object.parent.remove(object);
				break;
			case statuses.LOADED: 
				var geometry = this.geometries[geometryPath];
				if(this.debugLevel>=2) console.log('unloading', geometryName);
				var meshesUsingGeometry = this.meshesUsingGeometriesByGeometryPaths[geometryPath];
				var index = meshesUsingGeometry.indexOf(object);
				meshesUsingGeometry.splice(index, 1);
				object = this.demoteMeshToObject(object, geometry);
				if(meshesUsingGeometry.length === 0) {
					if(this.debugLevel >= 2) console.log('disposing geometry', geometryName);
					geometry.dispose();
					delete this.meshesUsingGeometriesByGeometryPaths[geometryPath];
					delete this.geometries[geometryPath];
					if(this.debugLevel>=2) console.log(Object.keys(this.geometries).length, 'geometries in memory');
				} else {
					if(this.debugLevel >= 2) console.log('geometry', geometryName, 'still used in', meshesUsingGeometry.length, 'meshes');
				}
				object.loadStatus = statuses.LOAD_AVAILABLE;
				break;
			case statuses.LOAD_DEFERRED:
				if(this.debugLevel >= 2) console.log('cancelling deferred load of', geometryName);
				cancelDeferredLoadGeometryOf(object);
				object.loadStatus = statuses.LOAD_AVAILABLE;
				break;
			case statuses.LOADING:
				if(this.debugLevel >= 2) console.log('cancelling load of', geometryName);
				var objectsWaitingForGeometry = this.objectsWaitingForGeometriesByGeometryPaths[geometryPath];
				var index = objectsWaitingForGeometry.indexOf(object);
				objectsWaitingForGeometry.splice(index, 1);
				if(this.debugLevel >= 2) {
					console.log('loading geometry', geometryName, 'still waited on by', objectsWaitingForGeometry.length, 'objects');
				}
				if(objectsWaitingForGeometry.length === 0) {
					delete this.objectsWaitingForGeometriesByGeometryPaths[geometryPath];
					var loader = this.loadersByGeometryPaths[geometryPath];
					if(loader) {
						if(this.debugLevel >= 2) console.log('aborting loader of', geometryName);
						abortXhr(loader);
						delete this.loadersByGeometryPaths[geometryPath];
					}
				}
				object.loadStatus = statuses.LOAD_AVAILABLE;
				break;
			case statuses.LOAD_AVAILABLE:
				break;
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
			object.loadStatus = statuses.LOAD_AVAILABLE;
			object.geometryName = geometryName;
		} else {
			object.loadStatus = statuses.LOAD_UNAVAILABLE;
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
		object.loadStatus = statuses.SHOULDNT_EVEN_EXIST;
		mesh.loadStatus = statuses.LOADED;
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
		this.onMeshComplete(mesh); 
		return mesh;
	},

	demoteMeshToObject: function(mesh) {
		var object = new THREE.Object3D();
		object.path = mesh.path;
		object.name = mesh.name;
		var parent = mesh.parent;
		mesh.loadStatus = statuses.SHOULDNT_EVEN_EXIST;
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
			var actuallyGonnaLoad = 
				_this.loadGeometryOf(
					obj,
					geometryLoadProgressCallback.bind(obj, geometriesToLoadCount), 
					geometryLoadCompleteCallback.bind(obj, geometriesToLoadCount)
				);
			if(actuallyGonnaLoad) {
				geometriesToLoadCount ++;
				progressOfEachGeometry.push(0);
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
		var _this = this;

		if(object) {
			if(recursive) {
				var collection = [];
				object.traverse(function(obj) {
					collection.push(obj);
				});
				collection.forEach(function(obj){
					_this.unloadGeometryOf(obj);
				})
			} else {
				this.unloadGeometryOf(object);
			}
		}
	},

	checkIfLoadedByName: function(name, recursive) {
		var object = this.getObjectByName(name);
		var loaded = object.loadStatus === statuses.LOADED || object.loadStatus === statuses.LOAD_UNAVAILABLE || object.loadStatus === statuses.IMPOSTER;
		var _this = this;
		if(loaded && recursive) {
			object.traverse(function(obj) {
				if(obj.loadStatus !== statuses.LOADED && obj.loadStatus !== statuses.LOAD_UNAVAILABLE && obj.loadStatus !== statuses.IMPOSTER) {
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
	},

	getNameByPath: function(path) {
		var objPath = this.pathBase + this.path + '/';
		return path.split(objPath)[1];
	}
};

JITGeometrySceneLoader.setMaxConcurrentXhr = function (val) {
	__maxConcurrentXhr = val;
}


JITGeometrySceneLoader.setXhrDebugLevel = function (val) {
	__xhrDebugLevel = val;
}

JITGeometrySceneLoader.statuses = statuses;

module.exports = JITGeometrySceneLoader;