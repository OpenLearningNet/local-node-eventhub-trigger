#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { green } from './colors';

const rl = readline.createInterface(process.stdin, process.stdout);

const initDir = process.env.INIT_CWD || '';

try {
  const hostJson = JSON.parse(fs.readFileSync(path.join(initDir, 'host.json')).toString());
  if (hostJson.version !== '2.0') {
    throw new Error('Version 2.0 is required');
  }
} catch (err) {
  console.error("Invalid Azure Functions project.", err);
  process.exit(1);
}

console.log('An HTTP triggered function will be added to handle EventHub triggers for local development only.');
rl.question('Name of trigger function [default: EventHubTrigger]: ', (answer) => {
  let funcName;
  if (!answer) {
    funcName = 'EventHubTrigger';
  } else {
    funcName = answer.trim();
  }

  const funcPath = path.join(initDir, funcName);

  try {
    fs.mkdirSync(funcPath);
  } catch (err) {
    console.error('Unable to create function', err);
    process.exit(1);
  }

  fs.copyFileSync(path.join(__dirname, '../EventHubTrigger', 'function.json'), path.join(funcPath, 'function.json'));
  fs.copyFileSync(path.join(__dirname, '../EventHubTrigger', 'index.js'), path.join(funcPath, 'index.js'));
  console.log('Function', funcName, 'added.');

  const funcignorePath = path.join(initDir, '.funcignore');
  const funcignore = new Set(fs.readFileSync(funcignorePath).toString().split(/\n|\r/));
  if (funcignore.has(funcName)) {
    console.error('.funcignore already contains', funcName);
  } else {
    fs.appendFileSync(funcignorePath, funcName);
    console.log(funcName, 'added to .funcignore (used only for development)');
  }

  const configPath = path.join(initDir, 'eventhub-dev.json');
  if (fs.existsSync(configPath)) {
    console.error(`${green('eventhub-dev.json')} already exists.`);
  } else {
    fs.copyFileSync(path.join(__dirname, '../eventhub-dev.json'), configPath);
    console.log(`Config file ${'eventhub-dev.json'} added.`);
  }

  console.log('Done.');
});
