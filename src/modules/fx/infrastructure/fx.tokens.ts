/** The `fetch` used for the FX provider; tests replace it so they never touch the network. */
export const FX_HTTP_FETCH = Symbol('FxHttpFetch');

export const FX_PROVIDER_CONFIG = Symbol('FxProviderConfig');

export interface ErApiConfig {
  url: string;
  timeoutMs: number;
}
