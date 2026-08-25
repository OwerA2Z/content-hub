export interface Article {
  id: string;
  title: string;
  digest?: string;
  author?: string;
  status: string;
  createdAt: string;
  content: string;
  coverUrl?: string;
}

export interface Capabilities { draft: boolean; publish: boolean; reason?: string; }
export interface TokenInfo { id: string; name: string; kind: "api" | "ai_read" | "ai_write"; prefix: string; createdAt: string; revokedAt?: string; }
export interface CreatedToken { info: TokenInfo; secret: string; }
export interface AiIntegration { baseUrl: string; readTokenConfigured: boolean; writeTokenConfigured: boolean; endpoints: Record<string, string>; }
export interface Strategy { id: string; name: string; goal: string; status: string; contentPillars: string[]; }
export interface Series { id: string; strategyId: string; sequence: number; name: string; targetCount: number; status: string; }
export interface Brief { id: string; seriesId: string; sequence: number; titleDirection: string; status: string; mustCover: string[]; mustAvoid: string[]; }
