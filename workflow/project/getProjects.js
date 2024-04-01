const { connectToDatabase } = require("../db/dbConnector")
const { z } = require("zod")
const middy = require("@middy/core")
const { authorize } = require("../util/authorizer")
const { errorHandler } = require("../util/errorHandler")
const { queryParamsValidator } = require("../util/queryParamsValidator")

const idSchema = z.object({
	status: z.string({ message: "Invalid status value" }),
})
exports.handler = middy(async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false
	const org_id = event.user["custom:org_id"]
	const status = event.queryStringParameters?.status ?? null
	const validStatusValues = ["unassigned", "completed", "inprogress"]
	const statusSchema = z
		.string()
		.nullable()
		.refine(value => value === null || validStatusValues.includes(value), {
			message: "Invalid status value",
		})
	const isValidStatus = statusSchema.safeParse(status)
	if (!isValidStatus.success) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: isValidStatus.error.issues[0].message,
			}),
		}
	}
	const client = await connectToDatabase()
	let query = `
                    select 
                        p.id as project_id,
                        p.project->>'name' as proejct_name,
                        p.project->>'image_url' as project_icon_url,
                        p.project->>'status' as status,
                        p.project->'team'->'roles' as roles,
                        COUNT(u.id) as total_usecases
                    from 
                        projects_table as p
                    left join 
                        usecases_table as u on p.id = u.project_id`
	let queryparams = []
	if (status != null) {
		query += `
                    where 
                        p.project->>'status' = $1 AND p.org_id = $2`
		queryparams.push(status, org_id)
	}
	query += `
                    group by
                        p.id`
	const result = await client.query(query, queryparams)
	const response = result.rows.map(
		({
			project_id,
			proejct_name,
			project_icon_url,
			status,
			roles,
			total_usecases,
		}) => {
			let res = roles?.map(e => Object.values(e)).flat()
			return {
				id: project_id,
				name: proejct_name,
				image_url: project_icon_url,
				status,
				total_resources: new Set(res?.flat()).size,
				total_usecases: parseInt(total_usecases),
			}
		},
	)
	await client.end()
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
		body: JSON.stringify(response),
	}
})
	.use(authorize())
	.use(queryParamsValidator(idSchema))
	.use(errorHandler())
