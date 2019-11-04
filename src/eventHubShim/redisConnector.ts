import Redis from 'ioredis';

import dot from 'dot-object';

import { Connector, Event } from './connector';

import { green, magenta, red } from '../colors';

type RedisTypedVal = boolean | null | number | undefined | string;

const redisType = (value: RedisTypedVal) => {
  const transform: {
    [index: string]: (val: any) => string
  } = {
    boolean: (val: boolean) => `$__bool_${val ? 'true' : 'false'}`,
    null: (_val: null) => `$__null`,
    number: (val: number) => `$__number_${val}`,
    undefined: (_val: undefined) => `$__undefined`,
    string: (val: string) => val
  };

  const t: string = typeof value;
  
  return transform[t](value);
};

const redisUntype = (value: string) => {
  const numberMatch = value.match(/^\$__number_(.+)$/);
  if (numberMatch) {
    return Number(numberMatch[1]);
  } else if (value.startsWith('$__bool_')) {
    return value === '$__bool_true';
  } else if (value === '$__null') {
    return null;
  } else if (value === '$__undefined') {
    return undefined;
  } else {
    return value;
  }
};

export class RedisConnector implements Connector {
  client: Redis.Redis;
  constructor(...args:any[]) {
    this.client = new Redis(...args);
  }

  private unflattenArrayToEvent(
    id: string,
    eventArray: ReadonlyArray<string>
  ): Event {
    const keys = eventArray.filter((_element, index) => index % 2 === 0);
    const values = eventArray.filter((_element, index) => index % 2 === 1);

    const event = keys.reduce(
      (prevEvent, key, i) => ({
        ...prevEvent,
        [key]: redisUntype(values[i]),
      }),
      {}
    );

    dot.object(event);

    return {
      id,
      ...event,
    } as Event;
  }

  private flattenEventToArray(event: Event): ReadonlyArray<string> {
    const headerData = ['eventHubName', event.eventHubName, 'partition', event.partition];
    const bodyFlattened = dot.dot(event.body);
    const bodyData = Object.keys(bodyFlattened).flatMap((key) => [
      `body.${key}`,
      redisType(bodyFlattened[key]),
    ]);

    return [...headerData, ...bodyData];
  }

  async publishEvent(
    eventHubName: string,
    partition: string,
    body: object
  ): Promise<Event> {
    const _event = {
      // id: provided by Redis
      eventHubName,
      partition,
      body,
    };

    const eventArray = this.flattenEventToArray(_event);

    const eventId = await this.client.xadd(`${eventHubName}/Partitions/${partition}`, '*', ...eventArray);

    const resultEvent = {
      id: eventId.toString(),
      ..._event,
    };

    console.log(`\n${magenta('>')} Event Published:`, resultEvent);

    return resultEvent;
  }

  async publishEvents(
    eventHubName: string,
    partition: string,
    bodies: object[]
  ): Promise<Event[]> {
    const publishedEvents = await Promise.all(
      bodies.map((body) => this.publishEvent(eventHubName, partition, body))
    );
    return publishedEvents;
  }

  async createGroups(streams: string[], consumerGroup: string): Promise<void> {
    for (const stream of streams) {
      // ensure this consumer group is created
      // start reading from the beginning
      try {
        await this.client.xgroup(
          'CREATE',
          stream,
          consumerGroup,
          0,
          'MKSTREAM'
        );
        console.log(
          `${green('!')} Consumer group ${green(
            consumerGroup
          )} created on stream ${green(stream)}.`
        );
      } catch (err) {
        if (err.message.startsWith('BUSYGROUP')) {
          console.log(
            `${green('!')} Consumer group ${green(
              consumerGroup
            )} exists on stream ${green(stream)}.`
          );
        } else {
          console.error(err);
        }
      }
    }
  }

  async *consumeStreams(
    streams: string[],
    consumerName: string,
    consumerGroup: string,
    count: number,
    blockMs = 5000
  ): AsyncGenerator<Event[]> {
    this.createGroups(streams, consumerGroup);
    console.log(
      `${green('!')} Consuming on:`,
      streams,
      'with Consumer Group:',
      green(consumerGroup)
    );

    const startInterval = 10000;
    let timeOfLastEvent: number | null = null;
    let lastCheckin: number = Date.now();
    let checkinInterval = startInterval;

    while (true) {
      const now = Date.now();
      if (now - lastCheckin > checkinInterval) {
        console.log(
          `${green('!')} Time since last event:`,
          timeOfLastEvent
            ? `${new Date(now - timeOfLastEvent).toISOString().substr(11, 8)}`
            : 'never'
        );
        lastCheckin = now;
        checkinInterval = checkinInterval * 1.5;
      }

      const streamVals = [...streams, ...streams.map((_streamName) => '>')];

      // console.log(`XREADGROUP GROUP ${consumerGroup} ${consumerName} BLOCK ${blockMs.toString()} COUNT ${count.toString()} STREAMS ${streamVals.join(' ')}`);

      let reply = null;
      try {
        reply = await this.client.xreadgroup(
          'GROUP',
          consumerGroup,
          consumerName,
          'BLOCK',
          blockMs.toString(),
          'COUNT',
          count.toString(),
          'STREAMS',
          ...streamVals
        );
      } catch (err) {
        if (err.message.startsWith('NOGROUP')) {
          console.log(`${green('!')} Consumer Groups have been removed.`);
          await this.createGroups(streams, consumerGroup);
        } else {
          console.error(red('Unable to Read Stream:'), err.message);
        }
      }

      if (!reply) {
        continue;
      }

      timeOfLastEvent = Date.now();
      checkinInterval = startInterval;

      for (const streamResult of reply as any[]) {
        const [_topic, events] = streamResult;
        const { length } = events;

        if (!length) {
          continue;
        }

        yield events.map(([id, values]: [string, string[]]) =>
          this.unflattenArrayToEvent(id, values)
        );
      }
    }
  }
}
