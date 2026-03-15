import type { ControlApi } from "../shared/ipc";

declare global {
  interface Window {
    controlApi: ControlApi;
  }
}

export {};
