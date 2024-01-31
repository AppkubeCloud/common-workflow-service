const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");
exports.handler = async (event) => {
	const { name, description, department, start_date, end_date, image_url } =
		JSON.parse(event.body);
	const newProject = {
		name: name,
		description: description,
		department: department,
		start_date: start_date,
		end_date: end_date,
		image_url: image_url,
	};
	console.log("new project", newProject);
	const ProjectSchema = z.object({
		name: z
			.string()
			.min(3, {
				message: "Project name must be atleast 3 charachters long",
			}),
		description: z.string(),
		department: z.string(),
		start_date: z.string().datetime(),
		end_date: z.string().datetime(),
		image_url: z.string().url({ message: "Invalid url for project icon" }),
	});

	const result = ProjectSchema.safeParse(newProject);
	if (!result.success) {
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: result.error.formErrors.fieldErrors,
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		const project = {
			name: newProject.name,
			status: "unassigned",
			description: newProject.description,
			department: newProject.department,
			icon_url: newProject.image_url,
			current_stage: "",
			start_date: newProject.start_date,
			end_date: newProject.end_date,
			updated_by: {},
			workflows: [],
			team: {},
		};
		console.log("project : ", project);
		const result = await client.query(
			`INSERT INTO projects_table (project) VALUES ($1::jsonb) RETURNING *`,
			[project]
		);
		const insertedData = result.rows[0];
		insertedData.project.id = insertedData.id;
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(insertedData.project),
		};
	} catch (error) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: error.message,
				error: error,
			}),
		};
	} finally {
		await client.end();
	}
};