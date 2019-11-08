"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ioredis_1 = __importDefault(require("ioredis"));
const dot_object_1 = __importDefault(require("dot-object"));
const colors_1 = require("../colors");
const redisType = (value) => {
    const transform = {
        boolean: (val) => `$__bool_${val ? 'true' : 'false'}`,
        null: (_val) => `$__null`,
        number: (val) => `$__number_${val}`,
        undefined: (_val) => `$__undefined`,
        string: (val) => val
    };
    const t = typeof value;
    return transform[t](value);
};
const redisUntype = (value) => {
    const numberMatch = value.match(/^\$__number_(.+)$/);
    if (numberMatch) {
        return Number(numberMatch[1]);
    }
    else if (value.startsWith('$__bool_')) {
        return value === '$__bool_true';
    }
    else if (value === '$__null') {
        return null;
    }
    else if (value === '$__undefined') {
        return undefined;
    }
    else {
        return value;
    }
};
class RedisConnector {
    constructor(...args) {
        this.client = new ioredis_1.default(...args);
    }
    unflattenArrayToEvent(id, eventArray) {
        const keys = eventArray.filter((_element, index) => index % 2 === 0);
        const values = eventArray.filter((_element, index) => index % 2 === 1);
        const event = keys.reduce((prevEvent, key, i) => ({
            ...prevEvent,
            [key]: redisUntype(values[i]),
        }), {});
        dot_object_1.default.object(event);
        return {
            id,
            ...event,
        };
    }
    flattenEventToArray(event) {
        const headerData = ['eventHubName', event.eventHubName, 'partition', event.partition];
        const bodyFlattened = dot_object_1.default.dot(event.body);
        const bodyData = Object.keys(bodyFlattened).flatMap((key) => [
            `body.${key}`,
            redisType(bodyFlattened[key]),
        ]);
        return [...headerData, ...bodyData];
    }
    async publishEvent(eventHubName, partition, body) {
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
        console.log(`\n${colors_1.magenta('>')} Event Published:`, resultEvent);
        return resultEvent;
    }
    async publishEvents(eventHubName, partition, bodies) {
        const publishedEvents = await Promise.all(bodies.map((body) => this.publishEvent(eventHubName, partition, body)));
        return publishedEvents;
    }
    async createGroups(streams, consumerGroup) {
        for (const stream of streams) {
            // ensure this consumer group is created
            // start reading from the beginning
            try {
                await this.client.xgroup('CREATE', stream, consumerGroup, 0, 'MKSTREAM');
                console.log(`${colors_1.green('!')} Consumer group ${colors_1.green(consumerGroup)} created on stream ${colors_1.green(stream)}.`);
            }
            catch (err) {
                if (err.message.startsWith('BUSYGROUP')) {
                    console.log(`${colors_1.green('!')} Consumer group ${colors_1.green(consumerGroup)} exists on stream ${colors_1.green(stream)}.`);
                }
                else {
                    console.error(err);
                }
            }
        }
    }
    async *consumeStreams(streams, consumerName, consumerGroup, count, blockMs = 5000) {
        this.createGroups(streams, consumerGroup);
        console.log(`${colors_1.green('!')} Consuming on:`, streams, 'with Consumer Group:', colors_1.green(consumerGroup));
        const startInterval = 10000;
        let timeOfLastEvent = null;
        let lastCheckin = Date.now();
        let checkinInterval = startInterval;
        while (true) {
            const now = Date.now();
            if (now - lastCheckin > checkinInterval) {
                console.log(`${colors_1.green('!')} Time since last event:`, timeOfLastEvent
                    ? `${new Date(now - timeOfLastEvent).toISOString().substr(11, 8)}`
                    : 'never');
                lastCheckin = now;
                checkinInterval = checkinInterval * 1.5;
            }
            const streamVals = [...streams, ...streams.map((_streamName) => '>')];
            // console.log(`XREADGROUP GROUP ${consumerGroup} ${consumerName} BLOCK ${blockMs.toString()} COUNT ${count.toString()} STREAMS ${streamVals.join(' ')}`);
            let reply = null;
            try {
                reply = await this.client.xreadgroup('GROUP', consumerGroup, consumerName, 'BLOCK', blockMs.toString(), 'COUNT', count.toString(), 'STREAMS', ...streamVals);
            }
            catch (err) {
                if (err.message.startsWith('NOGROUP')) {
                    console.log(`${colors_1.green('!')} Consumer Groups have been removed.`);
                    await this.createGroups(streams, consumerGroup);
                }
                else {
                    console.error(colors_1.red('Unable to Read Stream:'), err.message);
                }
            }
            if (!reply) {
                continue;
            }
            timeOfLastEvent = Date.now();
            checkinInterval = startInterval;
            for (const streamResult of reply) {
                const [_topic, events] = streamResult;
                const { length } = events;
                if (!length) {
                    continue;
                }
                yield events.map(([id, values]) => this.unflattenArrayToEvent(id, values));
            }
        }
    }
}
exports.RedisConnector = RedisConnector;
//# sourceMappingURL=redisConnector.js.map