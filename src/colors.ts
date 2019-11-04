const fbBlack = '\x1b[30m';
const fgRed = '\x1b[31m';
const fgGreen = '\x1b[32m';
const fgYellow = '\x1b[33m';
const fgBlue = '\x1b[34m';
const fgMagenta = '\x1b[35m';
const fgCyan = '\x1b[36m';
const fgWhite = '\x1b[37m';

export const black = (str: string) => `${fbBlack}${str}\x1b[0m`;
export const red = (str: string) => `${fgRed}${str}\x1b[0m`;
export const green = (str: string) => `${fgGreen}${str}\x1b[0m`;
export const yellow = (str: string) => `${fgYellow}${str}\x1b[0m`;
export const blue = (str: string) => `${fgBlue}${str}\x1b[0m`;
export const magenta = (str: string) => `${fgMagenta}${str}\x1b[0m`;
export const cyan = (str: string) => `${fgCyan}${str}\x1b[0m`;
export const white = (str: string) => `${fgWhite}${str}\x1b[0m`;
