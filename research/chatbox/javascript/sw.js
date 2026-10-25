/* global importScripts: false, SharedWorkerGlobalScope: false */

const params = new URLSearchParams(self.location.search);
const cdn = params.get('cdn');
const branch = params.get('b');
const v = params.get('v') || params.get('_v');
const validCdn = !!(cdn && branch && v && /^[0-9a-f]{7,40}$/.test(v) && /^https:\/\/[a-z0-9.-]+$/i.test(cdn));

if (typeof SharedWorkerGlobalScope !== 'undefined' && self instanceof SharedWorkerGlobalScope) {
	const worker = params.get('w');
	const ports = [];
	const buffer = (e) => ports.push(e.ports[0]);
	self.addEventListener('connect', buffer);

	if (validCdn && /^[\w.-]+$/.test(branch) && worker && /^[\w/.-]+\.js$/.test(worker) && !worker.includes('..')) {
		import(`${cdn}/js/${branch}/${v}/js/${worker}`).then(
			() => {
				self.removeEventListener('connect', buffer);
				for (const port of ports) self.dispatchEvent(new MessageEvent('connect', { ports: [port] }));
			},
			(e) => {
				console.error('SharedWorker bootstrap import failed:', e);
				self.removeEventListener('connect', buffer);
				for (const port of ports) port.close();
			},
		);
	} else {
		console.warn('SharedWorker bootstrap: invalid params');
	}
} else {
	let scriptUrl = null;
	if (validCdn) {
		scriptUrl = `${cdn}/js/${branch}/${v}/js/lolzteam/sw.js`;
	} else if (v) {
		scriptUrl = `/js/lolzteam/sw.js?_v=${encodeURIComponent(v)}`;
	}

	if (scriptUrl) {
		try {
			importScripts(scriptUrl);
		} catch (e) {
			console.error('SW bootstrap importScripts failed:', e);
		}
	} else {
		console.warn('SW bootstrap: missing version param; SW is idle');
	}
}
