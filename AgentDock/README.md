# Agent Dock

A local AI coding workspace powered by Ollama. Chat with your models, work with files and folders, use a terminal, and coordinate models with bAgent. External MCP integrations are optional.

## Requirements

- Node.js 24.15 or newer (Node.js 26 also works), including npm.
- Ollama installed and running on your computer.
- At least one installed Ollama model. Agent features need a model that reliably supports tool calls.

## Start the app

1. Extract the entire folder. Keep its files together.
2. Open a terminal in this folder.
3. Install dependencies:

   ```sh
   npm install
   ```

4. Start Agent Dock:

   ```sh
   npm run dev
   ```

5. Open http://localhost:3000 in your browser. Keep the server running while using the app.

On Windows, installation also builds an optional `agentdock.exe` launcher. It stays with this folder and requires Node.js; it is not a standalone installer. You can continue using `npm run dev` instead. No prebuilt executable is included in this download.

## Connect your models

Start Ollama, then open **Models → Installed** and refresh. Agent Dock reads the models installed in your actual Ollama instance, including custom names. The normal local address is `http://127.0.0.1:11434`; change it in Settings if needed.

To install a model, use the integrated terminal or a system terminal, for example:

```sh
ollama pull qwen3:8b
```

Choose a model appropriate for your available memory. Local models do not need an API key. Cloud models require the account access and sign-in required by Ollama.

## Open a project

Use **Open Folder**, browse to your project, and select **Open this folder**. You can also enter its full path in the folder browser. The default project is `AgentDock` inside your Windows user/home folder. Existing projects stay where they are: open their existing folder to keep working on them.

Use Explorer to open folders and create, edit, rename, or delete files and folders. Save editor changes before asking an agent to change the same files. Agent deletions use the selected project's `.agentdock/trash` so the agent can restore them.

## Chat, Agent and bAgent

- **Chat**: normal conversation with the selected model.
- **Agent**: use local workspace tools to inspect, create, edit, and delete project files. MCP can remain off for this.
- **bAgent**: select models for planning, coding, and review. The coding stages can use workspace tools. More stages can take longer, particularly on a laptop.

Be specific about the result you want, for example: “Create a Python chatbot connected to local Ollama in a new chatbot folder.” These modes can change files in your selected project; keep backups or use Git.

## Terminal and notifications

The Terminal button opens a real terminal in the active project. Commands run on your computer. Windows supports PowerShell and CMD.

Enable completion notifications in Settings and use the test notification. For sound and banners, allow notifications in Windows and disable Do Not Disturb. Windows may identify the notification sender as SnoreToast. Unread responses also update the app badge.

## Optional MCP and Roblox Studio

Configure MCP in Settings. The **MCP** button toggles external tool access; leave it off for ordinary local Agent work. To use Roblox Studio, open your place, enable Studio as an MCP server in Studio's Assistant settings, connect/refresh in Agent Dock's settings, and select the target Studio instance. Successful tool results, rather than a model's written claim, indicate that a Studio action ran.

## Web search

Optional web search uses DuckDuckGo through an npm package without an API key. The search provider may block, throttle, or time out requests. This is not an unlimited guaranteed search service. Errors are shown rather than substituted with made-up results.

## Configuration and troubleshooting

Optional: copy `.env.example` to `.env` to set the server port, default project directory, or Ollama address. Restart the server after changing it. Do not publish your `.env`, private projects, or model credentials.

- **No models**: confirm Ollama is running and run `ollama list`; check its address in Settings, then refresh Installed models.
- **Port already in use**: stop the previous server, or set another `PORT` in `.env`.
- **Folder not found**: use a full path to an existing accessible folder in Open Folder.
- **Agent only talks about changes**: select a tool-capable model and use Agent or bAgent. Check actual tool results and Explorer.
- **Slow replies**: use a smaller model and shorter conversation; large context and multi-model stages require more computation.

Project selection and chat data use the default project's `.agentdock` directory. Browser preferences use local browser storage. This app provides access to your local files and terminal; run it on a trusted computer/network and do not expose its server publicly. It is not a hosted multi-user service.

## Development

```sh
npm run lint
npm run build
```

`npm run launcher:check` checks the Windows launcher source without generating an executable.
