import { Config } from './config';
import { Hub } from './hub';
export declare const triggerFunction: (config: Config, hub: Hub, consumerGroup: string) => Promise<void>;
