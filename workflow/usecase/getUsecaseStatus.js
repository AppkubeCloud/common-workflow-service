const { Client } = require("pg");
const {
  SecretsManagerClient,
  GetSecretValueCommand,
} = require("@aws-sdk/client-secrets-manager");
 
exports.handler = async (event) => {
  const usecase_id = event.queryStringParameters?.usecase_id ?? null;
  if (usecase_id == null || usecase_id == "") {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({
        message:
          "The 'usecase_id' query parameters are required and must have a non-empty value.",
      }),
    };
  }
  const secretsManagerClient = new SecretsManagerClient({
    region: "us-east-1",
  });
  const configuration = await secretsManagerClient.send(
    new GetSecretValueCommand({ SecretId: "serverless/lambda/credintials" })
  );
  const dbConfig = JSON.parse(configuration.SecretString);
 
  const client = new Client({
    host: dbConfig.host,
    port: dbConfig.port,
    database: "workflow",
    user: dbConfig.engine,
    password: dbConfig.password,
  });
  try {
    await client
      .connect()
      .then(() => {
        console.log("Connected to the database");
      })
      .catch((err) => {
        console.log("Error connecting to the database. Error :" + err);
      });
    const query = `
    SELECT
        u.id AS usecase_id,
        u.usecase->>'name' AS usecase_name,
        u.usecase->>'status' AS usecase_status,
        u.usecase->>'current_stage' AS usecase_current_stage,
        w.id AS workflow_id,
        w.name AS workflow_name,
        w.workflow->'stages' AS workflow_stages,
        u.usecase->>'creation_date' AS assigned_date,
        u.usecase->>'start_date' AS planned_start_date,
        u.usecase->>'actual_start_date' AS actual_start_date
    FROM
        usecases_table u
    JOIN
        workflows_table w ON u.workflow_id = w.id
    WHERE
        u.id = $1;
`;

const useCaseResult = await client.query(query, [usecase_id]);
const useCaseData = useCaseResult.rows[0];

const stageNames = useCaseData.workflow_stages.map(stage => Object.keys(stage)[0]);

const resourcesQuery = `
    SELECT
        r.resource->>'name' AS resource_name,
        r.resource->>'role' AS role,
        r.resource->'current_task'->>'task_id' AS current_task_id,
        r.resource->'current_task'->>'task_name' AS current_task,
        r.resource->>'image' AS image,
        COUNT(t.id) AS total_tasks
    FROM
        tasks_table t
    JOIN
        resources_table r ON t.assignee_id = r.id
    WHERE
        t.usecase_id = $1
    GROUP BY
        r.id, r.resource->>'name', r.resource->>'role', r.resource->>'current_task', r.resource->>'image';
`;

const resourcesResult = await client.query(resourcesQuery, [usecase_id]);

const formattedResourcesResult =
    resourcesResult.rows.length > 0
        ? resourcesResult.rows.map((row) => ({
            resource_name: row.resource_name,
            role: row.role,
            total_tasks: row.total_tasks,
            current_task: row.current_task,
            image: row.image,
            assigned_date: useCaseData.assigned_date,
            planned_start_date: useCaseData.planned_start_date,
            actual_start_date: useCaseData.actual_start_date,
        }))
        : [];

const finalResponse = {
    usecase_id: useCaseData.usecase_id,
    usecase_name: useCaseData.usecase_name,
    usecase_status: useCaseData.usecase_status,
    usecase_current_stage: useCaseData.usecase_current_stage,
    workflow_id: useCaseData.workflow_id,
    workflow_name: useCaseData.workflow_name,
    stageNames: stageNames,
    resources: formattedResourcesResult,
};

return {
    statusCode: 200,
    body: JSON.stringify(finalResponse),
};
} catch (error) {
console.error('Error executing query:', error);
return {
    statusCode: 500,
    body: JSON.stringify({ error: 'Internal Server Error' }),
};
} finally {
await client.end();
}
};