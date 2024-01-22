const { connectToDatabase } = require("../db/dbConnector");
const { Client } = require("pg");
exports.handler = async (event, context, callback) => {
  const client = await connectToDatabase();
  const usecase_id = event.pathParameters?.id ?? null;
  try {
    await client.connect();
    const query = `
        SELECT
                u.*,
                u.assignee_id AS assignee_id,
                u.workflow_id AS workflow_id,
                r.*,
                w.*,
                t.*
            FROM
                usecases_table AS u
            LEFT JOIN
                resources_table AS r ON u.assignee_id = r.id
            LEFT JOIN
                tasks_table AS t ON u.id = t.usecase_id
            LEFT JOIN 
                workflows_table AS w ON u.workflow_id = w.id
            WHERE u.id =$1

`;

    const result = await client.query(query, [usecase_id]);
    // console.log(result);

    const taskGroups = {};

    result.rows.forEach((row) => {
      const stageName = row.task.stage;

      if (!taskGroups[stageName]) {
        taskGroups[stageName] = [];
      }

      taskGroups[stageName].push({
        tasks: row.task,
      });
    });

    const total_tasks = result.rows.length;
    const output = result.rows[0];
    const response = {
      usecase_id: output.usecase_id,
      project_id: output.project_id,
      workflow_id: output.workflow_id,
      assignee_id: output.assignee_id,
      assignee_name: output.resource.name,
      role: output.resource.role,
      image: output.resource.image,
      current_task: output.resource.current_task,
      total_task: total_tasks,
      usecase: output.usecase,
      taskGroups: taskGroups,
    };
    console.log(result);
    return {
      statusCode: 200,
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error("Error executing query", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error" }),
    };
  } finally {
    await client.end();
  }
};
