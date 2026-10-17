import { createContext, useContext } from "react";
import { type ApiClient, apiClient } from "./client.ts";

const ApiContext = createContext<ApiClient>(apiClient);

export const ApiProvider = ApiContext.Provider;

export function useApi(): ApiClient {
  return useContext(ApiContext);
}
