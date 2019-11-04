import { AzureFunction, Context, HttpRequest } from '@azure/functions';

interface Options {
  importDir?: string;
  allowedFunctions?: string[];
}

export const eventHubHttpTrigger = (config?: Options): AzureFunction => async (
  context: Context,
  req: HttpRequest
): Promise<void> => {
  const data = req.body;
  const func = data.function;
  const script = data.script;
  const messages = data.messages || [];
  const singleMessage = data.message;

  const { importDir, allowedFunctions } = {
    importDir: '../',
    ...config,
  };

  if (messages) {
    console.log(
      '[EventHubTrigger] Invoking',
      func,
      'to process',
      messages.length,
      'messages'
    );
  } else {
    console.log('[EventHubTrigger] Invoking', func, 'to process one message');
  }

  try {
    if (allowedFunctions === undefined || func in allowedFunctions) {
      const importPath = script || `${importDir}${func}`;
      const triggerModule = await import(importPath);
      const trigger = triggerModule.default;
      if (singleMessage) {
        await trigger(context, singleMessage);
      } else {
        await trigger(context, messages);
      }
    } else {
      throw new Error('Triggering this function is not allowed');
    }
  } catch (err) {
    context.res = {
      status: 400,
      body: `Unable to trigger ${func}: ${err.message}`,
    };
    return;
  }

  context.res = {
    status: 200,
    body: {
      function: func,
      messages,
    },
  };
};
