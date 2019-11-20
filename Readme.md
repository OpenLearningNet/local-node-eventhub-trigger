# NodeJS EventHub Triggers for local development
This project implements a bare-bones emulation of EventHubs for local development. 

`npm install --save-dev @openlearning/local-node-eventhub-trigger`

`yarn add --dev @openlearning/local-node-eventhub-trigger`

This provides three scripts:
1. `npx eventhub-local-init` Initialising the project. This will create an `eventhub-dev.json` config file and an HTTP triggered utility function for triggering EventHub bindings (added to `.funcignore` as it is for local development only).
1. `npx eventhub-local-dev`  Running a Redis Streams backed event queue with an AMQP interface. This interface emulates enough of the EventHubs protocol to use the NodeJS eventhubs library to query partition information and send events. The function runtime will not connect to this emulator so functions triggered by EventHub bindings will instead be triggered by an HTTP utility function (which exists only for local development).
1. `npx eventhub-local-replay` Replaying a Redis Stream into EventHub triggered functions (this removes all consumer groups and re-adds them, starting from the beginning of the stream).

## Notes:
- This requires that your EventHub triggered functions are not provided a connection string (Azure Functions will not connect to this emulator). This will cause an error (of the effect: `connection string cannot be null`) and deactivate these functions. These functions will instead be triggered by the HTTP trigger utility.
- You may need to separate the connection string used for ingesting events (which will be this emulator on localhost) from the connection string used for triggering functions (not provided). These will be the same in production.

## Requirements:
- NodeJS/Typescript Azure Functions runtime/core tools (v2.0)
- Redis >v5 (Redis Streams) is running

# Example:

## Start an Azure Functions Project:
1. Init the project with `func init`
1. Create a function which will receive and ingest EventHub events: `func new` and select "Azure Event Hub trigger", e.g. called "EventConsumer"

## Send Events to an EventHub
1. Create a function (or other service) which will send events to EventHub: e.g. `func new` and select "HTTP trigger", called "EventApi"
1. Install the azure eventhub library to send events to EventHub from your API: `npm install @azure/event-hubs`
1. In "EventApi" (or other service) call the EventHubs library:
```
import { EventHubClient } from '@azure/event-hubs';

const localConnectionString = 'Endpoint=sb://localhost;SharedAccessKeyName=name;SharedAccessKey=key';
const eventHubClient = EventHubClient.createFromConnectionString(localConnectionString, 'myEventHub');
const partitionId = "0";

...

await eventHubClient.send(
  {
    body: event,
  },
  partitionId
);
```

This will send an event to the local eventhubs emulation, which will trigger the required "Azure Event Hub Trigger" functions (e.g. "EventConsumer").

## General Azure Function Setup Notes
- `tsconfig.json` will likely require `"esModuleInterop": true`
- `local.settings.json` should be set up with `"Values"`: 
  - `"AzureWebJobsStorage": "UserDevelopmentStorage=true"` (which can use local Azure Storage emulation using `azurite`)
- Other local development NodeJS environment variables required:
  - `"NODE_TLS_REJECT_UNAUTHORIZED": "0"` (for sending to local self-signed TLS connections)
  
## Replaying events
To replay events locally, create a new consumer group for the new service, or use the provided `eventhub-local-replay` command to delete the current consumer groups and re-create them.

In a production EventHub environment, a tool such as https://github.com/inoteq/azure-event-hub-replay may be used.
