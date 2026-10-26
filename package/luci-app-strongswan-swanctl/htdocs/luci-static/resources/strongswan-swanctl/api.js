'use strict';
'require baseclass';
'require rpc';
'require ui';

const callStatus = rpc.declare({
	object: 'luci.swanctl',
	method: 'status',
	expect: {}
});

const callProfiles = rpc.declare({
	object: 'luci.swanctl',
	method: 'profiles',
	expect: {}
});

const callRead = rpc.declare({
	object: 'luci.swanctl',
	method: 'read',
	params: [ 'name' ],
	expect: {}
});

const callWrite = rpc.declare({
	object: 'luci.swanctl',
	method: 'write',
	params: [ 'name', 'content', 'activate' ],
	expect: {}
});

const callDelete = rpc.declare({
	object: 'luci.swanctl',
	method: 'delete',
	params: [ 'name' ],
	expect: {}
});

const callActivate = rpc.declare({
	object: 'luci.swanctl',
	method: 'activate',
	params: [ 'name' ],
	expect: {}
});

const callService = rpc.declare({
	object: 'luci.swanctl',
	method: 'service',
	params: [ 'action' ],
	expect: {}
});

const callLogs = rpc.declare({
	object: 'luci.swanctl',
	method: 'logs',
	params: [ 'lines' ],
	expect: {}
});

const callIsolate = rpc.declare({
	object: 'luci.swanctl',
	method: 'isolate',
	expect: {}
});

function unwrap(result) {
	if (!result || result.ok === false)
		throw new Error(result?.error || _('The request failed.'));
	return result;
}

function formatTime(seconds) {
	if (!seconds || isNaN(seconds))
		return '-';

	seconds = Math.max(0, Math.floor(seconds));
	const days = Math.floor(seconds / 86400);
	const hours = Math.floor(seconds / 3600) % 24;
	const minutes = Math.floor(seconds / 60) % 60;
	const secs = seconds % 60;
	const parts = [];

	if (days) parts.push('%d d'.format(days));
	if (hours) parts.push('%d h'.format(hours));
	if (minutes) parts.push('%d min'.format(minutes));
	if (!days && !hours) parts.push('%d s'.format(secs));

	return parts.slice(0, 3).join(' ');
}

function formatBytes(bytes) {
	if (bytes == null || isNaN(bytes))
		return '-';

	bytes = Number(bytes);
	const units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ];
	let i = 0;

	while (bytes >= 1024 && i < units.length - 1) {
		bytes /= 1024;
		i++;
	}

	return bytes.toFixed(1) + ' ' + units[i];
}

function formatDate(epoch) {
	if (!epoch)
		return '-';

	return new Date(epoch * 1000).toLocaleString();
}

function notifyError(e) {
	ui.addNotification(null, E('p', e.message || String(e)), 'warning');
}

function notifySuccess(message) {
	ui.addNotification(null, E('p', message), 'info');
}

return baseclass.extend({
	status: callStatus,
	profiles: callProfiles,
	read: callRead,
	write: callWrite,
	remove: callDelete,
	activate: callActivate,
	service: callService,
	logs: callLogs,
	isolate: callIsolate,
	unwrap: unwrap,
	formatTime: formatTime,
	formatBytes: formatBytes,
	formatDate: formatDate,
	notifyError: notifyError,
	notifySuccess: notifySuccess
});
