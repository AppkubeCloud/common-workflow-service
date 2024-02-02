const { connectToDatabase } = require("../db/dbConnector");
const { z } = require("zod");

exports.handler = async (event) => {
	const status = event.queryStringParameters?.status ?? null;
	const validStatusValues = ["unassigned", "completed", "inprogress"]
	const statusSchema = z.string().nullable().refine((value) => value === null || validStatusValues.includes(value), {
		message: "Invalid status value",
	}); 
	const isValidStatus = statusSchema.safeParse(status)
	if(!isValidStatus.success){
		return {
			statusCode: 400,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				error: isValidStatus.error.issues[0].message
			}),
		};
	}
	const client = await connectToDatabase();
	try {
		let query = `
					SELECT 
						p.id AS project_id,
						(p.project->>'name') AS project_name,
						(p.project->'project_manager') as project_manager,
						p.project->'team'->'roles' as team,
						(
							select 
								r.resource->'current_task'
							from 
								resources_table as r 
							where 
								r.id = (p.project->'project_manager'->>'id')::uuid
						) as manager_current_task,
						(
							select 
								count(t.id) as total_tasks
							from 
								tasks_table as t
							where 
								t.assignee_id = (p.project->'project_manager'->>'id')::uuid
						)
					FROM projects_table AS p`;
		let queryParams = [];
		if (status != null) {
			query += `
					WHERE 
						(p.project->>'status' = $1)`;
			queryParams.push(status);
		}
		const result = await client.query(query, queryParams);
		const response = await Promise.all(
			result.rows.map(
				async ({
					project_id,
					project_name,
					project_manager,
					manager_current_task,
					team,
					total_tasks,
				}) => {
					let resources;
					if (team != null || team != undefined) {
						const resourceIds = Array.from(
							new Set(team.map((e) => Object.values(e)).flat().flat())
						);
				const resourceQuery = `
					SELECT
						id as resource_id,
						resource->>'name' as resource_name,
						resource->>'image' as image_url,
						resource->>'email' as email
					FROM
					 resources_table 
					WHERE 
						id IN (${resourceIds.map((id) => `'${id}'`).join(", ")})`;
						const ress = await client.query(resourceQuery);
						resources = ress.rows.map(
							({
								resource_id,
								resource_name,
								image_url,
								email,
							}) => ({
								resource_id,
								resource_name,
								image_url,
								email,
							})
						);
					}
					return {
						project_id,
						project_name,
						manager_id: project_manager?.id || "",
						manager_name: project_manager?.name || "",
						manager_image_url: project_manager?.image_url || "",
						current_task: manager_current_task?.task_name || "",
						created_date: manager_current_task?.created_date || "",
						due_date: manager_current_task?.due_date || "",
						total_tasks : parseInt(total_tasks),
						project_resources: resources != undefined ? resources : [] ,
					};
				}
			)
		);
		return {
			statusCode: 200,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(response),
		};
	} catch (e) {
		return {
			statusCode: 500,
			headers: {
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({
				message: e.message,
				error : e
			}),
		};
	} finally {
		await client.end();
	}
};
