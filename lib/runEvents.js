#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register");
require("core-js/stable");
require("regenerator-runtime/runtime");
const rhea_1 = __importDefault(require("rhea"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const selfsigned_1 = __importDefault(require("selfsigned"));
const hub_1 = require("./eventHubShim/hub");
const container_1 = require("./eventHubShim/container");
const redisConnector_1 = require("./eventHubShim/redisConnector");
const triggerFuncs_1 = require("./eventHubShim/triggerFuncs");
const colors_1 = require("./colors");
const initDir = process.env.INIT_CWD || '';
const defaultAmqpPort = 5671;
const container = rhea_1.default;
// Open the config file
let _config = null;
try {
    _config = JSON.parse(fs_1.default.readFileSync(path_1.default.join(initDir, 'eventhub-dev.json')).toString());
}
catch (err) {
    console.error(`${colors_1.red('Error: Unable to read')} ${colors_1.cyan(path_1.default.join(initDir, 'eventhub-dev.json'))}`);
    process.exit();
}
const config = _config;
const environment = process.env.NODE_ENV || 'development';
if (environment !== 'development') {
    console.warn(colors_1.yellow('Warning: This is a development tool and should not be used in a production setting.'));
}
// Generate Certificates (if required)
if (!config.cert || !config.key || !config.ca) {
    const certsDir = path_1.default.join(initDir, config.certificatesPath || '.certs');
    const keyPath = path_1.default.join(certsDir, 'key.pem');
    const certPath = path_1.default.join(certsDir, 'cert.crt');
    try {
        config.key = fs_1.default.readFileSync(keyPath).toString();
        config.cert = fs_1.default.readFileSync(certPath).toString();
    }
    catch (err) {
        const generated = selfsigned_1.default.generate();
        config.key = generated.private;
        config.cert = generated.cert;
        if (!fs_1.default.existsSync(certsDir)) {
            fs_1.default.mkdirSync(certsDir);
        }
        fs_1.default.writeFileSync(keyPath, config.key);
        fs_1.default.writeFileSync(certPath, config.cert);
        console.log(colors_1.cyan(`New TLS Keys/Certificates have been generated at ${path_1.default.join(initDir, certsDir)}.`));
    }
}
// Set default hostname to localhost
if (!config.hostname) {
    config.hostname = 'localhost';
}
if (!config.functionHostname) {
    config.functionHostname = 'localhost';
}
console.log(colors_1.green('Starting EventHub Local Development Runtime for NodeJS'));
console.log('Ensure that your local.settings.json configuration specifies the Values:');
console.log('  "FUNCTIONS_WORKER_RUNTIME": "node"');
console.log('  "NODE_TLS_REJECT_UNAUTHORIZED": "0"');
console.log('');
console.log(`Ensure that there is an HTTP Triggered function called ${colors_1.green(config.triggerFunction)} which exports ${colors_1.cyan('eventHubHttpTrigger()')}`);
console.log('');
// Connect to redis
const redisConnector = new redisConnector_1.RedisConnector();
// Initialise an EventHub
if (!config.eventHubs) {
    console.error('Error: No EventHubs defined in eventhub-dev.json');
}
const hubs = config.eventHubs.reduce((hubLookup, hubConfig) => {
    hubLookup[hubConfig.name] = new hub_1.Hub(hubConfig.name, redisConnector, hubConfig.partitionIds);
    return hubLookup;
}, {});
const containerFactory = new container_1.RemoteContainerFactory(hubs, config);
;
const MssbcbsServer = function () {
    // Not sure how to handle MSSBCBS
    this.outcome = undefined;
    this.username = undefined;
};
MssbcbsServer.prototype.start = function () {
    this.outcome = true;
    this.username = 'anonymous';
};
container.sasl_server_mechanisms['MSSBCBS'] = function () {
    return new MssbcbsServer();
};
container.sasl_server_mechanisms.enable_plain((user, pass) => true);
container.sasl_server_mechanisms.enable_anonymous();
// Event handlers
container.on('connection_open', (context) => {
    const remoteConnection = context.connection.remote.open;
    const containerId = remoteConnection && context.connection.remote.open.container_id;
    console.log(`${colors_1.green('*')} Connection Open:`, context.connection.options.id);
    console.log(`${colors_1.green('*')} New remote container`, containerId);
});
container.on('disconnected', (context) => {
    console.log(`${colors_1.green('*')} Connection Closed:`, context.connection.options.id);
    const remoteConnection = context.connection.remote.open;
    const containerId = remoteConnection && context.connection.remote.open.container_id;
    if (containerId) {
        const remote = containerFactory.getContainer(containerId);
        remote.onDisconnect();
        console.log(`${colors_1.green('*')} Disconnected remote container`, containerId);
    }
});
/*
container.on('sender_open', (context) => {
  const containerId = context.connection.remote.open.container_id;
  console.log('Sender Open on', containerId);
});
*/
container.on('receiver_open', (context) => {
    const address = context.receiver.remote.attach.target.address;
    const containerId = context.connection.remote.open.container_id;
    const name = context.receiver.remote.attach.name;
    const sender = context.session.links[name];
    const remote = containerFactory.getContainer(containerId);
    remote.onReceiverOpen(address, sender);
});
container.on('receiver_close', (context) => {
    const address = context.receiver.remote.attach.target.address;
    const containerId = context.connection.remote.open.container_id;
    const remote = containerFactory.getContainer(containerId);
    remote.onReceiverClose(address);
});
container.on('message', (context) => {
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
listener.on('clientError', function (error) {
    console.error('Client Error', error);
});
console.log(colors_1.green(`AMQP Server started on ${config.port || defaultAmqpPort}.`));
console.log('Ensure that EventHub events are sent to the connection string:');
console.log(`  Endpoint=sb://${config.hostname};SharedAccessKeyName=name;SharedAccessKey=key`);
console.log('and EventHub triggers do not have a connection string.');
console.log('');
const consumerGroups = config.consumerGroups || ['$Default'];
console.log(colors_1.green('Listening for EventHub Triggers...'));
Promise.all(Object.keys(hubs).map((hubName) => {
    consumerGroups.forEach((consumerGroup) => triggerFuncs_1.triggerFunction(config, hubs[hubName], consumerGroup));
}));
//# sourceMappingURL=runEvents.js.map