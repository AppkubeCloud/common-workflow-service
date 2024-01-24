const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
  const usecase_id = event.pathParameters?.usecase_id;
  if (!usecase_id) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ error: "Missing usecase_id parameter" }),
    };
  }
  const client = await connectToDatabase();
  try {
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

    const taskGroups = {};
    result.rows.forEach((row) => {
      const stageName = row.task.stage;
      if (!taskGroups[stageName]) {
        taskGroups[stageName] = [];
      }
      const taskWithId = { ...row.task, id: row.id };
      taskGroups[stageName].push(taskWithId);
    });
    const usecase_stages = result.rows[0].usecase.stages;
    usecase_stages.forEach((stage) => {
      const stageName = Object.keys(stage)[0];

      if (taskGroups.hasOwnProperty(stageName)) {
        stage[stageName].tasks = taskGroups[stageName];
      } else {
        stage[stageName].tasks = [];
      }
    });
    const total_tasks = result.rows.length;
    const output = result.rows[0];
    const response = {
      usecase_id: output.usecase_id,
      assignee_id: output.assignee_id,
      assignee_name: output.resource.name,
      role: output.resource.role,
      image: output.resource.image,
      current_task: output.resource.current_task,
      total_task: total_tasks,
      usecase: {
        name: output.usecase.name,
        description: output.usecase.description,
        start_date: output.usecase.start_date,
        end_date: output.usecase.end_date,
        creation_date: output.usecase.creation_date,
        status: output.usecase.status,
        current_stage: output.usecase.current_stage,
        stages: usecase_stages,
      },
    };
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
