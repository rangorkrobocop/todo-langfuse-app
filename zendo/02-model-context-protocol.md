# Strategy: Model Context Protocol (MCP)

**Status:** Planned
**Specification:** [Anthropic MCP](https://modelcontextprotocol.io/)

## Concept
MCP is an open standard that enables AI models to securely connect to local and remote data sources. Instead of hardcoding tools into our Gemini agent, we can build universal tool servers that any compliant agent can use.

## The Strategy

### 1. ZenDo as an MCP Server
We will expose ZenDo's PostgreSQL database via an MCP Server interface. 
* **Goal:** You can open an external tool like Claude Desktop or the Cursor IDE, connect it to the ZenDo MCP Server, and say "Summarize my ZenDo tasks" or "Mark the documentation task complete in ZenDo."

### 2. ZenDo as an MCP Client
We will upgrade the ZenDo Gemini agent to be an MCP Client.
* **Goal:** Instead of hardcoding tools in `agent.ts`, ZenDo will dynamically discover tools from external MCP servers. For example, connecting ZenDo to a local File System MCP so the agent can read local files to automatically generate tasks based on a `TODO.md` file in another project.