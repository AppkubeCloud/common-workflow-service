const { connectToDatabase } = require("../db/dbConnector");
exports.handler = async (event, context, callback) => {
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

    const client = await connectToDatabase();

    try {

        const usecasesQuery = `
            SELECT
                u.workflow_id,
                w.name AS workflow_name,
                COUNT(DISTINCT u.id) AS total_usecases,
                COUNT(t.id) AS total_tasks,
                COUNT(t.id) FILTER (WHERE (t.task ->> 'status') = 'completed') AS task_completed
            FROM usecases_table u
            LEFT JOIN tasks_table t ON u.id = t.usecase_id
            LEFT JOIN workflows_table w ON u.workflow_id = w.id
            WHERE u.project_id = $1
            GROUP BY u.workflow_id, w.name
        `;

        const usecasesResult = await client.query(usecasesQuery, [project_id]);
        const workflows = usecasesResult.rows.map(row => ({
            workflow_id: row.workflow_id,
            workflow_name: row.workflow_name,
            total_usecases: row.total_usecases,
            task_completed: calculatePercentage(row.total_tasks, row.task_completed),
        }));

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(workflows),
        };
    } catch (error) {   
        console.error(error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify({ error: 'Internal Server Error' }),
        };
    } finally {
        await client.end();
    }
};

function calculatePercentage(total, completed) {
    return total === 0 ? 0 : (completed / total) * 100;
}
