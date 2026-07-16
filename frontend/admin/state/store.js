import { eventBus } from "./event-bus.js";
import { Observer } from "./observer.js";
import { createInitialState, persistState, reducers } from "./slices.js";
import { STATE_EVENTS } from "./state-keys.js";

// Global store for admin state. It is intentionally small and framework-free.
class GlobalStore {
  constructor(initialState = createInitialState()) {
    this.state = Object.freeze(initialState);
    this.observer = new Observer();
    this.sliceObservers = new Map();
  }

  getState() {
    return this.state;
  }

  getSlice(sliceName) {
    return this.state[sliceName];
  }

  dispatch(actionName, payload = null) {
    const reducer = reducers[actionName];

    if (!reducer) {
      throw new Error(`Unknown state action: ${actionName}`);
    }

    const previousState = this.state;
    const nextState = Object.freeze(reducer(previousState, payload));
    this.state = nextState;
    persistState(nextState);
    this.notify(actionName, payload, previousState, nextState);
    return nextState;
  }

  subscribe(handler) {
    return this.observer.subscribe(handler);
  }

  subscribeSlice(sliceName, handler) {
    if (!this.sliceObservers.has(sliceName)) {
      this.sliceObservers.set(sliceName, new Observer());
    }

    return this.sliceObservers.get(sliceName).subscribe(handler);
  }

  notify(actionName, payload, previousState, nextState) {
    const change = {
      actionName,
      payload,
      previousState,
      nextState
    };

    this.observer.notify(change);
    eventBus.emit(STATE_EVENTS.changed, change);

    Object.keys(nextState).forEach((sliceName) => {
      if (previousState[sliceName] === nextState[sliceName]) {
        return;
      }

      const sliceChange = {
        sliceName,
        previousValue: previousState[sliceName],
        nextValue: nextState[sliceName],
        actionName
      };

      this.sliceObservers.get(sliceName)?.notify(sliceChange);
      eventBus.emit(`${STATE_EVENTS.sliceChanged}:${sliceName}`, sliceChange);
    });
  }
}

export const store = new GlobalStore();
export { GlobalStore };
