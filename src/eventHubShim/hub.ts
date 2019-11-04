import { Connector, Event } from "./connector";

export class Hub {
  name: string;
  partitionIds: string[];
  connector: Connector;
  consumer: AsyncGenerator<Event[]> | null;

  constructor(name: string, connector: Connector, partitionIds?: string[]) {
    this.name = name;
    if (partitionIds) {
      this.partitionIds = partitionIds;
    } else {
      this.partitionIds = ['0'];
    }

    this.connector = connector;
    this.consumer = null;
  }

  async publish(event: object, partition="0"): Promise<Event> {
    //console.log('Publishing', event, this.name, partition);
    return await this.connector.publishEvent(this.name, partition, event);
  }

  async publishBatch(events: object[], partition="0"): Promise<Event[]> {
    return await this.connector.publishEvents(this.name, partition, events);
  }

  consume(count = 100, consumerName: string, consumerGroup: string): AsyncGenerator<Event[]> {
    const streams = this.partitionIds.map((partition) => `${this.name}/Partitions/${partition}`);

    if (!this.consumer) {
      this.consumer = this.connector.consumeStreams(streams, consumerName, consumerGroup, count);
    }

    return this.consumer;
  }
}
