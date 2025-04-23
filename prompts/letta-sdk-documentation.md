# Letta TypeScript SDK Reference

_A concise summary of all available client methods, organized by resource. Use this as a source-of-truth when building services with the SDK._

---

## Table of Contents

- [Tools](#tools)  
- [Sources](#sources)  
- [Agents](#agents)  
- [Groups](#groups)  
- [Identities](#identities)  
- [Models](#models)  
- [Embeddings](#embeddings)  
- [Blocks](#blocks)  
- [Jobs](#jobs)  
- [Health](#health)  
- [Providers](#providers)  
- [Runs](#runs)  
- [Steps](#steps)  
- [Tags](#tags)  
- [Batches](#batches)  
- [Voice](#voice)  
- [Templates](#templates)  
- [Client Side Access Tokens](#client-side-access-tokens)  
- [Projects](#projects)  
- [Agent Context](#agent-context)  
- [Agent Tools](#agent-tools)  
- [Agent Sources](#agent-sources)  
- [Agent Core Memory](#agent-core-memory)  
- [Agent Blocks](#agent-blocks)  
- [Agent Passages](#agent-passages)  
- [Agent Messages](#agent-messages)  
- [Agent Groups](#agent-groups)  
- [Agent Templates](#agent-templates)  
- [Agent Memory Variables](#agent-memory-variables)  
- [Blocks Agents](#blocks-agents)  
- [Groups Messages](#groups-messages)  
- [Identities Properties](#identities-properties)  
- [Runs Messages](#runs-messages)  
- [Runs Usage](#runs-usage)  
- [Runs Steps](#runs-steps)  
- [Sources Files](#sources-files)  
- [Sources Passages](#sources-passages)  
- [Templates Agents](#templates-agents)  

---

## Tools

- **`client.tools.retrieve(toolId: string, requestOptions?) → Promise<Letta.Tool>`**  
  Get a tool by ID.

- **`client.tools.delete(toolId: string, requestOptions?) → Promise<unknown>`**  
  Delete a tool by ID.

- **`client.tools.modify(toolId: string, params: Letta.ToolUpdate, requestOptions?) → Promise<Letta.Tool>`**  
  Update an existing tool.

- **`client.tools.list(params?: Letta.ToolsListRequest, requestOptions?) → Promise<Letta.Tool[]>`**  
  List all tools in your org.

- **`client.tools.create(params: Letta.ToolCreate, requestOptions?) → Promise<Letta.Tool>`**  
  Create a new tool from source code.

- **`client.tools.upsert(params: Letta.ToolCreate, requestOptions?) → Promise<Letta.Tool>`**  
  Create or update a tool by source.

- **`client.tools.upsertBaseTools(requestOptions?) → Promise<Letta.Tool[]>`**  
  Upsert base (standard) tools.

- **`client.tools.runToolFromSource(params: Letta.ToolRunFromSource, requestOptions?) → Promise<Letta.ToolReturnMessage>`**  
  Build a tool from source and execute it.

- **`client.tools.listComposioApps(params?: Letta.ListComposioAppsRequest, requestOptions?) → Promise<Letta.AppModel[]>`**  
  List all Composio apps.

- **`client.tools.listComposioActionsByApp(appName: string, requestOptions?) → Promise<Letta.ActionModel[]>`**  
  List Composio actions for an app.

- **`client.tools.addComposioTool(actionName: string, requestOptions?) → Promise<Letta.Tool>`**  
  Add a Composio action as a tool.

- **`client.tools.listMcpServers(params?: Letta.ListMcpServersRequest, requestOptions?) → Promise<Record<string, Letta.ListMcpServersResponseValue>>`**  
  List configured MCP servers.

- **`client.tools.addMcpServer(params: Letta.AddMcpServerRequest, requestOptions?) → Promise<Letta.AddMcpServerResponseItem[]>`**  
  Add a new MCP server.

- **`client.tools.listMcpToolsByServer(serverName: string, requestOptions?) → Promise<Letta.McpTool[]>`**  
  List tools on an MCP server.

- **`client.tools.addMcpTool(serverName: string, toolName: string, requestOptions?) → Promise<Letta.Tool>`**  
  Register an MCP tool.

- **`client.tools.deleteMcpServer(serverName: string, requestOptions?) → Promise<Letta.DeleteMcpServerResponseItem[]>`**  
  Delete an MCP server.

---

## Sources

- **`client.sources.retrieve(sourceId: string, requestOptions?) → Promise<Letta.Source>`**  
  Get a data source by ID.

- **`client.sources.delete(sourceId: string, requestOptions?) → Promise<unknown>`**  
  Delete a data source.

- **`client.sources.modify(sourceId: string, params: Letta.SourceUpdate, requestOptions?) → Promise<Letta.Source>`**  
  Update a source’s metadata.

- **`client.sources.retrieveByName(sourceName: string, requestOptions?) → Promise<string>`**  
  Get a source ID by name.

- **`client.sources.list(requestOptions?) → Promise<Letta.Source[]>`**  
  List all sources.

- **`client.sources.create(params: Letta.SourceCreate, requestOptions?) → Promise<Letta.Source>`**  
  Create a new data source.

---

## Agents

- **`client.agents.list(params?: Letta.AgentsListRequest, requestOptions?) → Promise<Letta.AgentState[]>`**  
  List all agents for the user.

- **`client.agents.create(params: Letta.CreateAgentRequest, requestOptions?) → Promise<Letta.AgentState>`**  
  Create a new agent.

- **`client.agents.export(agentId: string, requestOptions?) → Promise<string>`**  
  Export agent JSON.

- **`client.agents.import(file: File|ReadStream|Blob, params: Letta.BodyImportAgentSerialized, requestOptions?) → Promise<Letta.AgentState>`**  
  Import an agent from file.

- **`client.agents.retrieve(agentId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Get an agent’s state.

- **`client.agents.delete(agentId: string, requestOptions?) → Promise<unknown>`**  
  Delete an agent.

- **`client.agents.modify(agentId: string, params: Letta.UpdateAgent, requestOptions?) → Promise<Letta.AgentState>`**  
  Update agent configuration.

- **`client.agents.search(params: Letta.AgentsSearchRequest, requestOptions?) → Promise<Letta.AgentsSearchResponse>`**  
  Search deployed agents (Letta Cloud only).

---

## Groups

- **`client.groups.list(params?: Letta.GroupsListRequest, requestOptions?) → Promise<Letta.Group[]>`**  
  Fetch groups.

- **`client.groups.create(params: Letta.GroupCreate, requestOptions?) → Promise<Letta.Group>`**  
  Create a multi-agent group.

- **`client.groups.retrieve(groupId: string, requestOptions?) → Promise<Letta.Group>`**  
  Get a group by ID.

- **`client.groups.delete(groupId: string, requestOptions?) → Promise<unknown>`**  
  Delete a group.

- **`client.groups.modify(groupId: string, params: Letta.GroupUpdate, requestOptions?) → Promise<Letta.Group>`**  
  Update a group.

---

## Identities

- **`client.identities.list(params?: Letta.IdentitiesListRequest, requestOptions?) → Promise<Letta.Identity[]>`**  
  List identities.

- **`client.identities.create(params: Letta.IdentityCreate, requestOptions?) → Promise<Letta.Identity>`**  
  Create an identity.

- **`client.identities.upsert(params: Letta.IdentityUpsert, requestOptions?) → Promise<Letta.Identity>`**  
  Create or update an identity.

- **`client.identities.retrieve(identityId: string, requestOptions?) → Promise<Letta.Identity>`**  
  Get an identity.

- **`client.identities.delete(identityId: string, requestOptions?) → Promise<unknown>`**  
  Delete an identity.

- **`client.identities.modify(identityId: string, params: Letta.IdentityUpdate, requestOptions?) → Promise<Letta.Identity>`**  
  Update an identity.

---

## Models

- **`client.models.list(requestOptions?) → Promise<Letta.LlmConfig[]>`**  
  List LLM configurations.

---

## Embeddings

- **`client.embeddings.list(requestOptions?) → Promise<Letta.EmbeddingConfig[]>`**  
  List embedding configurations.

---

## Blocks

- **`client.blocks.list(params?: Letta.BlocksListRequest, requestOptions?) → Promise<Letta.Block[]>`**  
  List all blocks.

- **`client.blocks.create(params: Letta.CreateBlock, requestOptions?) → Promise<Letta.Block>`**  
  Create a block.

- **`client.blocks.retrieve(blockId: string, requestOptions?) → Promise<Letta.Block>`**  
  Get a block.

- **`client.blocks.delete(blockId: string, requestOptions?) → Promise<Letta.Block>`**  
  Delete a block.

- **`client.blocks.modify(blockId: string, params: Letta.BlockUpdate, requestOptions?) → Promise<Letta.Block>`**  
  Update a block.

---

## Jobs

- **`client.jobs.list(params?: Letta.JobsListRequest, requestOptions?) → Promise<Letta.Job[]>`**  
  List all jobs.

- **`client.jobs.listActive(requestOptions?) → Promise<Letta.Job[]>`**  
  List active jobs.

- **`client.jobs.retrieve(jobId: string, requestOptions?) → Promise<Letta.Job>`**  
  Get job status.

- **`client.jobs.delete(jobId: string, requestOptions?) → Promise<Letta.Job>`**  
  Delete a job.

---

## Health

- **`client.health.check(requestOptions?) → Promise<Letta.Health>`**  
  Check service health.

---

## Providers

- **`client.providers.list(params?: Letta.ProvidersListRequest, requestOptions?) → Promise<Letta.Provider[]>`**  
  List custom providers.

- **`client.providers.create(params: Letta.ProviderCreate, requestOptions?) → Promise<Letta.Provider>`**  
  Create a provider.

- **`client.providers.delete(providerId: string, requestOptions?) → Promise<unknown>`**  
  Delete a provider.

- **`client.providers.modify(providerId: string, params: Letta.ProviderUpdate, requestOptions?) → Promise<Letta.Provider>`**  
  Update a provider.

---

## Runs

- **`client.runs.list(params?: Letta.RunsListRequest, requestOptions?) → Promise<Letta.Run[]>`**  
  List all runs.

- **`client.runs.listActive(params?: Letta.RunsListActiveRequest, requestOptions?) → Promise<Letta.Run[]>`**  
  List active runs.

- **`client.runs.retrieve(runId: string, requestOptions?) → Promise<Letta.Run>`**  
  Get run status.

- **`client.runs.delete(runId: string, requestOptions?) → Promise<Letta.Run>`**  
  Delete a run.

---

## Steps

- **`client.steps.listSteps(params?: Letta.ListStepsRequest, requestOptions?) → Promise<Letta.Step[]>`**  
  List steps (with pagination/date filters).

- **`client.steps.retrieve(stepId: string, requestOptions?) → Promise<Letta.Step>`**  
  Get a step.

- **`client.steps.list(requestOptions?) → Promise<void>`**  
  Alias for `listSteps()`.

---

## Tags

- **`client.tags.list(params?: Letta.TagsListRequest, requestOptions?) → Promise<string[]>`**  
  List all tags.

---

## Batches

- **`client.batches.list(requestOptions?) → Promise<Letta.BatchJob[]>`**  
  List batch runs.

- **`client.batches.create(params: Letta.CreateBatch, requestOptions?) → Promise<Letta.BatchJob>`**  
  Submit a batch of messages.

- **`client.batches.retrieve(batchId: string, requestOptions?) → Promise<Letta.BatchJob>`**  
  Get batch status.

- **`client.batches.cancel(batchId: string, requestOptions?) → Promise<unknown>`**  
  Cancel a batch.

---

## Voice

- **`client.voice.createVoiceChatCompletions(agentId: string, params: Letta.CreateVoiceChatCompletionsRequest, requestOptions?) → Promise<unknown>`**  
  Create voice chat completions for an agent.

---

## Templates

- **`client.templates.list(params?: Letta.TemplatesListRequest, requestOptions?) → Promise<Letta.TemplatesListResponse>`**  
  List templates.

---

## Client Side Access Tokens

- **`client.clientSideAccessTokens.create(params: Letta.ClientSideAccessTokensCreateRequest, requestOptions?) → Promise<Letta.ClientSideAccessTokensCreateResponse>`**  
  Create a client-side token.

- **`client.clientSideAccessTokens.delete(token: string, params?, requestOptions?) → Promise<unknown>`**  
  Delete a client-side token.

---

## Projects

- **`client.projects.list(params?: Letta.ProjectsListRequest, requestOptions?) → Promise<Letta.ProjectsListResponse>`**  
  List projects.

---

## Agent Context

- **`client.agents.context.retrieve(agentId: string, requestOptions?) → Promise<Letta.ContextWindowOverview>`**  
  Retrieve an agent’s context window.

---

## Agent Tools

- **`client.agents.tools.list(agentId: string, requestOptions?) → Promise<Letta.Tool[]>`**  
  List tools attached to an agent.

- **`client.agents.tools.attach(agentId: string, toolId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Attach a tool to an agent.

- **`client.agents.tools.detach(agentId: string, toolId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Detach a tool from an agent.

---

## Agent Sources

- **`client.agents.sources.attach(agentId: string, sourceId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Attach a source to an agent.

- **`client.agents.sources.detach(agentId: string, sourceId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Detach a source from an agent.

- **`client.agents.sources.list(agentId: string, requestOptions?) → Promise<Letta.Source[]>`**  
  List sources attached to an agent.

---

## Agent Core Memory

- **`client.agents.coreMemory.retrieve(agentId: string, requestOptions?) → Promise<Letta.Memory>`**  
  Retrieve an agent’s core memory.

---

## Agent Blocks

- **`client.agents.blocks.retrieve(agentId: string, blockLabel: string, requestOptions?) → Promise<Letta.Block>`**  
  Get a memory block.

- **`client.agents.blocks.modify(agentId: string, blockLabel: string, params: Letta.BlockUpdate, requestOptions?) → Promise<Letta.Block>`**  
  Update a memory block.

- **`client.agents.blocks.list(agentId: string, requestOptions?) → Promise<Letta.Block[]>`**  
  List memory blocks.

- **`client.agents.blocks.attach(agentId: string, blockId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Attach a block.

- **`client.agents.blocks.detach(agentId: string, blockId: string, requestOptions?) → Promise<Letta.AgentState>`**  
  Detach a block.

---

## Agent Passages

- **`client.agents.passages.list(agentId: string, params?: Letta.agents.PassagesListRequest, requestOptions?) → Promise<Letta.Passage[]>`**  
  List archival memories.

- **`client.agents.passages.create(agentId: string, params: Letta.agents.CreateArchivalMemory, requestOptions?) → Promise<Letta.Passage[]>`**  
  Insert archival memory.

- **`client.agents.passages.delete(agentId: string, memoryId: string, requestOptions?) → Promise<unknown>`**  
  Delete archival memory.

- **`client.agents.passages.modify(agentId: string, memoryId: string, params: Letta.agents.PassageUpdate, requestOptions?) → Promise<Letta.Passage[]>`**  
  Update archival memory.

---

## Agent Messages

- **`client.agents.messages.list(agentId: string, params?: Letta.agents.MessagesListRequest, requestOptions?) → Promise<Letta.LettaMessageUnion[]>`**  
  Retrieve message history.

- **`client.agents.messages.create(agentId: string, params: Letta.LettaRequest, requestOptions?) → Promise<Letta.LettaResponse>`**  
  Process a user message.

- **`client.agents.messages.modify(agentId: string, messageId: string, params: Letta.MessagesModifyRequest, requestOptions?) → Promise<Letta.MessagesModifyResponse>`**  
  Update a message.

- **`client.agents.messages.createStream(agentId: string, params: Letta.LettaStreamingRequest, requestOptions?) → Promise<core.Stream<Letta.LettaStreamingResponse>>`**  
  Stream a response.

- **`client.agents.messages.createAsync(agentId: string, params: Letta.LettaRequest, requestOptions?) → Promise<Letta.Run>`**  
  Asynchronously process a message.

- **`client.agents.messages.reset(agentId: string, params?: Letta.agents.MessagesResetRequest, requestOptions?) → Promise<Letta.AgentState>`**  
  Reset an agent’s messages.

---

## Agent Groups

- **`client.agents.groups.list(agentId: string, params?: Letta.agents.GroupsListRequest, requestOptions?) → Promise<Letta.Group[]>`**  
  List groups for an agent.

---

## Agent Templates

- **`client.agents.templates.createVersion(agentId: string, params: Letta.agents.TemplatesCreateVersionRequest, requestOptions?) → Promise<void>`**  
  Version an agent template.

- **`client.agents.templates.migrate(agentId: string, params: Letta.agents.TemplatesMigrateRequest, requestOptions?) → Promise<Letta.TemplatesMigrateResponse>`**  
  Migrate an agent to a new template.

- **`client.agents.templates.create(agentId: string, params: Letta.agents.TemplatesCreateRequest, requestOptions?) → Promise<Letta.TemplatesCreateResponse>`**  
  Create a template from an agent.

---

## Agent Memory Variables

- **`client.agents.memoryVariables.list(agentId: string, requestOptions?) → Promise<Letta.MemoryVariablesListResponse>`**  
  List memory variables (Letta Cloud only).

---

## Blocks Agents

- **`client.blocks.agents.list(blockId: string, requestOptions?) → Promise<Letta.AgentState[]>`**  
  List agents using a block.

---

## Groups Messages

- **`client.groups.messages.list(groupId: string, params?: Letta.groups.MessagesListRequest, requestOptions?) → Promise<Letta.LettaMessageUnion[]>`**  
  Retrieve group message history.

- **`client.groups.messages.create(groupId: string, params: Letta.LettaRequest, requestOptions?) → Promise<Letta.LettaResponse>`**  
  Send a message to a group.

- **`client.groups.messages.createStream(groupId: string, params: Letta.LettaStreamingRequest, requestOptions?) → Promise<core.Stream<Letta.LettaStreamingResponse>>`**  
  Stream group responses.

- **`client.groups.messages.modify(groupId: string, messageId: string, params: Letta.MessagesModifyRequest, requestOptions?) → Promise<Letta.MessagesModifyResponse>`**  
  Update a group message.

- **`client.groups.messages.reset(groupId: string, requestOptions?) → Promise<unknown>`**  
  Clear group messages.

---

## Identities Properties

- **`client.identities.properties.upsert(identityId: string, props: Letta.IdentityProperty[], requestOptions?) → Promise<unknown>`**  
  Upsert identity properties.

---

## Runs Messages

- **`client.runs.messages.list(runId: string, params?: Letta.runs.MessagesListRequest, requestOptions?) → Promise<Letta.LettaMessageUnion[]>`**  
  List messages in a run.

---

## Runs Usage

- **`client.runs.usage.retrieve(runId: string, requestOptions?) → Promise<Letta.UsageStatistics>`**  
  Get usage stats for a run.

---

## Runs Steps

- **`client.runs.steps.list(runId: string, params?: Letta.runs.StepsListRequest, requestOptions?) → Promise<Letta.Step[]>`**  
  List steps in a run.

---

## Sources Files

- **`client.sources.files.upload(file: File|ReadStream|Blob, sourceId: string, requestOptions?) → Promise<Letta.Job>`**  
  Upload a file to a source.

- **`client.sources.files.list(sourceId: string, params?: Letta.sources.FilesListRequest, requestOptions?) → Promise<Letta.FileMetadata[]>`**  
  List files in a source.

- **`client.sources.files.delete(sourceId: string, fileId: string, requestOptions?) → Promise<void>`**  
  Delete a file.

---

## Sources Passages

- **`client.sources.passages.list(sourceId: string, requestOptions?) → Promise<Letta.Passage[]>`**  
  List passages for a source.

---

## Templates Agents

- **`client.templates.agents.create(project: string, templateVersion: string, params?: Letta.templates.AgentsCreateRequest, requestOptions?) → Promise<Letta.AgentsCreateResponse>`**  
  Instantiate agents from a template.
