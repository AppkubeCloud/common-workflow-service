const { connectToDatabase } = require("../db/dbConnector")
const { z } = require("zod")
const middy = require("@middy/core")
const { authorize } = require("../util/authorizer")
const { errorHandler } = require("../util/errorHandler")
const { bodyValidator } = require("../util/bodyValidator")

const reqSchema = z.object({
	name: z
		.string()
		.min(3, {
			message: "Project name must be atleast 3 charachters long",
		})
		.regex(/^[^-]*$/, {
			message: "name should not contain `-`",
		}),
	description: z.string(),
	department: z.string(),
	start_date: z.coerce.date(),
	end_date: z.coerce.date(),
	image_url: z.string().url({ message: "Invalid url for project icon" }),
})
exports.handler = middy(async (event, context) => {
	context.callbackWaitsForEmptyEventLoop = false
	const { name, description, department, start_date, end_date, image_url } =
		JSON.parse(event.body)
	const client = await connectToDatabase()
	const isDuplicate = await client.query(
		`SELECT COUNT(*) FROM projects_table WHERE LOWER(project->>'name') = LOWER($1)`,
		[name],
	)
	if (isDuplicate.rows[0].count > 0) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: "Project with same name already exists",
			}),
		}
	}
	const project = {
		name: name,
		status: "unassigned",
		description: description,
		department: department,
		image_url: image_url,
		current_stage: "",
		start_date: start_date,
		end_date: end_date,
		updated_by: {},
		workflows: [],
		team: {},
	}
	const result = await client.query(
		`INSERT INTO projects_table (project) VALUES ($1::jsonb) RETURNING *`,
		[project],
	)
	const insertedData = result.rows[0]
	insertedData.project.id = insertedData.id
	await client.end()
	return {
		statusCode: 200,
		headers: {
			"Access-Control-Allow-Origin": "*",
		},
		body: JSON.stringify(insertedData.project),
	}
})
	.use(authorize())
	.use(bodyValidator(reqSchema))
	.use(errorHandler())
