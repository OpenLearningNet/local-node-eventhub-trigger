import axios from 'axios';

import { green, yellow, cyan, red } from '../colors';
import { Config } from './config';
import { Hub } from './hub';
import { Event } from './connector';

const defaultFunctionPort = 7071;

const localAdminUrl = (config: Config) =>
  `http://localhost:${config.functionPort ||
    defaultFunctionPort}/admin/functions/`;

const localFunctionUrl = (config: Config) =>
  `http://localhost:${config.functionPort || defaultFunctionPort}/api/${
    config.triggerFunction
  }`;

let _functions: any[];
async function retrieveFunctions(config: Config): Promise<any[]> {
  if (!_functions) {
    const adminResponse = await axios.get(localAdminUrl(config));
    _functions = adminResponse.data;
  }
  return _functions;
}

async function retrieveSubscription(
  config: Config,
  hub: Hub,
  consumerGroup: string
) {
  const functions = await retrieveFunctions(config);

  if (!functions) {
    throw new Error('Cannot connect to Function Runtime');
  }

  const isMatchingConsumerGroup =
    consumerGroup === '$Default'
      ? (candidate: string) => candidate === consumerGroup || !candidate
      : (candidate: string) => candidate === consumerGroup;

  // Filter out all functions which match:
  //  - eventhub triggered, and
  //  - triggered by this eventHub, and
  //  - using this consumer group
  const eventHubTriggers = functions.filter((func) => {
    const bindings = func.config.bindings;
    return bindings.some(
      (binding: any) =>
        binding.type === 'eventHubTrigger' &&
        binding.direction === 'in' &&
        binding.eventHubName === hub.name &&
        isMatchingConsumerGroup(binding.consumerGroup)
    );
  });

  return eventHubTriggers[0];
}

const trigger = async (
  hub: Hub,
  func: any,
  events: Event[],
  cardinality: string,
  config: Config
) => {
  if (cardinality === 'many') {
    const response = await axios.post(localFunctionUrl(config), {
      function: func.name,
      messages: events.map((event) => event.body),
      script: func.config.scriptFile,
    });

    console.log(
      `\n${cyan('<')} Function Triggered:`,
      green(func.name),
      'consumed',
      yellow(`${response.data.messages.length} messages`),
      'from',
      green(hub.name)
    );
  } else {
    for (const event of events) {
      await axios.post(localFunctionUrl(config), {
        function: func.name,
        message: event.body,
        script: func.config.scriptFile,
      });

      console.log(
        `\n${cyan('<')} Function Triggered:`,
        green(func.name),
        'consumed one message from',
        green(hub.name)
      );
    }
  }
};

export const triggerFunction = async (
  config: Config,
  hub: Hub,
  consumerGroup: string
): Promise<void> => {
  if (!config.triggerFunction) {
    console.error(
      red('No triggerFunction has been provided in configuration.')
    );
    process.exit();
  }

  try {
    const func = await retrieveSubscription(config, hub, consumerGroup);
    if (!func) {
      throw new Error(
        `No function is triggered by ${hub.name} with consumer group ${consumerGroup}`
      );
    }

    const cardinality = func.config.bindings.find(
      (binding: any) =>
        binding.type === 'eventHubTrigger' && binding.direction === 'in'
    ).cardinality;

    const consumer = hub.consume(100, func.name, consumerGroup);

    for await (const events of consumer) {
      try {
        trigger(hub, func, events, cardinality, config);
      } catch (err) {
        console.error(err.message, ':', err.response.data);
      }
    }
  } catch (err) {
    console.error(red(err.message));
    process.exit();
  }
};
