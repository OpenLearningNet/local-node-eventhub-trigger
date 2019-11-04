# NodeJS EventHub Triggers for local development
This project implements a bare-bones emulation of EventHubs for local development. 

`npm install --save-dev @openlearning/local-node-eventhub-trigger`

`yarn add --dev @openlearning/local-node-eventhub-trigger`

This provides three scripts for:
1. `eventhub-local-init` Initialising the project. This will create an `eventhub-dev.json` config file and an HTTP triggered utility function for triggering EventHub bindings (added to `.funcignore` as it is for local development only).
1. `eventhub-local-dev`  Running a Redis Streams backed event queue with an AMQP interface. This interface emulates enough of the EventHubs protocol to use the NodeJS eventhubs library to query partition information and send events. The function runtime will not connect to this emulator so functions triggered by EventHub bindings will instead be triggered by an HTTP utility function (which exists only for local development).
1. `eventhub-local-replay` Replaying a Redis Stream into EventHub triggered functions (this removes all consumer groups and re-adds them, starting from the beginning of the stream).

## Requirements:
- NodeJS/Typescript Azure Functions runtime (v2.0)
- Redis >v5 (Redis Streams)
