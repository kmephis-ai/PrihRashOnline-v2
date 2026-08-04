const fs = require('fs');
const assert = require('assert');

const shell = fs.readFileSync('DashboardShellService.js', 'utf8');
const menu = fs.readFileSync('ApplicationMenuService.js', 'utf8');
const modes = fs.readFileSync('DashboardModeService.js', 'utf8');

assert(shell.includes("VERSION: '2.0.0'"), 'Shell version must be 2.0.0');
assert(shell.includes("SHELL_RANGE: 'A1:T9'"), 'Shell must be limited to A1:T9');
assert(shell.includes('setFrozenRows(9)'), 'Shell must freeze nine header rows');
assert(shell.includes('setHiddenGridlines(true)'), 'Shell must hide gridlines');
assert(shell.includes('prhAssertDashboardShellPeriod_'), 'Shell must protect year and month');
assert(shell.includes('PRH_DASHBOARD_SHELL.NAV_ITEMS.length'), 'Shell must validate navigation');
assert(!shell.includes("getSheetByName('01 Операции')"), 'Shell must not access 01 Операции');
assert(!shell.includes('.clear('), 'Shell must not clear workbook content');
assert(!shell.includes('.delete'), 'Shell must not delete workbook structures');

const navRanges = ['A4:B4','C4:D4','E4:F4','G4:H4','I4:J4','K4:L4','M4:N4','O4:P4','Q4:R4','S4:T4'];
navRanges.forEach(range => assert(shell.includes(`range: '${range}'`), `Missing navigation range ${range}`));

assert(menu.includes('prhRestoreDashboardShell'), 'onOpen must restore Shell 2.0');
assert(menu.includes('prhHandleDashboardShellEdit'), 'onEdit must refresh shell navigation state');
assert(menu.includes('prhInstallDashboardShell'), 'Settings menu must expose shell installation');
assert(modes.includes("PropertiesService.getUserProperties().setProperty('prh.dashboard.mode'"), 'Mode service must persist user mode');

console.log('Dashboard Shell 2.0 contract: PASS');
