const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
const middy = require("middy")
const { errorHandler } = require("../util/errorHandler")
const { authorize } = require("../util/authorizer")
const { queryParamsValidator } = require("../util/queryParamsValidator")


const idSchema = z.object({
	project_id: z.string().uuid({ message: "Invalid project id" }),
})

exports.handler = middy(async (event, context, callback) => {

	context.callbackWaitsForEmptyEventLoop = false
	const org_id = event.user["custom:org_id"]
	const projectId = event.queryStringParameters?.project_id ?? null;
	const client = await connectToDatabase();

	let query = `
					SELECT
						p.id AS project_id,
						(p.project->>'name') AS project_name,
						COUNT(u.id) AS usecase_count,
						COUNT(*) FILTER (WHERE u.usecase->>'status' = 'completed') AS completed
					FROM
						projects_table AS p
					LEFT JOIN
						usecases_table AS u ON p.id = u.project_id
					 `;
	const queryParams = [];
	if (projectId !== null) {
		query += `
					WHERE
						p.id = $1
					AND p.org_id = $2`;
		queryParams.push(projectId);
		queryParams.push(org_id);
	}
	query += `
					GROUP BY
						p.id`;
	const result = await client.query(query, queryParams);
	const usecaseOverview = result.rows.map(
		({ project_id, project_name, usecase_count, completed }) => ({
			project_id,
			project_name,
			completed: parseInt(completed),
			incomplete: usecase_count - completed,
		})
	);
	await client.end();

	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
		body: JSON.stringify(Object.values(usecaseOverview)),
	};

})
	.use(authorize())
	.use(errorHandler())
	.use(queryParamsValidator(idSchema))