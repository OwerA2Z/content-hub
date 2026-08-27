export { TOKEN_SCOPES, TOKEN_SCOPE_LABELS } from "../../../shared/scopes";
export type { TokenScope } from "../../../shared/scopes";
export type { CandidatePool, ContentCandidate } from "../../../shared/candidate-pools";

export interface Article {
  id: string;
  title: string;
  digest?: string;
  author?: string;
  status: string;
  createdAt: string;
  content: string;
  coverUrl?: string;
  images?: string[];
  coverAssetId?: string;
}

export interface MediaAsset { id: string; kind: "image"; originalName: string; mimeType: string; sizeBytes: number; width?: number; height?: number; alt?: string; tags: string[]; status: "active" | "archived"; url: string; createdAt: string; updatedAt: string; }

export interface Capabilities { draft: boolean; publish: boolean; reason?: string; }
import type { TokenScope } from "../../../shared/scopes";

export interface TokenInfo { id: string; name: string; scopes: TokenScope[]; prefix: string; createdAt: string; revokedAt?: string; }
export interface CreatedToken { info: TokenInfo; secret: string; }
export interface AiIntegration { baseUrl: string; endpoints: Record<string, string>; }
export interface Strategy { id: string; name: string; goal: string; status: string; contentPillars: string[]; }
export interface Series { id: string; strategyId: string; sequence: number; name: string; targetCount: number; status: string; }
export interface Brief { id: string; seriesId: string; sequence: number; titleDirection: string; status: string; mustCover: string[]; mustAvoid: string[]; }
