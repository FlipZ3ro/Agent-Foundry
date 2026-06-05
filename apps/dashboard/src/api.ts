import { AgentFoundryClient } from "../../../packages/sdk/src/index.js";

const baseUrl = import.meta.env.VITE_API_URL ?? "";

export const client = new AgentFoundryClient({ baseUrl });
