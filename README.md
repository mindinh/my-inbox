# Getting Started

## SAP TASKPROCESSING via Destination (Cloud Connector)

This project can call SAP TASKPROCESSING using SAP BTP Destination + Cloud Connector.

1. Configure destination `S4H_ODATA` in BTP (ProxyType `OnPremise`).
2. Keep `USE_MOCK_SAP=false` and `SAP_USE_DESTINATION=true`.
3. Use `SAP_TASK_HARDCODED_USER` for phase-1 hardcoded SAP user.
4. Start with `cds watch`.

Relevant backend files:
- `srv/inbox/sap-task-client.ts` (destination-based SAP calls)
- `srv/inbox/inbox-service.ts` (mock vs real client selection)
- `default-env.json` (local env example)

Welcome to your new project.

It contains these folders and files, following our recommended project layout:

File or Folder | Purpose
---------|----------
`app/` | content for UI frontends goes here
`db/` | your domain models and data go here
`srv/` | your service models and code go here
`package.json` | project metadata and configuration
`readme.md` | this getting started guide


## Next Steps

- Open a new terminal and run `cds watch`
- (in VS Code simply choose _**Terminal** > Run Task > cds watch_)
- Start adding content, for example, a [db/schema.cds](db/schema.cds).


## Learn More

Learn more at https://cap.cloud.sap/docs/get-started/.
