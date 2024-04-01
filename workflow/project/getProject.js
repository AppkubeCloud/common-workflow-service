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
	const project_id = event.pathParameters?.id
	const client = await connectToDatabase()
	const projectQuery = `
        SELECT
            p.id AS project_id,
            p.project->>'name' AS project_name,
            p.project->'last_updated' AS last_updated,
            p.project->>'project_description' AS project_description
        FROM projects_table p
        WHERE p.id = $1`
	const projectResult = await client.query(projectQuery, [project_id])
	const project = projectResult.rows[0]
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
        `

	const usecasesResult = await client.query(usecasesQuery, [project_id])
	const workflows = usecasesResult.rows.map(row => ({
		id: row.workflow_id,
		name: row.workflow_name,
		total_usecases: row.total_usecases,
		task_completed: calculatePercentage(
			row.total_tasks,
			row.task_completed,
		),
	}))

	const response = {
		id: project.project_id,
		name: project.project_name,
		last_updated: project.last_updated || {},
		description: project.project_description || "",
		workflows: workflows,
	}
	await client.end()
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Credentials": true,
		},
		body: JSON.stringify(response),
	}
})
	.use(authorize())
	.use(pathParamsValidator(idSchema))
	.use(errorHandler())

function calculatePercentage(total, completed) {
	return total === 0 ? 0 : (completed / total) * 100
}
