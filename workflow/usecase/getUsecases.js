const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event) => {
    const project_id = event.queryStringParameters?.project_id;
    if (!project_id) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: 'Missing project_id parameter' }),
        };
    }

    const workflow_id = event.queryStringParameters?.workflow_id;
    if (!workflow_id) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: 'Missing workflow_id parameter' }),
        };
    }
    const usecase_name = event.queryStringParameters?.usecase_name;  //optional

    try {
        const client = await connectToDatabase();

        let query = `
            SELECT
                usecases_table.id AS usecase_id,
                usecases_table.usecase->>'name' AS usecase_name,
                usecases_table.usecase->>'current_stage' AS current_stage,
                usecases_table.assignee_id AS usecase_assigned_id,
                resources_table.resource->>'name' AS assignee_name,
                COUNT(DISTINCT tasks_table.assignee_id) AS total_resources,
                usecases_table.usecase->>'start_date' AS start_date,
                usecases_table.usecase->>'end_date' AS end_date
            FROM
                usecases_table
            LEFT JOIN
                tasks_table ON usecases_table.id = tasks_table.usecase_id
            LEFT JOIN
                resources_table ON usecases_table.assignee_id = resources_table.id
            WHERE
                usecases_table.project_id = $1
                AND usecases_table.workflow_id = $2
        `;

        const params = [project_id, workflow_id];

        if (usecase_name) {
            query += ` AND usecases_table.usecase->>'name' = $3`;
            params.push(usecase_name);
        }

        query += `GROUP BY usecases_table.id, usecases_table.usecase, resources_table.resource`;

        const result = await client.query(query, params);

        const usecases = result.rows.map(row => ({
            usecase_id: row.usecase_id,
            usecase_name: row.usecase_name,
            current_stage: row.current_stage,
            assignee_id: row.usecase_assigned_id,
            assignee_name: row.assignee_name,
            total_resources: parseInt(row.total_resources) || 0,
            start_date: row.start_date,
            end_date: row.end_date
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(usecases),
        };
    } catch (e) {
        return {
            statusCode: 400,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({
                error: e.message || "An error occurred",
            }),
        };
    } finally {
        await client.end();
    }
};