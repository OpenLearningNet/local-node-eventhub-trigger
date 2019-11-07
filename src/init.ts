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
  console.error("Invalid Azure Functions project.", err.message);
  process.exit(1);
}

console.log('An HTTP triggered function will be added to handle EventHub triggers for local development only.');

new Promise<string>((resolve) => {
  rl.question('Name of trigger function [default: EventHubTrigger]: ', resolve);
}).then((answer): Promise<[string, string]> => {
  let funcName: string;
  if (!answer) {
    funcName = 'EventHubTrigger';
  } else {
    funcName = answer.trim();
  }

  return new Promise<[string, string]>((resolve) => {
    rl.question('Language:\n1. JavaScript\n2. TypeScript\n> ', (lang) => {
      resolve([funcName, lang]);
    });
  });
}).then(([funcName, lang]) => {
  const funcPath = path.join(initDir, funcName);

  try {
    fs.mkdirSync(funcPath);
  } catch (err) {
    console.error('Unable to create function', err.message);
    process.exit(1);
  }

  let trigPath: string;
  let codeFile: string;
  if (lang === '1') {
    trigPath = '../EventHubTrigger';
    codeFile = 'index.js';
  } else {
    trigPath = '../EventHubTriggerTs';
    codeFile = 'index.ts';
  }

  fs.copyFileSync(path.join(__dirname, trigPath, 'function.json'), path.join(funcPath, 'function.json'));
  fs.copyFileSync(path.join(__dirname, trigPath, codeFile), path.join(funcPath, 'index.js'));

  if (lang === '2') {
    const functionJsonText = fs.readFileSync(path.join(funcPath, 'function.json')).toString();
    const replacedFunctionJson = functionJsonText.replace('EventHubTriggerTs', funcName);
    fs.writeFileSync(path.join(funcPath, 'function.json'), replacedFunctionJson);
  }

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
    const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../eventhub-dev.json')).toString());
    config.triggerFunction = funcName;
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log(`Config file ${'eventhub-dev.json'} added.`);
  }

  console.log('Done.');
  process.exit();
});
