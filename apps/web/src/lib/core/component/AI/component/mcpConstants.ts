export const MACRO_MCP_URL = 'https://mcp-server.rox.one/mcp';

export const MACRO_MCP_CONFIG = JSON.stringify(
  {
    mcpServers: {
      rox: {
        type: 'http',
        url: MACRO_MCP_URL,
      },
    },
  },
  null,
  2
);

export const CLI_COMMANDS = [
  {
    key: 'claude-cli',
    label: 'Claude Code',
    command: `claude mcp add --transport http rox ${MACRO_MCP_URL}`,
  },
  {
    key: 'codex-cli',
    label: 'Codex CLI',
    command: `codex mcp add rox --url ${MACRO_MCP_URL}`,
  },
] as const;

export const WEB_CLIENTS = [
  {
    key: 'claude-web',
    label: 'Claude.ai',
    hint: 'Настройки → Connectors → Add custom connector',
  },
  {
    key: 'chatgpt-web',
    label: 'ChatGPT',
    hint: 'Настройки → Apps → Advanced settings → включите Developer mode, затем Create App',
  },
] as const;
