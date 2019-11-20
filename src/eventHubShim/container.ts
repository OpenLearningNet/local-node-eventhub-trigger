import { Message, Sender, message as amqpMessage } from 'rhea';
import { Hub } from './hub';
import { Config } from './config';
import { decode } from 'punycode';

interface HubCollection {
  [name: string]: Hub;
}

export class RemoteContainerFactory {
  hubs: HubCollection;
  containerInstances: {
    [id: string]: RemoteContainer;
  };
  config: Config;
  constructor(hubs: HubCollection, config: Config) {
    this.hubs = hubs;
    this.containerInstances = {};
    this.config = config;
  }

  getContainer(id: string): RemoteContainer {
    if (!(id in this.containerInstances)) {
      this.containerInstances[id] = new RemoteContainer(id, this.hubs, this.config);
    }
    return this.containerInstances[id];
  }
}

export class RemoteContainer {
  id: string;
  operationHandlers: {
    [address: string]: {
      [op: string]: (message: Message) => Message | null;
    };
  };
  hubs: HubCollection;
  authenticatedAddresses: Set<string>;
  config: Config;

  constructor(id: string, hubs: HubCollection, config: Config) {
    this.id = id;
    this.hubs = hubs;
    this.config = config;
    this.authenticatedAddresses = new Set<string>();

    this.operationHandlers = {
      $cbs: {
        'put-token': (message) => this.authenticate(message),
      },
      $management: {
        READ: (message) => this.readState(message),
      },
    };
  }

  authenticate(message: Message): Message {
    const sasToken = message.body;
    const sr = decodeURIComponent(
      sasToken.match(/SharedAccessSignature sr=([^&]*)&.*/)[1]
    );

    this.authenticatedAddresses.add(sr); // Authenticate anything

    return {
      application_properties: {
        'status-code': 200,
      },
      body: {},
    };
  }

  readState(message: Message): Message | null {
    const requestType = message.application_properties!.type;
    const entityName = message.application_properties!.name;

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
    } else {
      console.error(`Don't know how to respond to ${requestType} ${entityName}`);
      return null;
    }
  }

  authenticateEntity(address: string) {
    const isFullAddress = address.startsWith('sb://');

    const fullAddress = isFullAddress ? address : `sb://${this.config.hostname}/${address}`;
    if (!this.authenticatedAddresses.has(fullAddress)) {
      throw new Error(`Unauthenticated for ${fullAddress}`);
    }
  }

  consumeMessage(message: Message, address: string): Message | null {
    const op = (message.application_properties || {}).operation;
    const entityName = (message.application_properties || {}).name;
    if (
      address in this.operationHandlers &&
      op in this.operationHandlers[address]
    ) {
      if (address !== '$cbs') {
        this.authenticateEntity(`${entityName}/${address}`);
      }

      const handler = this.operationHandlers[address][op];
      return handler(message);
    } else if (message.body && message.body.typecode && message.body.typecode === 0x75) {
      const event = JSON.parse(message.body.content.toString());

      this.authenticateEntity(address);
      this.onEvent(address, event);
    } else {
      try {
        const decodedMessage = amqpMessage.decode(message as any);
        console.log(decodedMessage, address, decodedMessage.body);

        if (decodedMessage.body.typecode !== 0x75) {
          throw new Error("Unknown Message");
        }

        const batchMessages = decodedMessage.body.content;

        const events = Array.isArray(batchMessages) ? batchMessages : [batchMessages];

        const eventsDecoded = events.map(amqpMessage.decode);

        eventsDecoded.forEach((event) => {
          const eventBody = JSON.parse(event.body.content.toString());
          this.onEvent(address, eventBody);
        });
      } catch (err) {
        console.error(err.message, message, address);
      }
    }

    return null;
  }

  onEvent(address: string, event: object) {
    const [hubName, _partitionDir, partition] = address.split('/');
    this.hubs[hubName].publish(event, partition);
  }

  onReceiverOpen(address: string, sender: Sender): void {
    //console.log('Receiver Open', address);
  }

  onReceiverClose(address: string): void {
  }

  onDisconnect(): void {
  }
}
