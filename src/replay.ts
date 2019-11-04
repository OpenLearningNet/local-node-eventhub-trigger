#!/usr/bin/env node
import readline from 'readline';
import Redis from 'ioredis';
import fs from 'fs';
import path from 'path';

import { Config } from './eventHubShim/config';

const rl = readline.createInterface(process.stdin, process.stdout);

const initDir = process.env.INIT_CWD || '';

// Open the config file
let config: Config;
try {
  config = JSON.parse(
    fs.readFileSync(path.join(initDir, 'eventhub-dev.json')).toString()
  );
} catch (err) {
  console.error(`Unable to read 'eventhub-dev.json' at ${initDir}`, err);
  process.exit();
}

const streams = config!.eventHubs.flatMap((eventHub) =>
  eventHub.partitionIds.map(
    (partitionId) => `${eventHub.name}/Partitions/${partitionId}`
  )
);
const groups = config!.consumerGroups || ["$Default"];

// Confirmation
const canContinue = async () => new Promise((resolve) => {
  rl.question(`This will remove consumer groups ${groups} from streams ${streams}.\nDo you want to continue? (y/n) `, (answer) => {
    if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
      resolve(true);
    } else {
      resolve(false);
    }
  });
});

(async () => {
  if (!await canContinue()) {
    process.exit();
  }


  const redis = new Redis();

  for (const stream of streams) {
    for (const group of groups) {
      try {
        await redis.xgroup('DESTROY', stream, group);
        console.log('Removed Group', stream, group);
      } catch (err) {
        console.error(err.message);
      }
    }
  }

  process.exit();
})();
