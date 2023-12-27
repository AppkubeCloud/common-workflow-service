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
    // Query to get project status based on use cases and workflow stages
    const useCasesQuery = `
      SELECT
        usecase,
        usecase->>'usecase_assignee_id' AS usecase_assignee_id
      FROM usecases_table
      WHERE id = $1
    `;
 
    const useCasesResult = await client.query(useCasesQuery, [usecase_id]);
 
    if (useCasesResult.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "Project not found" }),
      };
    }
 
    const projectUseCase = useCasesResult.rows[0].usecase;
    const usecaseAssigneeId = useCasesResult.rows[0].usecase_assignee_id;
 
    // Process project status based on use cases and workflow stages
    let projectStatus = [];
 
    const currentStage = projectUseCase.current_stage;
    const workflow = projectUseCase.workflow;
 
    let usecaseStatus = [];
 
    for (const stage of workflow) {
      const stageType = Object.keys(stage)[0];
 
      if (stageType === currentStage) {
        usecaseStatus.push({ stage: currentStage, status: "inprogress" });
        break;
      } else {
        usecaseStatus.push({ stage: stageType, status: "completed" });
      }
    }
 
    projectStatus.push({ usecase: projectUseCase.name, status: usecaseStatus });
 
    // Query to get resources working on a particular project
    const resourcesQuery = `
      SELECT
        r.resource->>'name' AS resourcename,
        r.resource->>'role' AS role,
        r.resource->'current_task'->>'task_id' AS currenttask_id,
        r.resource->'current_task'->>'task_name' AS currenttask,
        r.resource->>'image' AS image,
        COUNT(t.id) AS totaltasks
      FROM
        tasks_table t
      JOIN
        resources_table r ON t.assignee_id = r.id
      WHERE
        t.assignee_id = $1
      GROUP BY
        r.id, r.resource->>'name', r.resource->>'role', r.resource->>'current_task', r.resource->>'image';
    `;
 
    const resourcesResult = await client.query(resourcesQuery, [
      usecaseAssigneeId,
    ]);
    // Format the resource result
    const formattedResourcesResult =
      resourcesResult.rows.length > 0
        ? resourcesResult.rows.map((row) => ({
            resource_name: row.resourcename,
            role: row.role,
            total_tasks: row.totaltasks,
            current_task: row.currenttask,
            image: row.image,
          }))
        : [];
 
    return {
      statusCode: 200,
      body: JSON.stringify({
        usecaseStatus: usecaseStatus,
        resources: formattedResourcesResult,
      }),
    };
  } catch (error) {
    console.error("Error executing query", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Internal Server Error" }),
    };
  } finally {
    await client.end();
  }
};