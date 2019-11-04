"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Hub {
    constructor(name, connector, partitionIds) {
        this.name = name;
        if (partitionIds) {
            this.partitionIds = partitionIds;
        }
        else {
            this.partitionIds = ['0'];
        }
        this.connector = connector;
        this.consumer = null;
    }
    async publish(event, partition = "0") {
        //console.log('Publishing', event, this.name, partition);
        return await this.connector.publishEvent(this.name, partition, event);
    }
    async publishBatch(events, partition = "0") {
        return await this.connector.publishEvents(this.name, partition, events);
    }
    consume(count = 100, consumerName, consumerGroup) {
        const streams = this.partitionIds.map((partition) => `${this.name}/Partitions/${partition}`);
        if (!this.consumer) {
            this.consumer = this.connector.consumeStreams(streams, consumerName, consumerGroup, count);
        }
        return this.consumer;
    }
}
exports.Hub = Hub;
//# sourceMappingURL=hub.js.map