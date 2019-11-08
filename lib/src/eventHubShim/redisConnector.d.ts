import Redis from 'ioredis';
import { Connector, Event } from './connector';
export declare class RedisConnector implements Connector {
    client: Redis.Redis;
    constructor(...args: any[]);
    private unflattenArrayToEvent;
    private flattenEventToArray;
    publishEvent(eventHubName: string, partition: string, body: object): Promise<Event>;
    publishEvents(eventHubName: string, partition: string, bodies: object[]): Promise<Event[]>;
    createGroups(streams: string[], consumerGroup: string): Promise<void>;
    consumeStreams(streams: string[], consumerName: string, consumerGroup: string, count: number, blockMs?: number): AsyncGenerator<Event[]>;
}
