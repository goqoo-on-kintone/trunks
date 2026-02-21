import { gyuma } from 'gyuma';
import type { AgentOptions } from './types.js';

// dts-genはフィールド情報を読み取るので k:app_settings:read が必要
const DEFAULT_SCOPE = 'k:app_settings:read';

export const getOauthToken = async (
  domain: string,
  scope: string | undefined,
  agentOptions: AgentOptions
): Promise<string> => {
  const token = await gyuma({ domain, scope: scope ?? DEFAULT_SCOPE, ...agentOptions }, true);
  return token;
};
