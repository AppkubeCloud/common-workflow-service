const { connectToDatabase } = require("../db/dbConnector")
const { z } = require("zod")
const middy = require("@middy/core")
const { authorize } = require("../util/authorizer")
const { errorHandler } = require("../util/errorHandler")
const { bodyValidator } = require("../util/bodyValidator")
const reqSchema = z.object({
	team_name: z.string().min(3, {
		message: "Team name must be atleast 3 charachters long",
	}),
	created_by_id: z.string().uuid({
		message: "Invalid created by id",
	}),
	roles: z.array(z.record(z.string(), z.string().uuid().array().nonempty())),
})
const { pathParamsValidator } = require("../util/pathParamsValidator")
const idSchema = z.object({
	id: z.string().uuid({ message: "Invalid project id" }),
})
exports.handler = middy(async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false
	const project_id = event.pathParameters?.id ?? null
	const requestBody = JSON.parse(event.body)
	const { team_name, created_by_id, roles } = requestBody
	const team = {
		name: team_name,
		created_by_id: created_by_id,
		created_time: new Date().toISOString(),
		roles: roles,
	}
	console.log(JSON.stringify(team))
	const client = await connectToDatabase()
	const query = `
                update projects_table
                set project = jsonb_set(
                    project,
                    '{team}',
                    coalesce(project->'team', '{}'::jsonb) || $1::jsonb,
                    true
                )
                where 
                    id = $2`
	const res = await client.query(query, [team, project_id])
	await client.end()
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Credentials": true,
		},
		body: JSON.stringify({
			message: "Team added to the project",
		}),
	}
})
	.use(authorize())
	.use(bodyValidator(reqSchema))
	.use(pathParamsValidator(idSchema))
	.use(errorHandler())
