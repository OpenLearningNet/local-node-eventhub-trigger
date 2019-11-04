export interface Event {
    id?: string;
    eventHubName: string;
    partition: string;
    body: object;
}
export interface Connector {
    publishEvent(eventHubName: string, partition: string, body: object): Promise<Event>;
    publishEvents(eventHubName: string, partition: string, bodies: object[]): Promise<Event[]>;
    consumeStreams(streams: string[], consumerName: string, consumerGroup: string, count: number, blockMs?: number): AsyncGenerator<Event[]>;
}
