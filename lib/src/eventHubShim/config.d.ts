/**
 * A configuration file for the EventHub Local Dev tools
 */
export interface Config {
    /**
     * TLS Certificate
     */
    cert?: string;
    /**
     * TLS Private Key
     */
    key?: string;
    /**
     * AMQP port
     */
    port?: number;
    /**
     * Azure Functions runtime port
     */
    functionPort?: number;
    /**
     * Azure HTTP Triggered function which is configured to run EvenHub local triggers
     */
    triggerFunction: string;
    /**
     * Array of consumer groups which will be triggered
     */
    consumerGroups?: string[];
    /**
     * Array of EventHub configurations
     */
    eventHubs: {
        /**
         * EventHub name
         */
        name: string;
        /**
         * Array of partition IDs used on this EventHub
         */
        partitionIds: string[];
        [k: string]: any;
    }[];
    [k: string]: any;
}
