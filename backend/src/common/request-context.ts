import { AsyncLocalStorage } from 'async_hooks';

type RequestContextValue = {
  requestId: string;
};

const requestContextStorage = new AsyncLocalStorage<RequestContextValue>();

export function runWithRequestContext<T>(context: RequestContextValue, callback: () => T) {
  return requestContextStorage.run(context, callback);
}

export function getRequestContext() {
  return requestContextStorage.getStore();
}

export function getRequestId() {
  return getRequestContext()?.requestId;
}
