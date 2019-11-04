#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const readline_1 = __importDefault(require("readline"));
const colors_1 = require("./colors");
const rl = readline_1.default.createInterface(process.stdin, process.stdout);
const initDir = process.env.INIT_CWD || '';
try {
    const hostJson = JSON.parse(fs_1.default.readFileSync(path_1.default.join(initDir, 'host.json')).toString());
    if (hostJson.version !== '2.0') {
        throw new Error('Version 2.0 is required');
    }
}
catch (err) {
    console.error("Invalid Azure Functions project.", err.message);
    process.exit(1);
}
console.log('An HTTP triggered function will be added to handle EventHub triggers for local development only.');
rl.question('Name of trigger function [default: EventHubTrigger]: ', (answer) => {
    let funcName;
    if (!answer) {
        funcName = 'EventHubTrigger';
    }
    else {
        funcName = answer.trim();
    }
    const funcPath = path_1.default.join(initDir, funcName);
    try {
        fs_1.default.mkdirSync(funcPath);
    }
    catch (err) {
        console.error('Unable to create function', err.message);
        process.exit(1);
    }
    fs_1.default.copyFileSync(path_1.default.join(__dirname, '../EventHubTrigger', 'function.json'), path_1.default.join(funcPath, 'function.json'));
    fs_1.default.copyFileSync(path_1.default.join(__dirname, '../EventHubTrigger', 'index.js'), path_1.default.join(funcPath, 'index.js'));
    console.log('Function', funcName, 'added.');
    const funcignorePath = path_1.default.join(initDir, '.funcignore');
    const funcignore = new Set(fs_1.default.readFileSync(funcignorePath).toString().split(/\n|\r/));
    if (funcignore.has(funcName)) {
        console.error('.funcignore already contains', funcName);
    }
    else {
        fs_1.default.appendFileSync(funcignorePath, funcName);
        console.log(funcName, 'added to .funcignore (used only for development)');
    }
    const configPath = path_1.default.join(initDir, 'eventhub-dev.json');
    if (fs_1.default.existsSync(configPath)) {
        console.error(`${colors_1.green('eventhub-dev.json')} already exists.`);
    }
    else {
        const config = JSON.parse(fs_1.default.readFileSync(path_1.default.join(__dirname, '../eventhub-dev.json')).toString());
        config.triggerFunction = funcName;
        fs_1.default.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log(`Config file ${'eventhub-dev.json'} added.`);
    }
    console.log('Done.');
});
//# sourceMappingURL=init.js.map