"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const axios_1 = __importDefault(require("axios"));
const colors_1 = require("../colors");
const defaultFunctionPort = 7071;
const localAdminUrl = (config) => `http://localhost:${config.functionPort ||
    defaultFunctionPort}/admin/functions/`;
const localFunctionUrl = (config) => `http://localhost:${config.functionPort || defaultFunctionPort}/api/${config.triggerFunction}`;
let _functions;
async function retrieveFunctions(config) {
    if (!_functions) {
        const adminResponse = await axios_1.default.get(localAdminUrl(config));
        _functions = adminResponse.data;
    }
    return _functions;
}
async function retrieveSubscription(config, hub, consumerGroup) {
    const functions = await retrieveFunctions(config);
    if (!functions) {
        throw new Error('Cannot connect to Function Runtime');
    }
    const isMatchingConsumerGroup = consumerGroup === '$Default'
        ? (candidate) => candidate === consumerGroup || !candidate
        : (candidate) => candidate === consumerGroup;
    // Filter out all functions which match:
    //  - eventhub triggered, and
    //  - triggered by this eventHub, and
    //  - using this consumer group
    const eventHubTriggers = functions.filter((func) => {
        const bindings = func.config.bindings;
        return bindings.some((binding) => binding.type === 'eventHubTrigger' &&
            binding.direction === 'in' &&
            binding.eventHubName === hub.name &&
            isMatchingConsumerGroup(binding.consumerGroup));
    });
    return eventHubTriggers[0];
}
const trigger = async (hub, func, events, cardinality, config) => {
    if (cardinality === 'many') {
        const response = await axios_1.default.post(localFunctionUrl(config), {
            function: func.name,
            messages: events.map((event) => event.body),
        });
        console.log(`\n${colors_1.cyan('<')} Function Triggered:`, colors_1.green(func.name), 'consumed', colors_1.yellow(`${response.data.messages.length} messages`), 'from', colors_1.green(hub.name));
    }
    else {
        for (const event of events) {
            await axios_1.default.post(localFunctionUrl(config), {
                function: func.name,
                message: event.body,
            });
            console.log(`\n${colors_1.cyan('<')} Function Triggered:`, colors_1.green(func.name), 'consumed one message from', colors_1.green(hub.name));
        }
    }
};
exports.triggerFunction = async (config, hub, consumerGroup) => {
    if (!config.triggerFunction) {
        console.error(colors_1.red('No triggerFunction has been provided in configuration.'));
        process.exit();
    }
    try {
        const func = await retrieveSubscription(config, hub, consumerGroup);
        if (!func) {
            throw new Error(`No function is triggered by ${hub.name} with consumer group ${consumerGroup}`);
        }
        const cardinality = func.config.bindings.find((binding) => binding.type === 'eventHubTrigger' && binding.direction === 'in').cardinality;
        const consumer = hub.consume(100, func.name, consumerGroup);
        for await (const events of consumer) {
            try {
                trigger(hub, func, events, cardinality, config);
            }
            catch (err) {
                console.error(err.message, ':', err.response.data);
            }
        }
    }
    catch (err) {
        console.error(colors_1.red(err.message));
        process.exit();
    }
};
//# sourceMappingURL=triggerFuncs.js.map