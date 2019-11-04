"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fbBlack = '\x1b[30m';
const fgRed = '\x1b[31m';
const fgGreen = '\x1b[32m';
const fgYellow = '\x1b[33m';
const fgBlue = '\x1b[34m';
const fgMagenta = '\x1b[35m';
const fgCyan = '\x1b[36m';
const fgWhite = '\x1b[37m';
exports.black = (str) => `${fbBlack}${str}\x1b[0m`;
exports.red = (str) => `${fgRed}${str}\x1b[0m`;
exports.green = (str) => `${fgGreen}${str}\x1b[0m`;
exports.yellow = (str) => `${fgYellow}${str}\x1b[0m`;
exports.blue = (str) => `${fgBlue}${str}\x1b[0m`;
exports.magenta = (str) => `${fgMagenta}${str}\x1b[0m`;
exports.cyan = (str) => `${fgCyan}${str}\x1b[0m`;
exports.white = (str) => `${fgWhite}${str}\x1b[0m`;
//# sourceMappingURL=colors.js.map