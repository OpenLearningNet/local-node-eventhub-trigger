#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const readline_1 = __importDefault(require("readline"));
const ioredis_1 = __importDefault(require("ioredis"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const rl = readline_1.default.createInterface(process.stdin, process.stdout);
const initDir = process.env.INIT_CWD || '';
// Open the config file
let config;
try {
    config = JSON.parse(fs_1.default.readFileSync(path_1.default.join(initDir, 'eventhub-dev.json')).toString());
}
catch (err) {
    console.error(`Unable to read 'eventhub-dev.json' at ${initDir}`, err);
    process.exit();
}
const streams = config.eventHubs.flatMap((eventHub) => eventHub.partitionIds.map((partitionId) => `${eventHub.name}/Partitions/${partitionId}`));
const groups = config.consumerGroups || ["$Default"];
// Confirmation
const canContinue = async () => new Promise((resolve) => {
    rl.question(`This will remove consumer groups ${groups} from streams ${streams}.\nDo you want to continue? (y/n) `, (answer) => {
        if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
            resolve(true);
        }
        else {
            resolve(false);
        }
    });
});
(async () => {
    if (!await canContinue()) {
        process.exit();
    }
    const redis = new ioredis_1.default();
    for (const stream of streams) {
        for (const group of groups) {
            try {
                await redis.xgroup('DESTROY', stream, group);
                console.log('Removed Group', stream, group);
            }
            catch (err) {
                console.error(err.message);
            }
        }
    }
    process.exit();
})();
//# sourceMappingURL=replay.js.map