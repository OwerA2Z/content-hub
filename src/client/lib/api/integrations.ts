import { request } from "../http";
import type { AiIntegration } from "./types";

export const integrationApi = {
  getAi: () => request<{ data: AiIntegration }>("/api/v1/integrations/ai"),
};
