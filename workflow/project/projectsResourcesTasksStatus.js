const { connectToDatabase } = require("../db/dbConnector")
const { z } = require("zod")
const middy = require("@middy/core")
const { authorize } = require("../util/authorizer")
const { errorHandler } = require("../util/errorHandler")
const { pathParamsValidator } = require("../util/pathParamsValidator")
const idSchema = z.object({
	id: z.string().uuid({ message: "Invalid project id" }),
})
exports.handler = middy(async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false
	const projectId = event.pathParameters?.id ?? null
	const client = await connectToDatabase()
	const projectQuery = `
            SELECT project->'team'->'roles' AS roles,project->>'name' AS name
            FROM projects_table
            WHERE id = $1::uuid`
	const projectResult = await client.query(projectQuery, [projectId])
	const projectResult1 = projectResult.rows[0]
	console.log("projectResult", projectResult.rows[0])
	if (!projectResult1) {
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({ message: "No Project is present" }),
		}
	}

	const resourceIds = projectResult.rows.flatMap(row => {
		const roles = row.roles
		return roles.flatMap(role => Object.values(role).flat())
	})
	console.log("resourceIds", resourceIds)
	if (resourceIds.length == 0) {
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Access-Control-Allow-Credentials": true,
			},
			body: JSON.stringify({ message: "No Ids present in the roles" }),
		}
	}
	const tasksQuery = `
            SELECT
                r.id AS resource_id,
                COALESCE (r.first_name || ' ' || r.last_name, '') as name,
                COUNT(*) FILTER (WHERE t.task->>'status' = 'completed') AS completed,
                COUNT(*) FILTER (WHERE t.task->>'status' = 'inprogress') AS inprogress,
                COUNT(*) FILTER (WHERE t.task->>'status' = 'pending') AS pending
            FROM
                employee AS r
            LEFT JOIN
                tasks_table AS t ON r.id = t.assignee_id
            WHERE
                r.id = ANY($1::uuid[])
            GROUP BY
                r.id`
	const tasksResult = await client.query(tasksQuery, [resourceIds])
	const res = tasksResult.rows.map(obj => {
		return obj
	})
	await client.end()
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Credentials": true,
		},
		body: JSON.stringify(res),
	}
})
	.use(authorize())
	.use(pathParamsValidator(idSchema))
	.use(errorHandler())
