#!/usr/bin/env node
import 'source-map-support/register';
import 'core-js/stable';
import 'regenerator-runtime/runtime';

import _container from 'rhea';
import fs from 'fs';
import path from 'path';
import selfsigned from 'selfsigned';

import { Hub } from './eventHubShim/hub';
import { RemoteContainerFactory } from './eventHubShim/container';
import { RedisConnector } from './eventHubShim/redisConnector';
import { triggerFunction } from './eventHubShim/triggerFuncs';

import { red, green, yellow, cyan } from './colors';
import { Config } from './eventHubShim/config';

const initDir = process.env.INIT_CWD || '';

const defaultAmqpPort = 5671;

const container = _container as any;

// Open the config file
let _config: Config | null = null;
try {
  _config = JSON.parse(
    fs.readFileSync(path.join(initDir, 'eventhub-dev.json')).toString()
  );
} catch (err) {
  console.error(
    `${red('Error: Unable to read')} ${cyan(
      path.join(initDir, 'eventhub-dev.json')
    )}`
  );
  process.exit();
}

const config = _config as Config;

const environment = process.env.NODE_ENV || 'development';
if (environment !== 'development') {
  console.warn(
    yellow(
      'Warning: This is a development tool and should not be used in a production setting.'
    )
  );
}

// Generate Certificates (if required)
if (!config.cert || !config.key || !config.ca) {
  const certsDir = path.join(initDir, config.certificatesPath || '.certs');
  const keyPath = path.join(certsDir, 'key.pem');
  const certPath = path.join(certsDir, 'cert.crt');

  try {
    config.key = fs.readFileSync(keyPath).toString();
    config.cert = fs.readFileSync(certPath).toString();
  } catch (err) {
    const generated = selfsigned.generate();
    config.key = generated.private;
    config.cert = generated.cert;
    if (!fs.existsSync(certsDir)) {
      fs.mkdirSync(certsDir);
    }
    fs.writeFileSync(keyPath, config.key);
    fs.writeFileSync(certPath, config.cert);

    console.log(
      cyan(
        `New TLS Keys/Certificates have been generated at ${path.join(
          initDir,
          certsDir
        )}.`
      )
    );
  }
}

// Set default hostname to localhost
if (!config.hostname) {
  config.hostname = 'localhost';
}
if (!config.functionHostname) {
  config.functionHostname = 'localhost';
}

console.log(green('Starting EventHub Local Development Runtime for NodeJS'));
console.log(
  'Ensure that your local.settings.json configuration specifies the Values:'
);
console.log('  "FUNCTIONS_WORKER_RUNTIME": "node"');
console.log('  "NODE_TLS_REJECT_UNAUTHORIZED": "0"');
console.log('');
console.log(
  `Ensure that there is an HTTP Triggered function called ${green(
    config.triggerFunction
  )} which exports ${cyan('eventHubHttpTrigger()')}`
);
console.log('');

// Connect to redis
const redisConnector = new RedisConnector({
  port: config.redisPort || 6379,
  host: config.redisHostname || "localhost"
});

// Initialise an EventHub
if (!config.eventHubs) {
  console.error('Error: No EventHubs defined in eventhub-dev.json');
}
const hubs = config.eventHubs.reduce((hubLookup: { [name: string]: Hub }, hubConfig) => {
  hubLookup[hubConfig.name] = new Hub(
    hubConfig.name,
    redisConnector,
    hubConfig.partitionIds
  );
  return hubLookup;
}, {});

const containerFactory = new RemoteContainerFactory(hubs, config);

// Allow all SASL mechanisms
interface Sasl {
  outcome: any
  username: any
};

const MssbcbsServer = function(this: Sasl) {
  // Not sure how to handle MSSBCBS
  this.outcome = undefined;
  this.username = undefined;
} as any as { new (): Sasl};

MssbcbsServer.prototype.start = function() {
  this.outcome = true;
  this.username = 'anonymous';
};
container.sasl_server_mechanisms['MSSBCBS'] = function() {
  return new MssbcbsServer();
};
container.sasl_server_mechanisms.enable_plain((user: any, pass: any) => true);
container.sasl_server_mechanisms.enable_anonymous();

// Event handlers
container.on('connection_open', (context: any) => {
  const remoteConnection = context.connection.remote.open;
  const containerId =
    remoteConnection && context.connection.remote.open.container_id;

  console.log(`${green('*')} Connection Open:`, context.connection.options.id);
  console.log(`${green('*')} New remote container`, containerId);
});

container.on('disconnected', (context: any) => {
  console.log(
    `${green('*')} Connection Closed:`,
    context.connection.options.id
  );
  const remoteConnection = context.connection.remote.open;
  const containerId =
    remoteConnection && context.connection.remote.open.container_id;
  if (containerId) {
    const remote = containerFactory.getContainer(containerId);
    remote.onDisconnect();
    console.log(`${green('*')} Disconnected remote container`, containerId);
  }
});

/*
container.on('sender_open', (context) => {
  const containerId = context.connection.remote.open.container_id;
  console.log('Sender Open on', containerId);
});
*/

container.on('receiver_open', (context: any) => {
  const address = context.receiver.remote.attach.target.address;
  const containerId = context.connection.remote.open.container_id;
  const name = context.receiver.remote.attach.name;
  const sender = context.session.links[name];

  const remote = containerFactory.getContainer(containerId);
  remote.onReceiverOpen(address, sender);
});

container.on('receiver_close', (context: any) => {
  const address = context.receiver.remote.attach.target.address;
  const containerId = context.connection.remote.open.container_id;

  const remote = containerFactory.getContainer(containerId);
  remote.onReceiverClose(address);
});

container.on('message', (context: any) => {
  const message = context.message;
  const replyTo = message.reply_to;
  const containerId = context.connection.remote.open.container_id;
  const address = context.receiver.remote.attach.target.address;

  const remote = containerFactory.getContainer(containerId);
  const response = remote.consumeMessage(message, address);

  if (response) {
    response.to = replyTo;
    const links = context.session.links;
    const sender = links[replyTo];
    sender.send(response);
  }
});

// Run server
const listener = container.listen({
  port: config.port || defaultAmqpPort,
  transport: 'tls',
  enable_sasl_external: true,
  key: config.key,
  cert: config.cert,
  requestCert: true,
  rejectUnauthorized: false,
});
listener.on('clientError', function(error: any) {
  console.error('Client Error', error);
});

console.log(green(`AMQP Server started on ${config.port || defaultAmqpPort}.`));
console.log('Ensure that EventHub events are sent to the connection string:');
console.log(
  `  Endpoint=sb://${config.hostname};SharedAccessKeyName=name;SharedAccessKey=key`
);
console.log('and EventHub triggers do not have a connection string.');
console.log('');

const consumerGroups = config.consumerGroups || ['$Default'];
console.log(green('Listening for EventHub Triggers...'));
Promise.all(
  Object.keys(hubs).map((hubName) => {
    consumerGroups.forEach((consumerGroup) =>
      triggerFunction(config, hubs[hubName], consumerGroup)
    );
  })
);
