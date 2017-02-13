(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.supertracker = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/* /public/javascripts/tracker.js
* 
* This file  blabla, one day ill write it....
*
*/

function supertracker() {

	var bufferSize = 5; 
	var bufferTimeLimit = 500;
	var basePath;
	// Session wide event data
	var sessionId, userId, trackId;
	var flushingLoop;
	var referrer;
	var date;
	var initiated = false;
	var storage = checkStorage();
	var evBuffer = eventBuffer();
	var origCallback;

	// Init function
	function init (config, callback) {
		origCallback = callback;
		bufferSize = config.bufferSize || bufferSize;
		bufferTimeLimit = config.bufferTimeLimit || bufferTimeLimit;
		if (!config.basePath) {
			return console.log("SUPERTARCKER ERROR: No basePath given, could not init the tracker!");
		}
		basePath = config.basePath;

		referrer = document.referrer;
		date = new Date();

		// Getting the current domain
		var arrDomain = document.domain.split(".");
		var domain = null;
		if (arrDomain.length === 1){
			domain = null;
		} else {
			domain = "." + arrDomain[arrDomain.length -2] + "." + arrDomain[arrDomain.length - 1];
		}

		if (storage) {
			trackId = getCookie("supertrackerTrackId");
		} else {
			trackId = null;			
		}

		var first_session = false;
		
		if (trackId) {
			setCookie("supertrackerTrackId", trackId, 365, domain); //ttt actual domain		
		} else {
			first_session = true;
			trackId = uuid();
			if (storage) {
				// If no trackId then this is the first session fo the trackid
				setCookie("supertrackerTrackId", trackId, 365, domain); //ttt actual domain
			}
		}

		if (storage && sessionStorage.supertrackerSessionId) {
			sessionId = sessionStorage.supertrackerSessionId;
			// console.log('Sessionstorage on');
			initiated = true;
			onInit(callback);
		} else {
			// getScript(basePath + "/javascripts/geoip2.js", function(){
				// geoip2.city(function (resCity) {
					
					// console.log('Sessionstorage off');
					var session = {};
					if (config.properties) {
						session.properties = config.properties;
					}
					if (!storage) {
						if (session.properties) {
							session.properties.cookiesDisabled = true;
						} else {
							session.properties = {cookiesDisabled: true};
						}
					}
					if (first_session) {
						session.first_session = true;
					}
					session.track_id = trackId;
					session.date = date;
					session.screen_windowX = window.innerWidth;   // returns width of browser viewport
					session.screen_windowY = window.innerHeight;   // returns height of browser viewport
					session.screen_screenX = screen.width;
					session.screen_screenY = screen.height;

					
						// ttt errorkezeles

					// session.location_ip = resCity.traits.ip_address;
					// session.location_country =  resCity.country.names.en;
					// session.location_region =  resCity.subdivisions[0].names.en;
					// session.location_city = resCity.city.names.en;


					var xhr = new XMLHttpRequest();
					xhr.open('POST', basePath + '/sessions');
					xhr.setRequestHeader('Content-Type', 'application/json');
					xhr.onload = function() {
					    if (xhr.status === 200) {
					        var res = JSON.parse(xhr.responseText);
					        if (storage) {
								sessionStorage.supertrackerSessionId = res.sessionId;
					        }
							sessionId = res.sessionId;
					        if (res.errorMessage) {
					        	alert(res.errorMessage);
					        }
					        initiated = true;
							onInit(callback);
					    } else {
					    	console.log("session_post_error");
					    }
					};
					xhr.send(JSON.stringify(session));

				// });
			// });
		}


			flushingLoop = setInterval(flush, bufferTimeLimit);
	}

	function onInit (callback) {
		callback();
	}

	function track(eventName, properties, comment, callback) {
		// console.log("TRACK:");
		// console.log(arguments);
		// console.log("{");
		// console.log("eventName: " + eventName);
		// console.log("properties: " + properties);
		// console.log("comment: " + comment);
		// console.log("callback: " + callback);

		var args = [];
		for (var i = 0; i < arguments.length; i++) {
		    args.push(arguments[i]);
		} 

		eventName = args.shift();
		if (args.length > 0)
			if (typeof args[0] !== "function") {
				properties = args.shift();
			} else {
				properties = null;
				comment = null;
				callback = args.shift();
				args.length = 0;
			}
		if (args.length > 0)
			if (typeof args[0] !== "function") {
				comment = args.shift();
			} else {
				comment = null;
				callback = args.shift();
				args.length = 0;
			}
		if (args.length > 0) {
			if (typeof args[0] !== "function") {
				// comment = args.shift();
			} else {
				callback = args.shift();
			}
		}

		if (initiated) {
			// Preparing data
			var event = {
				"track_id": trackId,
				"session_id": sessionId,
				"name": eventName,
				"referrer": referrer,
				"current_url": window.location.href,
				"properties": properties,
				"date": new Date(),
				"comments": comment
			};

			//Loading localstorage
			evBuffer.push(event);

			// Check if it is called as async
			if ( typeof arguments[arguments.length - 1] == "function") {
				flush(callback);
			} else {
				if (evBuffer.getLength() >= bufferSize) {
					flush();
				}
			}

		} else {
			var origOnInit = onInit;
			onInit = function () {
				origOnInit(origCallback);
				track(eventName, properties, comment, callback);
			};
		}
	}

	function flush (callback) {
		if (evBuffer.getLength() > 0) {
			var xhr = new XMLHttpRequest();
			xhr.open('POST', basePath + '/events');
			xhr.setRequestHeader('Content-Type', 'application/json');
			xhr.onload = function() {
			    if (xhr.status === 200) {
			        var res = JSON.parse(xhr.responseText);
			        if (res.errorMessage) {
			        	alert(res.errorMessage);
					}
					clearInterval(flushingLoop);
					flushingLoop = setInterval(flush, bufferTimeLimit);
					if (typeof callback == "function") {
						callback();
					}
			    } else {
			    	console.log("event_flush_error");
			    }
			};
			xhr.send(JSON.stringify(evBuffer.pop()));
		} 
	}

	function identify(extUserId, extFlag, callback) { //ttt flushing mechanism

		var args = [];
		for (var i = 0; i < arguments.length; i++) {
		    args.push(arguments[i]);
		} 

		extUserId = args.shift();
		if (args.length > 0)
			if (typeof args[0] !== "function") {
				extFlag = args.shift();
			} else {
				extFlag = null;
				callback = args.shift();
				args.length = 0;
			}
		if (args.length > 0) {
			if (typeof args[0] !== "function") {
				// comment = args.shift();
			} else {
				callback = args.shift();
			}
		}

		var user = {
			"track_id": trackId,
			"external_user_id": extUserId,
			"external_flag": extFlag
		};
		var xhr = new XMLHttpRequest();
		xhr.open('POST', basePath + '/users');
		xhr.setRequestHeader('Content-Type', 'application/json');
		xhr.onload = function() {
			if (xhr.status === 200) {
				var userInfo = JSON.parse(xhr.responseText);

				console.log(userInfo);

				if (userInfo.userSaved) {
					if (typeof callback == "function") {
						callback();
						return;
					}
				}
				if (typeof callback == "function") {
					callback({err: "user couldnt be saved: " + userInfo});
					return;
				}
			}
		};
		xhr.send(JSON.stringify(user));
	}

	function track_links (query) {
		var links = document.querySelectorAll(query);

		function onclickReplace (link, origOnclick) {

			var onclick = function(event) {
				var trimmedQuery = query.substring(1, query.length-1); // trimming the enclosing "[" and "]"
				var trackData = event.target.getAttribute(trimmedQuery);
				track( trackData, {link: true});
				flush();

				setTimeout(function () {
					if (event.target.getAttribute("href")) {
						window.location = event.target.getAttribute("href");
					}
					if (origOnclick) {
						origOnclick(event);
					}
				},100);
				return false;	
			};

			link.onclick = onclick;
		}

		for (var i = 0; i < links.length; i++) {
			var origOnclick = links[i].onclick;
			onclickReplace(links[i], origOnclick);
		}
	}

	function uuid() {

		// Random entropy
		function R() {
			return Math.floor((1 + Math.random()) * 0x10000)
			.toString(16);
			// .substring(1);
		}

		// Date entropy
		function D() {
			return (1*new Date()).toString(16);
		}

		// User agent entropy
		function UA() {
		    var ua = navigator.userAgent, i, ch, buffer = [], ret = 0;

		    function xor(result, byte_array) {
		        var j, tmp = 0;
		        for (j = 0; j < byte_array.length; j++) {
		            tmp |= (buffer[j] << j*8);
		        }
		        return result ^ tmp;
		    }

		    for (i = 0; i < ua.length; i++) {
		        ch = ua.charCodeAt(i);
		        buffer.unshift(ch & 0xFF);
		        if (buffer.length >= 4) {
		            ret = xor(ret, buffer);
		            buffer = [];
		        }
		    }

		    if (buffer.length > 0) { ret = xor(ret, buffer); }

		    return ret.toString(16);
		}

		function S() {
			return (screen.height*screen.width).toString(16);
		}

		return (D()+"-"+S()+"-"+UA()+"-"+R());
	}

	function setCookie(cname, cvalue, exdays, cdomain) {
	    var d = new Date();
	    d.setTime(d.getTime() + (exdays*24*60*60*1000));
	    var expires = "expires="+d.toUTCString();
	    var domain = "domain=" + cdomain;
	    var strCookie = cname + "=" + cvalue + "; " + expires + "; ";
	    if (cdomain) {
	    	strCookie = strCookie + domain;
	    }
	    document.cookie = strCookie;
	}

	function getCookie(cname) {
	    var name = cname + "=";
	    var ca = document.cookie.split(';');
	    for(var i=0; i<ca.length; i++) {
	        var c = ca[i];
	        while (c.charAt(0)==' ') c = c.substring(1);
	        if (c.indexOf(name) === 0) return c.substring(name.length, c.length);
	    }
	    return "";
	}

	// function getScript(source, callback) {
	//     var script = document.createElement('script');
	//     var prior = document.getElementsByTagName('script')[0];
	//     script.async = 1;
	//     prior.parentNode.insertBefore(script, prior);

	//     script.onload = script.onreadystatechange = function( _, isAbort ) {
	//         if(isAbort || !script.readyState || /loaded|complete/.test(script.readyState) ) {
	//             script.onload = script.onreadystatechange = null;
	//             script = undefined;

	//             if(!isAbort) { if(callback) callback(); }
	//         }
	//     };

	//     script.src = source;
	// }

	return {
		init: init,
		track: track,
		identify: identify,
		track_links: track_links
	};
}

function checkStorage() {
	var uid = new Date();
	var cookie, ls, ss;
	var lsResult, ssResult, cookieResult;
	try {
		// local
		(ls = window.localStorage).setItem(uid, uid);
		lsResult = ls.getItem(uid) == uid;
		ls.removeItem(uid);
		// session
		(ss = window.sessionStorage).setItem(uid, uid);
		ssResult = ss.getItem(uid) == uid;
		ss.removeItem(uid);
		// cookie
		cookie = (navigator.cookieEnabled)? true : false;
		if (typeof navigator.cookieEnabled=="undefined" && !cookieEnabled){ 
			document.cookie="testcookie";
			cookie = (document.cookie.indexOf("testcookie")!=-1)? true : false;
		}
		return ls && ss && lsResult && ssResult && cookie;
	} catch (exception) {}
}

function eventBuffer (storage) {
	var buffer = [];

	function push (event){
		if (storage) {
			if (localStorage.eventBuffer) {
				buffer = JSON.parse(localStorage.eventBuffer);
				buffer.push(event);
			} else {
				buffer = [event];
			}
			localStorage.eventBuffer = JSON.stringify(buffer);   
		} else {
			buffer.push(event);
		}
	}

	function pop () {
		if (storage) {
			if (localStorage.eventBuffer) {
				buffer = JSON.parse(localStorage.eventBuffer);
				localStorage.removeItem('eventBuffer');
			} else {
				buffer = [];
			}
		}

		var buff = buffer;
		buffer = [];
		return buff;
	}

	function get () {
		var buff;
		if (storage) {
			if (localStorage.eventBuffer) {
				buff = JSON.parse(localStorage.eventBuffer);
			} else {
				buff = [];
			}
		} else {
			buff = buffer;
		}
		return buff;
	}

	function getLength () {
		var length;
		if (storage) {
			length = JSON.parse(localStorage.eventBuffer).length;
		} else {
			length = buffer.length;
		}
		return length;
	}

	return {
		push: push,
		pop: pop,
		get: get,
		getLength: getLength,

		length: length
	};
}

window.supertracker = supertracker;

module.exports = supertracker;
},{}]},{},[1])(1)
});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJwdWJsaWMvamF2YXNjcmlwdHMvdHJhY2tlci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3ZhciBmPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIik7dGhyb3cgZi5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGZ9dmFyIGw9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGwuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sbCxsLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qIC9wdWJsaWMvamF2YXNjcmlwdHMvdHJhY2tlci5qc1xuKiBcbiogVGhpcyBmaWxlICBibGFibGEsIG9uZSBkYXkgaWxsIHdyaXRlIGl0Li4uLlxuKlxuKi9cblxuZnVuY3Rpb24gc3VwZXJ0cmFja2VyKCkge1xuXG5cdHZhciBidWZmZXJTaXplID0gNTsgXG5cdHZhciBidWZmZXJUaW1lTGltaXQgPSA1MDA7XG5cdHZhciBiYXNlUGF0aDtcblx0Ly8gU2Vzc2lvbiB3aWRlIGV2ZW50IGRhdGFcblx0dmFyIHNlc3Npb25JZCwgdXNlcklkLCB0cmFja0lkO1xuXHR2YXIgZmx1c2hpbmdMb29wO1xuXHR2YXIgcmVmZXJyZXI7XG5cdHZhciBkYXRlO1xuXHR2YXIgaW5pdGlhdGVkID0gZmFsc2U7XG5cdHZhciBzdG9yYWdlID0gY2hlY2tTdG9yYWdlKCk7XG5cdHZhciBldkJ1ZmZlciA9IGV2ZW50QnVmZmVyKCk7XG5cdHZhciBvcmlnQ2FsbGJhY2s7XG5cblx0Ly8gSW5pdCBmdW5jdGlvblxuXHRmdW5jdGlvbiBpbml0IChjb25maWcsIGNhbGxiYWNrKSB7XG5cdFx0b3JpZ0NhbGxiYWNrID0gY2FsbGJhY2s7XG5cdFx0YnVmZmVyU2l6ZSA9IGNvbmZpZy5idWZmZXJTaXplIHx8IGJ1ZmZlclNpemU7XG5cdFx0YnVmZmVyVGltZUxpbWl0ID0gY29uZmlnLmJ1ZmZlclRpbWVMaW1pdCB8fCBidWZmZXJUaW1lTGltaXQ7XG5cdFx0aWYgKCFjb25maWcuYmFzZVBhdGgpIHtcblx0XHRcdHJldHVybiBjb25zb2xlLmxvZyhcIlNVUEVSVEFSQ0tFUiBFUlJPUjogTm8gYmFzZVBhdGggZ2l2ZW4sIGNvdWxkIG5vdCBpbml0IHRoZSB0cmFja2VyIVwiKTtcblx0XHR9XG5cdFx0YmFzZVBhdGggPSBjb25maWcuYmFzZVBhdGg7XG5cblx0XHRyZWZlcnJlciA9IGRvY3VtZW50LnJlZmVycmVyO1xuXHRcdGRhdGUgPSBuZXcgRGF0ZSgpO1xuXG5cdFx0Ly8gR2V0dGluZyB0aGUgY3VycmVudCBkb21haW5cblx0XHR2YXIgYXJyRG9tYWluID0gZG9jdW1lbnQuZG9tYWluLnNwbGl0KFwiLlwiKTtcblx0XHR2YXIgZG9tYWluID0gbnVsbDtcblx0XHRpZiAoYXJyRG9tYWluLmxlbmd0aCA9PT0gMSl7XG5cdFx0XHRkb21haW4gPSBudWxsO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkb21haW4gPSBcIi5cIiArIGFyckRvbWFpblthcnJEb21haW4ubGVuZ3RoIC0yXSArIFwiLlwiICsgYXJyRG9tYWluW2FyckRvbWFpbi5sZW5ndGggLSAxXTtcblx0XHR9XG5cblx0XHRpZiAoc3RvcmFnZSkge1xuXHRcdFx0dHJhY2tJZCA9IGdldENvb2tpZShcInN1cGVydHJhY2tlclRyYWNrSWRcIik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRyYWNrSWQgPSBudWxsO1x0XHRcdFxuXHRcdH1cblxuXHRcdHZhciBmaXJzdF9zZXNzaW9uID0gZmFsc2U7XG5cdFx0XG5cdFx0aWYgKHRyYWNrSWQpIHtcblx0XHRcdHNldENvb2tpZShcInN1cGVydHJhY2tlclRyYWNrSWRcIiwgdHJhY2tJZCwgMzY1LCBkb21haW4pOyAvL3R0dCBhY3R1YWwgZG9tYWluXHRcdFxuXHRcdH0gZWxzZSB7XG5cdFx0XHRmaXJzdF9zZXNzaW9uID0gdHJ1ZTtcblx0XHRcdHRyYWNrSWQgPSB1dWlkKCk7XG5cdFx0XHRpZiAoc3RvcmFnZSkge1xuXHRcdFx0XHQvLyBJZiBubyB0cmFja0lkIHRoZW4gdGhpcyBpcyB0aGUgZmlyc3Qgc2Vzc2lvbiBmbyB0aGUgdHJhY2tpZFxuXHRcdFx0XHRzZXRDb29raWUoXCJzdXBlcnRyYWNrZXJUcmFja0lkXCIsIHRyYWNrSWQsIDM2NSwgZG9tYWluKTsgLy90dHQgYWN0dWFsIGRvbWFpblxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzdG9yYWdlICYmIHNlc3Npb25TdG9yYWdlLnN1cGVydHJhY2tlclNlc3Npb25JZCkge1xuXHRcdFx0c2Vzc2lvbklkID0gc2Vzc2lvblN0b3JhZ2Uuc3VwZXJ0cmFja2VyU2Vzc2lvbklkO1xuXHRcdFx0Ly8gY29uc29sZS5sb2coJ1Nlc3Npb25zdG9yYWdlIG9uJyk7XG5cdFx0XHRpbml0aWF0ZWQgPSB0cnVlO1xuXHRcdFx0b25Jbml0KGNhbGxiYWNrKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Ly8gZ2V0U2NyaXB0KGJhc2VQYXRoICsgXCIvamF2YXNjcmlwdHMvZ2VvaXAyLmpzXCIsIGZ1bmN0aW9uKCl7XG5cdFx0XHRcdC8vIGdlb2lwMi5jaXR5KGZ1bmN0aW9uIChyZXNDaXR5KSB7XG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ1Nlc3Npb25zdG9yYWdlIG9mZicpO1xuXHRcdFx0XHRcdHZhciBzZXNzaW9uID0ge307XG5cdFx0XHRcdFx0aWYgKGNvbmZpZy5wcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uLnByb3BlcnRpZXMgPSBjb25maWcucHJvcGVydGllcztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKCFzdG9yYWdlKSB7XG5cdFx0XHRcdFx0XHRpZiAoc2Vzc2lvbi5wcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdFx0XHRcdHNlc3Npb24ucHJvcGVydGllcy5jb29raWVzRGlzYWJsZWQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0c2Vzc2lvbi5wcm9wZXJ0aWVzID0ge2Nvb2tpZXNEaXNhYmxlZDogdHJ1ZX07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChmaXJzdF9zZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRzZXNzaW9uLmZpcnN0X3Nlc3Npb24gPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRzZXNzaW9uLnRyYWNrX2lkID0gdHJhY2tJZDtcblx0XHRcdFx0XHRzZXNzaW9uLmRhdGUgPSBkYXRlO1xuXHRcdFx0XHRcdHNlc3Npb24uc2NyZWVuX3dpbmRvd1ggPSB3aW5kb3cuaW5uZXJXaWR0aDsgICAvLyByZXR1cm5zIHdpZHRoIG9mIGJyb3dzZXIgdmlld3BvcnRcblx0XHRcdFx0XHRzZXNzaW9uLnNjcmVlbl93aW5kb3dZID0gd2luZG93LmlubmVySGVpZ2h0OyAgIC8vIHJldHVybnMgaGVpZ2h0IG9mIGJyb3dzZXIgdmlld3BvcnRcblx0XHRcdFx0XHRzZXNzaW9uLnNjcmVlbl9zY3JlZW5YID0gc2NyZWVuLndpZHRoO1xuXHRcdFx0XHRcdHNlc3Npb24uc2NyZWVuX3NjcmVlblkgPSBzY3JlZW4uaGVpZ2h0O1xuXG5cdFx0XHRcdFx0XG5cdFx0XHRcdFx0XHQvLyB0dHQgZXJyb3JrZXplbGVzXG5cblx0XHRcdFx0XHQvLyBzZXNzaW9uLmxvY2F0aW9uX2lwID0gcmVzQ2l0eS50cmFpdHMuaXBfYWRkcmVzcztcblx0XHRcdFx0XHQvLyBzZXNzaW9uLmxvY2F0aW9uX2NvdW50cnkgPSAgcmVzQ2l0eS5jb3VudHJ5Lm5hbWVzLmVuO1xuXHRcdFx0XHRcdC8vIHNlc3Npb24ubG9jYXRpb25fcmVnaW9uID0gIHJlc0NpdHkuc3ViZGl2aXNpb25zWzBdLm5hbWVzLmVuO1xuXHRcdFx0XHRcdC8vIHNlc3Npb24ubG9jYXRpb25fY2l0eSA9IHJlc0NpdHkuY2l0eS5uYW1lcy5lbjtcblxuXG5cdFx0XHRcdFx0dmFyIHhociA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXHRcdFx0XHRcdHhoci5vcGVuKCdQT1NUJywgYmFzZVBhdGggKyAnL3Nlc3Npb25zJyk7XG5cdFx0XHRcdFx0eGhyLnNldFJlcXVlc3RIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XG5cdFx0XHRcdFx0eGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0XHRcdCAgICBpZiAoeGhyLnN0YXR1cyA9PT0gMjAwKSB7XG5cdFx0XHRcdFx0ICAgICAgICB2YXIgcmVzID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcblx0XHRcdFx0XHQgICAgICAgIGlmIChzdG9yYWdlKSB7XG5cdFx0XHRcdFx0XHRcdFx0c2Vzc2lvblN0b3JhZ2Uuc3VwZXJ0cmFja2VyU2Vzc2lvbklkID0gcmVzLnNlc3Npb25JZDtcblx0XHRcdFx0XHQgICAgICAgIH1cblx0XHRcdFx0XHRcdFx0c2Vzc2lvbklkID0gcmVzLnNlc3Npb25JZDtcblx0XHRcdFx0XHQgICAgICAgIGlmIChyZXMuZXJyb3JNZXNzYWdlKSB7XG5cdFx0XHRcdFx0ICAgICAgICBcdGFsZXJ0KHJlcy5lcnJvck1lc3NhZ2UpO1xuXHRcdFx0XHRcdCAgICAgICAgfVxuXHRcdFx0XHRcdCAgICAgICAgaW5pdGlhdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0b25Jbml0KGNhbGxiYWNrKTtcblx0XHRcdFx0XHQgICAgfSBlbHNlIHtcblx0XHRcdFx0XHQgICAgXHRjb25zb2xlLmxvZyhcInNlc3Npb25fcG9zdF9lcnJvclwiKTtcblx0XHRcdFx0XHQgICAgfVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0eGhyLnNlbmQoSlNPTi5zdHJpbmdpZnkoc2Vzc2lvbikpO1xuXG5cdFx0XHRcdC8vIH0pO1xuXHRcdFx0Ly8gfSk7XG5cdFx0fVxuXG5cblx0XHRcdGZsdXNoaW5nTG9vcCA9IHNldEludGVydmFsKGZsdXNoLCBidWZmZXJUaW1lTGltaXQpO1xuXHR9XG5cblx0ZnVuY3Rpb24gb25Jbml0IChjYWxsYmFjaykge1xuXHRcdGNhbGxiYWNrKCk7XG5cdH1cblxuXHRmdW5jdGlvbiB0cmFjayhldmVudE5hbWUsIHByb3BlcnRpZXMsIGNvbW1lbnQsIGNhbGxiYWNrKSB7XG5cdFx0Ly8gY29uc29sZS5sb2coXCJUUkFDSzpcIik7XG5cdFx0Ly8gY29uc29sZS5sb2coYXJndW1lbnRzKTtcblx0XHQvLyBjb25zb2xlLmxvZyhcIntcIik7XG5cdFx0Ly8gY29uc29sZS5sb2coXCJldmVudE5hbWU6IFwiICsgZXZlbnROYW1lKTtcblx0XHQvLyBjb25zb2xlLmxvZyhcInByb3BlcnRpZXM6IFwiICsgcHJvcGVydGllcyk7XG5cdFx0Ly8gY29uc29sZS5sb2coXCJjb21tZW50OiBcIiArIGNvbW1lbnQpO1xuXHRcdC8vIGNvbnNvbGUubG9nKFwiY2FsbGJhY2s6IFwiICsgY2FsbGJhY2spO1xuXG5cdFx0dmFyIGFyZ3MgPSBbXTtcblx0XHRmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuXHRcdCAgICBhcmdzLnB1c2goYXJndW1lbnRzW2ldKTtcblx0XHR9IFxuXG5cdFx0ZXZlbnROYW1lID0gYXJncy5zaGlmdCgpO1xuXHRcdGlmIChhcmdzLmxlbmd0aCA+IDApXG5cdFx0XHRpZiAodHlwZW9mIGFyZ3NbMF0gIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRwcm9wZXJ0aWVzID0gYXJncy5zaGlmdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cHJvcGVydGllcyA9IG51bGw7XG5cdFx0XHRcdGNvbW1lbnQgPSBudWxsO1xuXHRcdFx0XHRjYWxsYmFjayA9IGFyZ3Muc2hpZnQoKTtcblx0XHRcdFx0YXJncy5sZW5ndGggPSAwO1xuXHRcdFx0fVxuXHRcdGlmIChhcmdzLmxlbmd0aCA+IDApXG5cdFx0XHRpZiAodHlwZW9mIGFyZ3NbMF0gIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRjb21tZW50ID0gYXJncy5zaGlmdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29tbWVudCA9IG51bGw7XG5cdFx0XHRcdGNhbGxiYWNrID0gYXJncy5zaGlmdCgpO1xuXHRcdFx0XHRhcmdzLmxlbmd0aCA9IDA7XG5cdFx0XHR9XG5cdFx0aWYgKGFyZ3MubGVuZ3RoID4gMCkge1xuXHRcdFx0aWYgKHR5cGVvZiBhcmdzWzBdICE9PSBcImZ1bmN0aW9uXCIpIHtcblx0XHRcdFx0Ly8gY29tbWVudCA9IGFyZ3Muc2hpZnQoKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNhbGxiYWNrID0gYXJncy5zaGlmdCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChpbml0aWF0ZWQpIHtcblx0XHRcdC8vIFByZXBhcmluZyBkYXRhXG5cdFx0XHR2YXIgZXZlbnQgPSB7XG5cdFx0XHRcdFwidHJhY2tfaWRcIjogdHJhY2tJZCxcblx0XHRcdFx0XCJzZXNzaW9uX2lkXCI6IHNlc3Npb25JZCxcblx0XHRcdFx0XCJuYW1lXCI6IGV2ZW50TmFtZSxcblx0XHRcdFx0XCJyZWZlcnJlclwiOiByZWZlcnJlcixcblx0XHRcdFx0XCJjdXJyZW50X3VybFwiOiB3aW5kb3cubG9jYXRpb24uaHJlZixcblx0XHRcdFx0XCJwcm9wZXJ0aWVzXCI6IHByb3BlcnRpZXMsXG5cdFx0XHRcdFwiZGF0ZVwiOiBuZXcgRGF0ZSgpLFxuXHRcdFx0XHRcImNvbW1lbnRzXCI6IGNvbW1lbnRcblx0XHRcdH07XG5cblx0XHRcdC8vTG9hZGluZyBsb2NhbHN0b3JhZ2Vcblx0XHRcdGV2QnVmZmVyLnB1c2goZXZlbnQpO1xuXG5cdFx0XHQvLyBDaGVjayBpZiBpdCBpcyBjYWxsZWQgYXMgYXN5bmNcblx0XHRcdGlmICggdHlwZW9mIGFyZ3VtZW50c1thcmd1bWVudHMubGVuZ3RoIC0gMV0gPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdGZsdXNoKGNhbGxiYWNrKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChldkJ1ZmZlci5nZXRMZW5ndGgoKSA+PSBidWZmZXJTaXplKSB7XG5cdFx0XHRcdFx0Zmx1c2goKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHZhciBvcmlnT25Jbml0ID0gb25Jbml0O1xuXHRcdFx0b25Jbml0ID0gZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRvcmlnT25Jbml0KG9yaWdDYWxsYmFjayk7XG5cdFx0XHRcdHRyYWNrKGV2ZW50TmFtZSwgcHJvcGVydGllcywgY29tbWVudCwgY2FsbGJhY2spO1xuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBmbHVzaCAoY2FsbGJhY2spIHtcblx0XHRpZiAoZXZCdWZmZXIuZ2V0TGVuZ3RoKCkgPiAwKSB7XG5cdFx0XHR2YXIgeGhyID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cdFx0XHR4aHIub3BlbignUE9TVCcsIGJhc2VQYXRoICsgJy9ldmVudHMnKTtcblx0XHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXHRcdFx0eGhyLm9ubG9hZCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0ICAgIGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcblx0XHRcdCAgICAgICAgdmFyIHJlcyA9IEpTT04ucGFyc2UoeGhyLnJlc3BvbnNlVGV4dCk7XG5cdFx0XHQgICAgICAgIGlmIChyZXMuZXJyb3JNZXNzYWdlKSB7XG5cdFx0XHQgICAgICAgIFx0YWxlcnQocmVzLmVycm9yTWVzc2FnZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNsZWFySW50ZXJ2YWwoZmx1c2hpbmdMb29wKTtcblx0XHRcdFx0XHRmbHVzaGluZ0xvb3AgPSBzZXRJbnRlcnZhbChmbHVzaCwgYnVmZmVyVGltZUxpbWl0KTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGNhbGxiYWNrID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdFx0XHR9XG5cdFx0XHQgICAgfSBlbHNlIHtcblx0XHRcdCAgICBcdGNvbnNvbGUubG9nKFwiZXZlbnRfZmx1c2hfZXJyb3JcIik7XG5cdFx0XHQgICAgfVxuXHRcdFx0fTtcblx0XHRcdHhoci5zZW5kKEpTT04uc3RyaW5naWZ5KGV2QnVmZmVyLnBvcCgpKSk7XG5cdFx0fSBcblx0fVxuXG5cdGZ1bmN0aW9uIGlkZW50aWZ5KGV4dFVzZXJJZCwgZXh0RmxhZywgY2FsbGJhY2spIHsgLy90dHQgZmx1c2hpbmcgbWVjaGFuaXNtXG5cblx0XHR2YXIgYXJncyA9IFtdO1xuXHRcdGZvciAodmFyIGkgPSAwOyBpIDwgYXJndW1lbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0ICAgIGFyZ3MucHVzaChhcmd1bWVudHNbaV0pO1xuXHRcdH0gXG5cblx0XHRleHRVc2VySWQgPSBhcmdzLnNoaWZ0KCk7XG5cdFx0aWYgKGFyZ3MubGVuZ3RoID4gMClcblx0XHRcdGlmICh0eXBlb2YgYXJnc1swXSAhPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdGV4dEZsYWcgPSBhcmdzLnNoaWZ0KCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRleHRGbGFnID0gbnVsbDtcblx0XHRcdFx0Y2FsbGJhY2sgPSBhcmdzLnNoaWZ0KCk7XG5cdFx0XHRcdGFyZ3MubGVuZ3RoID0gMDtcblx0XHRcdH1cblx0XHRpZiAoYXJncy5sZW5ndGggPiAwKSB7XG5cdFx0XHRpZiAodHlwZW9mIGFyZ3NbMF0gIT09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHQvLyBjb21tZW50ID0gYXJncy5zaGlmdCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y2FsbGJhY2sgPSBhcmdzLnNoaWZ0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dmFyIHVzZXIgPSB7XG5cdFx0XHRcInRyYWNrX2lkXCI6IHRyYWNrSWQsXG5cdFx0XHRcImV4dGVybmFsX3VzZXJfaWRcIjogZXh0VXNlcklkLFxuXHRcdFx0XCJleHRlcm5hbF9mbGFnXCI6IGV4dEZsYWdcblx0XHR9O1xuXHRcdHZhciB4aHIgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblx0XHR4aHIub3BlbignUE9TVCcsIGJhc2VQYXRoICsgJy91c2VycycpO1xuXHRcdHhoci5zZXRSZXF1ZXN0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xuXHRcdHhoci5vbmxvYWQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmICh4aHIuc3RhdHVzID09PSAyMDApIHtcblx0XHRcdFx0dmFyIHVzZXJJbmZvID0gSlNPTi5wYXJzZSh4aHIucmVzcG9uc2VUZXh0KTtcblxuXHRcdFx0XHRjb25zb2xlLmxvZyh1c2VySW5mbyk7XG5cblx0XHRcdFx0aWYgKHVzZXJJbmZvLnVzZXJTYXZlZCkge1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgY2FsbGJhY2sgPT0gXCJmdW5jdGlvblwiKSB7XG5cdFx0XHRcdFx0XHRjYWxsYmFjaygpO1xuXHRcdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodHlwZW9mIGNhbGxiYWNrID09IFwiZnVuY3Rpb25cIikge1xuXHRcdFx0XHRcdGNhbGxiYWNrKHtlcnI6IFwidXNlciBjb3VsZG50IGJlIHNhdmVkOiBcIiArIHVzZXJJbmZvfSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblx0XHR4aHIuc2VuZChKU09OLnN0cmluZ2lmeSh1c2VyKSk7XG5cdH1cblxuXHRmdW5jdGlvbiB0cmFja19saW5rcyAocXVlcnkpIHtcblx0XHR2YXIgbGlua3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHF1ZXJ5KTtcblxuXHRcdGZ1bmN0aW9uIG9uY2xpY2tSZXBsYWNlIChsaW5rLCBvcmlnT25jbGljaykge1xuXG5cdFx0XHR2YXIgb25jbGljayA9IGZ1bmN0aW9uKGV2ZW50KSB7XG5cdFx0XHRcdHZhciB0cmltbWVkUXVlcnkgPSBxdWVyeS5zdWJzdHJpbmcoMSwgcXVlcnkubGVuZ3RoLTEpOyAvLyB0cmltbWluZyB0aGUgZW5jbG9zaW5nIFwiW1wiIGFuZCBcIl1cIlxuXHRcdFx0XHR2YXIgdHJhY2tEYXRhID0gZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZSh0cmltbWVkUXVlcnkpO1xuXHRcdFx0XHR0cmFjayggdHJhY2tEYXRhLCB7bGluazogdHJ1ZX0pO1xuXHRcdFx0XHRmbHVzaCgpO1xuXG5cdFx0XHRcdHNldFRpbWVvdXQoZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRcdGlmIChldmVudC50YXJnZXQuZ2V0QXR0cmlidXRlKFwiaHJlZlwiKSkge1xuXHRcdFx0XHRcdFx0d2luZG93LmxvY2F0aW9uID0gZXZlbnQudGFyZ2V0LmdldEF0dHJpYnV0ZShcImhyZWZcIik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChvcmlnT25jbGljaykge1xuXHRcdFx0XHRcdFx0b3JpZ09uY2xpY2soZXZlbnQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSwxMDApO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XHRcblx0XHRcdH07XG5cblx0XHRcdGxpbmsub25jbGljayA9IG9uY2xpY2s7XG5cdFx0fVxuXG5cdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBsaW5rcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0dmFyIG9yaWdPbmNsaWNrID0gbGlua3NbaV0ub25jbGljaztcblx0XHRcdG9uY2xpY2tSZXBsYWNlKGxpbmtzW2ldLCBvcmlnT25jbGljayk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gdXVpZCgpIHtcblxuXHRcdC8vIFJhbmRvbSBlbnRyb3B5XG5cdFx0ZnVuY3Rpb24gUigpIHtcblx0XHRcdHJldHVybiBNYXRoLmZsb29yKCgxICsgTWF0aC5yYW5kb20oKSkgKiAweDEwMDAwKVxuXHRcdFx0LnRvU3RyaW5nKDE2KTtcblx0XHRcdC8vIC5zdWJzdHJpbmcoMSk7XG5cdFx0fVxuXG5cdFx0Ly8gRGF0ZSBlbnRyb3B5XG5cdFx0ZnVuY3Rpb24gRCgpIHtcblx0XHRcdHJldHVybiAoMSpuZXcgRGF0ZSgpKS50b1N0cmluZygxNik7XG5cdFx0fVxuXG5cdFx0Ly8gVXNlciBhZ2VudCBlbnRyb3B5XG5cdFx0ZnVuY3Rpb24gVUEoKSB7XG5cdFx0ICAgIHZhciB1YSA9IG5hdmlnYXRvci51c2VyQWdlbnQsIGksIGNoLCBidWZmZXIgPSBbXSwgcmV0ID0gMDtcblxuXHRcdCAgICBmdW5jdGlvbiB4b3IocmVzdWx0LCBieXRlX2FycmF5KSB7XG5cdFx0ICAgICAgICB2YXIgaiwgdG1wID0gMDtcblx0XHQgICAgICAgIGZvciAoaiA9IDA7IGogPCBieXRlX2FycmF5Lmxlbmd0aDsgaisrKSB7XG5cdFx0ICAgICAgICAgICAgdG1wIHw9IChidWZmZXJbal0gPDwgaio4KTtcblx0XHQgICAgICAgIH1cblx0XHQgICAgICAgIHJldHVybiByZXN1bHQgXiB0bXA7XG5cdFx0ICAgIH1cblxuXHRcdCAgICBmb3IgKGkgPSAwOyBpIDwgdWEubGVuZ3RoOyBpKyspIHtcblx0XHQgICAgICAgIGNoID0gdWEuY2hhckNvZGVBdChpKTtcblx0XHQgICAgICAgIGJ1ZmZlci51bnNoaWZ0KGNoICYgMHhGRik7XG5cdFx0ICAgICAgICBpZiAoYnVmZmVyLmxlbmd0aCA+PSA0KSB7XG5cdFx0ICAgICAgICAgICAgcmV0ID0geG9yKHJldCwgYnVmZmVyKTtcblx0XHQgICAgICAgICAgICBidWZmZXIgPSBbXTtcblx0XHQgICAgICAgIH1cblx0XHQgICAgfVxuXG5cdFx0ICAgIGlmIChidWZmZXIubGVuZ3RoID4gMCkgeyByZXQgPSB4b3IocmV0LCBidWZmZXIpOyB9XG5cblx0XHQgICAgcmV0dXJuIHJldC50b1N0cmluZygxNik7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gUygpIHtcblx0XHRcdHJldHVybiAoc2NyZWVuLmhlaWdodCpzY3JlZW4ud2lkdGgpLnRvU3RyaW5nKDE2KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gKEQoKStcIi1cIitTKCkrXCItXCIrVUEoKStcIi1cIitSKCkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gc2V0Q29va2llKGNuYW1lLCBjdmFsdWUsIGV4ZGF5cywgY2RvbWFpbikge1xuXHQgICAgdmFyIGQgPSBuZXcgRGF0ZSgpO1xuXHQgICAgZC5zZXRUaW1lKGQuZ2V0VGltZSgpICsgKGV4ZGF5cyoyNCo2MCo2MCoxMDAwKSk7XG5cdCAgICB2YXIgZXhwaXJlcyA9IFwiZXhwaXJlcz1cIitkLnRvVVRDU3RyaW5nKCk7XG5cdCAgICB2YXIgZG9tYWluID0gXCJkb21haW49XCIgKyBjZG9tYWluO1xuXHQgICAgdmFyIHN0ckNvb2tpZSA9IGNuYW1lICsgXCI9XCIgKyBjdmFsdWUgKyBcIjsgXCIgKyBleHBpcmVzICsgXCI7IFwiO1xuXHQgICAgaWYgKGNkb21haW4pIHtcblx0ICAgIFx0c3RyQ29va2llID0gc3RyQ29va2llICsgZG9tYWluO1xuXHQgICAgfVxuXHQgICAgZG9jdW1lbnQuY29va2llID0gc3RyQ29va2llO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0Q29va2llKGNuYW1lKSB7XG5cdCAgICB2YXIgbmFtZSA9IGNuYW1lICsgXCI9XCI7XG5cdCAgICB2YXIgY2EgPSBkb2N1bWVudC5jb29raWUuc3BsaXQoJzsnKTtcblx0ICAgIGZvcih2YXIgaT0wOyBpPGNhLmxlbmd0aDsgaSsrKSB7XG5cdCAgICAgICAgdmFyIGMgPSBjYVtpXTtcblx0ICAgICAgICB3aGlsZSAoYy5jaGFyQXQoMCk9PScgJykgYyA9IGMuc3Vic3RyaW5nKDEpO1xuXHQgICAgICAgIGlmIChjLmluZGV4T2YobmFtZSkgPT09IDApIHJldHVybiBjLnN1YnN0cmluZyhuYW1lLmxlbmd0aCwgYy5sZW5ndGgpO1xuXHQgICAgfVxuXHQgICAgcmV0dXJuIFwiXCI7XG5cdH1cblxuXHQvLyBmdW5jdGlvbiBnZXRTY3JpcHQoc291cmNlLCBjYWxsYmFjaykge1xuXHQvLyAgICAgdmFyIHNjcmlwdCA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NjcmlwdCcpO1xuXHQvLyAgICAgdmFyIHByaW9yID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoJ3NjcmlwdCcpWzBdO1xuXHQvLyAgICAgc2NyaXB0LmFzeW5jID0gMTtcblx0Ly8gICAgIHByaW9yLnBhcmVudE5vZGUuaW5zZXJ0QmVmb3JlKHNjcmlwdCwgcHJpb3IpO1xuXG5cdC8vICAgICBzY3JpcHQub25sb2FkID0gc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IGZ1bmN0aW9uKCBfLCBpc0Fib3J0ICkge1xuXHQvLyAgICAgICAgIGlmKGlzQWJvcnQgfHwgIXNjcmlwdC5yZWFkeVN0YXRlIHx8IC9sb2FkZWR8Y29tcGxldGUvLnRlc3Qoc2NyaXB0LnJlYWR5U3RhdGUpICkge1xuXHQvLyAgICAgICAgICAgICBzY3JpcHQub25sb2FkID0gc2NyaXB0Lm9ucmVhZHlzdGF0ZWNoYW5nZSA9IG51bGw7XG5cdC8vICAgICAgICAgICAgIHNjcmlwdCA9IHVuZGVmaW5lZDtcblxuXHQvLyAgICAgICAgICAgICBpZighaXNBYm9ydCkgeyBpZihjYWxsYmFjaykgY2FsbGJhY2soKTsgfVxuXHQvLyAgICAgICAgIH1cblx0Ly8gICAgIH07XG5cblx0Ly8gICAgIHNjcmlwdC5zcmMgPSBzb3VyY2U7XG5cdC8vIH1cblxuXHRyZXR1cm4ge1xuXHRcdGluaXQ6IGluaXQsXG5cdFx0dHJhY2s6IHRyYWNrLFxuXHRcdGlkZW50aWZ5OiBpZGVudGlmeSxcblx0XHR0cmFja19saW5rczogdHJhY2tfbGlua3Ncblx0fTtcbn1cblxuZnVuY3Rpb24gY2hlY2tTdG9yYWdlKCkge1xuXHR2YXIgdWlkID0gbmV3IERhdGUoKTtcblx0dmFyIGNvb2tpZSwgbHMsIHNzO1xuXHR2YXIgbHNSZXN1bHQsIHNzUmVzdWx0LCBjb29raWVSZXN1bHQ7XG5cdHRyeSB7XG5cdFx0Ly8gbG9jYWxcblx0XHQobHMgPSB3aW5kb3cubG9jYWxTdG9yYWdlKS5zZXRJdGVtKHVpZCwgdWlkKTtcblx0XHRsc1Jlc3VsdCA9IGxzLmdldEl0ZW0odWlkKSA9PSB1aWQ7XG5cdFx0bHMucmVtb3ZlSXRlbSh1aWQpO1xuXHRcdC8vIHNlc3Npb25cblx0XHQoc3MgPSB3aW5kb3cuc2Vzc2lvblN0b3JhZ2UpLnNldEl0ZW0odWlkLCB1aWQpO1xuXHRcdHNzUmVzdWx0ID0gc3MuZ2V0SXRlbSh1aWQpID09IHVpZDtcblx0XHRzcy5yZW1vdmVJdGVtKHVpZCk7XG5cdFx0Ly8gY29va2llXG5cdFx0Y29va2llID0gKG5hdmlnYXRvci5jb29raWVFbmFibGVkKT8gdHJ1ZSA6IGZhbHNlO1xuXHRcdGlmICh0eXBlb2YgbmF2aWdhdG9yLmNvb2tpZUVuYWJsZWQ9PVwidW5kZWZpbmVkXCIgJiYgIWNvb2tpZUVuYWJsZWQpeyBcblx0XHRcdGRvY3VtZW50LmNvb2tpZT1cInRlc3Rjb29raWVcIjtcblx0XHRcdGNvb2tpZSA9IChkb2N1bWVudC5jb29raWUuaW5kZXhPZihcInRlc3Rjb29raWVcIikhPS0xKT8gdHJ1ZSA6IGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gbHMgJiYgc3MgJiYgbHNSZXN1bHQgJiYgc3NSZXN1bHQgJiYgY29va2llO1xuXHR9IGNhdGNoIChleGNlcHRpb24pIHt9XG59XG5cbmZ1bmN0aW9uIGV2ZW50QnVmZmVyIChzdG9yYWdlKSB7XG5cdHZhciBidWZmZXIgPSBbXTtcblxuXHRmdW5jdGlvbiBwdXNoIChldmVudCl7XG5cdFx0aWYgKHN0b3JhZ2UpIHtcblx0XHRcdGlmIChsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpIHtcblx0XHRcdFx0YnVmZmVyID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpO1xuXHRcdFx0XHRidWZmZXIucHVzaChldmVudCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRidWZmZXIgPSBbZXZlbnRdO1xuXHRcdFx0fVxuXHRcdFx0bG9jYWxTdG9yYWdlLmV2ZW50QnVmZmVyID0gSlNPTi5zdHJpbmdpZnkoYnVmZmVyKTsgICBcblx0XHR9IGVsc2Uge1xuXHRcdFx0YnVmZmVyLnB1c2goZXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIHBvcCAoKSB7XG5cdFx0aWYgKHN0b3JhZ2UpIHtcblx0XHRcdGlmIChsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpIHtcblx0XHRcdFx0YnVmZmVyID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpO1xuXHRcdFx0XHRsb2NhbFN0b3JhZ2UucmVtb3ZlSXRlbSgnZXZlbnRCdWZmZXInKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJ1ZmZlciA9IFtdO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHZhciBidWZmID0gYnVmZmVyO1xuXHRcdGJ1ZmZlciA9IFtdO1xuXHRcdHJldHVybiBidWZmO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ2V0ICgpIHtcblx0XHR2YXIgYnVmZjtcblx0XHRpZiAoc3RvcmFnZSkge1xuXHRcdFx0aWYgKGxvY2FsU3RvcmFnZS5ldmVudEJ1ZmZlcikge1xuXHRcdFx0XHRidWZmID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnVmZiA9IFtdO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRidWZmID0gYnVmZmVyO1xuXHRcdH1cblx0XHRyZXR1cm4gYnVmZjtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldExlbmd0aCAoKSB7XG5cdFx0dmFyIGxlbmd0aDtcblx0XHRpZiAoc3RvcmFnZSkge1xuXHRcdFx0bGVuZ3RoID0gSlNPTi5wYXJzZShsb2NhbFN0b3JhZ2UuZXZlbnRCdWZmZXIpLmxlbmd0aDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0bGVuZ3RoID0gYnVmZmVyLmxlbmd0aDtcblx0XHR9XG5cdFx0cmV0dXJuIGxlbmd0aDtcblx0fVxuXG5cdHJldHVybiB7XG5cdFx0cHVzaDogcHVzaCxcblx0XHRwb3A6IHBvcCxcblx0XHRnZXQ6IGdldCxcblx0XHRnZXRMZW5ndGg6IGdldExlbmd0aCxcblxuXHRcdGxlbmd0aDogbGVuZ3RoXG5cdH07XG59XG5cbndpbmRvdy5zdXBlcnRyYWNrZXIgPSBzdXBlcnRyYWNrZXI7XG5cbm1vZHVsZS5leHBvcnRzID0gc3VwZXJ0cmFja2VyOyJdfQ==
