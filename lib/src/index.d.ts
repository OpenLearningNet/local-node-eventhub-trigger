import { Context } from '@azure/functions';
interface Options {
    importDir?: string;
    allowedFunctions?: string[];
}
export declare const eventHubHttpTrigger: (config?: Options | undefined) => (context: Context, ...args: any[]) => void | Promise<any>;
export {};
