import { Message, Sender } from 'rhea';
import { Hub } from './hub';
interface HubCollection {
    [name: string]: Hub;
}
export declare class RemoteContainerFactory {
    hubs: HubCollection;
    containerInstances: {
        [id: string]: RemoteContainer;
    };
    constructor(hubs: HubCollection);
    getContainer(id: string): RemoteContainer;
}
export declare class RemoteContainer {
    id: string;
    operationHandlers: {
        [address: string]: {
            [op: string]: (message: Message) => Message | null;
        };
    };
    hubs: HubCollection;
    authenticatedAddresses: Set<string>;
    constructor(id: string, hubs: HubCollection);
    authenticate(message: Message): Message;
    readState(message: Message): Message | null;
    authenticateEntity(address: string): void;
    consumeMessage(message: Message, address: string): Message | null;
    onEvent(address: string, event: object): void;
    onReceiverOpen(address: string, sender: Sender): void;
    onReceiverClose(address: string): void;
    onDisconnect(): void;
}
export {};
