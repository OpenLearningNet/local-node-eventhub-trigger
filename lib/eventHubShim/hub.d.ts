import { Connector, Event } from "./connector";
export declare class Hub {
    name: string;
    partitionIds: string[];
    connector: Connector;
    consumer: AsyncGenerator<Event[]> | null;
    constructor(name: string, connector: Connector, partitionIds?: string[]);
    publish(event: object, partition?: string): Promise<Event>;
    publishBatch(events: object[], partition?: string): Promise<Event[]>;
    consume(count: number | undefined, consumerName: string, consumerGroup: string): AsyncGenerator<Event[]>;
}
