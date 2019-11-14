"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class RemoteContainerFactory {
    constructor(hubs, config) {
        this.hubs = hubs;
        this.containerInstances = {};
        this.config = config;
    }
    getContainer(id) {
        if (!(id in this.containerInstances)) {
            this.containerInstances[id] = new RemoteContainer(id, this.hubs, this.config);
        }
        return this.containerInstances[id];
    }
}
exports.RemoteContainerFactory = RemoteContainerFactory;
class RemoteContainer {
    constructor(id, hubs, config) {
        this.id = id;
        this.hubs = hubs;
        this.config = config;
        this.authenticatedAddresses = new Set();
        this.operationHandlers = {
            $cbs: {
                'put-token': (message) => this.authenticate(message),
            },
            $management: {
                READ: (message) => this.readState(message),
            },
        };
    }
    authenticate(message) {
        const sasToken = message.body;
        const sr = decodeURIComponent(sasToken.match(/SharedAccessSignature sr=([^&]*)&.*/)[1]);
        this.authenticatedAddresses.add(sr); // Authenticate anything
        return {
            application_properties: {
                'status-code': 200,
            },
            body: {},
        };
    }
    readState(message) {
        const requestType = message.application_properties.type;
        const entityName = message.application_properties.name;
        if (requestType === 'com.microsoft:eventhub') {
            const hub = this.hubs[entityName];
            return {
                application_properties: {
                    'status-code': 200,
                    name: entityName,
                    type: requestType,
                },
                body: {
                    partition_count: hub.partitionIds.length,
                    partition_ids: hub.partitionIds,
                },
            };
        }
        else {
            console.error(`Don't know how to respond to ${requestType} ${entityName}`);
            return null;
        }
    }
    authenticateEntity(address) {
        const isFullAddress = address.startsWith('sb://');
        const fullAddress = isFullAddress ? address : `sb://${this.config.hostname}/${address}`;
        if (!this.authenticatedAddresses.has(fullAddress)) {
            throw new Error(`Unauthenticated for ${fullAddress}`);
        }
    }
    consumeMessage(message, address) {
        const op = (message.application_properties || {}).operation;
        const entityName = (message.application_properties || {}).name;
        if (address in this.operationHandlers &&
            op in this.operationHandlers[address]) {
            if (address !== '$cbs') {
                this.authenticateEntity(`${entityName}/${address}`);
            }
            const handler = this.operationHandlers[address][op];
            return handler(message);
        }
        else if (message.body.typecode && message.body.typecode === 0x75) {
            const event = JSON.parse(message.body.content.toString());
            this.authenticateEntity(address);
            this.onEvent(address, event);
        }
        else {
            console.error('Unprocessed message:', message, address);
        }
        return null;
    }
    onEvent(address, event) {
        const [hubName, _partitionDir, partition] = address.split('/');
        this.hubs[hubName].publish(event, partition);
    }
    onReceiverOpen(address, sender) {
        //console.log('Receiver Open', address);
    }
    onReceiverClose(address) {
    }
    onDisconnect() {
    }
}
exports.RemoteContainer = RemoteContainer;
//# sourceMappingURL=container.js.map